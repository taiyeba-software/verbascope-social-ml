'use client';

import { useEffect, useRef, useState } from 'react';

export function PostMoreMenu({
  postId,
  isOwner,
  onDelete,
}: {
  postId: string;
  isOwner: boolean;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!isOwner) return null;

  return (
    <div className="post-more-wrap" ref={ref}>
      <button
        type="button"
        className="post-more-btn"
        aria-label="More options"
        onClick={() => setOpen((value) => !value)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="5" r="1" fill="currentColor" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
          <circle cx="12" cy="19" r="1" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div className="post-more-dropdown">
          <button
            type="button"
            className="post-more-item danger"
            onClick={() => {
              setOpen(false);
              onDelete(postId);
            }}
          >
            🗑️ Delete post
          </button>
        </div>
      )}
    </div>
  );
}
