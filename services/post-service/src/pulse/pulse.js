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

  resetForSeed() {
    tagFrequency.clear();
    shareReasonCounts.clear();
    activeUsers.clear();
    recentActivity.likes    = [];
    recentActivity.posts    = [];
    recentActivity.comments = [];
  }

};