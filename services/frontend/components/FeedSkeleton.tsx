'use client';

import './FeedSkeleton.css';

export default function FeedSkeleton() {
  return (
    <div className="feed-skeleton">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="skeleton-post-card">
          {/* Post Header */}
          <div className="skeleton-header">
            <div className="skeleton-avatar shimmer"></div>
            <div className="skeleton-header-text">
              <div className="skeleton-line shimmer short"></div>
              <div className="skeleton-line shimmer xshort"></div>
            </div>
          </div>

          {/* Post Content */}
          <div className="skeleton-content">
            <div className="skeleton-line shimmer"></div>
            <div className="skeleton-line shimmer"></div>
            <div className="skeleton-line shimmer long"></div>
          </div>

          {/* Post Image Placeholder */}
          <div className="skeleton-image shimmer"></div>

          {/* Post Signal Badges */}
          <div className="skeleton-signals">
            <div className="skeleton-badge shimmer"></div>
            <div className="skeleton-badge shimmer"></div>
            <div className="skeleton-badge shimmer"></div>
          </div>

          {/* Post Actions */}
          <div className="skeleton-actions">
            <div className="skeleton-action-item shimmer"></div>
            <div className="skeleton-action-item shimmer"></div>
            <div className="skeleton-action-item shimmer"></div>
          </div>
        </div>
      ))}
    </div>
  );
}
