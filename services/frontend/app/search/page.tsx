'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search as SearchIcon } from 'lucide-react';
import { postService } from '@/lib/api';
import type { SearchPost } from '@/types/search';
import './search.css';

const PAGE_SIZE = 10;

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase() || 'U';
}

function timeAgo(epochMs: number): string {
  const diffMs = Date.now() - epochMs;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const week = Math.floor(day / 7);
  return `${week}w ago`;
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [inputValue, setInputValue] = useState(searchParams.get('q') ?? '');
  const [results, setResults] = useState<SearchPost[]>([]);
  const [total, setTotal] = useState(0);
  const [processingTimeMs, setProcessingTimeMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offsetRef = useRef(0);
  const activeQueryRef = useRef('');

  const fetchResults = useCallback((q: string, offset: number, append: boolean) => {
    if (!q.trim()) {
      setResults([]);
      setTotal(0);
      return;
    }

    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);

    postService
      .search(q.trim(), { limit: PAGE_SIZE, offset })
      .then((res) => {
        setResults((prev) => (append ? [...prev, ...res.data.results] : res.data.results));
        setTotal(res.data.total);
        setProcessingTimeMs(res.data.processingTimeMs ?? null);
        offsetRef.current = offset + res.data.results.length;
      })
      .catch(() => {
        setError('Something went wrong loading search results.');
      })
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  }, []);

  // Re-run whenever ?q= changes — e.g. navigated here from the navbar dropdown,
  // or the person edits the query in this page's own search bar.
  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    setInputValue(q);
    activeQueryRef.current = q;
    offsetRef.current = 0;
    fetchResults(q, 0, false);
  }, [searchParams, fetchResults]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = inputValue.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  function handleLoadMore() {
    fetchResults(activeQueryRef.current, offsetRef.current, true);
  }

  const query = searchParams.get('q') ?? '';
  const hasMore = results.length < total;

  return (
    <div className="search-page">
      <form className="search-page-bar" onSubmit={handleSubmit} role="search">
        <SearchIcon size={18} className="search-page-bar-icon" strokeWidth={1.9} />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Search posts, people, tags..."
          className="search-page-bar-input"
          aria-label="Search"
        />
      </form>

      {query && !loading && !error && (
        <div className="search-page-meta">
          {total} result{total === 1 ? '' : 's'} for <strong>&ldquo;{query}&rdquo;</strong>
          {processingTimeMs != null && (
            <span className="search-page-meta-time"> · {processingTimeMs}ms</span>
          )}
        </div>
      )}

      {loading && (
        <div className="search-page-status">
          <span className="search-spinner" />
          Searching…
        </div>
      )}

      {!loading && error && <div className="search-page-error">{error}</div>}

      {!loading && !error && query && results.length === 0 && (
        <div className="search-page-empty">
          No results for <strong>&ldquo;{query}&rdquo;</strong>. Try a different search term.
        </div>
      )}

      {!loading && !error && !query && (
        <div className="search-page-empty">Type a search term above to get started.</div>
      )}

      {!loading && !error && results.length > 0 && (
        <ul className="search-page-results">
          {results.map((post) => (
            <li key={post._id}>
              <button
                type="button"
                className="search-page-card"
                onClick={() => router.push(`/post/${post._id}`)}
              >
                <div className="search-page-card-avatar">
                  {initialsFromName(post.authorName || 'Unknown')}
                </div>
                <div className="search-page-card-body">
                  <div className="search-page-card-top">
                    <span className="search-page-card-name">{post.authorName || 'Unknown'}</span>
                    <span className="search-page-card-time">{timeAgo(post.createdAt)}</span>
                  </div>
                  <p className="search-page-card-content">{post.content}</p>
                  {post.tags && post.tags.length > 0 && (
                    <div className="search-page-card-tags">
                      {post.tags.map((tag) => (
                        <span key={tag} className="search-page-card-tag">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && hasMore && (
        <button
          type="button"
          className="search-page-load-more"
          onClick={handleLoadMore}
          disabled={loadingMore}
        >
          {loadingMore ? 'Loading…' : 'Load more results'}
        </button>
      )}
    </div>
  );
}

/* useSearchParams requires a Suspense boundary in the App Router */
export default function SearchPage() {
  return (
    <Suspense fallback={<div className="search-page-status">Loading…</div>}>
      <SearchPageContent />
    </Suspense>
  );
}