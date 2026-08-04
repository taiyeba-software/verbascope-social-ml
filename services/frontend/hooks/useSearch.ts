'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { postService } from '@/lib/api';
import { searchTags as searchTagsApi } from '@/lib/api/search';
import type { SearchPost, SearchTag } from '@/types/search';

const DEBOUNCE_MS = 300;
const DROPDOWN_RESULT_LIMIT = 6;
const DROPDOWN_TAG_LIMIT = 5;

interface UseSearchReturn {
  query: string;
  setQuery: (value: string) => void;
  results: SearchPost[];
  total: number;
  tags: SearchTag[];
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
  const [tags, setTags] = useState<SearchTag[]>([]);
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

    Promise.all([
      postService.search(term, { limit: DROPDOWN_RESULT_LIMIT, signal: controller.signal }),
      searchTagsApi(term, { limit: DROPDOWN_TAG_LIMIT, signal: controller.signal }),
    ])
      .then(([postsRes, tagsRes]) => {
        setResults(postsRes.data.results);
        setTotal(postsRes.data.total);
        setTags(tagsRes.results);
        setOpen(true);
      })
      .catch((err) => {
        // postService.search (axios) reports cancellation as
        // code 'ERR_CANCELED'; searchTagsApi (plain fetch) reports it as
        // a DOMException with name 'AbortError'. Either can be the one
        // that rejects first inside Promise.all — ignore both, they're
        // just superseded by a newer keystroke, not a real failure.
        if (err?.code === 'ERR_CANCELED' || err?.name === 'AbortError') return;
        setError('Something went wrong. Try again.');
        setResults([]);
        setTotal(0);
        setTags([]);
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
        abortRef.current?.abort();
        setResults([]);
        setTotal(0);
        setTags([]);
        setError(null);
        setLoading(false);
        setOpen(false);
        return;
      }

      debounceRef.current = setTimeout(() => runSearch(trimmed), DEBOUNCE_MS);
    },
    [runSearch]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  return { query, setQuery, results, total, tags, loading, error, open, setOpen, close };
}