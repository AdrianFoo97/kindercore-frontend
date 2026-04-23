import React from 'react';

// Public type — single knob for the page: which outcome is currently
// filtered. `null` means "All".
export type OutcomeKey = 'attended' | 'noShow' | 'unqualified' | 'pending';
export type OutcomeCounts = Record<OutcomeKey, number>;

// ── Status configuration ──────────────────────────────────────────────────
// Order reads left-to-right as overview → needs action → outcomes → archive,
// so a rep's eye lands on their to-do list first. Colour is load-bearing on
// the dot alone; everything else stays neutral typography. Dot colours
// mirror the Monthly Enquiries chart legend so the whole page speaks one
// visual language.
//   Pending     slate-500 — undecided / neutral
//   No show     red-500   — risk
//   Attended    emerald-500 — success
//   Unqualified amber-500 — concern, amber matches the chart legend
const STATUSES: Array<{ key: OutcomeKey; label: string; dot: string }> = [
  { key: 'pending',     label: 'Pending',     dot: '#64748b' },
  { key: 'noShow',      label: 'No show',     dot: '#ef4444' },
  { key: 'attended',    label: 'Attended',    dot: '#10b981' },
  { key: 'unqualified', label: 'Unqualified', dot: '#f59e0b' },
];

// Tailwind tokens referenced throughout (for future migration):
//   tray bg       slate-100    #f1f5f9
//   tray border   slate-200    #e2e8f0
//   divider       slate-300    #cbd5e1
//   hover bg      slate-200    #e2e8f0
//   active chip   white        #ffffff
//   label fg      slate-600    #475569  (inactive)
//                 slate-900    #0f172a  (active)
//   count fg      slate-700    #334155  (inactive)
//                 slate-900    #0f172a  (active)
//   percent fg    slate-400    #94a3b8
//   separator     slate-300    #cbd5e1
//   focus ring    indigo-500   #6366f1

interface OutcomeFilterBarProps {
  counts: OutcomeCounts;
  total: number;
  active: OutcomeKey | null;
  onChange: (next: OutcomeKey | null) => void;
}

export default function OutcomeFilterBar({ counts, total, active, onChange }: OutcomeFilterBarProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter leads by outcome"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: 3,
        background: '#f1f5f9',
        border: '1px solid #e2e8f0',
        borderRadius: 9,
      }}
    >
      <FilterTab
        label="All"
        count={total}
        percent={null}
        dot={null}
        isActive={active === null}
        onClick={() => onChange(null)}
      />
      {/* Structural divider — "All" is the overview toggle, statuses are
          per-bucket filters. Keeps the control feeling like one system. */}
      <span
        aria-hidden="true"
        style={{ width: 1, height: 16, background: '#cbd5e1', margin: '0 4px', alignSelf: 'center' }}
      />
      {STATUSES.map(s => {
        const count = counts[s.key] ?? 0;
        if (count <= 0) return null;
        const percent = total > 0 ? Math.round((count / total) * 100) : 0;
        const isActive = active === s.key;
        return (
          <FilterTab
            key={s.key}
            label={s.label}
            count={count}
            percent={percent}
            dot={s.dot}
            isActive={isActive}
            onClick={() => onChange(isActive ? null : s.key)}
          />
        );
      })}
    </div>
  );
}

// ── Segment ───────────────────────────────────────────────────────────────
interface FilterTabProps {
  label: string;
  count: number;
  percent: number | null;
  dot: string | null;
  isActive: boolean;
  onClick: () => void;
}

function FilterTab({ label, count, percent, dot, isActive, onClick }: FilterTabProps) {
  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      // Hover: slate-200 (~8% delta from slate-100 tray) — perceptible
      // without being loud. Skipped when the tab is already active.
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#e2e8f0'; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 11px',
        fontSize: 12,
        fontFamily: 'inherit',
        fontWeight: isActive ? 600 : 500,
        color: isActive ? '#0f172a' : '#475569',
        background: isActive ? '#fff' : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        lineHeight: 1.25,
        boxShadow: isActive
          // Two-layer elevation: hairline ring + soft drop. Reads as lift,
          // not ornament.
          ? '0 0 0 1px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.08)'
          : 'none',
        transition: 'background 120ms ease, color 120ms ease, box-shadow 120ms ease',
        outlineOffset: 2,
      }}
    >
      {dot && (
        <span
          aria-hidden="true"
          style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }}
        />
      )}
      <span>{label}</span>
      <span
        style={{
          fontWeight: 700,
          color: isActive ? '#0f172a' : '#334155',
          fontVariantNumeric: 'tabular-nums' as any,
        }}
      >
        {count}
      </span>
      {percent !== null && (
        <>
          {/* Thin middle-dot separator — keeps count and percent visually
              distinct without introducing a third data point. */}
          <span
            aria-hidden="true"
            style={{ color: '#cbd5e1', userSelect: 'none' }}
          >
            ·
          </span>
          <span
            style={{
              fontWeight: 500,
              color: '#94a3b8',
              fontSize: 11,
              fontVariantNumeric: 'tabular-nums' as any,
            }}
          >
            {percent}%
          </span>
        </>
      )}
    </button>
  );
}

// Helper — keeps page code from recomputing counts every render.
export function computeOutcomeCounts<T extends { outcome: OutcomeKey }>(leads: T[]): OutcomeCounts {
  const counts: OutcomeCounts = { attended: 0, noShow: 0, unqualified: 0, pending: 0 };
  for (const l of leads) {
    if (counts[l.outcome] !== undefined) counts[l.outcome]++;
  }
  return counts;
}
