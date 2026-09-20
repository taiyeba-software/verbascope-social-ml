'use client';

import { useState, useEffect, useRef, type Ref } from 'react';
import { createPortal } from 'react-dom'; // ── NEW: needed to escape .post-card's overflow:hidden
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Post } from '@/types';
import { HeartIcon, CommentIcon, ShareIcon, BookmarkIcon, GlobeIcon } from './icons';
import { PostMoreMenu } from './PostMoreMenu';
import { CommentSection, type CommentState } from './CommentSection';
import { LikeAnimation, type AnchorPoint } from './LikeAnimation';
import { AISignalCard, type MLAnalysis } from './AISignalCard';
import { useDwellTracker } from '@/hooks/useDwellTracker';
import { postService, type SharerEntry } from '@/lib/api';
import {
  safeAuthorName,
  safeAuthorInitials,
  getAuthorAvatarUrl,
  getAvatarColor,
  getAvatarSeed,
  timeAgo,
  extractTags,
} from './feedHelpers';
import './PostCard.css';

export type FeedPost = Post & {
  bookmarkedByMe?: boolean;
  commentsCount: number;
  sharesCount?: number;
  tags?: string[];
  createdAt?: string;
  images?: string[];
  mlAnalysis?: MLAnalysis | null;
};

// ── NEW: Community Signals — reason icon/label, mirrors CommunityInsights'
// INSIGHTS config (reason -> label/icon). Kept as a small local map instead
// of importing that file, since this only needs icon+label, not the full
// slug/banner/empty-state config used by the sidebar widget. ──
const REASON_META: Record<string, { icon: string; label: string }> = {
  needs_attention: { icon: '🚨', label: 'Needs Attention' },
  agree:           { icon: '✅', label: 'I Agree' },
  funny:           { icon: '😄', label: 'Funny' },
  insightful:      { icon: '💡', label: 'Insightful' },
  concerning:      { icon: '⚠️', label: 'Concerning' },
  educational:     { icon: '📚', label: 'Educational' },
};

const sharerName = (sharer: SharerEntry) =>
  `${sharer.user?.fullname?.firstName ?? ''} ${sharer.user?.fullname?.lastName ?? ''}`.trim() || 'Someone';

// ── Carousel ─────────────────────────────────────────────────────────
const AUTO_ADVANCE_MS = 5500;

function ImageCarousel({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((i) => (i - 1 + images.length) % images.length);
  };
  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((i) => (i + 1) % images.length);
  };

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
            onClick={(e) => {
              e.stopPropagation();
              setIndex(i);
            }}
            aria-label={`Go to image ${i + 1}`}
          />
        ))}
      </div>

      <span className="post-carousel-counter">{index + 1} / {images.length}</span>
    </div>
  );
}

