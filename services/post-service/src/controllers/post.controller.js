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
import { io } from '../../server.js';
import { indexPost, deleteIndexedPost, rebuildSearchIndex } from '../search/postIndex.js';
import { getAISignal } from '../ml/signalMapper.js';
import { SIGNAL_MAP, getInsightsWindowStart } from './share.controller.js';


const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ── NEW: AI Filter ──
// Allowed values for GET /api/posts/feed?risk=...
// Filters by the ML Brain's prediction (mlAnalysis.riskFlag) only.
// Community-based filtering stays with `signal` (Community Consensus).
// `risk` is a comma-separated list, e.g. risk=green,yellow — MongoDB
// matches any post whose riskFlag is one of the given colors ($in).
// An empty list, or all three colors, is equivalent to no filter.
const ALLOWED_RISK_FLAGS = ['green', 'yellow', 'red'];

const parseRiskFilter = (rawRisk) => {
  if (typeof rawRisk !== 'string' || rawRisk.trim() === '') {
    return { risks: [], invalid: [] };
  }

  const tokens = rawRisk
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter((r) => r !== '');

  const risks = [...new Set(tokens.filter((r) => ALLOWED_RISK_FLAGS.includes(r)))];
  const invalid = [...new Set(tokens.filter((r) => !ALLOWED_RISK_FLAGS.includes(r)))];

  return { risks, invalid };
};

