'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useSearch } from '@/hooks/useSearch';
import { SearchDropdown } from './SearchDropdown';
import type { SearchPost } from '@/types/search';
import './SearchBar.css';

/* ── This replaces the old inline <form className="navbar-search"> block
   in Navbar.tsx. Same markup/classes, so it looks identical — it just now
   also owns debounce, request-cancellation, and the results dropdown. ── */
export default function SearchBar() {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { query, setQuery, results, total, loading, error, open, setOpen, close } = useSearch();
  const [activeIndex, setActiveIndex] = useState(-1);

  /* Reset keyboard selection whenever the result set changes */
  useEffect(() => setActiveIndex(-1), [results]);

  /* Close on outside click — same pattern Navbar already uses for the
     notification dropdown and mobile menu. */
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
    const selectableCount = results.length + (total > 0 ? 1 : 0);

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
        if (activeIndex === -1 || activeIndex === results.length) {
          goToFullResults();
        } else {
          goToPost(results[activeIndex]);
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
          loading={loading}
          error={error}
          activeIndex={activeIndex}
          onSelectPost={goToPost}
          onViewAll={goToFullResults}
        />
      )}
    </div>
  );
}
