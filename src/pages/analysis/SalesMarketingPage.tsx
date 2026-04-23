import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Cell, PieChart, Pie, Legend, Sector, LabelList,
} from 'recharts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faCalendar } from '@fortawesome/free-solid-svg-icons';
import { fetchAnalytics, fetchLeadById } from '../../api/leads.js';
import { Lead } from '../../types/index.js';
import { getChannelColor, getAddressColor } from '../../utils/chartColors.js';
import LeadQuickViewModal from '../../components/leads/LeadQuickViewModal.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { FilterPillStyles, PillSelect } from '../../components/common/FilterPill.js';

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


const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Helpers ───────────────────────────────────────────────────────
const RADIAN = Math.PI / 180;

function pct(n: number) { return `${Math.round(n * 100)}%`; }

function DonutLabel({ cx, cy, midAngle, outerRadius, percent, name }: any) {
  // Suppress labels on slices smaller than 6% — adjacent tiny slices
  // (Tampoi / Nusa Bestari / Taman Danga / …) bunch up at the bottom and
  // collide into illegible strings. The legend table below the chart
  // surfaces all entries, so hiding the tiny ones here loses no info.
  if (percent < 0.06) return null;
  const r = outerRadius + 36;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  // Truncate long names to stop long-tail labels pushing off the chart.
  const truncated = name.length > 18 ? name.slice(0, 16) + '…' : name;
  return (
    <text x={x} y={y} textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central" fontSize={11} fill={C.muted}>
      {truncated} <tspan fontWeight={600} fill={C.text}>{(percent * 100).toFixed(0)}%</tspan>
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

// ── KPI card · unified decision pattern ───────────────────────────
// One visual rule for every bar in the strip:
//   "current value as a fraction of a reference"
//     • rate cards  — reference is 100%, fill = the rate itself
//     • count cards — reference is the prior-period benchmark,
//                     fill = min(100, current / prev * 100)
//
// Anatomy (identical across every card):
//   1. label row   — accent dot + label + optional trend chip (right)
//   2. hero value  — 32px, tabular-nums
//   3. fill bar    — 6px, single-colour on a slate track
//   4. breakdown   — plain-english, 12px muted
//
// The shell matches the Financial / Staff / Revenue analysis pages:
// 1px slate border, 14px radius, soft two-layer shadow, accent-dot
// label row.
interface KpiCardProps {
  label: string;
  value: string | number;
  accent: string;                       // label dot + default value colour
  valueColor?: string;                  // overrides accent for the number
  trend?: {
    delta: string;                      // e.g. "+4", "−142 vs 2025"
    dir: 'up' | 'down' | 'flat';
    semantic?: 'positive' | 'negative' | 'neutral';
  };
  bar?: { fill: number; color: string; title?: string };   // fill 0..100 (single-segment)
  segments?: { value: number; color: string; label: string }[]; // multi-segment composition bar
  breakdown?: string;
}

function KpiCard({ label, value, accent, valueColor, trend, bar, segments, breakdown }: KpiCardProps) {
  const trendColor = !trend ? undefined
    : trend.semantic === 'negative' ? C.red
    : trend.semantic === 'neutral'  ? C.muted
    : C.green;
  const trendGlyph = !trend ? '' : trend.dir === 'up' ? '↑' : trend.dir === 'down' ? '↓' : '—';
  // Matches EmployeeCostPage / RevenueAnalysisPage typography (22/700 coloured
  // value, 11px muted subtitle) but keeps the single-segment fill bar under
  // the value to show ratio at a glance for rate-style KPIs.
  const resolvedValueColor = valueColor ?? accent;
  return (
    <div style={{
      background: C.card,
      border: '1px solid #e5e7eb',
      borderRadius: 14,
      padding: '12px 20px',
      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
      minHeight: 84,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: accent, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        </span>
        {trend && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: trendColor, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' as any }}>
            {trendGlyph} {trend.delta}
          </span>
        )}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: resolvedValueColor, letterSpacing: '-0.01em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' as any }}>
        {value}
      </div>
      {segments && segments.length > 0 && (() => {
        const segTotal = segments.reduce((a, s) => a + s.value, 0);
        if (segTotal <= 0) {
          return (
            <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, marginTop: 8 }} />
          );
        }
        return (
          <div style={{ display: 'flex', width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
            {segments.map((s, i) => {
              const pct = (s.value / segTotal) * 100;
              if (pct <= 0) return null;
              return (
                <div
                  key={`${s.label}-${i}`}
                  title={`${s.label}: ${s.value} (${Math.round(pct)}%)`}
                  style={{ width: `${pct}%`, height: '100%', background: s.color, transition: 'width 240ms ease, background 240ms ease' }}
                />
              );
            })}
          </div>
        );
      })()}
      {!segments && bar && (
        <div
          title={bar.title}
          style={{
            position: 'relative',
            width: '100%',
            height: 6,
            background: '#e2e8f0',
            borderRadius: 3,
            overflow: 'hidden',
            marginTop: 8,
          }}
        >
          <div
            style={{
              width: `${Math.max(0, Math.min(100, bar.fill))}%`,
              height: '100%',
              background: bar.color,
              borderRadius: 3,
              transition: 'width 240ms ease, background 240ms ease',
            }}
          />
        </div>
      )}
      {breakdown && (
        <div style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8', marginTop: 4 }}>{breakdown}</div>
      )}
    </div>
  );
}

// Outcome → pill config. The Leads Detail table uses this; the quick-view
// modal just reuses whichever pill the row showed so the header matches.
const OUTCOME_PILL: Record<string, { label: string; bg: string; color: string }> = {
  attended:    { label: 'Attended',    bg: '#dcfce7', color: '#15803d' },
  noShow:      { label: 'No show',     bg: '#fee2e2', color: '#991b1b' },
  unqualified: { label: 'Unqualified', bg: '#fef3c7', color: '#92400e' },
  pending:     { label: 'Pending',     bg: '#f1f5f9', color: '#475569' },
};
// ── Page ──────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  NEW:                { label: 'New',         bg: '#dbeafe', color: '#1e40af' },
  CONTACTED:          { label: 'Contacted',   bg: '#e0e7ff', color: '#3730a3' },
  APPOINTMENT_BOOKED: { label: 'Appt Booked', bg: '#fef3c7', color: '#92400e' },
  FOLLOW_UP:          { label: 'Follow Up',   bg: '#fef9c3', color: '#854d0e' },
  ENROLLED:           { label: 'Enrolled',    bg: '#dcfce7', color: '#166534' },
  LOST:               { label: 'Lost',        bg: '#fee2e2', color: '#991b1b' },
  REJECTED:           { label: 'Rejected',    bg: '#f1f5f9', color: '#64748b' },
};

