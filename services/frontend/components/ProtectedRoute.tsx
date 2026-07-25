'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Navbar from './Navbar';
import CreatePostBox from './CreatePostBox';
import FeedSkeleton from './FeedSkeleton';
import SidebarSkeleton from './SidebarSkeleton';

const PROTECTED_PATHS = ['/feed'];

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Skip rendering the themed fallback until mounted in the browser, so
  // the very first paint (before theme/CSS are guaranteed ready) is just
  // blank instead of a mismatched flash.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isProtectedPath = PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  useEffect(() => {
    if (!isLoading && isProtectedPath && !user) {
      router.replace('/auth/login');
    }
  }, [isLoading, isProtectedPath, router, user]);

  if (isProtectedPath && isLoading) {
    if (!mounted) {
      return null;
    }

    // This must match FeedPage's own `feedLoading` fallback exactly
    // (Navbar + CreatePostBox + FeedSkeleton + SidebarSkeleton) so the
    // handoff between ProtectedRoute's auth-loading stage and FeedPage's
    // posts-loading stage is visually identical — one continuous
    // skeleton, not two different-looking stages.
    return (
      <div className="feed-layout">
        <Navbar />
        <main className="feed-main">
          <CreatePostBox />
          <FeedSkeleton />
        </main>
        <aside className="feed-sidebar">
          <SidebarSkeleton />
        </aside>
      </div>
    );
  }

  if (isProtectedPath && !user) {
    return null;
  }

  return <>{children}</>;
}