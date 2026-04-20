import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ComposedChart, Bar, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Cell, ReferenceArea, ReferenceLine } from 'recharts';
import { faCalendar } from '@fortawesome/free-solid-svg-icons';
import { fetchFinanceSummary, FinanceMonth } from '../../api/finance.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { FilterPillStyles, PillSelect, PillToggle } from '../../components/common/FilterPill.js';

// ── Design tokens ────────────────────────────────────────────────────────
// Semantic palette, kept small and disciplined.
//   • positive / negative  — the only two "loud" colors, reserved for profit.
//   • revenue              — a softer positive; an input, not the headline.
//   • staff / operating    — neutral slate; supporting context, not alarms.
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

  positive: '#059669',      // profit / revenue value
  positiveSoft: '#10b981',  // revenue bar
  positiveMuted: '#6ee7b7', // forecast profit / revenue (lighter semantic tone)
  positiveBg: '#ecfdf5',
  positiveBorder: '#a7f3d0',

  negative: '#dc2626',
  negativeMuted: '#fca5a5', // forecast loss (lighter semantic tone)
  negativeBg: '#fef2f2',
  negativeBorder: '#fecaca',

  nowAccent: '#6366f1',     // left-border indicator on the current row
  nowBg: '#eef2ff',         // slightly tinted background for the current row

  expenseDark: '#475569',   // staff cost  (larger expense → darker slate)
  expenseLight: '#94a3b8',  // operating   (smaller expense → lighter slate)

  highlight: '#eef2ff',     // current / selected period band
};

// Spacing scale (4/8). Use these; don't invent ad-hoc values.
const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
const RADIUS = 14;
const SHADOW = '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)';
const SHADOW_HERO = '0 1px 2px rgba(15, 23, 42, 0.05), 0 4px 12px rgba(15, 23, 42, 0.06)';

function fmtRM(v: number) {
  const sign = v < 0 ? '−' : '';
  return `${sign}RM ${Math.abs(v).toLocaleString('en-MY', { minimumFractionDigits: 0 })}`;
}
function fmtPct(v: number) {
  const sign = v < 0 ? '−' : '';
  return `${sign}${Math.abs(v * 100).toFixed(1)}%`;
}

type GroupBy = 'month' | 'quarter';

interface PeriodEntry {
  key: string;
  label: string;
  revenue: number;
  staffCost: number;
  operatingCost: number;
  profit: number;
  margin: number;
  studentCount: number;
  teacherCount: number;
  isForecast: boolean;
  containsCurrent: boolean;
  /** True if any underlying month's operating cost is projected (no entries). */
  operatingIsProjected: boolean;
}

function buildEntries(months: FinanceMonth[], currentMonthIdx: number, groupBy: GroupBy): PeriodEntry[] {
  if (groupBy === 'month') {
    return months.map((m, i) => ({
      key: String(i),
      label: m.month,
      revenue: m.revenue,
      staffCost: m.staffCost,
      operatingCost: m.operatingCost,
      profit: m.profit,
      margin: m.margin,
      studentCount: m.studentCount,
      teacherCount: m.teacherCount,
      isForecast: m.isForecast,
      containsCurrent: i === currentMonthIdx,
      operatingIsProjected: m.operatingIsProjected,
    }));
  }
  return [0, 1, 2, 3].map(qi => {
    const indices = [qi * 3, qi * 3 + 1, qi * 3 + 2];
    const slice = indices.map(i => months[i]);
    const revenue = slice.reduce((s, m) => s + m.revenue, 0);
    const staffCost = slice.reduce((s, m) => s + m.staffCost, 0);
    const operatingCost = slice.reduce((s, m) => s + m.operatingCost, 0);
    const profit = revenue - staffCost - operatingCost;
    const margin = revenue > 0 ? profit / revenue : 0;
    const last = slice[slice.length - 1];
    return {
      key: `q${qi + 1}`,
      label: `Q${qi + 1}`,
      revenue,
      staffCost,
      operatingCost,
      profit,
      margin,
      studentCount: last.studentCount,
      teacherCount: last.teacherCount,
      isForecast: slice.every(m => m.isForecast),
      containsCurrent: indices.includes(currentMonthIdx),
      operatingIsProjected: slice.some(m => m.operatingIsProjected),
    };
  });
}

