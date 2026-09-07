'use client';

import { useState } from 'react';
import './AISignalCard.css';

// Full shape of what post.controller.js's handleMLResult() saves onto
// mlAnalysis and emits over 'post:ml-analysis'. Everything is kept here
// (including the fields this card doesn't display) so a future detail
// view can read them without touching the backend again.
export type MLAnalysis = {
  language?: string | null;
  languageConfidence?: number | null;
  sentiment?: string | null;
  sarcasm?: boolean | null;
  sarcasmProbability?: number | null;
  toxicity?: number | null;
  toxicityLevel?: string | null;
  riskFlag?: 'green' | 'yellow' | 'red' | null;
  explanation?: string | null;
  // NEW: single 0–1 "how sure is the model" number from ML Brain
  // (toxic-bert's top-label score, falling back to language-detection
  // confidence). Drives the "Confidence" row below — NOT the same
  // number as languageConfidence, which only covers language detection.
  confidence?: number | null;
  signal?: string | null;
  signalMessage?: string | null;
  analyzedAt?: string | null;
};

const RISK_META: Record<string, { icon: string; badgeClass: string; label: string }> = {
  green: { icon: '🟢', badgeClass: 'ai-signal-badge--green', label: 'Green' },
  yellow: { icon: '🟡', badgeClass: 'ai-signal-badge--yellow', label: 'Yellow' },
  red: { icon: '🔴', badgeClass: 'ai-signal-badge--red', label: 'Red' },
};

// Short language codes -> display names. Covers what detectLanguage.js /
// the ML Brain send; falls back to the raw value for anything else so an
// unexpected code still shows something instead of going blank.
const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  bn: 'Bangla',
  mixed: 'Mixed',
};

function formatLanguage(language?: string | null) {
  if (!language) return '—';
  return LANGUAGE_LABELS[language.toLowerCase()] ?? language;
}

function capitalize(value?: string | null) {
  if (!value) return '—';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

// 0.91 -> "91%", 1.0 -> "100%" — works for any 0..1 score (confidence,
// languageConfidence, sarcasmProbability, etc).
function formatConfidence(confidence?: number | null) {
  if (confidence === null || confidence === undefined) return '—';
  return `${Math.round(confidence * 100)}%`;
}

export function AISignalCard({
  mlAnalysis,
  hasText,
}: {
  mlAnalysis?: MLAnalysis | null;
  hasText: boolean;
}) {
  // Collapsed by default — matches the pre-defense UI direction: lead
  // with the Red/Yellow/Green decision + explanation, keep the
  // technical breakdown one tap away instead of showing it immediately.
  const [expanded, setExpanded] = useState(false);

  // ── No text at all: image-only post, nothing was ever analyzed ──
  if (!hasText) {
    return (
      <div className="ai-signal-card ai-signal-card--unavailable">
        <div className="ai-signal-brandrow">
          <span className="ai-signal-icon">🧠</span>
          <span className="ai-signal-brand">AI Analysis</span>
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
          <span className="ai-signal-brand">AI Analysis</span>
        </div>
        <div className="ai-signal-shimmer-row">
          <span className="ai-signal-shimmer-dot" />
          <span className="ai-signal-shimmer-bar" />
        </div>
      </div>
    );
  }

  // ── Full result ──
  // Collapsed: brand row + Red/Yellow/Green badge + signalMessage +
  // "▼ Show analysis" link. Expanded (click the link): same, plus the
  // technical breakdown — Language / Sentiment / Sarcasm / Toxicity /
  // Confidence. Deliberately
  // NOT shown even when expanded: sarcasmProbability, the raw toxicity
  // score, and explanation — those stay research/debug-only values.
  const meta = RISK_META[mlAnalysis.riskFlag] ?? RISK_META.green;

  return (
    <div className={`ai-signal-card ai-signal-card--${mlAnalysis.riskFlag}`}>
      <div className="ai-signal-brandrow">
        <span className="ai-signal-icon">🧠</span>
        <span className="ai-signal-brand">AI Analysis</span>
      </div>

      <div className="ai-signal-row">
        <span className={`ai-signal-badge ${meta.badgeClass}`}>
          {meta.icon} {meta.label}
        </span>
      </div>

      {mlAnalysis.signalMessage && (
        <p className="ai-signal-message">{mlAnalysis.signalMessage}</p>
      )}

      {/* ── Toggle link, separate from the brand row — matches the
          "▲ Hide analysis" / "▼ Show analysis" pattern rather than an
          arrow glued onto the header. ── */}
      <button
        type="button"
        className="ai-signal-toggle-link"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          background: 'transparent',
          border: 'none',
          padding: '4px 0',
          margin: 0,
          font: 'inherit',
          fontSize: '0.85em',
          opacity: 0.8,
          cursor: 'pointer',
        }}
      >
        {expanded ? '▲ Hide analysis' : '▼ Show analysis'}
      </button>

      {expanded && (
        <div className="ai-signal-details">
          <div className="ai-signal-detail-chip">
            <span className="ai-signal-detail-label">Language</span>
            <span className="ai-signal-detail-value">{formatLanguage(mlAnalysis.language)}</span>
          </div>
          <div className="ai-signal-detail-chip">
            <span className="ai-signal-detail-label">Sentiment</span>
            <span className="ai-signal-detail-value">{capitalize(mlAnalysis.sentiment)}</span>
          </div>
          <div className="ai-signal-detail-chip">
            <span className="ai-signal-detail-label">Sarcasm</span>
            <span className="ai-signal-detail-value">{mlAnalysis.sarcasm ? 'Yes' : 'No'}</span>
          </div>
          <div className="ai-signal-detail-chip">
            <span className="ai-signal-detail-label">Toxicity</span>
            <span className="ai-signal-detail-value">{capitalize(mlAnalysis.toxicityLevel)}</span>
          </div>
          <div className="ai-signal-detail-chip">
            <span className="ai-signal-detail-label">Confidence</span>
            <span className="ai-signal-detail-value">{formatConfidence(mlAnalysis.confidence)}</span>
          </div>
        </div>
      )}
    </div>
  );
}