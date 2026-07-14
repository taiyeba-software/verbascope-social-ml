import mongoose from 'mongoose';
import Post from '../models/post.model.js';
import { publish } from '../broker/rabbit.js';
import { pulse } from '../pulse/pulse.js';
import { uploadToImageKit } from '../utils/imagekit.js';
import { generateImageKitFileName } from '../middlewares/upload.middleware.js';
import { detectLanguage } from '../utils/detectLanguage.js';
import { normalizeText } from '../utils/normalizeText.js';
import authClient from '../utils/authClient.js';
import { io } from '../../server.js'; // ── NEW: needed to broadcast post:deleted ──

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const extractTags = (text = '') =>
  (text.match(/#([\p{L}\p{N}_]+)/gu) ?? [])
    .map((tag) => tag.slice(1).toLowerCase());

const countWords = (text = '') =>
  (text.match(/\S+/g) ?? []).length;

const addStateFlags = (posts, userId) =>
  posts.map((post) => ({
    ...post,
    likedByMe:  post.likedBy?.some((id) => id.toString() === userId) || false,
    sharedByMe: post.sharedBy?.some((id) => id.toString() === userId) || false,
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

    const enriched     = posts.map((p) => ({ ...p, author: userMap[p.author.toString()] || null }));
    const postsWithState = addStateFlags(enriched, userId);
    const total          = await Post.countDocuments();

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

    const [postWithState] = addStateFlags([post], req.user.id);
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

    const posts = await Post.find({ author: req.params.userId })
      .sort({ createdAt: -1 })
      .lean();

    // Single bulk call for all posts' author (same user)
    const usersRes = await authClient.post('/api/users/bulk', {
      ids: [req.params.userId],
    });
    const author = usersRes.data.users?.[0] || null;

    const enrichedPosts = posts.map((post) => ({ ...post, author }));

    return res.status(200).json({ success: true, posts: enrichedPosts });
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