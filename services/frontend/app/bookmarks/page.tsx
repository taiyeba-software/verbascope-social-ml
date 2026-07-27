'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import BookmarkSkeleton from './BookmarkSkeleton';
import { useAuth } from '@/hooks/useAuth';
import { postService } from '@/lib/api/posts';
import { PostCard, type FeedPost } from '@/components/feed/PostCard';
import { ShareSheet } from '@/components/feed/ShareSheet';
import {
  DEFAULT_COMMENT_STATE,
  type CommentState,
  type Comment,
} from '@/components/feed/CommentSection';
import '../feed/feed.css';

// Always render per-request — this is a personal, per-user list.
export const dynamic = 'force-dynamic';

type OpenComments = Record<string, CommentState>;

type SavedPostsResponse = {
  posts: FeedPost[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export default function BookmarksPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [openComments, setOpenComments] = useState<OpenComments>({});
  const [shareSheet, setShareSheet] = useState<{ postId: string } | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/auth/login');
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    setFeedLoading(true);
    postService
      .getBookmarkedPosts(page)
      .then(({ data }) => {
        const result = data as SavedPostsResponse;
        // The saved-posts endpoint marks these as `isSaved`; normalize to the
        // `bookmarkedByMe` field PostCard already reads everywhere else.
        const normalized = (result.posts ?? []).map((p: any) => ({
          ...p,
          bookmarkedByMe: p.bookmarkedByMe ?? p.isSaved ?? true,
        }));
        setPosts(normalized);
        setHasMore(result.hasMore ?? false);
        setTotalPages(Math.max(1, Math.ceil((result.total ?? normalized.length) / (result.limit || 10))));
      })
      .catch(() => setPosts([]))
      .finally(() => setFeedLoading(false));
  }, [user, page]);

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

  // ── Unbookmark — a post leaving the saved list means it disappears from
  // this page entirely (unlike the feed, where it just toggles the icon). ──
  const handleBookmark = async (postId: string) => {
    const removed = posts.find((post) => post._id === postId);
    setPosts((cur) => cur.filter((post) => post._id !== postId));

    try {
      await postService.unbookmarkPost(postId);
    } catch {
      // Put it back where it was if the unsave failed server-side.
      if (removed) {
        setPosts((cur) => {
          const idx = posts.indexOf(removed);
          const next = [...cur];
          next.splice(idx, 0, removed);
          return next;
        });
      }
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    setPosts((cur) => cur.filter((post) => post._id !== postId));
    try {
      await postService.deletePost(postId);
    } catch {
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

  if (!user) return null;

  return (
    <div className="feed-layout">
      <Navbar />

      <main className="feed-main" style={{ marginInline: 'auto' }}>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '4px 0 16px' }}>Your Bookmarks</h1>

        {feedLoading ? (
          <BookmarkSkeleton/>
        ) : posts.length === 0 ? (
          <div className="feed-empty">
            <div className="feed-empty-icon">🔖</div>
            <div className="feed-empty-title">No saved posts yet</div>
            <p>Tap the bookmark icon on any post to save it for later.</p>
          </div>
        ) : (
          <>
            {posts.map((post) => (
              <PostCard
                key={post._id}
                post={post}
                commentState={openComments[post._id] ?? DEFAULT_COMMENT_STATE}
                currentUserId={user?._id ?? (user as any)?.id}
                onLike={handleLike}
                onShare={handleShare}
                onBookmark={handleBookmark}
                onDelete={handleDeletePost}
                onToggleComments={toggleComments}
                onCommentInput={handleCommentInput}
                onSubmitComment={handleSubmitComment}
                onDeleteComment={handleDeleteComment}
              />
            ))}

            {totalPages > 1 && (
              <div className="pagination">
                <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
                  ← Previous
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button type="button" onClick={() => setPage((p) => p + 1)} disabled={!hasMore}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </main>

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