'use client';

import './FeedSkeleton.css';

const TRENDING_ITEMS = [1, 2, 3, 4];
const FOLLOW_ITEMS = [1, 2, 3, 4];

export default function SidebarSkeleton() {
  return (
    <aside className="feed-sidebar sidebar-skeleton" aria-hidden="true">
      <div className="sidebar-card skeleton-sidebar-card">
        <div className="sidebar-card-header">
          <div className="sidebar-card-icon">🔥</div>
          <h3 className="sidebar-card-title">Trending Now</h3>
        </div>

        <div className="trending-list skeleton-trending-list">
          {TRENDING_ITEMS.map((_, index) => (
            <div key={index} className="trending-item skeleton-trending-item">
              <span className="trending-dot skeleton-block skeleton-trending-dot" />
              <div className="skeleton-block skeleton-trending-line short" />
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-card skeleton-sidebar-card">
        <div className="sidebar-card-header">
          <div className="sidebar-card-icon">👥</div>
          <h3 className="sidebar-card-title">Who to Follow</h3>
        </div>

        <div className="follow-list skeleton-follow-list">
          {FOLLOW_ITEMS.map((_, index) => (
            <div key={index} className="follow-item skeleton-follow-item">
              <div className="follow-avatar skeleton-block skeleton-follow-avatar" />

              <div className="follow-info skeleton-follow-info">
                <div className="skeleton-block skeleton-follow-name" />
                <div className="skeleton-block skeleton-follow-handle" />
              </div>

              <div className="skeleton-block skeleton-follow-btn" />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
