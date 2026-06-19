'use client';

import type { Post } from '@/types';
import { HeartIcon, CommentIcon, ShareIcon, BookmarkIcon, GlobeIcon } from './icons';
import { PostMoreMenu } from './PostMoreMenu';
import { CommentSection, type CommentState } from './CommentSection';
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
};

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

  return (
    <article className="post-card">
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

      <p className="post-content" style={{ whiteSpace: 'pre-wrap' }}>
        {post.content}
      </p>

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
