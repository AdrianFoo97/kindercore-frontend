import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Cell, PieChart, Pie, Legend, Sector,
} from 'recharts';
import { fetchAnalytics } from '../../api/leads.js';

// ── Palette ───────────────────────────────────────────────────────
const C = {
  blue:   '#2563eb',
  indigo: '#4f46e5',
  purple: '#7c3aed',
  slate:  '#94a3b8',
  green:  '#059669',
  amber:  '#d97706',
  red:    '#dc2626',
  bg:     '#f1f5f9',
  card:   '#ffffff',
  border: '#e2e8f0',
  text:   '#0f172a',
  muted:  '#64748b',
};

const AGE_PALETTE: Record<string, string> = {
  '2': '#1e3a8a', '3': '#1d4ed8', '4': '#4f46e5',
  '5': '#7c3aed', '6': '#a78bfa', 'other': '#cbd5e1',
};

const DONUT_PALETTE = [
  '#1e40af','#1d4ed8','#2563eb','#3b82f6',
  '#60a5fa','#93c5fd','#bfdbfe','#dbeafe',
];

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Helpers ───────────────────────────────────────────────────────
const RADIAN = Math.PI / 180;

function pct(n: number) { return `${Math.round(n * 100)}%`; }

function DonutLabel({ cx, cy, midAngle, outerRadius, percent, name }: any) {
  if (percent < 0.02) return null;
  const r = outerRadius + 36;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central" fontSize={11} fill={C.muted}>
      {name} <tspan fontWeight={600} fill={C.text}>{(percent * 100).toFixed(0)}%</tspan>
    </text>
  );
}

