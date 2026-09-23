import mongoose from 'mongoose';
import authClient from './authClient.js';

// ── Community Insights personalization ──
// Returns the IDs that should count toward "this week's" Community
// Insights and the signal-filtered feed: the current user's own posts plus
// everyone they follow.
export const getVisibleAuthors = async (req) => {
  const userId = req.user.id;
  try {
    const res = await authClient.get('/api/users/me/following', {
      headers: { Authorization: req.headers.authorization },
    });
    const followingRaw = res.data?.following ?? [];
    const followingIds = followingRaw.map((f) => (typeof f === 'string' ? f : f._id));
    return [userId, ...followingIds];
  } catch (err) {
    console.error('getVisibleAuthors error:', err.message);
    return [userId];
  }
};

// ── NEW: cast helper ──
// Post.aggregate() does NOT auto-cast string IDs to ObjectId the way
// Post.find() does — every caller that compares against an ObjectId
// field in an aggregation pipeline (or inside $elemMatch) needs this.
export const getVisibleAuthorObjectIds = async (req) => {
  const visibleAuthors = await getVisibleAuthors(req);
  return visibleAuthors
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
};