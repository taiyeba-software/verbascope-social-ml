'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Flame } from 'lucide-react';
import { postService } from '@/lib/api';
import type { WeeklyPulse } from './useFeedSocket';
import './TrendingMenu.css';

/* "Trending Now" for the hamburger menu (tablet + phone), where the desktop
   sidebar isn't visible. It sits right after "AI Filter" and expands inline:

     Trending Now                      ›
       ⚡ Engagement Surge
       ● #general        77% of this month's discussions
       OTHER TOPICS
       ● #collegelife    2 posts
       ● #finaldefense   1 post

   The menu only mounts while it is open, and the data is fetched each time
   this row is expanded — so what you see is current every time you look.
   Tapping a topic opens that tag's page and closes the menu. */
export default function TrendingMenu({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState<WeeklyPulse | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    setLoading(true);
    setFailed(false);

    postService
      .getWeeklyPulse()
      .then((res) => {
        if (cancelled) return;
        const { success, ...data } = res.data;
        if (success) setPulse(data as WeeklyPulse);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const isQuiet = pulse?.status === '💤 Quiet';
  const topics = pulse?.topics ?? [];
  const hasFeatured = Boolean(pulse?.topic) && !isQuiet;
  const isEmpty = !loading && !failed && !hasFeatured && topics.length === 0;

  const tagHref = (tag: string) => `/tag/${encodeURIComponent(tag.replace(/^#/, ''))}`;

  return (
    <div className="trending-menu">
      <button
        type="button"
        className="navbar-mobile-menu-link"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Flame size={18} strokeWidth={1.8} />
        <span>Trending Now</span>
        <ChevronRight size={16} className={`trending-menu-chevron${open ? ' open' : ''}`} />
      </button>

      {open && (
        <div className="trending-menu-panel">
          {loading && !pulse && <div className="trending-menu-note">Reading the room...</div>}

          {failed && !pulse && (
            <div className="trending-menu-note">Couldn&apos;t load trending topics right now.</div>
          )}

          {isEmpty && (
            <div className="trending-menu-note">
              No standout topic yet this month — be the first to start one.
            </div>
          )}

          {pulse && (hasFeatured || isQuiet) && (
            <div className="trending-menu-status">{pulse.status}</div>
          )}

          {isQuiet && (
            <div className="trending-menu-note">
              {pulse?.explanation ?? 'Not enough activity this month yet.'}
            </div>
          )}

          {hasFeatured && pulse?.topic && (
            <Link href={tagHref(pulse.topic)} className="trending-menu-item" onClick={onNavigate}>
              <span className="trending-menu-dot" aria-hidden="true" />
              <span className="trending-menu-text">
                <span className="trending-menu-tag">#{pulse.topic}</span>
                {pulse.activityLabel && (
                  <span className="trending-menu-count">{pulse.activityLabel}</span>
                )}
              </span>
            </Link>
          )}

          {topics.length > 0 && (
            <>
              <div className="trending-menu-label">{isQuiet ? 'Topics' : 'Other Topics'}</div>
              {topics.map((item) => (
                <Link
                  key={item.tag}
                  href={tagHref(item.tag)}
                  className="trending-menu-item"
                  onClick={onNavigate}
                >
                  <span className="trending-menu-dot" aria-hidden="true" />
                  <span className="trending-menu-text">
                    <span className="trending-menu-tag">#{item.tag}</span>
                    <span className="trending-menu-count">
                      {item.posts} post{item.posts === 1 ? '' : 's'}
                    </span>
                  </span>
                </Link>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}