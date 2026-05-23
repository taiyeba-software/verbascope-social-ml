'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import FeedSkeleton from '@/components/FeedSkeleton';
import CreatePostBox from '@/components/CreatePostBox';
import { useAuth } from '@/hooks/useAuth';
import { postService } from '@/lib/api/posts';
import type { Post } from '@/types';
import './feed.css';

type FeedPost = Post & {
  likedByMe?: boolean;
};

export default function FeedPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [posts, setPosts] = useState<FeedPost[]>([]);
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
      .then(({ data }) => {
        const result = data as { posts: FeedPost[]; totalPages: number };
        setPosts(result.posts ?? []);
        setTotalPages(result.totalPages ?? 1);
      })
      .catch(() => {})
      .finally(() => setFeedLoading(false));
  }, [user, page]);

  const handleLike = async (postId: string, isLiked: boolean) => {
    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post._id === postId
          ? {
              ...post,
              likedByMe: !isLiked,
              likesCount: isLiked ? post.likesCount - 1 : post.likesCount + 1,
            }
          : post
      )
    );

    try {
      if (isLiked) {
        await postService.unlikePost(postId);
      } else {
        await postService.likePost(postId);
      }
    } catch (error) {
      console.error('Like action failed:', error);
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post._id === postId
            ? {
                ...post,
                likedByMe: isLiked,
                likesCount: isLiked ? post.likesCount + 1 : post.likesCount - 1,
              }
            : post
        )
      );
    }
  };

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
          <CreatePostBox onPost={(post: Post) => setPosts((prev) => [{ ...post }, ...prev])} />

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
                    <button
                      type="button"
                      className={`post-action-btn like-btn ${post.likedByMe ? 'liked' : ''}`}
                      onClick={() => handleLike(post._id, post.likedByMe ?? false)}
                      aria-label={post.likedByMe ? 'Unlike post' : 'Like post'}
                      aria-pressed={post.likedByMe}
                    >
                      <span className="action-icon">{post.likedByMe ? '♥' : '♡'}</span>
                      <span className="action-count">{post.likesCount}</span>
                    </button>

                    <button
                      type="button"
                      className="post-action-btn comment-btn"
                      onClick={() => {}}
                      aria-label="Comment on post"
                    >
                      <span className="action-icon">💬</span>
                      <span className="action-count">{post.commentsCount}</span>
                    </button>
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
