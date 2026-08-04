import { searchPosts, searchTagFacets, searchPostsByTag } from '../search/postIndex.js';

// GET /api/posts/search?q=<term>&limit=<n>&offset=<n>
export async function search(req, res) {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  const requestedLimit = Number(req.query.limit);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 50)
    : 20;

  const requestedOffset = Number(req.query.offset);
  const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0;

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

  console.log(`[SEARCH] "${q}" limit=${limit} offset=${offset}`);

  try {
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

// GET /api/posts/search/tags?q=<term>&limit=<n>
export async function searchTags(req, res) {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

  const requestedLimit = Number(req.query.limit);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 50)
    : 8;

  if (!q) {
    return res.json({ success: true, query: q, results: [] });
  }

  try {
    const results = await searchTagFacets(q, { limit });
    return res.json({ success: true, query: q, results });
  } catch (err) {
    console.error('searchTags error:', err.message);
    // Same degrade-gracefully convention as `search` above.
    return res.json({ success: true, query: q, results: [] });
  }
}

// GET /api/posts/tag/:tagName?limit=<n>&offset=<n>
export async function getPostsByTag(req, res) {
  const tagName =
    typeof req.params.tagName === 'string' ? req.params.tagName.trim().toLowerCase() : '';

  const requestedLimit = Number(req.query.limit);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 50)
    : 20;

  const requestedOffset = Number(req.query.offset);
  const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0;

  if (!tagName) {
    return res.status(400).json({ success: false, message: 'Tag name is required.' });
  }

  try {
    const { hits, estimatedTotalHits } = await searchPostsByTag(tagName, { limit, offset });

    return res.json({
      success: true,
      tag: tagName,
      total: estimatedTotalHits,
      limit,
      offset,
      results: hits,
    });
  } catch (err) {
    console.error('getPostsByTag error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}