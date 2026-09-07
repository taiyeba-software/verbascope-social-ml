import Post from '../models/post.model.js'; // ── NEW: needed for getWeeklyPulse()'s aggregation

const tagFrequency = new Map();
const shareReasonCounts = new Map();
const activeUsers = new Map();

const ACTIVE_WINDOW   = 10 * 60 * 1000; // 10 minutes
const ACTIVITY_WINDOW =  2 * 60 * 1000; // 2 minutes sliding window

const recentActivity = { likes: [], posts: [], comments: [] };

// ── Milestone 4 (v2): per-post comment mood ─────────────────────────
// Unlike getSignal() (a live "last N minutes" sliding window — right
// for platform-wide activity), thread mood needs to reflect the actual
// current state of a comment section, including comments posted long
// ago. So this is a pure classifier over counts pulled from the DB
// (see comment.controller.js), not an in-memory event window.
const MOOD_MESSAGES = {
  heated:       'Negative sentiment is increasing.',
  tense:        'Negative sentiment is rising.',
  mixed:        'Positive and negative reactions are balanced.',
  constructive: 'Most comments are positive or neutral.',
  calm:         'No strong sentiment detected.',
};

// ── NEW: Weekly Pulse feature ────────────────────────────────────────
// Human-readable labels for the shareReasons keys stored on Post docs.
const REASON_LABELS = {
  agree:           'Agree',
  funny:           'Funny',
  needs_attention: 'Needs Attention',
  insightful:      'Insightful',
  concerning:      'Concerning',
  educational:     'Educational',
};

// Monday 00:00:00 of the current week (local server time). When Monday
// arrives this naturally rolls forward — no cron job, no cleanup, no
// deleted data. Historical posts stay in Mongo for feeds/search/analytics;
// only this query's $gte filter changes.
function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0 (Sun) .. 6 (Sat)
  const diff = (day === 0 ? -6 : 1) - day; // shift back to Monday
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diff);
  return d;
}

// ── UPDATED (round 2): status now depends on the top topic's POST COUNT,
// not just its engagement score, with a percentage-based override on top.
// A topic with 21 posts and zero likes/comments/shares used to score 0 and
// get labeled "Quiet" — technically true of engagement, but misleading to
// a reader, since 21 posts is clearly not a quiet week. Post volume is a
// more honest read of "is anything happening" than a weighted score alone.
//
// postCount < 6    → 💤 Quiet
// postCount < 21   → 💬 Active Discussion
// postCount >= 21  → 🔥 Trending
// percentage >= 40 → ⚡ Engagement Surge (overrides the above — a topic
//                    that's dominating the week's *engagement* share is a
//                    stronger signal than raw post count either way)
function getPulseStatus(percentage, postCount) {
  if (percentage >= 40) return '⚡ Engagement Surge';
  if (postCount >= 21)  return '🔥 Trending';
  if (postCount >= 6)   return '💬 Active Discussion';
  return '💤 Quiet';
}

// One-line "why is this here" text per status. For Quiet, this is the
// entire card content — no tag/count shown, per the simplified mock
// (there's nothing meaningful to report yet, so don't pretend there is).
const STATUS_EXPLANATIONS = {
  '💤 Quiet':               'Not enough activity this week yet.',
  '💬 Active Discussion':   'Community is actively discussing this topic.',
  '🔥 Trending':            'Most discussed topic this week.',
  '⚡ Engagement Surge':    "This topic is dominating this week's discussion.",
};

