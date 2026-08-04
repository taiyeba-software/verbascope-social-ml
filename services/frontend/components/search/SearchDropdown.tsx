'use client';

import { SearchResultItem } from './SearchResultItem';
import { TagResultItem } from './TagResultItem';
import type { SearchPost, SearchTag } from '@/types/search';

interface SearchDropdownProps {
  query: string;
  results: SearchPost[];
  total: number;
  tags: SearchTag[];
  loading: boolean;
  error: string | null;
  activeIndex: number;
  onSelectPost: (post: SearchPost) => void;
  onSelectTag: (tag: SearchTag) => void;
  onViewAll: () => void;
}

export function SearchDropdown({
  query,
  results,
  total,
  tags,
  loading,
  error,
  activeIndex,
  onSelectPost,
  onSelectTag,
  onViewAll,
}: SearchDropdownProps) {
  const hasAnyResults = results.length > 0 || tags.length > 0;

  return (
    <div className="search-dropdown" role="listbox">
      {loading && !hasAnyResults && (
        <div className="search-dropdown-loading">
          <span className="search-spinner" />
          Searching…
        </div>
      )}

      {!loading && error && <div className="search-dropdown-error">{error}</div>}

      {!loading && !error && !hasAnyResults && (
        <div className="search-dropdown-empty">
          No results for <strong>&ldquo;{query}&rdquo;</strong>
        </div>
      )}

      {results.length > 0 && (
        <ul className="search-result-list">
          {results.map((post, index) => (
            <li key={post._id}>
              <SearchResultItem
                post={post}
                active={index === activeIndex}
                onSelect={onSelectPost}
              />
            </li>
          ))}
        </ul>
      )}

      {tags.length > 0 && (
        <>
          <div className="search-section-label">Tags</div>
          <ul className="search-result-list">
            {tags.map((tag, index) => (
              <li key={tag.tag}>
                <TagResultItem
                  tag={tag}
                  active={results.length + index === activeIndex}
                  onSelect={onSelectTag}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {!loading && total > 0 && (
        <button
          type="button"
          className={`search-view-all${
            activeIndex === results.length + tags.length ? ' active' : ''
          }`}
          onClick={onViewAll}
        >
          View all {total} results →
        </button>
      )}
    </div>
  );
}