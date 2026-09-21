'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronRight, Check, RotateCcw, ShieldCheck } from 'lucide-react';
import './FilterDropdown.css';

/* ── Risk config (single source of truth) ────────────────────
   Used by the dropdown, the feed banner and the empty state.
   `value` is exactly what goes in the URL (?risk=green) and what
   the backend accepts. ── */
export type RiskValue = 'green' | 'yellow' | 'red';

export interface RiskFilterConfig {
  value: RiskValue;
  emoji: string;
  label: string;
  level: string;
  bannerTitle: string;
  bannerText: string;
  emptyTitle: string;
  emptyText: string;
}

export const RISK_FILTERS: readonly RiskFilterConfig[] = [
  {
    value: 'green',
    emoji: '🟢',
    label: 'Green',
    level: 'Low Risk',
    bannerTitle: 'Green Feed',
    bannerText: 'Showing only low-risk posts.',
    emptyTitle: 'No green posts yet',
    emptyText: 'No posts have been rated low-risk by the ML Brain so far.',
  },
  {
    value: 'yellow',
    emoji: '🟡',
    label: 'Yellow',
    level: 'Medium Risk',
    bannerTitle: 'Yellow Feed',
    bannerText: 'Showing medium-risk posts.',
    emptyTitle: 'No yellow posts yet',
    emptyText: 'No posts have been rated medium-risk by the ML Brain so far.',
  },
  {
    value: 'red',
    emoji: '🔴',
    label: 'Red',
    level: 'High Risk',
    bannerTitle: 'Red Feed',
    bannerText: 'Showing high-risk posts.',
    emptyTitle: 'No red posts yet',
    emptyText: 'No posts have been rated high-risk by the ML Brain so far.',
  },
] as const;

/** Returns the matching config, or null for missing / unknown values. */
export function findRisk(value: string | null | undefined): RiskFilterConfig | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  return RISK_FILTERS.find((r) => r.value === normalized) ?? null;
}

export function buildFeedHref(risk: RiskValue | null): string {
  return risk ? `/feed?risk=${risk}` : '/feed';
}

/* ── Small hook: are we on a phone-sized viewport? ── */
function useIsPhone(maxWidth = 640) {
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setIsPhone(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [maxWidth]);

  return isPhone;
}

/* ── Props ── */
type Variant = 'desktop' | 'menu';

interface FilterDropdownProps {
  /** 'desktop' = navbar dropdown. 'menu' = inside the hamburger menu
      (inline list on tablet, bottom sheet on phones). */
  variant?: Variant;
  /** Called after a filter is applied — the Navbar uses it to close the hamburger. */
  onNavigate?: () => void;
}

/* ── Option list shared by the dropdown and the tablet inline list ── */
function RiskOptionList({
  selected,
  onPick,
  showAll,
}: {
  selected: RiskValue | null;
  onPick: (risk: RiskValue | null) => void;
  showAll: boolean;
}) {
  return (
    <div role="menu" aria-label="AI Feed Filter">
      {showAll && (
        <button
          type="button"
          role="menuitemradio"
          aria-checked={selected === null}
          className={`ai-filter-option${selected === null ? ' selected' : ''}`}
          onClick={() => onPick(null)}
        >
          <span className="ai-filter-option-emoji" aria-hidden="true">📰</span>
          <span className="ai-filter-option-text">
            <span className="ai-filter-option-label">All Posts</span>
          </span>
          {selected === null && <Check size={15} className="ai-filter-check" />}
        </button>
      )}

      {RISK_FILTERS.map((r) => (
        <button
          key={r.value}
          type="button"
          role="menuitemradio"
          aria-checked={selected === r.value}
          className={`ai-filter-option${selected === r.value ? ' selected' : ''}`}
          onClick={() => onPick(r.value)}
        >
          <span className="ai-filter-option-emoji" aria-hidden="true">{r.emoji}</span>
          <span className="ai-filter-option-text">
            <span className="ai-filter-option-label">{r.label}</span>
            <span className="ai-filter-option-desc">{r.level}</span>
          </span>
          {selected === r.value && <Check size={15} className="ai-filter-check" />}
        </button>
      ))}
    </div>
  );
}

/* ── Trigger button content (also used by the Suspense fallback) ── */
function triggerClass(variant: Variant, active: boolean) {
  return variant === 'menu'
    ? `navbar-mobile-menu-link ai-filter-trigger ai-filter-trigger--menu${active ? ' active' : ''}`
    : `navbar-link ai-filter-trigger${active ? ' active' : ''}`;
}

function TriggerContent({ variant, open }: { variant: Variant; open: boolean }) {
  return variant === 'menu' ? (
    <>
      <ShieldCheck size={18} strokeWidth={1.8} />
      <span>AI Filter</span>
      <ChevronRight
        size={16}
        className={`ai-filter-menu-chevron${open ? ' open' : ''}`}
      />
    </>
  ) : (
    <>
      <ShieldCheck size={16} strokeWidth={1.9} />
      <span>AI Filter</span>
      <ChevronDown size={14} className={`ai-filter-chevron${open ? ' open' : ''}`} />
    </>
  );
}

