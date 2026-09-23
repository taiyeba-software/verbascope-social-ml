'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { io, type Socket } from 'socket.io-client';
import { postService, tokenStorage } from '@/lib/api';
import './CommunityInsights.css';

/* ──────────────────────────────────────────────────────────
   Community Insights — shared config, widget and banner.
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

export const findInsight = (slug?: string | null): Insight | null =>
  INSIGHTS.find((insight) => insight.slug === slug) ?? null;

/* ── Summary loading ──
   Shared cache so multiple mounted instances (desktop + mobile) share
   one network request. `loadSummary(force)` lets a real-time event
   bypass the TTL and refetch immediately instead of waiting up to 30s. */

type Summary = Record<string, number>;

const SUMMARY_TTL_MS = 30_000;
let summaryCache: { at: number; promise: Promise<Summary> } | null = null;

const subscribers = new Set<(data: Summary) => void>();

const loadSummary = (force = false): Promise<Summary> => {
  if (force || !summaryCache || Date.now() - summaryCache.at > SUMMARY_TTL_MS) {
    const promise = postService
      .getCommunitySignalsSummary()
      .then((res) => {
        const data = res.data.summary ?? {};
        subscribers.forEach((cb) => cb(data));
        return data;
      })
      .catch(() => {
        summaryCache = null;
        return {} as Summary;
      });
    summaryCache = { at: Date.now(), promise };
  }
  return summaryCache.promise;
};

/* ── Real-time refresh ──
   Community Insights can't be broadcast as shared data the way
   pulse:update is — each user's summary is scoped to their own
   following list, so there's no single payload to hand everyone.
   Instead the backend emits a plain "something changed" signal after
   a share/unshare that moves a reason count (see
   broadcastCommunityInsightsUpdate in share.controller.js), and every
   connected client refetches its OWN scoped summary in response.

   A single module-level socket connection is shared across every
   mounted CommunityInsights instance (desktop sidebar + mobile inline).

   FIXED: this connection previously omitted `auth.token`. This app's
   Socket.IO servers require a Bearer token at handshake time (see
   Architecture_Cookie_to_JWT.md, Step 5) and reject any connection
   missing one via server-side io.use(...) middleware — so this socket
   was never actually joining the server at all, for ANY client,
   including the sharer's own tab. The sharer only ever appeared to see
   "real-time" updates because a full page reload after sharing
   triggers a fresh HTTP fetch independent of the socket. A follower's
   tab, with no reload, just stayed on stale data forever — which is
   exactly the reported symptom ("only the sharer sees the update"). */
let insightsSocket: Socket | null = null;
let insightsSocketRefCount = 0;

const getInsightsSocket = (): Socket => {
  if (!insightsSocket) {
    const url = process.env.NEXT_PUBLIC_POST_API_URL || 'http://localhost:3003';
    insightsSocket = io(url, { auth: { token: tokenStorage.get() } });

    insightsSocket.on('connect', () => {
      console.log('[CommunityInsights] socket connected', insightsSocket?.id);
    });
    insightsSocket.on('connect_error', (err) => {
      console.log('[CommunityInsights] socket error:', err.message);
    });
    insightsSocket.on('community-insights:update', () => {
      loadSummary(true);
    });
  }
  insightsSocketRefCount += 1;
  return insightsSocket;
};

const releaseInsightsSocket = () => {
  insightsSocketRefCount = Math.max(0, insightsSocketRefCount - 1);
  if (insightsSocketRefCount === 0 && insightsSocket) {
    insightsSocket.disconnect();
    insightsSocket = null;
  }
};

/* ── Widget ── */

export function CommunityInsights({
  activeSlug = null,
  compact = false,
}: {
  activeSlug?: string | null;
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

    const onUpdate = (data: Summary) => {
      if (cancelled) return;
      setSummary(data);
    };
    subscribers.add(onUpdate);
    getInsightsSocket();

    return () => {
      cancelled = true;
      subscribers.delete(onUpdate);
      releaseInsightsSocket();
    };
  }, []);

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