// ── Circular rate ring ────────────────────────────────────────────
function RateRing({ rate }: { rate: number }) {
  const p = Math.round(rate * 100);
  return (
    <div style={{ position: 'relative', width: 100, height: 100 }}>
      <PieChart width={100} height={100} style={{ outline: 'none' }}>
        <Pie data={[{ v: p }, { v: 100 - p }]} dataKey="v"
          innerRadius={36} outerRadius={48} startAngle={90} endAngle={-270} paddingAngle={0} style={{ outline: 'none' }}>
          <Cell fill={C.blue} />
          <Cell fill={C.border} />
        </Pie>
      </PieChart>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: C.blue, lineHeight: 1 }}>{p}%</span>
      </div>
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, children }: {
  label: string; value?: number | string; sub?: string;
  color: string; children?: React.ReactNode;
}) {
  return (
    <div style={{ ...s.card, borderTop: `3px solid ${color}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '18px 20px' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>{label}</span>
      {children ?? <span style={{ fontSize: 40, fontWeight: 900, color, lineHeight: 1 }}>{value}</span>}
      {sub && <span style={{ fontSize: 12, color: C.muted }}>{sub}</span>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────
export default function SalesMarketingPage() {
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics', selectedYear],
    queryFn: () => fetchAnalytics(selectedYear),
  });

  if (isLoading) return <div style={s.centered}>Loading…</div>;
  if (isError || !data) return <div style={s.centered}>Failed to load analytics.</div>;

  const ageKeys = Array.from(
    new Set(data.monthlyByAge.flatMap(m => Object.keys(m).filter(k => k !== 'month' && k !== 'total')))
  ).sort();

  // ── Month filtering ───────────────────────────────────────────────
  const monthLeads = selectedMonth !== null
    ? data.leadsDetail.filter(l => l.monthIdx === selectedMonth)
    : data.leadsDetail;

  function deriveDonut(key: 'address' | 'channel') {
    const map = new Map<string, number>();
    for (const l of monthLeads) {
      const val = key === 'address' ? l.address : l.channel;
      if (val) map.set(val, (map.get(val) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }

  const addressData = deriveDonut('address');
  const channelData = deriveDonut('channel');

  const filteredMonthlyByAge = selectedMonth !== null
    ? data.monthlyByAge.filter(m => m.month === MONTH_LABELS[selectedMonth])
    : data.monthlyByAge;

  // ── Click handler ─────────────────────────────────────────────────
  function handleMonthClick(chartData: any) {
    if (!chartData?.activeLabel) return;
    const idx = MONTH_LABELS.indexOf(chartData.activeLabel);
    if (idx === -1) return;
    setSelectedMonth(prev => prev === idx ? null : idx);
  }

  return (
    <div style={s.page}>
      <style>{`.recharts-wrapper *:focus { outline: none !important; }`}</style>

      {/* ── Header ── */}
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>Marketing Analysis</h1>
          <p style={s.pageSubtitle}>Enquiry trends, appointment performance and channel insights</p>
        </div>
        <div style={s.filterWrap}>
          <span style={s.filterLabel}>Year</span>
          <select style={s.select}
            value={selectedYear ?? ''}
            onChange={e => {
              setSelectedYear(e.target.value ? Number(e.target.value) : undefined);
              setSelectedMonth(null);
            }}>
            <option value="">Current Year</option>
            {data.availableYears
              .filter(y => y < new Date().getFullYear())
              .map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div style={s.kpiRow}>
        <KpiCard label="Appointment Rate" color={C.indigo}>
          <RateRing rate={data.appointmentRate} />
          <span style={{ fontSize: 12, color: C.muted }}>{data.attendedAppointments} attended of {data.completedLeads} completed</span>
        </KpiCard>
        <KpiCard label="Total Leads" value={data.totalLeads} color={C.blue}
          sub={`in ${data.selectedYear}`} />
        <KpiCard label="Total Attended" value={data.attendedAppointments} color={C.green}
          sub="completed leads who attended" />
        <KpiCard label="Total Didn't Attend" value={data.noShowLeads} color={C.red}
          sub="marked as didn't attend" />
        <KpiCard label="Active / Pending" value={data.totalLeads - data.completedLeads} color={C.amber}
          sub="no final outcome yet" />
      </div>

      {/* ── YoY Comparison ── */}
      <div style={s.card}>
        <div style={s.cardHeader}>
          <div>
            <h2 style={s.cardTitle}>Monthly Enquiries — Year over Year</h2>
            <p style={s.cardSub}>
              Comparing {data.selectedYear} vs {data.prevYear}
              {selectedMonth !== null && (
                <span style={{ marginLeft: 10, color: C.blue, fontWeight: 600 }}>
                  · {MONTH_LABELS[selectedMonth]} selected
                  <span
                    onClick={() => setSelectedMonth(null)}
                    style={{ marginLeft: 6, cursor: 'pointer', color: C.muted, fontWeight: 400 }}>
                    ✕ clear
                  </span>
                </span>
              )}
            </p>
          </div>
          <div style={s.legendInline}>
            <span style={s.legendDot(C.blue)} /><span style={s.legendText}>{data.selectedYear}</span>
            <span style={s.legendDot(C.slate)} /><span style={s.legendText}>{data.prevYear}</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart
            data={data.monthlyComparison}
            margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
            style={{ outline: 'none', cursor: 'pointer' }}
            onClick={handleMonthClick}>
            <CartesianGrid vertical={false} stroke={C.border} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: C.muted }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              cursor={{ fill: 'transparent' }}
              contentStyle={{ borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12 }}
              formatter={(v: number, name: string) => [v, name === 'current' ? String(data.selectedYear) : String(data.prevYear)]}
            />
            <Bar dataKey="current" radius={[4, 4, 0, 0]} maxBarSize={32} name="current" activeBar={false}>
              {data.monthlyComparison.map((entry, i) => {
                const monthIdx = MONTH_LABELS.indexOf(entry.month);
                const dimmed = selectedMonth !== null && monthIdx !== selectedMonth;
                return <Cell key={i} fill={C.blue} opacity={dimmed ? 0.25 : 1} />;
              })}
            </Bar>
            <Line dataKey="previous" stroke={C.slate} strokeWidth={2} strokeDasharray="5 4"
              dot={{ r: 3, fill: C.slate }} activeDot={{ r: 5 }} name="previous" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Enquiry by Age ── */}
      <div style={s.card}>
        <div style={s.cardHeader}>
          <div>
            <h2 style={s.cardTitle}>Enquiry by Month &amp; Child Age</h2>
            <p style={s.cardSub}>
              {data.selectedYear} — stacked by age at time of enquiry
              {selectedMonth !== null && ` · ${MONTH_LABELS[selectedMonth]} only`}
            </p>
          </div>
          <div style={s.legendInline}>
            {ageKeys.map(k => (
              <span key={k} style={s.legendInlineItem}>
                <span style={s.legendDot(AGE_PALETTE[k] ?? '#ccc')} />
                <span style={s.legendText}>Age {k}</span>
              </span>
            ))}
          </div>
        </div>
        {filteredMonthlyByAge.length === 0
          ? <p style={s.empty}>No data for this period.</p>
          : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={filteredMonthlyByAge} margin={{ top: 20, right: 16, left: 0, bottom: 0 }} style={{ outline: 'none' }}>
                <CartesianGrid vertical={false} stroke={C.border} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: C.muted }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  cursor={false}
                  contentStyle={{ borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12 }}
                  formatter={(v: number, k: string) => [v, `Age ${k}`]}
                />
                {ageKeys.map((age, i) => (
                  <Bar key={age} dataKey={age} stackId="a"
                    fill={AGE_PALETTE[age] ?? DONUT_PALETTE[i]}
                    radius={i === ageKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    maxBarSize={48}
                    activeBar={false}>
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
      </div>

      {/* ── Donuts ── */}
      <div style={s.donutRow}>
        <DonutCard
          title="Leads by Address"
          sub={selectedMonth !== null ? `${MONTH_LABELS[selectedMonth]} — where do enquiries come from?` : 'Where do enquiries come from?'}
          data={addressData}
          topN={5}
        />
        <DonutCard
          title="Marketing Channel"
          sub={selectedMonth !== null ? `${MONTH_LABELS[selectedMonth]} — how did they hear about us?` : 'How did they hear about us?'}
          data={channelData}
          topN={5}
        />
      </div>

    </div>
  );
}

// ── Donut card ────────────────────────────────────────────────────
function DonutCard({ title, sub, data, topN }: { title: string; sub: string; data: { name: string; value: number }[]; topN?: number }) {
  const [showOthers, setShowOthers] = useState(false);
  const hasOthers = topN != null && data.length > topN;
  const othersItems = hasOthers ? data.slice(topN) : [];
  const total = data.reduce((a, b) => a + b.value, 0);

  const pieData = hasOthers
    ? [...data.slice(0, topN!), { name: 'Others', value: othersItems.reduce((s, d) => s + d.value, 0) }]
    : data;
  const othersIndex = hasOthers ? pieData.length - 1 : -1;
  const othersValue = hasOthers ? pieData[othersIndex].value : 0;

  const handlePieClick = (_: any, index: number) => {
    if (hasOthers && index === othersIndex) setShowOthers(prev => !prev);
  };

  const legendData = showOthers ? othersItems : pieData;

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <div>
          <h2 style={s.cardTitle}>{title}</h2>
          <p style={s.cardSub}>{sub}</p>
        </div>
      </div>
      {pieData.length === 0
        ? <p style={s.empty}>No data yet.</p>
        : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart margin={{ top: 10, right: 80, bottom: 10, left: 80 }} style={{ outline: 'none' }}>
                {/* Main pie — labels always visible, never changes */}
                <Pie data={pieData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={60} outerRadius={88}
                  labelLine label={(props: any) => <DonutLabel {...props} />}
                  isAnimationActive={false} style={{ outline: 'none' }}
                  onClick={handlePieClick}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={DONUT_PALETTE[i % DONUT_PALETTE.length]}
                      style={{ cursor: i === othersIndex ? 'pointer' : 'default' }} />
                  ))}
                </Pie>
                {/* Pop-out overlay — only Others slice, slightly larger, rendered on top */}
                {showOthers && (
                  <Pie data={pieData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" innerRadius={60} outerRadius={97}
                    isAnimationActive={false} style={{ outline: 'none' }}
                    labelLine={false} label={false}
                    onClick={handlePieClick}>
                    {pieData.map((_, i) => (
                      <Cell key={i}
                        fill={i === othersIndex ? DONUT_PALETTE[i % DONUT_PALETTE.length] : 'transparent'}
                        stroke={i === othersIndex ? '#fff' : 'none'}
                        strokeWidth={i === othersIndex ? 2 : 0}
                        style={{ cursor: 'pointer' }} />
                    ))}
                  </Pie>
                )}
                <Tooltip formatter={(v: number) => [v, 'Leads']}
                  contentStyle={{ borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>

            {/* Persistent badge when Others is selected */}
            {showOthers && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#eff6ff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 12px', fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: DONUT_PALETTE[othersIndex % DONUT_PALETTE.length], display: 'inline-block' }} />
                  <span style={{ color: C.text }}>Others</span>
                  <span style={{ fontWeight: 700, color: C.text }}>{othersValue} leads</span>
                  <span style={{ color: C.muted }}>{pct(othersValue / total)}</span>
                </div>
                <div style={{ fontSize: 11, color: C.blue, cursor: 'pointer' }}
                  onClick={() => setShowOthers(false)}>
                  ◂ Back to overview
                </div>
              </div>
            )}

            <div style={s.donutTable}>
              {legendData.map((d, i) => (
                <div key={d.name} style={{
                  ...s.donutRow2,
                  ...(d.name === 'Others' && hasOthers && !showOthers ? { cursor: 'pointer' } : {}),
                }}
                  onClick={d.name === 'Others' && hasOthers && !showOthers ? () => setShowOthers(true) : undefined}
                >
                  <span style={{ ...s.legendDot(DONUT_PALETTE[i % DONUT_PALETTE.length]), flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, color: C.text }}>{d.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{d.value}</span>
                  <span style={{ fontSize: 12, color: C.muted, width: 36, textAlign: 'right' }}>
                    {pct(d.value / total)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const s: Record<string, any> = {
  page: { padding: '28px 32px', maxWidth: 1200, margin: '0 auto', background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' },
  pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 },
  pageTitle: { fontSize: 22, fontWeight: 800, color: C.text, margin: '0 0 4px' },
  pageSubtitle: { fontSize: 13, color: C.muted, margin: 0 },
  filterWrap: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  filterLabel: { fontSize: 12, fontWeight: 600, color: C.muted },
  select: { padding: '7px 14px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, color: C.text, background: C.card, cursor: 'pointer', fontWeight: 500 },
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 20 },
  card: { background: C.card, borderRadius: 14, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)', marginBottom: 20 },
  cardHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' },
  cardTitle: { fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 2px' },
  cardSub: { fontSize: 12, color: C.muted, margin: 0 },
  legendInline: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  legendInlineItem: { display: 'flex', alignItems: 'center', gap: 4 },
  legendDot: (color: string): React.CSSProperties => ({ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }),
  legendText: { fontSize: 12, color: C.muted },
  donutRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 },
  donutTable: { marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 },
  donutRow2: { display: 'flex', alignItems: 'center', gap: 8 },
  centered: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, color: C.muted, fontSize: 15 },
  empty: { color: '#cbd5e1', fontSize: 14, textAlign: 'center' as const, padding: '60px 0', margin: 0 },
};