const PAGE_SIZE_OPTIONS = [15, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 15;

type FilterState = { type: 'address' | 'channel'; value: string } | null;

type QuickViewOutcome = 'attended' | 'noShow' | 'unqualified' | 'pending';
type QuickViewTarget = { lead: Lead; outcome: QuickViewOutcome };

export default function SalesMarketingPage() {
  const { isMobile } = useIsMobile();
  const [editingLead, setEditingLead] = useState<QuickViewTarget | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterState>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

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

  // ── Filtered + paginated leads for table ──
  const filteredLeads = activeFilter
    ? monthLeads.filter(r =>
        activeFilter.type === 'address'
          ? r.address === activeFilter.value
          : r.channel === activeFilter.value
      )
    : monthLeads;

  // Sort order: enrolment year ↑, then outcome bucket (matches the bar stack:
  // attended → didn't attend → unqualified → pending), then submittedAt desc.
  const OUTCOME_ORDER: Record<string, number> = { attended: 0, noShow: 1, unqualified: 2, pending: 3 };
  const sortedLeads = [...filteredLeads].sort((a: any, b: any) => {
    if (a.enrolmentYear !== b.enrolmentYear) return a.enrolmentYear - b.enrolmentYear;
    const ao = OUTCOME_ORDER[a.outcome] ?? 99;
    const bo = OUTCOME_ORDER[b.outcome] ?? 99;
    if (ao !== bo) return ao - bo;
    return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
  });
  const pageCount = Math.max(1, Math.ceil(sortedLeads.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedLeads = sortedLeads.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleSegmentClick = (type: 'address' | 'channel', value: string) => {
    setActiveFilter(prev => (prev?.type === type && prev?.value === value) ? null : { type, value });
    setPage(1);
  };

  const filteredMonthlyByAge = selectedMonth !== null
    ? data.monthlyByAge.filter(m => m.month === MONTH_LABELS[selectedMonth])
    : data.monthlyByAge;

  // ── Click handler ─────────────────────────────────────────────────
  function handleMonthClick(chartData: any) {
    if (!chartData?.activeLabel) return;
    const idx = MONTH_LABELS.indexOf(chartData.activeLabel);
    if (idx === -1) return;
    // Skip selecting months with no current-year data. Source-of-truth is
    // the monthlyComparison array — reading from chartData.activePayload is
    // unreliable because its shape depends on which element got clicked
    // (bar, line, or background) and sometimes comes back empty.
    const row = data.monthlyComparison[idx];
    const total = (row?.attended ?? 0) + (row?.noShow ?? 0) + (row?.unqualified ?? 0) + (row?.pending ?? 0);
    if (total === 0) return;
    setSelectedMonth(prev => prev === idx ? null : idx);
    setActiveFilter(null);
    setPage(1);
  }

  return (
    <div style={{ ...s.page, ...(isMobile ? { padding: '20px 12px' } : {}) }}>
      <style>{`.recharts-wrapper *:focus { outline: none !important; } .mk-row:hover { background: #eef2fa !important; }`}</style>
      <FilterPillStyles />

      {/* ── Header ── */}
      <div style={{ ...s.pageHeader, ...(isMobile ? { flexDirection: 'column' } : {}) }}>
        <div>
          <h1 style={s.pageTitle}>Marketing Analysis</h1>
        </div>
        <div style={s.filterWrap}>
          <PillSelect
            icon={faCalendar}
            value={String(selectedYear ?? new Date().getFullYear())}
            onChange={v => {
              const n = Number(v);
              setSelectedYear(n === new Date().getFullYear() ? undefined : n);
              setSelectedMonth(null);
              setActiveFilter(null);
              setPage(1);
            }}
            options={(() => {
              const now = new Date().getFullYear();
              return [now - 2, now - 1, now].map(y => ({
                value: String(y),
                label: y === now ? `${y} (current)` : String(y),
              }));
            })()}
          />
        </div>
      </div>

      {/* ── KPI strip · unified 3-card decision layout ── */}
      {(() => {
        // `completedWithAppt` = leads that had an appointment outcome
        // (either attended or no-show) — used for Appointment Rate.
        const completedWithAppt = data.attendedAppointments + data.noShowLeads;
        const appointmentPct = Math.round(data.appointmentRate * 100);
        // Lead Quality = qualified / total. A lead is qualified if marketing
        // delivered a real prospect: they either showed intent (attended or
        // booked an appointment) or lost for a user-defined reason (e.g. fee,
        // distance). Unqualified = rejected or lost as "cold" (didn't reply).
        const leadQualityPct = Math.round(data.leadQualityRate * 100);

        // YoY trend — surfaces only as a pill in the top-right of Leads
        // Received. The bar itself now shows outcome composition, not YoY.
        const prevYearTotal = data.monthlyComparison.reduce((s, m) => s + (m.previous ?? 0), 0);
        const leadsDelta = data.totalLeads - prevYearTotal;
        const leadsTrend = prevYearTotal > 0
          ? {
              delta: `${leadsDelta >= 0 ? '+' : '−'}${Math.abs(leadsDelta)} vs ${data.prevYear}`,
              dir: (leadsDelta > 0 ? 'up' : leadsDelta < 0 ? 'down' : 'flat') as 'up' | 'down' | 'flat',
              semantic: (leadsDelta >= 0 ? 'positive' : 'negative') as 'positive' | 'negative' | 'neutral',
            }
          : undefined;

        return (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            <KpiCard
              label="Lead Quality"
              value={`${leadQualityPct}%`}
              accent={C.green}
              bar={{ fill: leadQualityPct, color: C.green, title: `${data.qualifiedLeads} qualified out of ${data.totalLeads} total` }}
              breakdown={`${data.qualifiedLeads} qualified out of ${data.totalLeads} total`}
            />
            <KpiCard
              label="Appointment Rate"
              value={`${appointmentPct}%`}
              accent={C.blue}
              bar={{ fill: appointmentPct, color: C.blue, title: `${data.attendedAppointments} attended out of ${completedWithAppt} with appointments` }}
              breakdown={`${data.attendedAppointments} attended out of ${completedWithAppt} with appointments`}
            />
            <KpiCard
              label="Leads Received"
              value={data.totalLeads}
              accent={C.slate}
              trend={leadsTrend}
              segments={[
                { value: data.attendedAppointments, color: C.green,   label: 'Attended' },
                { value: data.noShowLeads,          color: C.red,     label: 'No show' },
                { value: data.unqualifiedLeads,     color: C.amber,   label: 'Unqualified' },
                // Pending uses the same slate-200 as the unfilled track on
                // Lead Quality / Appointment Rate — visually reads as "not
                // yet decided" rather than a distinct negative outcome.
                { value: data.pendingLeads,         color: '#e2e8f0', label: 'Pending' },
              ]}
              breakdown={(() => {
                if (data.totalLeads === 0) return undefined;
                const pct = (n: number) => Math.round((n / data.totalLeads) * 100);
                return `${pct(data.attendedAppointments)}% attended · ${pct(data.noShowLeads)}% no show · ${pct(data.unqualifiedLeads)}% unqualified · ${pct(data.pendingLeads)}% pending`;
              })()}
            />
          </div>
        );
      })()}

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
          <div style={{ ...s.legendInline, fontSize: 12, color: C.muted }}>
            <span style={s.legendInlineItem}>
              <span style={s.legendDot(C.green)} />
              <span style={s.legendText}>Attended</span>
            </span>
            <span style={s.legendInlineItem}>
              <span style={s.legendDot(C.red)} />
              <span style={s.legendText}>Didn't attend</span>
            </span>
            <span style={s.legendInlineItem}>
              <span style={s.legendDot(C.amber)} />
              <span style={s.legendText}>Unqualified</span>
            </span>
            <span style={s.legendInlineItem}>
              <span style={s.legendDot(C.slate)} />
              <span style={s.legendText}>Pending</span>
            </span>
            <span style={s.legendInlineItem}>
              <svg width="20" height="10">
                <line x1="0" y1="5" x2="20" y2="5" stroke={C.slate} strokeWidth="2" strokeDasharray="4 3" />
              </svg>
              <span style={s.legendText}>{data.prevYear}</span>
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart
            data={data.monthlyComparison.map(m => ({
              ...m,
              total: (m.attended ?? 0) + (m.noShow ?? 0) + (m.unqualified ?? 0) + (m.pending ?? 0),
            }))}
            margin={{ top: 20, right: 16, left: 0, bottom: 0 }}
            style={{ outline: 'none', cursor: 'pointer' }}
            onClick={handleMonthClick}>
            <CartesianGrid vertical={false} stroke={C.border} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: C.muted }} axisLine={false} tickLine={false} padding={{ left: 6, right: 6 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              cursor={{ fill: '#eef2ff', opacity: 0.35 }}
              content={({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload;
                if (!row) return null;
                const total = (row.attended ?? 0) + (row.noShow ?? 0) + (row.unqualified ?? 0) + (row.pending ?? 0);
                const monthIdx = MONTH_LABELS.indexOf(String(label));
                const isSelected = selectedMonth !== null && monthIdx === selectedMonth;
                const row1 = (dotColor: string, name: string, value: number, strong = false) => (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '3px 0' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: strong ? C.text : C.muted, fontWeight: strong ? 700 : 500 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: dotColor }} />
                      {name}
                    </span>
                    <span style={{ color: strong ? C.text : '#475569', fontWeight: strong ? 800 : 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
                  </div>
                );
                return (
                  <div style={{
                    background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10,
                    padding: '12px 14px', fontSize: 12, minWidth: 200,
                    boxShadow: '0 1px 2px rgba(15,23,42,0.05), 0 4px 12px rgba(15,23,42,0.06)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, color: C.text }}>{label} {data.selectedYear}</span>
                      {isSelected && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#4338ca', background: '#e0e7ff', padding: '1px 7px', borderRadius: 999, letterSpacing: '0.05em' }}>SELECTED</span>
                      )}
                    </div>
                    {/* Months with no current-year activity skip the outcome
                        rows entirely — four "0" lines add noise without
                        changing any decision. */}
                    {total > 0 && (
                      <>
                        {row1(C.green, 'Attended', row.attended ?? 0)}
                        {row1(C.red, 'No show', row.noShow ?? 0)}
                        {row1(C.amber, 'Unqualified', row.unqualified ?? 0)}
                        {row1(C.slate, 'Pending', row.pending ?? 0)}
                        <div style={{ height: 1, background: '#f1f5f9', margin: '8px 0' }} />
                      </>
                    )}
                    {row1(C.text, 'Total', total, true)}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '3px 0', marginTop: 4 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: C.muted, fontWeight: 500 }}>
                        <svg width="14" height="8"><line x1="0" y1="4" x2="14" y2="4" stroke={C.slate} strokeWidth="2" strokeDasharray="3 2" /></svg>
                        {data.prevYear}
                      </span>
                      <span style={{ color: '#475569', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{row.previous ?? 0}</span>
                    </div>
                  </div>
                );
              }}
            />
            {/* Stacked outcome bars aligned with the qualification framework:
                attended (green) + noShow (red) + unqualified (amber) + pending (slate).
                Rounded cap is applied ONLY to the topmost non-zero segment via a
                custom shape function, so we never see a rounded notch peeking out
                from an underlying segment. Totals are drawn separately by an
                invisible Line overlay (see below) — that's more reliable than
                Bar labels, which skip any cell with value 0. */}
            {(() => {
              const topmostFor = (row: any): 'attended' | 'noShow' | 'unqualified' | 'pending' | null => {
                if ((row.pending ?? 0) > 0) return 'pending';
                if ((row.unqualified ?? 0) > 0) return 'unqualified';
                if ((row.noShow ?? 0) > 0) return 'noShow';
                if ((row.attended ?? 0) > 0) return 'attended';
                return null;
              };
              const makeShape = (key: 'attended' | 'noShow' | 'unqualified' | 'pending') => (props: any) => {
                const { x, y, width, height, fill, opacity, payload } = props;
                if (!height || height <= 0) return <g key={`s-${key}-${x}`} />;
                const isTop = topmostFor(payload) === key;
                const r = isTop ? Math.min(4, width / 2, height) : 0;
                // Rect with top-left and top-right corners rounded when topmost,
                // flat otherwise. SVG path: M (x, y+r) Q x,y x+r,y L x+w-r,y Q x+w,y x+w,y+r L x+w,y+h L x,y+h Z
                const d = r > 0
                  ? `M ${x},${y + r} Q ${x},${y} ${x + r},${y} L ${x + width - r},${y} Q ${x + width},${y} ${x + width},${y + r} L ${x + width},${y + height} L ${x},${y + height} Z`
                  : `M ${x},${y} L ${x + width},${y} L ${x + width},${y + height} L ${x},${y + height} Z`;
                return <path key={`s-${key}-${x}`} d={d} fill={fill} opacity={opacity} />;
              };
              const cellsFor = (fill: string) => data.monthlyComparison.map((entry, i) => {
                const monthIdx = MONTH_LABELS.indexOf(entry.month);
                const dimmed = selectedMonth !== null && monthIdx !== selectedMonth;
                return <Cell key={`${fill}-${i}`} fill={fill} opacity={dimmed ? 0.25 : 1} />;
              });
              return (
                <>
                  <Bar dataKey="attended" stackId="outcome" maxBarSize={38} name="attended" isAnimationActive={false} shape={makeShape('attended')}>
                    {cellsFor(C.green)}
                  </Bar>
                  <Bar dataKey="noShow" stackId="outcome" maxBarSize={38} name="noShow" isAnimationActive={false} shape={makeShape('noShow')}>
                    {cellsFor(C.red)}
                  </Bar>
                  <Bar dataKey="unqualified" stackId="outcome" maxBarSize={38} name="unqualified" isAnimationActive={false} shape={makeShape('unqualified')}>
                    {cellsFor(C.amber)}
                  </Bar>
                  <Bar dataKey="pending" stackId="outcome" maxBarSize={38} name="pending" isAnimationActive={false} shape={makeShape('pending')}>
                    {cellsFor(C.slate)}
                  </Bar>
                </>
              );
            })()}

            {/* Invisible line at y = total for each month — reliably hosts the
                total label because Line labels fire for every data point,
                unlike Bar labels which skip 0-value cells. */}
            <Line
              dataKey="total"
              stroke="transparent"
              isAnimationActive={false}
              dot={false}
              activeDot={false}
              legendType="none"
            >
              <LabelList
                dataKey="total"
                position="top"
                content={(props: any) => {
                  const { x, y, value } = props;
                  const v = Number(value) || 0;
                  if (v <= 0) return <text key={`lt-${x}`} />;
                  return (
                    <text
                      x={x}
                      y={y - 8}
                      textAnchor="middle"
                      fill={C.muted}
                      fontSize={11}
                      fontWeight={700}
                      style={{ fontVariantNumeric: 'tabular-nums' as any }}
                    >
                      {v}
                    </text>
                  );
                }}
              />
            </Line>
            <Line
              dataKey="previous"
              stroke={C.slate}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={{ r: 2.5, fill: '#fff', stroke: C.slate, strokeWidth: 1.5 }}
              activeDot={{ r: 4, fill: C.slate, stroke: '#fff', strokeWidth: 2 }}
              name="previous"
              isAnimationActive={false}
            />
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
                      const isTop = !ageKeys.slice(i + 1).some(k => (Number(monthData?.[k]) || 0) > 0);
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
          sub="Click a segment to filter the table"
          data={addressData}
          topN={5}
          colorFn={getAddressColor}
          filterType="address"
          activeValue={activeFilter?.type === 'address' ? activeFilter.value : undefined}
          onSegmentClick={handleSegmentClick}
        />
        <DonutCard
          title="Marketing Channel"
          sub="Click a segment to filter the table"
          data={channelData}
          topN={5}
          colorFn={getChannelColor}
          filterType="channel"
          activeValue={activeFilter?.type === 'channel' ? activeFilter.value : undefined}
          onSegmentClick={handleSegmentClick}
        />
      </div>

      {/* ── Leads table ── */}
      <div style={s.card}>
        <div style={{ ...s.cardHeader, marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={s.cardTitle}>Leads Detail</h2>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const, marginTop: 2 }}>
              <p style={{ margin: 0, fontSize: 12, color: C.muted }}>
                {activeFilter
                  ? <>Filtered by <strong>{activeFilter.value}</strong> · {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}</>
                  : <>All leads · {selectedMonth !== null ? MONTH_LABELS[selectedMonth] + ' ' : ''}{data.selectedYear} — {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}</>
                }
              </p>
              {/* Outcome breakdown aligned to the right of the subtitle — at
                  a glance: how does this slice of leads actually perform? */}
              {filteredLeads.length > 0 && (() => {
                const counts: Record<'attended' | 'noShow' | 'unqualified' | 'pending', number> = {
                  attended: 0, noShow: 0, unqualified: 0, pending: 0,
                };
                for (const r of filteredLeads as any[]) {
                  if (counts[r.outcome as keyof typeof counts] !== undefined) counts[r.outcome as keyof typeof counts]++;
                }
                const total = filteredLeads.length;
                const pct = (n: number) => Math.round((n / total) * 100);
                const items: { key: keyof typeof counts; label: string; color: string; bg: string }[] = [
                  { key: 'attended',    label: 'Attended',    color: '#15803d', bg: '#dcfce7' },
                  { key: 'noShow',      label: 'No show',     color: '#991b1b', bg: '#fee2e2' },
                  { key: 'unqualified', label: 'Unqualified', color: '#92400e', bg: '#fef3c7' },
                  { key: 'pending',     label: 'Pending',     color: '#475569', bg: '#f1f5f9' },
                ];
                return (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
                    {items.map(it => counts[it.key] > 0 && (
                      <span key={it.key} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '2px 8px', fontSize: 11, fontWeight: 600,
                        borderRadius: 999, background: it.bg, color: it.color,
                        whiteSpace: 'nowrap',
                      }}>
                        {it.label} <span style={{ fontWeight: 700 }}>{pct(counts[it.key])}%</span>
                        <span style={{ opacity: 0.7, fontWeight: 500 }}>({counts[it.key]})</span>
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
          {activeFilter && (
            <button onClick={() => { setActiveFilter(null); setPage(1); }} style={s.clearBtn}>
              <FontAwesomeIcon icon={faXmark} /> Clear filter
            </button>
          )}
        </div>
        {/* Reserve a fixed height for the full page + headers + a handful
            of enrolment-year dividers so navigating between pages (or to a
            short tail) doesn't shift the pagination bar vertically. If a
            page is taller than this (unusual divider density), the wrapper
            grows — minor flex, not a full jump. */}
        <div style={{ overflowX: 'auto', minHeight: 40 + pageSize * 40 + 120 }}>
          <table style={{ ...s.table, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '26%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '26%' }} />
            </colgroup>
            <thead>
              <tr>
                {['Name', 'Status', 'Age', 'Address', 'Marketing Channel'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedLeads.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ ...s.td, textAlign: 'center', color: '#cbd5e1', padding: '32px 0' }}>
                    No leads match this filter.
                  </td>
                </tr>
              ) : (() => {
                const OUTCOME_META: Record<string, { label: string; fg: string; bg: string }> = {
                  attended:    { label: 'Attended', fg: C.green, bg: '#dcfce7' },
                  noShow:      { label: 'No show', fg: C.red, bg: '#fee2e2' },
                  unqualified: { label: 'Unqualified', fg: C.amber, bg: '#fef3c7' },
                  pending:     { label: 'Pending', fg: C.slate, bg: '#f1f5f9' },
                };
                const rows: React.ReactNode[] = [];
                let lastYear: number | null = null;
                pagedLeads.forEach((row: any, i: number) => {
                  if (row.enrolmentYear !== lastYear) {
                    lastYear = row.enrolmentYear;
                    rows.push(
                      <tr key={`grp-${row.enrolmentYear}`}>
                        <td colSpan={5} style={{ padding: '12px 14px 10px', background: '#e0e7ff', borderTop: '2px solid #c7d2fe', borderBottom: '1px solid #c7d2fe', fontSize: 12, fontWeight: 800, color: '#3730a3', letterSpacing: '0.04em' }}>
                          Enrolment Year {row.enrolmentYear}
                        </td>
                      </tr>
                    );
                  }
                  const meta = OUTCOME_META[row.outcome] ?? OUTCOME_META.pending;
                  // Tooltip reflects the lead's *real* reason when one is
                  // stored (lostReason, or free-text notes). For leads with
                  // nothing recorded — e.g. legacy REJECTED rows — we skip
                  // the tooltip rather than inventing a label that repeats
                  // what the pill already says.
                  const reasonNote = row.notes && row.notes !== row.lostReason ? row.notes : null;
                  const pillTooltip: string | undefined = row.lostReason ?? reasonNote ?? undefined;
                  rows.push(
                    <tr key={row.id} className="mk-row" style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                      onClick={async () => { try { const lead = await fetchLeadById(row.id); setEditingLead({ lead, outcome: row.outcome }); } catch { /* ignore */ } }}>
                      <td style={s.td}><span style={{ fontWeight: 600, color: C.text }}>{row.childName}</span></td>
                      <td style={s.td}>
                        <span title={pillTooltip} style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          fontSize: 10,
                          fontWeight: 700,
                          borderRadius: 999,
                          background: meta.bg,
                          color: meta.fg,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          whiteSpace: 'nowrap',
                          cursor: pillTooltip ? 'help' : 'default',
                        }}>{meta.label}</span>
                      </td>
                      <td style={{ ...s.td, textAlign: 'center' }}>
                        <span style={{ display: 'inline-block', minWidth: 24, padding: '2px 8px', fontSize: 11, fontWeight: 700, borderRadius: 10, background: AGE_PALETTE[String(row.age)] ? `${AGE_PALETTE[String(row.age)]}18` : '#f1f5f9', color: AGE_PALETTE[String(row.age)] ?? C.muted, textAlign: 'center' }}>{row.age}</span>
                      </td>
                      <td style={s.td}>{row.address ?? <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                      <td style={s.td}>{row.channel ? <span style={{ color: getChannelColor(row.channel, 0), fontWeight: 600 }}>{row.channel}</span> : <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                    </tr>
                  );
                });
                // Pad out the last page so the table's height matches a full
                // page. Prevents the whole viewport from jumping when you
                // navigate to a short tail.
                const padRows = pageSize - pagedLeads.length;
                for (let i = 0; i < padRows; i++) {
                  rows.push(
                    <tr key={`pad-${i}`} aria-hidden="true">
                      <td colSpan={5} style={{ ...s.td, height: 37, padding: '10px 12px', color: 'transparent', pointerEvents: 'none' }}>&nbsp;</td>
                    </tr>
                  );
                }
                return rows;
              })()}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredLeads.length > 0 && (
          <div style={s.pagination}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.muted }}>
              <span>Rows</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                style={{
                  padding: '4px 8px',
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  color: C.text,
                  background: '#fff',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PagBtn label="‹" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} />
              {Array.from({ length: pageCount }, (_, i) => i + 1)
                .filter(p => p === 1 || p === pageCount || Math.abs(p - safePage) <= 1)
                .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === '…'
                    ? <span key={`e${i}`} style={{ width: 32, textAlign: 'center' as const, fontSize: 12, color: C.muted }}>…</span>
                    : <PagBtn key={p} label={String(p)} onClick={() => setPage(p as number)} active={safePage === p} />
                )
              }
              <PagBtn label="›" onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={safePage === pageCount} />
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>
              {Math.min((safePage - 1) * pageSize + 1, filteredLeads.length)}–{Math.min(safePage * pageSize, filteredLeads.length)} of {filteredLeads.length}
            </div>
          </div>
        )}
      </div>

      {editingLead && (
        <LeadQuickViewModal
          lead={editingLead.lead}
          pill={OUTCOME_PILL[editingLead.outcome] ?? OUTCOME_PILL.pending}
          onClose={() => setEditingLead(null)}
        />
      )}
    </div>
  );
}

// ── Donut card ────────────────────────────────────────────────────
function PagBtn({ label, onClick, disabled, active }: { label: string; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${active ? C.indigo : C.border}`, borderRadius: 6,
        background: active ? C.indigo : C.card, color: active ? '#fff' : disabled ? '#cbd5e1' : C.text,
        fontSize: 13, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
      }}>{label}</button>
  );
}

function DonutCard({ title, sub, data, topN, colorFn, filterType, activeValue, onSegmentClick }: {
  title: string; sub: string; data: { name: string; value: number }[]; topN?: number;
  colorFn?: (name: string, index: number) => string;
  filterType?: 'address' | 'channel'; activeValue?: string;
  onSegmentClick?: (type: 'address' | 'channel', value: string) => void;
}) {
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
    if (hasOthers && index === othersIndex) { setShowOthers(prev => !prev); return; }
    if (filterType && onSegmentClick && pieData[index]) {
      onSegmentClick(filterType, pieData[index].name);
    }
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
                  labelLine={(props: any) => props.percent >= 0.06 ? <polyline stroke={C.border} strokeWidth={1} fill="none" points={props.points?.map((p: any) => `${p.x},${p.y}`).join(' ')} /> : null as any}
                  label={(props: any) => <DonutLabel {...props} />}
                  isAnimationActive={false} style={{ outline: 'none' }}
                  onClick={handlePieClick}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={getColor(entry?.name ?? '', i)}
                      opacity={activeValue && activeValue !== entry.name ? 0.3 : 1}
                      style={{ cursor: 'pointer' }} />
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
              {legendData.map((d, i) => {
                const isOthersToggle = d.name === 'Others' && hasOthers && !showOthers;
                const isActive = activeValue === d.name;
                const clickable = isOthersToggle || (filterType && onSegmentClick && d.name !== 'Others');
                return (
                  <div key={d.name} style={{
                    ...s.donutRow2,
                    ...(clickable ? { cursor: 'pointer' } : {}),
                    ...(isActive ? { background: '#eff6ff', borderRadius: 6, margin: '-2px -6px', padding: '2px 6px' } : {}),
                    ...(activeValue && !isActive ? { opacity: 0.4 } : {}),
                  }}
                    onClick={isOthersToggle ? () => setShowOthers(true) : clickable ? () => onSegmentClick!(filterType!, d.name) : undefined}
                  >
                    <span style={{ ...s.legendDot(getColor(d.name, i)), flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, color: C.text }}>{d.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{d.value}</span>
                    <span style={{ fontSize: 12, color: C.muted, width: 36, textAlign: 'right' }}>
                      {pct(d.value / total)}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const s: Record<string, any> = {
  page: { padding: '28px 32px', maxWidth: 1200, margin: '0 auto', background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#0f172a' },
  pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16 },
  pageTitle: { fontSize: 24, fontWeight: 700, color: '#0f172a', margin: '0 0 4px', letterSpacing: '-0.02em' },
  pageSubtitle: { fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.5 },
  filterWrap: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  filterLabel: { fontSize: 12, fontWeight: 600, color: C.muted },
  select: { padding: '7px 14px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, color: C.text, background: C.card, cursor: 'pointer', fontWeight: 500 },
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 },
  card: {
    background: C.card,
    border: '1px solid #e5e7eb',
    borderRadius: 14,
    padding: '20px 24px',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
    marginBottom: 24,
  },
  cardHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 4px', letterSpacing: '-0.01em' },
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
  clearBtn: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: 11, fontWeight: 600, border: `1px solid ${C.border}`, borderRadius: 6, background: C.card, color: C.muted, cursor: 'pointer', fontFamily: 'inherit' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '12px 12px', fontWeight: 600, fontSize: 11, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', background: '#fafbfc', verticalAlign: 'middle' },
  td: { padding: '10px 12px', borderBottom: `1px solid #f1f5f9`, fontSize: 13, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const, marginTop: 14, paddingTop: 14, borderTop: `1px solid #f1f5f9` },
};
