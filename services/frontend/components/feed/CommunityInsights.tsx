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

   Covers every share reason from the "Why are you passing this forward?"
   sheet (same order). `reason` values are the keys stored in
   Post.shareReasons by the backend (VALID_REASONS in
   share.controller.js) — snake_case. `slug` is the URL value and must
   match SIGNAL_MAP in share.controller.js.

   UPDATED: both the summary this widget displays and the filtered feed
   behind each row are now scoped to the current user's own posts plus
   everyone they follow (see getVisibleAuthors on the backend), so the
   sidebar and the main feed tell one consistent story instead of the
   sidebar surfacing marks from strangers the user has never seen post.
   ────────────────────────────────────────────────────────── */

export const INSIGHTS = [
  {
    slug: 'needs-attention',
    reason: 'needs_attention',
    label: 'Needs Attention',
    icon: '🚨',
    bannerTitle: 'Needs Attention Posts',
    bannerText: 'Showing posts from this week frequently marked by the community.',
    emptyTitle: 'No posts need attention',
    emptyText: 'Nothing has been marked by the community this week.',
  },
  {
    slug: 'agree',
    reason: 'agree',
    label: 'I Agree',
    icon: '✅',
    bannerTitle: 'Posts the Community Agrees With',
    bannerText: 'Showing posts from this week the community agreed with.',
    emptyTitle: 'No agreed-with posts yet',
    emptyText: 'Nothing has been marked "I agree" this week.',
  },
  {
    slug: 'funny',
    reason: 'funny',
    label: 'Funny',
    icon: '😄',
    bannerTitle: 'Funny Posts',
    bannerText: 'Showing posts from this week the community found funny.',
    emptyTitle: 'No Funny posts yet',
    emptyText: 'Be the first to share one with the community.',
  },
  {
    slug: 'insightful',
    reason: 'insightful',
    label: 'Insightful',
    icon: '💡',
    bannerTitle: 'Insightful Posts',
    bannerText: 'Showing posts from this week the community found insightful.',
    emptyTitle: 'No Insightful posts yet',
    emptyText: 'Be the first to share one with the community.',
  },
  {
    slug: 'concerning',
    reason: 'concerning',
    label: 'Concerning',
    icon: '⚠️',
    bannerTitle: 'Concerning Posts',
    bannerText: 'Showing posts from this week the community found concerning.',
    emptyTitle: 'No Concerning posts this week',
    emptyText: 'Nothing has been marked as concerning right now.',
  },
  {
    slug: 'educational',
    reason: 'educational',
    label: 'Educational',
    icon: '📚',
    bannerTitle: 'Educational Posts',
    bannerText: 'Showing posts from this week the community found educational.',
    emptyTitle: 'No Educational posts yet',
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
  /** Compact 2-column layout for the mobile inline version. */
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

  // Only categories that actually have community marks this week are shown.
  // The currently-applied filter is always kept visible so the user can
  // still see where they are (and switch away) even if its count is 0.
  const visible = INSIGHTS.filter(
    ({ slug, reason }) => (summary[reason] || 0) > 0 || slug === activeSlug
  );

  return (
    <div className="sidebar-card community-insights">
      <div className="sidebar-card-header">
        <div className="sidebar-card-icon">🌐</div>
        <h3 className="sidebar-card-title">Community Insights</h3>
        <span className="insight-window">This week</span>
      </div>

      {/* ── NEW: clarifies scope now that this is follow-based, not
          platform-wide — avoids the sidebar and feed telling two
          different stories. ── */}
      <div className="insight-subtitle">From people you follow</div>

      {!loaded ? (
        <div className="follow-loading">Loading insights...</div>
      ) : visible.length === 0 ? (
        <div className="follow-empty">
          <div className="follow-empty-icon">🌐</div>
          <div>No marks yet this week from people you follow. Share a post with a reason to get things started.</div>
        </div>
      ) : (
        <nav
          aria-label="Community Insights"
          className={`insight-list${compact ? ' insight-list--compact' : ''}`}
        >
          {visible.map(({ slug, reason, label, icon }) => {
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
                    {`${count} ${noun}${count === 1 ? '' : 's'}`}
                  </span>
                </span>
                <span className="insight-chevron" aria-hidden="true">›</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

/* ── Banner shown above the feed while a filter is active ── */

export function InsightBanner({ insight }: { insight: Insight }) {
  return (
    <div className="insight-banner" role="status">
      <div className="insight-banner-text">
        <div className="insight-banner-title">
          {insight.icon} {insight.bannerTitle}
        </div>
        <div className="insight-banner-desc">{insight.bannerText}</div>
      </div>
      <Link href="/feed" className="insight-banner-clear">
        Clear Filter ✕
      </Link>
    </div>
  );
}