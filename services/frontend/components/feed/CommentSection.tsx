'use client';

import { useEffect, useRef, useState } from 'react';
import { io as socketIO } from 'socket.io-client';
import { SendIcon } from './icons';
import { type Comment } from './feedHelpers';
import { CommentThread, type NestedComment } from './CommentThread';
import { postApi } from '@/lib/api/posts';
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

// ── Milestone 4 (v3): Discussion Pulse — dashboard-style, no emoji,
// color carries the meaning ──────────────────────────────────────────
type MoodType = 'calm' | 'mixed' | 'tense' | 'heated' | 'constructive';

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

const MOOD_CONFIG: Record<MoodType, { status: string; title: string; description: string }> = {
  heated: {
    status: 'Elevated',
    title: 'Discussion becoming heated',
    description: 'Negative sentiment is increasing.',
  },
  tense: {
    status: 'Rising',
    title: 'Negative sentiment rising',
    description: 'Discussion is leaning negative.',
  },
  mixed: {
    status: 'Mixed',
    title: 'Mixed opinions emerging',
    description: 'Positive and negative reactions are balanced.',
  },
  constructive: {
    status: 'Constructive',
    title: 'Discussion is constructive',
    description: 'Most comments are positive or neutral.',
  },
  calm: {
    status: 'Balanced',
    title: 'Discussion remains balanced',
    description: 'No strong sentiment detected.',
  },
};

function DiscussionPulseCard({ mood }: { mood: MoodPayload | null }) {
  if (!mood || !mood.meta || mood.meta.totalComments === 0) return null;

  const cfg = MOOD_CONFIG[mood.type];

  return (
    <div className={`discussion-pulse discussion-pulse--${mood.type}`}>
      <div className="discussion-pulse__header">Discussion Pulse</div>
      <div className="discussion-pulse__status">Status: {cfg.status}</div>
      <div className="discussion-pulse__title">{cfg.title}</div>
      <div className="discussion-pulse__desc">{cfg.description}</div>
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

  useEffect(() => {
    let cancelled = false;

    postApi
      .get<MoodPayload>(`/api/posts/${postId}/pulse/mood`)
      .then((res) => {
        if (!cancelled) setMood(res.data);
      })
      .catch((err) => {
        console.error('[CommentSection] Failed to fetch comment mood:', err);
      });

    const socket = socketIO('http://localhost:3003', { withCredentials: true });
    socketRef.current = socket;

    socket.on('pulse:mood', (payload: MoodPayload) => {
      if (payload.postId !== postId) return;
      setMood(payload);
    });

    return () => {
      cancelled = true;
      socket.disconnect();
    };
  }, [postId]);

  return (
    <div className="comments-panel">
      <DiscussionPulseCard mood={mood} />

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