'use client';

import { useState, useEffect } from 'react';
import type { WeeklyPulse } from './useFeedSocket';
import { postService, userService } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { CommunityInsights } from '@/components/feed/CommunityInsights';

interface RecommendedUser {
  _id: string;
  fullname: { firstName: string; lastName: string };
  avatar?: string;
  headline?: string;
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

export function Sidebar({
  weeklyPulse,
  activeInsight = null,
}: {
  weeklyPulse: WeeklyPulse | null;
  activeInsight?: string | null;
}) {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<RecommendedUser[]>([]);
  const [followingIds, setFollowingIds]       = useState<Set<string>>(new Set());
  const [loadingFollow, setLoadingFollow]     = useState<string | null>(null);
  const [loading, setLoading]                 = useState(true);

  const [initialPulse, setInitialPulse] = useState<WeeklyPulse | null>(null);
  const [pulseLoading, setPulseLoading] = useState(true);
  const pulse = weeklyPulse ?? initialPulse;

  useEffect(() => {
    let cancelled = false;
    postService.getWeeklyPulse()
      .then((res) => {
        if (cancelled) return;
        const { success, ...data } = res.data;
        if (success) setInitialPulse(data);
      })
      .catch((err) => console.error('[Sidebar] Failed to load weekly pulse:', err))
      .finally(() => { if (!cancelled) setPulseLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const recRes  = await postService.getRecommendedUsers();
        const recData = recRes.data as {
          success: boolean;
          recommendations: {
            _id: string;
            userId: string;
            fullname: { firstName: string; lastName: string };
            avatar?: string;
            headline?: string;
            sharedInterests: string[];
          }[];
        };

        if (!recData.success || recData.recommendations.length === 0) {
          setLoading(false);
          return;
        }

        const merged: RecommendedUser[] = recData.recommendations
          .filter((r) => user && r.userId !== user._id)
          .map((r) => ({
            _id: r.userId,
            fullname: r.fullname,
            avatar: r.avatar,
            headline: r.headline,
            sharedInterests: r.sharedInterests ?? [],
          }));

        setRecommendations(merged);

        // ── FIX: getMyFollowing() returns full user objects
        // ({ fullname, _id, headline, avatar }), NOT plain ID strings.
        // The previous version did `followData.following.map(String)`,
        // which stringifies each OBJECT to the literal text
        // "[object Object]" instead of extracting its _id — so
        // followingIds never actually contained a real user id, and
        // `followingIds.has(person._id)` was always false. That's why
        // "Who to Follow" kept showing an already-followed person with
        // a "Follow" button again after every reload: the app had no
        // correct record of who was already followed. ──
        const followRes  = await userService.getMyFollowing();
        const followData = followRes.data as {
          success: boolean;
          following: Array<string | { _id: string }>;
        };
        setFollowingIds(
          new Set(
            followData.following.map((f) => (typeof f === 'string' ? f : f._id))
          )
        );
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

  const unfollowed = recommendations.filter((p) => !followingIds.has(p._id));
  const followed   = recommendations.filter((p) =>  followingIds.has(p._id));
  const displayed  = [...unfollowed, ...followed].slice(0, 5);

  const isQuiet = pulse?.status === '💤 Quiet';

  return (
    <aside className="feed-sidebar">

      <CommunityInsights activeSlug={activeInsight} />

      <div className="sidebar-card">
        <div className="sidebar-card-header">
          <div className="sidebar-card-icon">🔥</div>
          <h3 className="sidebar-card-title">Trending Now</h3>
        </div>

        {pulseLoading && !pulse && (
          <div className="follow-loading">Reading the room...</div>
        )}

        {!pulseLoading && (!pulse || !pulse.topic) && !isQuiet && (
          <div className="follow-empty">
            <div className="follow-empty-icon">💤</div>
            <div>No standout topic yet this week — be the first to start one.</div>
          </div>
        )}

        {pulse && (isQuiet || pulse.topic) && (
          <>
            <div className="pulse-signal-badge">{pulse.status}</div>

            {isQuiet ? (
              <div className="follow-empty">
                {pulse.explanation ?? 'Not enough activity this week yet.'}
              </div>
            ) : (
              <div className="trending-list">
                <div className="trending-item">
                  <span className="trending-dot" />
                  <div>
                    <div className="trending-tag">#{pulse.topic}</div>
                    <div className="trending-count">{pulse.activityLabel}</div>
                    {pulse.explanation && (
                      <div className="trending-explanation">{pulse.explanation}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {pulse.topics.length > 0 && (
              <>
                <div className="sidebar-section-label">
                  {isQuiet ? 'Topics' : 'Other Topics'}
                </div>
                <div className="trending-list">
                  {pulse.topics.map((item) => (
                    <div key={item.tag} className="trending-item">
                      <span className="trending-dot" />
                      <div>
                        <div className="trending-tag">#{item.tag}</div>
                        <div className="trending-count">{item.posts} post{item.posts === 1 ? '' : 's'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

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
            const hasAvatar   = Boolean(person.avatar && person.avatar.trim() !== '');
            return (
              <div key={person._id} className={`follow-item${isFollowing ? ' follow-item--following' : ''}`}>
                <div
                  className="follow-avatar"
                  style={{
                    background: hasAvatar ? 'transparent' : avatarColor(person._id),
                    overflow: 'hidden',
                    position: 'relative',
                    width: '70px',
                    height: '70px',
                    minWidth: '44px',
                    borderRadius: '50%',
                    flexShrink: 0,
                  }}
                >
                  {hasAvatar ? (
                    <img
                      src={person.avatar}
                      alt={`${person.fullname.firstName} ${person.fullname.lastName}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <span style={{
                      color: 'white', fontWeight: 700, fontSize: '1rem',
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'center', width: '100%', height: '100%',
                    }}>
                      {initials(person.fullname)}
                    </span>
                  )}
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