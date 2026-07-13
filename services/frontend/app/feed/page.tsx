'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import FeedSkeleton from '@/components/FeedSkeleton';
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



type OpenComments = Record<string, CommentState>;

export default function FeedPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [openComments, setOpenComments] = useState<OpenComments>({});
  const [shareSheet, setShareSheet] = useState<{ postId: string } | null>(null);

  // Pulse signal / trending tags + live post:update / post:deleted sync
  const { pulseSignal, trendingTags, setTrendingTags } = useFeedSocket(setPosts);

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

  const handleBookmark = (postId: string) => {
    setPosts((cur) => cur.map((post) => (post._id === postId ? { ...post, bookmarkedByMe: !post.bookmarkedByMe } : post)));
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    setPosts((cur) => cur.filter((post) => post._id !== postId));
    try {
      await postService.deletePost(postId);
    } catch {
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

        {/* Mobile trending bar — hidden on desktop via CSS */}
        <MobileTrendingBar trendingTags={trendingTags} />

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

            {totalPages > 1 && (
              <div className="pagination">
                <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
                  ← Previous
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <Sidebar
        pulseSignal={pulseSignal}
        trendingTags={trendingTags}
      />

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