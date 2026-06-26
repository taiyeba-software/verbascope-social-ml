'use client';

import { useEffect, useState } from 'react';
import { Users, UserPlus, UserCheck, Pencil, Check, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { userService } from '@/lib/api';
import type { User, FollowerRef } from '@/types';
import './ProfileHeader.css';

interface ProfileHeaderProps {
  /** Route param from /profile/[id] — a real ObjectId, or the literal "me". */
  userId: string;
}

/* ── Helpers ─────────────────────────────────────────────── */
function getId(ref: string | FollowerRef): string {
  return typeof ref === 'string' ? ref : ref._id;
}

function initialsOf(user: User): string {
  const f = user.fullname?.firstName?.[0] ?? '';
  const l = user.fullname?.lastName?.[0] ?? '';
  return (f + l).toUpperCase() || 'U';
}

export default function ProfileHeader({ userId }: ProfileHeaderProps) {
  const { user: currentUser } = useAuth();

  const [profile, setProfile] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Follow button state — optimistic, with rollback on failure.
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  // Inline edit state for bio/headline (Edit Profile, own-profile only).
  const [isEditing, setIsEditing] = useState(false);
  const [editHeadline, setEditHeadline] = useState('');
  const [editBio, setEditBio] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  /* ── Fetch the profile ── */
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setNotFound(false);

    userService
      .getUserProfile(userId)
      .then((res: any) => {
        if (cancelled) return;
        const fetched: User = res.data.user;
        setProfile(fetched);
        setEditHeadline(fetched.headline ?? '');
        setEditBio(fetched.bio ?? '');
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  /* ── Derive follow state once both profile and currentUser are known ── */
  useEffect(() => {
    if (!profile || !currentUser) return;
    const myId = currentUser._id ?? currentUser.id;
    const followers = profile.followers ?? [];
    setIsFollowing(followers.some((f) => getId(f) === myId));
  }, [profile, currentUser]);

  const myId = currentUser?._id ?? currentUser?.id;
  const profileId = profile?._id ?? profile?.id;
  const isOwnProfile = !!myId && !!profileId && myId === profileId;

  /* ── Follow / unfollow ── */
  async function handleFollowToggle() {
    if (!profile || !profileId || followBusy) return;

    const wasFollowing = isFollowing;
    setFollowBusy(true);
    setIsFollowing(!wasFollowing); // optimistic

    try {
      if (wasFollowing) {
        await userService.unfollow(profileId);
      } else {
        await userService.follow(profileId);
      }
    } catch (err) {
      console.error('follow toggle failed, reverting:', err);
      setIsFollowing(wasFollowing); // rollback
    } finally {
      setFollowBusy(false);
    }
  }

  /* ── Edit profile (bio/headline) ── */
  function startEditing() {
    setEditHeadline(profile?.headline ?? '');
    setEditBio(profile?.bio ?? '');
    setIsEditing(true);
  }

  async function saveEdit() {
    if (!profile) return;
    setSavingEdit(true);
    try {
      const res: any = await userService.updateProfile({
        bio: editBio,
        headline: editHeadline,
      });
      setProfile(res.data.user);
      setIsEditing(false);
    } catch (err) {
      console.error('updateProfile failed:', err);
    } finally {
      setSavingEdit(false);
    }
  }

  function cancelEdit() {
    setEditHeadline(profile?.headline ?? '');
    setEditBio(profile?.bio ?? '');
    setIsEditing(false);
  }

  /* ── Loading / not found states ── */
  if (isLoading) {
    return (
      <div className="profile-header profile-header--loading">
        <div className="profile-header-cover shimmer" />
        <div className="profile-header-body">
          <div className="profile-avatar-ring shimmer" />
          <div className="profile-header-skeleton-lines">
            <div className="shimmer profile-skeleton-line profile-skeleton-line--wide" />
            <div className="shimmer profile-skeleton-line profile-skeleton-line--narrow" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="profile-header profile-header--empty">
        <p>This profile couldn&rsquo;t be found.</p>
      </div>
    );
  }

  const followerCount = profile.followers?.length ?? 0;
  const followingCount = profile.following?.length ?? 0;
  const fullName = `${profile.fullname?.firstName ?? ''} ${profile.fullname?.lastName ?? ''}`.trim();

  return (
    <div className="profile-header">
      {/* ── Cover ── */}
      <div className="profile-header-cover">
        <svg className="profile-cover-triangle" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <pattern id="profile-dots" width="12" height="12" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.4" fill="currentColor" />
            </pattern>
          </defs>
          <polygon points="100,0 100,100 0,100" fill="url(#profile-dots)" />
        </svg>
      </div>

      {/* ── Body ── */}
      <div className="profile-header-body">
        <div className="profile-avatar-ring">
          {profile.avatar ? (
            <img src={profile.avatar} alt={fullName} className="profile-avatar-img" />
          ) : (
            <span className="profile-avatar-initials">{initialsOf(profile)}</span>
          )}
        </div>

        <div className="profile-header-actions">
          {isOwnProfile ? (
            !isEditing ? (
              <button type="button" className="profile-btn profile-btn--outline" onClick={startEditing}>
                <Pencil size={15} strokeWidth={1.9} />
                <span>Edit Profile</span>
              </button>
            ) : (
              <div className="profile-edit-actions">
                <button
                  type="button"
                  className="profile-btn profile-btn--ghost"
                  onClick={cancelEdit}
                  disabled={savingEdit}
                >
                  <X size={15} strokeWidth={1.9} />
                  <span>Cancel</span>
                </button>
                <button
                  type="button"
                  className="profile-btn profile-btn--solid"
                  onClick={saveEdit}
                  disabled={savingEdit}
                >
                  <Check size={15} strokeWidth={1.9} />
                  <span>{savingEdit ? 'Saving…' : 'Save'}</span>
                </button>
              </div>
            )
          ) : (
            <button
              type="button"
              className={`profile-btn ${isFollowing ? 'profile-btn--outline' : 'profile-btn--solid'}`}
              onClick={handleFollowToggle}
              disabled={followBusy}
            >
              {isFollowing ? (
                <UserCheck size={15} strokeWidth={1.9} />
              ) : (
                <UserPlus size={15} strokeWidth={1.9} />
              )}
              <span>{isFollowing ? 'Following' : 'Follow'}</span>
            </button>
          )}
        </div>

        <div className="profile-identity">
          <h1 className="profile-name">{fullName || 'Unnamed User'}</h1>

          {!isEditing ? (
            <>
              {profile.headline && <p className="profile-headline">{profile.headline}</p>}
              {profile.bio && <p className="profile-bio">{profile.bio}</p>}
              {!profile.headline && !profile.bio && isOwnProfile && (
                <p className="profile-bio profile-bio--placeholder">
                  Add a headline and bio so people know what you&rsquo;re about.
                </p>
              )}
            </>
          ) : (
            <div className="profile-edit-fields">
              <input
                type="text"
                className="profile-edit-input"
                placeholder="Headline — e.g. Full-Stack Developer"
                value={editHeadline}
                maxLength={100}
                onChange={(e) => setEditHeadline(e.target.value)}
              />
              <textarea
                className="profile-edit-textarea"
                placeholder="Bio — tell people a bit about yourself"
                value={editBio}
                maxLength={280}
                onChange={(e) => setEditBio(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="profile-stats">
          <div className="profile-stat">
            <Users size={14} strokeWidth={1.9} className="profile-stat-icon" />
            <span className="profile-stat-count">{followerCount}</span>
            <span className="profile-stat-label">{followerCount === 1 ? 'Follower' : 'Followers'}</span>
          </div>
          <div className="profile-stat-divider" />
          <div className="profile-stat">
            <span className="profile-stat-count">{followingCount}</span>
            <span className="profile-stat-label">Following</span>
          </div>
        </div>
      </div>
    </div>
  );
}