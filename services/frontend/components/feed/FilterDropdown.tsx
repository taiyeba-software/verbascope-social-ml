'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronRight, RotateCcw, ShieldCheck } from 'lucide-react';
import './FilterDropdown.css';

/* ── Risk config (single source of truth) ────────────────────
   `value` is exactly what goes in the URL and what the backend accepts.
   Canonical order — used for both display and normalizing the URL. ── */
export type RiskValue = 'green' | 'yellow' | 'red';

export const RISK_ORDER: readonly RiskValue[] = ['green', 'yellow', 'red'] as const;

export interface RiskLevelConfig {
  value: RiskValue;
  emoji: string;
  label: string;
  level: string;
}

export const RISK_FILTERS: readonly RiskLevelConfig[] = [
  { value: 'green',  emoji: '🟢', label: 'Green',  level: 'Low Risk' },
  { value: 'yellow', emoji: '🟡', label: 'Yellow', level: 'Medium Risk' },
  { value: 'red',    emoji: '🔴', label: 'Red',    level: 'High Risk' },
] as const;

export interface RiskBannerConfig {
  emoji: string;
  title: string;
  text: string;
  emptyTitle: string;
  emptyText: string;
}

/* Every meaningful combination (3 singles + 3 pairs). The all-three case
   and the empty case are both treated as "no filter" and never reach this. */
const BANNER_BY_KEY: Record<string, RiskBannerConfig> = {
  green: {
    emoji: '🟢',
    title: 'Green Feed',
    text: 'Showing only low-risk posts.',
    emptyTitle: 'No green posts yet',
    emptyText: 'No posts have been rated low-risk by the ML Brain so far.',
  },
  yellow: {
    emoji: '🟡',
    title: 'Yellow Feed',
    text: 'Showing medium-risk posts.',
    emptyTitle: 'No yellow posts yet',
    emptyText: 'No posts have been rated medium-risk by the ML Brain so far.',
  },
  red: {
    emoji: '🔴',
    title: 'Red Feed',
    text: 'Showing high-risk posts.',
    emptyTitle: 'No red posts yet',
    emptyText: 'No posts have been rated high-risk by the ML Brain so far.',
  },
  'green,yellow': {
    emoji: '🟢🟡',
    title: 'Safe Browsing',
    text: 'Showing Green + Yellow posts — high-risk posts are hidden.',
    emptyTitle: 'No matching posts yet',
    emptyText: 'No posts have been rated Green or Yellow by the ML Brain so far.',
  },
  'yellow,red': {
    emoji: '🟡🔴',
    title: 'Review Mode',
    text: 'Showing Yellow + Red posts.',
    emptyTitle: 'No matching posts yet',
    emptyText: 'No posts have been rated Yellow or Red by the ML Brain so far.',
  },
  'green,red': {
    emoji: '🟢🔴',
    title: 'Custom Filter',
    text: 'Showing Green + Red posts.',
    emptyTitle: 'No matching posts yet',
    emptyText: 'No posts have been rated Green or Red by the ML Brain so far.',
  },
};

/** Dedupes, drops unknown values, and sorts into canonical (green, yellow, red) order. */
export function normalizeRisks(values: readonly string[]): RiskValue[] {
  const set = new Set(
    values.map((v) => v.trim().toLowerCase()).filter((v): v is RiskValue => RISK_ORDER.includes(v as RiskValue))
  );
  return RISK_ORDER.filter((r) => set.has(r));
}

/** Parses `?risk=green,yellow`. All 3 colors is normalized to [] (= no filter), same as omitted. */
export function parseRiskParam(param: string | null): RiskValue[] {
  if (!param) return [];
  const risks = normalizeRisks(param.split(','));
  return risks.length === RISK_ORDER.length ? [] : risks;
}

export function buildFeedHref(risks: readonly RiskValue[]): string {
  const normalized = normalizeRisks(risks);
  if (normalized.length === 0 || normalized.length === RISK_ORDER.length) return '/feed';
  return `/feed?risk=${normalized.join(',')}`;
}