export const pulse = {

  onPostCreated(post, userId) {
    recentActivity.posts.push(Date.now());
    if (userId) activeUsers.set(userId, Date.now());
    if (post.content) {
      const tags = post.content.match(/#\w+/g) || [];
      tags.forEach(tag => {
        tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1);
      });
    }
  },

  onPostLiked(postId, userId) {
    recentActivity.likes.push(Date.now());
    if (userId) activeUsers.set(userId, Date.now());
    this._pruneOldActivity();
  },

  onCommentAdded(postId, userId) {
    recentActivity.comments.push(Date.now());
    if (userId) activeUsers.set(userId, Date.now());
    this._pruneOldActivity();
  },

  onPostShared(postId, reason, userId) {
    recentActivity.likes.push(Date.now());
    recentActivity.likes.push(Date.now());
    if (userId) activeUsers.set(userId, Date.now());
    this._pruneOldActivity();
    if (reason) {
      shareReasonCounts.set(reason, (shareReasonCounts.get(reason) || 0) + 1);
    }
  },

  _pruneOldActivity() {
    const cutoff     = Date.now() - ACTIVITY_WINDOW;
    const userCutoff = Date.now() - ACTIVE_WINDOW;
    recentActivity.likes    = recentActivity.likes.filter(t => t > cutoff);
    recentActivity.posts    = recentActivity.posts.filter(t => t > cutoff);
    recentActivity.comments = recentActivity.comments.filter(t => t > cutoff);
    for (const [id, ts] of activeUsers) {
      if (ts < userCutoff) activeUsers.delete(id);
    }
  },

  getSignal() {
    this._pruneOldActivity();

    const total = recentActivity.likes.length
                + recentActivity.posts.length
                + recentActivity.comments.length;

    const activeCount = activeUsers.size || 1;
    const rate = total / activeCount;

    const signal = (total >= 5 && rate >= 2.0) ? { type: 'surge',  message: '⚡ Engagement surge detected' }
                 : (total >= 6 && rate >= 1.0) ? { type: 'rising', message: '📈 Community activity rising' }
                 : (total >= 3 && rate >= 0.3) ? { type: 'active', message: '🟡 Community is active' }
                 :                                { type: 'normal', message: '🟢 Community is calm' };

    signal.meta = {
      totalEvents:     total,
      activeUsers:     activeCount,
      engagementRate:  Math.round(rate * 100) / 100,
    };

    if (shareReasonCounts.size > 0) {
      const totalShares = [...shareReasonCounts.values()].reduce((a, b) => a + b, 0);
      signal.topReason = [...shareReasonCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      signal.reasonBreakdown = Object.fromEntries(
        [...shareReasonCounts.entries()].map(([r, c]) => [r, Math.round((c / totalShares) * 100)])
      );
    }

    return signal;
  },

  // ── Milestone 4 (v2) ─────────────────────────────────────────────────
  // Pure function: takes sentiment counts for a post's comments and
  // classifies them into a mood. No side effects, no stored state — the
  // Comment collection is the single source of truth.
  classifyMood(postId, tally = {}) {
    const positive = tally.positive || 0;
    const negative = tally.negative || 0;
    const neutral  = tally.neutral  || 0;
    const total     = positive + negative + neutral;

    const negativeRatio = total > 0 ? negative / total : 0;
    const positiveRatio = total > 0 ? positive / total : 0;

    let type;
    if (total === 0) {
      type = 'calm';
    } else if (total >= 3 && negativeRatio >= 0.5) {
      type = 'heated';
    } else if (total >= 3 && negativeRatio >= 0.25) {
      type = 'tense';
    } else if (total >= 3 && positiveRatio >= 0.5) {
      type = 'constructive';
    } else if (positive > 0 && negative > 0) {
      type = 'mixed';
    } else {
      type = 'calm';
    }

    return {
      postId: postId ? postId.toString() : undefined,
      type,
      message: MOOD_MESSAGES[type],
      meta: {
        totalComments: total,
        positive,
        negative,
        neutral,
        negativeRatio: Math.round(negativeRatio * 100) / 100,
        positiveRatio: Math.round(positiveRatio * 100) / 100,
      },
    };
  },

  getTrending(limit = 5) {
    return [...tagFrequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag, count]) => ({ tag, count }));
  },

  // ── NEW: Weekly Pulse (this week's #1 topic + why + how big) ────────
  // Mongo aggregation over this week's posts, grouped by pulseTopic.
  // Independent of getSignal()/getTrending() above — those stay as your
  // live "last few minutes" in-memory pulse, this is a separate
  // "this week's story" view computed straight from the DB, so a
  // server restart never loses it.
  //
  // Score per post = likesCount + commentsCount*2 + sharesCount*3
  // (no `saves`/`dwell` fields exist on Post yet, so those two terms
  // from the original plan are dropped rather than faked — add them
  // back here the moment those fields exist on the schema).
  async getWeeklyPulse(topN = 5) {
    const weekStart = startOfWeek();

    const results = await Post.aggregate([
      { $match: { createdAt: { $gte: weekStart } } },
      {
        $addFields: {
          engagementScore: {
            $add: [
              { $ifNull: ['$likesCount', 0] },
              { $multiply: [{ $ifNull: ['$commentsCount', 0] }, 2] },
              { $multiply: [{ $ifNull: ['$sharesCount', 0] }, 3] },
            ],
          },
        },
      },
      {
        $group: {
          _id: '$pulseTopic',
          score: { $sum: '$engagementScore' },
          postCount: { $sum: 1 },
          agree:           { $sum: '$shareReasons.agree' },
          funny:           { $sum: '$shareReasons.funny' },
          needs_attention: { $sum: '$shareReasons.needs_attention' },
          insightful:      { $sum: '$shareReasons.insightful' },
          concerning:      { $sum: '$shareReasons.concerning' },
          educational:     { $sum: '$shareReasons.educational' },
        },
      },
      // ── FIX: tiebreak on postCount. When every post this week has 0
      // engagement, every topic's `score` ties at 0 and Mongo's tie order
      // is arbitrary — not related to how many posts a topic actually
      // has. A 2-post "general" bucket could otherwise outrank a 21-post
      // real topic. Sorting on postCount as a secondary key means a
      // well-populated topic wins over a near-empty one whenever scores
      // are tied (the common case early in a week, or with low-traffic
      // communities).
      { $sort: { score: -1, postCount: -1 } },
    ]);

    // No posts this week at all — return an empty-but-valid shape so the
    // frontend never has to special-case "no data".
    if (results.length === 0) {
      return {
        headline: '💤 Quiet',
        topic: null,
        reason: null,
        percentage: 0,
        status: '💤 Quiet',
        postCount: 0,
        activityLabel: null,
        explanation: STATUS_EXPLANATIONS['💤 Quiet'],
        rank: 0,
        topics: [],
      };
    }

    const totalScore = results.reduce((sum, r) => sum + r.score, 0) || 1;
    const top = results[0];

    const reasonCounts = {
      agree:           top.agree,
      funny:           top.funny,
      needs_attention: top.needs_attention,
      insightful:      top.insightful,
      concerning:      top.concerning,
      educational:     top.educational,
    };

    let dominantReason = null;
    let dominantCount = 0;
    for (const [key, count] of Object.entries(reasonCounts)) {
      if (count > dominantCount) {
        dominantReason = key;
        dominantCount = count;
      }
    }

    const percentage = Math.round((top.score / totalScore) * 100);
    const status = getPulseStatus(percentage, top.postCount);
    const explanation = STATUS_EXPLANATIONS[status];

    // ── NEW: a single, ready-to-render "how big" string. Only the
    // Engagement Surge bucket is percentage-driven, so that's the only
    // case where a percentage is meaningful to show — everywhere else
    // (Quiet/Active/Trending) a raw post count is the honest number.
    // Fixes the "~0% of this week's activity" problem: a 0%-of-score
    // topic with real posts now reads "21 posts this week" instead of a
    // percentage that told the reader nothing.
    const activityLabel = status === '⚡ Engagement Surge'
      ? `${percentage}% of this week's discussions`
      : `${top.postCount} post${top.postCount === 1 ? '' : 's'} this week`;

    // Separate "top by post count" list for the compact "Popular Topics"
    // section — deliberately NOT the same ordering as the score-sorted
    // `results` above, since a topic can have lots of short posts but a
    // low engagement score, or vice versa.
    // ── FIX: exclude the headline topic itself, so it doesn't appear
    // twice on the card (once as the featured story, once again in the
    // list below it).
    const topics = [...results]
      .filter((r) => r._id !== top._id)
      .sort((a, b) => b.postCount - a.postCount)
      .slice(0, topN)
      .map((r) => ({ tag: r._id, posts: r.postCount }));

    return {
      headline: status,
      topic: top._id,
      reason: dominantReason ? REASON_LABELS[dominantReason] : null,
      percentage,
      status,
      postCount: top.postCount,
      activityLabel,
      explanation,
      rank: 1,
      topics,
    };
  },

  resetForSeed() {
    tagFrequency.clear();
    shareReasonCounts.clear();
    activeUsers.clear();
    recentActivity.likes    = [];
    recentActivity.posts    = [];
    recentActivity.comments = [];
  }

};