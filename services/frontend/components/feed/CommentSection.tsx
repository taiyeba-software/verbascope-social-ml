'use client';

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
  return (
    <div className="comments-panel">
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