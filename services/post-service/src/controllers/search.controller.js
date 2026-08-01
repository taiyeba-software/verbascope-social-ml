import { searchPosts } from '../search/postIndex.js';

// GET /api/posts/search?q=<term>&limit=<n>&offset=<n>
export async function search(req, res) {
  const q = req.query.q?.trim();

  if (!q) {
    return res.json({ success: true, results: [] });
  }

  const limit = Number(req.query.limit) || 20;
  const offset = Number(req.query.offset) || 0;

  try {
    // searchPosts() returns Meilisearch's full response object
    // ({ hits, estimatedTotalHits, processingTimeMs, ... }), not just
    // the hits array — extract what the route actually needs.
    const { hits } = await searchPosts(q, { limit, offset });
    return res.json({ success: true, results: hits });
  } catch (err) {
    console.error('search error:', err.message);
    // Meilisearch is non-critical (Phase 0 principle) — degrade to
    // empty results instead of 500ing the whole route.
    return res.json({ success: true, results: [] });
  }
}