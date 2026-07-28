'use client';

import React, { useState, useEffect, use } from 'react';
import ProfileHeader from '@/components/profile/ProfileHeader';
import ProfileTabs from '@/components/profile/ProfileTabs';
import ProfilePosts from '@/components/profile/ProfilePosts';
import { useAuth } from '@/hooks/useAuth';
import './profile-page.css';

interface ProfilePageProps {
  params: Promise<{ id: string }>;
}

export default function ProfilePage({ params }: ProfilePageProps) {
  const { id } = use(params);
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');

  const myId = currentUser?._id ?? currentUser?.id;
  const isOwnProfile = !!myId && (id === 'me' || myId === id);
  const targetUserId = id === 'me' ? myId : id;

  // BUG FIX: /profile/[id] is one route pattern reused for every profile,
  // so navigating from your own profile to someone else's (or vice versa)
  // via client-side Link does NOT remount ProfilePage — activeTab state
  // survives the navigation. Without this reset, viewing your own "Saved"
  // tab and then clicking through to another user's profile left
  // activeTab stuck on "saved": ProfileTabs correctly hides the Saved
  // button (isOwnProfile is now false), but ProfilePosts was still being
  // called with activeTab="saved", which calls getSavedPosts() — an
  // endpoint that always returns the logged-in viewer's own bookmarks
  // regardless of whose profile is showing. That silently displayed your
  // saved posts under a stranger's profile header. Resetting to "posts"
  // on every id change also matches the expected UX (Instagram/X-style:
  // visiting any profile always starts on its Posts tab).
  useEffect(() => {
    setActiveTab('posts');
  }, [id]);

  return (
    <div className="profile-page-shell">
      {/* Sticky on desktop (>=1024px) so the profile card stays in view
          while the post list scrolls; a normal block on tablet/phone. */}
      <div className="profile-page-sidebar">
        <ProfileHeader userId={id} />
      </div>

      {targetUserId && (
        <div className="profile-page-main">
          <ProfileTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isOwnProfile={isOwnProfile}
          />
          <ProfilePosts userId={targetUserId} activeTab={activeTab} />
        </div>
      )}
    </div>
  );
}