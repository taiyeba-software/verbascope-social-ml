'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, Bell, ChevronDown, Heart, MessageCircle, Repeat2 } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/hooks/useAuth';
import { notificationService } from '@/lib/api';
import './Navbar.css';

/* ── Types ───────────────────────────────────────────────── */
interface Notification {
  _id: string;
  type: 'like' | 'comment' | 'share';
  actorName: string;
  postId: string;
  read: boolean;
  createdAt: string;
  reason?: 'agree' | 'funny' | 'needs_attention' | 'insightful' | 'concerning' | 'educational' | null;
}

/* ── Helpers ─────────────────────────────────────────────── */
const REASON_LABELS: Record<string, string> = {
  agree: 'because they agree ✅',
  funny: 'because it\u2019s funny 😄',
  needs_attention: 'because it needs attention 🚨',
  insightful: 'because it\u2019s insightful 💡',
  concerning: 'because it\u2019s concerning ⚠️',
  educational: 'because it\u2019s educational 📚',
};

function notificationLabel(n: Notification): string {
  if (n.type === 'like')    return `${n.actorName} liked your post`;
  if (n.type === 'comment') return `${n.actorName} commented on your post`;
  if (n.type === 'share') {
    const reasonText = n.reason ? ` ${REASON_LABELS[n.reason as string] ?? ''}` : '';
    return `${n.actorName} passed your post forward${reasonText}`;
  }
  return 'New notification';
}

function notificationIcon(type: Notification['type']) {
  if (type === 'like')    return <Heart size={15} className="notif-icon notif-icon-like" fill="currentColor" />;
  if (type === 'comment') return <MessageCircle size={15} className="notif-icon notif-icon-comment" />;
  if (type === 'share')   return <Repeat2 size={15} className="notif-icon notif-icon-share" />;
  return <Bell size={15} className="notif-icon" />;
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

/* ── Component ───────────────────────────────────────────── */
export default function Navbar() {
  const { user } = useAuth();

  const [notifications, setNotifications]   = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]       = useState(0);
  const [dropdownOpen, setDropdownOpen]     = useState(false);

  const socketRef   = useRef<Socket | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* ── Fetch notifications on mount ── */
  useEffect(() => {
    if (!user) return;

    notificationService.getNotifications()
      .then((res: any) => {
        const data: Notification[] = res.data.notifications ?? [];
        setNotifications(data);
        setUnreadCount(res.data.unreadCount ?? 0);
      })
      .catch(() => {/* silent — badge stays 0 */});
  }, [user]);

  /* ── Socket.io connection ── */
  useEffect(() => {

    console.log('🔵 [BELL SOCKET] Effect ran. user?.id is:', user?.id);  

    if (!user?.id) return;

    console.log('🔵 [BELL SOCKET] Initializing connection for user:', user.id);

    const socket = io('http://localhost:3001', { withCredentials: true });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🟢 [BELL SOCKET] Connected:', socket.id, '| joining room:', user.id);
      socket.emit('join', user.id);
    });

    socket.on('connect_error', (err) => {
      console.error('🔴 [BELL SOCKET] Connection error:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.warn('🟡 [BELL SOCKET] Disconnected:', reason);
    });

    socket.on('notification:new', (notification: Notification) => {
      console.log('🔔 [BELL SOCKET] notification:new received:', notification);
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      console.log('🔵 [BELL SOCKET] Cleaning up connection for user:', user.id);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id]);

  /* ── Close dropdown when clicking outside ── */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* ── Bell click: open dropdown + mark all read ── */
  async function handleBellClick() {
    setDropdownOpen((prev) => !prev);

    if (!dropdownOpen && unreadCount > 0) {
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      try {
        await notificationService.markAllRead();
      } catch {/* silent */}
    }
  }

  /* ── Avatar / display name ── */
  const initials = user
    ? `${user?.fullname?.firstName?.[0] ?? ''}${user?.fullname?.lastName?.[0] ?? ''}`.toUpperCase() || 'U'
    : 'U';

  const displayName = user
    ? `${user?.fullname?.firstName ?? ''} ${user?.fullname?.lastName ?? ''}`.trim() || 'User'
    : 'User';

    console.log('🎯 unreadCount right now:', unreadCount);

   

  /* ── Render ── */
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

        {/* ── Bell + Dropdown ── */}
        <div className="navbar-notification-wrapper" ref={dropdownRef}>
          <button
            type="button"
            className="navbar-icon-btn"
            aria-label="Notifications"
            onClick={handleBellClick}
          >
            <Bell size={18} strokeWidth={1.75} />
            {unreadCount > 0 && (
              <span className="navbar-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </button>

          {dropdownOpen && (
            <div className="notification-dropdown">
              <div className="notification-dropdown-header">
                <span>Notifications</span>
              </div>

              {notifications.length === 0 ? (
                <div className="notification-empty">No notifications yet</div>
              ) : (
                <ul className="notification-list">
                  {notifications.map((n) => (
                    <li key={n._id} className={`notification-item${n.read ? '' : ' unread'}`}>
                      <span className={`notif-icon-wrap notif-icon-wrap-${n.type}`}>
                        {notificationIcon(n.type)}
                      </span>
                      <div className="notification-body">
                        <span className="notification-text">{notificationLabel(n)}</span>
                        <span className="notification-time">{timeAgo(n.createdAt)}</span>
                      </div>
                      {!n.read && <span className="notification-dot" />}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="navbar-user">
          <div className="navbar-user-avatar">{initials}</div>
          <span className="navbar-user-name">{displayName}</span>
          <ChevronDown size={14} className="navbar-chevron" />
        </div>
      </div>
    </nav>
  );
}