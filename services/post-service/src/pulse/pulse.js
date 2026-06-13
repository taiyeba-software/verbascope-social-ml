const tagFrequency = new Map();
const shareReasonCounts = new Map();
const recentActivity = {
  likes: [],
  posts: [],
  comments: []
};

export const pulse = {

  onPostCreated(post) {
    // track post activity
    recentActivity.posts.push(Date.now());

    // extract and count hashtags from content
    if (post.content) {
      const tags = post.content.match(/#\w+/g) || [];
      tags.forEach(tag => {
        tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1);
      });
    }

    // removed post.tags block — was double-counting
  },

  onPostLiked(postId) {
    recentActivity.likes.push(Date.now());
    this._pruneOldActivity();
  },

  onCommentAdded(postId) {
    recentActivity.comments.push(Date.now());
    this._pruneOldActivity();
  },

  onPostShared(postId, reason) {
    // treat shares as high-weight activity
    recentActivity.likes.push(Date.now());
    recentActivity.likes.push(Date.now());
    this._pruneOldActivity();

    // track reason if provided
    if (reason) {
      shareReasonCounts.set(reason, (shareReasonCounts.get(reason) || 0) + 1);
    }
  },

  // remove activity older than 2 minutes
  _pruneOldActivity() {
    const cutoff = Date.now() - 2 * 60 * 1000;
    recentActivity.likes    = recentActivity.likes.filter(t => t > cutoff);
    recentActivity.posts    = recentActivity.posts.filter(t => t > cutoff);
    recentActivity.comments = recentActivity.comments.filter(t => t > cutoff);
  },

  getSignal() {
    this._pruneOldActivity();
    const total = recentActivity.likes.length
                + recentActivity.posts.length
                + recentActivity.comments.length;

    const signal = total >= 15 ? { type: 'surge', message: '⚡ Engagement surge detected' }
      : total >= 8 ? { type: 'rising', message: '📈 Community activity rising' }
      : total >= 3 ? { type: 'active', message: '🟡 Community is active' }
      : { type: 'normal', message: '🟢 Community is calm' };

    // attach reason breakdown if any shares have happened
    if (shareReasonCounts.size > 0) {
      const totalShares = [...shareReasonCounts.values()].reduce((sum, count) => sum + count, 0);
      signal.topReason = [...shareReasonCounts.entries()]
        .sort((a, b) => b[1] - a[1])[0];
      signal.reasonBreakdown = Object.fromEntries(
        [...shareReasonCounts.entries()].map(([reason, count]) => [reason, Math.round((count / totalShares) * 100)])
      );
    }

    return signal;
  },

  getTrending(limit = 5) {
    return [...tagFrequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag, count]) => ({ tag, count }));
  }

};