'use client';

import './FeedSkeleton.css';

const POSTS = Array.from({ length: 4 });
const HAS_IMAGE = [true, false, true, true];
const TAG_COUNT = [3, 1, 2, 0];
const TEXT_WIDTHS = [
  ['w-100', 'w-92', 'w-70'],
  ['w-100', 'w-75'],
  ['w-95', 'w-100', 'w-70'],
  ['w-100', 'w-85', 'w-60'],
];

export default function FeedSkeleton() {
  return (
    <div className="feed-skeleton" aria-hidden="true">
      {POSTS.map((_, index) => (
        <article
          key={index}
          className="post-card skeleton-post post-card-loading"
          style={{ animationDelay: `${index * 0.08}s` }}
        >
          {/* Header */}
          <div className="post-header">
            <div className="post-author-info">
              <div className="post-avatar skeleton-block skeleton-avatar" />

              <div className="skeleton-author">
                <div className="skeleton-block skeleton-name" />
                <div className="post-meta">
                  <div className="skeleton-block skeleton-time" />
                </div>
              </div>
            </div>

            <div className="post-more-wrap">
              <div className="skeleton-block skeleton-more" />
            </div>
          </div>

          {/* Post text */}
          <div className="post-content skeleton-content">
            {TEXT_WIDTHS[index].map((width, i) => (
              <div key={i} className={`skeleton-block skeleton-line ${width}`} />
            ))}
          </div>

          {/* Fake image (occasionally) */}
          {HAS_IMAGE[index] && <div className="skeleton-block skeleton-image" />}

          {/* Tags */}
          {TAG_COUNT[index] > 0 && (
            <div className="post-tags">
              {Array.from({ length: TAG_COUNT[index] }).map((_, i) => (
                <div key={i} className="post-tag skeleton-tag">
                  <span
                    className={`skeleton-block skeleton-tag-fill ${i === 1 ? 'short' : i === 2 ? 'tiny' : ''}`}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="post-actions">

            <div className="post-action-btn skeleton-action">
              <div className="skeleton-block skeleton-action-icon" />
              <div className="skeleton-block skeleton-action-text" />
            </div>

            <div className="post-action-btn skeleton-action">
              <div className="skeleton-block skeleton-action-icon" />
              <div className="skeleton-block skeleton-action-text" />
            </div>

            <div className="post-action-btn skeleton-action">
              <div className="skeleton-block skeleton-action-icon" />
              <div className="skeleton-block skeleton-action-text" />
            </div>

            <div className="post-action-btn skeleton-action">
              <div className="skeleton-block skeleton-action-icon" />
            </div>

          </div>
        </article>
      ))}
    </div>
  );
}