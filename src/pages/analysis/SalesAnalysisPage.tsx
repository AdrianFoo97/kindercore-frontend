import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { fetchSalesAnalytics, fetchLeadById } from '../../api/leads.js';
import { Lead } from '../../types/index.js';
import { getChannelColor, getAddressColor } from '../../utils/chartColors.js';
import EditLeadModal from '../../components/leads/EditLeadModal.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';

// ── Palette ───────────────────────────────────────────────────────
const C = {
  bg: '#f8fafc', card: '#ffffff', border: '#e2e8f0',
  text: '#0f172a', muted: '#64748b', faint: '#f8fafc',
  indigo: '#4f46e5', green: '#059669', red: '#dc2626',
  blue: '#5a79c8', slate: '#94a3b8',
};

const DONUT_PALETTE = ['#1e40af','#1d4ed8','#5a79c8','#3b82f6','#60a5fa','#93c5fd','#bfdbfe'];

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  ENROLLED: { label: 'Enrolled', bg: '#dcfce7', color: '#166534' },
  LOST:     { label: 'Lost',     bg: '#fee2e2', color: '#991b1b' },
};

const PAGE_SIZE = 10;
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

type FilterState = { type: 'address' | 'channel'; value: string } | null;

// ── Page ──────────────────────────────────────────────────────────
export default function SalesAnalysisPage() {
  const { isMobile } = useIsMobile();
  const queryClient = useQueryClient();
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterState>(null);
  const [statusTab, setStatusTab] = useState<'ALL' | 'ENROLLED' | 'LOST'>('ALL');
  const [chartMode, setChartMode] = useState<'talks' | 'closed'>('talks');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['sales-analytics', selectedYear],
    queryFn: () => fetchSalesAnalytics(selectedYear),
    // Reset filter/page on year change
    select: d => d,
  });

  if (isLoading) return <div style={s.centered}>Loading…</div>;
  if (isError || !data) return <div style={s.centered}>Failed to load sales analytics.</div>;

  const closingPct = Math.round(data.closingRate * 100);

  // ── Month-scoped leads (drives donuts + table) ──
  const monthLeads = selectedMonth !== null
    ? data.leadsTable.filter(r => new Date(r.submittedAt).getMonth() === selectedMonth)
    : data.leadsTable;

  // ── Address / channel breakdowns re-derived from month scope ──
  const deriveBreakdown = (leads: typeof data.leadsTable, key: 'addressLocation' | 'howDidYouKnow') => {
    const map = new Map<string, number>();
    for (const l of leads) { const v = l[key]; if (v) map.set(v, (map.get(v) ?? 0) + 1); }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };

  // ── Filtered + paginated leads ──
  const statusLeads = statusTab === 'ALL' ? monthLeads : monthLeads.filter(r => r.status === statusTab);
  const filteredLeads = activeFilter
    ? statusLeads.filter(r =>
        activeFilter.type === 'address'
          ? r.addressLocation === activeFilter.value
          : r.howDidYouKnow === activeFilter.value
      )
    : statusLeads;

  const sortedLeads = [...filteredLeads].sort((a, b) => {
    if (a.enrolmentYear !== b.enrolmentYear) return a.enrolmentYear - b.enrolmentYear;
    // Within same year: enrolled first, then lost
    const statusOrder = (s: string) => s === 'ENROLLED' ? 0 : 1;
    return statusOrder(a.status) - statusOrder(b.status);
  });
  const pageCount = Math.max(1, Math.ceil(sortedLeads.length / PAGE_SIZE));
  const safePage  = Math.min(page, pageCount);
  const pagedLeads = sortedLeads.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSegmentClick = (type: 'address' | 'channel', value: string) => {
    setActiveFilter(prev => (prev?.type === type && prev?.value === value) ? null : { type, value });
    setPage(1);
  };

  const handleYearChange = (year: number | undefined) => {
    setSelectedYear(year);
    setSelectedMonth(null);
    setActiveFilter(null);
    setStatusTab('ALL');
    setPage(1);
  };

  const handleTabChange = (tab: 'ALL' | 'ENROLLED' | 'LOST') => {
    setStatusTab(tab);
    setPage(1);
  };

  const handleMonthClick = (payload: any) => {
    if (!payload?.activeLabel) return;
    const idx = MONTH_LABELS.indexOf(payload.activeLabel);
    if (idx === -1) return;
    const monthData = data.monthlyComparison[idx];
    if (chartMode === 'closed') {
      if (!monthData || monthData.enrolled === 0) return;
    } else {
      if (!monthData || (monthData.enrolled === 0 && monthData.lost === 0)) return;
    }
    setSelectedMonth(prev => prev === idx ? null : idx);
    setActiveFilter(null);
    if (chartMode === 'closed') setStatusTab('ENROLLED');
    else setStatusTab('ALL');
    setPage(1);
  };

  const chartFilteredLeads = chartMode === 'closed'
    ? monthLeads.filter((r: any) => r.status === 'ENROLLED')
    : monthLeads;
  const addressData = selectedMonth !== null || chartMode === 'closed'
    ? deriveBreakdown(chartFilteredLeads, 'addressLocation')
    : data.addressBreakdown.map(d => ({ name: d.location, value: d.count }));
  const channelData = selectedMonth !== null || chartMode === 'closed'
    ? deriveBreakdown(chartFilteredLeads, 'howDidYouKnow')
    : data.marketingChannelBreakdown.map(d => ({ name: d.channel, value: d.count }));

  return (
    <div style={{ ...s.page, ...(isMobile ? { padding: '20px 12px' } : {}) }}>
      <style>{`.recharts-wrapper, .recharts-wrapper svg, .recharts-wrapper *:focus { outline: none !important; } .sa-row:hover { background: #eef2fa !important; }`}</style>

      {/* ── Header ── */}
      <div style={{ ...s.header, ...(isMobile ? { flexDirection: 'column' } : {}) }}>
        <div>
          <h1 style={s.title}>Sales Analysis</h1>
          <p style={s.subtitle}>Closing rate — enrolled leads vs lost sales (excludes no-shows)</p>
        </div>
        <div style={s.filterWrap}>
          <span style={s.filterLabel}>Year</span>
          <select style={s.select} value={selectedYear ?? ''}
            onChange={e => handleYearChange(e.target.value ? Number(e.target.value) : undefined)}>
            <option value="">Current Year</option>
            {data.availableYears
              .filter(y => y < new Date().getFullYear())
              .map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div style={{ ...s.kpiStrip, ...(isMobile ? { gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 } : {}) }}>
        {/* Closing rate hero */}
        <div style={{ ...s.card, borderTop: `3px solid ${C.indigo}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '18px 20px', marginBottom: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Closing Rate</span>
          <RateRing rate={data.closingRate} color={C.indigo} />
          <span style={{ fontSize: 12, color: C.muted, textAlign: 'center' }}>{data.enrolledLeads} closed of {data.totalLeads} sales talks</span>
        </div>
        <StatCard label="Total Sales Talks" value={data.totalLeads}    color={C.blue}  sub="enrolled + lost sales" />
        <StatCard label="Closed Sales"      value={data.enrolledLeads} color={C.green} sub={`${closingPct}% closing rate`} />
        <StatCard label="Lost Sales"        value={data.lostLeads}     color={C.red}   sub="attended but didn't enrol" />
      </div>

      {/* ── YoY monthly comparison ── */}
      <div style={s.card}>
        {/* Toggle centered */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2 }}>
            <button onClick={() => { setChartMode('talks'); setStatusTab('ALL'); setSelectedMonth(null); setActiveFilter(null); setPage(1); }}
              style={{ padding: '6px 16px', fontSize: 12, fontWeight: chartMode === 'talks' ? 700 : 500, border: 'none', borderRadius: 6, cursor: 'pointer', background: chartMode === 'talks' ? '#fff' : 'transparent', color: chartMode === 'talks' ? C.text : C.muted, boxShadow: chartMode === 'talks' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontFamily: 'inherit' }}>
              Sales Talks
            </button>
            <button onClick={() => { setChartMode('closed'); setStatusTab('ENROLLED'); setSelectedMonth(null); setActiveFilter(null); setPage(1); }}
              style={{ padding: '6px 16px', fontSize: 12, fontWeight: chartMode === 'closed' ? 700 : 500, border: 'none', borderRadius: 6, cursor: 'pointer', background: chartMode === 'closed' ? '#fff' : 'transparent', color: chartMode === 'closed' ? C.green : C.muted, boxShadow: chartMode === 'closed' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontFamily: 'inherit' }}>
              Closed Sales
            </button>
          </div>
        </div>
        <div style={s.cardHeaderRow}>
          <div>
            <h2 style={s.cardTitle}>{chartMode === 'talks' ? 'Sales Talks' : 'Closed Sales'} by Month — Year over Year</h2>
            <p style={s.cardSub}>
              {selectedMonth !== null
                ? <><strong>{MONTH_LABELS[selectedMonth]}</strong> selected · click again to clear</>
                : <>{chartMode === 'talks' ? 'Enrolled + lost' : 'Enrolled students'} — {data.selectedYear} vs {data.prevYear} · click a bar to filter</>
              }
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' as const }}>
            {selectedMonth !== null && (
              <button onClick={() => { setSelectedMonth(null); setActiveFilter(null); setPage(1); }} style={s.clearBtn}>
                <FontAwesomeIcon icon={faXmark} /> {MONTH_LABELS[selectedMonth]}
              </button>
            )}
            <div style={s.legendRow}>
              {chartMode === 'talks' && <span style={s.legendItem}><span style={{ ...s.dot, background: C.red }} /><span style={{ fontSize: 11, color: C.muted }}>Lost</span></span>}
              <span style={s.legendItem}><span style={{ ...s.dot, background: C.green }} /><span style={{ fontSize: 11, color: C.muted }}>Enrolled</span></span>
              <span style={s.legendItem}>
                <svg width={20} height={10} style={{ flexShrink: 0 }}>
                  <line x1={0} y1={5} x2={20} y2={5} stroke={C.slate} strokeWidth={2} strokeDasharray="4 3" />
                  <circle cx={10} cy={5} r={2.5} fill={C.slate} />
                </svg>
                <span style={{ fontSize: 11, color: C.muted }}>{data.prevYear}</span>
              </span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={data.monthlyComparison.map((d: any) => ({ ...d, previous: chartMode === 'closed' ? d.previousClosed : d.previousTalks }))} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} style={{ outline: 'none', cursor: 'pointer' }} onClick={handleMonthClick}>
            <CartesianGrid vertical={false} stroke={C.border} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: C.muted }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} width={26}
              domain={[0, Math.max(...data.monthlyComparison.map((d: any) => Math.max(d.enrolled + d.lost, d.previousTalks ?? 0))) + 1]} />
            <Tooltip
              cursor={{ fill: 'transparent' }}
              content={({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                if (!d) return null;
                const enrolled = d.enrolled ?? 0;
                const lost = d.lost ?? 0;
                const prevE = d.prevEnrolled ?? 0;
                const prevL = d.prevLost ?? 0;
                return (
                  <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6, color: C.text }}>{label}</div>
                    {chartMode === 'talks'
                      ? <div style={{ color: C.text }}>{data.selectedYear}: <strong>{enrolled + lost}</strong> ({enrolled} enrolled, {lost} lost)</div>
                      : <div style={{ color: C.green }}>{data.selectedYear}: <strong>{enrolled}</strong> enrolled</div>
                    }
                    {chartMode === 'talks'
                      ? <div style={{ color: C.muted }}>{data.prevYear}: {prevE + prevL} ({prevE} enrolled, {prevL} lost)</div>
                      : <div style={{ color: C.muted }}>{data.prevYear}: {prevE} enrolled</div>
                    }
                  </div>
                );
              }}
            />
            <Bar dataKey="enrolled" stackId="a" maxBarSize={36} name="enrolled" activeBar={false}
              shape={(props: any) => {
                const { x, y, width, height, index } = props;
                if (!height) return null;
                const hasLost = chartMode === 'talks' && data.monthlyComparison[index]?.lost > 0;
                const r = 4;
                const topR = hasLost ? 0 : r;
                // bottom bar: flat bottom, rounded top only if no lost above
                return <path d={`M${x + topR},${y} Q${x},${y} ${x},${y + topR} L${x},${y + height} L${x + width},${y + height} L${x + width},${y + topR} Q${x + width},${y} ${x + width - topR},${y} Z`} fill={props.fill} opacity={props.opacity} />;
              }}
              onClick={() => handleTabChange('ENROLLED')}
              label={({ x, y, width, height, index }: any) => {
                const v = data.monthlyComparison[index]?.enrolled ?? 0;
                if (!v) return null;
                if (height < 18) return <text key={`e-${x}`} x={x + width / 2} y={y - 4} textAnchor="middle" fill={C.green} fontSize={10} fontWeight={700}>{v}</text>;
                return <text key={`e-${x}`} x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={11} fontWeight={700}>{v}</text>;
              }}>
              {data.monthlyComparison.map((_, i) => (
                <Cell key={i} fill={C.green} opacity={selectedMonth === null || selectedMonth === i ? 1 : 0.35} />
              ))}
            </Bar>
            {chartMode === 'talks' && (
            <Bar dataKey="lost" stackId="a" maxBarSize={36} name="lost" activeBar={false}
              shape={(props: any) => {
                const { x, y, width, height } = props;
                if (!height) return null;
                const r = 4;
                return <path d={`M${x + r},${y} Q${x},${y} ${x},${y + r} L${x},${y + height} L${x + width},${y + height} L${x + width},${y + r} Q${x + width},${y} ${x + width - r},${y} Z`} fill={props.fill} opacity={props.opacity} />;
              }}
              onClick={() => handleTabChange('LOST')}
              label={({ x, y, width, height, index }: any) => {
                const v = data.monthlyComparison[index]?.lost ?? 0;
                if (!v) return null;
                if (height < 18) return <text key={`l-${x}`} x={x + width / 2} y={y - 4} textAnchor="middle" fill={C.red} fontSize={10} fontWeight={700}>{v}</text>;
                return <text key={`l-${x}`} x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={11} fontWeight={700}>{v}</text>;
              }}>
              {data.monthlyComparison.map((_: any, i: number) => (
                <Cell key={i} fill={C.red} opacity={selectedMonth === null || selectedMonth === i ? 1 : 0.35} />
              ))}
            </Bar>
            )}
            <Line dataKey="previous" stroke={C.slate} strokeWidth={2} strokeDasharray="5 4"
              dot={{ r: 3, fill: C.slate }} activeDot={{ r: 5 }} name="previous" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Donuts row ── */}
      <div style={{ ...s.donutRow, ...(isMobile ? { gridTemplateColumns: '1fr', gap: 12 } : {}) }}>
        <DonutCard
          title="Leads by Address" sub="Click a segment to filter the table"
          data={addressData} filterType="address"
          activeValue={activeFilter?.type === 'address' ? activeFilter.value : undefined}
          onSegmentClick={handleSegmentClick}
          colorFn={getAddressColor}
        />
        <DonutCard
          title="Marketing Channel" sub="Click a segment to filter the table"
          data={channelData} filterType="channel"
          activeValue={activeFilter?.type === 'channel' ? activeFilter.value : undefined}
          onSegmentClick={handleSegmentClick}
          colorFn={getChannelColor}
        />
      </div>

      {/* ── Leads table ── */}
      <div style={s.card}>
        <div style={{ ...s.cardHeaderRow, marginBottom: 14 }}>
          <div>
            <h2 style={s.cardTitle}>Leads Detail</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: C.muted }}>
              {activeFilter
                ? <>Filtered by <strong>{activeFilter.value}</strong> · {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}</>
                : <>{statusTab === 'ALL' ? 'All leads' : statusTab === 'ENROLLED' ? 'Closed sales' : 'Lost sales'} · {selectedMonth !== null ? MONTH_LABELS[selectedMonth] + ' ' : ''}{data.selectedYear} — {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}</>
              }
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
              <button
                onClick={() => handleTabChange('ALL')}
                style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: statusTab === 'ALL' ? C.indigo : C.card, color: statusTab === 'ALL' ? '#fff' : C.muted }}
              >
                All
              </button>
              <button
                onClick={() => handleTabChange('ENROLLED')}
                style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', borderLeft: `1px solid ${C.border}`, background: statusTab === 'ENROLLED' ? C.green : C.card, color: statusTab === 'ENROLLED' ? '#fff' : C.muted }}
              >
                Enrolled
              </button>
              <button
                onClick={() => handleTabChange('LOST')}
                style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', borderLeft: `1px solid ${C.border}`, background: statusTab === 'LOST' ? C.red : C.card, color: statusTab === 'LOST' ? '#fff' : C.muted }}
              >
                Lost
              </button>
            </div>
            {activeFilter && (
              <button onClick={() => { setActiveFilter(null); setPage(1); }} style={s.clearBtn}>
                <FontAwesomeIcon icon={faXmark} /> Clear filter
              </button>
            )}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={s.table}>
            <thead>
              <tr>
                {['Name', 'Status', 'Age', 'Address', 'Marketing Channel', 'Remarks'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ ...s.td, textAlign: 'center', color: '#cbd5e1', padding: '32px 0' }}>
                    No leads match this filter.
                  </td>
                </tr>
              ) : (() => {
                const rows: React.ReactNode[] = [];
                let lastYear: number | null = null;
                pagedLeads.forEach((row, i) => {
                  if (row.enrolmentYear !== lastYear) {
                    lastYear = row.enrolmentYear;
                    rows.push(
                      <tr key={`grp-${row.enrolmentYear}`}>
                        <td colSpan={6} style={{ padding: '12px 14px 10px', background: '#e0e7ff', borderTop: `2px solid #c7d2fe`, borderBottom: `1px solid #c7d2fe`, fontSize: 12, fontWeight: 800, color: '#3730a3', letterSpacing: '0.04em' }}>
                          Enrolment Year {row.enrolmentYear}
                        </td>
                      </tr>
                    );
                  }
                  const sm = STATUS_META[row.status] ?? { label: row.status, bg: '#f1f5f9', color: C.muted };
                  rows.push(
                    <tr key={row.id} className="sa-row" style={{ background: i % 2 === 0 ? C.card : C.faint, cursor: 'pointer', transition: 'background 0.1s' }} onClick={async () => { try { const lead = await fetchLeadById(row.id); setEditingLead(lead); } catch { /* ignore */ } }}>
                      <td style={s.td}><span style={s.name}>{row.childName}</span></td>
                      <td style={s.td}>
                        <span style={{ ...s.badge, background: sm.bg, color: sm.color }}>{sm.label}</span>
                      </td>
                      <td style={{ ...s.td, textAlign: 'center' }}>{row.age}</td>
                      <td style={s.td}>{row.addressLocation ?? <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                      <td style={s.td}>{row.howDidYouKnow ? <span style={{ color: getChannelColor(row.howDidYouKnow, 0), fontWeight: 600 }}>{row.howDidYouKnow}</span> : <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                      <td style={{ ...s.td, color: C.muted, maxWidth: 220 }}>
                        {row.notes ?? <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                    </tr>
                  );
                });
                return rows;
              })()}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pageCount > 1 && (
          <div style={s.pagination}>
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
            <span style={{ fontSize: 11, color: C.muted }}>{filteredLeads.length} leads</span>
          </div>
        )}
      </div>

      {editingLead && (
        <EditLeadModal
          lead={editingLead}
          lostReasons={[]}
          onClose={() => setEditingLead(null)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['sales-analytics'] }); setEditingLead(null); }}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────
