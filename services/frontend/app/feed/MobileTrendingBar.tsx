'use client';

import Link from 'next/link';
import type { TrendingTag } from '@/components/feed/useFeedSocket';
import type { NetworkPulse } from '@/types';

/* Turns the Network Pulse into chips: the most active topic first, then
   "Other Topics" — the same data and order as the desktop "Your Network
   Pulse" card. Exported so the feed page can build the chips from the
   single networkPulse value it gets from useFeedSocket. */
export function tagsFromNetworkPulse(pulse: NetworkPulse | null | undefined): TrendingTag[] {
  if (!pulse) return [];

  const topics = [...(pulse.mostActive ? [pulse.mostActive] : []), ...(pulse.others ?? [])];

  return topics.map((item) => ({
    tag: item.topic,
    count: `${item.postCount} post${item.postCount === 1 ? '' : 's'}`,
  }));
}

/* Horizontal row of Network Pulse topic chips, shown on tablet/phone only
   (.mobile-trending-bar is display:none on desktop — see feed.css).

   It no longer fetches anything itself: the feed page passes the same
   data the desktop sidebar uses, so mobile and desktop can never show
   different meanings. Hides itself when there is nothing to show. */
export function MobileTrendingBar({ trendingTags }: { trendingTags: TrendingTag[] }) {
  if (!trendingTags || trendingTags.length === 0) return null;

  return (
    <div className="mobile-trending-bar" aria-label="Your network pulse topics">
      {trendingTags.map(({ tag, count }) => {
        const clean = tag.replace(/^#/, '');
        return (
          <Link
            key={clean}
            href={`/tag/${encodeURIComponent(clean)}`}
            className="mobile-trending-chip"
            style={{ textDecoration: 'none' }}
          >
            #{clean}
            {count && (
              <span style={{ marginLeft: 6, fontSize: '0.72rem', fontWeight: 500, opacity: 0.7 }}>
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}