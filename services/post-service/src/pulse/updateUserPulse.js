import UserPulse from '../models/userPulse.model.js';
import Post from '../models/post.model.js';

const WEIGHTS = {
  like:    2,
  comment: 3,
  share:   4,
  dwell:   1,
};

// Extract hashtags from post content  e.g. "#AI #NodeJS" → ['ai', 'nodejs']
const extractTags = (content = '') =>
  [...content.matchAll(/#(\w+)/g)].map((m) => m[1].toLowerCase());

/**
 * Update a user's interest vector based on an action on a post.
 * @param {string} userId
 * @param {string} postId
 * @param {'like'|'comment'|'share'|'dwell'} actionType
 */
export const updateUserPulse = async (userId, postId, actionType) => {
  try {
    const post = await Post.findById(postId, 'content').lean();
    if (!post) return;

    const tags = extractTags(post.content);
    if (tags.length === 0) return;

    const weight = WEIGHTS[actionType] ?? 1;

    // Build $inc payload  e.g. { 'interests.ai': 2, 'interests.nodejs': 2 }
    const inc = {};
    for (const tag of tags) {
      inc[`interests.${tag}`] = weight;
    }

    await UserPulse.findOneAndUpdate(
      { userId },
      { $inc: inc },
      { upsert: true }
    );
  } catch (err) {
    // Non-critical — never let pulse errors break the main request
    console.error('[updateUserPulse] error:', err.message);
  }
};