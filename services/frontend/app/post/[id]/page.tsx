'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { postService } from '@/lib/api/posts';
import { PostCard, type FeedPost } from '@/components/feed/PostCard';
import { ShareSheet } from '@/components/feed/ShareSheet';
import {
  DEFAULT_COMMENT_STATE,
  type CommentState,
  type Comment,
} from '@/components/feed/CommentSection';
import './post-page.css';

// Same reasoning as the feed page: always render per-request rather than
// being statically prerendered, since content is per-user/per-post.
export const dynamic = 'force-dynamic';

interface PostPageProps {
  params: Promise<{ id: string }>;
}

export default function PostPage({ params }: PostPageProps) {
  const { id: postId } = use(params);
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [post, setPost] = useState<FeedPost | null>(null);
  const [postLoading, setPostLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Comments start open on the full post page — that's the point of it.
  const [commentState, setCommentState] = useState<CommentState>({
    ...DEFAULT_COMMENT_STATE,
    open: true,
    loading: true,
  });

  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth/login');
  }, [authLoading, user, router]);

  // ── Fetch the post ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setPostLoading(true);
    setNotFound(false);

    postService
      .getPost(postId)
      .then(({ data }) => {
        if (cancelled) return;
        // getPost's exact response shape wasn't available while building
        // this — normalize both `{ post: {...} }` and a bare post object
        // instead of assuming one and breaking on the other.
        const raw = data as { post?: FeedPost } & Partial<FeedPost>;
        const fetched = raw.post ?? (raw as FeedPost);
        if (!fetched?._id) {
          setNotFound(true);
        } else {
          setPost(fetched);
        }
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setPostLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, postId]);

  // ── Fetch comments (always expanded here) ──────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setCommentState((prev) => ({ ...prev, open: true, loading: true }));

    postService
      .getComments(postId)
      .then((res) => {
        if (cancelled) return;
        const data = res.data as { comments: Comment[] };
        setCommentState((prev) => ({ ...prev, comments: data.comments ?? [], loading: false }));
      })
      .catch(() => {
        if (!cancelled) setCommentState((prev) => ({ ...prev, loading: false }));
      });

    return () => {
      cancelled = true;
    };
  }, [user, postId]);

  // ── Like — same optimistic-update/rollback shape as the feed page ──
  const handleLike = async (id: string, isLiked: boolean) => {
    setPost((cur) =>
      cur
        ? { ...cur, likedByMe: !isLiked, likesCount: isLiked ? cur.likesCount - 1 : cur.likesCount + 1 }
        : cur
    );
    try {
      if (isLiked) {
        await postService.unlikePost(id);
      } else {
        await postService.likePost(id);
      }
    } catch {
      setPost((cur) =>
        cur
          ? { ...cur, likedByMe: isLiked, likesCount: isLiked ? cur.likesCount + 1 : cur.likesCount - 1 }
          : cur
      );
    }
  };

  // ── Share ────────────────────────────────────────────────────────
  const handleShare = (id: string, isShared: boolean) => {
    if (isShared) {
      setPost((cur) =>
        cur ? { ...cur, sharedByMe: false, sharesCount: Math.max(0, (cur.sharesCount ?? 1) - 1) } : cur
      );
      postService.unsharePost(id).catch(() => {
        setPost((cur) => (cur ? { ...cur, sharedByMe: true, sharesCount: (cur.sharesCount ?? 0) + 1 } : cur));
      });
    } else {
      setShareSheetOpen(true);
    }
  };

  const handleShareWithReason = async (id: string, reason: string) => {
    setShareSheetOpen(false);
    setPost((cur) => (cur ? { ...cur, sharedByMe: true, sharesCount: (cur.sharesCount ?? 0) + 1 } : cur));
    try {
      await postService.sharePost(id, reason);
    } catch {
      setPost((cur) =>
        cur ? { ...cur, sharedByMe: false, sharesCount: Math.max(0, (cur.sharesCount ?? 1) - 1) } : cur
      );
    }
  };

  // ── Bookmark ─────────────────────────────────────────────────────
  const handleBookmark = async (id: string) => {
    const wasBookmarked = post?.bookmarkedByMe ?? false;
    setPost((cur) => (cur ? { ...cur, bookmarkedByMe: !wasBookmarked } : cur));
    try {
      if (wasBookmarked) {
        await postService.unbookmarkPost(id);
      } else {
        await postService.bookmarkPost(id);
      }
    } catch {
      setPost((cur) => (cur ? { ...cur, bookmarkedByMe: wasBookmarked } : cur));
    }
  };

  // ── Delete — the post is gone, so leave the page instead of showing
  // an empty card ─────────────────────────────────────────────────────
  const handleDeletePost = async (id: string) => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    try {
      await postService.deletePost(id);
      router.replace('/feed');
    } catch {
      alert('Failed to delete post. Please try again.');
    }
  };

  // ── Comments ─────────────────────────────────────────────────────
  const handleToggleComments = () => {
    setCommentState((prev) => ({ ...prev, open: !prev.open }));
  };

  const handleCommentInput = (_id: string, value: string) => {
    setCommentState((prev) => ({ ...prev, input: value }));
  };

  const handleSubmitComment = async (id: string) => {
    if (!commentState.input.trim() || commentState.submitting) return;
    setCommentState((prev) => ({ ...prev, submitting: true }));
    try {
      const response = await postService.addComment(id, commentState.input.trim());
      const data = response.data as { comment: Comment };
      setCommentState((prev) => ({
        ...prev,
        comments: [...prev.comments, data.comment],
        input: '',
        submitting: false,
      }));
      setPost((cur) => (cur ? { ...cur, commentsCount: cur.commentsCount + 1 } : cur));
    } catch {
      setCommentState((prev) => ({ ...prev, submitting: false }));
    }
  };

  const handleDeleteComment = async (id: string, commentId: string) => {
    setCommentState((prev) => ({
      ...prev,
      comments: prev.comments.filter((c) => c._id !== commentId),
    }));
    setPost((cur) => (cur ? { ...cur, commentsCount: Math.max(0, cur.commentsCount - 1) } : cur));
    try {
      await postService.deleteComment(id, commentId);
    } catch {
      // silently fail — mirrors feed page behavior
    }
  };

  // ── Copy link ────────────────────────────────────────────────────
  const handleCopyLink = async () => {
    const url = `${window.location.origin}/post/${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // clipboard blocked (permissions / non-HTTPS) — fail quietly
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="post-page-shell">
      <Navbar />

      <main className="post-page-main">
        <div className="post-page-header">
          <button type="button" className="post-page-back-btn" onClick={() => router.back()} aria-label="Go back">
            ←
          </button>
          <span className="post-page-title">Post</span>
          <button type="button" className="post-page-copy-link-btn" onClick={handleCopyLink}>
            {linkCopied ? 'Copied!' : 'Copy link'}
          </button>
        </div>

        {postLoading ? (
          <div className="post-page-skeleton" aria-hidden="true" />
        ) : notFound || !post ? (
          <div className="post-page-not-found">
            <div className="post-page-not-found-icon">🔍</div>
            <div className="post-page-not-found-title">Post not found</div>
            <p>This post may have been deleted, or the link is incorrect.</p>
          </div>
        ) : (
          <PostCard
            post={post}
            commentState={commentState}
            currentUserId={user?._id ?? user?.id}
            onLike={handleLike}
            onShare={handleShare}
            onBookmark={handleBookmark}
            onDelete={handleDeletePost}
            onToggleComments={handleToggleComments}
            onCommentInput={handleCommentInput}
            onSubmitComment={handleSubmitComment}
            onDeleteComment={handleDeleteComment}
          />
        )}
      </main>

      {shareSheetOpen && post && (
        <ShareSheet postId={post._id} onSelect={handleShareWithReason} onClose={() => setShareSheetOpen(false)} />
      )}
    </div>
  );
}