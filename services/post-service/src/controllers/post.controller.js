import mongoose from 'mongoose';
import Post from '../models/post.model.js';
import SavedPost from '../models/savedPost.model.js';
import { publish } from '../broker/rabbit.js';
import { pulse } from '../pulse/pulse.js';
import { uploadToImageKit } from '../utils/imagekit.js';
import { generateImageKitFileName } from '../middlewares/upload.middleware.js';
import { detectLanguage } from '../utils/detectLanguage.js';
import { normalizeText } from '../utils/normalizeText.js';
import authClient from '../utils/authClient.js';
import { io } from '../../server.js'; // ── NEW: needed to broadcast post:deleted ──
import { indexPost, deleteIndexedPost } from '../search/postIndex.js'; // ── NEW: Phase 1 search indexing ──

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const extractTags = (text = '') =>
  (text.match(/#([\p{L}\p{N}_]+)/gu) ?? [])
    .map((tag) => tag.slice(1).toLowerCase());

const countWords = (text = '') =>
  (text.match(/\S+/g) ?? []).length;

// `savedPostIds` is a Set of post-id strings the current user has bookmarked
// (looked up from the SavedPost join collection — saves are NOT stored on
// the Post doc itself, unlike likedBy/sharedBy). Defaults to an empty Set so
// any existing caller that doesn't pass one just gets bookmarkedByMe: false
// instead of throwing.
//
// EXPORTED so savedPost.controller.js's getSavedPosts() can run its results
// through the exact same enrichment logic as getFeed/getPost/getPostsByUser.
// Previously getSavedPosts() built its own plain post objects and never set
// likedByMe/sharedByMe/isOwner at all, so every post on the Saved tab always
// showed likedByMe: undefined (falsy) regardless of the real state — that
// was the root cause of the "You already liked this post." 409s coming from
// the Saved tab.
export const addStateFlags = (posts, userId, savedPostIds = new Set()) =>
  posts.map((post) => ({
    ...post,
    likedByMe:      post.likedBy?.some((id) => id.toString() === userId) || false,
    sharedByMe:     post.sharedBy?.some((id) => id.toString() === userId) || false,
    bookmarkedByMe: savedPostIds.has(post._id.toString()),
    isOwner:
      post.author?._id?.toString() === userId ||
      post.author?.toString() === userId,
  }));

// ── POST /api/posts ──────────────────────────────────────────────────
export const createPost = async (req, res) => {
  try {
    const { content } = req.body;
    const files = req.files ?? [];

    if (!content?.trim() && files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'A post must have content or at least one image.',
      });
    }

    const imageUrls = await Promise.all(
      files.map((file) =>
        uploadToImageKit(file.buffer, generateImageKitFileName(file.originalname))
      )
    );

    const rawContent         = content?.trim() || '';
    const tags               = extractTags(rawContent);
    const wordCount          = countWords(rawContent);
    const contentLanguage    = detectLanguage(rawContent);   // renamed
    const normalizedContent  = normalizeText(rawContent);

    const newPost = await Post.create({
      author: req.user.id,
      content: rawContent,
      normalizedContent,
      contentLanguage,                                        // renamed
      wordCount,
      tags,
      images: imageUrls,
    });

    pulse.onPostCreated(newPost, req.user.id);
    publish('post.created', { post: newPost });

    // Fetch author from auth-service instead of populate()
    const usersRes = await authClient.post('/api/users/bulk', {
      ids: [newPost.author.toString()],
    });
    const author = usersRes.data.users?.[0] || null;

    const populatedPost = { ...newPost.toObject(), author };

    // ── NEW: Phase 1 search indexing ──
    // Fire-and-forget — search is non-critical, so we never make the
    // response wait on Meilisearch, and any failure here is only logged.
    indexPost(newPost, author).catch((err) =>
      console.error('indexPost error:', err.message)
    );

    return res.status(201).json({ success: true, post: populatedPost });
  } catch (err) {
    console.error('createPost error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── GET /api/posts/feed ──────────────────────────────────────────────
export const getFeed = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, parseInt(req.query.limit) || 10);
    const skip   = (page - 1) * limit;
    const userId = req.user.id;

    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const userIds  = [...new Set(posts.map((p) => p.author.toString()))];
    const usersRes = await authClient.post('/api/users/bulk', { ids: userIds });
    const userMap  = Object.fromEntries(
      usersRes.data.users.map((u) => [u._id.toString(), u])
    );

    // Which of THIS page's posts has the current user already saved?
    // Scoped to `posts` (not a global "all my saves" query) since that's
    // all addStateFlags needs, and it keeps this cheap even for users
    // with a large saved-posts history.
    const savedDocs = await SavedPost.find({
      user: userId,
      post: { $in: posts.map((p) => p._id) },
    })
      .select('post')
      .lean();
    const savedPostIds = new Set(savedDocs.map((d) => d.post.toString()));

    const enriched        = posts.map((p) => ({ ...p, author: userMap[p.author.toString()] || null }));
    const postsWithState  = addStateFlags(enriched, userId, savedPostIds);
    const total            = await Post.countDocuments();

    return res.status(200).json({
      success: true,
      page,
      totalPages: Math.ceil(total / limit),
      total,
      posts: postsWithState,
    });
  } catch (err) {
    console.error('getFeed error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── GET /api/posts/:id ───────────────────────────────────────────────
export const getPost = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid post ID.' });
    }

    const post = await Post.findById(req.params.id).lean();
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }

    // Fetch author from auth-service
    const usersRes = await authClient.post('/api/users/bulk', {
      ids: [post.author.toString()],
    });
    post.author = usersRes.data.users?.[0] || null;

    // Single-post version of the same saved-lookup used in getFeed.
    const isSaved      = await SavedPost.exists({ user: req.user.id, post: post._id });
    const savedPostIds = isSaved ? new Set([post._id.toString()]) : new Set();

    const [postWithState] = addStateFlags([post], req.user.id, savedPostIds);
    return res.status(200).json({ success: true, post: postWithState });
  } catch (err) {
    console.error('getPost error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── GET /api/posts/user/:userId ──────────────────────────────────────
export const getPostsByUser = async (req, res) => {
  try {
    if (!isValidId(req.params.userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }

    const viewerId = req.user.id; // the logged-in viewer, NOT the profile owner

    const posts = await Post.find({ author: req.params.userId })
      .sort({ createdAt: -1 })
      .lean();

    // Single bulk call for all posts' author (same user, profile owner)
    const usersRes = await authClient.post('/api/users/bulk', {
      ids: [req.params.userId],
    });
    const author = usersRes.data.users?.[0] || null;

    const enrichedPosts = posts.map((post) => ({ ...post, author }));

    // Same saved-lookup pattern as getFeed — scoped to viewerId (the
    // logged-in user), not the profile owner, and to just this page's
    // posts.
    const savedDocs = await SavedPost.find({
      user: viewerId,
      post: { $in: posts.map((p) => p._id) },
    })
      .select('post')
      .lean();
    const savedPostIds = new Set(savedDocs.map((d) => d.post.toString()));

    const postsWithState = addStateFlags(enrichedPosts, viewerId, savedPostIds);

    return res.status(200).json({ success: true, posts: postsWithState });
  } catch (err) {
    console.error('getPostsByUser error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── DELETE /api/posts/:id ────────────────────────────────────────────
export const deletePost = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid post ID.' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }

    if (post.author.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this post.',
      });
    }

    await post.deleteOne();

    // ── NEW: Phase 1 search indexing ──
    // Fire-and-forget, same rationale as createPost — a Meilisearch
    // hiccup should never block or fail a delete.
    deleteIndexedPost(req.params.id).catch((err) =>
      console.error('deleteIndexedPost error:', err.message)
    );

    // ── NEW: tell every connected browser this post is gone, so it
    // disappears from everyone's feed instantly instead of only after
    // a reload (useFeedSocket.ts already listens for this event). ──
    io.emit('post:deleted', { postId: req.params.id });

    return res.status(200).json({ success: true, message: 'Post deleted.' });
  } catch (err) {
    console.error('deletePost error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};