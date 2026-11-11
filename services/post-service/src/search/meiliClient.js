import { Meilisearch } from 'meilisearch';

// ── User-Agent override ─────────────────────────────────────────────
// Render's free-tier public URLs sit behind a Cloudflare edge layer that
// appears to block/rate-limit automated, non-browser-looking traffic —
// confirmed via UptimeRobot getting a consistent 502 (with Cf-Ray /
// Cf-Cache-Status headers) on this same host, while Render's OWN internal
// health checks (user_agent=Render/1.0) succeed every time. Sending a
// normal desktop browser User-Agent gets past it.
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const MEILI_HOST = process.env.MEILI_HOST || 'http://localhost:7700';

export const meiliClient = new Meilisearch({
  host: MEILI_HOST,
  apiKey: process.env.MEILI_MASTER_KEY || 'dev_master_key_change_me',
  requestConfig: {
    headers: {
      'User-Agent': BROWSER_USER_AGENT,
    },
  },
});

const POSTS_INDEX = 'posts';

// Attributes that must be filterable for existing features to work:
//   - `tags` — searchTagFacets() does a facet-distribution search on
//     `tags`, and searchPostsByTag() filters with `tags = "..."`.
// Meilisearch settings live in data.ms, so they're wiped along with
// everything else whenever Render's ephemeral disk resets. They are
// therefore re-applied on every successful bootstrap, not just on creation.
const FILTERABLE_ATTRIBUTES = ['tags'];

async function ensurePostsIndex() {
  try {
    await meiliClient.getIndex(POSTS_INDEX);
  } catch (err) {
    const code = err.code || err.cause?.code || err.errorCode;
    if (code === 'index_not_found') {
      await meiliClient.createIndex(POSTS_INDEX, { primaryKey: '_id' });
      console.log(`✅ Created "${POSTS_INDEX}" index`);
    } else {
      throw err;
    }
  }

  // Idempotent and cheap when already correct — safe on every boot.
  try {
    await meiliClient.index(POSTS_INDEX).updateFilterableAttributes(FILTERABLE_ATTRIBUTES);
  } catch (err) {
    console.warn('⚠️ Could not set filterable attributes on "posts" index:', err.message);
  }
}

// ── Readiness state ─────────────────────────────────────────────────
let ready = false;
let bootstrapping = false;
let savedOnReady = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const isSearchReady = () => ready;

/**
 * Single attempt: health check → ensure index → ensure settings.
 * Returns true on success, false on failure. Never throws.
 */
export async function initMeilisearch() {
  try {
    await meiliClient.health();
    await ensurePostsIndex();
    ready = true;
    console.log('✅ Meilisearch connected');
    return true;
  } catch (err) {
    ready = false;
    console.warn('⚠️ Meilisearch unavailable:', err.message);
    return false;
  }
}

/**
 * Keeps trying to initialise Meilisearch in the background until it
 * succeeds, with exponential backoff (5s → 10s → 20s → 40s → 60s cap).
 * Does NOT block server startup — a sleeping free-tier Meilisearch can
 * take 30-60s to wake, and search is non-critical.
 *
 * `onReady` runs once after each successful bootstrap (e.g. to rebuild
 * an empty index). It's remembered so a later failure can re-trigger the
 * whole sequence via reportSearchFailure().
 *
 * Safe to call repeatedly: it's a no-op while a bootstrap loop is
 * already running or search is already ready.
 */
export function startSearchBootstrap({ onReady } = {}) {
  if (onReady) savedOnReady = onReady;
  if (ready || bootstrapping) return;

  bootstrapping = true;

  (async () => {
    let attempt = 0;
    while (!ready) {
      const ok = await initMeilisearch();
      if (ok) break;
      const delay = Math.min(5000 * 2 ** attempt, 60000);
      attempt += 1;
      console.log(`🔁 Retrying Meilisearch in ${delay / 1000}s (attempt ${attempt})`);
      await sleep(delay);
    }
    bootstrapping = false;

    if (savedOnReady) {
      try {
        await savedOnReady();
      } catch (err) {
        console.warn('⚠️ Post-bootstrap search setup failed:', err.message);
      }
    }
  })();
}

/**
 * Call this from a catch block when a real search request to Meilisearch
 * fails. It marks search as down and restarts the bootstrap loop, so the
 * service heals itself without a redeploy.
 */
export function reportSearchFailure() {
  ready = false;
  startSearchBootstrap();
}

/**
 * Pings Meilisearch's public /health endpoint on an interval so Render's
 * free tier doesn't put it to sleep after ~15 minutes of no traffic.
 * Uses the browser User-Agent so Cloudflare doesn't block it.
 * Disable with MEILI_KEEPALIVE=false. Skipped for localhost.
 */
export function startMeiliKeepAlive(intervalMs = 10 * 60 * 1000) {
  if (process.env.MEILI_KEEPALIVE === 'false') return;
  if (/localhost|127\.0\.0\.1/.test(MEILI_HOST)) return;

  const timer = setInterval(() => {
    fetch(`${MEILI_HOST}/health`, {
      headers: { 'User-Agent': BROWSER_USER_AGENT },
    }).catch(() => {
      /* ignore — the bootstrap loop handles real failures */
    });
  }, intervalMs);

  timer.unref?.(); // never keep the process alive just for this timer
}

export function postsIndex() {
  return meiliClient.index(POSTS_INDEX);
}