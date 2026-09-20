'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { postService } from '@/lib/api';
import './CommunityInsights.css';

/* ──────────────────────────────────────────────────────────
   Community Insights — shared config, widget and banner.

   Lives in its own file so the SAME widget can be rendered in the
   desktop <Sidebar /> and inline in the mobile feed (inside a
   `mobile-only` wrapper), and so app/feed/page.tsx can reuse the
   labels/icons/copy without importing from Sidebar.

   `reason` values are the keys stored in Post.shareReasons by the
   backend (see VALID_REASONS in share.controller.js) — snake_case.
   ────────────────────────────────────────────────────────── */

export const INSIGHTS = [
  {
    slug: 'needs-attention',
    reason: 'needs_attention',
    label: 'Needs Attention',
    icon: '🚨',
    bannerText: 'Showing posts from this week frequently marked by the community.',
    emptyTitle: 'No posts need attention',
    emptyText: 'Nothing has been marked by the community this week.',
  },
  {
    slug: 'educational',
    reason: 'educational',
    label: 'Educational',
    icon: '📚',
    bannerText: 'Showing posts from this week the community found educational.',
    emptyTitle: 'No Educational posts yet',
    emptyText: 'Be the first to share one with the community.',
  },
  {
    slug: 'concerning',
    reason: 'concerning',
    label: 'Concerning',
    icon: '⚠️',
    bannerText: 'Showing posts from this week the community found concerning.',
    emptyTitle: 'No Concerning posts this week',
    emptyText: 'Nothing has been marked as concerning right now.',
  },
  {
    slug: 'funny',
    reason: 'funny',
    label: 'Funny',
    icon: '😄',
    bannerText: 'Showing posts from this week the community found funny.',
    emptyTitle: 'No Funny posts yet',
    emptyText: 'Be the first to share one with the community.',
  },
] as const;

export type Insight = (typeof INSIGHTS)[number];

/** Returns the matching insight for a URL slug, or null for unknown/missing. */
export const findInsight = (slug?: string | null): Insight | null =>
  INSIGHTS.find((insight) => insight.slug === slug) ?? null;

/* ── Summary loading ──
   The widget can be mounted twice (desktop sidebar + mobile inline), so
   the request is shared through a small module-level cache: any number of
   instances trigger a single network call per 30 seconds. */

type Summary = Record<string, number>;

const SUMMARY_TTL_MS = 30_000;
let summaryCache: { at: number; promise: Promise<Summary> } | null = null;

const loadSummary = (): Promise<Summary> => {
  if (!summaryCache || Date.now() - summaryCache.at > SUMMARY_TTL_MS) {
    const promise = postService
      .getCommunitySignalsSummary()
      .then((res) => res.data.summary ?? {})
      .catch(() => {
        summaryCache = null; // let the next mount retry
        return {} as Summary;
      });
    summaryCache = { at: Date.now(), promise };
  }
  return summaryCache.promise;
};

/* ── Widget ── */

export function CommunityInsights({
  activeSlug = null,
  compact = false,
}: {
  /** Slug currently applied to the feed, so its row can be highlighted. */
  activeSlug?: string | null;
  /** Compact 2×2 layout for the mobile inline version. */
  compact?: boolean;
}) {
  const [summary, setSummary] = useState<Summary>({});
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSummary().then((data) => {
      if (cancelled) return;
      setSummary(data);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="sidebar-card community-insights">
      <div className="sidebar-card-header">
        <div className="sidebar-card-icon">🌐</div>
        <h3 className="sidebar-card-title">Community Insights</h3>
        <span className="insight-window">This week</span>
      </div>

      <nav
        aria-label="Community Insights"
        className={`insight-list${compact ? ' insight-list--compact' : ''}`}
      >
        {INSIGHTS.map(({ slug, reason, label, icon }) => {
          const count    = summary[reason] || 0;
          const isActive = activeSlug === slug;
          const noun     = compact ? 'mark' : 'community mark';
          return (
            <Link
              key={slug}
              href={`/feed?signal=${slug}`}
              className={`insight-row${isActive ? ' insight-row--active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="insight-icon" aria-hidden="true">{icon}</span>
              <span className="insight-text">
                <span className="insight-label">{label}</span>
                <span className="insight-count">
                  {loaded ? `${count} ${noun}${count === 1 ? '' : 's'}` : '…'}
                </span>
              </span>
              <span className="insight-chevron" aria-hidden="true">›</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/* ── Banner shown above the feed while a filter is active ── */

export function InsightBanner({ insight }: { insight: Insight }) {
  return (
    <div className="insight-banner" role="status">
      <div className="insight-banner-text">
        <div className="insight-banner-title">
          {insight.icon} {insight.label} Posts
        </div>
        <div className="insight-banner-desc">{insight.bannerText}</div>
      </div>
      <Link href="/feed" className="insight-banner-clear">
        Clear Filter ✕
      </Link>
    </div>
  );
}