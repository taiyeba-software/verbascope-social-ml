'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { getPostsByTag } from '@/lib/api/search';
import type { SearchPost } from '@/types/search';
import { timeAgo } from '@/components/feed/feedHelpers';
import './tag-page.css';

const PAGE_LIMIT = 20;

// Meilisearch stores createdAt as a number; timeAgo expects a date string.
// Handles both seconds and milliseconds timestamps.
const toIso = (n?: number) => {
  if (!n) return undefined;
  return new Date(n < 1e12 ? n * 1000 : n).toISOString();
};

const initials = (name?: string) =>
  (name ?? '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const cleanTag = (t: string) => t.replace(/^#/, '').toLowerCase();

export default function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag: rawTag } = use(params);
  const router = useRouter();

  // URL params arrive encoded (e.g. non-English tags) — decode safely.
  let tag = rawTag;
  try {
    tag = decodeURIComponent(rawTag);
  } catch {
    /* keep raw value */
  }
  tag = cleanTag(tag);

  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New tag → reset the list.
  useEffect(() => {
    setPosts([]);
    setTotal(0);
    setOffset(0);
    setError(null);
    setLoading(true);
  }, [tag]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getPostsByTag(tag, { limit: PAGE_LIMIT, offset })
      .then((res) => {
        if (cancelled) return;
        const results = res.results;
        setPosts((prev) => (offset === 0 ? results : [...prev, ...results]));
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

  const openPost = (id: string) => router.push(`/post/${id}`);

  return (
    <div className="tag-page-shell">
      <Navbar />

      <main className="tag-page-main">
        <div className="tag-page-header">
          <button type="button" className="tag-page-back-btn" onClick={() => router.back()} aria-label="Go back">
            ←
          </button>
          <div className="tag-page-heading">
            <h1 className="tag-page-title">#{tag}</h1>
            <p className="tag-page-count">
              {total} {total === 1 ? 'post' : 'posts'}
            </p>
          </div>
        </div>

        {error && <div className="tag-page-error">{error}</div>}

        <div className="tag-page-list">
          {posts.map((post) => {
            const postTags = post.tags ?? [];
            return (
              <article
                key={post._id}
                className="tag-page-card"
                onClick={() => openPost(post._id)}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') openPost(post._id);
                }}
              >
                <div className="tag-page-author-row">
                  <div className="tag-page-avatar">
                    {post.authorAvatar ? (
                      <img src={post.authorAvatar} alt={post.authorName} />
                    ) : (
                      initials(post.authorName)
                    )}
                  </div>
                  <div>
                    <div className="tag-page-author">{post.authorName}</div>
                    <div className="tag-page-time">{timeAgo(toIso(post.createdAt))}</div>
                  </div>
                </div>
                <p className="tag-page-content">{post.content}</p>

                {postTags.length > 0 && (
                  <div className="tag-page-chips">
                    {postTags.map((t) => (
                      <Link
                        key={t}
                        href={`/tag/${encodeURIComponent(cleanTag(t))}`}
                        className={`tag-page-chip${cleanTag(t) === tag ? ' active' : ''}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t.replace(/^#/, '')}
                      </Link>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {loading && <div className="tag-page-loading">Loading…</div>}

        {!loading && !error && posts.length === 0 && (
          <div className="tag-page-empty">
            <div className="tag-page-empty-icon">🔍</div>
            <div className="tag-page-empty-title">No posts with #{tag} yet</div>
          </div>
        )}

        {!loading && posts.length > 0 && posts.length < total && (
          <button
            type="button"
            className="tag-page-load-more"
            onClick={() => setOffset((prev) => prev + PAGE_LIMIT)}
          >
            Load more
          </button>
        )}
      </main>
    </div>
  );
}