export default function FinanceAnalysisPage() {
  const { isMobile } = useIsMobile();
  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [groupBy, setGroupBy] = useState<GroupBy>('month');
  const [period, setPeriod] = useState<string>(() => String(new Date().getMonth()));

  const { data, isLoading } = useQuery({
    queryKey: ['finance-summary', year],
    queryFn: () => fetchFinanceSummary(year),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const entries = useMemo<PeriodEntry[]>(
    () => data ? buildEntries(data.months, data.currentMonthIdx, groupBy) : [],
    [data, groupBy],
  );

  // Single Y-axis covering both stacked expenses and the profit line (which
  // can go negative). Padded at both ends; rounded to clean 1k steps.
  const yDomain = useMemo<[number, number]>(() => {
    if (entries.length === 0) return [0, 0];
    const highs = entries.map(e => Math.max(e.revenue, e.staffCost + e.operatingCost));
    const lows = entries.map(e => Math.min(e.profit, 0));
    const hi = Math.max(...highs, 0);
    const lo = Math.min(...lows, 0);
    const range = hi - lo;
    const pad = range > 0 ? range * 0.12 : 1000;
    return [Math.floor((lo - pad) / 1000) * 1000, Math.ceil((hi + pad) / 1000) * 1000];
  }, [entries]);

  // Chart geometry — used to drive a userSpaceOnUse gradient whose zero-line
  // stop lands at the chart's real y=0 pixel. Recharts' <Line> is rendered
  // inside a <g transform="translate(leftMargin, topMargin)">, so the
  // gradient's user space starts at the top of the plot area (not the svg
  // root). We therefore size the gradient to PLOT_HEIGHT and do NOT re-add
  // the top margin when computing the stop.
  const CHART_HEIGHT = 320;
  const CHART_MARGIN_TOP = SP.md;
  const CHART_MARGIN_BOTTOM = SP.sm;
  const PLOT_HEIGHT = CHART_HEIGHT - CHART_MARGIN_TOP - CHART_MARGIN_BOTTOM;

  // Fraction 0..1 along PLOT_HEIGHT where y_data=0 sits.
  const zeroOffset = useMemo(() => {
    const [lo, hi] = yDomain;
    if (hi <= 0) return 0;
    if (lo >= 0) return 1;
    return hi / (hi - lo);
  }, [yDomain]);

  // Split profit into two series so the forecast segment can render dashed.
  // A month counts as "projection" if it's a future month OR its operating
  // cost was substituted with the forecast value (no saved entries). That way
  // the line goes dashed from the *last fully-actual* month, not at the naive
  // past/future boundary.
  const chartData = useMemo(() => {
    const isProjection = (e: PeriodEntry) => e.isForecast || e.operatingIsProjected;
    return entries.map((e, i) => {
      const next = entries[i + 1];
      const isLastActual = !isProjection(e) && !!next && isProjection(next);
      return {
        ...e,
        actualProfit: isProjection(e) ? null : e.profit,
        forecastProfit: isProjection(e) || isLastActual ? e.profit : null,
      };
    });
  }, [entries]);

  useEffect(() => {
    const now = new Date();
    if (year !== now.getFullYear()) {
      setPeriod('all');
      return;
    }
    const m = now.getMonth();
    setPeriod(groupBy === 'quarter' ? `q${Math.floor(m / 3) + 1}` : String(m));
  }, [year, groupBy]);

  useEffect(() => {
    if (!data || period === 'all') return;
    const entry = entries.find(e => e.key === period);
    if (!entry || entry.isForecast) setPeriod('all');
  }, [data, entries, period]);

  if (isLoading || !data) return <div style={s.centered}>Loading…</div>;

  const selectedEntry = entries.find(e => e.key === period);

  const selected = period === 'all'
    ? {
        label: 'Annual',
        revenue: entries.reduce((acc, e) => acc + e.revenue, 0),
        staffCost: entries.reduce((acc, e) => acc + e.staffCost, 0),
        operatingCost: entries.reduce((acc, e) => acc + e.operatingCost, 0),
        profit: entries.reduce((acc, e) => acc + e.profit, 0),
        margin: 0,
      }
    : {
        label: selectedEntry?.label ?? 'Annual',
        revenue: selectedEntry?.revenue ?? 0,
        staffCost: selectedEntry?.staffCost ?? 0,
        operatingCost: selectedEntry?.operatingCost ?? 0,
        profit: selectedEntry?.profit ?? 0,
        margin: selectedEntry?.margin ?? 0,
      };
  if (period === 'all') selected.margin = selected.revenue > 0 ? selected.profit / selected.revenue : 0;

  const isProfit = selected.profit >= 0;
  // (staff + operating) / revenue. < 100% = healthy; ≥ 100% = operating at a loss.
  const expenseRatio = selected.revenue > 0
    ? (selected.staffCost + selected.operatingCost) / selected.revenue
    : null;

  return (
    <div style={{ ...s.page, ...(isMobile ? { padding: `${SP.xl}px ${SP.md}px` } : {}) }}>
      <style>{`
        .recharts-wrapper *:focus { outline: none !important; }
        .fa-row { transition: background 120ms ease; }
        .fa-row:hover { background: ${C.highlight} !important; }
      `}</style>
      <FilterPillStyles />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Finance Analysis</h1>
        </div>
        <div style={s.filterGroup}>
          <PillSelect
            icon={faCalendar}
            value={String(year)}
            onChange={v => setYear(Number(v))}
            options={(() => {
              const now = new Date().getFullYear();
              return [now - 2, now - 1, now].map(y => ({
                value: String(y),
                label: y === now ? `${y} (current)` : String(y),
              }));
            })()}
          />
          <PillToggle
            value={groupBy}
            onChange={v => setGroupBy(v as GroupBy)}
            options={[
              { value: 'month', label: 'Month' },
              { value: 'quarter', label: 'Quarter' },
            ]}
          />
          <PillSelect
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'all', label: groupBy === 'quarter' ? 'All quarters' : 'All months' },
              ...entries
                .filter(e => !e.isForecast)
                .map(e => ({
                  value: e.key,
                  label: e.containsCurrent ? `${e.label} (current)` : e.label,
                })),
            ]}
          />
        </div>
      </header>

      {/* ── KPI strip: 4 supporting + 1 hero ────────────────────────────── */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr 1fr 1.3fr',
          gap: SP.lg,
          marginBottom: SP.xxl,
        }}
      >
        <KpiCard
          label={`${selected.label} Revenue`}
          value={fmtRM(selected.revenue)}
          accent={C.positiveSoft}
          valueColor={C.positive}
        />
        <KpiCard
          label="Staff Cost"
          value={fmtRM(selected.staffCost)}
          accent={C.expenseDark}
          valueColor={C.textSub}
        />
        <KpiCard
          label="Operating Cost"
          value={fmtRM(selected.operatingCost)}
          accent={C.expenseLight}
          valueColor={C.textSub}
        />
        <KpiCard
          label="Expense Ratio"
          value={expenseRatio == null ? '—' : fmtPct(expenseRatio)}
          accent={expenseRatio != null && expenseRatio >= 1 ? C.negative : C.expenseDark}
          valueColor={expenseRatio != null && expenseRatio >= 1 ? C.negative : C.textSub}
        />
        <HeroKpiCard
          label={isProfit ? 'Profit' : 'Loss'}
          value={fmtRM(selected.profit)}
          margin={fmtPct(selected.margin)}
          isProfit={isProfit}
        />
      </section>

      {/* ── Profit chart ────────────────────────────────────────────────── */}
      <section style={s.card}>
        <div style={s.cardHeader}>
          <div>
            <h2 style={s.cardTitle}>Profit by {groupBy === 'quarter' ? 'Quarter' : 'Month'}</h2>
            <p style={s.cardSub}>
              <span>Actual {fmtRM(data.totals.actual.profit)}</span>
              <SubDot />
              <span>Forecast {fmtRM(data.totals.forecast.profit)}</span>
              <SubDot />
              <span style={{ color: data.totals.profit >= 0 ? C.positive : C.negative, fontWeight: 600 }}>
                Annual {fmtRM(data.totals.profit)}
              </span>
            </p>
          </div>
          <ChartLegend />
        </div>

        <div style={{ marginTop: SP.md }}>
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <ComposedChart data={chartData} margin={{ top: CHART_MARGIN_TOP, right: SP.lg, left: 0, bottom: CHART_MARGIN_BOTTOM }} style={{ outline: 'none' }}>
              <defs>
                {/* userSpaceOnUse anchors the gradient to the plot area (the
                    <g> that Recharts wraps the Line in already applies the
                    top-margin translate). `zeroOffset` is a 0..1 fraction of
                    PLOT_HEIGHT placing the stop at the real y=0 pixel. */}
                <linearGradient
                  id="profitGradient"
                  gradientUnits="userSpaceOnUse"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2={PLOT_HEIGHT}
                >
                  <stop offset={zeroOffset} stopColor={C.positive} />
                  <stop offset={zeroOffset} stopColor={C.negative} />
                </linearGradient>
                {/* Hatch pattern for projected (no-data) operating segments. */}
                <pattern
                  id="projectedHatch"
                  patternUnits="userSpaceOnUse"
                  width="6"
                  height="6"
                  patternTransform="rotate(45)"
                >
                  <rect width="6" height="6" fill={C.expenseLight} fillOpacity={0.55} />
                  <line x1="0" y1="0" x2="0" y2="6" stroke="#fff" strokeWidth="2" />
                </pattern>
              </defs>

              <CartesianGrid vertical={false} stroke={C.gridLine} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: C.muted }}
                axisLine={false}
                tickLine={false}
                padding={{ left: SP.sm, right: SP.sm }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: C.mutedSoft }}
                axisLine={false}
                tickLine={false}
                width={56}
                domain={yDomain}
                allowDecimals={false}
                tickFormatter={v => `${v >= 0 ? '' : '−'}${Math.abs(v / 1000).toFixed(0)}k`}
              />

              {/* Loss-zone wash (only when the domain straddles zero) */}
              {zeroOffset > 0 && zeroOffset < 1 && (
                <ReferenceArea y1={yDomain[0]} y2={0} fill={C.negative} fillOpacity={0.03} />
              )}
              <ReferenceLine y={0} stroke={C.cardBorder} strokeWidth={1} />

              {/* Current / selected period band — refined, not heavy */}
              {selectedEntry && (
                <ReferenceArea
                  x1={selectedEntry.label}
                  x2={selectedEntry.label}
                  fill={C.highlight}
                  fillOpacity={0.5}
                  ifOverflow="extendDomain"
                />
              )}

              <Tooltip cursor={{ fill: C.highlight, opacity: 0.35 }} content={<FinanceTooltip />} />

              {/* Revenue (own stackId so it renders as a distinct cluster to
                  the LEFT of the expense stack, respecting declaration order) */}
              <Bar dataKey="revenue" name="Revenue" stackId="rev" radius={[4, 4, 0, 0]} maxBarSize={groupBy === 'quarter' ? 60 : 26}>
                {entries.map((e, i) => (
                  <Cell key={`r-${i}`} fill={C.positiveSoft} fillOpacity={e.isForecast ? 0.45 : 1} />
                ))}
              </Bar>

              {/* Expense stack: staff (dark) + operating (light), both slightly
                  attenuated so they never outshout the revenue bar */}
              <Bar dataKey="staffCost" name="Staff Cost" stackId="exp" radius={[0, 0, 0, 0]} maxBarSize={groupBy === 'quarter' ? 60 : 26}>
                {entries.map((e, i) => (
                  <Cell key={`s-${i}`} fill={C.expenseDark} fillOpacity={e.isForecast ? 0.35 : 0.9} />
                ))}
              </Bar>
              <Bar dataKey="operatingCost" name="Operating Cost" stackId="exp" radius={[4, 4, 0, 0]} maxBarSize={groupBy === 'quarter' ? 60 : 26}>
                {entries.map((e, i) => (
                  <Cell
                    key={`o-${i}`}
                    fill={e.operatingIsProjected ? 'url(#projectedHatch)' : C.expenseLight}
                    fillOpacity={e.operatingIsProjected ? 1 : e.isForecast ? 0.3 : 0.8}
                  />
                ))}
              </Bar>

              {/* Profit line — the hero. Thicker so it reads first. */}
              <Line
                type="monotone"
                dataKey="actualProfit"
                name="Profit"
                stroke="url(#profitGradient)"
                strokeWidth={3}
                connectNulls={false}
                dot={(props: any) => {
                  const { cx, cy, payload, index } = props;
                  if (payload.actualProfit == null) return <g key={`da-${index}`} />;
                  const entry = entries[index];
                  const isSelected = selectedEntry?.key === entry?.key;
                  const isCurrent = entry?.containsCurrent ?? false;
                  const color = payload.profit >= 0 ? C.positive : C.negative;
                  return (
                    <circle
                      key={`da-${index}`}
                      cx={cx}
                      cy={cy}
                      r={isSelected ? 6 : isCurrent ? 5 : 3.5}
                      fill={color}
                      stroke={color}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                  );
                }}
                activeDot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (payload?.profit == null) return <g />;
                  const color = payload.profit >= 0 ? C.positive : C.negative;
                  return <circle cx={cx} cy={cy} r={6} fill={color} stroke="#fff" strokeWidth={2} />;
                }}
              />
              <Line
                type="monotone"
                dataKey="forecastProfit"
                name="Forecast"
                stroke="url(#profitGradient)"
                strokeWidth={2.5}
                strokeDasharray="5 4"
                connectNulls={false}
                dot={(props: any) => {
                  const { cx, cy, payload, index } = props;
                  // Skip non-projection months (no dot on the dashed line for
                  // them) and the shared connector point (drawn by the actual
                  // line). Projection = future month OR operating is projected.
                  const isProjection = payload.isForecast || payload.operatingIsProjected;
                  if (payload.forecastProfit == null || !isProjection) return <g key={`df-${index}`} />;
                  const entry = entries[index];
                  const isSelected = selectedEntry?.key === entry?.key;
                  const color = payload.profit >= 0 ? C.positive : C.negative;
                  return (
                    <circle
                      key={`df-${index}`}
                      cx={cx}
                      cy={cy}
                      r={isSelected ? 6 : 3.5}
                      fill="#fff"
                      stroke={color}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                  );
                }}
                activeDot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (payload?.profit == null) return <g />;
                  const color = payload.profit >= 0 ? C.positive : C.negative;
                  return <circle cx={cx} cy={cy} r={6} fill={color} stroke="#fff" strokeWidth={2} />;
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── Breakdown table ─────────────────────────────────────────────── */}
      <section style={s.card}>
        <div style={s.cardHeader}>
          <div>
            <h2 style={s.cardTitle}>{groupBy === 'quarter' ? 'Quarterly' : 'Monthly'} Breakdown</h2>
            <p style={s.cardSub}>
              <span>{data.year}</span>
              <SubDot />
              <span>{entries.filter(e => !e.isForecast).length} actual</span>
              <SubDot />
              <span>{entries.filter(e => e.isForecast).length} forecast</span>
            </p>
          </div>
        </div>

        <div style={{ overflowX: 'auto', marginTop: SP.md }}>
          <table style={s.table}>
            <thead>
              <tr>
                {[groupBy === 'quarter' ? 'Quarter' : 'Month', 'Revenue', 'Expenses', 'Profit', 'Margin'].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      ...s.th,
                      textAlign: i >= 1 ? 'right' as const : 'left' as const,
                      ...(h === 'Profit' ? { paddingRight: SP.lg } : null),
                    }}
                  >{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                // Forecast rows: use muted semantic tones instead of `opacity`
                // so badges and tabular-nums stay crisp.
                const profitColor = e.profit >= 0
                  ? (e.isForecast ? C.positiveMuted : C.positive)
                  : (e.isForecast ? C.negativeMuted : C.negative);
                const revenueColor = e.isForecast ? C.positiveMuted : C.positive;
                const neutralColor = e.isForecast ? C.mutedSoft : C.textSub;
                const labelColor = e.isForecast ? C.mutedSoft : C.text;
                return (
                  <tr
                    key={e.key}
                    className="fa-row"
                    style={{ background: e.containsCurrent ? C.nowBg : 'transparent' }}
                  >
                    <td
                      style={{
                        ...s.td,
                        // Inset left-bar anchor for the current month
                        boxShadow: e.containsCurrent ? `inset 3px 0 0 ${C.nowAccent}` : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: SP.sm }}>
                        <span style={{ fontWeight: 600, color: labelColor }}>{e.label}</span>
                        {e.containsCurrent && <Badge tone="indigo">Now</Badge>}
                        {e.isForecast && <Badge tone="ghost">Forecast</Badge>}
                      </div>
                    </td>
                    <td style={{ ...s.tdNum, color: revenueColor, fontWeight: 600 }}>{fmtRM(e.revenue)}</td>
                    <td
                      style={s.tdNum}
                      title={`Staff ${fmtRM(e.staffCost)}  ·  Operating ${fmtRM(e.operatingCost)}${e.operatingIsProjected ? '  (projected — no entries recorded)' : ''}`}
                    >
                      <ExpenseCell
                        staff={e.staffCost}
                        operating={e.operatingCost}
                        muted={e.isForecast}
                        projected={e.operatingIsProjected}
                      />
                    </td>
                    <td style={{ ...s.tdProfit, color: profitColor }}>{fmtRM(e.profit)}</td>
                    <td style={{ ...s.tdNum, fontWeight: 700, color: profitColor }}>{fmtPct(e.margin)}</td>
                  </tr>
                );
              })}
              <tr style={s.totalRow}>
                <td style={{ ...s.td, ...s.totalCell, fontWeight: 800, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Annual</td>
                <td style={{ ...s.tdNum, ...s.totalCell, fontWeight: 800, color: C.positive }}>{fmtRM(data.totals.revenue)}</td>
                <td
                  style={{ ...s.tdNum, ...s.totalCell }}
                  title={`Staff ${fmtRM(data.totals.staffCost)}  ·  Operating ${fmtRM(data.totals.operatingCost)}`}
                >
                  <ExpenseCell
                    staff={data.totals.staffCost}
                    operating={data.totals.operatingCost}
                    strong
                  />
                </td>
                <td style={{ ...s.tdProfit, ...s.totalCell, color: data.totals.profit >= 0 ? C.positive : C.negative }}>{fmtRM(data.totals.profit)}</td>
                <td style={{ ...s.tdNum, ...s.totalCell, fontWeight: 800, color: data.totals.profit >= 0 ? C.positive : C.negative }}>{data.totals.revenue > 0 ? fmtPct(data.totals.profit / data.totals.revenue) : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ── KPI cards ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, accent, valueColor }: {
  label: string; value: string; accent: string; valueColor: string;
}) {
  return (
    <div style={s.kpi}>
      <div style={{ display: 'flex', alignItems: 'center', gap: SP.sm, marginBottom: SP.sm }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: accent, display: 'inline-block' }} />
        <span style={s.kpiLabel}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: valueColor, letterSpacing: '-0.01em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' as any }}>
        {value}
      </div>
    </div>
  );
}

