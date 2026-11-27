'use client';

import { useEffect, useState } from 'react';
import { io as socketIO, type Socket } from 'socket.io-client';
import { SendIcon } from './icons';
import { type Comment } from './feedHelpers';
import { CommentThread, CommentSocketContext, type NestedComment } from './CommentThread';
import { postApi, tokenStorage } from '@/lib/api';
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

  // CHANGED: the socket lives in state (not just a ref) so it can be handed
  // to every CommentThread through CommentSocketContext once it exists.
  const [socket, setSocket] = useState<Socket | null>(null);

  // CHANGED: local copy of the top-level comments. It follows the parent's
  // `state.comments`, but can also be refreshed straight from the server when
  // a live event says the comment count changed (someone else commented or
  // deleted). This works even though the parent owns the real state.
  const [liveComments, setLiveComments] = useState<Comment[]>(state.comments);

  useEffect(() => {
    setLiveComments(state.comments);
  }, [state.comments]);

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

    const refetchComments = () => {
      postApi
        .get<{ comments: Comment[] }>(`/api/posts/${postId}/comments`)
        .then((res) => {
          if (!cancelled && Array.isArray(res.data?.comments)) {
            setLiveComments(res.data.comments);
          }
        })
        .catch((err) => {
          console.error('[CommentSection] Failed to refresh comments:', err);
        });
    };

    // URL comes from NEXT_PUBLIC_POST_API_URL so production deployments
    // point at the real deployed post-service instead of every visitor's
    // own localhost. Falls back to localhost for local development.
    // auth.token is verified by post-service's Socket.IO handshake
    // middleware — same JWT the HTTP requests send as a Bearer header.
    const sock = socketIO(
      process.env.NEXT_PUBLIC_POST_API_URL || 'http://localhost:3003',
      { withCredentials: true, auth: { token: tokenStorage.get() } }
    );

    // CHANGED: log connection state so socket problems are visible in the
    // browser console instead of failing silently.
    sock.on('connect', () => {
      console.log('🟢 post socket connected:', sock.id);
    });
    sock.on('connect_error', (err) => {
      console.error('🔴 post socket error:', err.message);
    });

    sock.on('pulse:mood', (payload: MoodPayload) => {
      if (payload.postId !== postId) return;
      setMood(payload);
    });

    // CHANGED: the backend emits 'post:update' with commentsCount whenever a
    // comment is added or deleted. Likes also use 'post:update' but carry no
    // commentsCount, so those are ignored here.
    sock.on('post:update', (payload: { postId?: string; commentsCount?: number }) => {
      if (payload?.postId !== postId) return;
      if (payload.commentsCount === undefined) return;
      refetchComments();
    });

    setSocket(sock);

    return () => {
      cancelled = true;
      sock.disconnect();
      setSocket(null);
    };
  }, [postId]);

  return (
    <CommentSocketContext.Provider value={socket}>
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
        ) : liveComments.length === 0 ? (
          <div className="comments-empty">No comments yet. Be the first!</div>
        ) : (
          liveComments.map((comment) => (
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
    </CommentSocketContext.Provider>
  );
}