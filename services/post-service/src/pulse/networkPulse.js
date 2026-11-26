import Post from '../models/post.model.js';
import { getFollowedAuthorObjectIds } from '../utils/getVisibleAuthors.js';
import { getTrendingWindowStart, TRENDING_WINDOW_DAYS } from './pulse.js';

// ── Network Pulse ─────────────────────────────────────────────────────
// Personalized "what is MY network talking about" view.
// Only posts authored by people the current user follows (NOT the user
// themselves), last 30 days, grouped by pulseTopic.

const MAX_TOPICS = 6; // 1 most-active topic + 5 others

export async function computeNetworkPulse(followedObjectIds, limit = MAX_TOPICS) {
  const empty = {
    period: 'Last 30 Days',
    windowDays: TRENDING_WINDOW_DAYS,
    mostActive: null,
    others: [],
  };

  if (!followedObjectIds || followedObjectIds.length === 0) return empty;

  const topics = await Post.aggregate([
    {
      $match: {
        author: { $in: followedObjectIds },
        createdAt: { $gte: getTrendingWindowStart() },
        // 'general' is the fallback for posts with no hashtag, so it isn't a real topic
        pulseTopic: { $exists: true, $nin: [null, '', 'general'] },
      },
    },
    {
      $group: {
        _id: '$pulseTopic',
        postCount: { $sum: 1 },
        contributors: { $addToSet: '$author' },
      },
    },
    {
      $project: {
        _id: 0,
        topic: '$_id',
        postCount: 1,
        contributorCount: { $size: '$contributors' },
      },
    },
    { $sort: { postCount: -1, contributorCount: -1, topic: 1 } },
    { $limit: limit },
  ]);

  if (topics.length === 0) return empty;

  return {
    ...empty,
    mostActive: topics[0],
    others: topics.slice(1),
  };
}

// Express handler for GET /api/posts/pulse/trending
export async function getNetworkPulseHandler(req, res) {
  try {
    const followedIds = await getFollowedAuthorObjectIds(req);
    const result = await computeNetworkPulse(followedIds);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('getNetworkPulse error:', err);
    res.status(500).json({ success: false, message: 'Failed to load Network Pulse' });
  }
}