'use client';


import type { TrendingTag } from '../../components/feed/useFeedSocket';


const TRENDING_FALLBACK: TrendingTag[] = [
  { tag: '#EmotionalAI' },
  { tag: '#SarcasmDetection' },
  { tag: '#SocialSignals' },
  { tag: '#ToxicitySignals' },
];

export function MobileTrendingBar({ trendingTags }: { trendingTags: TrendingTag[] }) {
  const tags = trendingTags.length > 0 ? trendingTags : TRENDING_FALLBACK;

  return (
    <div className="mobile-trending-bar">
      {tags.map((item) => (
        <button key={item.tag} type="button" className="mobile-trending-chip">
          {item.tag}
        </button>
      ))}
    </div>
  );
}