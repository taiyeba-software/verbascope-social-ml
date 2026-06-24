'use client';

import { useState, useEffect, useRef, type Ref } from 'react';
import type { Post } from '@/types';
import { HeartIcon, CommentIcon, ShareIcon, BookmarkIcon, GlobeIcon } from './icons';
import { PostMoreMenu } from './PostMoreMenu';
import { CommentSection, type CommentState } from './CommentSection';
import { useDwellTracker } from '@/hooks/useDwellTracker';
import {
  safeAuthorName,
  safeAuthorInitials,
  getAvatarColor,
  getAvatarSeed,
  timeAgo,
  extractTags,
} from './feedHelpers';

export type FeedPost = Post & {
  bookmarkedByMe?: boolean;
  commentsCount: number;
  sharesCount?: number;
  tags?: string[];
  createdAt?: string;
  images?: string[];
};

// ── Carousel ─────────────────────────────────────────────────────────
const AUTO_ADVANCE_MS = 5500; // change interval — 2.5s

function ImageCarousel({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const prev = () => setIndex((i) => (i - 1 + images.length) % images.length);
  const next = () => setIndex((i) => (i + 1) % images.length);

  // Auto-advance: runs only when there's more than one image and it's not paused
  useEffect(() => {
    if (images.length <= 1 || isPaused) return;

    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, AUTO_ADVANCE_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [images.length, isPaused]);

  if (images.length === 0) return null;

  // Single image — no controls needed
  if (images.length === 1) {
    return (
      <div className="post-image-single">
        <img
          src={images[0]}
          alt=""
          aria-hidden="true"
          className="post-image-backdrop"
        />
        <img src={images[0]} alt="Post image" loading="lazy" className="post-image-fg" />
      </div>
    );
  }

  return (
    <div
      className="post-carousel"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      <div className="post-carousel-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {images.map((url, i) => (
          <div key={url} className="post-carousel-slide">
            <img src={url} alt="" aria-hidden="true" className="post-carousel-backdrop" />
            <img
              src={url}
              alt={`Image ${i + 1} of ${images.length}`}
              loading="lazy"
              className="post-carousel-fg"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        className="post-carousel-btn post-carousel-btn--prev"
        onClick={prev}
        aria-label="Previous image"
      >
        ‹
      </button>
      <button
        type="button"
        className="post-carousel-btn post-carousel-btn--next"
        onClick={next}
        aria-label="Next image"
      >
        ›
      </button>

      <div className="post-carousel-dots">
        {images.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`post-carousel-dot${i === index ? ' active' : ''}`}
            onClick={() => setIndex(i)}
            aria-label={`Go to image ${i + 1}`}
          />
        ))}
      </div>

      <span className="post-carousel-counter">{index + 1} / {images.length}</span>
    </div>
  );
}

// ── PostCard ──────────────────────────────────────────────────────────
export function PostCard({
  post,
  commentState,
  onLike,
  onShare,
  onBookmark,
  onDelete,
  onToggleComments,
  onCommentInput,
  onSubmitComment,
  onDeleteComment,
}: {
  post: FeedPost;
  commentState: CommentState;
  onLike: (postId: string, isLiked: boolean) => void;
  onShare: (postId: string, isShared: boolean) => void;
  onBookmark: (postId: string) => void;
  onDelete: (postId: string) => void;
  onToggleComments: (postId: string) => void;
  onCommentInput: (postId: string, value: string) => void;
  onSubmitComment: (postId: string) => void;
  onDeleteComment: (postId: string, commentId: string) => void;
}) {
  const tags = post.tags ?? extractTags(post.content);
  const images = post.images ?? [];
  const dwellRef = useDwellTracker(post._id);

  return (
    <article className="post-card" ref={dwellRef as Ref<HTMLElement>}>
      <div className="post-header">
        <div className="post-author-info">
          <div className="post-avatar" style={{ background: getAvatarColor(getAvatarSeed(post.author)) }}>
            {safeAuthorInitials(post.author)}
          </div>
          <div>
            <span className="post-author-name">{safeAuthorName(post.author)}</span>
            <div className="post-meta">
              <span className="post-time">{timeAgo(post.createdAt)}</span>
              <span className="post-visibility">
                <GlobeIcon />
              </span>
            </div>
          </div>
        </div>
        <PostMoreMenu postId={post._id} isOwner={post.isOwner} onDelete={onDelete} />
      </div>

      {post.content && (
        <p className="post-content" style={{ whiteSpace: 'pre-wrap' }}>
          {post.content}
        </p>
      )}

      {/* Carousel — only renders when the post has images */}
      {images.length > 0 && <ImageCarousel images={images} />}

      {tags.length > 0 && (
        <div className="post-tags">
          {tags.map((tag) => (
            <span key={tag} className="post-tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="post-actions">
        <button
          type="button"
          className={`post-action-btn${post.likedByMe ? ' liked' : ''}`}
          onClick={() => onLike(post._id, post.likedByMe ?? false)}
          aria-label={post.likedByMe ? 'Unlike' : 'Like'}
          aria-pressed={post.likedByMe}
        >
          <HeartIcon filled={post.likedByMe} />
          <span>{post.likesCount ?? 0}</span>
        </button>

        <button
          type="button"
          className={`post-action-btn${commentState.open ? ' active' : ''}`}
          onClick={() => onToggleComments(post._id)}
          aria-label="Comments"
        >
          <CommentIcon />
          <span>{post.commentsCount ?? 0}</span>
        </button>

        <button
          type="button"
          className={`post-action-btn${post.sharedByMe ? ' shared' : ''}`}
          onClick={() => onShare(post._id, post.sharedByMe ?? false)}
          aria-label={post.sharedByMe ? 'Unshare' : 'Share'}
          aria-pressed={post.sharedByMe}
        >
          <ShareIcon />
          <span>{post.sharesCount ?? 0}</span>
        </button>

        <button
          type="button"
          className={`post-action-btn${post.bookmarkedByMe ? ' bookmarked' : ''}`}
          onClick={() => onBookmark(post._id)}
          aria-label={post.bookmarkedByMe ? 'Remove bookmark' : 'Bookmark'}
          aria-pressed={post.bookmarkedByMe}
        >
          <BookmarkIcon filled={post.bookmarkedByMe} />
        </button>
      </div>

      {commentState.open && (
        <CommentSection
          postId={post._id}
          state={commentState}
          onInputChange={onCommentInput}
          onSubmit={onSubmitComment}
          onDelete={onDeleteComment}
        />
      )}
    </article>
  );
}