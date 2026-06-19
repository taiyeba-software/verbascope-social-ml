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

const PULSE_MESSAGES: Record<string, string> = {
  surge: '⚡ Engagement surge detected',
  rising: '📈 Community activity rising',
  active: '🟡 Community is active',
  normal: '🟢 Community is calm',
};

/**
 * Connects to the post-service socket and keeps:
 *  - pulseSignal / trendingTags in sync (existing behavior)
 *  - posts state in sync with live like/comment/share counts from OTHER users
 *
 * setPosts is passed in so this hook can patch counts without owning post state.
 */
export function useFeedSocket(setPosts: React.Dispatch<React.SetStateAction<FeedPost[]>>) {
  const [pulseSignal, setPulseSignal] = useState('');
  const [trendingTags, setTrendingTags] = useState<TrendingTag[]>([]);

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

    socket.on('pulse:update', (signal: { message?: string; type?: string } | string) => {
      setPulseSignal(
        typeof signal === 'string'
          ? signal
          : signal.type
          ? PULSE_MESSAGES[signal.type] ?? signal.message ?? ''
          : signal.message ?? ''
      );
    });

    socket.on('pulse:trending', (tags: TrendingTag[]) => {
      setTrendingTags(tags);
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

    socket.on('post:deleted', (payload: { postId: string }) => {
      setPosts((cur) => cur.filter((post) => post._id !== payload.postId));
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { pulseSignal, trendingTags, setTrendingTags };
}