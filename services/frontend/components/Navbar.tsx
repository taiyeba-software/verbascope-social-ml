'use client';

import Link from 'next/link';
import { Search, Bell, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import './Navbar.css';

export default function Navbar() {
  const { user } = useAuth();

  const initials = user
    ? `${user?.fullname?.firstName?.[0] ?? ''}${user?.fullname?.lastName?.[0] ?? ''}`.toUpperCase() || 'U'
    : 'U';

  const displayName = user
    ? `${user?.fullname?.firstName ?? ''} ${user?.fullname?.lastName ?? ''}`.trim() || 'User'
    : 'User';

  return (
    <nav className="navbar">
      <Link href="/feed" className="navbar-logo">
        <svg className="v-mark" viewBox="0 0 42 42" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="4,6 21,36 38,6 32,6 21,26 10,6" />
        </svg>
        <div>
          <span className="v-logo-name">Verbascope</span>
        </div>
      </Link>

      <div className="navbar-center">
        <div className="live-indicator">
          <span className="pulse-dot"></span>
          <span>Live Feed</span>
        </div>
      </div>

      <div className="navbar-end">
        <button type="button" className="navbar-icon-btn" aria-label="Search">
          <Search size={18} strokeWidth={1.75} />
        </button>

        <button type="button" className="navbar-icon-btn" aria-label="Notifications">
          <Bell size={18} strokeWidth={1.75} />
          <span className="navbar-badge">3</span>
        </button>

        <div className="navbar-user">
          <div className="navbar-user-avatar">
            {initials}
          </div>
          <span className="navbar-user-name">{displayName}</span>
          <ChevronDown size={14} className="navbar-chevron" />
        </div>
      </div>
    </nav>
  );
}
