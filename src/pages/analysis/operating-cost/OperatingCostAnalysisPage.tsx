import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ComposedChart, LineChart, Bar, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceArea, ReferenceLine } from 'recharts';
import { faCalendar, faCalendarDay, faArrowTrendUp, faArrowTrendDown, faTriangleExclamation, faSackDollar, faChartPie, faScaleBalanced, faUserGroup, faReceipt, faChartLine, faLayerGroup } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { fetchOperatingCostEntries, fetchOperatingCostCategories, fetchOperatingCostGroups } from '../../../api/operatingCost.js';
import { fetchFinanceSummary } from '../../../api/finance.js';
import { useIsMobile } from '../../../hooks/useIsMobile.js';
import { FilterPillStyles, PillSelect, PillToggle, type PillOption } from '../../../components/common/FilterPill.js';
import {
  MONTHS, byMonthTotals, monthsWithData, elapsedMonths, categoryRows, groupRollup, outliers, ratios,
  type CategoryRow, type GroupRow, type Outlier, type MonthAmounts,
} from './model.js';

// ── Design tokens ────────────────────────────────────────────────────────
// Operating cost is an expense surface: slate is the base voice. The only
// loud colors are over/under budget, because that's the one thing that's
// good or bad rather than merely large or small.
const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#e5e7eb',
  gridLine: '#f3f4f6',
  divider: '#f1f5f9',

  text: '#0f172a',
  textSub: '#475569',
  muted: '#64748b',
  mutedSoft: '#94a3b8',

  over: '#dc2626',        // over budget / cost rising
  overBg: '#fef2f2',
  overBorder: '#fecaca',
  under: '#059669',       // under budget / cost falling
  underBg: '#ecfdf5',
  underBorder: '#a7f3d0',

  accent: '#5a67d8',      // admin indigo
  accentBg: '#eef2ff',

  prevYear: '#94a3b8',    // last year's line — context, not headline
  noData: '#f8fafc',      // band over months with nothing recorded
};

// Stack colors. Slate-to-indigo ramp — ordered so the biggest series reads darkest.
const SERIES = ['#334155', '#475569', '#5a67d8', '#64748b', '#7c8cf8', '#94a3b8', '#a5b4fc', '#cbd5e1', '#e2e8f0'];
const OTHER_COLOR = '#e2e8f0';

const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
const RADIUS = 14;
const SHADOW = '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)';

/** Categories beyond this many are folded into "Other" so the stack stays readable. */
const MAX_STACK_SERIES = 8;

/** The app's Navbar is always on screen above the scroll container, so anything
 *  fixed to the viewport has to clear it. */
const NAVBAR_HEIGHT = 50;

