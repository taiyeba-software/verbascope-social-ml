'use client';

import './FeedSkeleton.css';

export default function FeedSkeleton() {
  return (
    <div className="feed-skeleton">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="skeleton-post-card">
          <div className="skeleton-header">
            <div className="skeleton-header-left">
              <div className="skeleton-avatar shimmer" />
              <div className="skeleton-header-text">
                <div className="skeleton-line shimmer short" />
                <div className="skeleton-line shimmer xshort" />
              </div>
            </div>
            <div className="skeleton-more shimmer" />
          </div>

          <div className="skeleton-content">
            <div className="skeleton-line shimmer" />
            <div className="skeleton-line shimmer long" />
            <div className="skeleton-line shimmer medium" />
          </div>

          <div className="skeleton-tags">
            <div className="skeleton-tag shimmer" />
            <div className="skeleton-tag shimmer" />
            <div className="skeleton-tag shimmer" />
          </div>

          <div className="skeleton-actions">
            <div className="skeleton-action-item shimmer" />
            <div className="skeleton-action-item shimmer" />
            <div className="skeleton-action-item shimmer" />
            <div className="skeleton-action-item shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}
