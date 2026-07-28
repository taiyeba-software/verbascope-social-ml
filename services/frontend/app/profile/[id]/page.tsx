'use client';

import React, { useState, use } from 'react';
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