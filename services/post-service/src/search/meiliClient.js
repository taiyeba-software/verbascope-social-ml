import { Meilisearch } from 'meilisearch';

// ── User-Agent override ─────────────────────────────────────────────
// Render's free-tier public URLs sit behind a Cloudflare edge layer that
// appears to block/rate-limit automated, non-browser-looking traffic —
// confirmed via UptimeRobot getting a consistent 502 (with Cf-Ray /
// Cf-Cache-Status headers) on this same host, while Render's OWN internal
// health checks (user_agent=Render/1.0) succeed every time. The default
// User-Agent sent by the meilisearch-js SDK (and by a bare fetch()) looks
// like automated/bot traffic to that layer. Sending a normal desktop
// browser User-Agent is a cheap, free thing to try before assuming this
// requires moving off Render's free tier entirely.
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

export const meiliClient = new Meilisearch({
  host: process.env.MEILI_HOST || 'http://localhost:7700',
  apiKey: process.env.MEILI_MASTER_KEY || 'dev_master_key_change_me',
  requestConfig: {
    headers: {
      'User-Agent': BROWSER_USER_AGENT,
    },
  },
});

const POSTS_INDEX = 'posts';

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
}

export async function initMeilisearch() {
  // ── TEMP DIAGNOSTIC: bypass the meilisearch client entirely, using
  // raw fetch, to see exactly what post-service's own network gets back
  // from MEILI_HOST — removes this file's client library as a variable.
  // Also carries the same User-Agent override so this diagnostic path
  // and the real client are tested under identical conditions.
  try {
    const raw = await fetch(`${process.env.MEILI_HOST}/health`, {
      headers: {
        Authorization: `Bearer ${process.env.MEILI_MASTER_KEY}`,
        'User-Agent': BROWSER_USER_AGENT,
      },
    });
    const text = await raw.text();
    console.log('🔍 [MEILI DIAGNOSTIC] status:', raw.status);
    console.log('🔍 [MEILI DIAGNOSTIC] body:', text.slice(0, 300));
  } catch (err) {
    console.log('🔍 [MEILI DIAGNOSTIC] fetch itself threw:', err.message);
  }

  try {
    await meiliClient.health();
    console.log('✅ Meilisearch connected');
    await ensurePostsIndex();
    return true;
  } catch (err) {
    console.warn('⚠️ Meilisearch unavailable — search disabled.');
    console.warn(err.message);
    return false;
  }
}


export function postsIndex() {
  return meiliClient.index(POSTS_INDEX);
}