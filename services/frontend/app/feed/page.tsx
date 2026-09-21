'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import FeedSkeleton from '@/components/FeedSkeleton';
import SidebarSkeleton from '@/components/SidebarSkeleton';
import CreatePostBox from '@/components/CreatePostBox';
import { useAuth } from '@/hooks/useAuth';
import { postApi, postService } from '@/lib/api/posts';
import { tokenStorage } from '@/lib/api';
import { PostCard, type FeedPost } from '@/components/feed/PostCard';
import { ShareSheet } from '@/components/feed/ShareSheet';
import { MobileTrendingBar } from './MobileTrendingBar';
import { WhoToFollowInline } from './WhoToFollowInline';
import { Sidebar } from '@/components/feed/Sidebar';
import { CommunityInsights, InsightBanner, findInsight } from '@/components/feed/CommunityInsights'; // ── NEW: Community Insights
import { findRisk } from '@/components/feed/FilterDropdown'; // ── NEW: AI Filter
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

function FeedPageContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // ── NEW: Community Insights filter, driven by the URL (?signal=educational).
  // Unknown values are ignored, so /feed?signal=bogus behaves like /feed. ──
  const searchParams = useSearchParams();
  const activeInsight = findInsight(searchParams.get('signal'));
  const activeSignal = activeInsight?.slug;

  // ── NEW: AI Filter, driven by the URL (?risk=green|yellow|red).
  // Filters by the ML Brain's prediction only. Unknown values are ignored,
  // so /feed?risk=bogus behaves like /feed. ──
  const activeRiskFilter = findRisk(searchParams.get('risk'));
  const activeRisk = activeRiskFilter?.value;

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [totalPages, setTotalPages] = useState(1);

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── NEW: true once the first feed load has finished. Keeps the sidebar
  // mounted while switching between Community Insights filters (otherwise
  // it would flash back to its skeleton on every filter click). ──
  const [firstLoadDone, setFirstLoadDone] = useState(false);

  // pageRef (not state) tracks "which page did we last fetch" — it drives
  // what page to request next, without needing a state update + rerender
  // round-trip in the middle of a fetch.
  const pageRef = useRef(0);
  const fetchingRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // ── NEW: bumped every time a filter (signal OR risk) changes. A response
  // that comes back for an OLD filter compares its captured version against
  // this and is discarded, so a slow request can never overwrite the new
  // list. ──
  const signalVersionRef = useRef(0);

  const [openComments, setOpenComments] = useState<OpenComments>({});
  const [shareSheet, setShareSheet] = useState<{ postId: string } | null>(null);

  // Weekly pulse / trending tags + live post:update / post:deleted sync.
  // UPDATED: `weeklyPulse` (live 'pulse:update' data) is what <Sidebar />
  // actually accepts; the old `pulseSignal` prop no longer exists on it.
  const { weeklyPulse, trendingTags, setTrendingTags } = useFeedSocket(setPosts);

  // NEW: capture the ?token= param appended by auth-service's Google OAuth
  // redirect (googleCallback → `/feed?token=...`). This is the only way a
  // redirect can hand the SPA a JS-readable token, since the cookie it also
  // sets is scoped to auth-service's own onrender.com subdomain and never
  // reaches post-service/notification-service. Runs first, before any
  // network calls, so lib/api.ts's request interceptor has the token
  // available for the feed fetch that follows once `user` resolves.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      tokenStorage.set(token);
      window.history.replaceState({}, '', '/feed');
    }
  }, []);

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

      // ── NEW: remember which filter this request belongs to ──
      const version = signalVersionRef.current;

      fetchingRef.current = true;
      pageRef.current = targetPage;

      if (targetPage === 1) {
        setLoadingInitial(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      // ── UPDATED: passes the active Community Insights signal and/or the
      // active AI Filter risk (if any) as query params. With no filter both
      // are undefined and axios omits them, so the request is identical to
      // before. ──
      postApi
        .get('/api/posts/feed', {
          params: { page: targetPage, limit: 10, signal: activeSignal, risk: activeRisk },
        })
        .then(({ data }) => {
          if (version !== signalVersionRef.current) return; // stale (filter changed)

          const result = data as FeedResponse;
          const newPosts = result.posts ?? [];

          setPosts((previous) =>
            targetPage === 1 ? newPosts : appendWithoutDuplicates(previous, newPosts)
          );
          setTotalPages(result.totalPages ?? 1);
          setHasMore(targetPage < (result.totalPages ?? 1));
        })
        .catch(() => {
          if (version !== signalVersionRef.current) return; // stale (filter changed)

          setError(targetPage === 1 ? 'Could not load your feed.' : 'Could not load more posts.');
        })
        .finally(() => {
          if (version !== signalVersionRef.current) return; // stale (filter changed)

          fetchingRef.current = false;
          setLoadingInitial(false);
          setLoadingMore(false);
          setFirstLoadDone(true);
        });
    },
    [user, activeSignal, activeRisk]
  );

  // Kick off page 1 once the user is known — and again whenever a filter
  // changes (Community Insights click, AI Filter pick, banner "Clear
  // Filter", browser back/forward). Switching filter keeps this component
  // mounted, so the old list, page counter and any in-flight request are
  // reset first.
  useEffect(() => {
    signalVersionRef.current += 1;
    fetchingRef.current = false;
    pageRef.current = 0;
    setPosts([]);
    setHasMore(true);
    setTotalPages(1);
    if (user) fetchFeed(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeSignal, activeRisk]);

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
        <CreatePostBox
          onPost={(newPost) => {
            // ── NEW: a brand-new post has no community marks yet and no ML
            // prediction yet, so it never belongs in a filtered view
            // (Community Insights or AI Filter). ──
            if (activeSignal || activeRisk) return;
            setPosts((cur) => [{ ...newPost, commentsCount: 0 } as FeedPost, ...cur]);
          }}
        />

        {/* Mobile trending bar — hidden on desktop via CSS */}
        <MobileTrendingBar trendingTags={trendingTags} />

        {/* ── NEW: Community Insights, compact 2×2 version — mobile only
            (the desktop version lives in <Sidebar />) ── */}
        <div className="mobile-only">
          <CommunityInsights activeSlug={activeSignal ?? null} compact />
        </div>

        {/* ── NEW: active-filter banner ── */}
        {activeInsight && <InsightBanner insight={activeInsight} />}

        {/* ── NEW: AI Filter banner ── */}
        {activeRiskFilter && (
          <div className={`risk-banner risk-banner--${activeRiskFilter.value}`} role="status">
            <div className="risk-banner-text">
              <strong>
                {activeRiskFilter.emoji} {activeRiskFilter.bannerTitle}
              </strong>
              <span>{activeRiskFilter.bannerText}</span>
            </div>
            <Link href="/feed" className="risk-banner-clear">
              Clear Filter ✕
            </Link>
          </div>
        )}

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
          activeInsight ? (
            // ── NEW: friendly empty state for a Community Insights filter ──
            <div className="feed-empty">
              <div className="feed-empty-icon">{activeInsight.icon}</div>
              <div className="feed-empty-title">{activeInsight.emptyTitle}</div>
              <p>{activeInsight.emptyText}</p>
              <Link href="/feed" className="insight-banner-clear">
                Back to all posts
              </Link>
            </div>
          ) : activeRiskFilter ? (
            // ── NEW: friendly empty state for an AI Filter ──
            <div className="feed-empty">
              <div className="feed-empty-icon">{activeRiskFilter.emoji}</div>
              <div className="feed-empty-title">{activeRiskFilter.emptyTitle}</div>
              <p>{activeRiskFilter.emptyText}</p>
              <Link href="/feed" className="insight-banner-clear">
                Back to all posts
              </Link>
            </div>
          ) : (
            <div className="feed-empty">
              <div className="feed-empty-icon">📡</div>
              <div className="feed-empty-title">No posts yet</div>
              <p>Be the first to share something with the community.</p>
            </div>
          )
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

      {/* UPDATED: skeleton only until the FIRST load finishes, so switching
          filters doesn't remount the sidebar each time. */}
      {!firstLoadDone ? (
        <aside className="feed-sidebar">
          <SidebarSkeleton />
        </aside>
      ) : (
        <Sidebar
          weeklyPulse={weeklyPulse}
          activeInsight={activeSignal ?? null}
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

// useSearchParams() must sit under a <Suspense> boundary in the App Router.
export default function FeedPage() {
  return (
    <Suspense fallback={null}>
      <FeedPageContent />
    </Suspense>
  );
}