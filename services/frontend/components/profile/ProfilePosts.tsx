'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw, ImageOff, Bookmark } from 'lucide-react';
import { PostCard } from '@/components/feed/PostCard';
import BookmarkSkeleton from '@/app/bookmarks/BookmarkSkeleton';
import { postService } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import './ProfilePosts.css';

interface ProfilePostsProps {
  userId: string;
  activeTab: 'posts' | 'saved';
}

interface CommentStateMap {
  [postId: string]: {
    comments: any[];
    input: string;
    open: boolean;
    loading: boolean;
    submitting: boolean;
  };
}

export default function ProfilePosts({ userId, activeTab }: ProfilePostsProps) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Local state for handling post comments on profile page
  const [commentStates, setCommentStates] = useState<CommentStateMap>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchPromise =
      activeTab === 'saved' ? postService.getSavedPosts() : postService.getUserPosts(userId);

    fetchPromise
      .then((res: any) => {
        if (cancelled) return;
        const fetchedPosts = res?.data?.posts || res?.data || res?.posts || [];
        setPosts(Array.isArray(fetchedPosts) ? fetchedPosts : []);
      })
      .catch((err: any) => {
        if (!cancelled) {
          console.error(`Failed to load ${activeTab}:`, err);
          setError(`Failed to load ${activeTab}. Please try again.`);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, activeTab, reloadKey]);

  /* ── Interaction Handlers ── */
  const handleLike = async (postId: string, currentIsLiked: boolean) => {
    // Optimistic UI Update
    setPosts((prev) =>
      prev.map((p) => {
        if ((p._id || p.id) === postId) {
          return {
            ...p,
            likedByMe: !currentIsLiked,
            likesCount: currentIsLiked ? (p.likesCount || 1) - 1 : (p.likesCount || 0) + 1,
          };
        }
        return p;
      })
    );

    try {
      if (currentIsLiked) {
        await postService.unlikePost(postId);
      } else {
        await postService.likePost(postId);
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
      // Revert on error
      setPosts((prev) =>
        prev.map((p) => {
          if ((p._id || p.id) === postId) {
            return {
              ...p,
              likedByMe: currentIsLiked,
              likesCount: currentIsLiked ? p.likesCount : (p.likesCount || 1) - 1,
            };
          }
          return p;
        })
      );
    }
  };

  const handleToggleComments = async (postId: string) => {
    const currentState = commentStates[postId] || {
      comments: [],
      input: '',
      open: false,
      loading: false,
      submitting: false,
    };
    const nextOpen = !currentState.open;

    setCommentStates((prev) => ({
      ...prev,
      [postId]: { ...currentState, open: nextOpen, loading: nextOpen && currentState.comments.length === 0 },
    }));

    if (nextOpen && currentState.comments.length === 0) {
      try {
        const res: any = await postService.getComments(postId);
        const fetchedComments = res?.data?.comments || res?.comments || [];
        setCommentStates((prev) => ({
          ...prev,
          [postId]: { ...prev[postId], comments: fetchedComments, loading: false },
        }));
      } catch (err) {
        console.error('Failed to fetch comments:', err);
        setCommentStates((prev) => ({
          ...prev,
          [postId]: { ...prev[postId], loading: false },
        }));
      }
    }
  };

  const handleCommentInput = (postId: string, value: string) => {
    setCommentStates((prev) => ({
      ...prev,
      [postId]: {
        ...(prev[postId] || { comments: [], open: true, loading: false, submitting: false }),
        input: value,
      },
    }));
  };

  const handleSubmitComment = async (postId: string) => {
    const currentState = commentStates[postId];
    if (!currentState || !currentState.input.trim() || currentState.submitting) return;

    setCommentStates((prev) => ({
      ...prev,
      [postId]: { ...currentState, submitting: true },
    }));

    try {
      const res: any = await postService.addComment(postId, currentState.input.trim());
      const newComment = res?.data?.comment || res?.comment;

      setCommentStates((prev) => ({
        ...prev,
        [postId]: {
          ...prev[postId],
          input: '',
          submitting: false,
          comments: newComment ? [...prev[postId].comments, newComment] : prev[postId].comments,
        },
      }));

      // Increment comment count on the post
      setPosts((prev) =>
        prev.map((p) => ((p._id || p.id) === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p))
      );
    } catch (err) {
      console.error('Failed to submit comment:', err);
      setCommentStates((prev) => ({
        ...prev,
        [postId]: { ...prev[postId], submitting: false },
      }));
    }
  };

  if (loading) {
    return <BookmarkSkeleton />;
  }

  if (error) {
    return (
      <div className="profile-posts-state">
        <p className="profile-posts-state-text">{error}</p>
        <button
          type="button"
          className="profile-posts-retry"
          onClick={() => setReloadKey((k) => k + 1)}
        >
          <RefreshCw size={14} strokeWidth={2} />
          <span>Try again</span>
        </button>
      </div>
    );
  }

  if (posts.length === 0) {
    const Icon = activeTab === 'saved' ? Bookmark : ImageOff;
    return (
      <div className="profile-posts-state profile-posts-state--empty">
        <Icon size={28} strokeWidth={1.6} className="profile-posts-state-icon" />
        <p className="profile-posts-state-text">
          {activeTab === 'saved' ? 'No saved posts yet.' : 'No posts published yet.'}
        </p>
      </div>
    );
  }

  const currentUserId = user?._id || user?.id || null;

  return (
    <div className="profile-posts-list">
      {posts.map((post) => {
        const postId = post._id || post.id;
        const cState = commentStates[postId] || {
          comments: [],
          input: '',
          open: false,
          loading: false,
          submitting: false,
        };

        return (
          <PostCard
            key={postId}
            post={post}
            currentUserId={currentUserId}
            commentState={cState}
            onLike={(id, isLiked) => handleLike(id, isLiked)}
            onShare={async () => {}}
            onBookmark={async () => {}}
            onToggleComments={(id) => handleToggleComments(id)}
            onDeleteComment={async () => {}}
            onDelete={async () => {
              setPosts((prev) => prev.filter((p) => (p._id || p.id) !== postId));
              await postService.deletePost(postId);
            }}
            onCommentInput={(id, val) => handleCommentInput(id, val)}
            onSubmitComment={(id) => handleSubmitComment(id)}
          />
        );
      })}
    </div>
  );
}