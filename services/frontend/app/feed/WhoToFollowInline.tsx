'use client';

import { useState, useEffect } from 'react';
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

export function WhoToFollowInline() {
  const { user } = useAuth();
  const [people, setPeople]           = useState<RecommendedUser[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loadingFollow, setLoadingFollow] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const recRes  = await postService.getRecommendedUsers();
        const recData = recRes.data as {
          success: boolean;
          recommendations: { userId: string; sharedInterests: string[] }[];
        };
        if (!recData.success || recData.recommendations.length === 0) return;

        const ids       = recData.recommendations.map((r) => r.userId);
        const usersRes  = await userService.getUsersBulk(ids);
        const usersData = usersRes.data as {
          success: boolean;
          users: { _id: string; fullname: { firstName: string; lastName: string } }[];
        };

        const interestMap = Object.fromEntries(
          recData.recommendations.map((r) => [r.userId, r.sharedInterests])
        );

        const merged = usersData.users
          .filter((u) => u._id !== user._id)
          .map((u) => ({ ...u, sharedInterests: interestMap[u._id] ?? [] }));

        setPeople(merged.slice(0, 3)); // show max 3 inline

        const followRes  = await userService.getMyFollowing();
        const followData = followRes.data as { success: boolean; following: string[] };
        setFollowingIds(new Set(followData.following.map(String)));
      } catch {
        // non-critical
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
    } catch {
      // silently fail
    } finally {
      setLoadingFollow(null);
    }
  };

  const visible = people.filter((p) => !followingIds.has(p._id));
  if (visible.length === 0) return null; // hide card entirely if nothing to show

  return (
    <div className="inline-card">
      <div className="inline-card-header">
        <span className="inline-card-icon">👥</span>
        <span className="inline-card-title">People you may know</span>
      </div>

      <div className="inline-card-list">
        {visible.map((person) => {
          const isFollowing = followingIds.has(person._id);
          const busy        = loadingFollow === person._id;
          return (
            <div key={person._id} className="inline-follow-item">
              <div
                className="inline-follow-avatar"
                style={{ background: avatarColor(person._id) }}
              >
                {initials(person.fullname)}
              </div>
              <div className="inline-follow-info">
                <span className="inline-follow-name">
                  {person.fullname.firstName} {person.fullname.lastName}
                </span>
                {person.sharedInterests.length > 0 && (
                  <span className="inline-follow-interests">
                    {person.sharedInterests.map((t) => `#${t}`).join(' ')}
                  </span>
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
    </div>
  );
}