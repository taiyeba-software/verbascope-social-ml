'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import FeedSkeleton from '@/components/FeedSkeleton';
import CreatePostBox from '@/components/CreatePostBox';
import './feed.css';

export default function FeedPage() {
  const [isLoading] = useState(true); // Simulate loading state

  return (
    <div className="feed-layout">
      <Navbar />

      <main className="feed-main">
        <div className="container">
          {/* Create Post Box */}
          <CreatePostBox />

          {/* Feed Content */}
          {isLoading ? (
            <FeedSkeleton />
          ) : (
            <div className="feed-empty">
              <p>No posts yet. Be the first to post!</p>
            </div>
          )}
        </div>
      </main>

      {/* Trending Sidebar */}
      <aside className="feed-sidebar">
        <div className="trending-card">
          <h3 className="label">Trending Now</h3>
          <div className="trending-list">
            {['#EmotionalAI', '#SarcasmDetection', '#SocialSignals'].map((tag) => (
              <a key={tag} href="#" className="trending-item">
                <span className="pulse-dot"></span>
                <div>
                  <div className="trending-tag">✦ {tag}</div>
                  <div className="trending-count">2.3K posts</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
