'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { postService } from '@/lib/api';
import type { SearchPost } from '@/types/search';

const DEBOUNCE_MS = 300;
const DROPDOWN_RESULT_LIMIT = 6;

interface UseSearchReturn {
  query: string;
  setQuery: (value: string) => void;
  results: SearchPost[];
  total: number;
  loading: boolean;
  error: string | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  close: () => void;
}

export function useSearch(): UseSearchReturn {
  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<SearchPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const close = useCallback(() => setOpen(false), []);

  const runSearch = useCallback((term: string) => {
    // cancel whatever request is still in flight — its response would be
    // stale by the time it resolves anyway
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    postService
      .search(term, { limit: DROPDOWN_RESULT_LIMIT, signal: controller.signal })
      .then((res) => {
        setResults(res.data.results);
        setTotal(res.data.total);
        setOpen(true);
      })
      .catch((err) => {
        // ApiClient's response interceptor rewrites every error into a
        // plain { status, statusText, message, code, data } object before
        // it reaches here — so a cancelled request shows up as
        // code 'ERR_CANCELED' (axios's cancellation code), not a real
        // Error with name 'AbortError'. Ignore it: it's just superseded
        // by a newer keystroke, not a real failure.
        if (err?.code === 'ERR_CANCELED') return;
        setError('Something went wrong. Try again.');
        setResults([]);
        setTotal(0);
        setOpen(true);
      })
      .finally(() => {
        if (abortRef.current === controller) {
          setLoading(false);
        }
      });
  }, []);

  const setQuery = useCallback(
    (value: string) => {
      setQueryState(value);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      const trimmed = value.trim();

      if (!trimmed) {
        // empty query: cancel everything, clear results, close dropdown
        abortRef.current?.abort();
        setResults([]);
        setTotal(0);
        setError(null);
        setLoading(false);
        setOpen(false);
        return;
      }

      debounceRef.current = setTimeout(() => runSearch(trimmed), DEBOUNCE_MS);
    },
    [runSearch]
  );

  // clean up on unmount — don't let a stray timer or request outlive the component
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  return { query, setQuery, results, total, loading, error, open, setOpen, close };
}