function RateRing({ rate, color }: { rate: number; color: string }) {
  const p = Math.round(rate * 100);
  return (
    <div style={{ position: 'relative', width: 110, height: 110 }}>
      <PieChart width={110} height={110} style={{ outline: 'none' }}>
        <Pie data={[{ v: p }, { v: 100 - p }]} dataKey="v"
          innerRadius={40} outerRadius={52} startAngle={90} endAngle={-270} paddingAngle={0} style={{ outline: 'none' }}>
          <Cell fill={color} />
          <Cell fill="#e2e8f0" />
        </Pie>
      </PieChart>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{p}%</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <div style={{ ...s.card, borderTop: `3px solid ${color}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '18px 16px', marginBottom: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>{label}</span>
      <span style={{ fontSize: 44, fontWeight: 900, color, lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: C.muted }}>{sub}</span>}
    </div>
  );
}

const TOP_N = 5;

function DonutCard({
  title, sub, data, filterType, activeValue, onSegmentClick, colorFn,
}: {
  title: string; sub: string; data: { name: string; value: number }[];
  filterType: 'address' | 'channel';
  activeValue?: string;
  onSegmentClick: (type: 'address' | 'channel', value: string) => void;
  colorFn?: (name: string, index: number) => string;
}) {
  const getColor = colorFn ?? ((_name: string, i: number) => DONUT_PALETTE[i % DONUT_PALETTE.length]);
  const [showOthers, setShowOthers] = useState(false);
  const total = data.reduce((a, b) => a + b.value, 0);
  const hasOthers = data.length > TOP_N;
  const othersItems = hasOthers ? data.slice(TOP_N) : [];
  const othersValue = othersItems.reduce((s, d) => s + d.value, 0);

  const pieData = hasOthers
    ? [...data.slice(0, TOP_N), { name: 'Others', value: othersValue }]
    : data;
  const othersIndex = hasOthers ? pieData.length - 1 : -1;

  const legendData = showOthers ? othersItems : pieData;

  const handlePieClick = (entry: any, index: number) => {
    if (hasOthers && index === othersIndex) { setShowOthers(prev => !prev); return; }
    onSegmentClick(filterType, entry.name);
  };

  return (
    <div style={s.card}>
      <h2 style={s.cardTitle}>{title}</h2>
      <p style={{ ...s.cardSub, marginBottom: 16 }}>{sub}</p>
      {pieData.length === 0 ? <p style={s.empty}>No data yet.</p> : (
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ flexShrink: 0 }}>
            <PieChart width={180} height={180} style={{ outline: 'none' }}>
              {/* Main pie */}
              <Pie data={pieData} dataKey="value" nameKey="name"
                cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                paddingAngle={2} isAnimationActive={false} style={{ outline: 'none' }}
                onClick={handlePieClick}>
                {pieData.map((d, i) => (
                  <Cell key={i}
                    fill={getColor(d.name, i)}
                    opacity={activeValue === undefined || activeValue === d.name ? 1 : 0.3}
                    style={{ cursor: 'pointer', outline: 'none' }} />
                ))}
              </Pie>
              {/* Pop-out overlay for Others */}
              {showOthers && (
                <Pie data={pieData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={50} outerRadius={90}
                  paddingAngle={2} isAnimationActive={false}
                  style={{ outline: 'none' }} labelLine={false} label={false}
                  onClick={handlePieClick}>
                  {pieData.map((_, i) => (
                    <Cell key={i}
                      fill={i === othersIndex ? getColor(pieData[i]?.name ?? '', i) : 'transparent'}
                      stroke={i === othersIndex ? '#fff' : 'none'}
                      strokeWidth={i === othersIndex ? 2 : 0}
                      style={{ cursor: 'pointer', outline: 'none' }} />
                  ))}
                </Pie>
              )}
              <Tooltip formatter={(v: number) => [v, 'Leads']}
                contentStyle={{ borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12 }} />
            </PieChart>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 160 }}>
            {/* Persistent Others badge */}
            {showOthers && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#eff6ff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 10px', fontSize: 11 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: getColor('Others', othersIndex), display: 'inline-block' }} />
                  <span style={{ color: C.text }}>Others</span>
                  <span style={{ fontWeight: 700, color: C.text }}>{othersValue}</span>
                  <span style={{ color: C.muted }}>{Math.round(othersValue / total * 100)}%</span>
                </div>
                <span style={{ fontSize: 11, color: C.blue, cursor: 'pointer' }} onClick={() => setShowOthers(false)}>◂ Back</span>
              </div>
            )}
            {legendData.map((d, i) => {
              const isOthersRow = d.name === 'Others' && hasOthers && !showOthers;
              const isActive = activeValue === d.name;
              return (
                <div key={d.name}
                  onClick={() => isOthersRow ? setShowOthers(true) : onSegmentClick(filterType, d.name)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    cursor: 'pointer', borderRadius: 6, padding: '4px 6px',
                    background: isActive ? '#eff6ff' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: getColor(d.name, i), flexShrink: 0, display: 'inline-block', opacity: activeValue === undefined || isActive ? 1 : 0.4 }} />
                  <span style={{ flex: 1, fontSize: 13, color: isOthersRow ? C.blue : isActive ? C.blue : C.text, fontWeight: isActive ? 700 : 400 }}>
                    {d.name}{isOthersRow && <span style={{ fontSize: 11, marginLeft: 4, color: C.muted }}>▸</span>}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{d.value}</span>
                  <span style={{ fontSize: 12, color: C.muted, width: 38, textAlign: 'right' }}>
                    {Math.round(d.value / total * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PagBtn({ label, onClick, disabled, active }: { label: string; onClick: () => void; disabled?: boolean; active?: boolean }) {
  const isArrow = label === '‹' || label === '›';
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: isArrow ? 16 : 12, borderRadius: 8, border: 'none',
      background: active ? C.indigo : 'transparent',
      color: active ? '#fff' : disabled ? '#d1d5db' : C.muted,
      cursor: disabled ? 'default' : 'pointer', fontWeight: active ? 700 : 500,
      fontFamily: 'inherit', transition: 'all 0.12s',
    }}>{label}</button>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const s: Record<string, any> = {
  page:       { padding: '28px 32px', maxWidth: 1200, margin: '0 auto', background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' },
  header:     { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 },
  title:      { fontSize: 22, fontWeight: 800, color: C.text, margin: '0 0 4px' },
  subtitle:   { fontSize: 13, color: C.muted, margin: 0 },
  filterWrap: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  filterLabel:{ fontSize: 12, fontWeight: 600, color: C.muted },
  select:     { padding: '7px 14px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, color: C.text, background: C.card, cursor: 'pointer', fontWeight: 500 },

  kpiStrip:   { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 20, alignItems: 'stretch' },

  card:       { background: C.card, borderRadius: 14, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)', marginBottom: 20 },
  cardHeaderRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 },
  cardTitle:  { fontSize: 14, fontWeight: 700, color: C.text, margin: 0 },
  cardSub:    { fontSize: 12, color: C.muted, margin: '2px 0 0' },
  legendRow:  { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 4 },
  dot:        { display: 'inline-block', width: 8, height: 8, borderRadius: '50%' },

  donutRow:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 },

  clearBtn: { padding: '6px 14px', fontSize: 12, fontWeight: 600, background: '#fee2e2', color: C.red, border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 },

  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}`, gap: 8 },

  table:  { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:     { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `2px solid ${C.border}`, whiteSpace: 'nowrap' },
  td:     { padding: '10px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.text, verticalAlign: 'middle' },
  badge:  { display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' },
  name:   { fontWeight: 600, color: C.text },
  centered: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, color: C.muted, fontSize: 15 },
  empty:  { color: '#cbd5e1', fontSize: 13, textAlign: 'center' as const, padding: '40px 0', margin: 0 },
};
