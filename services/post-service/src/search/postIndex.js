import { postsIndex } from './meiliClient.js';
import Post from '../models/post.model.js';
import authClient from '../utils/authClient.js';

// `author` here is the enriched author object fetched from auth-service
// (same shape as `populatedPost.author` in post.controller.js), NOT the
// raw ObjectId stored on the Mongo doc. Passing it in avoids this module
// making its own authClient call on every index/update.
//
// auth-service returns { fullname: { firstName, lastName }, ... } — no
// flat `name`/`username`/`displayName` field — so build the display name
// from that. Kept the old field checks as a fallback in case another
// caller ever passes a differently-shaped user object.
const pickAuthorName = (author) => {
  const first = author?.fullname?.firstName;
  const last  = author?.fullname?.lastName;
  if (first || last) return [first, last].filter(Boolean).join(' ');
  return author?.username || author?.name || author?.displayName || 'Unknown';
};

// Same truthy/empty-string convention used everywhere else the avatar
// gets read (feedHelpers.ts's getAuthorAvatarUrl, PostCard, CreatePostBox):
// treat a missing `avatar` key AND "" (what users with no avatar yet
// actually have in the auth-service response) both as "no avatar", so the
// frontend always gets a clean null instead of having to re-check for "".
const pickAuthorAvatar = (author) => author?.avatar || null;

const toSearchDoc = (post, author) => ({
  _id: post._id.toString(),
  content: post.content || '',
  normalizedContent: post.normalizedContent || '',
  tags: post.tags || [],
  authorId: (post.author?._id ?? post.author)?.toString?.() || String(post.author),
  authorName: pickAuthorName(author),
  authorAvatar: pickAuthorAvatar(author), // ImageKit URL or null
  contentLanguage: post.contentLanguage,
  wordCount: post.wordCount || 0,
  imagesCount: post.images?.length || 0,
  // Meilisearch has no native Date type — store as epoch ms so it's
  // sortable/filterable later (e.g. `createdAt > X`).
  createdAt: post.createdAt ? new Date(post.createdAt).getTime() : Date.now(),
});

// Fire-and-forget from the controller — never throws, only logs.
export async function indexPost(post, author = null) {
  try {
    await postsIndex().addDocuments([toSearchDoc(post, author)]);
  } catch (err) {
    console.error('⚠️ indexPost failed:', err.message);
  }
}

// Meilisearch's addDocuments already upserts by primaryKey, so this is
// functionally identical to indexPost() today — kept as a separate,
// clearly-named export because Phase 6/7 (edits, ML-enriched fields)
// will want to call "update" explicitly rather than "index".
export async function updateIndexedPost(post, author = null) {
  try {
    await postsIndex().updateDocuments([toSearchDoc(post, author)]);
  } catch (err) {
    console.error('⚠️ updateIndexedPost failed:', err.message);
  }
}

export async function deleteIndexedPost(postId) {
  try {
    await postsIndex().deleteDocument(postId.toString());
  } catch (err) {
    console.error('⚠️ deleteIndexedPost failed:', err.message);
  }
}

// Used by GET /api/posts/search.
export async function searchPosts(query, opts = {}) {
  const { limit = 20, offset = 0 } = opts;
  return postsIndex().search(query, { limit, offset });
}

// ── Tag search ──────────────────────────────────────────────────────

// Used by GET /api/posts/search/tags. Meilisearch facet search: pull the
// post-count for EVERY tag in the index (limit: 0 = don't return actual
// post hits, only facetDistribution), then filter down to tags whose name
// contains the query. Requires `tags` to be in filterableAttributes in
// your Meilisearch index settings — it already must be, since the
// existing tag-detail filter (`tags = "..."`) depends on the same thing.
export async function searchTagFacets(query, opts = {}) {
  const { limit = 8 } = opts;
  const q = query.toLowerCase();

  const { facetDistribution } = await postsIndex().search('', {
    facets: ['tags'],
    limit: 0,
  });

  const allTags = facetDistribution?.tags || {};

  return Object.entries(allTags)
    .filter(([tag]) => tag.toLowerCase().includes(q))
    .sort((a, b) => b[1] - a[1]) // most-used tags first
    .slice(0, limit)
    .map(([tag, postsCount]) => ({ tag, postsCount }));
}

// Used by GET /api/posts/tag/:tagName. Exact match, not fuzzy — a tag
// either exists on a post or it doesn't — so this filters rather than
// searching with `q`.
export async function searchPostsByTag(tagName, opts = {}) {
  const { limit = 20, offset = 0 } = opts;
  // Meilisearch filter expressions use double-quoted string values —
  // escape any literal double quotes in the tag itself so a tag like
  // `foo"bar` can't break out of the filter expression.
  const safeTag = tagName.replace(/"/g, '\\"');

  return postsIndex().search('', {
    filter: `tags = "${safeTag}"`,
    limit,
    offset,
  });
}

// ── Shared rebuild logic ────────────────────────────────────────────
// Callable from BOTH the admin route (post.controller.js's
// reindexAllPosts) and server.js's startup self-healing check. Never
// call the Express handler (reindexAllPosts) internally — it expects
// (req, res), and mixing HTTP concerns into startup code is the wrong
// shape. This is the actual business logic; the route just wraps it
// with req/res handling.
//
// Identical in behavior to the loop that used to live inline inside
// reindexAllPosts — moved here unchanged so both callers share one
// implementation instead of drifting apart over time.
export async function rebuildSearchIndex() {
  const posts = await Post.find().lean();

  let indexed = 0;
  let failed = 0;

  for (const post of posts) {
    try {
      // Same author-fetch pattern as createPost/getPost — indexPost
      // needs the author object, not just the ID.
      const usersRes = await authClient.post('/api/users/bulk', {
        ids: [post.author.toString()],
      });
      const author = usersRes.data.users?.[0] || null;

      await indexPost(post, author);
      indexed++;
    } catch (err) {
      console.error(`Failed to index post ${post._id}:`, err.message);
      failed++;
    }
  }

  return { indexed, failed, total: posts.length };
}