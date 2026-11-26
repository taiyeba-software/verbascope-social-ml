import { useCallback, useEffect, useRef, useState } from 'react';
import { io as socketIO } from 'socket.io-client';
import type { FeedPost } from './PostCard';
import { tokenStorage, postService } from '@/lib/api';
import type { NetworkPulse } from '@/types';

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

// ── VerbaScope AI Signal feature ──
// Shape emitted by post.controller.js's handleMLResult() over
// io.emit('post:ml-analysis', ...).
//
// IMPORTANT: the backend does NOT emit a flat payload. It emits the whole
// saved `mlAnalysis` sub-document nested under a `mlAnalysis` key, using
// the same camelCase field names as the Mongoose schema (riskFlag,
// sarcasmProbability, signalMessage, etc) — NOT snake_case ML Brain names
// like risk_flag / sarcasm_probability.
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
    confidence?: number | null;
    signal?: string | null;
    signalMessage?: string | null;
    analyzedAt?: string | null;
  };
};

// How long to wait after a 'network-pulse:update' event before refetching.
// Every post created/deleted by ANYONE triggers the event for every
// connected client, so bursts are collapsed into a single request.
const NETWORK_PULSE_REFETCH_DELAY_MS = 1500;

/**
 * Connects to the post-service socket and keeps:
 *  - networkPulse: the user's PERSONALIZED Network Pulse (topics their
 *    network posts about, last 30 days). It is fetched from
 *    GET /api/posts/pulse/trending on mount, and re-fetched (debounced)
 *    whenever the server emits 'network-pulse:update'. The event carries
 *    no payload on purpose: the data is different for every user, so each
 *    client asks for its own.
 *  - posts state in sync with live like/comment/share counts from OTHER users
 *  - posts state in sync with ML analysis results as they land
 *
 * setPosts is passed in so this hook can patch counts without owning post state.
 *
 * auth.token is verified by post-service's Socket.IO handshake
 * middleware — same JWT the HTTP requests send as a Bearer header.
 */
export function useFeedSocket(setPosts: React.Dispatch<React.SetStateAction<FeedPost[]>>) {
  const [networkPulse, setNetworkPulse] = useState<NetworkPulse | null>(null);
  const [networkPulseLoading, setNetworkPulseLoading] = useState(true);
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchNetworkPulse = useCallback(async () => {
    try {
      const res = await postService.getNetworkPulse();
      const { success, ...data } = res.data;
      if (success) setNetworkPulse(data);
    } catch (err) {
      // Non-critical: the sidebar just shows its empty state.
      console.error('[useFeedSocket] Failed to load Network Pulse:', err);
    } finally {
      setNetworkPulseLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchNetworkPulse();
  }, [fetchNetworkPulse]);

  useEffect(() => {
    const socket = socketIO(
      process.env.NEXT_PUBLIC_POST_API_URL || 'http://localhost:3003',
      { withCredentials: true, auth: { token: tokenStorage.get() } }
    );

    socket.on('connect', () => {
      console.log('🟢 [SOCKET] Connected to post-service:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.error('🔴 [SOCKET] Connection error:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.warn('🟡 [SOCKET] Disconnected:', reason);
    });

    // ── Network Pulse: the server only says "something changed" (a post
    // was created or deleted). Debounce, then refetch this user's own data. ──
    socket.on('network-pulse:update', () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = setTimeout(() => {
        fetchNetworkPulse();
      }, NETWORK_PULSE_REFETCH_DELAY_MS);
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

    // The backend sends everything nested under payload.mlAnalysis with
    // camelCase names.
    socket.on('post:ml-analysis', (payload: PostMLAnalysisPayload) => {
      console.log('🧠 [SOCKET] post:ml-analysis received:', payload);

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
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { networkPulse, networkPulseLoading };
}