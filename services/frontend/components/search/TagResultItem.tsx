'use client';

import { Hash } from 'lucide-react';
import type { SearchTag } from '@/types/search';

interface TagResultItemProps {
  tag: SearchTag;
  active: boolean;
  onSelect: (tag: SearchTag) => void;
}

export function TagResultItem({ tag, active, onSelect }: TagResultItemProps) {
  return (
    <div
      role="option"
      aria-selected={active}
      className={`search-result-item${active ? ' active' : ''}`}
      onClick={() => onSelect(tag)}
    >
      {/* Reuses search-result-avatar's sizing/shape so no new CSS is
         needed — just swaps the initials text for a hash icon. */}
      <div className="search-result-avatar search-tag-avatar">
        <Hash size={16} strokeWidth={2} />
      </div>

      <div className="search-result-body">
        <div className="search-result-top">
          <span className="search-result-name">#{tag.tag}</span>
        </div>
        <p className="search-result-content search-tag-count">
          {tag.postsCount} {tag.postsCount === 1 ? 'post' : 'posts'}
        </p>
      </div>
    </div>
  );
}