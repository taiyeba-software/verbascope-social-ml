'use client';

import Link from 'next/link';
import type { SearchPost } from '@/types/search';

interface SearchResultItemProps {
  post: SearchPost;
  active: boolean;
  onSelect: (post: SearchPost) => void;
}

function timeAgo(epochMs: number): string {
  const diffMs = Date.now() - epochMs;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  const week = Math.floor(day / 7);
  return `${week}w`;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase() || 'U';
}

// Same truthy/empty-string convention as feedHelpers.ts's getAuthorAvatarUrl:
// a missing value AND "" both fall through to the initials avatar. Kept as
// a type guard so TS narrows `post.authorAvatar` to `string` in the JSX below.
function hasAvatar(url?: string | null): url is string {
  return !!url && url.trim() !== '';
}

export function SearchResultItem({ post, active, onSelect }: SearchResultItemProps) {
  const displayName = post.authorName?.trim() || 'Unknown';

  // Was a <button>, but a <Link> (below, for the avatar/name → profile)
  // can't legally nest inside a <button>, and a click on it would also
  // bubble into the button's own onSelect. A div with role="option" keeps
  // the same click-to-open-post behavior for the rest of the row, while
  // the author link below stops propagation so it navigates on its own.
  // Keyboard nav (↑/↓/Enter) is handled by SearchBar's own active-index
  // state, not native button focus, so this swap doesn't affect it.
  return (
    <div
      role="option"
      aria-selected={active}
      className={`search-result-item${active ? ' active' : ''}`}
      onClick={() => onSelect(post)}
    >
      {/* display: contents mirrors PostCard/CommentThread's author-link
         pattern — the Link doesn't participate in the flex layout, so no
         CSS changes are needed here either. Skipped if authorId is ever
         missing, same deleted-user guard used elsewhere. */}
      {post.authorId ? (
        <Link
          href={`/profile/${post.authorId}`}
          style={{ display: 'contents' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="search-result-avatar">
            {hasAvatar(post.authorAvatar) ? (
              <img src={post.authorAvatar} alt={displayName} className="search-result-avatar-img" />
            ) : (
              initialsFromName(displayName)
            )}
          </div>
        </Link>
      ) : (
        <div className="search-result-avatar">
          {hasAvatar(post.authorAvatar) ? (
            <img src={post.authorAvatar} alt={displayName} className="search-result-avatar-img" />
          ) : (
            initialsFromName(displayName)
          )}
        </div>
      )}

      <div className="search-result-body">
        <div className="search-result-top">
          {post.authorId ? (
            <Link
              href={`/profile/${post.authorId}`}
              className="search-result-name"
              onClick={(e) => e.stopPropagation()}
            >
              {displayName}
            </Link>
          ) : (
            <span className="search-result-name">{displayName}</span>
          )}
          <span className="search-result-time">{timeAgo(post.createdAt)}</span>
        </div>
        <p className="search-result-content">{post.content}</p>
      </div>
    </div>
  );
}