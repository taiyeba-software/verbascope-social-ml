import { useEffect, useState } from 'react';
import { io as socketIO } from 'socket.io-client';
import type { FeedPost } from './PostCard';


export type TrendingTag = {
  tag: string;
  count?: string;
};

export type PostUpdatePayload = {
  postId: string;
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
};

// ── NEW: Weekly Pulse feature ──
// Shape emitted by post.controller.js / share.controller.js over
// io.emit('pulse:update', ...), sourced from pulse.js's getWeeklyPulse()
// Mongo aggregation. Replaces the old in-memory { message, type } signal
// entirely — `topic` is null and `topics` is [] when no posts exist yet
// this week, so components should handle that empty state rather than
// assuming a topic always exists.
export type WeeklyPulse = {
  headline: string | null;
  topic: string | null;
  reason: string | null;

  percentage: number;
  status: string;
  rank: number;

  // ── UPDATED: pulse.js's getWeeklyPulse() also returns these three —
  // Sidebar.tsx reads pulse.postCount/activityLabel/explanation, but this
  // type never had them, so TS should have flagged every usage as an
  // error on an unknown property. (If it didn't, the dev server was
  // serving a stale build — restart it after this change.)
  //
  // postCount and explanation are always set by the backend (0 / the
  // "Quiet" explanation string in the empty-week branch, real values
  // otherwise) — NOT optional, so a missing value stays a visible bug
  // instead of silently typing as undefined.
  // activityLabel is genuinely nullable: it's explicitly null in the
  // empty-week case (no top topic to describe an activity level for).
  postCount: number;
  activityLabel: string | null;
  explanation: string;

  topics: { tag: string; posts: number }[];
};

// ── NEW: VerbaScope AI Signal feature ──
// Shape emitted by post.controller.js's handleMLResult() over
// io.emit('post:ml-analysis', ...).
//
// IMPORTANT: the backend does NOT emit a flat payload. It emits the whole
// saved `mlAnalysis` sub-document nested under a `mlAnalysis` key, using
// the same camelCase field names as the Mongoose schema (riskFlag,
// sarcasmProbability, signalMessage, etc) — NOT snake_case ML Brain names
// like risk_flag / sarcasm_probability. This previously didn't match,
// which is why every field in the old listener read as undefined.
export type PostMLAnalysisPayload = {
  postId: string;
  mlAnalysis: {
    language?: string | null;
    languageConfidence?: number | null;
    sentiment?: string | null;
    sarcasm?: boolean | null;
    sarcasmProbability?: number | null;
    toxicity?: number | null;
    toxicityLevel?: string | null;
    riskFlag?: 'green' | 'yellow' | 'red' | null;
    explanation?: string | null;
    // NEW: single 0–1 "how sure is the model" number, straight from
    // ML Brain's result.confidence -> post.controller.js's
    // mlAnalysis.confidence. Drives the "Confidence" row in the
    // expandable AI Analysis card.
    confidence?: number | null;
    signal?: string | null;
    signalMessage?: string | null;
    analyzedAt?: string | null;
  };
};

/**
 * Connects to the post-service socket and keeps:
 *  - weeklyPulse in sync with the new pulse.getWeeklyPulse() payload (NEW)
 *  - pulseSignal / trendingTags in sync too, derived from the SAME
 *    pulse:update event, so any existing consumer of those two values
 *    (e.g. MobileTrendingBar) keeps working with zero changes and now
 *    gets real weekly-engagement data instead of the old in-memory
 *    "last few minutes" tag counts.
 *  - posts state in sync with live like/comment/share counts from OTHER users
 *  - posts state in sync with ML analysis results as they land, so a post's
 *    "Analyzing..." card flips to a real signal without a refresh
 *
 * setPosts is passed in so this hook can patch counts without owning post state.
 */
