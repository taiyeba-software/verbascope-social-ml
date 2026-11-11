'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

// Matches the `content: { maxlength: 3000 }` constraint on the backend's
// Post schema (post.model.js). Single source of truth for the counter,
// the disable-Post-button check, and the pre-flight guard below.
const MAX_CONTENT_LENGTH = 3000;

// The counter turns amber once the user is within 10% of the limit.
const NEAR_LIMIT_THRESHOLD = Math.floor(MAX_CONTENT_LENGTH * 0.9);

export default function CreatePostBox({ onPost }: CreatePostBoxProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previews, setPreviews] = useState<PreviewFile[]>([]);
  // Friendly, user-facing error banner — replaces alert(). The typed
  // content is never cleared on error, so the user can just trim/edit
  // and retry instead of losing their draft.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isOverLimit = content.length > MAX_CONTENT_LENGTH;
  const isNearLimit = !isOverLimit && content.length >= NEAR_LIMIT_THRESHOLD;

  /* ── Auto-grow textarea ──────────────────────────────────────────────
     ONE field is used for both states: a compact one-line pill while
     collapsed, and a textarea that grows with the text once expanded
     (CSS max-height decides when it starts scrolling). Because the same
     element is used for both, the text can never appear twice and the
     keyboard never closes on mobile when the box expands. ── */
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;

    if (!isExpanded) {
      // collapsed: let the CSS height (the one-line pill) apply
      el.style.height = '';
      return;
    }

    el.style.height = 'auto';
    const borders = el.offsetHeight - el.clientHeight;
    el.style.height = `${el.scrollHeight + borders}px`;
  }, [isExpanded]);

  useEffect(() => {
    resizeTextarea();
  }, [content, resizeTextarea]);

  // Wrapping changes when the window is resized or the device rotates
  useEffect(() => {
    window.addEventListener('resize', resizeTextarea);
    return () => window.removeEventListener('resize', resizeTextarea);
  }, [resizeTextarea]);

  const updateContent = (value: string) => {
    setContent(value);
    // Clear any previous error as soon as the user edits again, rather
    // than leaving a stale banner up after they've already fixed it.
    if (errorMessage) setErrorMessage(null);
  };

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
    if (isSubmitting) return;
    if (!content.trim() && previews.length === 0) return;

    // ── Client-side guard ──
    // This is what actually prevents the 422 from ever happening — the
    // request never leaves the browser if the post is already too long.
    // The try/catch below is just a safety net for anything that slips
    // past this (e.g. a stricter server-side limit added later).
    if (isOverLimit) {
      setErrorMessage(
        `Your post exceeds the maximum length (${MAX_CONTENT_LENGTH} characters). Please shorten it before posting.`
      );
      return;
    }

    setErrorMessage(null);
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
        previews.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
        setPreviews([]);
        setIsExpanded(false);
        onPost?.({
          ...data.post,
          isOwner: true,
        });
      }
    } catch (err: any) {
      // ── Friendly, user-facing message instead of a raw error dump ──
      const serverMsg = err?.data?.errors?.[0]?.msg || err?.data?.error;

      if (serverMsg) {
        setErrorMessage(serverMsg);
      } else if (err?.status === 422 || err?.status === 400) {
        setErrorMessage(
          `Your post exceeds the maximum length (${MAX_CONTENT_LENGTH} characters) or contains invalid images. Please review and try again.`
        );
      } else {
        setErrorMessage('Failed to create post. Please try again.');
      }

      // Expected validation failures (422/400) are normal user input
      // errors, not bugs — never logged. Anything else still logs, but
      // only in development, so the demo console stays clean.
      if (
        err?.status !== 422 &&
        err?.status !== 400 &&
        process.env.NODE_ENV === 'development'
      ) {
        console.error('Failed to create post', err);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setIsExpanded(false);
    setContent('');
    setErrorMessage(null);
    previews.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
    setPreviews([]);
    textareaRef.current?.blur();
  };

  // Ctrl/Cmd + Enter posts, like most composers. Plain Enter adds a new line.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const initials = user
    ? `${user?.fullname?.firstName?.[0] ?? ''}${user?.fullname?.lastName?.[0] ?? ''}`.toUpperCase() || 'U'
    : 'U';

  // Same "" vs undefined guard as PostCard's getAuthorAvatarUrl — a user
  // with no avatar yet has avatar: "" from the API, not a missing key, so
  // a plain `user?.avatar` truthiness check alone would have been enough
  // here, but the explicit trim() keeps this consistent with the same
  // check everywhere else avatars are rendered.
  const avatarUrl = user?.avatar && user.avatar.trim() !== '' ? user.avatar : undefined;

  const firstName = user?.fullname?.firstName ?? 'there';

  const counterClass = [
    'create-post-char-counter',
    isOverLimit ? 'is-over-limit' : '',
    isNearLimit ? 'is-near-limit' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <form
      className={`create-post-box${isExpanded ? ' is-expanded' : ''}`}
      onSubmit={handleSubmit}
    >
      <div className="create-post-header">
        <div className="create-post-avatar">
          {avatarUrl ? <img src={avatarUrl} alt={firstName} /> : initials}
        </div>

        {/* The one and only text field (see the auto-grow note above).
            UPDATED: the placeholder is drawn by the <span> below instead of
            the native `placeholder` attribute. A textarea always wraps its
            native placeholder, so on a narrow phone the "?" dropped onto a
            second line. The span stays on one line and ends in "…" when it
            doesn't fit. */}
        <div className="create-post-field">
          <textarea
            ref={textareaRef}
            className="create-post-input"
            aria-label={`What's on your mind, ${firstName}?`}
            value={content}
            rows={1}
            onChange={(e) => updateContent(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            onKeyDown={handleKeyDown}
          />
          {!content && (
            <span className="create-post-placeholder" aria-hidden="true">
              {`What's on your mind, ${firstName}?`}
            </span>
          )}
        </div>

        {/* Collapsed state only — once expanded, the image button lives in
            the footer so there is never a duplicate. */}
        {!isExpanded && (
          <button
            type="button"
            className="create-post-media-btn"
            title="Add image"
            aria-label="Add image"
            onClick={() => {
              setIsExpanded(true);
              fileInputRef.current?.click();
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </button>
        )}
      </div>

      {/* Hidden real file input. It is always mounted, so the collapsed
          image button above can open the picker immediately (when it lived
          inside the expanded block, the first click found no input yet). */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {isExpanded && (
        <div className="create-post-expanded">
          {errorMessage && (
            <div className="create-post-error-banner" role="alert">
              <span aria-hidden="true">❌</span>
              <span>{errorMessage}</span>
            </div>
          )}

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
              <button
                type="button"
                className="tool-btn"
                title={previews.length >= 4 ? 'Maximum 4 images' : 'Add image'}
                aria-label="Add image"
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
              {/* Emoji button removed on purpose: users type emojis with their
                  device's native emoji keyboard (Android / iOS). */}
            </div>

            {/* Live character counter — amber near the limit, red past it,
                so the user sees the problem before ever clicking Post. */}
            <span className={counterClass}>
              {content.length} / {MAX_CONTENT_LENGTH}
            </span>

            <div className="create-post-buttons">
              <button type="button" className="btn btn-ghost" onClick={handleCancel}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={(!content.trim() && previews.length === 0) || isSubmitting || isOverLimit}
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