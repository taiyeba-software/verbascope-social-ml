'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import FeedSkeleton from '@/components/FeedSkeleton';
import SidebarSkeleton from '@/components/SidebarSkeleton';
import CreatePostBox from '@/components/CreatePostBox';
import { useAuth } from '@/hooks/useAuth';
import { postApi, postService } from '@/lib/api/posts';
import { PostCard, type FeedPost } from '@/components/feed/PostCard';
import { ShareSheet } from '@/components/feed/ShareSheet';
import { MobileTrendingBar } from './MobileTrendingBar';
import { WhoToFollowInline } from './WhoToFollowInline';
import { Sidebar } from '@/components/feed/Sidebar';
import { useFeedSocket, type TrendingTag } from '@/components/feed/useFeedSocket';
import {
  DEFAULT_COMMENT_STATE,
  type CommentState,
  type Comment,
} from '@/components/feed/CommentSection';
import './feed.css';

// Force this route to always render per-request instead of being
// statically prerendered at build time.
export const dynamic = 'force-dynamic';

type OpenComments = Record<string, CommentState>;

type FeedResponse = { posts: FeedPost[]; totalPages: number };

// ── Appends `incoming` posts onto `current`, skipping any whose _id is
// already present. Page-based pagination can occasionally hand back an
// overlapping post if something was inserted/deleted between requests. ──
function appendWithoutDuplicates(current: FeedPost[], incoming: FeedPost[]): FeedPost[] {
  const existingIds = new Set(current.map((post) => post._id));
  return [...current, ...incoming.filter((post) => !existingIds.has(post._id))];
}

