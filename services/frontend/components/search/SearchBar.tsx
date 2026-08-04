'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useSearch } from '@/hooks/useSearch';
import { SearchDropdown } from './SearchDropdown';
import type { SearchPost, SearchTag } from '@/types/search';
import './SearchBar.css';

export default function SearchBar() {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { query, setQuery, results, total, tags, loading, error, open, setOpen, close } =
    useSearch();
  const [activeIndex, setActiveIndex] = useState(-1);

  /* Reset keyboard selection whenever either result set changes */
  useEffect(() => setActiveIndex(-1), [results, tags]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [close]);

  function goToPost(post: SearchPost) {
    router.push(`/post/${post._id}`);
    close();
  }

  function goToTag(tag: SearchTag) {
    router.push(`/tag/${encodeURIComponent(tag.tag)}`);
    close();
  }

  function goToFullResults() {
    const q = query.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
    close();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    goToFullResults();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // Single flattened order: posts, then tags, then the "view all" row.
    const selectableCount = results.length + tags.length + (total > 0 ? 1 : 0);

    if (!open || selectableCount === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % selectableCount);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + selectableCount) % selectableCount);
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex === -1) {
          goToFullResults();
        } else if (activeIndex < results.length) {
          goToPost(results[activeIndex]);
        } else if (activeIndex < results.length + tags.length) {
          goToTag(tags[activeIndex - results.length]);
        } else {
          goToFullResults();
        }
        break;
      case 'Escape':
        close();
        inputRef.current?.blur();
        break;
      default:
        break;
    }
  }

  return (
    <div className="navbar-search-wrapper" ref={wrapperRef}>
      <form className="navbar-search" onSubmit={handleSubmit} role="search">
        <Search size={16} className="navbar-search-icon" strokeWidth={1.9} />
        <input
          ref={inputRef}
          type="text"
          className="navbar-search-input"
          placeholder="Search posts, people, tags..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setOpen(true)}
          onKeyDown={handleKeyDown}
          aria-label="Search posts, people, tags"
          aria-expanded={open}
          aria-autocomplete="list"
          role="combobox"
        />
        <button type="button" className="navbar-search-filter" aria-label="Search filters">
          <SlidersHorizontal size={15} strokeWidth={1.9} />
        </button>
      </form>

      {open && (
        <SearchDropdown
          query={query.trim()}
          results={results}
          total={total}
          tags={tags}
          loading={loading}
          error={error}
          activeIndex={activeIndex}
          onSelectPost={goToPost}
          onSelectTag={goToTag}
          onViewAll={goToFullResults}
        />
      )}
    </div>
  );
}