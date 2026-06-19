'use client';

import { SendIcon } from './icons';
import { safeAuthorName, safeAuthorInitials, getAvatarColor, getAvatarSeed, type Comment } from './feedHelpers';

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
  onInputChange,
  onSubmit,
  onDelete,
}: {
  postId: string;
  state: CommentState;
  onInputChange: (postId: string, value: string) => void;
  onSubmit: (postId: string) => void;
  onDelete: (postId: string, commentId: string) => void;
}) {
  return (
    <div className="comments-panel">
      <div className="comment-input-row">
        <input
          className="comment-input"
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
          className="comment-submit-btn"
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
          <div key={comment._id} className="comment-item">
            <div
              className="comment-avatar"
              style={{ background: getAvatarColor(getAvatarSeed(comment.author)) }}
            >
              {safeAuthorInitials(comment.author)}
            </div>
            <div className="comment-body">
              <span className="comment-author">{safeAuthorName(comment.author)}</span>
              <p className="comment-text">{comment.content}</p>
            </div>
            <button
              type="button"
              className="comment-delete-btn"
              onClick={() => onDelete(postId, comment._id)}
              aria-label="Delete comment"
            >
              ✕
            </button>
          </div>
        ))
      )}
    </div>
  );
}