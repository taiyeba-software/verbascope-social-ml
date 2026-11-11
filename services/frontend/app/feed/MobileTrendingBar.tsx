'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { postService } from '@/lib/api';
import type { TrendingTag, WeeklyPulse } from '@/components/feed/useFeedSocket';

/* Turns the weekly pulse into chips: the featured topic first, then the
   "Other Topics" with their post counts — the same data and order as the
   desktop "Trending Now" card. Exported so the feed page can use it too. */
export function tagsFromPulse(pulse: WeeklyPulse | null | undefined): TrendingTag[] {
  if (!pulse) return [];

  const tags: TrendingTag[] = [];
  if (pulse.topic) tags.push({ tag: pulse.topic });

  (pulse.topics ?? []).forEach((item) => {
    if (tags.some((t) => t.tag === item.tag)) return;
    tags.push({ tag: item.tag, count: `${item.posts} post${item.posts === 1 ? '' : 's'}` });
  });

  return tags;
}

/* Horizontal row of trending-topic chips, shown on tablet/phone only
   (.mobile-trending-bar is display:none on desktop — see feed.css).

   - No hard-coded placeholder chips any more.
   - Chips are real links to the tag page and show the post count
     ("#collegelife  2 posts").
   - The feed page passes the live topics. If it passes none (e.g. the
     socket hasn't delivered a pulse yet), the bar loads the weekly pulse
     itself — the same request the Sidebar makes — so it is never empty
     just because of timing. */
export function MobileTrendingBar({ trendingTags }: { trendingTags: TrendingTag[] }) {
  const [fetched, setFetched] = useState<TrendingTag[]>([]);
  const hasProvided = (trendingTags?.length ?? 0) > 0;

  useEffect(() => {
    if (hasProvided) return;
    let cancelled = false;

    postService
      .getWeeklyPulse()
      .then((res) => {
        if (cancelled) return;
        const { success, ...data } = res.data;
        if (success) setFetched(tagsFromPulse(data as WeeklyPulse));
      })
      .catch(() => {
        // non-critical — the bar simply stays hidden
      });

    return () => {
      cancelled = true;
    };
  }, [hasProvided]);

  const tags = hasProvided ? trendingTags : fetched;
  if (tags.length === 0) return null;

  return (
    <div className="mobile-trending-bar" aria-label="Trending topics">
      {tags.map(({ tag, count }) => {
        // tags may or may not carry a leading "#" depending on the source
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