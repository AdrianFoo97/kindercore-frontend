import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Cell, PieChart, Pie, Legend, Sector,
} from 'recharts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { fetchAnalytics } from '../../api/leads.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';

// ── Palette ───────────────────────────────────────────────────────
const C = {
  blue:   '#5a79c8',
  indigo: '#4f46e5',
  purple: '#7c3aed',
  slate:  '#94a3b8',
  green:  '#059669',
  amber:  '#d97706',
  red:    '#dc2626',
  bg:     '#f8fafc',
  card:   '#ffffff',
  border: '#e2e8f0',
  text:   '#0f172a',
  muted:  '#64748b',
};

const AGE_PALETTE: Record<string, string> = {
  'Below 2': '#94a3b8',
  '2': '#0ea5e9', '3': '#3b82f6', '4': '#8b5cf6',
  '5': '#a855f7', '6': '#d946ef', '7': '#f43f5e',
  'Above 7': '#f97316',
};

const DONUT_PALETTE = [
  '#1e40af','#1d4ed8','#5a79c8','#3b82f6',
  '#60a5fa','#93c5fd','#bfdbfe','#dbeafe',
];

import { getChannelColor, getAddressColor } from '../../utils/chartColors.js';

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
    <div style={{ background: C.card, borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)', borderTop: `3px solid ${color}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '14px 12px' }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>{label}</span>
      {children ?? <span style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value}</span>}
      {sub && <span style={{ fontSize: 11, color: C.muted, textAlign: 'center' }}>{sub}</span>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────
export default function SalesMarketingPage() {
  const { isMobile } = useIsMobile();
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
    <div style={{ ...s.page, ...(isMobile ? { padding: '20px 12px' } : {}) }}>
      <style>{`.recharts-wrapper *:focus { outline: none !important; }`}</style>

      {/* ── Header ── */}
      <div style={{ ...s.pageHeader, ...(isMobile ? { flexDirection: 'column' } : {}) }}>
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

      {/* ── KPI strip — row 1: appointment metrics ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 10 : 16, marginBottom: 12 }}>
        <div style={{ height: '100%' }}>
          <KpiCard label="Appointment Rate" color={C.indigo}>
            <RateRing rate={data.appointmentRate} />
            <span style={{ fontSize: 12, color: C.muted }}>{data.attendedAppointments} of {data.attendedAppointments + data.noShowLeads} booked</span>
          </KpiCard>
        </div>
        <KpiCard label="Completed" value={data.attendedAppointments + data.noShowLeads} color={C.indigo}
          sub="attended + didn't attend" />
        <KpiCard label="Total Attended" value={data.attendedAppointments} color={C.green}
          sub="completed leads who attended" />
        <KpiCard label="Total Didn't Attend" value={data.noShowLeads} color={C.red}
          sub="marked as didn't attend" />
      </div>
      {/* ── KPI strip — row 2: lead overview ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 10 : 16, marginBottom: 20 }}>
        <KpiCard label="Lead Quality Rate" color={C.green}>
          <RateRing rate={data.totalLeads > 0 ? (data.attendedAppointments + data.noShowLeads) / data.totalLeads : 0} />
          <span style={{ fontSize: 12, color: C.muted }}>{data.attendedAppointments + data.noShowLeads} completed of {data.totalLeads} leads</span>
        </KpiCard>
        <KpiCard label="Total Leads" value={data.totalLeads} color={C.blue}
          sub={`in ${data.selectedYear}`} />
        <KpiCard label="Rejected" value={data.rejectedLeads} color={'#92400e'}
          sub="rejected by school" />
        <KpiCard label="Active / Pending" value={data.pendingLeads} color={C.amber}
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
                    <FontAwesomeIcon icon={faXmark} /> clear
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
            <Bar dataKey="current" radius={[4, 4, 0, 0]} maxBarSize={32} name="current" activeBar={false}
              label={({ x, y, width, height, index }: any) => {
                const v = data.monthlyComparison[index]?.current ?? 0;
                if (!v) return null;
                if (height < 18) return <text key={`c-${x}`} x={x + width / 2} y={y - 4} textAnchor="middle" fill={C.blue} fontSize={10} fontWeight={700}>{v}</text>;
                return <text key={`c-${x}`} x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={11} fontWeight={700}>{v}</text>;
              }}>
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
                <span style={s.legendText}>{/^\d+$/.test(k) ? `Age ${k}` : k}</span>
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
                  formatter={(v: number, k: string) => [v, /^\d+$/.test(k) ? `Age ${k}` : k]}
                />
                {ageKeys.map((age, i) => (
                  <Bar key={age} dataKey={age} stackId="a"
                    fill={AGE_PALETTE[age] ?? DONUT_PALETTE[i]}
                    maxBarSize={48}
                    activeBar={false}
                    shape={(props: any) => {
                      const { x, y, width, height, index } = props;
                      if (!height) return null;
                      // Check if this is the topmost visible bar
                      const monthData = filteredMonthlyByAge[index];
                      const isTop = !ageKeys.slice(i + 1).some(k => (monthData?.[k] ?? 0) > 0);
                      const r = isTop ? 4 : 0;
                      return <path d={`M${x + r},${y} Q${x},${y} ${x},${y + r} L${x},${y + height} L${x + width},${y + height} L${x + width},${y + r} Q${x + width},${y} ${x + width - r},${y} Z`} fill={props.fill} />;
                    }}
                    label={i === ageKeys.length - 1 ? ({ x, y, width, index }: any) => {
                      const monthData = filteredMonthlyByAge[index];
                      const total = monthData?.total ?? 0;
                      if (!total) return null;
                      return <text key={`t-${x}`} x={x + width / 2} y={y - 6} textAnchor="middle" fill={C.muted} fontSize={11} fontWeight={700}>{total}</text>;
                    } : false}>
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
      </div>

      {/* ── Donuts ── */}
      <div style={{ ...s.donutRow, ...(isMobile ? { gridTemplateColumns: '1fr', gap: 12 } : {}) }}>
        <DonutCard
          title="Leads by Address"
          sub={selectedMonth !== null ? `${MONTH_LABELS[selectedMonth]} — where do enquiries come from?` : 'Where do enquiries come from?'}
          data={addressData}
          topN={5}
          colorFn={getAddressColor}
        />
        <DonutCard
          title="Marketing Channel"
          sub={selectedMonth !== null ? `${MONTH_LABELS[selectedMonth]} — how did they hear about us?` : 'How did they hear about us?'}
          data={channelData}
          topN={5}
          colorFn={getChannelColor}
        />
      </div>

    </div>
  );
}

// ── Donut card ────────────────────────────────────────────────────
function DonutCard({ title, sub, data, topN, colorFn }: { title: string; sub: string; data: { name: string; value: number }[]; topN?: number; colorFn?: (name: string, index: number) => string }) {
  const getColor = colorFn ?? ((_name: string, i: number) => DONUT_PALETTE[i % DONUT_PALETTE.length]);
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
                    <Cell key={i} fill={getColor(pieData[i]?.name ?? '', i)}
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
                        fill={i === othersIndex ? getColor(pieData[i]?.name ?? '', i) : 'transparent'}
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
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: getColor('Others', othersIndex), display: 'inline-block' }} />
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
                  <span style={{ ...s.legendDot(getColor(d.name, i)), flexShrink: 0 }} />
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
