'use client';

import { useEffect, useRef, useState } from 'react';
import { io as socketIO } from 'socket.io-client';
import { SendIcon } from './icons';
import { type Comment } from './feedHelpers';
import { CommentThread, type NestedComment } from './CommentThread';
import './CommentSection.css';

export type { Comment };

export type CommentState = {
  open: boolean;
  comments: Comment[];
  loading: boolean;
  input: string;
  submitting: boolean;
};

export const DEFAULT_COMMENT_STATE: CommentState = {
  open: false,
  comments: [],
  loading: false,
  input: '',
  submitting: false,
};

// ── Milestone 4: per-post comment mood ──────────────────────────────
type MoodType = 'calm' | 'mixed' | 'tense' | 'heated';

type MoodPayload = {
  postId?: string;
  type: MoodType;
  message: string;
  meta?: {
    totalComments: number;
    positive: number;
    negative: number;
    neutral: number;
  };
};

const MOOD_ICON: Record<MoodType, string> = {
  calm: '🟢',
  mixed: '🟡',
  tense: '🟠',
  heated: '🔴',
};

const MOOD_LABEL: Record<MoodType, string> = {
  calm: 'Calm discussion',
  mixed: 'Mixed reactions',
  tense: 'Tension rising',
  heated: 'High emotional intensity',
};

function CommentMoodNotice({ mood }: { mood: MoodPayload | null }) {
  if (!mood || !mood.meta || mood.meta.totalComments === 0) return null;

  // Calm threads stay nearly silent — this is meant to warn, not decorate.
  if (mood.type === 'calm') return null;

  return (
    <div className={`comment-mood-notice comment-mood-notice--${mood.type}`}>
      <span className="comment-mood-notice__icon">{MOOD_ICON[mood.type]}</span>
      <div className="comment-mood-notice__text">
        <span className="comment-mood-notice__label">{MOOD_LABEL[mood.type]}</span>
        <span className="comment-mood-notice__sub">
          {mood.type === 'heated' || mood.type === 'tense'
            ? "This thread's gotten a bit tense — read with that in mind"
            : 'Opinions are split in this thread'}
        </span>
      </div>
    </div>
  );
}

export function CommentSection({
  postId,
  state,
  currentUserId,
  onInputChange,
  onSubmit,
  onDelete,
}: {
  postId: string;
  state: CommentState;
  currentUserId?: string | null;
  onInputChange: (postId: string, value: string) => void;
  onSubmit: (postId: string) => void;
  onDelete: (postId: string, commentId: string) => void;
}) {
  const [mood, setMood] = useState<MoodPayload | null>(null);
  const socketRef = useRef<ReturnType<typeof socketIO> | null>(null);

  // Fetch current mood the moment this thread opens (covers pre-existing
  // nasty comments, not just live ones) + subscribe for live updates.
  useEffect(() => {
    let cancelled = false;

    fetch(`http://localhost:3003/api/posts/${postId}/pulse/mood`, {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data: MoodPayload) => {
        if (!cancelled) setMood(data);
      })
      .catch(() => {});

    const socket = socketIO('http://localhost:3003', { withCredentials: true });
    socketRef.current = socket;

    socket.on('pulse:mood', (payload: MoodPayload) => {
      if (payload.postId !== postId) return; // not about this thread, ignore
      setMood(payload);
    });

    return () => {
      cancelled = true;
      socket.disconnect();
    };
  }, [postId]);

  return (
    <div className="comments-panel">
      <CommentMoodNotice mood={mood} />

      <div className="top-comment-input-row">
        <input
          className="top-comment-input"
          type="text"
          placeholder="Write a comment..."
          value={state.input}
          onChange={(e) => onInputChange(postId, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSubmit(postId);
            }
          }}
        />
        <button
          type="button"
          className="top-comment-submit-btn"
          onClick={() => onSubmit(postId)}
          disabled={!state.input.trim() || state.submitting}
          aria-label="Send comment"
        >
          <SendIcon />
        </button>
      </div>

      {state.loading ? (
        <div className="comments-loading">Loading comments...</div>
      ) : state.comments.length === 0 ? (
        <div className="comments-empty">No comments yet. Be the first!</div>
      ) : (
        state.comments.map((comment) => (
          <CommentThread
            key={comment._id}
            postId={postId}
            comment={comment as NestedComment}
            depth={0}
            currentUserId={currentUserId}
            onDeleteTopLevel={onDelete}
          />
        ))
      )}
    </div>
  );
}