'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io as socketIO } from 'socket.io-client';
import Navbar from '@/components/Navbar';
import FeedSkeleton from '@/components/FeedSkeleton';
import CreatePostBox from '@/components/CreatePostBox';
import { useAuth } from '@/hooks/useAuth';
import { postApi, postService } from '@/lib/api/posts';
import type { Post } from '@/types';
import './feed.css';

type FeedPost = Post & {
  bookmarkedByMe?: boolean;
  commentsCount: number;
  sharesCount?: number;
  tags?: string[];
  createdAt?: string;
};

type Comment = {
  _id: string;
  content: string;
  author?: { fullname?: { firstName?: string; lastName?: string } } | string | null;
  createdAt?: string;
};

type OpenComments = {
  [postId: string]: {
    open: boolean;
    comments: Comment[];
    loading: boolean;
    input: string;
    submitting: boolean;
  };
};

const DEFAULT_COMMENT_STATE = {
  open: false,
  comments: [] as Comment[],
  loading: false,
  input: '',
  submitting: false,
};

function safeAuthorName(author: Post['author'] | Comment['author']): string {
  if (!author) return 'Anonymous';
  if (typeof author === 'string') return author || 'Anonymous';
  const fn = author?.fullname?.firstName ?? '';
  const ln = author?.fullname?.lastName ?? '';
  return `${fn} ${ln}`.trim() || 'Anonymous';
}

function safeAuthorInitials(author: Post['author'] | Comment['author']): string {
  if (!author) return 'A';
  if (typeof author === 'string') return (author[0] ?? 'A').toUpperCase();
  const f = author?.fullname?.firstName?.[0] ?? '';
  const l = author?.fullname?.lastName?.[0] ?? '';
  return (f + l).toUpperCase() || 'A';
}

const AVATAR_COLORS = [
  'linear-gradient(135deg, #0e9fab, #17b0bc)',
  'linear-gradient(135deg, #8b5cf6, #a78bfa)',
  'linear-gradient(135deg, #f97316, #fb923c)',
  'linear-gradient(135deg, #ef4444, #f87171)',
  'linear-gradient(135deg, #22c55e, #4ade80)',
  'linear-gradient(135deg, #3b82f6, #60a5fa)',
  'linear-gradient(135deg, #ec4899, #f472b6)',
  'linear-gradient(135deg, #eab308, #facc15)',
];

