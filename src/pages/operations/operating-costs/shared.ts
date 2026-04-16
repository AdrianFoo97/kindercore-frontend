// Design tokens for the Operating Costs page.
// Single source of truth for colors, sizes, typography, motion.

export const C = {
  // Surfaces
  bg: '#f8fafc',
  card: '#ffffff',
  subtle: '#fafbfc',           // meta strips (summary bar top of card)
  subtleDense: '#f5f7fa',      // closing strips (subtotal footer, row hover)
  hover: '#f1f5f9',

  // Text ramp
  text: '#0f172a',
  textStrong: '#0f172a',        // softened from pure black; used only for hero totals
  textSub: '#334155',
  muted: '#64748b',
  mutedMore: '#94a3b8',
  dim: '#cbd5e1',

  // Borders
  border: '#e5e7eb',
  borderSoft: '#f1f5f9',
  divider: '#eef0f4',           // row separators inside the card

  // Primary (indigo)
  primary: '#4f46e5',
  primaryHover: '#4338ca',
  primaryLight: '#eef2ff',
  primaryLightMore: '#e0e7ff',
  primaryBorder: '#c7d2fe',
  primaryRing: 'rgba(79, 70, 229, 0.14)',

  // Semantic
  green: '#059669',
  greenLight: '#d1fae5',
  amber: '#d97706',
  red: '#dc2626',
  redLight: '#fee2e2',
};

export const SIZE = {
  rowHeight: 64,
  pageSize: 10,
  sidebarWidth: 260,
  inputWidth: 164,
  inputHeight: 32,
  lastMonthCol: 130,
  cardPadX: 28,        // single source of horizontal rhythm inside the panel
};

// Radius system: keep it to 3 tokens.
export const RADIUS = {
  card: 12,       // containers (card, section)
  control: 7,    // inputs, buttons, small action pills
  pill: 999,     // status pills / period chip
};

export const MOTION = {
  fast: '0.12s ease',
  base: '0.18s ease',
  panel: '0.25s cubic-bezier(0.4, 0, 0.2, 1)',
};

export const SHADOW = {
  card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.03)',
  cardHover: '0 2px 8px rgba(15, 23, 42, 0.06)',
  button: '0 1px 2px rgba(15, 23, 42, 0.05)',
  buttonPrimary: '0 1px 3px rgba(79, 70, 229, 0.35), 0 1px 2px rgba(79, 70, 229, 0.2)',
  stickyBar: '0 -4px 16px rgba(15, 23, 42, 0.04), 0 -1px 0 rgba(15, 23, 42, 0.04)',
  focusRing: `0 0 0 3px rgba(79, 70, 229, 0.14)`,
};

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
export const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

export function cellKey(categoryId: string, month: number): string {
  return `${categoryId}|${month}`;
}

// Pretty-format ringgit. Empty / zero becomes an em-dash unless showZero is set.
export function fmtRM(v: number, options?: { showZero?: boolean }): string {
  if (v === 0 && !options?.showZero) return '—';
  return `RM ${v.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// Compact display used in sidebars and chips (no decimals).
export function fmtRMCompact(v: number): string {
  if (v === 0) return 'RM 0';
  return `RM ${Math.round(v).toLocaleString('en-MY')}`;
}

// ── Row state ────────────────────────────────────────────────────────────────
// Every expense row is classified so downstream components (sections,
// summaries, progress bars, deltas) can render consistently from a single
// source of truth.

export type RowAttention = 'needs' | 'stable';
export type RowPriority = 'high' | 'normal';
export type DeltaDirection = 'missing' | 'new' | 'unchanged' | 'down' | 'up-mild' | 'up-significant';
export type BudgetStatus = 'none' | 'within' | 'approaching' | 'over';

export interface RowState {
  attention: RowAttention;
  priority: RowPriority;
  delta: DeltaDirection;
  budget: BudgetStatus;
  /** Absolute signed delta in RM (current - last) */
  deltaAmount: number;
  /** Percentage change (undefined if last === 0) */
  deltaPct: number | null;
}

const SIGNIFICANT_DELTA_PCT = 15;   // ≥ +15% = significant increase
const HIGH_IMPACT_THRESHOLD = 1000; // impact ≥ RM 1,000 = bold row

export function computeRowState(
  category: { monthlyBudget: number | null },
  value: number,
  lastMonthValue: number,
): RowState {
  const budget = category.monthlyBudget ?? 0;
  const hasBudget = budget > 0;
  const hasValue = value > 0;
  const hasLast = lastMonthValue > 0;

  const deltaAmount = value - lastMonthValue;
  const deltaPct = hasLast ? (deltaAmount / lastMonthValue) * 100 : null;

  // Delta direction
  let delta: DeltaDirection;
  if (!hasValue) {
    delta = 'missing';
  } else if (!hasLast) {
    delta = 'new';
  } else if (value === lastMonthValue) {
    delta = 'unchanged';
  } else if (value < lastMonthValue) {
    delta = 'down';
  } else {
    delta = (deltaPct ?? 0) >= SIGNIFICANT_DELTA_PCT ? 'up-significant' : 'up-mild';
  }

  // Budget status
  let budgetStatus: BudgetStatus;
  if (!hasBudget) {
    budgetStatus = 'none';
  } else if (value > budget) {
    budgetStatus = 'over';
  } else if (value / budget >= 0.8) {
    budgetStatus = 'approaching';
  } else {
    budgetStatus = 'within';
  }

  // Priority based on max impact (current, last, or budget)
  const impact = Math.max(value, lastMonthValue, budget);
  const priority: RowPriority = impact >= HIGH_IMPACT_THRESHOLD ? 'high' : 'normal';

  // Attention: needs input, over budget, or significant increase
  const attention: RowAttention =
    delta === 'missing' || budgetStatus === 'over' || delta === 'up-significant'
      ? 'needs'
      : 'stable';

  return { attention, priority, delta, budget: budgetStatus, deltaAmount, deltaPct };
}
