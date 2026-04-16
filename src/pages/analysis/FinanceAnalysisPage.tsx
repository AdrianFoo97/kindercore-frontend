import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ComposedChart, Bar, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, Cell, ReferenceArea } from 'recharts';
import { faCalendar } from '@fortawesome/free-solid-svg-icons';
import { fetchFinanceSummary, FinanceMonth } from '../../api/finance.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { FilterPillStyles, PillSelect, PillToggle } from '../../components/common/FilterPill.js';

const C = {
  bg: '#f8fafc', card: '#fff', text: '#1e293b', muted: '#64748b', border: '#e2e8f0',
  primary: '#5a67d8', green: '#059669', red: '#dc2626', blue: '#3b82f6', amber: '#d97706',
};

function fmtRM(v: number) {
  const sign = v < 0 ? '−' : '';
  return `${sign}RM ${Math.abs(v).toLocaleString('en-MY', { minimumFractionDigits: 0 })}`;
}
function fmtPct(v: number) { return `${(v * 100).toFixed(1)}%`; }

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
type GroupBy = 'month' | 'quarter';

// A display entry is either a month or a quarter bucket — same shape so the
// chart and table don't care which grouping they're rendering.
interface PeriodEntry {
  key: string;              // 'jan'...'dec' or 'q1'...'q4'
  label: string;            // 'Jan' or 'Q1'
  revenue: number;
  staffCost: number;
  operatingCost: number;
  profit: number;
  margin: number;
  studentCount: number;
  teacherCount: number;
  isForecast: boolean;      // true only if ALL underlying months are forecast
  containsCurrent: boolean; // true if the current month falls inside this entry
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
    }));
  }
  // Quarterly aggregation
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

  const profitYDomain = useMemo<[number, number]>(() => {
    if (entries.length === 0) return [0, 0];
    const profits = entries.map(e => e.profit);
    const min = Math.min(...profits, 0);
    const max = Math.max(...profits, 0);
    const range = max - min;
    const pad = range > 0 ? range * 0.2 : 1000;
    return [Math.floor((min - pad) / 100) * 100, Math.ceil((max + pad) / 100) * 100];
  }, [entries]);

  // When year or grouping changes, jump to the current month/quarter if the
  // selected year is the current year. Otherwise fall back to "all".
  useEffect(() => {
    const now = new Date();
    if (year !== now.getFullYear()) {
      setPeriod('all');
      return;
    }
    const m = now.getMonth();
    setPeriod(groupBy === 'quarter' ? `q${Math.floor(m / 3) + 1}` : String(m));
  }, [year, groupBy]);

  // If the selected period becomes entirely forecast (e.g. year change), reset.
  useEffect(() => {
    if (!data || period === 'all') return;
    const entry = entries.find(e => e.key === period);
    if (!entry || entry.isForecast) setPeriod('all');
  }, [data, entries, period]);

  if (isLoading || !data) return <div style={s.centered}>Loading...</div>;

  const selectedEntry = entries.find(e => e.key === period);

  const selected = period === 'all'
    ? {
        label: groupBy === 'quarter' ? 'Annual' : 'Annual',
        revenue: entries.reduce((s, e) => s + e.revenue, 0),
        staffCost: entries.reduce((s, e) => s + e.staffCost, 0),
        operatingCost: entries.reduce((s, e) => s + e.operatingCost, 0),
        profit: entries.reduce((s, e) => s + e.profit, 0),
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

  return (
    <div style={{ ...s.page, ...(isMobile ? { padding: '20px 12px' } : {}) }}>
      <style>{`
        .recharts-wrapper *:focus { outline: none !important; }
        .fa-row:hover { background: #f0f9ff !important; }
      `}</style>
      <FilterPillStyles />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={s.title}>Finance Analysis</h1>
          <p style={s.subtitle}>Profit = revenue − staff cost (salary + contributions) − operating cost</p>
        </div>
        {/*
          Filter bar: three independent pills on a shared baseline.
          No outer container — each control stands on its own with consistent
          34px height, matching border radius, and soft hover affordance.
        */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <PillSelect
            icon={faCalendar}
            value={String(year)}
            onChange={v => setYear(Number(v))}
            options={(() => {
              const now = new Date().getFullYear();
              return [now - 1, now, now + 1].map(y => ({ value: String(y), label: String(y) }));
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
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard label={`${selected.label} Revenue`} value={fmtRM(selected.revenue)} color={C.blue} />
        <KpiCard label="Staff Cost" value={fmtRM(selected.staffCost)} color={C.amber} />
        <KpiCard label="Operating Cost" value={fmtRM(selected.operatingCost)} color={C.muted} />
        <KpiCard
          label={selected.profit >= 0 ? 'Profit' : 'Loss'}
          value={fmtRM(selected.profit)}
          color={selected.profit >= 0 ? C.green : C.red}
          sub={`Margin ${fmtPct(selected.margin)}`}
        />
      </div>

      {/* Profit chart */}
      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div>
            <h2 style={s.cardTitle}>Profit by {groupBy === 'quarter' ? 'Quarter' : 'Month'}</h2>
            <p style={s.cardSub}>
              {data.year} · Actual: {fmtRM(data.totals.actual.profit)} · Forecast: {fmtRM(data.totals.forecast.profit)} · Annual: {fmtRM(data.totals.profit)}
            </p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={entries} margin={{ top: 20, right: 16, left: 0, bottom: 0 }} style={{ outline: 'none' }}>
            <CartesianGrid vertical={false} stroke={C.border} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: C.muted }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: C.muted }}
              axisLine={false}
              tickLine={false}
              width={55}
              domain={profitYDomain}
              allowDecimals={false}
              tickFormatter={v => `${(v / 1000).toFixed(1)}k`}
            />
            <Tooltip
              cursor={{ fill: 'transparent' }}
              content={({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload as PeriodEntry;
                return (
                  <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', fontSize: 12, minWidth: 180 }}>
                    <div style={{ fontWeight: 700, color: C.text, marginBottom: 6 }}>{label}{d.isForecast ? ' · Forecast' : ''}</div>
                    <TooltipRow color={C.blue} label="Revenue" value={fmtRM(d.revenue)} />
                    <TooltipRow color={C.amber} label="Staff Cost" value={fmtRM(-d.staffCost)} />
                    <TooltipRow color={C.muted} label="Operating" value={fmtRM(-d.operatingCost)} />
                    <div style={{ height: 1, background: C.border, margin: '6px 0' }} />
                    <TooltipRow
                      color={d.profit >= 0 ? C.green : C.red}
                      label="Profit"
                      value={`${fmtRM(d.profit)} (${fmtPct(d.margin)})`}
                      bold
                    />
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="square" iconSize={10} />
            {selectedEntry && (
              <ReferenceArea
                x1={selectedEntry.label}
                x2={selectedEntry.label}
                fill="#312e81"
                fillOpacity={0.08}
                stroke="#312e81"
                strokeOpacity={0.25}
                strokeDasharray="3 3"
                ifOverflow="extendDomain"
              />
            )}
            <Bar dataKey="revenue" name="Revenue" fill={C.blue} radius={[4, 4, 0, 0]} maxBarSize={groupBy === 'quarter' ? 56 : 28}>
              {entries.map((e, i) => (
                <Cell key={`r-${i}`} fill={e.isForecast ? '#bfdbfe' : C.blue} />
              ))}
            </Bar>
            <Bar dataKey="staffCost" name="Staff Cost" fill={C.amber} radius={[4, 4, 0, 0]} maxBarSize={groupBy === 'quarter' ? 56 : 28}>
              {entries.map((e, i) => (
                <Cell key={`s-${i}`} fill={e.isForecast ? '#fde68a' : C.amber} />
              ))}
            </Bar>
            <Bar dataKey="operatingCost" name="Operating" fill={C.muted} radius={[4, 4, 0, 0]} maxBarSize={groupBy === 'quarter' ? 56 : 28} />
            <Line
              type="monotone"
              dataKey="profit"
              name="Profit"
              stroke={C.green}
              strokeWidth={2.5}
              dot={(props: any) => {
                const { cx, cy, payload, index } = props;
                const entry = entries[index];
                const isSelected = selectedEntry?.key === entry?.key;
                const isCurrent = entry?.containsCurrent ?? false;
                const fill = payload.isForecast ? '#fff' : C.green;
                return (
                  <circle
                    key={`d-${index}`}
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 6 : isCurrent ? 5 : 3.5}
                    fill={fill}
                    stroke={C.green}
                    strokeWidth={isSelected ? 3 : 2}
                  />
                );
              }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Breakdown table */}
      <div style={s.card}>
        <h2 style={{ ...s.cardTitle, marginBottom: 14 }}>{groupBy === 'quarter' ? 'Quarterly' : 'Monthly'} Breakdown</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={s.table}>
            <thead>
              <tr>
                {[groupBy === 'quarter' ? 'Quarter' : 'Month', 'Revenue', 'Staff Cost', 'Operating', 'Profit', 'Margin'].map((h, i) => (
                  <th key={h} style={{ ...s.th, ...(i >= 1 ? { textAlign: 'right' as const } : {}) }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.key} className="fa-row" style={{ background: e.containsCurrent ? '#eef2ff' : i % 2 === 0 ? C.card : '#f8fafc', opacity: e.isForecast ? 0.5 : 1 }}>
                  <td style={s.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>{e.label}</span>
                      {e.containsCurrent && <span style={{ fontSize: 9, fontWeight: 700, background: '#312e81', color: '#fff', padding: '1px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Now</span>}
                      {e.isForecast && <span style={{ fontSize: 9, fontWeight: 700, background: '#e0e7ff', color: '#4338ca', padding: '1px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Forecast</span>}
                    </div>
                  </td>
                  <td style={{ ...s.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtRM(e.revenue)}</td>
                  <td style={{ ...s.td, textAlign: 'right', color: C.amber, fontVariantNumeric: 'tabular-nums' }}>−{fmtRM(e.staffCost).replace('RM ', 'RM ')}</td>
                  <td style={{ ...s.td, textAlign: 'right', color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{e.operatingCost > 0 ? `−${fmtRM(e.operatingCost)}` : '—'}</td>
                  <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: e.profit >= 0 ? C.green : C.red, fontVariantNumeric: 'tabular-nums' }}>{fmtRM(e.profit)}</td>
                  <td style={{ ...s.td, textAlign: 'right', fontWeight: 600, color: e.profit >= 0 ? C.green : C.red, fontVariantNumeric: 'tabular-nums' }}>{fmtPct(e.margin)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: `2px solid ${C.border}` }}>
                <td style={{ ...s.td, fontWeight: 700, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Annual</td>
                <td style={{ ...s.td, textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtRM(data.totals.revenue)}</td>
                <td style={{ ...s.td, textAlign: 'right', fontWeight: 800, color: C.amber, fontVariantNumeric: 'tabular-nums' }}>−{fmtRM(data.totals.staffCost).replace('RM ', 'RM ')}</td>
                <td style={{ ...s.td, textAlign: 'right', fontWeight: 800, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{data.totals.operatingCost > 0 ? `−${fmtRM(data.totals.operatingCost)}` : '—'}</td>
                <td style={{ ...s.td, textAlign: 'right', fontWeight: 800, fontSize: 14, color: data.totals.profit >= 0 ? C.green : C.red, fontVariantNumeric: 'tabular-nums' }}>{fmtRM(data.totals.profit)}</td>
                <td style={{ ...s.td, textAlign: 'right', fontWeight: 800, color: data.totals.profit >= 0 ? C.green : C.red, fontVariantNumeric: 'tabular-nums' }}>{data.totals.revenue > 0 ? fmtPct(data.totals.profit / data.totals.revenue) : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ background: C.card, borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderTop: `3px solid ${color}`, padding: '16px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontSize: 10, color: C.muted }}>{sub}</span>}
    </div>
  );
}

function TooltipRow({ color, label, value, bold }: { color: string; label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '2px 0', fontWeight: bold ? 700 : 500 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.text }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
        {label}
      </span>
      <span style={{ color, fontVariantNumeric: 'tabular-nums' as any }}>{value}</span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', maxWidth: 1200, margin: '0 auto', background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' },
  title: { fontSize: 22, fontWeight: 800, color: C.text, margin: '0 0 4px' },
  subtitle: { fontSize: 13, color: C.muted, margin: 0 },
  card: { background: C.card, borderRadius: 14, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 },
  cardTitle: { fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 2px' },
  cardSub: { fontSize: 12, color: C.muted, margin: '0 0 16px' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  th: { textAlign: 'left' as const, padding: '8px 12px', fontWeight: 600, fontSize: 11, color: C.muted, letterSpacing: '0.04em', textTransform: 'uppercase' as const, borderBottom: `2px solid ${C.border}`, whiteSpace: 'nowrap' as const },
  td: { padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: C.text, whiteSpace: 'nowrap' as const },
  centered: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, color: C.muted, fontSize: 15 },
};
