'use client';

import { useState, useEffect } from 'react';
import type { TrendingTag } from './useFeedSocket';
import { postService, userService } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface RecommendedUser {
  _id: string;
  fullname: { firstName: string; lastName: string };
  sharedInterests: string[];
}

const AVATAR_COLORS = [
  'linear-gradient(135deg, #0e9fab, #17b0bc)',
  'linear-gradient(135deg, #6366f1, #8b5cf6)',
  'linear-gradient(135deg, #f97316, #fb923c)',
  'linear-gradient(135deg, #22c55e, #16a34a)',
  'linear-gradient(135deg, #ef4444, #dc2626)',
];

const avatarColor = (id: string) =>
  AVATAR_COLORS[id.charCodeAt(id.length - 1) % AVATAR_COLORS.length];

const initials = (fullname: { firstName: string; lastName: string }) =>
  `${fullname.firstName[0] ?? ''}${fullname.lastName[0] ?? ''}`.toUpperCase();

const TRENDING_FALLBACK = [
  { tag: '#EmotionalAI',      count: '2.3K posts' },
  { tag: '#SarcasmDetection', count: '2.1K posts' },
  { tag: '#SocialSignals',    count: '1.9K posts' },
  { tag: '#ToxicitySignals',  count: '1.6K posts' },
];

export function Sidebar({
  pulseSignal,
  trendingTags,
}: {
  pulseSignal: string;
  trendingTags: TrendingTag[];
}) {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<RecommendedUser[]>([]);
  const [followingIds, setFollowingIds]       = useState<Set<string>>(new Set());
  const [loadingFollow, setLoadingFollow]     = useState<string | null>(null);
  const [loading, setLoading]                 = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const recRes  = await postService.getRecommendedUsers();
        const recData = recRes.data as {
          success: boolean;
          recommendations: { userId: string; sharedInterests: string[] }[];
        };

        if (!recData.success || recData.recommendations.length === 0) {
          setLoading(false);
          return;
        }

        const ids      = recData.recommendations.map((r) => r.userId);
        const usersRes = await userService.getUsersBulk(ids);
        const usersData = usersRes.data as {
          success: boolean;
          users: { _id: string; fullname: { firstName: string; lastName: string } }[];
        };

        const interestMap = Object.fromEntries(
          recData.recommendations.map((r) => [r.userId, r.sharedInterests])
        );

        const merged: RecommendedUser[] = usersData.users
          .filter((u) => u._id !== user._id)
          .map((u) => ({ ...u, sharedInterests: interestMap[u._id] ?? [] }));

        setRecommendations(merged);

        const followRes  = await userService.getMyFollowing();
        const followData = followRes.data as { success: boolean; following: string[] };
        setFollowingIds(new Set(followData.following.map(String)));
      } catch (err) {
        console.error('[Sidebar] Failed to load recommendations:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const handleToggleFollow = async (targetId: string) => {
    if (loadingFollow) return;
    setLoadingFollow(targetId);
    const isFollowing = followingIds.has(targetId);
    try {
      if (isFollowing) {
        await userService.unfollow(targetId);
        setFollowingIds((prev) => { const n = new Set(prev); n.delete(targetId); return n; });
      } else {
        await userService.follow(targetId);
        setFollowingIds((prev) => new Set(prev).add(targetId));
      }
    } catch (err) {
      console.error('[Sidebar] Follow/unfollow failed:', err);
    } finally {
      setLoadingFollow(null);
    }
  };

  // Split into not-yet-followed (shown first) + already-following
  const unfollowed = recommendations.filter((p) => !followingIds.has(p._id));
  const followed   = recommendations.filter((p) =>  followingIds.has(p._id));
  const displayed  = [...unfollowed, ...followed].slice(0, 5);

  return (
    <aside className="feed-sidebar">

      {/* ── Trending Now ── */}
      <div className="sidebar-card">
        <div className="sidebar-card-header">
          <div className="sidebar-card-icon">🔥</div>
          <h3 className="sidebar-card-title">Trending Now</h3>
        </div>
        {pulseSignal && <div className="pulse-signal-badge">{pulseSignal}</div>}
        <div className="trending-list">
          {(trendingTags.length > 0 ? trendingTags : TRENDING_FALLBACK).map((item) => (
            <div key={item.tag} className="trending-item">
              <span className="trending-dot" />
              <div>
                <div className="trending-tag">{item.tag}</div>
                <div className="trending-count">{item.count}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Who to Follow ── */}
      <div className="sidebar-card">
        <div className="sidebar-card-header">
          <div className="sidebar-card-icon">👥</div>
          <h3 className="sidebar-card-title">Who to Follow</h3>
        </div>

        <div className="follow-list">
          {loading && (
            <div className="follow-loading">Finding people for you...</div>
          )}

          {!loading && recommendations.length === 0 && (
            <div className="follow-empty">
              <div className="follow-empty-icon">🔍</div>
              <div>Like and comment on posts with hashtags to get personalised suggestions.</div>
            </div>
          )}

          {!loading && recommendations.length > 0 && displayed.length === 0 && (
            <div className="follow-empty">
              <div className="follow-empty-icon">✓</div>
              <div>You're following everyone we'd suggest right now.</div>
            </div>
          )}

          {!loading && displayed.map((person) => {
            const isFollowing = followingIds.has(person._id);
            const busy        = loadingFollow === person._id;
            return (
              <div key={person._id} className={`follow-item${isFollowing ? ' follow-item--following' : ''}`}>
                <div className="follow-avatar" style={{ background: avatarColor(person._id) }}>
                  <span style={{
                    color: 'white', fontWeight: 700, fontSize: '0.8rem',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center', width: '100%', height: '100%',
                  }}>
                    {initials(person.fullname)}
                  </span>
                </div>

                <div className="follow-info">
                  <span className="follow-name">
                    {person.fullname.firstName} {person.fullname.lastName}
                  </span>
                  {person.sharedInterests.length > 0 ? (
                    <span className="follow-interests">
                      {person.sharedInterests.map((t) => `#${t}`).join(' ')}
                    </span>
                  ) : (
                    <span className="follow-handle">Suggested for you</span>
                  )}
                </div>

                <button
                  type="button"
                  className={`follow-btn${isFollowing ? ' following' : ''}`}
                  onClick={() => handleToggleFollow(person._id)}
                  disabled={busy}
                >
                  {busy ? '...' : isFollowing ? 'Following' : 'Follow'}
                </button>
              </div>
            );
          })}
        </div>

        {!loading && recommendations.length > 0 && (
          <div className="follow-end-msg">
            {unfollowed.length === 0
              ? "✓ That's all for now — interact with more posts to discover new people"
              : `${unfollowed.length} suggestion${unfollowed.length > 1 ? 's' : ''} based on your interests`}
          </div>
        )}
      </div>

    </aside>
  );
}