/* ── Main component ── */
function FilterDropdownInner({ variant = 'desktop', onNavigate }: FilterDropdownProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Only meaningful on /feed; anywhere else there is no active filter.
  const activeRisk: RiskValue | null =
    pathname === '/feed' ? findRisk(searchParams.get('risk'))?.value ?? null : null;

  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);          // dropdown (desktop) / inline list (tablet)
  const [sheetOpen, setSheetOpen] = useState(false); // bottom sheet (phone)
  const [draft, setDraft] = useState<RiskValue | null>(activeRisk);
  const rootRef = useRef<HTMLDivElement>(null);

  function apply(risk: RiskValue | null) {
    setOpen(false);
    setSheetOpen(false);
    router.push(buildFeedHref(risk));
    onNavigate?.();
  }

  /* Desktop dropdown: close on outside click / Escape */
  useEffect(() => {
    if (!open || variant !== 'desktop') return;

    function onMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, variant]);

  /* Bottom sheet: Escape closes */
  useEffect(() => {
    if (!sheetOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setSheetOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [sheetOpen]);

  function handleMenuTrigger() {
    if (isPhone) {
      setDraft(activeRisk);
      setSheetOpen(true);
    } else {
      setOpen((prev) => !prev);
    }
  }

  /* ════════ Desktop: navbar dropdown ════════ */
  if (variant === 'desktop') {
    return (
      <div className="ai-filter" ref={rootRef}>
        <button
          type="button"
          className={triggerClass('desktop', activeRisk !== null)}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          <TriggerContent variant="desktop" open={open} />
          {activeRisk && <span className="ai-filter-active-dot" aria-hidden="true" />}
        </button>

        {open && (
          <div className="ai-filter-panel">
            <div className="ai-filter-panel-title">AI Feed Filter</div>
            <div className="ai-filter-divider" />
            <RiskOptionList selected={activeRisk} onPick={apply} showAll />
            <div className="ai-filter-divider" />
            <button
              type="button"
              className="ai-filter-reset"
              onClick={() => apply(null)}
              disabled={activeRisk === null}
            >
              <RotateCcw size={14} />
              <span>Reset Filter</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ════════ Menu: tablet inline list / phone bottom sheet ════════ */
  return (
    <div className="ai-filter ai-filter--menu">
      <button
        type="button"
        className={triggerClass('menu', activeRisk !== null)}
        aria-expanded={isPhone ? sheetOpen : open}
        onClick={handleMenuTrigger}
      >
        <TriggerContent variant="menu" open={open && !isPhone} />
      </button>

      {/* Tablet: expands inline */}
      {open && !isPhone && (
        <div className="ai-filter-inline">
          <div className="ai-filter-panel-title">AI Feed Filter</div>
          <RiskOptionList selected={activeRisk} onPick={apply} showAll={false} />
          <button
            type="button"
            className="ai-filter-reset"
            onClick={() => apply(null)}
            disabled={activeRisk === null}
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
        </div>
      )}

      {/* Phone: bottom sheet. Rendered in a portal so the hamburger menu's
          own positioning can't clip it. `data-filter-sheet` tells the
          Navbar's outside-click handler to ignore clicks inside it. */}
      {sheetOpen &&
        createPortal(
          <div className="ai-filter-sheet-root" data-filter-sheet>
            <div className="ai-filter-sheet-backdrop" onClick={() => setSheetOpen(false)} />
            <div className="ai-filter-sheet" role="dialog" aria-modal="true" aria-label="AI Feed Filter">
              <div className="ai-filter-sheet-handle" aria-hidden="true" />
              <h3 className="ai-filter-sheet-title">AI Feed Filter</h3>

              <div className="ai-filter-sheet-options" role="radiogroup" aria-label="Risk level">
                <label className="ai-filter-radio">
                  <input
                    type="radio"
                    name="ai-risk"
                    checked={draft === null}
                    onChange={() => setDraft(null)}
                  />
                  <span>All Posts</span>
                </label>

                {RISK_FILTERS.map((r) => (
                  <label key={r.value} className="ai-filter-radio">
                    <input
                      type="radio"
                      name="ai-risk"
                      checked={draft === r.value}
                      onChange={() => setDraft(r.value)}
                    />
                    <span>
                      {r.emoji} {r.label}
                      <span className="ai-filter-option-desc"> · {r.level}</span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="ai-filter-sheet-actions">
                <button type="button" className="ai-filter-btn ai-filter-btn--ghost" onClick={() => apply(null)}>
                  Reset
                </button>
                <button type="button" className="ai-filter-btn ai-filter-btn--primary" onClick={() => apply(draft)}>
                  Apply
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

/* useSearchParams() needs a Suspense boundary. Navbar is rendered on many
   pages (not just /feed), so the boundary lives here instead of relying on
   every page to provide one. The fallback is the same button, inert. */
export default function FilterDropdown(props: FilterDropdownProps) {
  const variant = props.variant ?? 'desktop';
  return (
    <Suspense
      fallback={
        <button type="button" className={triggerClass(variant, false)} disabled>
          <TriggerContent variant={variant} open={false} />
        </button>
      }
    >
      <FilterDropdownInner {...props} />
    </Suspense>
  );
}