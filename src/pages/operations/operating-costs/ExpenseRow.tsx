import { forwardRef, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUp, faArrowDown, faBan } from '@fortawesome/free-solid-svg-icons';
import { OperatingCostCategory } from '../../../api/operatingCost.js';
import { C, SIZE, SHADOW, MOTION, RADIUS, fmtRMCompact, RowState, BudgetStatus } from './shared.js';

// ── Theme per budget status ──────────────────────────────────────────────────

interface StatusTheme {
  barColor: string;
}
const STATUS: Record<BudgetStatus, StatusTheme> = {
  none:        { barColor: C.primary },
  within:      { barColor: C.primary },
  approaching: { barColor: C.amber },
  over:        { barColor: C.red },
};

// ── ExpenseRow ───────────────────────────────────────────────────────────────

export interface ExpenseRowProps {
  category: OperatingCostCategory;
  value: number;
  lastMonthValue: number;
  state: RowState;
  isLast: boolean;
  /** True when this specific month's entry is excluded from the operating
   *  cost sum (entry-level override), independent of the category's flag. */
  excluded: boolean;
  /** True when the category or its group already excludes everything —
   *  the entry-level toggle can't turn something the settings turned off
   *  back on, so it's shown locked instead of interactive. */
  locked: boolean;
  onChange: (v: number) => void;
  onToggleExcluded: () => void;
  onCopyLast: () => void;
}

export function ExpenseRow({
  category, value, lastMonthValue, state, isLast, excluded, locked, onChange, onToggleExcluded, onCopyLast,
}: ExpenseRowProps) {
  const hasLast = lastMonthValue > 0;
  const hasValue = value > 0;
  const isHighPriority = state.priority === 'high';

  const budget = category.monthlyBudget ?? 0;
  const hasBudget = budget > 0;
  const budgetPct = hasBudget ? Math.min(100, Math.round((value / budget) * 100)) : 0;

  // Every column uses a fixed content-box height so that rows look identical
  // regardless of whether they render a subline (budget bar / delta / none).
  // The primary text sits at the top of the content-box; sublines flow below.
  const CONTENT_HEIGHT = 42;

  return (
    <div
      className="occ-row"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 148px 216px',
        alignItems: 'center',
        padding: `11px ${SIZE.cardPadX}px`,
        background: C.card,
        gap: 28,
        minHeight: SIZE.rowHeight,
        boxSizing: 'border-box',
        borderBottom: isLast ? 'none' : `1px solid ${C.divider}`,
        transition: `background ${MOTION.fast}`,
      }}
    >
      {/* ── Column 1: name + optional budget progress ── */}
      <div style={{
        minWidth: 0,
        height: CONTENT_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
      }}>
        <div style={{
          fontSize: isHighPriority ? 14 : 13,
          color: hasValue ? C.text : C.textSub,
          fontWeight: isHighPriority ? 700 : (hasValue ? 600 : 500),
          letterSpacing: '-0.015em',
          lineHeight: 1.3,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {category.name}
        </div>
        {hasBudget && hasValue && (
          <BudgetIndicator
            pct={budgetPct}
            status={state.budget}
            budget={budget}
            overBy={value > budget ? value - budget : 0}
          />
        )}
      </div>

      {/* ── Column 2: last month value + delta ── */}
      <div style={{
        minWidth: 0,
        height: CONTENT_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
      }}>
        {hasLast ? (
          <button
            type="button"
            onClick={onCopyLast}
            className="occ-last-pill"
            title={`Click to use last month's value (${fmtRMCompact(lastMonthValue)})`}
            style={{
              padding: 0,
              border: 'none',
              background: 'transparent',
              color: C.mutedMore,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'inherit',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.3,
              cursor: 'pointer',
              letterSpacing: '-0.005em',
              transition: `color ${MOTION.fast}`,
            }}
          >
            {fmtRMCompact(lastMonthValue)}
          </button>
        ) : (
          <span style={{
            fontSize: 12,
            color: C.dim,
            lineHeight: 1.3,
            fontWeight: 600,
          }}>—</span>
        )}
        <DeltaIndicator state={state} />
      </div>

      {/* ── Column 3: money input + per-month exclude toggle ── */}
      <div style={{
        justifySelf: 'end',
        height: CONTENT_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <CurrencyInput
          value={value}
          onChange={onChange}
          presetAmount={category.defaultAmount ?? 0}
        />
        <ExcludeToggle
          excluded={locked || excluded}
          disabled={locked || !hasValue}
          disabledReason={locked ? 'locked' : !hasValue ? 'empty' : null}
          onToggle={onToggleExcluded}
        />
      </div>
    </div>
  );
}

// ── ExcludeToggle ────────────────────────────────────────────────────────────
// Per-(category, month) override: pull just this one entry out of the
// operating cost sum without touching the category/group-level flag. Always
// rendered (even on empty rows) so the column stays neatly aligned — just
// disabled until a value exists, since excluding an empty cell is meaningless
// and a zero-amount row is deleted on save anyway so the flag wouldn't persist.

function ExcludeToggle({
  excluded, disabled, disabledReason, onToggle,
}: {
  excluded: boolean;
  disabled: boolean;
  disabledReason: 'locked' | 'empty' | null;
  onToggle: () => void;
}) {
  const title = disabledReason === 'locked'
    ? 'Already excluded from operating cost — set by this category/main category in Settings'
    : disabledReason === 'empty'
    ? 'Enter an amount first to exclude this month'
    : excluded
    ? 'Excluded from this month’s operating cost total. Click to include again.'
    : 'Click to exclude this month’s entry from the operating cost total (e.g. a one-off spend).';
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onToggle}
      title={title}
      style={{
        flexShrink: 0,
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: RADIUS.control,
        border: `1px solid ${excluded ? '#fecaca' : C.border}`,
        background: excluded ? '#fef2f2' : C.card,
        color: excluded ? C.red : (disabledReason === 'empty' ? C.dim : C.mutedMore),
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabledReason === 'locked' ? 0.7 : 1,
        transition: `all ${MOTION.fast}`,
      }}
    >
      <FontAwesomeIcon icon={faBan} style={{ fontSize: 11 }} />
    </button>
  );
}

