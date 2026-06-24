'use client';

import { useState, useRef } from 'react';
import './CreatePostBox.css';
import { postService } from '@/lib/api';
import type { Post } from '@/types';
import { useAuth } from '@/hooks/useAuth';

interface CreatePostBoxProps {
  onPost?: (post: Post) => void;
}

interface PreviewFile {
  file: File;
  previewUrl: string;
}

export default function CreatePostBox({ onPost }: CreatePostBoxProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previews, setPreviews] = useState<PreviewFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const remaining = 4 - previews.length;
    const toAdd = selected.slice(0, remaining).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setPreviews((prev) => [...prev, ...toAdd]);
    // reset input so same file can be re-selected after removal
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl); // free memory
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!content.trim() && previews.length === 0) return;
    setIsSubmitting(true);

    try {
      // Build FormData so images go as multipart/form-data
      const formData = new FormData();
      formData.append('content', content.trim());
      previews.forEach(({ file }) => formData.append('images', file));

      const response = await postService.createPost(formData);
      const data = response.data as { success: boolean; post: Post };

      if (data.success) {
        setContent('');
        setPreviews([]);
        setIsExpanded(false);
        onPost?.(data.post);
      }
    } catch (err: any) {
      const serverMsg = err?.data?.errors?.[0]?.msg || err?.data?.error;
      if (serverMsg) {
        alert(serverMsg);
      } else if (err?.status === 422 || err?.status === 400) {
        alert('Post is too long or contains invalid images.');
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
        <button
          type="button"
          className="create-post-media-btn"
          title="Add image"
          onClick={() => { setIsExpanded(true); fileInputRef.current?.click(); }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </button>
      </div>

      {isExpanded && (
        <div className="create-post-expanded">
          <textarea
            className="create-post-textarea"
            placeholder="Share your thoughts..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
          />

          {/* Image previews */}
          {previews.length > 0 && (
            <div className="image-preview-grid" data-count={previews.length}>
              {previews.map(({ previewUrl }, i) => (
                <div key={previewUrl} className="image-preview-item">
                  <img src={previewUrl} alt={`preview ${i + 1}`} />
                  <button
                    type="button"
                    className="image-preview-remove"
                    onClick={() => removeImage(i)}
                    aria-label="Remove image"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="create-post-actions">
            <div className="create-post-tools">
              {/* Hidden real file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <button
                type="button"
                className="tool-btn"
                title={previews.length >= 4 ? 'Maximum 4 images' : 'Add image'}
                disabled={previews.length >= 4}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                {previews.length > 0 && (
                  <span className="image-count-badge">{previews.length}/4</span>
                )}
              </button>
              <button type="button" className="tool-btn" title="Add emoji">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
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
                  previews.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
                  setPreviews([]);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={(!content.trim() && previews.length === 0) || isSubmitting}
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