function HeroKpiCard({ label, value, margin, isProfit }: {
  label: string; value: string; margin: string; isProfit: boolean;
}) {
  const fg = isProfit ? C.positive : C.negative;
  const bg = isProfit ? C.positiveBg : C.negativeBg;
  const bd = isProfit ? C.positiveBorder : C.negativeBorder;
  return (
    <div
      style={{
        ...s.kpi,
        background: bg,
        border: `1.5px solid ${bd}`,
        boxShadow: SHADOW_HERO,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: SP.sm, marginBottom: SP.sm }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: fg, display: 'inline-block' }} />
        <span style={{ ...s.kpiLabel, color: fg }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: SP.md, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: fg, letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' as any }}>
          {value}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: fg,
            background: '#ffffff',
            border: `1px solid ${bd}`,
            padding: '3px 8px',
            borderRadius: 999,
            letterSpacing: '0.02em',
            fontVariantNumeric: 'tabular-nums' as any,
          }}
        >
          {margin} margin
        </div>
      </div>
    </div>
  );
}

// ── Chart helpers ─────────────────────────────────────────────────────────

function ChartLegend() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: SP.md, fontSize: 11, color: C.textSub, flexWrap: 'wrap' }}>
      <LegendItem color={C.positiveSoft} label="Revenue" />
      <LegendItem color={C.expenseDark} label="Staff" />
      <LegendItem color={C.expenseLight} label="Operating" />
      <LegendItem kind="hatch" label="Projected" />
      <LegendItem kind="line" label="Profit" />
      <LegendItem kind="dash" label="Forecast" />
    </div>
  );
}

