import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Cell, LabelList, ReferenceArea,
} from 'recharts';
import { faCalendar } from '@fortawesome/free-solid-svg-icons';
import { fetchRevenueAnalytics, fetchStudents } from '../../api/students.js';
import { Student } from '../../types/index.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { FilterPillStyles, PillSelect, PillToggle } from '../../components/common/FilterPill.js';

type GroupBy = 'month' | 'quarter';

interface RevenueEntry {
  key: string;
  label: string;
  revenue: number;
  studentCount: number;
  current: number;
  previous: number;
  isForecast: boolean;
  containsCurrent: boolean;
}

function buildRevenueEntries(
  months: { month: string; revenue: number; studentCount: number; current: number; previous: number; isForecast: boolean }[],
  currentMonthIdx: number,
  groupBy: GroupBy,
): RevenueEntry[] {
  if (groupBy === 'month') {
    return months.map((m, i) => ({
      key: String(i),
      label: m.month,
      revenue: m.revenue,
      studentCount: m.studentCount,
      current: m.current,
      previous: m.previous,
      isForecast: m.isForecast,
      containsCurrent: i === currentMonthIdx,
    }));
  }
  return [0, 1, 2, 3].map(qi => {
    const indices = [qi * 3, qi * 3 + 1, qi * 3 + 2];
    const slice = indices.map(i => months[i]);
    const last = slice[slice.length - 1];
    return {
      key: `q${qi + 1}`,
      label: `Q${qi + 1}`,
      revenue: slice.reduce((s, m) => s + m.revenue, 0),
      studentCount: last.studentCount,
      current: slice.reduce((s, m) => s + m.current, 0),
      previous: slice.reduce((s, m) => s + m.previous, 0),
      isForecast: slice.every(m => m.isForecast),
      containsCurrent: indices.includes(currentMonthIdx),
    };
  });
}

const C = {
  blue: '#5a79c8', indigo: '#4f46e5', purple: '#7c3aed', green: '#059669',
  amber: '#d97706', slate: '#94a3b8', red: '#dc2626', teal: '#0d9488',
};

