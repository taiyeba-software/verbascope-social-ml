'use client';

import React, { useState, useEffect, use } from 'react';
import { LogOut } from 'lucide-react';
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
  const { user: currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts');

  const myId = currentUser?._id ?? currentUser?.id;
  const isOwnProfile = !!myId && (id === 'me' || myId === id);
  const targetUserId = id === 'me' ? myId : id;

  useEffect(() => {
    setActiveTab('posts');
  }, [id]);

  return (
    <div className="profile-page-shell">
      {/* Sticky sidebar card for profile details */}
      <div className="profile-page-sidebar">
        <ProfileHeader userId={id} />

        {/* Display Logout button for profile owner */}
        {isOwnProfile && (
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={logout}
              className="btn btn-ghost"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#ef4444',
                borderColor: 'rgba(239, 68, 68, 0.2)',
                width: '100%',
                justifyContent: 'center',
                padding: '0.625rem 1rem',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
              title="Log out of your account"
            >
              <LogOut size={16} />
              <span>Log out</span>
            </button>
          </div>
        )}
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