// ── BudgetIndicator ──────────────────────────────────────────────────────────

function BudgetIndicator({
  pct, status, budget, overBy,
}: {
  pct: number;
  status: BudgetStatus;
  budget: number;
  overBy: number;
}) {
  const theme = STATUS[status];
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 7,
      fontSize: 11,
      color: C.muted,
      fontVariantNumeric: 'tabular-nums',
      fontWeight: 500,
      letterSpacing: '-0.005em',
    }}>
      <div style={{
        width: 96,
        height: 4,
        background: '#e5e7eb',
        borderRadius: 2,
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: theme.barColor,
          transition: `width ${MOTION.base}, background-color ${MOTION.base}`,
        }} />
      </div>
      {status === 'over' ? (
        <span style={{ color: C.red, fontWeight: 700 }}>
          +{fmtRMCompact(overBy)} over budget
        </span>
      ) : status === 'approaching' ? (
        <span style={{ color: C.amber, fontWeight: 700 }}>
          {pct}% of {fmtRMCompact(budget)}
        </span>
      ) : (
        <span>
          <strong style={{ color: C.textSub, fontWeight: 700 }}>{pct}%</strong>
          <span style={{ color: C.mutedMore }}> of {fmtRMCompact(budget)}</span>
        </span>
      )}
    </div>
  );
}

// ── DeltaIndicator ───────────────────────────────────────────────────────────

