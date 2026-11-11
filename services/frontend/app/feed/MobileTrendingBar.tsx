'use client';

import Link from 'next/link';
import type { TrendingTag } from '@/components/feed/useFeedSocket';

/* Horizontal row of trending-topic chips, shown on tablet/phone only
   (.mobile-trending-bar is display:none on desktop — see feed.css).

   UPDATED:
   - No more hard-coded fallback chips (#EmotionalAI, #SarcasmDetection…).
     The feed page now passes the live weekly-pulse topics, the same data as
     the desktop "Trending Now" card, and hides this bar when there are none.
   - Chips are real links to the tag page, so tapping one now navigates. */
export function MobileTrendingBar({ trendingTags }: { trendingTags: TrendingTag[] }) {
  if (!trendingTags?.length) return null;

  return (
    <div className="mobile-trending-bar" aria-label="Trending topics">
      {trendingTags.map(({ tag }) => {
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
          </Link>
        );
      })}
    </div>
  );
}