import React from 'react';

export default function BookmarkSkeleton() {
  return (
    <div className="bookmark-skeleton-container" style={{ width: '100%' }}>
      {[1, 2].map((i) => (
        <div key={i} className="bookmark-skeleton-card">
          {/* Top Row: User Meta + Bookmark Indicator */}
          <div className="skeleton-row skeleton-header">
            <div className="skeleton-user">
              <div className="skeleton-avatar" />
              <div className="skeleton-user-info">
                <div className="skeleton-line skeleton-name" />
                <div className="skeleton-line skeleton-time" />
              </div>
            </div>
            {/* Bookmark Icon Skeleton */}
            <div className="skeleton-bookmark-icon" />
          </div>

          {/* Post Text Skeleton */}
          <div className="skeleton-body">
            <div className="skeleton-line skeleton-text-full" />
            <div className="skeleton-line skeleton-text-mid" />
          </div>

          {/* Post Image/Media Container Skeleton */}
          <div className="skeleton-media" />

          {/* Footer Actions (Like, Comment, Share) */}
          <div className="skeleton-actions">
            <div className="skeleton-pill" />
            <div className="skeleton-pill" />
            <div className="skeleton-pill" />
          </div>
        </div>
      ))}
    </div>
  );
}