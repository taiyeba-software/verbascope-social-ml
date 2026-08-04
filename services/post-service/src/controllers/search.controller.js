import { searchPosts } from '../search/postIndex.js';

// GET /api/posts/search?q=<term>&limit=<n>&offset=<n>
export async function search(req, res) {
  // ── Task 1: validate q is actually a string, not an array/object/etc. ──
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  // ── Task 2: clamp limit to [1, 50], default 20 ──
  const requestedLimit = Number(req.query.limit);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 50)
    : 20;

  // ── Task 3: clamp offset to >= 0, default 0 ──
  const requestedOffset = Number(req.query.offset);
  const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0;

  // ── Task 5: consistent response shape, even on the empty-query path ──
  if (!q) {
    return res.json({
      success: true,
      query: q,
      total: 0,
      limit,
      offset,
      results: [],
    });
  }

  // ── Task 6: temporary search logging ──
  console.log(`[SEARCH] "${q}" limit=${limit} offset=${offset}`);

  try {
    // ── Task 4: pull estimatedTotalHits alongside hits ──
    const { hits, estimatedTotalHits } = await searchPosts(q, { limit, offset });

    return res.json({
      success: true,
      query: q,
      total: estimatedTotalHits,
      limit,
      offset,
      results: hits,
    });
  } catch (err) {
    console.error('search error:', err.message);
    // Meilisearch is non-critical (Phase 0 principle) — degrade to
    // empty results with the same shape as a successful response,
    // instead of 500ing the whole route.
    return res.json({
      success: true,
      query: q,
      total: 0,
      limit,
      offset,
      results: [],
    });
  }
}