import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import OutcomeFilterBar, { OutcomeKey, OutcomeCounts } from './OutcomeFilterBar.js';

// One row, two halves: scope on the left, outcome sub-filter on the right.
// Makes the parent/child relationship between a channel/address filter and
// the outcome breakdown visually obvious.

interface LeadsFilterStripProps {
  /** Label shown when NO scope filter is active — e.g. "All leads · Apr 2026". */
  contextLabel: string;
  /** Active scope filter value — e.g. "Google". Triggers the removable chip. */
  scopeLabel?: string | null;
  onClearScope?: () => void;
  /** Total leads within the current scope (chip applied, outcome ignored). */
  scopeTotal: number;
  /** Leads actually shown in the table (chip + outcome filter applied). */
  displayedTotal: number;
  outcomeCounts: OutcomeCounts;
  outcomeFilter: OutcomeKey | null;
  onOutcomeChange: (next: OutcomeKey | null) => void;
}

export default function LeadsFilterStrip({
  contextLabel,
  scopeLabel,
  onClearScope,
  scopeTotal,
  displayedTotal,
  outcomeCounts,
  outcomeFilter,
  onOutcomeChange,
}: LeadsFilterStripProps) {
  const hasScope = !!(scopeLabel && onClearScope);
  const hasOutcome = outcomeFilter !== null;
  const leadsNumber = hasOutcome ? `${displayedTotal} of ${scopeTotal}` : `${scopeTotal}`;
  const plural = scopeTotal === 1 && !hasOutcome ? 'lead' : 'leads';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      {/* ── Scope + count (left) ─────────────────────────────────────── */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          color: '#64748b',
          fontWeight: 500,
          fontFamily: 'inherit',
        }}
      >
        {hasScope ? (
          <>
            <ScopeChip label={scopeLabel!} onClear={onClearScope!} />
            <Dot />
            <LeadCount value={leadsNumber} unit={plural} />
          </>
        ) : (
          <>
            <span>{contextLabel}</span>
            <Dot />
            <LeadCount value={leadsNumber} unit={plural} />
          </>
        )}
      </div>

      {/* ── Outcome sub-filter (right) ───────────────────────────────── */}
      {scopeTotal > 0 && (
        <OutcomeFilterBar
          counts={outcomeCounts}
          total={scopeTotal}
          active={outcomeFilter}
          onChange={onOutcomeChange}
        />
      )}
    </div>
  );
}

// ── Bits ────────────────────────────────────────────────────────────────
function Dot() {
  return (
    <span aria-hidden="true" style={{ color: '#cbd5e1', userSelect: 'none' }}>·</span>
  );
}

function LeadCount({ value, unit }: { value: string; unit: string }) {
  return (
    <span>
      <span
        style={{
          fontWeight: 600,
          color: '#0f172a',
          fontVariantNumeric: 'tabular-nums' as any,
        }}
      >
        {value}
      </span>{' '}
      {unit}
    </span>
  );
}

function ScopeChip({ label, onClear }: { label: string; onClear: () => void }) {
  const [hover, setHover] = React.useState(false);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        // Asymmetric padding — tighter next to the remove button so it
        // reads as "part of the chip" rather than a disconnected glyph.
        paddingLeft: 10,
        paddingRight: 3,
        paddingTop: 2,
        paddingBottom: 2,
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: '#0f172a',
        lineHeight: 1.2,
        maxWidth: 260,
      }}
    >
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remove ${label} filter`}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 18,
          height: 18,
          padding: 0,
          marginLeft: 4,
          border: 'none',
          borderRadius: '50%',
          background: hover ? '#f1f5f9' : 'transparent',
          color: hover ? '#334155' : '#94a3b8',
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'background 120ms ease, color 120ms ease',
          outlineOffset: 2,
        }}
      >
        <FontAwesomeIcon icon={faXmark} style={{ fontSize: 10 }} />
      </button>
    </span>
  );
}