function LegendItem({ color, label, kind = 'square' }: { color?: string; label: string; kind?: 'square' | 'line' | 'dash' | 'hatch' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {kind === 'square' && (
        <span style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
      )}
      {kind === 'hatch' && (
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 2,
            background: `repeating-linear-gradient(45deg, ${C.expenseLight} 0, ${C.expenseLight} 2px, #fff 2px, #fff 4px)`,
          }}
        />
      )}
      {kind === 'line' && (
        <svg width="18" height="10"><line x1="0" y1="5" x2="18" y2="5" stroke={C.positive} strokeWidth="3" /></svg>
      )}
      {kind === 'dash' && (
        <svg width="18" height="10"><line x1="0" y1="5" x2="18" y2="5" stroke={C.muted} strokeWidth="2.5" strokeDasharray="4 3" /></svg>
      )}
      <span>{label}</span>
    </span>
  );
}

function FinanceTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as PeriodEntry;
  const rowColor = d.profit >= 0 ? C.positive : C.negative;
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 10,
        padding: `${SP.md}px ${SP.lg}px`,
        fontSize: 12,
        minWidth: 220,
        boxShadow: SHADOW_HERO,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SP.sm }}>
        <span style={{ fontWeight: 700, color: C.text }}>{label}</span>
        {d.isForecast && <Badge tone="ghost">Forecast</Badge>}
      </div>
      <TooltipRow color={C.positiveSoft} label="Revenue" value={fmtRM(d.revenue)} />
      <TooltipRow color={C.expenseDark} label="Staff" value={fmtRM(-d.staffCost)} />
      <TooltipRow color={C.expenseLight} label="Operating" value={fmtRM(-d.operatingCost)} />
      <div style={{ height: 1, background: C.divider, margin: `${SP.sm}px 0` }} />
      <TooltipRow
        color={rowColor}
        label={d.profit >= 0 ? 'Profit' : 'Loss'}
        value={`${fmtRM(d.profit)}  (${fmtPct(d.margin)})`}
        strong
      />
    </div>
  );
}

