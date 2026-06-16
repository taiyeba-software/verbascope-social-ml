'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, Bell, ChevronDown } from 'lucide-react';
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
}

/* ── Helpers ─────────────────────────────────────────────── */
function notificationLabel(n: Notification): string {
  if (n.type === 'like')    return `${n.actorName} liked your post`;
  if (n.type === 'comment') return `${n.actorName} commented on your post`;
  if (n.type === 'share')   return `${n.actorName} shared your post`;
  return 'New notification';
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
    if (!user?.id) return;

    const socket = io('http://localhost:3001', { withCredentials: true });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join', user.id);
    });

    socket.on('notification:new', (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
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
                      <span className="notification-text">{notificationLabel(n)}</span>
                      <span className="notification-time">
                        {new Date(n.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
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
