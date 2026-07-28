'use client';

import React from 'react';
import { LayoutGrid, Bookmark } from 'lucide-react';

interface ProfileTabsProps {
  activeTab: 'posts' | 'saved';
  onTabChange: (tab: 'posts' | 'saved') => void;
  isOwnProfile: boolean;
}

export default function ProfileTabs({
  activeTab,
  onTabChange,
  isOwnProfile,
}: ProfileTabsProps) {
  return (
    <div className="profile-tabs" role="tablist" aria-label="Profile content">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'posts'}
        className={`profile-tab ${activeTab === 'posts' ? 'is-active' : ''}`}
        onClick={() => onTabChange('posts')}
      >
        <LayoutGrid size={18} strokeWidth={1.9} />
        <span>Posts</span>
      </button>

      {isOwnProfile && (
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'saved'}
          className={`profile-tab ${activeTab === 'saved' ? 'is-active' : ''}`}
          onClick={() => onTabChange('saved')}
        >
          <Bookmark size={18} strokeWidth={1.9} />
          <span>Saved</span>
        </button>
      )}

      {/*
        styled-jsx instead of a separate .css file, deliberately:
        this app has hit the "component's stylesheet only ships on
        one route" bug three times now (ProfileHeader --vs- tokens,
        PostCard.css only loading on /feed, ProfileTabs.css missing
        entirely). styled-jsx compiles into this component's own JS
        chunk, so it always ships wherever <ProfileTabs> is rendered
        — there's no import path or route segment to get wrong.
      */}
      <style jsx>{`
        .profile-tabs {
          display: flex;
          gap: 8px;
          border-bottom: 1px solid var(--v-border, rgba(0, 0, 0, 0.08));
          margin-bottom: 24px;
          position: sticky;
          top: 0;
          z-index: 5;
          background: var(--v-bg-page, var(--v-bg-card, #fff));
        }

        .profile-tab {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 18px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--v-text-muted, #888);
          font-family: var(--v-font-sans, inherit);
          font-weight: 500;
          font-size: 0.95rem;
          cursor: pointer;
          transition: color 0.15s ease, border-color 0.15s ease;
        }

        .profile-tab:hover {
          color: var(--v-text-primary, #111);
        }

        .profile-tab:focus-visible {
          outline: 2px solid var(--v-signal-green, #6fbdb3);
          outline-offset: -2px;
          border-radius: 6px;
        }

        .profile-tab.is-active {
          color: var(--v-text-primary, #111);
          font-weight: 600;
          border-bottom-color: var(--v-signal-green, #6fbdb3);
        }

        @media (prefers-reduced-motion: reduce) {
          .profile-tab {
            transition: none;
          }
        }

        @media (max-width: 480px) {
          .profile-tabs {
            gap: 0;
          }
          .profile-tab {
            flex: 1;
            padding: 11px 8px;
            font-size: 0.88rem;
          }
        }
      `}</style>
    </div>
  );
}