export default function FeedPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [totalPages, setTotalPages] = useState(1);

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // pageRef (not state) tracks "which page did we last fetch" — it drives
  // what page to request next, without needing a state update + rerender
  // round-trip in the middle of a fetch.
  const pageRef = useRef(0);
  const fetchingRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const [openComments, setOpenComments] = useState<OpenComments>({});
  const [shareSheet, setShareSheet] = useState<{ postId: string } | null>(null);

  // Pulse signal / trending tags + live post:update / post:deleted sync
  const { pulseSignal, trendingTags, setTrendingTags } = useFeedSocket(setPosts);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/auth/login');
  }, [isLoading, user, router]);

  // ── Fetches a specific page. Page 1 replaces the list (initial load /
  // retry-from-scratch); any later page appends + dedupes (infinite
  // scroll). Called imperatively — not driven by a `page` state effect —
  // so the retry buttons can trigger a real fetch on demand. ──
  const fetchFeed = useCallback(
    (targetPage: number) => {
      if (!user || fetchingRef.current) return;

      fetchingRef.current = true;
      pageRef.current = targetPage;

      if (targetPage === 1) {
        setLoadingInitial(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      postService
        .getFeed(targetPage)
        .then(({ data }) => {
          const result = data as FeedResponse;
          const newPosts = result.posts ?? [];

          setPosts((previous) =>
            targetPage === 1 ? newPosts : appendWithoutDuplicates(previous, newPosts)
          );
          setTotalPages(result.totalPages ?? 1);
          setHasMore(targetPage < (result.totalPages ?? 1));
        })
        .catch(() => {
          setError(targetPage === 1 ? 'Could not load your feed.' : 'Could not load more posts.');
        })
        .finally(() => {
          fetchingRef.current = false;
          setLoadingInitial(false);
          setLoadingMore(false);
        });
    },
    [user]
  );

  // Kick off page 1 once the user is known.
  useEffect(() => {
    if (user) fetchFeed(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Sentinel via callback ref, not useRef+useEffect. A callback ref
  // fires every time the DOM node actually mounts/unmounts, which is
  // exactly when the observer needs to (re)attach — unlike a plain effect,
  // which only reruns when its dependencies change, and can silently miss
  // the sentinel's first real mount (e.g. right after the initial
  // skeleton is replaced by the post list). ──
  const attachSentinel = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;

      if (!node || !hasMore) return;

      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !loadingMore && !fetchingRef.current) {
            fetchFeed(pageRef.current + 1);
          }
        },
        { threshold: 0.1, rootMargin: '400px 0px' }
      );
      observerRef.current.observe(node);
    },
    [hasMore, loadingMore, fetchFeed]
  );

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const res = await postApi.get<{ trending: Array<string | { tag: string; count?: number }> }>(
          '/api/posts/pulse/trending'
        );
        const next = res.data.trending
          .map((item) => {
            if (typeof item === 'string') return { tag: item };
            if (!item?.tag) return null;
            return { tag: item.tag, count: item.count != null ? `${item.count} posts` : undefined };
          })
          .filter((item): item is TrendingTag => Boolean(item));

        if (next.length > 0) setTrendingTags(next);
      } catch {
        // trending is non-critical — socket will update it live
      }
    };
    fetchTrending();
  }, [setTrendingTags]);

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
      setShareSheet({ postId });
    }
  };

  const handleShareWithReason = async (postId: string, reason: string) => {
    setShareSheet(null);
    setPosts((cur) =>
      cur.map((post) =>
        post._id === postId ? { ...post, sharedByMe: true, sharesCount: (post.sharesCount ?? 0) + 1 } : post
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

  // ── Bookmark / save — optimistic toggle against the real save/unsave
  // endpoints, with rollback if the request fails. ──
  const handleBookmark = async (postId: string) => {
    const target = posts.find((post) => post._id === postId);
    const wasBookmarked = target?.bookmarkedByMe ?? false;

    setPosts((cur) =>
      cur.map((post) => (post._id === postId ? { ...post, bookmarkedByMe: !wasBookmarked } : post))
    );

    try {
      if (wasBookmarked) {
        await postService.unbookmarkPost(postId);
      } else {
        await postService.bookmarkPost(postId);
      }
    } catch {
      setPosts((cur) =>
        cur.map((post) => (post._id === postId ? { ...post, bookmarkedByMe: wasBookmarked } : post))
      );
    }
  };

  // ── Delete — purely local removal + rollback on failure. NOT a refetch:
  // once several pages are loaded, refetching one page and swapping it in
  // for the whole accumulated `posts` array would silently drop everything
  // else that had been loaded. ──
  const handleDeletePost = async (postId: string) => {
    if (!confirm('Delete this post? This cannot be undone.')) return;

    const previousPosts = posts;
    setPosts((cur) => cur.filter((post) => post._id !== postId));

    try {
      await postService.deletePost(postId);
    } catch {
      setPosts(previousPosts);
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
        setOpenComments((prev) => ({ ...prev, [postId]: { ...prev[postId], loading: false } }));
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

  // NOTE: ProtectedRoute (in the root layout) already renders the correct,
  // full skeleton — with Navbar, CreatePostBox, and the sidebar — for the
  // entire duration that isLoading is true, and only mounts FeedPage's
  // children once loading is done.

  if (!user) return null;

  return (
    <div className="feed-layout">
      <Navbar />

      <main className="feed-main">
        <CreatePostBox onPost={(newPost) => setPosts((cur) => [{ ...newPost, commentsCount: 0 } as FeedPost, ...cur])} />

        {/* Mobile trending bar — hidden on desktop via CSS */}
        <MobileTrendingBar trendingTags={trendingTags} />

        {loadingInitial ? (
          <FeedSkeleton />
        ) : error && posts.length === 0 ? (
          <div className="feed-error">
            <p>{error}</p>
            <button type="button" onClick={() => fetchFeed(1)}>
              Retry
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className="feed-empty">
            <div className="feed-empty-icon">📡</div>
            <div className="feed-empty-title">No posts yet</div>
            <p>Be the first to share something with the community.</p>
          </div>
        ) : (
          <>
            {posts.map((post, index) => (
              <div key={post._id}>
                <PostCard
                  post={post}
                  commentState={openComments[post._id] ?? DEFAULT_COMMENT_STATE}
                  currentUserId={user?._id ?? user?.id}
                  onLike={handleLike}
                  onShare={handleShare}
                  onBookmark={handleBookmark}
                  onDelete={handleDeletePost}
                  onToggleComments={toggleComments}
                  onCommentInput={handleCommentInput}
                  onSubmitComment={handleSubmitComment}
                  onDeleteComment={handleDeleteComment}
                />
                {/* Inject "People you may know" after every 4th post — mobile only */}
                {(index + 1) % 4 === 0 && (
                  <div className="mobile-only">
                    <WhoToFollowInline />
                  </div>
                )}
              </div>
            ))}

            {loadingMore && (
              <div className="feed-loading-more">
                <span className="feed-spinner" aria-hidden="true" />
                <span>Loading more...</span>
              </div>
            )}

            {error && !loadingMore && (
              <div className="feed-load-more-error">
                <span>{error}</span>
                <button type="button" onClick={() => fetchFeed(pageRef.current + 1)}>
                  Retry
                </button>
              </div>
            )}

            {!hasMore && !loadingMore && (
              <div className="feed-end">✨ You're all caught up</div>
            )}

            {/* Sentinel — always the last element when there's more to load,
                so the observer keeps a stable target to watch. */}
            {hasMore && <div ref={attachSentinel} className="feed-sentinel" aria-hidden="true" />}
          </>
        )}
      </main>

      {loadingInitial ? (
        <aside className="feed-sidebar">
          <SidebarSkeleton />
        </aside>
      ) : (
        <Sidebar
          pulseSignal={pulseSignal}
          trendingTags={trendingTags}
        />
      )}

      {shareSheet && (
        <ShareSheet
          postId={shareSheet.postId}
          onSelect={handleShareWithReason}
          onClose={() => setShareSheet(null)}
        />
      )}
    </div>
  );
}