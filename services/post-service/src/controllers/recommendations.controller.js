import mongoose from 'mongoose';
import UserPulse from '../models/userPulse.model.js';
import Post from '../models/post.model.js';
import User from '../models/user.model.js';

// GET /api/posts/recommendations/users
// Returns up to 5 suggested users populated with fullname, avatar, and headline from auth-service
export const getRecommendedUsers = async (req, res) => {
  try {
    const userId = req.user.id;
    const authHeader = req.headers.authorization;
    const cookieHeader = req.headers.cookie;

    const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3000';
    const fetchHeaders = {};
    if (authHeader) fetchHeaders['authorization'] = authHeader;
    if (cookieHeader) fetchHeaders['cookie'] = cookieHeader;

    // 1. Fetch live following list directly from Auth Service
    let followedUserIds = [];
    try {
      const authRes = await fetch(`${authServiceUrl}/api/users/me/following`, {
        method: 'GET',
        headers: fetchHeaders,
      });

      if (authRes.ok) {
        const authData = await authRes.json();
        if (authData.success && Array.isArray(authData.following)) {
          followedUserIds = authData.following.map((item) =>
            typeof item === 'object' && item !== null ? item._id : item
          );
        }
      }
    } catch (err) {
      console.warn('Could not fetch live following list from auth-service:', err.message);
    }

    // Convert string IDs to Mongoose ObjectIds for exclusion
    const rawExcluded = [userId, ...followedUserIds];
    const excludedUserIds = rawExcluded
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    // 2. Get this user's interest vector
    const myPulse = await UserPulse.findOne({ userId }).lean();

    let topTags = [];

    if (myPulse?.interests) {
      const interestEntries = myPulse.interests instanceof Map
        ? Array.from(myPulse.interests.entries())
        : Object.entries(myPulse.interests);

      topTags = interestEntries
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag]) => tag.toLowerCase().replace(/^#/, ''));
    }

    let recommendedUserIds = [];
    let sharedInterestsMap = {};

    if (topTags.length > 0) {
      // 3. Query matching posts
      const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tagPatterns = topTags.map((t) => `(#?${escapeRegex(t)})`).join('|');
      const regex = new RegExp(`\\b(${tagPatterns})\\b`, 'i');

      const matchingPosts = await Post.find(
        {
          author: { $nin: excludedUserIds },
          $or: [
            { tags: { $in: topTags } },
            { content: regex },
          ],
        },
        'author content tags'
      )
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      // 4. Score each author
      const authorScores = {};
      const authorTags = {};

      for (const post of matchingPosts) {
        if (!post.author) continue;
        const authorId = post.author.toString();

        const contentTags = [...(post.content?.matchAll(/#(\w+)/g) ?? [])].map((m) => m[1].toLowerCase());
        const schemaTags = (post.tags || []).map((t) => t.toLowerCase().replace(/^#/, ''));
        const allPostTags = [...new Set([...contentTags, ...schemaTags])];

        const matched = allPostTags.filter((t) => topTags.includes(t));
        if (matched.length === 0) continue;

        authorScores[authorId] = (authorScores[authorId] ?? 0) + matched.length;
        authorTags[authorId] = [...new Set([...(authorTags[authorId] ?? []), ...matched])];
      }

      // 5. Take top 5 unique user IDs
      recommendedUserIds = [...new Set(
        Object.entries(authorScores)
          .sort((a, b) => b[1] - a[1])
          .map(([id]) => id)
      )].slice(0, 5);

      sharedInterestsMap = authorTags;
    }

    // 6. POPULATE PROFILE DATA directly from auth-service
    let userProfileMap = new Map();

    if (recommendedUserIds.length > 0) {
      try {
        const bulkUrl = `${authServiceUrl}/api/users/bulk`;
        const usersRes = await fetch(bulkUrl, {
          method: 'POST',
          headers: {
            ...fetchHeaders,
            'Content-Type': 'application/json',
          },
          // Sending both key names defensively: GET /bulk?ids=... works on
          // auth-service, but POST with { userIds: [...] } was returning an
          // empty list — the shared getUsersBulk handler likely only reads
          // `ids` regardless of HTTP method. Remove the extra key once
          // getUsersBulk's expected body shape is confirmed.
          body: JSON.stringify({
            userIds: recommendedUserIds,
            ids: recommendedUserIds,
          }),
        });

        const usersData = await usersRes.json();
        console.log('--- BULK USERS DEBUG ---');
        console.log('Bulk URL:', bulkUrl);
        console.log('HTTP Status:', usersRes.status);
        console.log('Bulk Raw Data:', JSON.stringify(usersData, null, 2));

        if (usersRes.ok) {
          // Normalize possible response structures
          const list = Array.isArray(usersData)
            ? usersData
            : usersData.users || usersData.data || [];

          userProfileMap = new Map(
            list.map((u) => [(u._id || u.id)?.toString(), u])
          );
        }
      } catch (err) {
        console.warn('Could not fetch bulk profiles from auth-service:', err.message);
      }
    }

    // Fallback: If auth-service bulk fetch produced no profiles, query local DB
    // (post-service maintains a mirrored user collection via RabbitMQ events)
    if (userProfileMap.size === 0 && recommendedUserIds.length > 0) {
      try {
        const validIds = recommendedUserIds.filter((id) => mongoose.Types.ObjectId.isValid(id));

        const localUsers = await User.find(
          { _id: { $in: validIds } },
          'fullname avatar headline'
        ).lean();

        console.log('--- LOCAL USER FALLBACK DEBUG ---');
        console.log('Local users found:', localUsers.length);

        userProfileMap = new Map(
          localUsers.map((u) => [u._id.toString(), u])
        );
      } catch (err) {
        console.warn('Local User query failed:', err.message);
      }
    }

    const populatedRecommendations = recommendedUserIds.map((id) => {
      const profile = userProfileMap.get(id);
      return {
        _id: id,
        userId: id,
        fullname: profile?.fullname ?? { firstName: '', lastName: '' },
        avatar: profile?.avatar ?? '',
        headline: profile?.headline ?? '',
        sharedInterests: (sharedInterestsMap[id] ?? []).slice(0, 3),
      };
    });

    return res.status(200).json({
      success: true,
      recommendations: populatedRecommendations,
      basedOn: topTags,
    });
  } catch (err) {
    console.error('getRecommendedUsers error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};