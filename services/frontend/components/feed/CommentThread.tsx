'use client';

import { useState } from 'react';
import { SendIcon } from './icons';
import { safeAuthorName, safeAuthorInitials, getAvatarColor, getAvatarSeed, type Comment } from './feedHelpers';
import { postService } from '@/lib/api';
import './CommentThread.css';

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

// Milestone 3: small emoji + label lookup, kept local to this file since
// it's only ever used here.
const SENTIMENT_BADGE: Record<'positive' | 'negative' | 'neutral', { emoji: string; label: string }> = {
  positive: { emoji: '🟢', label: 'Positive' },
  negative: { emoji: '🔴', label: 'Negative' },
  neutral: { emoji: '⚪', label: 'Neutral' },
};

function ThreadSentimentBadge({ sentiment }: { sentiment?: NestedComment['sentiment'] }) {
  if (!sentiment) return null;
  const badge = SENTIMENT_BADGE[sentiment.label];
  return (
    <span className="thread-sentiment-badge" title={`Sentiment score: ${sentiment.score}`}>
      {badge.emoji} <span className="thread-sentiment-label">{badge.label}</span>
    </span>
  );
}

export function CommentThread({
  postId,
  comment,
  depth = 0,
  currentUserId,
  onDeleteTopLevel,
}: {
  postId: string;
  comment: NestedComment;
  depth?: number;
  currentUserId?: string | null;
  // Only used when this thread IS a top-level comment, to reuse the existing
  // delete flow your parent component already manages for the top-level list.
  onDeleteTopLevel?: (postId: string, commentId: string) => void;
}) {
  const [replies, setReplies] = useState<NestedComment[] | null>(null);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Local copy so "View N replies" updates immediately after posting a reply,
  // without needing the parent's top-level state to know anything happened.
  const [repliesCount, setRepliesCount] = useState(comment.repliesCount ?? 0);

  const loadReplies = async () => {
    if (replies !== null) {
      setReplies(null); // toggle closed
      return;
    }
    setLoadingReplies(true);
    try {
      const res = await postService.getReplies(comment._id);
      setReplies((res.data as { replies: NestedComment[] }).replies);
    } catch (err) {
      console.error('Failed to load replies:', err);
    } finally {
      setLoadingReplies(false);
    }
  };

  const submitReply = async () => {
    const trimmed = replyText.trim();
    if (!trimmed || submittingReply) return;

    setSubmittingReply(true);
    try {
      const res = await postService.addComment(postId, trimmed, comment._id);
      const newReply = (res.data as { comment: NestedComment }).comment;

      setReplies((prev) => [...(prev ?? []), newReply]);
      setRepliesCount((prev) => prev + 1);
      setReplyText('');
      setShowReplyBox(false);
    } catch (err) {
      console.error('Failed to post reply:', err);
    } finally {
      setSubmittingReply(false);
    }
  };

  // Replies fetched into local state aren't part of the parent's top-level
  // `comments` array, so deleting one is handled entirely here.
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

  return (
    <div className={`thread-item${depth === 0 ? ' thread-item--top' : ''}`}>
      <div className="thread-avatar" style={{ background: getAvatarColor(getAvatarSeed(comment.author)) }}>
        {safeAuthorInitials(comment.author)}
      </div>

      <div className="thread-content">
        <div className="thread-header">
          <span className="thread-author">{safeAuthorName(comment.author)}</span>

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
          ) : isOwnComment && depth > 0 ? (
            <button
              type="button"
              className="thread-delete-btn"
              onClick={() => deleteReply(comment._id)}
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}