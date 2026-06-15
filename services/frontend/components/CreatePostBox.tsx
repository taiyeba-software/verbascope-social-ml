'use client';

import { useState } from 'react';
import './CreatePostBox.css';
import { postService } from '@/lib/api';
import type { Post } from '@/types';
import { useAuth } from '@/hooks/useAuth';

interface CreatePostBoxProps {
  onPost?: (post: Post) => void;
}

export default function CreatePostBox({ onPost }: CreatePostBoxProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!content.trim()) return;
    setIsSubmitting(true);

    try {
      const response = await postService.createPost(content);
      const data = response.data as { success: boolean; post: Post };
      if (data.success) {
        setContent('');
        setIsExpanded(false);
        onPost?.(data.post);
      }
    } catch (err: any) {
      const serverMsg = err?.data?.errors?.[0]?.msg;
      if (serverMsg) {
        alert(serverMsg);
      } else if (err?.status === 422 || err?.status === 400) {
        alert('Post is too long. Please shorten it and try again.');
      } else {
        alert('Failed to create post. Please try again.');
      }
      console.error('Failed to create post', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const initials = user
    ? `${user?.fullname?.firstName?.[0] ?? ''}${user?.fullname?.lastName?.[0] ?? ''}`.toUpperCase() || 'U'
    : 'U';

  const firstName = user?.fullname?.firstName ?? 'there';

  return (
    <form className="create-post-box" onSubmit={handleSubmit}>
      <div className="create-post-header">
        <div className="create-post-avatar">{initials}</div>
        <input
          type="text"
          className="create-post-input"
          placeholder={`What's on your mind, ${firstName}?`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onFocus={() => setIsExpanded(true)}
        />
        <button type="button" className="create-post-media-btn" title="Add image">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <rect x="3" y="3" width="18" height="18" rx="3"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
        </button>
      </div>

      {isExpanded && (
        <div className="create-post-expanded">
          <textarea
            className="create-post-textarea"
            placeholder="Share your thoughts... Verbascope will analyze the emotional tone and sentiment."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
          />

          <div className="create-post-actions">
            <div className="create-post-tools">
              <button type="button" className="tool-btn" title="Add image">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
              </button>
              <button type="button" className="tool-btn" title="Add emoji">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                  <line x1="9" y1="9" x2="9.01" y2="9"></line>
                  <line x1="15" y1="9" x2="15.01" y2="9"></line>
                </svg>
              </button>
            </div>

            <div className="create-post-buttons">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setIsExpanded(false);
                  setContent('');
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={!content.trim() || isSubmitting}
              >
                {isSubmitting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
