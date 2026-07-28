import mongoose from 'mongoose';
import SavedPost from '../models/savedPost.model.js';
import Post from '../models/post.model.js';
import { getUsersByIds } from '../utils/authClient.js';

// POST /api/posts/:id/save
export async function savePost(req, res) {
  const { id: postId } = req.params;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({ message: 'Invalid post id' });
  }

  try {
    const post = await Post.findById(postId).select('_id');
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Upsert so double-clicking "save" is a no-op instead of a 409/500.
    await SavedPost.updateOne(
      { user: userId, post: postId },
      { $setOnInsert: { user: userId, post: postId } },
      { upsert: true }
    );

    return res.status(200).json({ saved: true, postId });
  } catch (err) {
    console.error('savePost error:', err);
    return res.status(500).json({ message: 'Failed to save post' });
  }
}

// DELETE /api/posts/:id/unsave
export async function unsavePost(req, res) {
  const { id: postId } = req.params;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({ message: 'Invalid post id' });
  }

  try {
    await SavedPost.deleteOne({ user: userId, post: postId });
    return res.status(200).json({ saved: false, postId });
  } catch (err) {
    console.error('unsavePost error:', err);
    return res.status(500).json({ message: 'Failed to unsave post' });
  }
}

// GET /api/posts/saved?page=1&limit=10
export async function getSavedPosts(req, res) {
  const userId = req.user._id;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const skip = (page - 1) * limit;

  try {
    const savedDocs = await SavedPost.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('post')
      .lean();

    // Guard against posts that were deleted after being saved.
    const posts = savedDocs
      .filter((doc) => doc.post)
      .map((doc) => ({ ...doc.post, savedAt: doc.createdAt, isSaved: true }));

    // NOTE: a Post document's owner field is `author`, not `user` — `user`
    // belongs to the SavedPost join document (which user saved it), and is
    // no longer in scope once we've spread `doc.post` above. Reading
    // `p.user` here was always `undefined`, so every author lookup missed
    // and silently fell back to `null` -> the frontend rendered "Anonymous"
    // for every saved post regardless of who actually wrote it.
    const authorIds = [...new Set(posts.map((p) => String(p.author)))];
    const authors = authorIds.length ? await getUsersByIds(authorIds) : {};

    const enriched = posts.map((p) => ({
      ...p,
      author: authors[String(p.author)] || null,
    }));

    const total = await SavedPost.countDocuments({ user: userId });

    return res.status(200).json({
      posts: enriched,
      page,
      limit,
      total,
      hasMore: skip + savedDocs.length < total,
    });
  } catch (err) {
    console.error('getSavedPosts error:', err);
    return res.status(500).json({ message: 'Failed to fetch saved posts' });
  }
}