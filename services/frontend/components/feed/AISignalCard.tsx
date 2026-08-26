'use client';

import { useState } from 'react';
import './AISignalCard.css';

export type MLAnalysis = {
  sentiment?: string | null;
  sarcasm?: boolean | null;
  sarcasmProbability?: number | null;
  toxicity?: number | null;
  riskFlag?: 'green' | 'yellow' | 'red' | null;
  signal?: string | null;
  signalMessage?: string | null;
  analyzedAt?: string | null;
};

const RISK_META: Record<
  string,
  { icon: string; badgeClass: string }
> = {
  green: { icon: '🟢', badgeClass: 'ai-signal-badge--green' },
  yellow: { icon: '🟡', badgeClass: 'ai-signal-badge--yellow' },
  red: { icon: '🔴', badgeClass: 'ai-signal-badge--red' },
};

function formatToxicity(toxicity?: number | null) {
  if (toxicity === null || toxicity === undefined) return '—';
  return `${toxicity.toFixed(2)} / 5`;
}

export function AISignalCard({
  mlAnalysis,
  hasText,
}: {
  mlAnalysis?: MLAnalysis | null;
  hasText: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  // ── No text at all: image-only post, nothing was ever analyzed ──
  if (!hasText) {
    return (
      <div className="ai-signal-card ai-signal-card--unavailable">
        <div className="ai-signal-brandrow">
          <span className="ai-signal-icon">🧠</span>
          <span className="ai-signal-brand">VerbaScope AI</span>
        </div>
        <div className="ai-signal-row">
          <span className="ai-signal-badge ai-signal-badge--neutral">⚪ Analysis unavailable</span>
        </div>
        <p className="ai-signal-message">No text found to analyze.</p>
      </div>
    );
  }

  // ── Has text, but the ML result hasn't come back yet ──
  if (!mlAnalysis?.riskFlag) {
    return (
      <div className="ai-signal-card ai-signal-card--analyzing">
        <div className="ai-signal-brandrow">
          <span className="ai-signal-icon ai-signal-icon--spin">🧠</span>
          <span className="ai-signal-brand">VerbaScope AI</span>
        </div>
        <div className="ai-signal-shimmer-row">
          <span className="ai-signal-shimmer-dot" />
          <span className="ai-signal-shimmer-bar" />
        </div>
      </div>
    );
  }

  // ── Full result ──
  const meta = RISK_META[mlAnalysis.riskFlag] ?? RISK_META.green;

  return (
    <div className={`ai-signal-card ai-signal-card--${mlAnalysis.riskFlag}`}>
      <div className="ai-signal-brandrow">
        <span className="ai-signal-icon">🧠</span>
        <span className="ai-signal-brand">VerbaScope AI</span>
      </div>

      <div className="ai-signal-row">
        <span className={`ai-signal-badge ${meta.badgeClass}`}>
          {meta.icon} {mlAnalysis.signal ?? 'Signal'}
        </span>
      </div>

      {mlAnalysis.signalMessage && (
        <p className="ai-signal-message">💡 {mlAnalysis.signalMessage}</p>
      )}

      <button
        type="button"
        className="ai-signal-expand-btn"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? '▲ Hide analysis' : '▼ Why this signal?'}
      </button>

      {expanded && (
        <div className="ai-signal-details">
          <div className="ai-signal-detail-chip">
            <span className="ai-signal-detail-label">😊 Sentiment</span>
            <span className="ai-signal-detail-value">{mlAnalysis.sentiment ?? '—'}</span>
          </div>
          <div className="ai-signal-detail-chip">
            <span className="ai-signal-detail-label">🎭 Sarcasm</span>
            <span className="ai-signal-detail-value">{mlAnalysis.sarcasm ? 'Yes' : 'No'}</span>
          </div>
          <div className="ai-signal-detail-chip">
            <span className="ai-signal-detail-label">☣ Toxicity</span>
            <span className="ai-signal-detail-value">{formatToxicity(mlAnalysis.toxicity)}</span>
          </div>
        </div>
      )}
    </div>
  );
}