export function useFeedSocket(setPosts: React.Dispatch<React.SetStateAction<FeedPost[]>>) {
  const [pulseSignal, setPulseSignal] = useState('');
  const [trendingTags, setTrendingTags] = useState<TrendingTag[]>([]);
  const [weeklyPulse, setWeeklyPulse] = useState<WeeklyPulse | null>(null); // ── NEW

  useEffect(() => {
    const socket = socketIO('http://localhost:3003', {
      withCredentials: true,
    });

    socket.on('connect', () => {
      console.log('🟢 [SOCKET] Connected to post-service:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.error('🔴 [SOCKET] Connection error:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.warn('🟡 [SOCKET] Disconnected:', reason);
    });

    // ── UPDATED: pulse:update now carries the full weekly-pulse object
    // ({ headline, topic, reason, percentage, status, rank, postCount,
    // activityLabel, explanation, topics }), not the old { message, type }
    // in-memory signal. Store it directly AND derive the legacy
    // pulseSignal/trendingTags values from it so nothing else in the app
    // needs to change. ──
    socket.on('pulse:update', (payload: WeeklyPulse) => {
      setWeeklyPulse(payload);
      setPulseSignal(payload.headline ?? '');
      setTrendingTags(
        (payload.topics ?? []).map((t) => ({
          tag: `#${t.tag}`,
          count: `${t.posts} post${t.posts === 1 ? '' : 's'}`,
        }))
      );
    });

    // ── Live post sync: when ANY user likes/comments/shares, everyone's
    // feed updates without a refresh ──
    socket.on('post:update', (payload: PostUpdatePayload) => {
      console.log('🔔 [SOCKET] post:update received:', payload);
      setPosts((cur) =>
        cur.map((post) =>
          post._id === payload.postId
            ? {
                ...post,
                likesCount: payload.likesCount ?? post.likesCount,
                commentsCount: payload.commentsCount ?? post.commentsCount,
                sharesCount: payload.sharesCount ?? post.sharesCount,
              }
            : post
        )
      );
    });

    // ── FIXED: previously read flat/snake_case fields (payload.sentiment,
    // payload.risk_flag, payload.sarcasm_probability, payload.message) that
    // don't exist on the actual payload — the backend sends everything
    // nested under payload.mlAnalysis with camelCase names. That mismatch
    // meant every post silently got mlAnalysis reset to all-null values
    // instead of the real result. ──
    socket.on('post:ml-analysis', (payload: PostMLAnalysisPayload) => {
      console.log('🧠 [SOCKET] post:ml-analysis received:', payload);
      console.log('🧠 payload.mlAnalysis:', payload.mlAnalysis);

      setPosts((cur) =>
        cur.map((post) =>
          post._id === payload.postId
            ? {
                ...post,
                mlAnalysis: {
                  language: payload.mlAnalysis?.language ?? null,
                  languageConfidence: payload.mlAnalysis?.languageConfidence ?? null,
                  sentiment: payload.mlAnalysis?.sentiment ?? null,
                  sarcasm: payload.mlAnalysis?.sarcasm ?? null,
                  sarcasmProbability: payload.mlAnalysis?.sarcasmProbability ?? null,
                  toxicity: payload.mlAnalysis?.toxicity ?? null,
                  toxicityLevel: payload.mlAnalysis?.toxicityLevel ?? null,
                  riskFlag: payload.mlAnalysis?.riskFlag ?? null,
                  explanation: payload.mlAnalysis?.explanation ?? null,
                  // NEW: feeds the "Confidence" row in the AI Analysis
                  // dropdown card.
                  confidence: payload.mlAnalysis?.confidence ?? null,
                  signal: payload.mlAnalysis?.signal ?? null,
                  signalMessage: payload.mlAnalysis?.signalMessage ?? null,
                  analyzedAt: payload.mlAnalysis?.analyzedAt ?? new Date().toISOString(),
                },
              }
            : post
        )
      );
    });

    socket.on('post:deleted', (payload: { postId: string }) => {
      setPosts((cur) => cur.filter((post) => post._id !== payload.postId));
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { pulseSignal, trendingTags, setTrendingTags, weeklyPulse };
}