const PROG_COLORS: Record<string, string> = {
  'Full Day': '#4f46e5',
  'Half Day': '#3b82f6',
  'Half Day + Enrichment': '#8b5cf6',
  'Core': '#60a5fa',
  'Core+Music': '#a78bfa',
  'FullDay': '#4f46e5',
};
const AGE_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#ec4899'];
const MONTH_NAMES_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function fmtCurrency(n: number) {
  return 'RM ' + n.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Same as fmtCurrency but uses a non-breaking space so chart labels don't wrap
function fmtCurrencyNbsp(n: number) {
  return 'RM\u00A0' + n.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function RevenueAnalysisPage() {
  const { isMobile } = useIsMobile();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [groupBy, setGroupBy] = useState<GroupBy>('month');
  const [period, setPeriod] = useState<string>(() => String(new Date().getMonth()));

  const { data, isLoading, isError } = useQuery({
    queryKey: ['revenue-analytics', selectedYear],
    queryFn: () => fetchRevenueAnalytics(selectedYear),
  });

  const { data: studentsData } = useQuery({
    queryKey: ['students', { pageSize: 1000 }],
    queryFn: () => fetchStudents({ pageSize: 1000 }),
  });
  const allStudents: Student[] = studentsData?.items ?? [];

  // Build chart entries (12 months or 4 quarters)
  const entries = useMemo<RevenueEntry[]>(
    () => data ? buildRevenueEntries(data.monthlyRevenue, data.currentMonthIdx, groupBy) : [],
    [data, groupBy],
  );

  // Reset period to current month/quarter when year or grouping changes
  useEffect(() => {
    const now = new Date();
    if (selectedYear !== now.getFullYear()) {
      setPeriod('all');
      return;
    }
    const m = now.getMonth();
    setPeriod(groupBy === 'quarter' ? `q${Math.floor(m / 3) + 1}` : String(m));
  }, [selectedYear, groupBy]);

  // If the selected period becomes entirely forecast, reset to "all"
  useEffect(() => {
    if (entries.length === 0 || period === 'all') return;
    const entry = entries.find(e => e.key === period);
    if (!entry || entry.isForecast) setPeriod('all');
  }, [entries, period]);

  if (isLoading) return <div style={s.page}><p style={{ padding: 40, color: '#94a3b8' }}>Loading...</p></div>;
  if (isError || !data) return <div style={s.page}><p style={{ padding: 40, color: '#dc2626' }}>Failed to load revenue data.</p></div>;

  const years = data.availableYears.length > 0 ? data.availableYears : [currentYear];

  // Derive selectedMonth for the NewStudentsList: only when period is a single month
  const selectedMonth: number | null =
    period === 'all' || period.startsWith('q') ? null : Number(period);

  const selectedEntry = entries.find(e => e.key === period);

  return (
    <div style={s.page}>
      <style>{`.recharts-wrapper, .recharts-surface, .recharts-wrapper:focus, .recharts-surface:focus, .recharts-wrapper *:focus, .recharts-surface *:focus { outline: none !important; }`}</style>
      <FilterPillStyles />
      <div style={s.inner}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={s.heading}>Revenue Analysis</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <PillSelect
              icon={faCalendar}
              value={String(selectedYear)}
              onChange={v => setSelectedYear(Number(v))}
              options={years.map(y => ({ value: String(y), label: String(y) }))}
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

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          <KpiCard
            label={`Active Students (${MONTH_NAMES_FULL[data.currentMonthIdx] ?? ''})`}
            value={String(data.totalActiveStudents)}
            color={C.blue}
          />
          <KpiCard
            label={`${MONTH_NAMES_FULL[data.currentMonthIdx] ?? ''} Revenue`}
            value={fmtCurrency(data.totalMonthlyRevenue)}
            color={C.green}
          />
          <KpiCard label="Actual YTD" value={fmtCurrency(data.actualRevenue)} color={C.indigo} />
          <KpiCard label="Annual (incl. forecast)" value={fmtCurrency(data.annualRevenue)} color={C.purple} sub={data.forecastRevenue > 0 ? `Forecast: ${fmtCurrency(data.forecastRevenue)}` : undefined} />
        </div>

        {/* Chart 1: Monthly Revenue */}
        <div style={s.chartCard}>
          <h3 style={s.chartTitle}>Revenue by {groupBy === 'quarter' ? 'Quarter' : 'Month'} — {selectedYear}</h3>
          <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 11, color: '#94a3b8' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: C.blue, marginRight: 4 }} />Actual</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#bfdbfe', marginRight: 4 }} />Forecast</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 4, background: C.amber, marginRight: 4, verticalAlign: 'middle' }} />Students</span>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={entries} margin={{ top: 30, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#94a3b8', cursor: 'pointer' }}
                onClick={(e: any) => {
                  if (e && e.value) {
                    const entry = entries.find(x => x.label === e.value);
                    if (entry) setPeriod(entry.key);
                  }
                }}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.55 / 5000) * 5000]}
                tickCount={6}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.05 / 5) * 5]}
                tickCount={6}
              />
              <Tooltip cursor={false} formatter={(v: number, name: string) => [name === 'Students' ? `${v} students` : fmtCurrency(v), name]} />
              {selectedEntry && (
                <ReferenceArea
                  yAxisId="left"
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
              <Bar
                yAxisId="left"
                dataKey="revenue"
                radius={[4, 4, 0, 0]}
                barSize={groupBy === 'quarter' ? 80 : 28}
                name="Revenue"
                cursor="pointer"
                onClick={(_data: any, index: number) => {
                  const entry = entries[index];
                  if (entry) setPeriod(entry.key);
                }}
              >
                {entries.map((entry, i) => {
                  const fill = entry.containsCurrent
                    ? '#1e3a8a'
                    : entry.isForecast
                      ? '#bfdbfe'
                      : C.blue;
                  return <Cell key={i} fill={fill} />;
                })}
                <LabelList
                  dataKey="revenue"
                  position="top"
                  formatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                  style={{ fontSize: 10, fill: '#475569', fontWeight: 600 }}
                />
              </Bar>
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="studentCount"
                stroke={C.amber}
                strokeWidth={2}
                dot={{ r: 4, fill: '#fff', stroke: C.amber, strokeWidth: 2 }}
                name="Students"
              >
                <LabelList
                  dataKey="studentCount"
                  position="top"
                  offset={10}
                  style={{ fontSize: 10, fill: C.amber, fontWeight: 700 }}
                />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* New students joined list */}
        <NewStudentsList
          students={allStudents}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          onClearMonth={() => setPeriod('all')}
        />

        {/* Charts 3 & 4: Programme breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div style={s.chartCard}>
            <h3 style={s.chartTitle}>Revenue by Programme</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.revenueByProgramme} layout="vertical" margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                  domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2 / 1000) * 1000]}
                />
                <YAxis type="category" dataKey="programme" tick={{ fontSize: 11, fill: '#475569' }} width={120} />
                <Tooltip cursor={false} formatter={(v: number) => fmtCurrency(v)} />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={20}>
                  {data.revenueByProgramme.map((entry, i) => (
                    <Cell key={entry.programme} fill={PROG_COLORS[entry.programme] || AGE_COLORS[i % AGE_COLORS.length]} />
                  ))}
                  <LabelList
                    dataKey="revenue"
                    position="right"
                    formatter={(v: number) => fmtCurrencyNbsp(v)}
                    style={{ fontSize: 11, fill: '#475569', fontWeight: 700 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={s.chartCard}>
            <h3 style={s.chartTitle}>Students by Programme</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.revenueByProgramme} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2)]}
                />
                <YAxis type="category" dataKey="programme" tick={{ fontSize: 11, fill: '#475569' }} width={120} />
                <Tooltip cursor={false} />
                <Bar dataKey="studentCount" radius={[0, 4, 4, 0]} barSize={20} name="Students">
                  {data.revenueByProgramme.map((entry, i) => (
                    <Cell key={entry.programme} fill={PROG_COLORS[entry.programme] || AGE_COLORS[i % AGE_COLORS.length]} />
                  ))}
                  <LabelList
                    dataKey="studentCount"
                    position="right"
                    style={{ fontSize: 11, fill: '#475569', fontWeight: 700 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 5: Revenue by Age */}
        <div style={s.chartCard}>
          <h3 style={s.chartTitle}>Revenue by Age Group</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.revenueByAge} margin={{ top: 30, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="age" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2 / 1000) * 1000]}
              />
              <Tooltip cursor={false} formatter={(v: number, name: string) => [name === 'Students' ? `${v} students` : fmtCurrency(v), name]} />
              <Bar dataKey="revenue" fill={C.teal} radius={[4, 4, 0, 0]} barSize={36} name="Revenue">
                {data.revenueByAge.map((_, i) => (
                  <Cell key={i} fill={AGE_COLORS[i % AGE_COLORS.length]} />
                ))}
                <LabelList
                  dataKey="revenue"
                  position="top"
                  formatter={(v: number) => fmtCurrencyNbsp(v)}
                  style={{ fontSize: 11, fill: '#475569', fontWeight: 700 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Excel-style monthly breakdown */}
        <MonthlyBreakdownTable data={data} />

        {/* Year over Year — bottom of page */}
        <div style={s.chartCard}>
          <h3 style={s.chartTitle}>Year-over-Year Revenue</h3>
          <p style={{ margin: '-4px 0 12px', fontSize: 12, color: '#94a3b8' }}>Comparing {selectedYear} vs {data.prevYear}</p>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={data.monthlyRevenue} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip cursor={false} formatter={(v: number) => fmtCurrency(v)} itemSorter={() => -1} />
              <Bar dataKey="current" fill={C.blue} radius={[4, 4, 0, 0]} barSize={24} name={String(selectedYear)} />
              <Line type="monotone" dataKey="previous" stroke={C.slate} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: C.slate }} name={String(data.prevYear)} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── Excel-style monthly breakdown table ───────────────────────────────────────

