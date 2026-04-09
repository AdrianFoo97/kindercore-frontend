import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Cell,
} from 'recharts';
import { fetchRevenueAnalytics } from '../../api/students.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';

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

function fmtCurrency(n: number) {
  return 'RM ' + n.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function RevenueAnalysisPage() {
  const { isMobile } = useIsMobile();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['revenue-analytics', selectedYear],
    queryFn: () => fetchRevenueAnalytics(selectedYear),
  });

  if (isLoading) return <div style={s.page}><p style={{ padding: 40, color: '#94a3b8' }}>Loading...</p></div>;
  if (isError || !data) return <div style={s.page}><p style={{ padding: 40, color: '#dc2626' }}>Failed to load revenue data.</p></div>;

  const years = data.availableYears.length > 0 ? data.availableYears : [currentYear];

  return (
    <div style={s.page}>
      <style>{`.recharts-wrapper, .recharts-surface, .recharts-wrapper:focus, .recharts-surface:focus, .recharts-wrapper *:focus, .recharts-surface *:focus { outline: none !important; }`}</style>
      <div style={s.inner}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <h1 style={s.heading}>Revenue Analysis</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>Monthly revenue, programme breakdown, and year-over-year trends</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>Year</span>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
              style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: '#fff' }}>
              {years.map(y => <option key={y} value={y}>{y === currentYear ? 'Current Year' : y}</option>)}
            </select>
          </div>
        </div>

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          <KpiCard label="Active Students" value={String(data.totalActiveStudents)} color={C.blue} />
          <KpiCard label="Monthly Revenue" value={fmtCurrency(data.totalMonthlyRevenue)} color={C.green} />
          <KpiCard label="Actual YTD" value={fmtCurrency(data.actualRevenue)} color={C.indigo} />
          <KpiCard label="Annual (incl. forecast)" value={fmtCurrency(data.annualRevenue)} color={C.purple} sub={data.forecastRevenue > 0 ? `Forecast: ${fmtCurrency(data.forecastRevenue)}` : undefined} />
        </div>

        {/* Chart 1: Monthly Revenue */}
        <div style={s.chartCard}>
          <h3 style={s.chartTitle}>Monthly Revenue — {selectedYear}</h3>
          <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 11, color: '#94a3b8' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: C.blue, marginRight: 4 }} />Actual</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#bfdbfe', marginRight: 4 }} />Forecast</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 4, background: C.amber, marginRight: 4, verticalAlign: 'middle' }} />Students</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data.monthlyRevenue} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip cursor={false} formatter={(v: number, name: string) => [name === 'Students' ? `${v} students` : fmtCurrency(v), name]} />
              <Bar yAxisId="left" dataKey="revenue" radius={[4, 4, 0, 0]} barSize={28} name="Revenue">
                {data.monthlyRevenue.map((entry, i) => (
                  <Cell key={i} fill={entry.isForecast ? '#bfdbfe' : C.blue} />
                ))}
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="studentCount" stroke={C.amber} strokeWidth={2} dot={{ r: 3 }} name="Students" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Year over Year */}
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

        {/* Charts 3 & 4: Programme breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div style={s.chartCard}>
            <h3 style={s.chartTitle}>Revenue by Programme</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.revenueByProgramme} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="programme" tick={{ fontSize: 11, fill: '#475569' }} width={120} />
                <Tooltip cursor={false} formatter={(v: number) => fmtCurrency(v)} />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={20}>
                  {data.revenueByProgramme.map((entry, i) => (
                    <Cell key={entry.programme} fill={PROG_COLORS[entry.programme] || AGE_COLORS[i % AGE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={s.chartCard}>
            <h3 style={s.chartTitle}>Students by Programme</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.revenueByProgramme} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis type="category" dataKey="programme" tick={{ fontSize: 11, fill: '#475569' }} width={120} />
                <Tooltip cursor={false} />
                <Bar dataKey="studentCount" radius={[0, 4, 4, 0]} barSize={20} name="Students">
                  {data.revenueByProgramme.map((entry, i) => (
                    <Cell key={entry.programme} fill={PROG_COLORS[entry.programme] || AGE_COLORS[i % AGE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 5: Revenue by Age */}
        <div style={s.chartCard}>
          <h3 style={s.chartTitle}>Revenue by Age Group</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.revenueByAge} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="age" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip cursor={false} formatter={(v: number, name: string) => [name === 'Students' ? `${v} students` : fmtCurrency(v), name]} />
              <Bar dataKey="revenue" fill={C.teal} radius={[4, 4, 0, 0]} barSize={36} name="Revenue">
                {data.revenueByAge.map((_, i) => (
                  <Cell key={i} fill={AGE_COLORS[i % AGE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 20px', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '32px 24px', fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' },
  inner: { maxWidth: 1100, margin: '0 auto' },
  heading: { margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' },
  chartCard: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
    padding: '20px 20px 12px', marginBottom: 14,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  chartTitle: { margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#1e293b' },
};
