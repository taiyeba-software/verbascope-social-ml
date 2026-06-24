import { useEffect, useRef } from 'react';
import { postService } from '@/lib/api';

/**
 * Tracks how long a post is visible in the viewport.
 * Sends a dwell event if the user spent > 3 seconds on it.
 */
export function useDwellTracker(postId: string) {
  const startTimeRef = useRef<number | null>(null);
  const sentRef = useRef(false); // only send once per mount
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!postId || sentRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          startTimeRef.current = Date.now();
        } else if (startTimeRef.current !== null) {
          const duration = Date.now() - startTimeRef.current;
          startTimeRef.current = null;

          if (duration >= 3000 && !sentRef.current) {
            sentRef.current = true;
            // fire and forget — don't block anything
            postService.recordDwell(postId, duration).catch(() => {});
          }
        }
      },
      { threshold: 0.5 } // 50% of post must be visible
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [postId]);

  return ref;
}