function TooltipRow({ color, label, value, strong }: { color: string; label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SP.lg, padding: '4px 0' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: SP.sm, color: strong ? C.text : C.muted, fontWeight: strong ? 700 : 500 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
        {label}
      </span>
      <span style={{
        color: strong ? color : C.textSub,
        fontWeight: strong ? 800 : 600,
        fontVariantNumeric: 'tabular-nums' as any,
        textAlign: 'right',
      }}>
        {value}
      </span>
    </div>
  );
}

// Total expenses + a mini stacked proportion bar (staff : operating). Mirrors
// the chart's stacked expense bar so staff-vs-operating reads at a glance.
// When `projected` is true, the operating portion was substituted with a
// forecast value (month had no saved entries). The total number renders in
// italic with a '~' prefix, and the operating segment of the mini bar gets a
// diagonal-stripe pattern so the projection is visually obvious.
function ExpenseCell({ staff, operating, muted, strong, projected }: {
  staff: number; operating: number; muted?: boolean; strong?: boolean; projected?: boolean;
}) {
  const total = staff + operating;
  const staffPct = total > 0 ? (staff / total) * 100 : 0;
  const opPct = total > 0 ? (operating / total) * 100 : 0;
  const color = muted ? C.mutedSoft : C.textSub;
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
      <span
        style={{
          color,
          fontWeight: strong ? 700 : 500,
          fontStyle: projected ? 'italic' : 'normal',
        }}
      >
        {total > 0
          ? `${projected ? '~' : ''}−${fmtRM(total).replace('RM ', 'RM ')}`
          : '—'}
      </span>
      {total > 0 && (
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            width: 72,
            height: 3,
            borderRadius: 2,
            overflow: 'hidden',
            background: C.divider,
            opacity: muted ? 0.55 : 1,
          }}
        >
          <span style={{ width: `${staffPct}%`, background: C.expenseDark, display: 'block' }} />
          <span
            style={{
              width: `${opPct}%`,
              display: 'block',
              background: projected
                ? `repeating-linear-gradient(45deg, ${C.expenseLight} 0, ${C.expenseLight} 2px, ${C.divider} 2px, ${C.divider} 4px)`
                : C.expenseLight,
            }}
          />
        </span>
      )}
    </div>
  );
}

