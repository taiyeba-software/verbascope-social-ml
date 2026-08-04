'use client';

import { useEffect, useState, use } from 'react';
import { getPostsByTag } from '@/lib/api/search';
import type { SearchPost } from '@/types/search';

const PAGE_LIMIT = 20;

export default function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = use(params);

  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPosts([]);
    setOffset(0);
    setError(null);
  }, [tag]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getPostsByTag(tag, { limit: PAGE_LIMIT, offset })
      .then((res) => {
        if (cancelled) return;
        setPosts((prev) => (offset === 0 ? res.results : [...prev, ...res.results]));
        setTotal(res.total);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load posts for this tag.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tag, offset]);

  return (
    <div className="tag-page">
      <h1 className="tag-page-title">#{tag}</h1>
      <p className="tag-page-count">{total} posts</p>

      {error && <div className="tag-page-error">{error}</div>}

      <div className="tag-page-list">
        {posts.map((post) => (
          <div key={post._id} className="tag-page-card">
            <div className="tag-page-author">{post.authorName}</div>
            <p className="tag-page-content">{post.content}</p>
          </div>
        ))}
      </div>

      {loading && <div className="tag-page-loading">Loading…</div>}

      {!loading && posts.length < total && (
        <button
          type="button"
          className="tag-page-load-more"
          onClick={() => setOffset((prev) => prev + PAGE_LIMIT)}
        >
          Load more
        </button>
      )}
    </div>
  );
}