function DeltaIndicator({ state }: { state: RowState }) {
  // Missing / new → don't render a delta (the NewPill handles the "new" cue)
  if (state.delta === 'missing' || state.delta === 'new') return null;
  if (state.delta === 'unchanged') {
    return (
      <div style={{
        fontSize: 11,
        color: C.mutedMore,
        marginTop: 4,
        fontWeight: 500,
        letterSpacing: '-0.005em',
      }}>unchanged</div>
    );
  }
  const isIncrease = state.delta === 'up-mild' || state.delta === 'up-significant';
  const color = state.delta === 'up-significant' ? C.red
    : state.delta === 'up-mild' ? C.amber
    : C.green;
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
      fontSize: 11,
      fontWeight: 700,
      color,
      fontVariantNumeric: 'tabular-nums',
      letterSpacing: '-0.005em',
    }}>
      <FontAwesomeIcon icon={isIncrease ? faArrowUp : faArrowDown} style={{ fontSize: 9 }} />
      {fmtRMCompact(Math.abs(state.deltaAmount))}
      {state.deltaPct != null && (
        <span style={{ opacity: 0.72, fontWeight: 600 }}>
          {isIncrease ? '+' : '−'}{Math.abs(state.deltaPct).toFixed(0)}%
        </span>
      )}
    </div>
  );
}

// ── CurrencyInput (status-aware) ─────────────────────────────────────────────

interface CurrencyInputProps {
  value: number;
  onChange: (v: number) => void;
  /** Category default amount. Shown as a placeholder when the field is empty —
      it is NOT persisted unless the user explicitly types a value. */
  presetAmount?: number;
}

const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  function CurrencyInput({ value, onChange, presetAmount = 0 }, ref) {
    const [focused, setFocused] = useState(false);
    const [draft, setDraft] = useState(value === 0 ? '' : String(value));

    useEffect(() => {
      if (!focused) setDraft(value === 0 ? '' : String(value));
    }, [value, focused]);

    const hasValue = draft.length > 0;
    // Shell is always visible with a neutral border. Status (approaching /
    // over budget) is communicated exclusively by the progress bar below the
    // category name, not by this input — the progress bar already carries that
    // information and doubling up looks noisy.
    const borderColor = focused ? C.primary : C.border;

    return (
      <div className="occ-money-shell" style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '0 12px',
        height: SIZE.inputHeight,
        width: SIZE.inputWidth,
        background: C.card,
        border: `1px solid ${borderColor}`,
        borderRadius: RADIUS.control,
        boxShadow: focused ? SHADOW.focusRing : '0 1px 2px rgba(15, 23, 42, 0.03)',
        transition: `background ${MOTION.fast}, border-color ${MOTION.fast}, box-shadow ${MOTION.fast}`,
      }}>
        <span style={{
          fontSize: 10,
          color: focused ? C.primary : C.mutedMore,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          transition: `color ${MOTION.fast}`,
        }}>RM</span>
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          value={draft}
          onFocus={e => { setFocused(true); e.target.select(); }}
          onBlur={() => {
            setFocused(false);
            const n = parseFloat(draft.replace(/,/g, ''));
            onChange(Number.isNaN(n) ? 0 : n);
          }}
          onChange={e => setDraft(e.target.value.replace(/[^0-9.]/g, ''))}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
              const inputs = document.querySelectorAll<HTMLInputElement>('.occ-money-input');
              const idx = Array.from(inputs).indexOf(e.target as HTMLInputElement);
              if (idx >= 0 && idx + 1 < inputs.length) inputs[idx + 1].focus();
            }
          }}
          placeholder={presetAmount > 0 ? String(presetAmount) : ''}
          className="occ-money-input"
          style={{
            flex: 1,
            minWidth: 0,
            padding: 0,
            border: 'none',
            background: 'transparent',
            boxShadow: 'none',
            fontSize: 14,
            color: hasValue ? C.text : C.dim,
            fontWeight: hasValue ? 700 : 400,
            fontVariantNumeric: 'tabular-nums',
            outline: 'none',
            fontFamily: 'inherit',
            textAlign: 'right',
            letterSpacing: '-0.015em',
            appearance: 'none' as any,
            WebkitAppearance: 'none' as any,
          }}
        />
      </div>
    );
  }
);