/** Banner/empty-state copy for the active selection, or null when there's no active filter. */
export function getRiskBannerConfig(risks: readonly RiskValue[]): RiskBannerConfig | null {
  const normalized = normalizeRisks(risks);
  if (normalized.length === 0 || normalized.length === RISK_ORDER.length) return null;
  return BANNER_BY_KEY[normalized.join(',')] ?? null;
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

function sameRisks(a: readonly RiskValue[], b: readonly RiskValue[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/* ── Props ── */
type Variant = 'desktop' | 'menu';

interface FilterDropdownProps {
  /** 'desktop' = navbar dropdown. 'menu' = inside the hamburger menu
      (inline list on tablet, bottom sheet on phones). */
  variant?: Variant;
  /** Called after Apply/Reset — the Navbar uses it to close the hamburger. */
  onNavigate?: () => void;
}

/* ── Checkbox list shared by the dropdown, tablet inline panel and phone sheet ── */
function RiskCheckboxList({
  draft,
  onToggle,
}: {
  draft: RiskValue[];
  onToggle: (risk: RiskValue) => void;
}) {
  return (
    <div className="ai-filter-checklist" role="group" aria-label="Risk levels">
      {RISK_FILTERS.map((r) => {
        const checked = draft.includes(r.value);
        return (
          <label key={r.value} className={`ai-filter-checkbox-row${checked ? ' checked' : ''}`}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(r.value)}
            />
            <span className="ai-filter-option-emoji" aria-hidden="true">{r.emoji}</span>
            <span className="ai-filter-option-text">
              <span className="ai-filter-option-label">{r.label}</span>
              <span className="ai-filter-option-desc">{r.level}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/* ── Trigger button ── */
function triggerClass(variant: Variant, active: boolean) {
  return variant === 'menu'
    ? `navbar-mobile-menu-link ai-filter-trigger ai-filter-trigger--menu${active ? ' active' : ''}`
    : `navbar-link ai-filter-trigger${active ? ' active' : ''}`;
}

function TriggerContent({
  variant,
  open,
  count,
}: {
  variant: Variant;
  open: boolean;
  count: number;
}) {
  return variant === 'menu' ? (
    <>
      <ShieldCheck size={18} strokeWidth={1.8} />
      <span>AI Filter{count > 0 ? ` (${count})` : ''}</span>
      <ChevronRight size={16} className={`ai-filter-menu-chevron${open ? ' open' : ''}`} />
    </>
  ) : (
    <>
      <ShieldCheck size={16} strokeWidth={1.9} />
      <span>AI Filter{count > 0 ? ` (${count})` : ''}</span>
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
  const activeRisks: RiskValue[] = pathname === '/feed' ? parseRiskParam(searchParams.get('risk')) : [];

  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);          // dropdown (desktop) / inline panel (tablet)
  const [sheetOpen, setSheetOpen] = useState(false); // bottom sheet (phone)

  // Draft selection — the checkboxes the user is currently toggling.
  // Desktop/tablet stay open across toggles; only Apply commits to the URL.
  const [draft, setDraft] = useState<RiskValue[]>(activeRisks);
  const rootRef = useRef<HTMLDivElement>(null);

  function toggleDraft(risk: RiskValue) {
    setDraft((prev) => (prev.includes(risk) ? prev.filter((r) => r !== risk) : [...prev, risk]));
  }

  function apply(risks: RiskValue[]) {
    setOpen(false);
    setSheetOpen(false);
    router.push(buildFeedHref(risks));
    onNavigate?.();
  }

  function openPanel() {
    setDraft(activeRisks); // start from whatever is currently applied
    if (isPhone) {
      setSheetOpen(true);
    } else {
      setOpen((prev) => !prev);
    }
  }

  /* Desktop dropdown: close on outside click / Escape (without applying) */
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

  /* Bottom sheet: Escape closes without applying */
  useEffect(() => {
    if (!sheetOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setSheetOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [sheetOpen]);

  const draftDirty = !sameRisks(normalizeRisks(draft), activeRisks);

  /* ════════ Desktop: navbar dropdown ════════ */
  if (variant === 'desktop') {
    return (
      <div className="ai-filter" ref={rootRef}>
        <button
          type="button"
          className={triggerClass('desktop', activeRisks.length > 0)}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={openPanel}
        >
          <TriggerContent variant="desktop" open={open} count={activeRisks.length} />
        </button>

        {open && (
          <div className="ai-filter-panel">
            <div className="ai-filter-panel-title">AI Feed Filter</div>
            <div className="ai-filter-divider" />
            <RiskCheckboxList draft={draft} onToggle={toggleDraft} />
            <div className="ai-filter-divider" />
            <div className="ai-filter-panel-actions">
              <button
                type="button"
                className="ai-filter-reset"
                onClick={() => {
                  setDraft([]);
                  apply([]);
                }}
                disabled={activeRisks.length === 0 && draft.length === 0}
              >
                <RotateCcw size={14} />
                <span>Reset</span>
              </button>
              <button
                type="button"
                className="ai-filter-apply"
                onClick={() => apply(draft)}
                disabled={!draftDirty}
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ════════ Menu: tablet inline panel / phone bottom sheet ════════ */
  return (
    <div className="ai-filter ai-filter--menu">
      <button
        type="button"
        className={triggerClass('menu', activeRisks.length > 0)}
        aria-expanded={isPhone ? sheetOpen : open}
        onClick={openPanel}
      >
        <TriggerContent variant="menu" open={open && !isPhone} count={activeRisks.length} />
      </button>

      {/* Tablet: expands inline */}
      {open && !isPhone && (
        <div className="ai-filter-inline">
          <div className="ai-filter-panel-title">AI Feed Filter</div>
          <RiskCheckboxList draft={draft} onToggle={toggleDraft} />
          <div className="ai-filter-panel-actions">
            <button
              type="button"
              className="ai-filter-reset"
              onClick={() => {
                setDraft([]);
                apply([]);
              }}
              disabled={activeRisks.length === 0 && draft.length === 0}
            >
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
            <button type="button" className="ai-filter-apply" onClick={() => apply(draft)} disabled={!draftDirty}>
              Apply
            </button>
          </div>
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

              <div className="ai-filter-sheet-options">
                <RiskCheckboxList draft={draft} onToggle={toggleDraft} />
              </div>

              <div className="ai-filter-sheet-actions">
                <button
                  type="button"
                  className="ai-filter-btn ai-filter-btn--ghost"
                  onClick={() => {
                    setDraft([]);
                    apply([]);
                  }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="ai-filter-btn ai-filter-btn--primary"
                  onClick={() => apply(draft)}
                >
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
          <TriggerContent variant={variant} open={false} count={0} />
        </button>
      }
    >
      <FilterDropdownInner {...props} />
    </Suspense>
  );
}