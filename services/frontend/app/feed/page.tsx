'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import FeedSkeleton from '@/components/FeedSkeleton';
import CreatePostBox from '@/components/CreatePostBox';
import { useAuth } from '@/hooks/useAuth';
import { postService } from '@/lib/api';
import type { Post } from '@/types';
import './feed.css';

export default function FeedPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [posts, setPosts] = useState<Post[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // ── Auth guard ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/auth/login');
    }
  }, [isLoading, user, router]);

  // ── Feed fetch ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    setFeedLoading(true);
    postService.getFeed(page)
      .then(({ data }: any) => {
        setPosts(data.posts);
        setTotalPages(data.totalPages);
      })
      .catch(() => {})
      .finally(() => setFeedLoading(false));
  }, [user, page]);

  // ── Render guards ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="feed-layout">
        <Navbar />
        <main className="feed-main">
          <div className="container"><FeedSkeleton /></div>
        </main>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="feed-layout">
      <Navbar />

      <main className="feed-main">
        <div className="container">
          <CreatePostBox onPost={(post: Post) => setPosts((prev) => [post, ...prev])} />

          {feedLoading ? (
            <FeedSkeleton />
          ) : posts.length === 0 ? (
            <div className="feed-empty">
              <p>No posts yet. Be the first to post!</p>
            </div>
          ) : (
            <>
              {posts.map((post) => (
                <div key={post._id} className="post-card">
                  <p className="post-author">
                    {typeof post.author === 'object'
                      ? `${post.author.fullname.firstName} ${post.author.fullname.lastName}`
                      : 'Unknown'}
                  </p>
                  <p className="post-content">{post.content}</p>
                  <div className="post-footer">
                    <span>♡ {post.likesCount}</span>
                    <span>💬 {post.commentsCount}</span>
                  </div>
                </div>
              ))}
              {totalPages > 1 && (
                <div className="pagination">
                  <button onClick={() => setPage(p => p - 1)} disabled={page === 1}>← Prev</button>
                  <span>{page} / {totalPages}</span>
                  <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>Next →</button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

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