function fmtRM(v: number) {
  const sign = v < 0 ? '−' : '';
  return `${sign}RM ${Math.abs(Math.round(v)).toLocaleString('en-MY')}`;
}
function fmtRMShort(v: number) {
  if (Math.abs(v) >= 1000) return `RM ${(v / 1000).toFixed(1)}k`;
  return `RM ${Math.round(v)}`;
}
function fmtPct(v: number) {
  const sign = v < 0 ? '−' : '';
  return `${sign}${Math.abs(v * 100).toFixed(1)}%`;
}
function fmtSignedPct(v: number) {
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(1)}%`;
}

type StackBy = 'group' | 'category';
type SortBy = 'spend' | 'variance' | 'yoy';
/** 'all' = year to date (every recorded month); a number scopes to that month. */
type Period = 'all' | number;

/** Sentinel for "chart the whole main category" in the trend picker. */
const ALL_CATEGORIES = '__all__';

// ── Small presentational pieces (module scope — never nested in a render) ──

function Card({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS, boxShadow: SHADOW, padding: SP.xxl }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: SP.md, marginBottom: SP.lg }}>
        {/* minWidth:0 lets the title block absorb the squeeze; the controls keep
            their intrinsic width instead of wrapping onto separate lines. */}
        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>{title}</h2>
          {subtitle && <div style={{ marginTop: SP.xs, fontSize: 12, color: C.muted }}>{subtitle}</div>}
        </div>
        {right && <div style={{ flexShrink: 0 }}>{right}</div>}
      </div>
      {children}
    </div>
  );
}

function Kpi({ icon, label, value, hint, tone }: { icon: IconDefinition; label: string; value: string; hint?: string; tone?: 'over' | 'under' | 'neutral' }) {
  const color = tone === 'over' ? C.over : tone === 'under' ? C.under : C.text;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS, boxShadow: SHADOW, padding: SP.lg, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: SP.sm, color: C.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        <FontAwesomeIcon icon={icon} style={{ fontSize: 11 }} />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      </div>
      <div style={{ marginTop: SP.sm, fontSize: 22, fontWeight: 800, color, letterSpacing: -0.4 }}>{value}</div>
      <div style={{ marginTop: SP.xs, fontSize: 12, color: C.muted, minHeight: 16 }}>{hint ?? ''}</div>
    </div>
  );
}

/** Only ever fed the recorded months — plotting the empty rest of the year would
 *  draw a fake cliff to zero every trend. */
function Sparkline({ values, width = 84, height = 22 }: { values: number[]; width?: number; height?: number }) {
  const max = Math.max(...values, 0);
  if (max <= 0 || values.length < 2) return <div style={{ width, height, color: C.mutedSoft, fontSize: 11 }}>—</div>;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * (height - 2) - 1).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={C.accent} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

interface TrendDatum {
  month: string;
  /** null (not 0) for months with no entry — the line breaks instead of diving. */
  current: number | null;
  previous: number | null;
}

function TrendTooltip({ active, payload, label, year }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; year?: number }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter(p => p.value != null);
  if (rows.length === 0) return null;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 10, boxShadow: SHADOW, padding: SP.md, minWidth: 150 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: SP.sm }}>{label} {year}</div>
      {rows.map(p => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: SP.md, fontSize: 12, marginBottom: 2 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.textSub }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
            {p.name}
          </span>
          <span style={{ fontWeight: 600, color: C.text }}>{fmtRM(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function TrendStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ marginTop: 2, fontSize: 15, fontWeight: 700, color: C.text }}>{value}</div>
    </div>
  );
}

/** Either one category or a whole main category — same shape, same chart. */
interface TrendSeries {
  name: string;
  months: MonthAmounts;
  prevMonths: MonthAmounts;
  monthlyBudget: number | null;
  /** True when this is a group roll-up, so the budget label can say so. */
  isGroup: boolean;
}

function CategoryTrend({ series, year, recorded, prevRecorded }: { series: TrendSeries; year: number; recorded: Set<number>; prevRecorded: Set<number> }) {
  const data: TrendDatum[] = MONTHS.map((label, i) => ({
    month: label,
    current: recorded.has(i) ? series.months[i] : null,
    previous: prevRecorded.has(i) ? series.prevMonths[i] : null,
  }));

  const recordedValues = [...recorded].sort((a, b) => a - b).map(i => series.months[i]);
  const spent = recordedValues.reduce((s, v) => s + v, 0);
  const avg = recordedValues.length > 0 ? spent / recordedValues.length : 0;
  const peak = recordedValues.length > 0 ? Math.max(...recordedValues) : 0;
  const peakMonth = [...recorded].sort((a, b) => a - b).find(i => series.months[i] === peak);
  const row = series;

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: SP.xxl, marginBottom: SP.lg }}>
        <TrendStat label="Spent" value={fmtRM(spent)} />
        <TrendStat label="Average month" value={fmtRM(avg)} />
        <TrendStat label="Biggest month" value={peakMonth != null ? `${fmtRM(peak)} · ${MONTHS[peakMonth]}` : '—'} />
        <TrendStat
          label={series.isGroup ? 'Budgeted' : 'Budget'}
          value={row.monthlyBudget != null ? `${fmtRM(row.monthlyBudget)} / mo` : 'not set'}
        />
      </div>

      <ResponsiveContainer width="100%" height={260} className="oc-chart">
        <LineChart data={data} margin={{ top: SP.md, right: SP.sm, bottom: SP.sm, left: SP.sm }}>
          <CartesianGrid vertical={false} stroke={C.gridLine} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: C.muted }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: C.muted }} tickFormatter={fmtRMShort} width={64} />
          <Tooltip content={<TrendTooltip year={year} />} cursor={{ stroke: C.mutedSoft, strokeDasharray: '3 3' }} />
          {row.monthlyBudget != null && (
            <ReferenceLine
              y={row.monthlyBudget}
              stroke={C.over}
              strokeDasharray="5 4"
              label={{ value: 'Budget', position: 'insideTopRight', fontSize: 11, fill: C.over }}
            />
          )}
          <Line type="monotone" dataKey="previous" name={`${year - 1}`} stroke={C.prevYear} strokeWidth={2} strokeDasharray="4 3" dot={false} connectNulls={false} />
          <Line type="monotone" dataKey="current" name={`${year}`} stroke={C.accent} strokeWidth={2.5} dot={{ r: 3, fill: C.accent }} activeDot={{ r: 5 }} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </>
  );
}

function VarianceCell({ variance, variancePct }: { variance: number | null; variancePct: number | null }) {
  if (variance == null) return <span style={{ color: C.mutedSoft }}>—</span>;
  // Exactly on budget is its own state — without this it renders as "−RM 0".
  if (Math.round(variance) === 0) return <span style={{ color: C.muted, fontWeight: 600 }}>on budget</span>;
  const over = variance > 0;
  return (
    <span style={{ color: over ? C.over : C.under, fontWeight: 700 }}>
      {over ? '+' : '−'}{fmtRM(Math.abs(variance)).replace('RM ', 'RM ')}
      {variancePct != null && <span style={{ fontWeight: 600, opacity: 0.75 }}> ({fmtSignedPct(variancePct)})</span>}
    </span>
  );
}

function YoyCell({ delta, pct }: { delta: number; pct: number | null }) {
  if (pct == null) {
    return <span style={{ color: C.mutedSoft }}>{delta > 0 ? 'new' : '—'}</span>;
  }
  const up = delta > 0;
  return (
    <span style={{ color: up ? C.over : C.under, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <FontAwesomeIcon icon={up ? faArrowTrendUp : faArrowTrendDown} style={{ fontSize: 10 }} />
      {fmtSignedPct(pct)}
    </span>
  );
}

/** Columns are fixed, not content-sized, so amounts and variances line up down
 *  the page instead of drifting with the length of each number. */
const BREAKDOWN_COLS = 'minmax(140px, 1.4fr) minmax(120px, 2fr) 96px 92px';
/** A recorded RM 20 next to a RM 4,200 would round to no bar at all. Give every
 *  non-zero amount a sliver so "small" still reads as present, not absent. */
const MIN_BAR_PCT = 1.5;

interface BreakdownItem {
  id: string;
  name: string;
  groupName: string;
  amount: number;
  /** The budget for the *scoped period* — one month's, or the period's total. */
  budget: number | null;
  share: number;
}

function BreakdownRow({ item, max }: { item: BreakdownItem; max: number }) {
  const { name, groupName, amount, budget, share } = item;
  // Round before comparing so a category sitting exactly on budget doesn't
  // read as "−0" off the back of float noise.
  const onBudget = budget != null && Math.round(amount - budget) === 0;
  const over = budget != null && !onBudget && amount > budget;
  const barPct = max > 0 ? Math.max((amount / max) * 100, amount > 0 ? MIN_BAR_PCT : 0) : 0;
  const budgetPct = budget != null && max > 0 ? Math.min((budget / max) * 100, 100) : null;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: BREAKDOWN_COLS,
      alignItems: 'center',
      gap: SP.md,
      padding: `${SP.sm}px 0`,
      borderBottom: `1px solid ${C.divider}`,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        <div style={{ fontSize: 11, color: C.mutedSoft }}>{groupName} · {(share * 100).toFixed(0)}%</div>
      </div>

      <div style={{ position: 'relative', height: 16, background: C.divider, borderRadius: 4 }}>
        <div style={{ width: `${barPct}%`, height: '100%', background: over ? C.over : C.accent, borderRadius: 4 }} />
        {budgetPct != null && (
          <div
            title={`Budget ${fmtRM(budget!)}`}
            style={{ position: 'absolute', top: -3, bottom: -3, left: `${budgetPct}%`, width: 2, background: C.text, opacity: 0.4, borderRadius: 1 }}
          />
        )}
      </div>

      <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        {fmtRM(amount)}
      </div>

      <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        {budget == null
          ? <span style={{ color: C.mutedSoft }}>—</span>
          : onBudget
            ? <span style={{ color: C.muted }}>on budget</span>
            : <span style={{ color: over ? C.over : C.under }}>
                {over ? '+' : '−'}{Math.abs(Math.round(amount - budget)).toLocaleString('en-MY')}
              </span>}
      </div>
    </div>
  );
}

/** Header for the breakdown list — without it the last two number columns are unlabelled. */
function BreakdownHeader() {
  const cell: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'right',
  };
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: BREAKDOWN_COLS,
      alignItems: 'center',
      gap: SP.md,
      paddingBottom: SP.sm,
      borderBottom: `1px solid ${C.cardBorder}`,
    }}>
      <div style={{ ...cell, textAlign: 'left' }}>Category</div>
      <div />
      <div style={cell}>Spend</div>
      <div style={cell}>vs budget</div>
    </div>
  );
}

function OutlierItem({ o, onSelect }: { o: Outlier; onSelect: (m: number) => void }) {
  const up = o.delta > 0;
  return (
    <button
      type="button"
      onClick={() => onSelect(o.month)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.md,
        width: '100%', textAlign: 'left', padding: `${SP.sm}px ${SP.md}px`,
        background: up ? C.overBg : C.underBg,
        border: `1px solid ${up ? C.overBorder : C.underBorder}`,
        borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
          {o.categoryName} <span style={{ color: C.muted, fontWeight: 600 }}>· {MONTHS[o.month]}</span>
        </div>
        <div style={{ fontSize: 12, color: C.textSub }}>
          {fmtRM(o.amount)} vs {fmtRM(o.baseline)} typical
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: SP.xs, color: up ? C.over : C.under, fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap' }}>
        <FontAwesomeIcon icon={up ? faArrowTrendUp : faArrowTrendDown} style={{ fontSize: 11 }} />
        {fmtSignedPct(o.deltaPct)}
      </div>
    </button>
  );
}

interface StackDatum {
  month: string;
  monthIdx: number;
  prevTotal: number;
  total: number;
  hasData: boolean;
  [series: string]: number | string | boolean;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter(p => p.name !== 'Last year' && p.value > 0);
  const prev = payload.find(p => p.name === 'Last year');
  const total = rows.reduce((s, p) => s + p.value, 0);
  return (
    <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 10, boxShadow: SHADOW, padding: SP.md, minWidth: 180 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: SP.sm }}>{label}</div>
      {rows.length === 0 && <div style={{ fontSize: 12, color: C.muted }}>Nothing recorded</div>}
      {rows.map(p => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.md, fontSize: 12, marginBottom: 2 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.textSub, minWidth: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
          </span>
          <span style={{ fontWeight: 600, color: C.text, whiteSpace: 'nowrap' }}>{fmtRM(p.value)}</span>
        </div>
      ))}
      {rows.length > 0 && (
        <div style={{ marginTop: SP.sm, paddingTop: SP.sm, borderTop: `1px solid ${C.divider}`, display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: C.text }}>
          <span>Total</span><span>{fmtRM(total)}</span>
        </div>
      )}
      {prev && prev.value > 0 && (
        <div style={{ marginTop: SP.xs, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted }}>
          <span>Last year</span><span>{fmtRM(prev.value)}</span>
        </div>
      )}
    </div>
  );
}

interface FilterProps {
  year: number;
  years: number[];
  onYear: (y: number) => void;
  period: Period;
  periodOptions: PillOption[];
  onPeriod: (p: Period) => void;
  includeStaffCost: boolean;
  onIncludeStaffCost: (v: boolean) => void;
}

/** The controls that scope the whole page. Rendered twice (page header,
 *  floating bar), so they must not own any state. Stack-by/sort-by are NOT
 *  here: they only change how one chart/table is drawn, so they live there. */
function FilterControls({ year, years, onYear, period, periodOptions, onPeriod, includeStaffCost, onIncludeStaffCost }: FilterProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: SP.sm }}>
      <PillSelect
        icon={faCalendar}
        value={String(year)}
        onChange={v => onYear(Number(v))}
        options={years.map(y => ({ value: String(y), label: String(y) }))}
      />
      <PillSelect
        icon={faCalendarDay}
        value={period === 'all' ? 'all' : String(period)}
        onChange={v => onPeriod(v === 'all' ? 'all' : Number(v))}
        options={periodOptions}
      />
      <PillToggle
        value={includeStaffCost ? 'incl' : 'excl'}
        onChange={v => onIncludeStaffCost(v === 'incl')}
        options={[{ value: 'excl', label: 'Operating only' }, { value: 'incl', label: '+ Staff cost' }]}
      />
    </div>
  );
}

/** Recharts makes its SVG focusable, so clicking a bar leaves the browser's
 *  focus outline drawn as a black box around the whole chart. Keyboard focus
 *  still works — only the mouse-click ring is suppressed. */
function ChartFocusStyles() {
  return (
    <style>{`
      @keyframes oc-float-in {
        from { opacity: 0; transform: translate(-50%, -10px); }
        to   { opacity: 1; transform: translate(-50%, 0); }
      }
      .oc-floating-bar { animation: oc-float-in 0.18s ease-out; }
      @media (prefers-reduced-motion: reduce) {
        .oc-floating-bar { animation: none; }
      }
      .oc-chart .recharts-wrapper:focus,
      .oc-chart .recharts-wrapper:focus-visible,
      .oc-chart .recharts-surface:focus,
      .oc-chart .recharts-surface:focus-visible,
      .oc-chart svg:focus,
      .oc-chart svg:focus-visible,
      .oc-chart g:focus,
      .oc-chart g:focus-visible,
      .oc-chart path:focus,
      .oc-chart path:focus-visible { outline: none; }
    `}</style>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function OperatingCostAnalysisPage() {
  const { isMobile } = useIsMobile();
  // Pinned once. A `new Date()` in the render body is a fresh object identity on
  // every render, and it feeds the `elapsed` memo — which feeds `rows`, which
  // feeds every figure on the page. Left unpinned, none of the memos below hold.
  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();

  const [year, setYear] = useState<number>(currentYear);
  const [stackBy, setStackBy] = useState<StackBy>('group');
  const [sortBy, setSortBy] = useState<SortBy>('spend');
  // Off by default — folding payroll into "operating cost" changes what every
  // KPI on the page means, so it's an opt-in lens rather than the default view.
  const [includeStaffCost, setIncludeStaffCost] = useState(false);
  // null = nothing picked yet, so fall back to the latest month with entries (see
  // `period` below). A month index scopes the summary numbers to that month alone;
  // the charts stay full-year regardless, because a trend of one point isn't a trend.
  const [periodChoice, setPeriodChoice] = useState<Period | null>(null);
  const [trendGroupId, setTrendGroupId] = useState<string | null>(null);
  const [trendCategoryId, setTrendCategoryId] = useState<string | null>(null);

  // The floating bar appears only once the real header has scrolled away —
  // showing both at once would just be the same controls twice.
  //
  // Watch a sentinel rather than window.scrollY: the app scrolls an inner
  // container (App.tsx), not the window, so scrollY is permanently 0 here.
  // IntersectionObserver against the viewport doesn't care which ancestor scrolls.
  const [stuck, setStuck] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { rootMargin: `-${NAVBAR_HEIGHT}px 0px 0px 0px` },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const { data: entriesRes, isLoading: loadingEntries, isError: entriesFailed, refetch: refetchEntries } = useQuery({
    queryKey: ['operating-cost-entries', year],
    queryFn: () => fetchOperatingCostEntries(year),
  });
  const { data: prevEntriesRes } = useQuery({
    queryKey: ['operating-cost-entries', year - 1],
    queryFn: () => fetchOperatingCostEntries(year - 1),
  });
  const { data: categories, isError: categoriesFailed, refetch: refetchCategories } = useQuery({
    queryKey: ['operating-cost-categories'],
    queryFn: fetchOperatingCostCategories,
  });
  const { data: groups } = useQuery({
    queryKey: ['operating-cost-groups'],
    queryFn: fetchOperatingCostGroups,
  });
  const { data: finance } = useQuery({
    queryKey: ['finance-summary', year],
    queryFn: () => fetchFinanceSummary(year),
  });
  // Only consulted when includeStaffCost is on (for the "vs last year" KPI),
  // but React Query hooks must run unconditionally like the other queries here.
  const { data: financePrev } = useQuery({
    queryKey: ['finance-summary', year - 1],
    queryFn: () => fetchFinanceSummary(year - 1),
  });

  // Entries and categories are both load-bearing: without either, every figure on
  // the page is wrong rather than merely incomplete. (The prior year and the
  // finance summary are context — the page degrades gracefully without them.)
  const failed = entriesFailed || categoriesFailed;

  const entries = entriesRes?.rows ?? [];
  const prevEntries = prevEntriesRes?.rows ?? [];

  const elapsed = useMemo(() => elapsedMonths(entries, year, today), [entries, year, today]);
  const recorded = useMemo(() => monthsWithData(entries), [entries]);
  const prevRecorded = useMemo(() => monthsWithData(prevEntries), [prevEntries]);
  const totals = useMemo(() => byMonthTotals(entries), [entries]);
  const prevTotals = useMemo(() => byMonthTotals(prevEntries), [prevEntries]);

  // Default to the latest month that actually has entries — that's the month you
  // just finished keying in, and the one you came here to look at. Falls back to
  // 'all' only when the year has nothing recorded at all.
  const period: Period = periodChoice ?? (elapsed.length > 0 ? elapsed[elapsed.length - 1] : 'all');

  // The months the summary numbers cover. Everything scoped — KPIs, the table,
  // the breakdown — is derived from this one array, so a month and a year can't
  // disagree about what they're measuring.
  const scope = useMemo<number[]>(
    () => (period === 'all' ? elapsed : recorded.has(period) ? [period] : []),
    [period, elapsed, recorded],
  );
  const scopedToMonth = period !== 'all';

  // Rows are built over `scope`, so ytd/budget/variance/prevYtd are already the
  // scoped figures. The 12-month `months` arrays on each row stay full-year, so
  // the charts and outliers still see the whole series.
  const rows = useMemo(
    () => (categories ? categoryRows(entries, prevEntries, categories, scope) : []),
    [entries, prevEntries, categories, scope],
  );
  const groupRows = useMemo(() => groupRollup(rows), [rows]);
  const monthRatios = useMemo(() => ratios(totals, finance?.months), [totals, finance]);
  // Outliers are always year-scoped: a month can only stand out against the
  // others, so scoping them to a single month would leave nothing to compare to.
  const found = useMemo(() => outliers(rows, elapsed), [rows, elapsed]);

  // Only a month-scoped period highlights a bar; "all months" highlights nothing,
  // because nothing is singled out.
  const activeMonth = scopedToMonth ? (period as number) : null;

  // ── KPIs (scoped months only — never mix actual with not-yet-recorded) ──
  const ytd = rows.reduce((s, r) => s + r.ytd, 0);
  const prevYtd = rows.reduce((s, r) => s + r.prevYtd, 0);

  // Staff cost isn't a category (no OperatingCost rows), so it's summed
  // straight from the finance summary rather than through categoryRows —
  // same reduction shape monthRatios below uses for revenue/students.
  const scopedStaffCost = scope.reduce((s, i) => s + (finance?.months[i]?.staffCost ?? 0), 0);
  const prevScopedStaffCost = scope.reduce((s, i) => s + (financePrev?.months[i]?.staffCost ?? 0), 0);

  // "Effective" = what the page shows when the staff-cost toggle is on. Only
  // the figures in the table below switch to these; "vs budget" deliberately
  // keeps using the plain ytd/prevYtd, since no budget exists for staff cost.
  const effectiveYtd = ytd + (includeStaffCost ? scopedStaffCost : 0);
  const effectivePrevYtd = prevYtd + (includeStaffCost ? prevScopedStaffCost : 0);
  const yoyPct = effectivePrevYtd > 0 ? (effectiveYtd - effectivePrevYtd) / effectivePrevYtd : null;

  const budgeted = rows.filter(r => r.ytdBudget != null);
  const ytdBudget = budgeted.length > 0 ? budgeted.reduce((s, r) => s + (r.ytdBudget ?? 0), 0) : null;
  const budgetedSpend = budgeted.reduce((s, r) => s + r.ytd, 0);
  const budgetVariance = ytdBudget != null ? budgetedSpend - ytdBudget : null;
  const budgetVariancePct = ytdBudget != null && ytdBudget > 0 ? budgetVariance! / ytdBudget : null;

  const scopedRevenue = scope.reduce((s, i) => s + (monthRatios[i]?.revenue ?? 0), 0);
  const pctOfRevenue = scopedRevenue > 0 ? effectiveYtd / scopedRevenue : null;
  // scopedStudents is student-months (sum of each month's headcount), which is
  // what makes ytd / scopedStudents a per-student-per-month figure. The number
  // worth showing a human is the average headcount those months were carrying.
  const scopedStudents = scope.reduce((s, i) => s + (monthRatios[i]?.studentCount ?? 0), 0);
  const costPerStudent = scopedStudents > 0 ? effectiveYtd / scopedStudents : null;
  const avgStudents = scope.length > 0 ? scopedStudents / scope.length : 0;
  const latestStudents = scope.length > 0 ? monthRatios[scope[scope.length - 1]]?.studentCount ?? 0 : 0;

  // Every scoped label says which window it covers — a month figure read as a
  // year figure is the whole failure mode of a page like this.
  const periodLabel = scopedToMonth ? `${MONTHS[period as number]} ${year}` : `${year} to date`;
  const periodShort = scopedToMonth ? MONTHS[period as number] : `${scope.length} month${scope.length === 1 ? '' : 's'}`;

  // ── Composition chart ──
  // Amber, deliberately off the slate/indigo SERIES ramp — it's not a real
  // OperatingCost category, so it shouldn't read as one.
  const STAFF_COST_COLOR = '#d97706';

  const stackKeys = useMemo<{ key: string; color: string }[]>(() => {
    const base: { key: string; color: string }[] = stackBy === 'group'
      ? groupRows.map((g, i) => ({ key: g.name, color: SERIES[i % SERIES.length] }))
      : (() => {
          const top = [...rows].filter(r => r.ytd > 0).sort((a, b) => b.ytd - a.ytd).slice(0, MAX_STACK_SERIES);
          const keys = top.map((r, i) => ({ key: r.name, color: SERIES[i % SERIES.length] }));
          if (rows.filter(r => r.ytd > 0).length > MAX_STACK_SERIES) keys.push({ key: 'Other', color: OTHER_COLOR });
          return keys;
        })();
    if (includeStaffCost) base.push({ key: 'Staff Cost', color: STAFF_COST_COLOR });
    return base;
  }, [stackBy, groupRows, rows, includeStaffCost]);

  const chartData = useMemo<StackDatum[]>(() => {
    const topNames = new Set(stackKeys.map(k => k.key));
    return MONTHS.map((label, i) => {
      const staffCost = finance?.months[i]?.staffCost ?? 0;
      const prevStaffCost = financePrev?.months[i]?.staffCost ?? 0;
      const d: StackDatum = {
        month: label,
        monthIdx: i,
        prevTotal: prevTotals[i] + (includeStaffCost ? prevStaffCost : 0),
        total: totals[i] + (includeStaffCost ? staffCost : 0),
        hasData: recorded.has(i),
      };
      if (stackBy === 'group') {
        for (const g of groupRows) d[g.name] = g.months[i];
      } else {
        let other = 0;
        for (const r of rows) {
          if (topNames.has(r.name)) d[r.name] = (d[r.name] as number ?? 0) + r.months[i];
          else other += r.months[i];
        }
        if (topNames.has('Other')) d['Other'] = other;
      }
      if (includeStaffCost) d['Staff Cost'] = staffCost;
      return d;
    });
  }, [stackKeys, stackBy, groupRows, rows, totals, prevTotals, recorded, includeStaffCost, finance, financePrev]);

  /** Contiguous runs of not-recorded months, drawn as a single band each. */
  const noDataBands = useMemo(() => {
    const bands: { from: string; to: string }[] = [];
    let start: number | null = null;
    for (let i = 0; i < 12; i++) {
      const empty = !recorded.has(i);
      if (empty && start == null) start = i;
      if ((!empty || i === 11) && start != null) {
        const end = empty && i === 11 ? i : i - 1;
        bands.push({ from: MONTHS[start], to: MONTHS[end] });
        start = null;
      }
    }
    return bands;
  }, [recorded]);

  const sortedGroups = useMemo(() => {
    const score = (r: CategoryRow) =>
      sortBy === 'spend' ? r.ytd
        : sortBy === 'variance' ? (r.variance ?? -Infinity)
        : (r.yoyPct ?? -Infinity);
    return groupRows.map(g => ({ ...g, categories: [...g.categories].sort((a, b) => score(b) - score(a)) }));
  }, [groupRows, sortBy]);

  // The breakdown covers the scoped period — the whole year to date, or the one
  // month you picked. `r.ytd` and `r.ytdBudget` are already scoped, so this is
  // just a read; no second notion of "selected month" to fall out of sync.
  // scopedStaffCost already sums over `scope`, which is [period] when
  // scopedToMonth and `elapsed` otherwise — so it lines up with totals[period]/ytd
  // in both branches without a second scoping notion.
  const breakdownTotal = (scopedToMonth ? totals[period as number] : ytd) + (includeStaffCost ? scopedStaffCost : 0);
  const breakdownItems = useMemo<BreakdownItem[]>(() => {
    const items = rows
      .map(r => ({
        id: r.id,
        name: r.name,
        groupName: r.groupName,
        amount: r.ytd,
        budget: r.ytdBudget,
        share: breakdownTotal > 0 ? r.ytd / breakdownTotal : 0,
      }))
      .filter(i => i.amount > 0);
    if (includeStaffCost && scopedStaffCost > 0) {
      items.push({
        id: '__staff_cost__',
        name: 'Staff Cost',
        groupName: 'Payroll',
        amount: scopedStaffCost,
        budget: null,
        share: breakdownTotal > 0 ? scopedStaffCost / breakdownTotal : 0,
      });
    }
    return items.sort((a, b) => b.amount - a.amount);
  }, [rows, breakdownTotal, includeStaffCost, scopedStaffCost]);
  const breakdownMax = breakdownItems.length > 0
    ? Math.max(...breakdownItems.map(i => Math.max(i.amount, i.budget ?? 0)))
    : 0;

  // Trend card: pick a main category, then either the whole thing or one
  // category within it. Defaults to the whole main category — the wider view
  // first, drill down second.
  const spendRanked = useMemo(() => [...rows].filter(r => r.ytd > 0).sort((a, b) => b.ytd - a.ytd), [rows]);
  const trendGroup = trendGroupId ?? spendRanked[0]?.groupId ?? groupRows[0]?.id ?? null;
  const trendGroupRow = groupRows.find(g => g.id === trendGroup) ?? null;
  const trendGroupCats = useMemo(
    () => rows.filter(r => r.groupId === trendGroup),
    [rows, trendGroup],
  );

  const selectedCat = trendCategoryId === ALL_CATEGORIES
    ? null
    : trendGroupCats.find(r => r.id === trendCategoryId) ?? null;

  const trendSeries: TrendSeries | null =
    selectedCat
      ? { name: selectedCat.name, months: selectedCat.months, prevMonths: selectedCat.prevMonths, monthlyBudget: selectedCat.monthlyBudget, isGroup: false }
      : trendGroupRow
        ? { name: `All of ${trendGroupRow.name}`, months: trendGroupRow.months, prevMonths: trendGroupRow.prevMonths, monthlyBudget: trendGroupRow.monthlyBudget, isGroup: true }
        : null;

  // groupRows only contains groups that actually have categories, so empty
  // groups never reach the picker.
  const trendGroupOptions = useMemo(
    () => groupRows.map(g => ({ value: g.id, label: g.name })),
    [groupRows],
  );
  // Alphabetical — you pick a category by knowing its name, not its rank.
  const trendOptions = useMemo(
    () => [
      { value: ALL_CATEGORIES, label: 'All categories' },
      ...[...trendGroupCats]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(r => ({ value: r.id, label: r.ytd > 0 ? r.name : `${r.name} (nothing recorded)` })),
    ],
    [trendGroupCats],
  );

  /** Switching main category resets to its roll-up rather than stranding a
   *  category id that belongs to the group you just left. */
  const selectTrendGroup = (groupId: string) => {
    setTrendGroupId(groupId);
    setTrendCategoryId(ALL_CATEGORIES);
  };

  const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
  const hasAnything = rows.some(r => r.ytd > 0) || totals.some(t => t > 0);
  const elapsedLabel = elapsed.length > 0
    ? `${elapsed.length} recorded month${elapsed.length === 1 ? '' : 's'} (${MONTHS[elapsed[0]]}–${MONTHS[elapsed[elapsed.length - 1]]})`
    : 'no months recorded yet';

  // Only recorded months are offered — picking an empty month would scope every
  // number on the page to zero and read as "we spent nothing" rather than
  // "nobody has keyed this in".
  const periodOptions = [
    { value: 'all', label: 'All months' },
    ...elapsed.map(i => ({ value: String(i), label: `${MONTHS[i]} ${year}` })),
  ];

  const gutter = isMobile ? SP.lg : SP.xxl;

  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      <FilterPillStyles />
      <ChartFocusStyles />

      {/* Floating filter bar — only exists once you've scrolled the real header
          away. Detached from the layout entirely (position: fixed), so nothing
          below it shifts when it appears. */}
      {stuck && (
        <div
          className="oc-floating-bar"
          style={{
            position: 'fixed',
            top: NAVBAR_HEIGHT + SP.md,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            gap: SP.md,
            maxWidth: `calc(100vw - ${gutter * 2}px)`,
            padding: `${SP.sm}px ${SP.md}px`,
            borderRadius: 999,
            background: 'rgba(255, 255, 255, 0.82)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${C.cardBorder}`,
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(15, 23, 42, 0.06)',
            overflowX: 'auto',
          }}
        >
          <FilterControls
            year={year}
            years={years}
            onYear={y => { setYear(y); setPeriodChoice(null); }}
            period={period}
            periodOptions={periodOptions}
            onPeriod={setPeriodChoice}
            includeStaffCost={includeStaffCost}
            onIncludeStaffCost={setIncludeStaffCost}
          />
        </div>
      )}

      <div style={{ padding: gutter }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: SP.lg }}>

        {/* Header — stays in the page flow; the floating bar takes over on scroll. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: SP.md }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: -0.4 }}>
              Operating Cost Analysis
            </h1>
            <div style={{ marginTop: SP.xs, fontSize: 13, color: C.muted }}>
              Where the money goes, against budget and against last year — {year}, {elapsedLabel}.
            </div>
          </div>
          <FilterControls
            year={year}
            years={years}
            onYear={y => { setYear(y); setPeriodChoice(null); }}
            period={period}
            periodOptions={periodOptions}
            onPeriod={setPeriodChoice}
            includeStaffCost={includeStaffCost}
            onIncludeStaffCost={setIncludeStaffCost}
          />
        </div>

        {/* Watched by the IntersectionObserver. Sits directly below the header, so
            the floating bar appears exactly as the header's controls scroll away. */}
        <div ref={sentinelRef} style={{ height: 1, marginTop: -SP.lg }} />

        {loadingEntries && <div style={{ color: C.muted, fontSize: 13 }}>Loading…</div>}

        {/* A failed request is NOT an empty year. Rendering "nothing recorded"
            when the API is down tells you your costs are zero — the most
            dangerous thing a money page can say. */}
        {failed && (
          <div style={{ background: C.card, border: `1px solid ${C.overBorder}`, borderRadius: RADIUS, boxShadow: SHADOW, padding: SP.xxxl, textAlign: 'center' }}>
            <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 24, color: C.over }} />
            <div style={{ marginTop: SP.md, fontSize: 15, fontWeight: 700, color: C.text }}>Couldn't load operating costs</div>
            <div style={{ marginTop: SP.xs, fontSize: 13, color: C.muted }}>
              The figures below would be wrong, so they're hidden. This is a connection problem, not an empty year.
            </div>
            <button
              type="button"
              onClick={() => { refetchEntries(); refetchCategories(); }}
              style={{
                marginTop: SP.lg, padding: '8px 16px', borderRadius: 9,
                border: `1px solid ${C.cardBorder}`, background: C.card,
                fontSize: 13, fontWeight: 700, color: C.text, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Try again
            </button>
          </div>
        )}

        {!loadingEntries && !failed && !hasAnything && (
          <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS, boxShadow: SHADOW, padding: SP.xxxl, textAlign: 'center' }}>
            <FontAwesomeIcon icon={faReceipt} style={{ fontSize: 24, color: C.mutedSoft }} />
            <div style={{ marginTop: SP.md, fontSize: 15, fontWeight: 700, color: C.text }}>Nothing recorded for {year}</div>
            <div style={{ marginTop: SP.xs, fontSize: 13, color: C.muted }}>
              Key in monthly amounts on the Operating Costs page and this analysis fills in.
            </div>
          </div>
        )}

        {!loadingEntries && !failed && hasAnything && (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: SP.md }}>
              <Kpi
                icon={faSackDollar}
                label={scopedToMonth ? `Spend · ${MONTHS[period as number]}` : 'Spend to date'}
                value={fmtRM(effectiveYtd)}
                hint={scopedToMonth ? `${MONTHS[period as number]} ${year} only` : `across ${scope.length} month${scope.length === 1 ? '' : 's'}`}
              />
              <Kpi
                icon={faScaleBalanced}
                label="vs budget"
                value={budgetVariance == null ? '—' : `${budgetVariance > 0 ? '+' : '−'}${fmtRM(Math.abs(budgetVariance)).replace('RM ', 'RM ')}`}
                hint={ytdBudget == null ? 'no budgets set' : `${fmtRM(budgetedSpend)} of ${fmtRM(ytdBudget)} · ${periodShort}${budgetVariancePct != null ? ` · ${fmtSignedPct(budgetVariancePct)}` : ''}${includeStaffCost ? ' · operating costs only' : ''}`}
                tone={budgetVariance == null ? 'neutral' : budgetVariance > 0 ? 'over' : 'under'}
              />
              <Kpi
                icon={yoyPct != null && yoyPct > 0 ? faArrowTrendUp : faArrowTrendDown}
                label="vs last year"
                value={yoyPct == null ? '—' : fmtSignedPct(yoyPct)}
                hint={
                  effectivePrevYtd > 0
                    ? `${fmtRM(effectivePrevYtd)} · ${scopedToMonth ? `${MONTHS[period as number]} ${year - 1}` : `same months ${year - 1}`}`
                    : `nothing recorded in ${scopedToMonth ? `${MONTHS[period as number]} ` : ''}${year - 1}`
                }
                tone={yoyPct == null ? 'neutral' : yoyPct > 0 ? 'over' : 'under'}
              />
              <Kpi
                icon={faChartPie}
                label="% of revenue"
                value={pctOfRevenue == null ? '—' : fmtPct(pctOfRevenue)}
                hint={scopedRevenue > 0 ? `of ${fmtRM(scopedRevenue)} · ${periodShort}` : 'no revenue recorded'}
              />
              <Kpi
                icon={faUserGroup}
                label="Cost per student"
                value={costPerStudent == null ? '—' : fmtRM(costPerStudent)}
                hint={
                  scopedStudents > 0
                    ? scopedToMonth
                      ? `${latestStudents} students in ${MONTHS[period as number]}`
                      : `per month · avg ${Math.round(avgStudents)} students (${latestStudents} in ${MONTHS[scope[scope.length - 1]]})`
                    : 'no students enrolled'
                }
              />
            </div>

            {/* Composition over time */}
            <Card
              title="Monthly spend"
              subtitle={`Stacked by ${stackBy === 'group' ? 'main category' : `category (top ${MAX_STACK_SERIES})`}${includeStaffCost ? ', plus staff cost' : ''}. The dashed line is ${year - 1}. Click a bar to scope the page to that month.`}
              right={
                <div style={{ display: 'flex', alignItems: 'center', gap: SP.md }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>
                    <span style={{ width: 14, height: 2, background: C.prevYear, borderRadius: 1 }} />
                    {year - 1}
                  </span>
                  <PillToggle
                    value={stackBy}
                    onChange={v => setStackBy(v as StackBy)}
                    options={[{ value: 'group', label: 'Main category' }, { value: 'category', label: 'Category' }]}
                  />
                </div>
              }
            >
              <ResponsiveContainer width="100%" height={320} className="oc-chart">
                <ComposedChart
                  data={chartData}
                  margin={{ top: SP.md, right: SP.sm, bottom: SP.sm, left: SP.sm }}
                  onClick={state => {
                    const idx = Number(state?.activeIndex);
                    if (Number.isInteger(idx) && chartData[idx]?.hasData) setPeriodChoice(idx);
                  }}
                >
                  <CartesianGrid vertical={false} stroke={C.gridLine} />
                  {noDataBands.map(b => (
                    <ReferenceArea key={`${b.from}-${b.to}`} x1={b.from} x2={b.to} fill={C.mutedSoft} fillOpacity={0.07} />
                  ))}
                  {activeMonth != null && (
                    <ReferenceArea x1={MONTHS[activeMonth]} x2={MONTHS[activeMonth]} fill={C.accent} fillOpacity={0.07} />
                  )}
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: C.muted }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: C.muted }} tickFormatter={fmtRMShort} width={64} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: C.accent, fillOpacity: 0.05 }} />
                  {stackKeys.map(k => (
                    <Bar key={k.key} dataKey={k.key} stackId="s" fill={k.color} radius={[0, 0, 0, 0]} maxBarSize={38} cursor="pointer" />
                  ))}
                  <Line type="monotone" dataKey="prevTotal" name="Last year" stroke={C.prevYear} strokeWidth={2} strokeDasharray="4 3" dot={false} activeDot={false} />
                </ComposedChart>
              </ResponsiveContainer>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: SP.md, marginTop: SP.md }}>
                {stackKeys.map(k => (
                  <span key={k.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textSub }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: k.color }} />
                    {k.key}
                  </span>
                ))}
              </div>

              {noDataBands.length > 0 && (
                <div style={{ marginTop: SP.md, fontSize: 12, color: C.muted, background: C.noData, border: `1px solid ${C.divider}`, borderRadius: 8, padding: SP.sm }}>
                  Shaded months have no entries recorded. They read as zero here — Finance Analysis projects them from a rolling average instead.
                </div>
              )}
            </Card>

            {/* Selected-month breakdown */}
            <Card
              title={`${periodLabel} breakdown`}
              subtitle={
                scopedToMonth
                  ? `Biggest spend first. The tick marks the category's monthly budget.`
                  : `Biggest spend first, across all ${scope.length} recorded months. The tick marks the budget for those months. Pick a month above, or click a bar, to narrow it.`
              }
              right={<div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmtRM(breakdownTotal)}</div>}
            >
              {breakdownItems.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>Nothing recorded in this period.</div>}
              {breakdownItems.length > 0 && <BreakdownHeader />}
              {breakdownItems.map(item => (
                <BreakdownRow key={item.id} item={item} max={breakdownMax} />
              ))}
            </Card>

            {/* One category, month by month */}
            {trendSeries && (
              <Card
                title="Category trend"
                subtitle={`${trendSeries.name}, month by month against budget and ${year - 1}.`}
                right={
                  <div style={{ display: 'flex', gap: SP.sm }}>
                    <PillSelect
                      icon={faLayerGroup}
                      value={trendGroup ?? ''}
                      onChange={selectTrendGroup}
                      options={trendGroupOptions}
                    />
                    <PillSelect
                      icon={faChartLine}
                      value={selectedCat?.id ?? ALL_CATEGORIES}
                      onChange={setTrendCategoryId}
                      options={trendOptions}
                    />
                  </div>
                }
              >
                <CategoryTrend series={trendSeries} year={year} recorded={recorded} prevRecorded={prevRecorded} />
              </Card>
            )}

            {/* Outliers */}
            {found.length > 0 && (
              <Card
                title="Months that stand out"
                subtitle="Compared against each category's own typical month, not the average across categories."
                right={<FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 13, color: C.mutedSoft }} />}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: SP.sm }}>
                  {found.slice(0, 8).map(o => (
                    <OutlierItem key={`${o.categoryId}-${o.month}`} o={o} onSelect={setPeriodChoice} />
                  ))}
                </div>
                {found.length > 8 && (
                  <div style={{ marginTop: SP.sm, fontSize: 12, color: C.muted }}>
                    Showing the 8 largest of {found.length}.
                  </div>
                )}
              </Card>
            )}

            {/* Category table */}
            <Card
              title="Every category"
              subtitle={
                scopedToMonth
                  ? `${MONTHS[period as number]} ${year} against that month's budget and against ${MONTHS[period as number]} ${year - 1}. Trends stay full-year.`
                  : `Spend to date against budget and against ${year - 1}, for the same recorded months.`
              }
              right={
                <PillToggle
                  value={sortBy}
                  onChange={v => setSortBy(v as SortBy)}
                  options={[{ value: 'spend', label: 'Spend' }, { value: 'variance', label: 'Over budget' }, { value: 'yoy', label: 'Growth' }]}
                />
              }
            >
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                  <thead>
                    <tr>
                      {['Category', scopedToMonth ? MONTHS[period as number] : 'Spend to date', 'Budget', 'Variance', `${year - 1}`, 'YoY', 'Trend'].map((h, i) => (
                        <th key={h} style={{
                          textAlign: i === 0 || i === 6 ? 'left' : 'right',
                          padding: `${SP.sm}px ${SP.md}px`,
                          fontSize: 11, fontWeight: 700, color: C.muted,
                          textTransform: 'uppercase', letterSpacing: 0.4,
                          borderBottom: `1px solid ${C.cardBorder}`, whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedGroups.map(g => (
                      <GroupSection key={g.id} group={g} sparkMonths={elapsed} />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        <div style={{ fontSize: 11, color: C.mutedSoft, textAlign: 'center', paddingBottom: SP.lg }}>
          {groups?.length ?? 0} main categories · {categories?.length ?? 0} categories
        </div>
        </div>
      </div>
    </div>
  );
}

/** A main-category block: the group's own totals, then its categories.
 *  `sparkMonths` are the recorded month indices — the sparkline is drawn over
 *  those alone, so an unfilled Jun–Dec doesn't render as a plunge to zero. */
function GroupSection({ group, sparkMonths }: { group: GroupRow; sparkMonths: number[] }) {
  const cellRight: React.CSSProperties = { textAlign: 'right', padding: `${SP.sm}px ${SP.md}px`, fontSize: 13, whiteSpace: 'nowrap' };
  return (
    <>
      <tr style={{ background: C.accentBg }}>
        <td style={{ padding: `${SP.sm}px ${SP.md}px`, fontSize: 12, fontWeight: 800, color: C.text, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {group.name}
        </td>
        <td style={{ ...cellRight, fontWeight: 800, color: C.text }}>{fmtRM(group.ytd)}</td>
        <td style={{ ...cellRight, color: C.muted }}>{group.ytdBudget == null ? '—' : fmtRM(group.ytdBudget)}</td>
        <td style={cellRight}><VarianceCell variance={group.variance} variancePct={group.variancePct} /></td>
        <td style={{ ...cellRight, color: C.muted }}>{fmtRM(group.prevYtd)}</td>
        <td style={cellRight}><YoyCell delta={group.yoyDelta} pct={group.yoyPct} /></td>
        <td style={{ padding: `${SP.sm}px ${SP.md}px` }}><Sparkline values={sparkMonths.map(i => group.months[i])} /></td>
      </tr>
      {group.categories.map(r => (
        <tr key={r.id} style={{ borderBottom: `1px solid ${C.divider}` }}>
          <td style={{ padding: `${SP.sm}px ${SP.md}px`, paddingLeft: SP.xxl, fontSize: 13, color: r.ytd > 0 ? C.text : C.mutedSoft, fontWeight: 600 }}>
            {r.name}
          </td>
          <td style={{ ...cellRight, fontWeight: 700, color: r.ytd > 0 ? C.text : C.mutedSoft }}>{r.ytd > 0 ? fmtRM(r.ytd) : '—'}</td>
          <td style={{ ...cellRight, color: C.muted }}>{r.ytdBudget == null ? '—' : fmtRM(r.ytdBudget)}</td>
          <td style={cellRight}><VarianceCell variance={r.variance} variancePct={r.variancePct} /></td>
          <td style={{ ...cellRight, color: C.muted }}>{r.prevYtd > 0 ? fmtRM(r.prevYtd) : '—'}</td>
          <td style={cellRight}><YoyCell delta={r.yoyDelta} pct={r.yoyPct} /></td>
          <td style={{ padding: `${SP.sm}px ${SP.md}px` }}><Sparkline values={sparkMonths.map(i => r.months[i])} /></td>
        </tr>
      ))}
    </>
  );
}