// ── UPDATED: Community Signals — sharers popover ───────────────────────
// Was: `position: absolute` nested inside .post-actions. .post-card has
// `overflow: hidden` (for the left accent border / rounded image corners),
// which silently clipped this popover whenever it extended past the
// card's own box — it fetched and rendered, it just wasn't visible.
//
// Fix: render through a portal to document.body with `position: fixed`
// at real screen coordinates, computed from the trigger element's
// getBoundingClientRect(). Same escape-the-clip approach this file
// already needs for LikeAnimation's anchorPoint.
function SharersPopover({
  postId,
  anchorRect,
  onClose,
}: {
  postId: string;
  anchorRect: { top: number; left: number; width: number };
  onClose: () => void;
}) {
  const [sharers, setSharers] = useState<SharerEntry[] | null>(null);
  const [error, setError] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    postService
      .getPostSharers(postId)
      .then((res) => {
        if (cancelled) return;
        setSharers(res.data.sharers ?? []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => { cancelled = true; };
  }, [postId]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Attach on next frame so the click that OPENED this popover (still
    // bubbling in the same tick) doesn't immediately close it again.
    const id = requestAnimationFrame(() => {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleKey);
    });
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Anchored ABOVE the trigger, horizontally centered on it — real pixel
  // coordinates since this is now a fixed-position portal, not relative
  // to any (potentially clipping) ancestor.
  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.top - 8,
    left: anchorRect.left + anchorRect.width / 2,
    transform: 'translate(-50%, -100%)',
  };

  return createPortal(
    <div className="sharers-popover" ref={popoverRef} style={style} onClick={(e) => e.stopPropagation()}>
      <div className="sharers-popover-title">Shared by</div>

      {error && <div className="sharers-popover-empty">Couldn't load this list.</div>}

      {!error && sharers === null && (
        <div className="sharers-popover-empty">Loading...</div>
      )}

      {!error && sharers !== null && sharers.length === 0 && (
        <div className="sharers-popover-empty">No shares yet.</div>
      )}

      {!error && sharers !== null && sharers.length > 0 && (
        <ul className="sharers-popover-list">
          {sharers.map((sharer, i) => {
            const meta = sharer.reason ? REASON_META[sharer.reason] : null;
            return (
              <li key={`${sharer.user?._id ?? i}`} className="sharers-popover-item">
                <span className="sharers-popover-name">{sharerName(sharer)}</span>
                {meta && (
                  <span className="sharers-popover-reason">
                    {meta.icon} {meta.label}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>,
    document.body
  );
}

// ── PostCard ──────────────────────────────────────────────────────────
export function PostCard({
  post,
  commentState,
  currentUserId,
  onLike,
  onShare,
  onBookmark,
  onDelete,
  onToggleComments,
  onCommentInput,
  onSubmitComment,
  onDeleteComment,
  disableCardLink = false,
}: {
  post: FeedPost;
  commentState: CommentState;
  currentUserId?: string | null;
  onLike: (postId: string, isLiked: boolean) => void;
  onShare: (postId: string, isShared: boolean) => void;
  onBookmark: (postId: string) => void;
  onDelete: (postId: string) => void;
  onToggleComments: (postId: string) => void;
  onCommentInput: (postId: string, value: string) => void;
  onSubmitComment: (postId: string) => void;
  onDeleteComment: (postId: string, commentId: string) => void;
  disableCardLink?: boolean;
}) {
  const router = useRouter();
  const [likeBurst, setLikeBurst] = useState(0);
  const [anchorPoint, setAnchorPoint] = useState<AnchorPoint | null>(null);
  const likeBtnRef = useRef<HTMLButtonElement>(null);

  // ── UPDATED: Community Signals — sharers popover now tracks the
  // trigger's screen position (not just open/closed), since it renders
  // via a portal and needs real coordinates. Null = closed. ──
  const [sharersAnchor, setSharersAnchor] = useState<{ top: number; left: number; width: number } | null>(null);
  const sharesCountRef = useRef<HTMLSpanElement>(null);

  const tags = post.tags ?? extractTags(post.content);
  const images = post.images ?? [];
  const dwellRef = useDwellTracker(post._id);
  const authorAvatarUrl = getAuthorAvatarUrl(post.author);
  const hasText = !!post.content?.trim();

  const authorId = post.author && typeof post.author === 'object' ? (post.author as { _id?: string })._id : undefined;
  const authorHref = authorId ? `/profile/${authorId}` : undefined;

  const goToPost = () => {
    if (disableCardLink) return;
    router.push(`/post/${post._id}`);
  };

  const handleLikeClick = () => {
    const wasLiked = post.likedByMe ?? false;
    onLike(post._id, wasLiked);

    if (!wasLiked && likeBtnRef.current) {
      const rect = likeBtnRef.current.getBoundingClientRect();
      setAnchorPoint({
        top: rect.top + rect.height / 2 + window.scrollY,
        left: rect.left + rect.width / 2 + window.scrollX,
      });
      setLikeBurst((k) => k + 1);
    }
  };

  // ── UPDATED: opens the sharers popover (via portal) instead of
  // toggling share. Only makes sense when there's at least one share. ──
  const handleSharesCountClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if ((post.sharesCount ?? 0) === 0) return;
    if (sharersAnchor) {
      setSharersAnchor(null); // toggle closed
      return;
    }
    const rect = sharesCountRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSharersAnchor({ top: rect.top, left: rect.left + rect.width / 2, width: 0 });
  };

  const avatarEl = (
    <div
      className="post-avatar"
      style={authorAvatarUrl ? undefined : { background: getAvatarColor(getAvatarSeed(post.author)) }}
    >
      {authorAvatarUrl ? (
        <img src={authorAvatarUrl} alt={safeAuthorName(post.author)} />
      ) : (
        safeAuthorInitials(post.author)
      )}
    </div>
  );

  return (
    <article className="post-card" ref={dwellRef as Ref<HTMLElement>}>
      <AISignalCard mlAnalysis={post.mlAnalysis} hasText={hasText} />

      <div className="post-header">
        <div className="post-author-info">
          {authorHref ? (
            <Link
              href={authorHref}
              className="post-author-avatar-link"
              style={{ display: 'contents' }}
              aria-label={`View ${safeAuthorName(post.author)}'s profile`}
            >
              {avatarEl}
            </Link>
          ) : (
            avatarEl
          )}
          <div>
            {authorHref ? (
              <Link href={authorHref} className="post-author-name-link" style={{ color: 'inherit', textDecoration: 'none' }}>
                <span className="post-author-name">{safeAuthorName(post.author)}</span>
              </Link>
            ) : (
              <span className="post-author-name">{safeAuthorName(post.author)}</span>
            )}
            <div className="post-meta">
              <span
                className="post-time"
                onClick={goToPost}
                style={{ cursor: disableCardLink ? undefined : 'pointer' }}
              >
                {timeAgo(post.createdAt)}
              </span>
              <span className="post-visibility">
                <GlobeIcon />
              </span>
            </div>
          </div>
        </div>
        <PostMoreMenu postId={post._id} isOwner={post.isOwner} onDelete={onDelete} />
      </div>

      {post.content && (
        <p
          className="post-content"
          style={{ whiteSpace: 'pre-wrap', cursor: disableCardLink ? undefined : 'pointer' }}
          onClick={goToPost}
        >
          {post.content}
        </p>
      )}

      {images.length > 0 && (
        <div onClick={goToPost} style={{ cursor: disableCardLink ? undefined : 'pointer' }}>
          <ImageCarousel images={images} />
        </div>
      )}

      {tags.length > 0 && (
        <div className="post-tags">
          {tags.map((tag) => (
            <span key={tag} className="post-tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="post-actions" style={{ position: 'relative' }}>
        <button
          ref={likeBtnRef}
          type="button"
          className={`post-action-btn${post.likedByMe ? ' liked' : ''}`}
          onClick={handleLikeClick}
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

        {/* ── UPDATED: share icon still toggles share/unshare; the count
            is a separate clickable target that opens "who shared this"
            (via portal, see SharersPopover) when there's ≥1 share. ── */}
        <button
          type="button"
          className={`post-action-btn${post.sharedByMe ? ' shared' : ''}`}
          onClick={() => onShare(post._id, post.sharedByMe ?? false)}
          aria-label={post.sharedByMe ? 'Unshare' : 'Share'}
          aria-pressed={post.sharedByMe}
        >
          <ShareIcon />
          <span
            ref={sharesCountRef}
            onClick={handleSharesCountClick}
            className={(post.sharesCount ?? 0) > 0 ? 'post-action-count--clickable' : undefined}
            role={(post.sharesCount ?? 0) > 0 ? 'button' : undefined}
            aria-label={(post.sharesCount ?? 0) > 0 ? 'See who shared this' : undefined}
          >
            {post.sharesCount ?? 0}
          </span>
        </button>

        {sharersAnchor && (
          <SharersPopover
            postId={post._id}
            anchorRect={sharersAnchor}
            onClose={() => setSharersAnchor(null)}
          />
        )}

        <button
          type="button"
          className={`post-action-btn${post.bookmarkedByMe ? ' bookmarked' : ''}`}
          onClick={() => onBookmark(post._id)}
          aria-label={post.bookmarkedByMe ? 'Remove bookmark' : 'Bookmark'}
          aria-pressed={post.bookmarkedByMe}
        >
          <BookmarkIcon filled={post.bookmarkedByMe} />
        </button>

        {anchorPoint && (
          <LikeAnimation
            key={likeBurst}
            anchorPoint={anchorPoint}
            onDone={() => setAnchorPoint(null)}
          />
        )}
      </div>

      {commentState.open && (
        <CommentSection
          postId={post._id}
          state={commentState}
          currentUserId={currentUserId}
          onInputChange={onCommentInput}
          onSubmit={onSubmitComment}
          onDelete={onDeleteComment}
        />
      )}
    </article>
  );
}