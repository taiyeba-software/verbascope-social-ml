import UserPulse from '../models/userPulse.model.js';
import Post from '../models/post.model.js';

// GET /api/posts/recommendations/users
// Returns up to 5 suggested user IDs + their top shared interests
export const getRecommendedUsers = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Get this user's interest vector
    const myPulse = await UserPulse.findOne({ userId }).lean();

    let topTags = [];

    if (myPulse?.interests) {
      // Sort interests by score, take top 5 tags
      topTags = Object.entries(myPulse.interests)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag]) => tag);
    }

    let recommendedUserIds = [];
    let sharedInterestsMap = {}; // userId → [tags]

    if (topTags.length > 0) {
      // 2. Find recent posts with matching hashtags
      const tagPattern = topTags.map((t) => `#${t}`).join('|');
      const regex = new RegExp(tagPattern, 'i');

      const matchingPosts = await Post.find(
        { content: regex, author: { $ne: userId } },
        'author content'
      )
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      // 3. Score each author by how many matching tags their posts have
      const authorScores = {};
      const authorTags = {};

      for (const post of matchingPosts) {
        const authorId = post.author.toString();
        if (authorId === userId) continue;

        const postTags = [...(post.content?.matchAll(/#(\w+)/g) ?? [])]
          .map((m) => m[1].toLowerCase());

        const matched = postTags.filter((t) => topTags.includes(t));
        if (matched.length === 0) continue;

        authorScores[authorId] = (authorScores[authorId] ?? 0) + matched.length;
        authorTags[authorId] = [...new Set([...(authorTags[authorId] ?? []), ...matched])];
      }

      // 4. Sort by score, deduplicate author IDs, take top 5
      recommendedUserIds = [...new Set(
        Object.entries(authorScores)
          .sort((a, b) => b[1] - a[1])
          .map(([id]) => id)
      )].slice(0, 5);

      sharedInterestsMap = authorTags;
    }

    return res.status(200).json({
      success: true,
      recommendations: recommendedUserIds.map((id) => ({
        userId: id,
        sharedInterests: (sharedInterestsMap[id] ?? []).slice(0, 3),
      })),
      basedOn: topTags,
    });
  } catch (err) {
    console.error('getRecommendedUsers error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};