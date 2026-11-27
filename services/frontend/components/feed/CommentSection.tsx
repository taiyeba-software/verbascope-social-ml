'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import Link from 'next/link';
import { SendIcon } from './icons';
import {
  safeAuthorName,
  safeAuthorInitials,
  getAuthorAvatarUrl,
  getAvatarColor,
  getAvatarSeed,
  type Comment,
} from './feedHelpers';
import { postService } from '@/lib/api';
import './CommentThread.css';

// CHANGED: CommentSection owns ONE socket connection to post-service and
// shares it with every thread through this context, so threads can react
// to 'comment:reply' / 'comment:deleted' without opening their own sockets.
export const CommentSocketContext = createContext<Socket | null>(null);

// The base `Comment` type (from feedHelpers) doesn't know about nesting yet.
// Extending it here rather than editing feedHelpers so this stays a
// self-contained, low-risk addition — the fields already come back from the
// API today (see comment.model.js), this just tells TypeScript about them.
export type NestedComment = Comment & {
  parentComment?: string | null;
  repliesCount?: number;
  // Milestone 3: computed once server-side by commentSentiment.classifyComment()
  // and returned as part of the comment document — no extra fetch needed here.
  sentiment?: {
    label: 'positive' | 'negative' | 'neutral';
    score: number;
  };
};

// Cap visual indent so very deep threads don't run off the right edge
const MAX_INDENT_DEPTH = 4;

// Typography pass: reverted from an emoji-in-a-filled-pill (Milestone 3)
// back to a plain-text-plus-dot style — the dot is a plain CSS-colored
// character, not an emoji, so it matches the app's own accent colors
// instead of the OS emoji set.
const SENTIMENT_BADGE: Record<'positive' | 'negative' | 'neutral', { label: string }> = {
  positive: { label: 'Positive' },
  negative: { label: 'Negative' },
  neutral: { label: 'Neutral' },
};

function ThreadSentimentBadge({ sentiment }: { sentiment?: NestedComment['sentiment'] }) {
  if (!sentiment) return null;
  const badge = SENTIMENT_BADGE[sentiment.label];
  return (
    <span
      className={`thread-sentiment-badge thread-sentiment-badge--${sentiment.label}`}
      title={`Sentiment score: ${sentiment.score}`}
    >
      <span className="thread-sentiment-dot" aria-hidden="true">●</span>
      <span className="thread-sentiment-label">{badge.label}</span>
    </span>
  );
}