const extractTags = (text = '') =>
  (text.match(/#([\p{L}\p{N}_]+)/gu) ?? [])
    .map((tag) => tag.slice(1).toLowerCase());

const countWords = (text = '') =>
  (text.match(/\S+/g) ?? []).length;

const broadcastPulseUpdate = () => {
  pulse.getWeeklyPulse()
    .then((weeklyPulse) => io.emit('pulse:update', weeklyPulse))
    .catch((err) => console.error('broadcastPulseUpdate error:', err.message));
};

// EXPORTED so savedPost.controller.js's getSavedPosts() can run its results
// through the exact same enrichment logic as getFeed/getPost/getPostsByUser.
export const addStateFlags = (posts, userId, savedPostIds = new Set()) =>
  posts.map((post) => ({
    ...post,
    likedByMe:  post.likedBy?.some((id) => id.toString() === userId) || false,
    // ── UPDATED: Community Signals ──
    // sharedBy entries are now { user, reason, sharedAt } on posts shared
    // after this change, but documents shared before it still have
    // sharedBy as raw ObjectIds — `(entry.user ?? entry)` handles both
    // shapes. See the migration note in post.model.js / the one-time
    // scripts/migrateSharedBy.js script.
    sharedByMe: post.sharedBy?.some((entry) => (entry.user ?? entry)?.toString() === userId) || false,
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
    const contentLanguage    = detectLanguage(rawContent);
    const normalizedContent  = normalizeText(rawContent);
    const pulseTopic         = tags.length > 0 ? tags[0] : 'general';

    const newPost = await Post.create({
      author: req.user.id,
      content: rawContent,
      normalizedContent,
      contentLanguage,
      wordCount,
      tags,
      pulseTopic,
      images: imageUrls,
    });

    pulse.onPostCreated(newPost, req.user.id);
    broadcastPulseUpdate();
    publish('post.created', { post: newPost });

    if (rawContent) {
      publish('ml.analyze', {
        postId: newPost._id.toString(),
        text: rawContent,
      });
    }

    const usersRes = await authClient.post('/api/users/bulk', {
      ids: [newPost.author.toString()],
    });
    const author = usersRes.data.users?.[0] || null;

    const populatedPost = { ...newPost.toObject(), author };

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
// Query params:
//   page, limit
//   signal  — Community Consensus filter (existing)
//   risk    — NEW: AI Filter, by ML Brain prediction. Comma-separated list
//             of green | yellow | red, e.g. risk=green,yellow. Matches a
//             post if its riskFlag is ANY of the given colors ($in).
//             Omitted / empty / all three colors = no risk filtering.
// `signal` and `risk` are independent and can be combined.
export const getFeed = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, parseInt(req.query.limit) || 10);
    const skip   = (page - 1) * limit;
    const userId = req.user.id;

    const { signal, risk } = req.query;
    const filter = {};
    let sort = { createdAt: -1 };

    // ── Community Consensus filter (unchanged) ──
    if (signal !== undefined && signal !== '') {
      const isKnownSignal =
        typeof signal === 'string' &&
        Object.prototype.hasOwnProperty.call(SIGNAL_MAP, signal);

      if (!isKnownSignal) {
        return res.status(400).json({
          success: false,
          message: `Invalid signal. Allowed values: ${Object.keys(SIGNAL_MAP).join(', ')}`,
        });
      }

      const dbPath = `shareReasons.${SIGNAL_MAP[signal]}`;

      filter.createdAt = { $gte: getInsightsWindowStart() };
      filter[dbPath]   = { $gt: 0 };
      sort = { [dbPath]: -1, createdAt: -1 };
    }

    // ── NEW: AI Filter — ML Brain prediction only, multi-select ──
    if (risk !== undefined && risk !== '' && risk !== 'all') {
      const { risks, invalid } = parseRiskFilter(risk);

      if (invalid.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid risk value(s): ${invalid.join(', ')}. Allowed values: ${ALLOWED_RISK_FLAGS.join(', ')}`,
        });
      }

      // 0 selected (nothing valid survived parsing) or all 3 colors selected
      // both mean "no filtering" — skip adding the filter clause entirely.
      if (risks.length > 0 && risks.length < ALLOWED_RISK_FLAGS.length) {
        // Match the stored value regardless of casing ("green" / "Green" /
        // "GREEN") while still allowing an index on mlAnalysis.riskFlag.
        const casedVariants = risks.flatMap((r) => [
          r,
          r.charAt(0).toUpperCase() + r.slice(1),
          r.toUpperCase(),
        ]);
        filter['mlAnalysis.riskFlag'] = { $in: casedVariants };
      }
    }

    const posts = await Post.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const userIds  = [...new Set(posts.map((p) => p.author.toString()))];
    const usersRes = await authClient.post('/api/users/bulk', { ids: userIds });
    const userMap  = Object.fromEntries(
      usersRes.data.users.map((u) => [u._id.toString(), u])
    );

    const savedDocs = await SavedPost.find({
      user: userId,
      post: { $in: posts.map((p) => p._id) },
    })
      .select('post')
      .lean();
    const savedPostIds = new Set(savedDocs.map((d) => d.post.toString()));

    const enriched        = posts.map((p) => ({ ...p, author: userMap[p.author.toString()] || null }));
    const postsWithState  = addStateFlags(enriched, userId, savedPostIds);
    const total            = await Post.countDocuments(filter);

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

    const usersRes = await authClient.post('/api/users/bulk', {
      ids: [post.author.toString()],
    });
    post.author = usersRes.data.users?.[0] || null;

    const isSaved      = await SavedPost.exists({ user: req.user.id, post: post._id });
    const savedPostIds = isSaved ? new Set([post._id.toString()]) : new Set();

    const [postWithState] = addStateFlags([post], req.user.id, savedPostIds);
    return res.status(200).json({ success: true, post: postWithState });
  } catch (err) {
    console.error('getPost error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── GET /api/posts/:id/sharers ───────────────────────────────────────
// ── NEW: Community Signals — "who marked it" ──
// Returns everyone who shared this post, with the reason they picked
// (if any) and when, newest first. Its own endpoint rather than bundled
// into getFeed's response, since it's only needed when a user opens it
// on a single post — keeps every normal feed page light.
export const getPostSharers = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid post ID.' });
    }

    const post = await Post.findById(req.params.id).select('sharedBy').lean();
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }

    // Normalize both entry shapes (see sharedBy migration note in
    // post.model.js) into a single { userId, reason, sharedAt } form
    // before looking up names.
    const entries = (post.sharedBy || []).map((entry) =>
      entry && typeof entry === 'object' && entry.user
        ? { userId: entry.user.toString(), reason: entry.reason ?? null, sharedAt: entry.sharedAt ?? null }
        : { userId: entry.toString(), reason: null, sharedAt: null }
    );

    if (entries.length === 0) {
      return res.status(200).json({ success: true, sharers: [], total: 0 });
    }

    const userIds  = [...new Set(entries.map((e) => e.userId))];
    const usersRes = await authClient.post('/api/users/bulk', { ids: userIds });
    const userMap  = Object.fromEntries(
      usersRes.data.users.map((u) => [u._id.toString(), u])
    );

    const sharers = entries
      .map((e) => ({ user: userMap[e.userId] || null, reason: e.reason, sharedAt: e.sharedAt }))
      .filter((e) => e.user) // drop anyone auth-service no longer has (deleted account)
      .sort((a, b) => new Date(b.sharedAt || 0) - new Date(a.sharedAt || 0));

    return res.status(200).json({ success: true, sharers, total: sharers.length });
  } catch (err) {
    console.error('getPostSharers error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── GET /api/posts/user/:userId ──────────────────────────────────────
export const getPostsByUser = async (req, res) => {
  try {
    if (!isValidId(req.params.userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }

    const viewerId = req.user.id;

    const posts = await Post.find({ author: req.params.userId })
      .sort({ createdAt: -1 })
      .lean();

    const usersRes = await authClient.post('/api/users/bulk', {
      ids: [req.params.userId],
    });
    const author = usersRes.data.users?.[0] || null;

    const enrichedPosts = posts.map((post) => ({ ...post, author }));

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

    deleteIndexedPost(req.params.id).catch((err) =>
      console.error('deleteIndexedPost error:', err.message)
    );

    io.emit('post:deleted', { postId: req.params.id });

    broadcastPulseUpdate();

    return res.status(200).json({ success: true, message: 'Post deleted.' });
  } catch (err) {
    console.error('deletePost error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── GET /api/posts/pulse/trending ────────────────────────────────────
export const getWeeklyPulse = async (req, res) => {
  try {
    const weeklyPulse = await pulse.getWeeklyPulse();
    return res.status(200).json({ success: true, ...weeklyPulse });
  } catch (err) {
    console.error('getWeeklyPulse error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── POST /api/posts/admin/reanalyze ──────────────────────────────────
export const reanalyzeStalePosts = async (req, res) => {
  try {
    const stalePosts = await Post.find({
      content: { $exists: true, $ne: '' },
      'mlAnalysis.riskFlag': null,
    })
      .select('_id content')
      .lean();

    let queued = 0;
    for (const post of stalePosts) {
      if (!post.content?.trim()) continue;
      publish('ml.analyze', {
        postId: post._id.toString(),
        text: post.content,
      });
      queued++;
    }

    return res.status(200).json({
      success: true,
      message: `Queued ${queued} post(s) for re-analysis.`,
      queued,
      totalFound: stalePosts.length,
    });
  } catch (err) {
    console.error('reanalyzeStalePosts error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};


// ── ONE-TIME / ON-DEMAND: Backfill search index ─────────────────────
export const reindexAllPosts = async (req, res) => {
  try {
    const { indexed, failed, total } = await rebuildSearchIndex();
    return res.status(200).json({
      success: true,
      message: `Reindexed ${indexed} post(s), ${failed} failed.`,
      indexed,
      failed,
      total,
    });
  } catch (err) {
    console.error('reindexAllPosts error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};



// ── ML Brain result handler ──────────────────────────────────────────
export const handleMLResult = async (result) => {
  try {
    if (!result?.postId) {
      console.warn('ML result missing postId');
      return;
    }

    const aiSignal = getAISignal(result.risk_flag);

    const updatedPost = await Post.findByIdAndUpdate(
      result.postId,
      {
        $set: {
          'mlAnalysis.language': result.language,
          'mlAnalysis.languageConfidence': result.language_confidence,
          'mlAnalysis.sentiment': result.sentiment,
          'mlAnalysis.sarcasm': result.sarcasm,
          'mlAnalysis.sarcasmProbability': result.sarcasm_probability,
          'mlAnalysis.toxicity': result.toxicity,
          'mlAnalysis.toxicityLevel': result.toxicity_level,
          'mlAnalysis.riskFlag': result.risk_flag,
          'mlAnalysis.explanation': result.explanation,
          'mlAnalysis.confidence': result.confidence,
          'mlAnalysis.signal': aiSignal.signal,
          'mlAnalysis.signalMessage': aiSignal.message,
          'mlAnalysis.analyzedAt': new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!updatedPost) {
      console.warn(`ML result received for missing post: ${result.postId}`);
      return;
    }

    console.log(`ML analysis saved: ${result.postId} -> ${result.risk_flag} (${aiSignal.signal})`);

    console.log('📡 Emitting post:ml-analysis', {
      postId: result.postId,
      mlAnalysis: updatedPost.mlAnalysis,
    });

    io.emit('post:ml-analysis', {
      postId: result.postId,
      mlAnalysis: updatedPost.mlAnalysis,
    });
  } catch (error) {
    console.error('Failed to save ML result:', error.message);
    throw error;
  }
};