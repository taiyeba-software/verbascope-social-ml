'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Search,
  SlidersHorizontal,
  Bell,
  ChevronDown,
  Heart,
  MessageCircle,
  Repeat2,
  Menu,
  X,
  Home,
  Compass,
  Bookmark,
  LogOut,
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/hooks/useAuth';
import { notificationService } from '@/lib/api';
import './Navbar.css';
import ThemeToggle from './ThemeToggle';

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

/* ── Nav links ───────────────────────────────────────────── */
const NAV_LINKS = [
  { href: '/feed', label: 'Feed', icon: Home },
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
] as const;

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

/* ── Backend sends `isRead`, frontend uses `read` — normalize at the boundary
   so this is the only place that needs to know about the mismatch. ── */
function normalizeNotification(raw: any): Notification {
  return {
    ...raw,
    read: raw.read ?? raw.isRead ?? false,
  };
}

/* ── Component ───────────────────────────────────────────── */
export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [dropdownOpen, setDropdownOpen]   = useState(false);
  const [menuOpen, setMenuOpen]           = useState(false);
  const [searchValue, setSearchValue]     = useState('');

  const socketRef  = useRef<Socket | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef      = useRef<HTMLDivElement>(null);

  /* ── Fetch notifications on mount ── */
  useEffect(() => {
    if (!user) return;

    notificationService.getNotifications()
      .then((res: any) => {
        const data: Notification[] = (res.data.notifications ?? []).map(normalizeNotification);
        setNotifications(data);
        setUnreadCount(res.data.unreadCount ?? 0);
      })
      .catch(() => {/* silent — badge stays 0 */});
  }, [user]);

  /* ── Socket.io connection ── */
  useEffect(() => {
    if (!user?._id) return;

    const socket = io('http://localhost:3001', { withCredentials: true });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join', user._id);
    });

    socket.on('notification:new', (notification: Notification) => {
      setNotifications((prev) => [normalizeNotification(notification), ...prev]);
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?._id]);

  /* ── Close notification dropdown / mobile menu when clicking outside ── */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* ── Close the mobile menu on route change ── */
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  /* ── Bell click: open dropdown + mark all read ── */
  async function handleBellClick() {
    setDropdownOpen((prev) => !prev);

    if (!dropdownOpen && unreadCount > 0) {
      const previousNotifications = notifications;
      const previousUnreadCount = unreadCount;

      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

      try {
        await notificationService.markAllRead();
      } catch (err) {
        // Persist failed — roll back so the UI doesn't lie about server state
        console.error('markAllRead failed, reverting:', err);
        setNotifications(previousNotifications);
        setUnreadCount(previousUnreadCount);
      }
    }
  }

  /* ── Search submit — routes to /search once the search page exists ── */
  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchValue.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  /* ── Avatar / display name ── */
  const userId = user ? (user._id ?? (user as any).id) : null;

  const initials = user
    ? `${user?.fullname?.firstName?.[0] ?? ''}${user?.fullname?.lastName?.[0] ?? ''}`.toUpperCase() || 'U'
    : 'U';

  const displayName = user
    ? `${user?.fullname?.firstName ?? ''} ${user?.fullname?.lastName ?? ''}`.trim() || 'User'
    : 'User';

  const profileHref = userId ? `/profile/${userId}` : '/profile';
  const isProfileActive = pathname?.startsWith('/profile') ?? false;

  function isLinkActive(href: string) {
    if (href === '/feed') return pathname === '/feed';
    return pathname?.startsWith(href) ?? false;
  }

  /* ── Shared notification panel markup ── */
  const notificationPanel = (
    <>
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
    </>
  );

  /* ── Render ── */
  return (
    <>
      <nav className="navbar">
        <div className="navbar-left">
          <button
            type="button"
            className="navbar-hamburger"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            {menuOpen ? <X size={20} strokeWidth={1.9} /> : <Menu size={20} strokeWidth={1.9} />}
          </button>

          <Link href="/feed" className="navbar-logo">
            <svg className="v-mark" viewBox="0 0 42 42" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="4,6 21,36 38,6 32,6 21,26 10,6" />
            </svg>
            <span className="v-logo-name">Verbascope</span>
          </Link>
        </div>

        <ul className="navbar-links">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className={`navbar-link${isLinkActive(href) ? ' active' : ''}`}>
                <Icon size={16} strokeWidth={1.9} />
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>

        <form className="navbar-search" onSubmit={handleSearchSubmit} role="search">
          <Search size={16} className="navbar-search-icon" strokeWidth={1.9} />
          <input
            type="text"
            className="navbar-search-input"
            placeholder="Search posts, people, tags..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            aria-label="Search posts, people, tags"
          />
          <button type="button" className="navbar-search-filter" aria-label="Search filters">
            <SlidersHorizontal size={15} strokeWidth={1.9} />
          </button>
        </form>

        <div className="navbar-end">
          <ThemeToggle />

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
                {notificationPanel}
              </div>
            )}
          </div>

          <Link
            href={profileHref}
            className={`navbar-user${isProfileActive ? ' active' : ''}`}
          >
            <div className="navbar-user-avatar">
              {user?.avatar ? (
                <img src={user.avatar} alt={displayName} className="navbar-user-avatar-img" />
              ) : (
                initials
              )}
            </div>
            <span className="navbar-user-name">{displayName}</span>
            <ChevronDown size={14} className="navbar-chevron" />
          </Link>
        </div>
      </nav>

      {/* ════════════════ HAMBURGER MENU (tablet + mobile) ════════════════ */}
      {menuOpen && (
        <>
          <div className="navbar-mobile-menu-backdrop" onClick={() => setMenuOpen(false)} />
          <div className="navbar-mobile-menu" ref={menuRef}>
            <ul className="navbar-mobile-menu-links">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className={`navbar-mobile-menu-link${isLinkActive(href) ? ' active' : ''}`}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    <span>{label}</span>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="navbar-mobile-menu-divider" />

            <Link
              href={profileHref}
              className="navbar-mobile-menu-link"
              onClick={() => setMenuOpen(false)}
            >
              <div className="navbar-mobile-avatar-small">
                {user?.avatar ? (
                  <img src={user.avatar} alt={displayName} className="navbar-mobile-avatar-img" />
                ) : (
                  initials
                )}
              </div>
              <span>{displayName}</span>
            </Link>

            <button
              type="button"
              className="navbar-mobile-menu-link navbar-mobile-logout"
              onClick={() => {
                setMenuOpen(false);
                logout?.();
              }}
            >
              <LogOut size={18} strokeWidth={1.8} />
              <span>Log out</span>
            </button>
          </div>
        </>
      )}
    </>
  );
}