export function CommentThread({
  postId,
  comment,
  depth = 0,
  currentUserId,
  onDeleteTopLevel,
  onDeleteReply,
}: {
  postId: string;
  comment: NestedComment;
  depth?: number;
  currentUserId?: string | null;
  // Only used when this thread IS a top-level comment, to reuse the existing
  // delete flow your parent component already manages for the top-level list.
  onDeleteTopLevel?: (postId: string, commentId: string) => void;
  // CHANGED: for replies (depth > 0). The PARENT thread owns the list the
  // reply lives in, so the parent performs the delete + removes it from its
  // own list. (Before, the reply's own thread tried to delete itself from
  // ITS OWN children list, so the reply never disappeared from the screen.)
  onDeleteReply?: (replyId: string) => void;
}) {
  const socket = useContext(CommentSocketContext);

  const [replies, setReplies] = useState<NestedComment[] | null>(null);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Local copy so "View N replies" updates immediately after posting a reply,
  // without needing the parent's top-level state to know anything happened.
  const [repliesCount, setRepliesCount] = useState(comment.repliesCount ?? 0);

  // CHANGED: keep the count in sync when the parent re-fetches comments and
  // hands us a fresh `comment` object (e.g. someone else replied).
  useEffect(() => {
    setRepliesCount(comment.repliesCount ?? 0);
  }, [comment.repliesCount]);

  // CHANGED: lets the socket handler know whether the replies list is open
  // without re-subscribing every time `replies` changes.
  const repliesOpenRef = useRef(false);
  useEffect(() => {
    repliesOpenRef.current = replies !== null;
  }, [replies]);

  const fetchReplies = async (): Promise<NestedComment[] | null> => {
    try {
      const res = await postService.getReplies(comment._id);
      return (res.data as { replies: NestedComment[] }).replies;
    } catch (err) {
      console.error('Failed to load replies:', err);
      return null;
    }
  };

  const loadReplies = async () => {
    if (replies !== null) {
      setReplies(null); // toggle closed
      return;
    }
    setLoadingReplies(true);
    const fresh = await fetchReplies();
    if (fresh) setReplies(fresh);
    setLoadingReplies(false);
  };

  // CHANGED: live updates. When anyone replies to / deletes a reply of THIS
  // comment, re-read the replies from the server (the source of truth). That
  // also avoids double-counting when the event is for our own reply.
  useEffect(() => {
    if (!socket) return;

    const handler = async (payload: { parentCommentId?: string; postId?: string }) => {
      if (payload?.parentCommentId !== comment._id) return;
      const fresh = await fetchReplies();
      if (!fresh) return;
      setRepliesCount(fresh.length);
      if (repliesOpenRef.current) setReplies(fresh);
    };

    socket.on('comment:reply', handler);
    socket.on('comment:deleted', handler);
    return () => {
      socket.off('comment:reply', handler);
      socket.off('comment:deleted', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, comment._id]);

  const submitReply = async () => {
    const trimmed = replyText.trim();
    if (!trimmed || submittingReply) return;

    setSubmittingReply(true);
    try {
      const res = await postService.addComment(postId, trimmed, comment._id);
      const newReply = (res.data as { comment: NestedComment }).comment;

      setReplyText('');
      setShowReplyBox(false);

      // CHANGED: load the full list from the server instead of appending to
      // whatever happened to be in memory. Previously, if the thread had
      // existing replies that weren't loaded yet, only the new one showed.
      const fresh = await fetchReplies();
      if (fresh) {
        setReplies(fresh);
        setRepliesCount(fresh.length);
      } else {
        setReplies((prev) => [...(prev ?? []), newReply]);
        setRepliesCount((prev) => prev + 1);
      }
    } catch (err) {
      console.error('Failed to post reply:', err);
    } finally {
      setSubmittingReply(false);
    }
  };

  // Replies fetched into local state aren't part of the parent's top-level
  // `comments` array, so deleting one is handled entirely here — called by
  // the child via its `onDeleteReply` prop.
  const deleteReply = async (replyId: string) => {
    try {
      await postService.deleteComment(postId, replyId);
      setReplies((prev) => (prev ? prev.filter((r) => r._id !== replyId) : prev));
      setRepliesCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to delete reply:', err);
    }
  };

  const canIndentFurther = depth < MAX_INDENT_DEPTH;

  // comment.author comes from a populated Mongoose `user` field — always
  // includes _id even though the backend only explicitly selected `fullname`.
  const authorId = (comment.author as { _id?: string } | undefined)?._id;
  const isOwnComment = !!currentUserId && !!authorId && currentUserId === authorId;

  // Same as PostCard's authorHref: only render a profile link when there's
  // a real id to link to (comment.author can be missing for deleted users).
  const authorHref = authorId ? `/profile/${authorId}` : undefined;

  // Same avatar/initials fallback logic PostCard already uses — reused
  // via getAuthorAvatarUrl() rather than duplicated here.
  const avatarUrl = getAuthorAvatarUrl(comment.author);

  const avatarEl = (
    <div
      className="thread-avatar"
      style={avatarUrl ? undefined : { background: getAvatarColor(getAvatarSeed(comment.author)) }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={safeAuthorName(comment.author)} />
      ) : (
        safeAuthorInitials(comment.author)
      )}
    </div>
  );

  return (
    <div className={`thread-item${depth === 0 ? ' thread-item--top' : ''}`}>
      {authorHref ? (
        <Link
          href={authorHref}
          className="thread-avatar-link"
          style={{ display: 'contents' }}
          aria-label={`View ${safeAuthorName(comment.author)}'s profile`}
        >
          {avatarEl}
        </Link>
      ) : (
        avatarEl
      )}

      <div className="thread-content">
        <div className="thread-header">
          {authorHref ? (
            <Link href={authorHref} className="thread-author-link" style={{ color: 'inherit', textDecoration: 'none' }}>
              <span className="thread-author">{safeAuthorName(comment.author)}</span>
            </Link>
          ) : (
            <span className="thread-author">{safeAuthorName(comment.author)}</span>
          )}

          <ThreadSentimentBadge sentiment={comment.sentiment} />

          {isOwnComment && depth === 0 && onDeleteTopLevel ? (
            <button
              type="button"
              className="thread-delete-btn"
              onClick={() => onDeleteTopLevel(postId, comment._id)}
              aria-label="Delete comment"
            >
              ✕
            </button>
          ) : isOwnComment && depth > 0 && onDeleteReply ? (
            <button
              type="button"
              className="thread-delete-btn"
              onClick={() => onDeleteReply(comment._id)}
              aria-label="Delete reply"
            >
              ✕
            </button>
          ) : null}
        </div>

        <p className="thread-text">{comment.content}</p>

        <div className="thread-actions">
          <button type="button" className="thread-action-btn" onClick={() => setShowReplyBox((v) => !v)}>
            Reply
          </button>

          {repliesCount > 0 && (
            <button type="button" className="thread-action-btn thread-view-replies-btn" onClick={loadReplies}>
              {loadingReplies ? (
                'Loading...'
              ) : replies ? (
                'Hide replies'
              ) : (
                <>
                  <span className="thread-chevron">▾</span>
                  {repliesCount} {repliesCount === 1 ? 'reply' : 'replies'}
                </>
              )}
            </button>
          )}
        </div>

        {showReplyBox && (
          <div className="thread-reply-box">
            <input
              className="thread-reply-input"
              type="text"
              placeholder="Write a reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitReply();
                }
              }}
            />
            <button
              type="button"
              className="thread-reply-send-btn"
              onClick={submitReply}
              disabled={!replyText.trim() || submittingReply}
              aria-label="Send reply"
            >
              <SendIcon />
            </button>
          </div>
        )}

        {replies && replies.length > 0 && (
          <div
            className="thread-children"
            style={!canIndentFurther ? { marginLeft: 0, paddingLeft: 12 } : undefined}
          >
            {replies.map((reply) => (
              <CommentThread
                key={reply._id}
                postId={postId}
                comment={reply}
                depth={depth + 1}
                currentUserId={currentUserId}
                onDeleteReply={deleteReply}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}