'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import FeedSkeleton from './FeedSkeleton';

const PROTECTED_PATHS = ['/feed'];

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isProtectedPath = PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  useEffect(() => {
    if (!isLoading && isProtectedPath && !user) {
      router.replace('/auth/login');
    }
  }, [isLoading, isProtectedPath, router, user]);

  if (isProtectedPath && isLoading) {
    return <FeedSkeleton />;
  }

  if (isProtectedPath && !user) {
    return null;
  }

  return <>{children}</>;
}