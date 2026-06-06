const tagFrequency = new Map();
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

    // also count explicit tags array if present
    if (post.tags && Array.isArray(post.tags)) {
      post.tags.forEach(tag => {
        tagFrequency.set(tag, (tagFrequency.get(tag) || 0) + 1);
      });
    }
  },

  onPostLiked(postId) {
    recentActivity.likes.push(Date.now());
    this._pruneOldActivity();
  },

  onCommentAdded(postId) {
    recentActivity.comments.push(Date.now());
    this._pruneOldActivity();
  },

  onPostShared(postId) {
    // treat shares as high-weight activity
    recentActivity.likes.push(Date.now());
    recentActivity.likes.push(Date.now());
    this._pruneOldActivity();
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

    if (total >= 15) return { type: 'surge',   message: '⚡ Engagement surge detected' };
    if (total >= 8)  return { type: 'rising',  message: '📈 Community activity rising' };
    if (total >= 3)  return { type: 'active',  message: '🟡 Community is active' };
    return                  { type: 'normal',  message: '🟢 Community is calm' };
  },

  getTrending(limit = 5) {
    return [...tagFrequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag, count]) => ({ tag, count }));
  }

};