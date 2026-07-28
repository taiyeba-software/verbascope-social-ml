'use client';

import { useEffect, useRef, useState } from 'react';
import { Users, UserPlus, UserCheck, Pencil, Check, X, Camera, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthContext } from '@/components/auth-provider';
import { userService } from '@/lib/api';
import type { User, FollowerRef } from '@/types';
import './ProfileHeader.css';

interface ProfileHeaderProps {
  /** Route param from /profile/[id] — a real ObjectId, or the literal "me". */
  userId: string;
}

/* ── Avatar upload constraints — mirrors auth-service's avatarUpload.middleware.js
   so bad files are rejected instantly instead of round-tripping to the server first. ── */
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

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
  const { updateUser } = useAuthContext();

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

  // Avatar upload state — optimistic local preview while the real upload
  // is in flight, reverted on failure (same pattern as feed's handleLike).
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

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

  // Revoke the local object URL whenever it's replaced or the component
  // unmounts, so we don't leak blob URLs across repeated avatar changes.
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

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
      const updated: User = res.data.user;
      setProfile(updated);

      // Only own-profile edits should overwrite the shared auth-context user —
      // viewing someone else's profile never reaches this branch anyway
      // (the Edit button only renders when isOwnProfile is true), but the
      // guard is kept explicit here so this stays safe if that ever changes.
      if (isOwnProfile) {
        updateUser(updated);
      }

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

  /* ── Avatar upload ── */
  function handleAvatarClick() {
    if (!isOwnProfile || avatarUploading) return;
    fileInputRef.current?.click();
  }

  async function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input value immediately so selecting the same file again
    // (e.g. after a failed upload) still fires onChange.
    e.target.value = '';
    if (!file || !profile) return;

    setAvatarError(null);

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setAvatarError('Please choose a JPEG, PNG, WEBP, or GIF image.');
      return;
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setAvatarError('Image must be under 5MB.');
      return;
    }

    // Instant local preview while the real upload is in flight.
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
    setAvatarUploading(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const res: any = await userService.updateAvatar(formData);
      const updated: User = res.data.user;

      setProfile(updated);
      setAvatarPreview(null); // real CDN url from `updated.avatar` takes over

      // This is the "sync everywhere" step: pushing the updated user into
      // the shared auth context means Navbar (and anything else reading
      // useAuth().user) re-renders with the new avatar immediately,
      // with no page reload — same mechanism already used for bio/headline
      // edits above.
      if (isOwnProfile) {
        updateUser(updated);
      }
    } catch (err) {
      console.error('Avatar upload failed:', err);
      setAvatarError('Upload failed. Please try again.');
      setAvatarPreview(null); // revert to the last known-good avatar
    } finally {
      setAvatarUploading(false);
    }
  }

  /* ── Loading / not found states ── */
  if (isLoading) {
    return (
      <div className="profile-header profile-header--loading">
        <div className="profile-header-cover shimmer" />
        <div className="profile-header-body">
          <div className="profile-header-top">
            <div className="profile-avatar-ring shimmer" />
          </div>
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
  const displayedAvatar = avatarPreview ?? profile.avatar;

  return (
    <div className="profile-header">
      {/* ── Cover ── */}
      <div className="profile-header-cover">
        <svg className="profile-cover-pattern" viewBox="0 0 100 100" aria-hidden="true" preserveAspectRatio="none">
          <defs>
            <pattern id="profile-dots" width="9" height="9" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.2" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#profile-dots)" />
        </svg>
      </div>

      {/* ── Body ── */}
      <div className="profile-header-body">
        {/* Avatar and the primary action share a row so they scale together
            at every width, instead of the old absolute-position + static
            breakpoint hack that made tablet widths collide. */}
        <div className="profile-header-top">
          <div
            className={`profile-avatar-ring${isOwnProfile ? ' profile-avatar-ring--editable' : ''}`}
            onClick={handleAvatarClick}
            role={isOwnProfile ? 'button' : undefined}
            tabIndex={isOwnProfile ? 0 : undefined}
            aria-label={isOwnProfile ? 'Change profile photo' : undefined}
            onKeyDown={
              isOwnProfile
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleAvatarClick();
                    }
                  }
                : undefined
            }
          >
            {displayedAvatar ? (
              <img src={displayedAvatar} alt={fullName} className="profile-avatar-img" />
            ) : (
              <span className="profile-avatar-initials">{initialsOf(profile)}</span>
            )}

            {isOwnProfile && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_AVATAR_TYPES.join(',')}
                  onChange={handleAvatarFileChange}
                  className="profile-avatar-file-input"
                  aria-hidden="true"
                  tabIndex={-1}
                />
                <div className="profile-avatar-overlay">
                  {avatarUploading ? (
                    <Loader2 size={18} strokeWidth={2} className="profile-avatar-spinner" />
                  ) : (
                    <Camera size={18} strokeWidth={2} />
                  )}
                </div>
              </>
            )}
          </div>

          <div className="profile-header-actions">
            {isOwnProfile ? (
              !isEditing ? (
                <button type="button" className="profile-btn profile-btn--outline" onClick={startEditing}>
                  <Pencil size={15} strokeWidth={1.9} />
                  <span>Edit profile</span>
                </button>
              ) : (
                <div className="profile-edit-actions">
                  <button
                    type="button"
                    className="profile-btn profile-btn--ghost"
                    onClick={cancelEdit}
                    disabled={savingEdit}
                    aria-label="Cancel editing"
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
                aria-pressed={isFollowing}
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
        </div>

        {avatarError && <p className="profile-avatar-error">{avatarError}</p>}

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
              <div className="profile-edit-field">
                <input
                  type="text"
                  className="profile-edit-input"
                  placeholder="Headline — e.g. Full-Stack Developer"
                  value={editHeadline}
                  maxLength={100}
                  onChange={(e) => setEditHeadline(e.target.value)}
                />
                <span className="profile-edit-count">{editHeadline.length}/100</span>
              </div>
              <div className="profile-edit-field">
                <textarea
                  className="profile-edit-textarea"
                  placeholder="Bio — tell people a bit about yourself"
                  value={editBio}
                  maxLength={280}
                  onChange={(e) => setEditBio(e.target.value)}
                />
                <span className="profile-edit-count">{editBio.length}/280</span>
              </div>
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