const AGE_TO_CLASS: Record<string, string> = { '2': 'PG', '3': 'N1', '4': 'N2', '5': 'P1', '6': 'P2' };
const PROG_SHORT: Record<string, string> = {
  'Half Day': '4H',
  'Half Day + Enrichment': 'HD',
  'Full Day': 'FD',
};
const PROG_ORDER = ['Half Day', 'Half Day + Enrichment', 'Full Day'];
const AGE_BAND_COLORS = ['#dbeafe', '#fce7f3', '#dcfce7', '#fef3c7', '#ede9fe', '#cffafe'];

function MonthlyBreakdownTable({ data }: { data: import('../../api/students.js').RevenueAnalyticsData }) {
  // Discover the set of (age × programme) columns that have data anywhere this year
  const ageSet = new Set<string>();
  const progSet = new Set<string>();
  for (const m of data.monthlyRevenue) {
    for (const age of Object.keys(m.breakdown ?? {})) {
      ageSet.add(age);
      for (const p of Object.keys(m.breakdown[age])) progSet.add(p);
    }
  }
  const ages = [...ageSet].sort((a, b) => Number(a) - Number(b));
  const progs = PROG_ORDER.filter(p => progSet.has(p)).concat([...progSet].filter(p => !PROG_ORDER.includes(p)));

  // Annual totals: revenue sums (12 monthly payments), but headcounts are PEAK
  // (max across months) — summing student counts gives student-months, not unique students.
  const annualTotalRevenue = data.monthlyRevenue.reduce((sum, m) => sum + m.revenue, 0);
  const peakStudents = data.monthlyRevenue.reduce((max, m) => Math.max(max, m.studentCount), 0);
  const peakBreakdown: Record<string, Record<string, number>> = {};
  for (const m of data.monthlyRevenue) {
    for (const age of Object.keys(m.breakdown ?? {})) {
      if (!peakBreakdown[age]) peakBreakdown[age] = {};
      for (const p of Object.keys(m.breakdown[age])) {
        const v = m.breakdown[age][p].count;
        if (v > (peakBreakdown[age][p] ?? 0)) peakBreakdown[age][p] = v;
      }
    }
  }

  // Design tokens — match the Finance / other analysis pages
  const MUTED = '#64748b';
  const MUTED_SOFT = '#94a3b8';
  const TEXT = '#0f172a';
  const TEXT_SUB = '#475569';
  const DIVIDER = '#f1f5f9';
  const CARD_BORDER = '#e5e7eb';
  const HEADER_BG = '#fafbfc';
  const NOW_BG = '#eef2ff';
  const NOW_ACCENT = '#6366f1';
  const ANNUAL_BG = '#f8fafc';

  const thBase: React.CSSProperties = {
    padding: '12px 10px',
    fontSize: 11,
    fontWeight: 600,
    color: MUTED,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    background: HEADER_BG,
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
  };
  const tdBase: React.CSSProperties = {
    padding: '10px 10px',
    fontSize: 13,
    textAlign: 'center',
    borderBottom: `1px solid ${DIVIDER}`,
    fontVariantNumeric: 'tabular-nums',
    verticalAlign: 'middle',
  };

  return (
    <div style={s.chartCard}>
      <h3 style={{ ...s.chartTitle, marginBottom: 14 }}>Monthly Breakdown</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720 }}>
          <thead>
            <tr>
              <th
                rowSpan={2}
                style={{
                  ...thBase,
                  textAlign: 'left',
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  borderBottom: `1px solid ${CARD_BORDER}`,
                }}
              >
                Month
              </th>
              {ages.map((age, ai) => (
                <th
                  key={age}
                  colSpan={progs.length}
                  style={{
                    ...thBase,
                    fontSize: 12,
                    textTransform: 'none',
                    letterSpacing: '-0.005em',
                    color: TEXT_SUB,
                    borderBottom: `1px solid ${CARD_BORDER}`,
                    borderRight: ai < ages.length - 1 ? `1px solid ${DIVIDER}` : 'none',
                  }}
                >
                  {AGE_TO_CLASS[age] ?? `Age ${age}`}
                  <span style={{ marginLeft: 6, fontSize: 10, color: MUTED_SOFT, fontWeight: 500 }}>{age}y</span>
                </th>
              ))}
              <th
                rowSpan={2}
                style={{
                  ...thBase,
                  borderBottom: `1px solid ${CARD_BORDER}`,
                  borderLeft: `1px solid ${CARD_BORDER}`,
                }}
              >
                Students
              </th>
              <th
                rowSpan={2}
                style={{
                  ...thBase,
                  textAlign: 'right',
                  borderBottom: `1px solid ${CARD_BORDER}`,
                }}
              >
                Revenue
              </th>
            </tr>
            <tr>
              {ages.flatMap((age, ai) =>
                progs.map((prog, pi) => (
                  <th
                    key={`${age}-${prog}`}
                    style={{
                      ...thBase,
                      fontSize: 10,
                      padding: '8px 6px',
                      color: MUTED_SOFT,
                      borderBottom: `1px solid ${CARD_BORDER}`,
                      borderRight: pi === progs.length - 1 && ai < ages.length - 1 ? `1px solid ${DIVIDER}` : 'none',
                    }}
                  >
                    {PROG_SHORT[prog] ?? prog}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {data.monthlyRevenue.map((m, i) => {
              const isCurrent = i === data.currentMonthIdx;
              const isForecast = m.isForecast;
              const rowBg = isCurrent ? NOW_BG : '#fff';
              const textColor = isForecast ? MUTED_SOFT : TEXT;
              return (
                <tr key={m.month} className="mb-row" style={{ background: rowBg }}>
                  <td
                    style={{
                      ...tdBase,
                      padding: '10px 12px',
                      textAlign: 'left',
                      background: rowBg,
                      position: 'sticky',
                      left: 0,
                      zIndex: 1,
                      color: isForecast ? MUTED_SOFT : TEXT,
                      fontWeight: 600,
                      boxShadow: isCurrent ? `inset 3px 0 0 ${NOW_ACCENT}` : 'none',
                    }}
                  >
                    <span>{m.month}</span>
                    {isCurrent && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#4338ca',
                          background: '#c7d2fe',
                          padding: '1px 7px',
                          borderRadius: 999,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Now
                      </span>
                    )}
                    {isForecast && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 10,
                          fontWeight: 600,
                          color: MUTED_SOFT,
                          border: `1px solid ${CARD_BORDER}`,
                          padding: '1px 7px',
                          borderRadius: 999,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Forecast
                      </span>
                    )}
                  </td>
                  {ages.flatMap((age, ai) =>
                    progs.map((prog, pi) => {
                      const v = m.breakdown?.[age]?.[prog]?.count ?? 0;
                      return (
                        <td
                          key={`${m.month}-${age}-${prog}`}
                          style={{
                            ...tdBase,
                            fontWeight: v ? (isCurrent ? 700 : 500) : 400,
                            color: v === 0 ? (isForecast ? '#e2e8f0' : '#cbd5e1') : textColor,
                            borderRight: pi === progs.length - 1 && ai < ages.length - 1 ? `1px solid ${DIVIDER}` : 'none',
                          }}
                        >
                          {v || '—'}
                        </td>
                      );
                    })
                  )}
                  <td
                    style={{
                      ...tdBase,
                      fontWeight: isCurrent ? 700 : 600,
                      color: isForecast ? MUTED_SOFT : TEXT,
                      borderLeft: `1px solid ${DIVIDER}`,
                    }}
                  >
                    {m.studentCount}
                  </td>
                  <td
                    style={{
                      ...tdBase,
                      textAlign: 'right',
                      padding: '10px 12px',
                      fontWeight: isCurrent ? 800 : 700,
                      color: isForecast ? MUTED_SOFT : '#059669',
                    }}
                  >
                    {fmtCurrency(m.revenue)}
                  </td>
                </tr>
              );
            })}
            {/* Annual summary row — light, in-palette, matches Finance's total row */}
            <tr style={{ background: ANNUAL_BG }}>
              <td
                style={{
                  ...tdBase,
                  padding: '12px',
                  textAlign: 'left',
                  background: ANNUAL_BG,
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                  borderTop: `2px solid ${TEXT_SUB}`,
                  borderBottom: 'none',
                  color: MUTED,
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                Annual
                <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 500, color: MUTED_SOFT, textTransform: 'none', letterSpacing: 0 }}>
                  peak · total
                </span>
              </td>
              {ages.flatMap((age, ai) =>
                progs.map((prog, pi) => {
                  const v = peakBreakdown[age]?.[prog] ?? 0;
                  return (
                    <td
                      key={`total-${age}-${prog}`}
                      style={{
                        ...tdBase,
                        borderTop: `2px solid ${TEXT_SUB}`,
                        borderBottom: 'none',
                        fontWeight: 700,
                        color: v === 0 ? '#cbd5e1' : TEXT_SUB,
                        borderRight: pi === progs.length - 1 && ai < ages.length - 1 ? `1px solid ${DIVIDER}` : 'none',
                      }}
                    >
                      {v || '—'}
                    </td>
                  );
                })
              )}
              <td
                style={{
                  ...tdBase,
                  borderTop: `2px solid ${TEXT_SUB}`,
                  borderLeft: `1px solid ${DIVIDER}`,
                  borderBottom: 'none',
                  fontWeight: 800,
                  color: TEXT,
                }}
              >
                {peakStudents}
              </td>
              <td
                style={{
                  ...tdBase,
                  textAlign: 'right',
                  padding: '12px',
                  borderTop: `2px solid ${TEXT_SUB}`,
                  borderBottom: 'none',
                  fontWeight: 800,
                  fontSize: 14,
                  color: '#059669',
                }}
              >
                {fmtCurrency(annualTotalRevenue)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        style={{
          marginTop: 12,
          fontSize: 11,
          color: MUTED_SOFT,
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <span><strong style={{ color: TEXT_SUB }}>4H</strong> Half Day</span>
        <span><strong style={{ color: TEXT_SUB }}>HD</strong> Half Day + Enrichment</span>
        <span><strong style={{ color: TEXT_SUB }}>FD</strong> Full Day</span>
        <span style={{ marginLeft: 'auto' }}>
          Annual row: per-class cells & students show <strong>peak</strong> across the year; revenue is the <strong>sum</strong> of all 12 months
        </span>
      </div>
      <style>{`.mb-row { transition: background 120ms ease; } .mb-row:hover td { background: ${NOW_BG} !important; }`}</style>
    </div>
  );
}

// ── New students joined list ──────────────────────────────────────────────────

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function NewStudentsList({
  students,
  selectedYear,
  selectedMonth,
  onClearMonth,
}: {
  students: Student[];
  selectedYear: number;
  selectedMonth: number | null;
  onClearMonth: () => void;
}) {
  // "New" = students whose startDate (first day of school) is in the selected year/month
  const filtered = students.filter(st => {
    if (!st.startDate) return false;
    const d = new Date(st.startDate);
    if (d.getFullYear() !== selectedYear) return false;
    if (selectedMonth !== null && d.getMonth() !== selectedMonth) return false;
    return true;
  }).sort((a, b) => {
    const ad = a.startDate ? new Date(a.startDate).getTime() : 0;
    const bd = b.startDate ? new Date(b.startDate).getTime() : 0;
    return ad - bd;
  });

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });

  const title = selectedMonth !== null
    ? `New Students — ${MONTH_NAMES[selectedMonth]} ${selectedYear}`
    : `New Students — ${selectedYear}`;

  return (
    <div style={s.chartCard}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ ...s.chartTitle, marginBottom: 0 }}>{title} <span style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>· {filtered.length}</span></h3>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>
          {selectedMonth !== null ? (
            <button
              onClick={onClearMonth}
              style={{
                padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0',
                background: '#fff', color: '#475569', cursor: 'pointer', fontSize: 11, fontWeight: 600,
              }}
            >
              ← Show whole year
            </button>
          ) : (
            <span>Click a bar above to filter by month</span>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p style={{ margin: 0, padding: '20px 0', textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>
          No new students {selectedMonth !== null ? `in ${MONTH_NAMES[selectedMonth]} ${selectedYear}` : `in ${selectedYear}`}
        </p>
      ) : (() => {
        // Group by month when showing the whole year; flat list when a month is selected
        const groupByMonth = selectedMonth === null;
        const groups = new Map<number, Student[]>();
        if (groupByMonth) {
          for (const st of filtered) {
            const m = new Date(st.startDate!).getMonth();
            if (!groups.has(m)) groups.set(m, []);
            groups.get(m)!.push(st);
          }
        } else {
          groups.set(selectedMonth!, filtered);
        }
        const sortedKeys = [...groups.keys()].sort((a, b) => a - b);

        return (
          <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={nsTh}>First Day</th>
                  <th style={nsTh}>Name</th>
                  <th style={nsTh}>Programme</th>
                  <th style={{ ...nsTh, textAlign: 'right' }}>Monthly Fee</th>
                </tr>
              </thead>
              <tbody>
                {sortedKeys.map(monthIdx => {
                  const rows = groups.get(monthIdx)!;
                  return (
                    <React.Fragment key={monthIdx}>
                      {groupByMonth && (
                        <tr style={{ background: '#eff6ff' }}>
                          <td colSpan={4} style={{
                            padding: '7px 12px', fontSize: 11, fontWeight: 700,
                            color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.06em',
                            borderBottom: '1px solid #dbeafe',
                          }}>
                            {MONTH_NAMES[monthIdx]} {selectedYear}
                            <span style={{ marginLeft: 8, color: '#64748b', fontWeight: 500 }}>· {rows.length}</span>
                          </td>
                        </tr>
                      )}
                      {rows.map(st => {
                        const withdrawn = st.status === 'withdrawn';
                        return (
                          <tr key={st.id} className="ns-row" style={{ opacity: withdrawn ? 0.6 : 1 }}>
                            <td style={{ ...nsTd, color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
                              {st.startDate ? fmtDate(st.startDate) : '—'}
                            </td>
                            <td style={{ ...nsTd, fontWeight: 600, color: '#0f172a' }}>
                              {st.lead.childName}
                              {withdrawn && (
                                <span style={{
                                  marginLeft: 8, padding: '1px 6px', borderRadius: 4,
                                  background: '#fee2e2', color: '#991b1b', fontSize: 10, fontWeight: 700,
                                  textTransform: 'uppercase', letterSpacing: '0.04em',
                                }}>
                                  Withdrawn{st.withdrawnAt ? ` · ${fmtDate(st.withdrawnAt)}` : ''}
                                </span>
                              )}
                            </td>
                            <td style={nsTd}>{st.package.programme} <span style={{ color: '#94a3b8' }}>· {st.package.age}y</span></td>
                            <td style={{ ...nsTd, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#5b21b6', fontWeight: 600 }}>
                              {st.monthlyFee != null ? fmtCurrency(st.monthlyFee) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}
      <style>{`.ns-row:hover td { background: #f8fafc; }`}</style>
    </div>
  );
}

const nsTh: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em',
  borderBottom: '1px solid #e2e8f0',
};
const nsTd: React.CSSProperties = {
  padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 12,
};

function KpiCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 14,
      padding: '12px 20px',
      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
      minHeight: 84,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: '-0.01em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' as any }}>{value}</div>
      {sub && <div style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f8fafc', minHeight: '100vh', color: '#0f172a' },
  inner: { maxWidth: 1200, margin: '0 auto' },
  heading: { margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' },
  chartCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 14,
    padding: '20px 24px',
    marginBottom: 24,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
  },
  chartTitle: { margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' },
};
