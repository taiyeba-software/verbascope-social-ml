'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { postService, userService } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { FollowerRef } from '@/types';

interface RecommendedUser {
  _id: string;
  fullname: { firstName: string; lastName: string };
  avatar?: string;
  headline?: string;
  sharedInterests: string[];
}

interface RecommendationsApiResponse {
  success: boolean;
  recommendations?: {
    _id: string;
    userId: string;
    fullname: { firstName: string; lastName: string };
    avatar?: string;
    headline?: string;
    sharedInterests: string[];
  }[];
}

interface FollowingApiResponse {
  success: boolean;
  following?: (string | FollowerRef)[];
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
  `${fullname.firstName?.[0] ?? ''}${fullname.lastName?.[0] ?? ''}`.toUpperCase();

export function WhoToFollowInline() {
  const { user } = useAuth();
  const [people, setPeople] = useState<RecommendedUser[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loadingFollow, setLoadingFollow] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    const load = async () => {
      try {
        // Concurrently fetch recommendations and current following list
        const [recRes, followRes] = await Promise.all([
          postService.getRecommendedUsers().catch(() => null),
          userService.getMyFollowing().catch(() => null),
        ]);

        if (!isMounted) return;

        // Safely extract and type check the 'following' response
        if (followRes?.data) {
          const followData = followRes.data as FollowingApiResponse;
          if (followData.success && Array.isArray(followData.following)) {
            const extractedIds = followData.following.map((item) => {
              if (typeof item === 'object' && item !== null && '_id' in item) {
                return String(item._id);
              }
              return String(item);
            });
            setFollowingIds(new Set(extractedIds));
          }
        }

        // Safely extract and type check the 'recommendations' response.
        // The recommendations endpoint already returns fullname/avatar/headline
        // populated server-side (post-service resolves them via auth-service
        // bulk lookup + local fallback) — no need for a second bulk fetch here.
        if (!recRes?.data) return;
        const recData = recRes.data as RecommendationsApiResponse;

        if (!recData.success || !recData.recommendations || recData.recommendations.length === 0) return;

        const merged = recData.recommendations
          .filter((r) => r.userId !== user._id)
          .map((r) => ({
            _id: r.userId,
            fullname: r.fullname,
            avatar: r.avatar,
            headline: r.headline,
            sharedInterests: r.sharedInterests ?? [],
          }));

        setPeople(merged.slice(0, 3)); // Show max 3 inline
      } catch {
        // Non-critical background fetch failure
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleToggleFollow = async (targetId: string) => {
    if (loadingFollow) return;
    setLoadingFollow(targetId);
    const isFollowing = followingIds.has(targetId);

    try {
      if (isFollowing) {
        await userService.unfollow(targetId);
        setFollowingIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
      } else {
        await userService.follow(targetId);
        setFollowingIds((prev) => new Set(prev).add(targetId));
      }
    } catch {
      // Fail silently for seamless UI toggle
    } finally {
      setLoadingFollow(null);
    }
  };

  const visible = people.filter((p) => !followingIds.has(p._id));
  if (visible.length === 0) return null;

  return (
    <div className="inline-card">
      <div className="inline-card-header">
        <span className="inline-card-icon">👥</span>
        <span className="inline-card-title">People you may know</span>
      </div>

      <div className="inline-card-list">
        {visible.map((person) => {
          const isFollowing = followingIds.has(person._id);
          const busy = loadingFollow === person._id;
          const hasAvatar = Boolean(person.avatar && person.avatar.trim() !== '');
          const profileLink = person._id ? `/profile/${person._id}` : null;

          return (
            <div key={person._id} className="inline-follow-item">
              {/* Avatar Column */}
              {profileLink ? (
                <Link href={profileLink} style={{ display: 'contents' }}>
                  <div
                    className="inline-follow-avatar"
                    style={{
                      background: hasAvatar ? 'transparent' : avatarColor(person._id),
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    {hasAvatar ? (
                      <img
                        src={person.avatar}
                        alt={`${person.fullname.firstName} ${person.fullname.lastName}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      initials(person.fullname)
                    )}
                  </div>
                </Link>
              ) : (
                <div
                  className="inline-follow-avatar"
                  style={{
                    background: hasAvatar ? 'transparent' : avatarColor(person._id),
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  {hasAvatar ? (
                    <img
                      src={person.avatar}
                      alt={`${person.fullname.firstName} ${person.fullname.lastName}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    initials(person.fullname)
                  )}
                </div>
              )}

              {/* User Info Column */}
              <div className="inline-follow-info">
                {profileLink ? (
                  <Link href={profileLink} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <span className="inline-follow-name">
                      {person.fullname.firstName} {person.fullname.lastName}
                    </span>
                  </Link>
                ) : (
                  <span className="inline-follow-name">
                    {person.fullname.firstName} {person.fullname.lastName}
                  </span>
                )}
                {person.sharedInterests.length > 0 && (
                  <span className="inline-follow-interests">
                    {person.sharedInterests.map((t) => `#${t}`).join(' ')}
                  </span>
                )}
              </div>

              {/* Action Button */}
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