'use client';

import { SearchResultItem } from './SearchResultItem';
import type { SearchPost } from '@/types/search';

interface SearchDropdownProps {
  query: string;
  results: SearchPost[];
  total: number;
  loading: boolean;
  error: string | null;
  activeIndex: number;
  onSelectPost: (post: SearchPost) => void;
  onViewAll: () => void;
}

export function SearchDropdown({
  query,
  results,
  total,
  loading,
  error,
  activeIndex,
  onSelectPost,
  onViewAll,
}: SearchDropdownProps) {
  return (
    <div className="search-dropdown" role="listbox">
      {loading && results.length === 0 && (
        <div className="search-dropdown-loading">
          <span className="search-spinner" />
          Searching…
        </div>
      )}

      {!loading && error && <div className="search-dropdown-error">{error}</div>}

      {!loading && !error && results.length === 0 && (
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

      {!loading && total > 0 && (
        <button
          type="button"
          className={`search-view-all${activeIndex === results.length ? ' active' : ''}`}
          onClick={onViewAll}
        >
          View all {total} results →
        </button>
      )}
    </div>
  );
}
