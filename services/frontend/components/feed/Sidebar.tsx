'use client';

import { ChevronRightIcon } from './icons';
import type { TrendingTag } from './useFeedSocket';

const TRENDING_FALLBACK = [
  { tag: '#EmotionalAI', count: '2.3K posts' },
  { tag: '#SarcasmDetection', count: '2.1K posts' },
  { tag: '#SocialSignals', count: '1.9K posts' },
  { tag: '#ToxicitySignals', count: '1.6K posts' },
];

const WHO_TO_FOLLOW = [
  { name: 'AI Explorer', handle: '@aiexplorer', initials: 'AE' },
  { name: 'CodeWithShuvo', handle: '@shuvo.dev', initials: 'CS' },
  { name: 'ML Insights', handle: '@ml.insights', initials: 'MI' },
];

export function Sidebar({
  pulseSignal,
  trendingTags,
  following,
  onToggleFollow,
}: {
  pulseSignal: string;
  trendingTags: TrendingTag[];
  following: Set<string>;
  onToggleFollow: (handle: string) => void;
}) {
  return (
    <aside className="feed-sidebar">
      <div className="sidebar-card">
        <div className="sidebar-card-header">
          <div className="sidebar-card-icon">🔥</div>
          <h3 className="sidebar-card-title">Trending Now</h3>
        </div>
        {pulseSignal && <div className="trending-count">{pulseSignal}</div>}
        <div className="trending-list">
          {(trendingTags.length > 0 ? trendingTags : TRENDING_FALLBACK).map((item) => (
            <div key={item.tag} className="trending-item">
              <span className="trending-dot" />
              <div>
                <div className="trending-tag">{item.tag}</div>
                <div className="trending-count">{item.count}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-card">
        <div className="sidebar-card-header">
          <div className="sidebar-card-icon">👥</div>
          <h3 className="sidebar-card-title">Who to Follow</h3>
        </div>
        <div className="follow-list">
          {WHO_TO_FOLLOW.map((person) => (
            <div key={person.handle} className="follow-item">
              <div className="follow-avatar">
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(135deg, #0e9fab, #17b0bc)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                  }}
                >
                  {person.initials}
                </div>
              </div>
              <div className="follow-info">
                <span className="follow-name">{person.name}</span>
                <span className="follow-handle">{person.handle}</span>
              </div>
              <button
                type="button"
                className={`follow-btn${following.has(person.handle) ? ' following' : ''}`}
                onClick={() => onToggleFollow(person.handle)}
              >
                {following.has(person.handle) ? 'Following' : 'Follow'}
              </button>
            </div>
          ))}
        </div>
        <div className="view-more-link">
          <span>View more</span>
          <ChevronRightIcon />
        </div>
      </div>
    </aside>
  );
}
