'use client';

const SHARE_REASONS = [
  { reason: 'needs_attention', label: '🚨 Needs attention' },
  { reason: 'agree', label: '✅ I agree' },
  { reason: 'funny', label: '😄 Funny' },
  { reason: 'insightful', label: '💡 Insightful' },
  { reason: 'concerning', label: '⚠️ Concerning' },
  { reason: 'educational', label: '📚 Educational' },
];

export function ShareSheet({
  postId,
  onSelect,
  onClose,
}: {
  postId: string;
  onSelect: (postId: string, reason: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="share-sheet-overlay" onClick={onClose}>
      <div className="share-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="share-sheet-title">Why are you passing this forward?</div>
        <div className="share-sheet-options">
          {SHARE_REASONS.map(({ reason, label }) => (
            <button
              key={reason}
              type="button"
              className="share-reason-btn"
              onClick={() => onSelect(postId, reason)}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="share-sheet-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