// ── Atoms ─────────────────────────────────────────────────────────────────

function SubDot() {
  return <span style={{ margin: `0 ${SP.sm}px`, color: C.cardBorder }}>·</span>;
}

function Badge({ tone, children }: { tone: 'indigo' | 'ghost'; children: React.ReactNode }) {
  const styles: Record<string, React.CSSProperties> = {
    indigo: {
      fontSize: 10,
      fontWeight: 600,
      padding: '1px 7px',
      borderRadius: 999,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      background: '#eef2ff',
      color: '#4338ca',
      border: '1px solid #c7d2fe',
    },
    ghost: {
      fontSize: 9,
      fontWeight: 600,
      padding: '1px 6px',
      borderRadius: 999,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      background: 'transparent',
      color: C.mutedSoft,
      border: `1px solid ${C.cardBorder}`,
    },
  };
  return <span style={styles[tone]}>{children}</span>;
}

// ── Styles ────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: `${SP.xxl + SP.xs}px ${SP.xxxl}px`,
    maxWidth: 1200,
    margin: '0 auto',
    background: C.bg,
    minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: C.text,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SP.lg,
    flexWrap: 'wrap',
    marginBottom: SP.xxl + SP.xs,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: C.text,
    margin: `0 0 ${SP.xs}px`,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: 13,
    color: C.muted,
    margin: 0,
    lineHeight: 1.5,
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: SP.sm,
    flexWrap: 'wrap',
  },
  kpi: {
    background: C.card,
    border: `1px solid ${C.cardBorder}`,
    borderRadius: RADIUS,
    padding: `${SP.md}px ${SP.xl}px`,
    boxShadow: SHADOW,
    minHeight: 84,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: C.mutedSoft,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
  card: {
    background: C.card,
    border: `1px solid ${C.cardBorder}`,
    borderRadius: RADIUS,
    padding: `${SP.xl}px ${SP.xxl}px`,
    boxShadow: SHADOW,
    marginBottom: SP.xxl,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SP.lg,
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: C.text,
    margin: `0 0 ${SP.xs}px`,
    letterSpacing: '-0.01em',
  },
  cardSub: {
    fontSize: 12,
    color: C.muted,
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 13,
  },
  th: {
    padding: `${SP.md}px ${SP.md}px`,
    fontWeight: 600,
    fontSize: 11,
    color: C.muted,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    borderBottom: `1px solid ${C.cardBorder}`,
    whiteSpace: 'nowrap' as const,
    background: '#fafbfc',
    verticalAlign: 'middle' as const,
  },
  td: {
    padding: `10px ${SP.md}px`,
    borderBottom: `1px solid ${C.divider}`,
    fontSize: 13,
    color: C.text,
    whiteSpace: 'nowrap' as const,
    verticalAlign: 'middle' as const,
  },
  tdNum: {
    padding: `10px ${SP.md}px`,
    borderBottom: `1px solid ${C.divider}`,
    fontSize: 13,
    textAlign: 'right' as const,
    whiteSpace: 'nowrap' as const,
    fontVariantNumeric: 'tabular-nums' as any,
    verticalAlign: 'middle' as const,
  },
  // Profit column: the scan anchor — slightly larger, bolder, with extra
  // right padding so it doesn't crowd the margin column.
  tdProfit: {
    padding: `10px ${SP.lg}px 10px ${SP.md}px`,
    borderBottom: `1px solid ${C.divider}`,
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: '-0.01em',
    textAlign: 'right' as const,
    whiteSpace: 'nowrap' as const,
    fontVariantNumeric: 'tabular-nums' as any,
    verticalAlign: 'middle' as const,
  },
  totalRow: {
    background: '#f8fafc',
  },
  totalCell: {
    borderTop: `2px solid ${C.textSub}`,
    borderBottom: 'none' as const,
    padding: `12px ${SP.md}px`,
  },
  centered: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: 300,
    color: C.muted,
    fontSize: 14,
  },
};