function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function getAvatarSeed(author: Post['author'] | Comment['author']): string {
  if (!author) return 'anonymous';
  if (typeof author === 'string') return author;
  return (
    (author as { id?: string }).id ||
    `${author.fullname?.firstName ?? ''} ${author.fullname?.lastName ?? ''}`.trim() ||
    'anonymous'
  );
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function extractTags(content: string): string[] {
  return (content.match(/#\w+/g) ?? []).slice(0, 4);
}

const HeartIcon = ({ filled }: { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const CommentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

const BookmarkIcon = ({ filled }: { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

const GlobeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

function PostMoreMenu({ postId, isOwner, onDelete }: { postId: string; isOwner: boolean; onDelete: (id: string) => void }) {
  if (!isOwner) return null;

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="post-more-wrap" ref={ref}>
      <button
        type="button"
        className="post-more-btn"
        aria-label="More options"
        onClick={() => setOpen((value) => !value)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="5" r="1" fill="currentColor" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
          <circle cx="12" cy="19" r="1" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div className="post-more-dropdown">
          {isOwner && (
            <button type="button" className="post-more-item danger" onClick={() => { setOpen(false); onDelete(postId); }}>
              🗑️ Delete post
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const TRENDING = [
  { tag: '#EmotionalAI', count: '2.3K posts' },
  { tag: '#SarcasmDetection', count: '2.1K posts' },
  { tag: '#SocialSignals', count: '1.9K posts' },
  { tag: '#ToxicitySignals', count: '1.6K posts' },
];

const hardcodedFallback = TRENDING;

type TrendingTag = {
  tag: string;
  count?: string;
};

const WHO_TO_FOLLOW = [
  { name: 'AI Explorer', handle: '@aiexplorer', initials: 'AE' },
  { name: 'CodeWithShuvo', handle: '@shuvo.dev', initials: 'CS' },
  { name: 'ML Insights', handle: '@ml.insights', initials: 'MI' },
];

export default function FeedPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [openComments, setOpenComments] = useState<OpenComments>({});
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [trendingTags, setTrendingTags] = useState<TrendingTag[]>([]);
  const [pulseSignal, setPulseSignal] = useState('');
  const [shareSheet, setShareSheet] = useState<{ postId: string } | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/auth/login');
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    setFeedLoading(true);
    postService
      .getFeed(page)
      .then(({ data }) => {
        const result = data as { posts: FeedPost[]; totalPages: number };
        setPosts(result.posts ?? []);
        setTotalPages(result.totalPages ?? 1);
      })
      .catch(() => {})
      .finally(() => setFeedLoading(false));
  }, [user, page]);

  useEffect(() => {
    const socket = socketIO('http://localhost:3003', {
      withCredentials: true,
    });

    socket.on('pulse:update', (signal: { message?: string }) => {
      setPulseSignal(signal.message ?? '');
    });

    socket.on('pulse:trending', (tags: TrendingTag[]) => {
      setTrendingTags(tags);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const res = await postApi.get<{ trending: Array<string | { tag: string; count?: number }> }>('/api/posts/pulse/trending');
        const next = res.data.trending
          .map((item) => {
            if (typeof item === 'string') return { tag: item };
            if (!item?.tag) return null;
            return {
              tag: item.tag,
              count: item.count != null ? `${item.count} posts` : undefined,
            };
          })
          .filter((item): item is TrendingTag => Boolean(item));

        if (next.length > 0) setTrendingTags(next);
      } catch (err) {
        if ((err as any)?.response?.status !== 404) {
          console.error('fetchTrending error:', err);
        }
        // 404 just means no trending data yet — safe to ignore
      }
    };

    fetchTrending();
  }, []);

  const handleLike = async (postId: string, isLiked: boolean) => {
    setPosts((cur) =>
      cur.map((post) =>
        post._id === postId
          ? { ...post, likedByMe: !isLiked, likesCount: isLiked ? post.likesCount - 1 : post.likesCount + 1 }
          : post
      )
    );
    try {
      if (isLiked) {
        await postService.unlikePost(postId);
      } else {
        await postService.likePost(postId);
      }
    } catch {
      setPosts((cur) =>
        cur.map((post) =>
          post._id === postId
            ? { ...post, likedByMe: isLiked, likesCount: isLiked ? post.likesCount + 1 : post.likesCount - 1 }
            : post
        )
      );
    }
  };

  const handleShare = (postId: string, isShared: boolean) => {
    if (isShared) {
      // unshare immediately, no reason needed
      setPosts((cur) =>
        cur.map((post) =>
          post._id === postId
            ? { ...post, sharedByMe: false, sharesCount: Math.max(0, (post.sharesCount ?? 1) - 1) }
            : post
        )
      );
      postService.unsharePost(postId).catch(() => {
        setPosts((cur) =>
          cur.map((post) =>
            post._id === postId
              ? { ...post, sharedByMe: true, sharesCount: (post.sharesCount ?? 0) + 1 }
              : post
          )
        );
      });
    } else {
      // open reason picker
      setShareSheet({ postId });
    }
  };

  const handleShareWithReason = async (postId: string, reason: string) => {
    setShareSheet(null);
    setPosts((cur) =>
      cur.map((post) =>
        post._id === postId
          ? { ...post, sharedByMe: true, sharesCount: (post.sharesCount ?? 0) + 1 }
          : post
      )
    );
    try {
      await postService.sharePost(postId, reason);
    } catch {
      setPosts((cur) =>
        cur.map((post) =>
          post._id === postId
            ? { ...post, sharedByMe: false, sharesCount: Math.max(0, (post.sharesCount ?? 1) - 1) }
            : post
        )
      );
    }
  };

  const handleBookmark = (postId: string) => {
    setPosts((cur) => cur.map((post) => (post._id === postId ? { ...post, bookmarkedByMe: !post.bookmarkedByMe } : post)));
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    setPosts((cur) => cur.filter((post) => post._id !== postId));
    try {
      await postService.deletePost(postId);
    } catch {
      // rollback
      postService.getFeed(page).then(({ data }) => {
        const result = data as { posts: FeedPost[]; totalPages: number };
        setPosts(result.posts ?? []);
      });
      alert('Failed to delete post. Please try again.');
    }
  };

  const toggleComments = async (postId: string) => {
    const already = openComments[postId];

    if (already?.open) {
      setOpenComments((prev) => ({ ...prev, [postId]: { ...prev[postId], open: false } }));
      return;
    }

    setOpenComments((prev) => ({
      ...prev,
      [postId]: {
        open: true,
        comments: already?.comments ?? [],
        loading: !already?.comments?.length,
        input: already?.input ?? '',
        submitting: false,
      },
    }));

    if (!already?.comments?.length) {
      try {
        const res = await postService.getComments(postId);
        const data = res.data as { comments: Comment[] };
        setOpenComments((prev) => ({
          ...prev,
          [postId]: { ...prev[postId], comments: data.comments ?? [], loading: false },
        }));
      } catch {
        setOpenComments((prev) => ({
          ...prev,
          [postId]: { ...prev[postId], loading: false },
        }));
      }
    }
  };

  const handleCommentInput = (postId: string, value: string) => {
    setOpenComments((prev) => ({ ...prev, [postId]: { ...prev[postId], input: value } }));
  };

  const handleSubmitComment = async (postId: string) => {
    const state = openComments[postId];
    if (!state?.input.trim() || state.submitting) return;

    setOpenComments((prev) => ({ ...prev, [postId]: { ...prev[postId], submitting: true } }));

    try {
      const response = await postService.addComment(postId, state.input.trim());
      const data = response.data as { comment: Comment };
      setOpenComments((prev) => ({
        ...prev,
        [postId]: {
          ...prev[postId],
          comments: [...(prev[postId]?.comments ?? []), data.comment],
          input: '',
          submitting: false,
        },
      }));
      setPosts((cur) => cur.map((post) => (post._id === postId ? { ...post, commentsCount: post.commentsCount + 1 } : post)));
    } catch {
      setOpenComments((prev) => ({ ...prev, [postId]: { ...prev[postId], submitting: false } }));
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    setOpenComments((prev) => ({
      ...prev,
      [postId]: {
        ...prev[postId],
        comments: (prev[postId]?.comments ?? []).filter((comment) => comment._id !== commentId),
      },
    }));

    setPosts((cur) => cur.map((post) => (post._id === postId ? { ...post, commentsCount: Math.max(0, post.commentsCount - 1) } : post)));
    try {
      await postService.deleteComment(postId, commentId);
    } catch {
      // silently fail
    }
  };

  const toggleFollow = (handle: string) => {
    setFollowing((prev) => {
      const next = new Set(prev);
      if (next.has(handle)) next.delete(handle);
      else next.add(handle);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="feed-layout">
        <Navbar />
        <main className="feed-main">
          <FeedSkeleton />
        </main>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="feed-layout">
      <Navbar />

      <main className="feed-main">
        <CreatePostBox onPost={(newPost) => setPosts((cur) => [{ ...newPost, commentsCount: 0 } as FeedPost, ...cur])} />

        {feedLoading ? (
          <FeedSkeleton />
        ) : posts.length === 0 ? (
          <div className="feed-empty">
            <div className="feed-empty-icon">📡</div>
            <div className="feed-empty-title">No posts yet</div>
            <p>Be the first to share something with the community.</p>
          </div>
        ) : (
          <>
            {posts.map((post) => {
              const tags = post.tags ?? extractTags(post.content);
              const commentState = openComments[post._id] ?? DEFAULT_COMMENT_STATE;

              return (
                <article key={post._id} className="post-card">
                  <div className="post-header">
                    <div className="post-author-info">
                      <div
                        className="post-avatar"
                        style={{ background: getAvatarColor(getAvatarSeed(post.author)) }}
                      >
                        {safeAuthorInitials(post.author)}
                      </div>
                      <div>
                        <span className="post-author-name">{safeAuthorName(post.author)}</span>
                        <div className="post-meta">
                          <span className="post-time">{timeAgo(post.createdAt)}</span>
                          <span className="post-visibility"><GlobeIcon /></span>
                        </div>
                      </div>
                    </div>
                    <PostMoreMenu postId={post._id} isOwner={post.isOwner} onDelete={handleDeletePost} />
                  </div>

                  <p className="post-content">{post.content}</p>

                  {tags.length > 0 && (
                    <div className="post-tags">
                      {tags.map((tag) => (
                        <span key={tag} className="post-tag">{tag}</span>
                      ))}
                    </div>
                  )}

                  <div className="post-actions">
                    <button
                      type="button"
                      className={`post-action-btn${post.likedByMe ? ' liked' : ''}`}
                      onClick={() => handleLike(post._id, post.likedByMe ?? false)}
                      aria-label={post.likedByMe ? 'Unlike' : 'Like'}
                      aria-pressed={post.likedByMe}
                    >
                      <HeartIcon filled={post.likedByMe} />
                      <span>{post.likesCount ?? 0}</span>
                    </button>

                    <button
                      type="button"
                      className={`post-action-btn${commentState?.open ? ' active' : ''}`}
                      onClick={() => toggleComments(post._id)}
                      aria-label="Comments"
                    >
                      <CommentIcon />
                      <span>{post.commentsCount ?? 0}</span>
                    </button>

                    <button
                      type="button"
                      className={`post-action-btn${post.sharedByMe ? ' shared' : ''}`}
                      onClick={() => handleShare(post._id, post.sharedByMe ?? false)}
                      aria-label={post.sharedByMe ? 'Unshare' : 'Share'}
                      aria-pressed={post.sharedByMe}
                    >
                      <ShareIcon />
                      <span>{post.sharesCount ?? 0}</span>
                    </button>

                    <button
                      type="button"
                      className={`post-action-btn${post.bookmarkedByMe ? ' bookmarked' : ''}`}
                      onClick={() => handleBookmark(post._id)}
                      aria-label={post.bookmarkedByMe ? 'Remove bookmark' : 'Bookmark'}
                      aria-pressed={post.bookmarkedByMe}
                    >
                      <BookmarkIcon filled={post.bookmarkedByMe} />
                    </button>
                  </div>

                  {commentState?.open && (
                    <div className="comments-panel">
                      <div className="comment-input-row">
                        <input
                          className="comment-input"
                          type="text"
                          placeholder="Write a comment..."
                          value={commentState.input}
                          onChange={(e) => handleCommentInput(post._id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSubmitComment(post._id);
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="comment-submit-btn"
                          onClick={() => handleSubmitComment(post._id)}
                          disabled={!commentState.input.trim() || commentState.submitting}
                          aria-label="Send comment"
                        >
                          <SendIcon />
                        </button>
                      </div>

                      {commentState.loading ? (
                        <div className="comments-loading">Loading comments...</div>
                      ) : commentState.comments.length === 0 ? (
                        <div className="comments-empty">No comments yet. Be the first!</div>
                      ) : (
                        commentState.comments.map((comment) => (
                          <div key={comment._id} className="comment-item">
                            <div
                            className="comment-avatar"
                            style={{ background: getAvatarColor(getAvatarSeed(comment.author)) }}
                          >
                              {safeAuthorInitials(comment.author)}
                            </div>
                            <div className="comment-body">
                              <span className="comment-author">
                                {safeAuthorName(comment.author)}
                              </span>
                              <p className="comment-text">{comment.content}</p>
                            </div>
                            <button
                              type="button"
                              className="comment-delete-btn"
                              onClick={() => handleDeleteComment(post._id, comment._id)}
                              aria-label="Delete comment"
                            >
                              ✕
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </article>
              );
            })}

            {totalPages > 1 && (
              <div className="pagination">
                <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
                  ← Previous
                </button>
                <span>Page {page} of {totalPages}</span>
                <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <aside className="feed-sidebar">
        <div className="sidebar-card">
          <div className="sidebar-card-header">
            <div className="sidebar-card-icon">🔥</div>
            <h3 className="sidebar-card-title">Trending Now</h3>
          </div>
          {pulseSignal && <div className="trending-count">{pulseSignal}</div>}
          <div className="trending-list">
            {trendingTags.length > 0
              ? trendingTags.map(({ tag, count }) => (
                  <div key={tag} className="trending-item">
                    <span className="trending-dot" />
                    <div>
                      <div className="trending-tag">{tag}</div>
                      <div className="trending-count">{count}</div>
                    </div>
                  </div>
                ))
              : hardcodedFallback.map((item) => (
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
                  onClick={() => toggleFollow(person.handle)}
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

      {shareSheet && (
        <div className="share-sheet-overlay" onClick={() => setShareSheet(null)}>
          <div className="share-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="share-sheet-title">Why are you passing this forward?</div>
            <div className="share-sheet-options">
              {[
                { reason: 'needs_attention', label: '🚨 Needs attention' },
                { reason: 'agree', label: '✅ I agree' },
                { reason: 'funny', label: '😄 Funny' },
                { reason: 'insightful', label: '💡 Insightful' },
                { reason: 'concerning', label: '⚠️ Concerning' },
                { reason: 'educational', label: '📚 Educational' },
              ].map(({ reason, label }) => (
                <button
                  key={reason}
                  type="button"
                  className="share-reason-btn"
                  onClick={() => handleShareWithReason(shareSheet.postId, reason)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button type="button" className="share-sheet-cancel" onClick={() => setShareSheet(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
