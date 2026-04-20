import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, ReferenceArea } from 'recharts';
import { faCalendar } from '@fortawesome/free-solid-svg-icons';
import { fetchTeachersWithSalary, fetchPayrollByMonth, fetchTeacherWeightsByMonth, fetchEmployerContributions } from '../../api/salary.js';
import { fetchSettings } from '../../api/settings.js';
import { fetchTeachers } from '../../api/planner.js';
import { fetchOperatingCostCategories, fetchOperatingCostEntries } from '../../api/operatingCost.js';
import { Teacher } from '../../types/index.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { FilterPillStyles, PillSelect, PillToggle } from '../../components/common/FilterPill.js';

const C = {
  bg: '#f8fafc', card: '#fff', text: '#1e293b', muted: '#64748b', border: '#e2e8f0',
  primary: '#5a67d8', green: '#059669', red: '#dc2626', blue: '#3b82f6',
};

function fmtRM(v: number) { return `RM ${v.toLocaleString('en-MY', { minimumFractionDigits: 0 })}`; }

type GroupBy = 'month' | 'quarter';

interface PayrollEntry {
  key: string;
  label: string;
  total: number;
  teacherCount: number;
  isForecast: boolean;
  containsCurrent: boolean;
}

function buildPayrollEntries(
  months: { month: string; total: number; teacherCount: number; isForecast: boolean }[],
  currentMonthIdx: number,
  groupBy: GroupBy,
): PayrollEntry[] {
  if (groupBy === 'month') {
    return months.map((m, i) => ({
      key: String(i),
      label: m.month,
      total: m.total,
      teacherCount: m.teacherCount,
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
      total: slice.reduce((s, m) => s + m.total, 0),
      teacherCount: last.teacherCount,
      isForecast: slice.every(m => m.isForecast),
      containsCurrent: indices.includes(currentMonthIdx),
    };
  });
}

export default function EmployeeCostPage() {
  const { isMobile } = useIsMobile();
  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [groupBy, setGroupBy] = useState<GroupBy>('month');
  const [period, setPeriod] = useState<string>(() => String(new Date().getMonth()));

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ['salary-teachers'],
    queryFn: fetchTeachersWithSalary,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  const { data: allTeachers = [] } = useQuery({
    queryKey: ['planner-teachers'],
    queryFn: fetchTeachers,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const { data: payroll } = useQuery({
    queryKey: ['payroll-by-month', year],
    queryFn: () => fetchPayrollByMonth(year),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  const { data: weightsData } = useQuery({
    queryKey: ['teacher-weights-by-month', year],
    queryFn: () => fetchTeacherWeightsByMonth(year),
    refetchOnMount: 'always',
    staleTime: 0,
  });
  const { data: opCategories = [] } = useQuery({
    queryKey: ['op-cost-categories'],
    queryFn: fetchOperatingCostCategories,
    staleTime: 60_000,
  });
  const { data: opEntries } = useQuery({
    queryKey: ['op-cost-entries', year],
    queryFn: () => fetchOperatingCostEntries(year),
    staleTime: 0,
  });
  const { data: contribSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    staleTime: 60_000,
  });
  const { data: employerContribs } = useQuery({
    queryKey: ['employer-contributions'],
    queryFn: fetchEmployerContributions,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const totalMonthly = useMemo(() => teachers.reduce((s, t) => s + t.calculatedSalary, 0), [teachers]);

  // HR Benefits: sum entries for categories belonging to the protected "HR Benefits" group
  const hrBenefitsMonthly = useMemo(() => {
    if (!opEntries) return null;
    const currentMonthIdx = payroll?.currentMonthIdx ?? new Date().getMonth();
    const hrCatIds = new Set(
      opCategories.filter(c => c.groupName === 'HR Benefits').map(c => c.id)
    );
    if (hrCatIds.size === 0) return null;
    return opEntries.rows
      .filter(e => hrCatIds.has(e.categoryId) && e.month === currentMonthIdx)
      .reduce((s, e) => s + e.amount, 0);
  }, [opCategories, opEntries, payroll]);

  const entries = useMemo<PayrollEntry[]>(
    () => payroll ? buildPayrollEntries(payroll.months, payroll.currentMonthIdx, groupBy) : [],
    [payroll, groupBy],
  );

  // Auto-fit Y-axis domain to highlight period-to-period differences
  const payrollYDomain = useMemo<[number, number]>(() => {
    if (entries.length === 0) return [0, 0];
    const totals = entries.map(e => e.total).filter(v => v > 0);
    if (totals.length === 0) return [0, 0];
    const min = Math.min(...totals);
    const max = Math.max(...totals);
    const range = max - min;
    const pad = range > 0 ? Math.max(range, 100) : Math.max(max * 0.05, 100);
    const lo = Math.max(0, Math.floor((min - pad) / 100) * 100);
    const hi = Math.ceil((max + pad) / 100) * 100;
    return [lo, hi];
  }, [entries]);

  // When year or groupBy changes, jump to the current month/quarter if the
  // selected year is the current year; otherwise fall back to "all".
  useEffect(() => {
    const now = new Date();
    if (year !== now.getFullYear()) {
      setPeriod('all');
      return;
    }
    const m = now.getMonth();
    setPeriod(groupBy === 'quarter' ? `q${Math.floor(m / 3) + 1}` : String(m));
  }, [year, groupBy]);

  // If the selected period becomes entirely forecast, reset to "all"
  useEffect(() => {
    if (entries.length === 0 || period === 'all') return;
    const entry = entries.find(e => e.key === period);
    if (!entry || entry.isForecast) setPeriod('all');
  }, [entries, period]);

  // Profit share weights — derived from weightsData (same source as the table)
  // so the pie chart and table are always in sync.
  const profitShares = useMemo(() => {
    if (!weightsData) return { data: [], totalWeight: 0 };
    const monthIdx = weightsData.currentMonthIdx >= 0 ? weightsData.currentMonthIdx : 11;
    const data = weightsData.teachers
      .map(row => {
        const m = row.months[monthIdx];
        if (!m || !m.isActive || m.weight <= 0) return null;
        return {
          id: row.teacherId,
          name: row.teacherName,
          color: row.color,
          positionName: m.positionName ?? 'Unassigned',
          positionId: m.positionCode ?? '',
          level: m.level,
          baseWeight: m.baseWeight,
          levelWeight: m.levelWeight,
          isPartTime: m.isPartTime,
          isOverride: row.isOverride,
          weight: m.weight,
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .sort((a, b) => b.weight - a.weight);
    const totalWeight = data.reduce((s, d) => s + d.weight, 0);
    return { data, totalWeight };
  }, [weightsData]);

  if (isLoading) return <div style={s.centered}>Loading...</div>;

  return (
    <div style={{ ...s.page, ...(isMobile ? { padding: '20px 12px' } : {}) }}>
      <style>{`.recharts-wrapper *:focus { outline: none !important; } .ec-row:hover { background: #f0f9ff !important; }`}</style>
      <FilterPillStyles />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={s.title}>Staff</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
      </div>

      {/* KPI strip — full width */}
      {(() => {
        const staffCost = totalMonthly + (employerContribs?.total ?? 0);
        return (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
            <KpiCard
              label="Staff Cost"
              value={employerContribs ? fmtRM(staffCost) : '—'}
              color={C.primary}
              sub={employerContribs ? `Salary + Employer Contributions` : undefined}
            />
            <KpiCard label="Monthly Salary" value={fmtRM(totalMonthly)} color="#6366f1" sub={`${teachers.length} active teachers`} />
            <KpiCard
              label="Employer Contributions"
              value={employerContribs ? fmtRM(employerContribs.total) : '—'}
              color="#0891b2"
              sub={employerContribs ? `EPF ${fmtRM(employerContribs.epf)} · SOCSO ${fmtRM(employerContribs.socso)} · EIS ${fmtRM(employerContribs.eis)}` : undefined}
            />
            <KpiCard
              label="HR Benefits (This Month)"
              value={hrBenefitsMonthly !== null ? fmtRM(hrBenefitsMonthly) : '—'}
              color="#7c3aed"
            />
          </div>
        );
      })()}

      {/* Payroll chart — respects Group by and Period selection */}
      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={s.cardTitle}>Staff Cost by {groupBy === 'quarter' ? 'Quarter' : 'Month'}</h2>
            <p style={s.cardSub}>
              {payroll?.year ?? year}
              {payroll && payroll.forecastTotal > 0 && (
                <>
                  <span style={{ margin: '0 6px', color: '#cbd5e1' }}>·</span>
                  <span style={{ color: C.muted }}>Actual {fmtRM(payroll.actualTotal)}</span>
                  <span style={{ margin: '0 6px', color: '#cbd5e1' }}>·</span>
                  <span style={{ color: C.muted }}>Forecast {fmtRM(payroll.forecastTotal)}</span>
                </>
              )}
            </p>
          </div>
          <LegendPills
            items={[
              { color: C.primary, label: 'Actual' },
              { color: '#312e81', label: 'Current' },
              { color: '#c7d2fe', label: 'Forecast' },
              { color: '#0ea5e9', label: 'Staff count' },
            ]}
          />
        </div>
        {!payroll || entries.every(e => e.total === 0) ? (
          <p style={s.empty}>No staff cost data</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={entries} margin={{ top: 20, right: 44, left: 0, bottom: 0 }} style={{ outline: 'none' }}>
              <CartesianGrid vertical={false} stroke={C.border} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: C.muted }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="cost" tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} width={50} domain={payrollYDomain} allowDecimals={false} tickFormatter={v => `${(v / 1000).toFixed(1)}k`} />
              <YAxis yAxisId="staff" orientation="right" tick={{ fontSize: 11, fill: '#0ea5e9' }} axisLine={false} tickLine={false} width={28} domain={[0, 'dataMax + 2']} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: 'transparent' }}
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload as PayrollEntry;
                  return (
                    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                      <div style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>{label}{d.isForecast ? ' · Forecast' : ''}</div>
                      <div style={{ color: C.green, fontWeight: 600 }}>{fmtRM(d.total)}</div>
                      <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{d.teacherCount} teacher{d.teacherCount !== 1 ? 's' : ''}</div>
                    </div>
                  );
                }}
              />
              {period !== 'all' && entries.find(e => e.key === period) && (
                <ReferenceArea
                  x1={entries.find(e => e.key === period)!.label}
                  x2={entries.find(e => e.key === period)!.label}
                  fill="#312e81"
                  fillOpacity={0.08}
                  stroke="#312e81"
                  strokeOpacity={0.25}
                  strokeDasharray="3 3"
                  ifOverflow="extendDomain"
                />
              )}
              <Bar
                yAxisId="cost"
                dataKey="total"
                radius={[6, 6, 0, 0]}
                maxBarSize={groupBy === 'quarter' ? 80 : 42}
                cursor="pointer"
                onClick={(_data: any, index: number) => {
                  const entry = entries[index];
                  if (!entry || entry.isForecast) return;
                  setPeriod(prev => prev === entry.key ? 'all' : entry.key);
                }}
                label={({ x, y, width, value }: any) => {
                  if (!value) return <text key={`l-${x}`} />;
                  return <text key={`l-${x}`} x={x + width / 2} y={y - 6} textAnchor="middle" fill={C.muted} fontSize={10} fontWeight={600}>{value.toLocaleString('en-MY')}</text>;
                }}>
                {entries.map((e, i) => {
                  const fill = e.containsCurrent ? '#312e81' : e.isForecast ? '#c7d2fe' : C.primary;
                  return <Cell key={i} fill={fill} />;
                })}
              </Bar>
              <Line
                yAxisId="staff"
                type="monotone"
                dataKey="teacherCount"
                name="Staff"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={{ r: 3, fill: '#fff', stroke: '#0ea5e9', strokeWidth: 2 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Staff changes — joins & resignations */}
      <StaffChangesList
        teachers={allTeachers}
        year={year}
        period={period}
        groupBy={groupBy}
        onClearPeriod={() => setPeriod('all')}
      />

      {/* Profit Share by Weight */}
      <div style={s.card}>
        <h2 style={s.cardTitle}>Profit Share Weight</h2>
        <p style={s.cardSub}>Title weight + interpolated level weight. Total = {profitShares.totalWeight.toFixed(2)}</p>
        {profitShares.data.length === 0 ? <p style={s.empty}>No teachers with title weight</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '320px 1fr', gap: 24, alignItems: 'center' }}>
            {/* Pie chart */}
            <ResponsiveContainer width="100%" height={280}>
              <PieChart style={{ outline: 'none' }}>
                <Pie data={profitShares.data} dataKey="weight" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={110} isAnimationActive={false} style={{ outline: 'none' }}>
                  {profitShares.data.map((t) => <Cell key={t.id} fill={t.color} />)}
                </Pie>
                <Tooltip
                  formatter={(v: number, _n: string, p: any) => {
                    const pct = profitShares.totalWeight > 0 ? (v / profitShares.totalWeight * 100).toFixed(1) : '0';
                    return [`${v.toFixed(2)} (${pct}%)`, p.payload.name];
                  }}
                  contentStyle={{ borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>

            {/* Legend list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {profitShares.data.map(t => {
                const pct = profitShares.totalWeight > 0 ? (t.weight / profitShares.totalWeight * 100) : 0;
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{t.name}</span>
                        {t.isPartTime && <span style={{ fontSize: 9, fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '1px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Part Time</span>}
                        {(t as any).isOverride && <span style={{ fontSize: 9, fontWeight: 700, color: '#7c3aed', background: '#ede9fe', padding: '1px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Override</span>}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted }}>
                        {(t as any).isOverride ? (
                          <>Override · <span style={{ fontVariantNumeric: 'tabular-nums' as any }}>{t.weight.toFixed(2)}</span></>
                        ) : (
                        <>{t.positionName}{t.level > 0 ? ` · L${t.level}` : ''}
                        {' · '}
                        <span style={{ fontVariantNumeric: 'tabular-nums' as any }}>
                          {t.isPartTime ? (
                            <>({t.baseWeight}{t.levelWeight > 0 ? ` + ${t.levelWeight.toFixed(2)}` : ''}) ÷ 2 = {t.weight.toFixed(2)}</>
                          ) : (
                            <>{t.baseWeight}{t.levelWeight > 0 ? ` + ${t.levelWeight.toFixed(2)}` : ''} = {t.weight.toFixed(2)}</>
                          )}
                        </span></>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.green, fontVariantNumeric: 'tabular-nums' as any }}>{pct.toFixed(1)}%</div>
                      <div style={{ fontSize: 10, color: C.muted, fontVariantNumeric: 'tabular-nums' as any }}>{t.weight.toFixed(2)} / {profitShares.totalWeight.toFixed(2)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Teacher salary table */}
      <div style={s.card}>
        <h2 style={{ ...s.cardTitle, marginBottom: 14 }}>Teacher Salary Details</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={s.table}>
            <thead>
              <tr>
                {['Teacher', 'Position', 'Lvl', 'Basic', 'Incentive', 'Allowances', 'Total'].map(h => (
                  <th key={h} style={{ ...s.th, ...(h === 'Total' ? { textAlign: 'right' } : {}) }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...teachers].sort((a, b) => b.calculatedSalary - a.calculatedSalary).map((t, i) => (
                <tr key={t.id} className="ec-row" style={{ background: i % 2 === 0 ? C.card : '#f8fafc' }}>
                  <td style={s.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 600 }}>{t.name}</span>
                    </div>
                  </td>
                  <td style={s.td}>
                    {t.position
                      ? <span style={{ display: 'inline-block', padding: '2px 8px', fontSize: 11, fontWeight: 700, borderRadius: 4, background: '#f1f5f9', color: C.text }}>{t.position.positionId}</span>
                      : <span style={{ color: '#cbd5e1' }}>—</span>
                    }
                  </td>
                  <td style={{ ...s.td, textAlign: 'center' }}>{t.isFixedSalary ? '—' : t.level ?? 0}</td>
                  <td style={{ ...s.td, fontVariantNumeric: 'tabular-nums' }}>{t.breakdown ? fmtRM(t.breakdown.basic) : '—'}</td>
                  <td style={{ ...s.td, fontVariantNumeric: 'tabular-nums' }}>{t.isFixedSalary ? '—' : t.breakdown ? fmtRM(t.breakdown.levelIncentive) : '—'}</td>
                  <td style={{ ...s.td, fontVariantNumeric: 'tabular-nums' }}>{t.breakdown ? fmtRM(t.breakdown.totalAllowances) : '—'}</td>
                  <td style={{ ...s.td, textAlign: 'right' }}>
                    {t.calculatedSalary > 0 ? (
                      <span style={{ fontWeight: 700, color: C.green, fontVariantNumeric: 'tabular-nums' }}>{fmtRM(t.calculatedSalary)}</span>
                    ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                    {t.isFixedSalary && t.calculatedSalary > 0 && <span style={{ fontSize: 9, color: C.muted, marginLeft: 4, fontWeight: 600, textTransform: 'uppercase' }}>fixed</span>}
                  </td>
                </tr>
              ))}
              {teachers.length > 0 && (
                <tr style={{ borderTop: `2px solid ${C.border}` }}>
                  <td colSpan={6} style={{ ...s.td, fontWeight: 700, fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Monthly Staff Cost</td>
                  <td style={{ ...s.td, textAlign: 'right' }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: C.green }}>{fmtRM(totalMonthly)}</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Profit-share weight per teacher — honours CareerRecord history */}
        <div style={s.card}>
          <div style={{ marginBottom: 14 }}>
            <h2 style={s.cardTitle}>{groupBy === 'quarter' ? 'Quarterly' : 'Monthly'} Profit-Share Weight</h2>
            <p style={s.cardSub}>Title weight + interpolated level weight, halved for part-time. Cells change when a teacher is promoted mid-year.</p>
          </div>
          {weightsData && weightsData.teachers.length > 0 ? (
            <TeacherWeightsTable data={weightsData} groupBy={groupBy} />
          ) : (
            <p style={s.empty}>No teacher weight data</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface PeriodCell {
  label: string;
  value: number;
  isActive: boolean;
  isCurrent: boolean;
  /** True when this cell's value changed vs the previous one (promotion). */
  changed: boolean;
  tooltip: string;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function buildWeightCells(
  row: import('../../api/salary.js').TeacherWeightRow,
  currentMonthIdx: number,
  groupBy: GroupBy,
): PeriodCell[] {
  if (groupBy === 'month') {
    return row.months.map((m, i) => {
      const prev = i > 0 ? row.months[i - 1] : null;
      const changed = !!(prev && prev.isActive && m.isActive && Math.abs(prev.weight - m.weight) > 0.001);
      const tooltip = m.isActive
        ? row.isOverride
          ? `Override: ${m.weight.toFixed(2)}`
          : `${m.positionName ?? 'Unassigned'}${m.level > 0 ? ` · L${m.level}` : ''}\nBase: ${m.baseWeight}${m.levelWeight > 0 ? ` + ${m.levelWeight.toFixed(2)}` : ''}${m.isPartTime ? ' ÷ 2 (part-time)' : ''} = ${m.weight.toFixed(2)}`
        : 'Inactive';
      return {
        label: MONTH_LABELS[i],
        value: m.isActive ? m.weight : 0,
        isActive: m.isActive,
        isCurrent: i === currentMonthIdx,
        changed,
        tooltip,
      };
    });
  }
  // Quarter mode — each quarter averages its 3 months; inactive months count
  // as 0 so a resigned teacher dilutes their own quarter average proportionally.
  const quarters: PeriodCell[] = [];
  let prevAverage: number | null = null;
  for (let q = 0; q < 4; q++) {
    const slice = row.months.slice(q * 3, q * 3 + 3);
    const rawSum = slice.reduce((sum, m) => sum + (m.isActive ? m.weight : 0), 0);
    const average = rawSum / 3;
    const anyActive = slice.some(m => m.isActive);
    const currentQuarter = currentMonthIdx >= 0 && Math.floor(currentMonthIdx / 3) === q;
    const changed = prevAverage != null && anyActive && Math.abs(prevAverage - average) > 0.001;
    const breakdown = slice
      .map((m, idx) => {
        const label = MONTH_LABELS[q * 3 + idx];
        return `${label}: ${m.isActive ? m.weight.toFixed(2) : '0.00 (inactive)'}`;
      })
      .join('\n');
    quarters.push({
      label: `Q${q + 1}`,
      value: average,
      isActive: anyActive,
      isCurrent: currentQuarter,
      changed,
      tooltip: `${breakdown}\nAvg = ${average.toFixed(2)}`,
    });
    prevAverage = average;
  }
  return quarters;
}

function TeacherWeightsTable({
  data,
  groupBy,
}: {
  data: import('../../api/salary.js').TeacherWeightsByMonth;
  groupBy: GroupBy;
}) {
  const columnCount = groupBy === 'quarter' ? 4 : 12;
  const colWidth = groupBy === 'quarter' ? 96 : 58;
  const minWidth = groupBy === 'quarter' ? 680 : 920;

  // Precompute all rows' cells so we can also derive per-period column totals.
  const rowCells = data.teachers.map(row => ({
    row,
    cells: buildWeightCells(row, data.currentMonthIdx, groupBy),
  }));
  const headerCells = rowCells[0]?.cells ?? Array.from({ length: columnCount }).map((_, i) => ({
    label: groupBy === 'quarter' ? `Q${i + 1}` : MONTH_LABELS[i],
    value: 0,
    isActive: false,
    isCurrent: data.currentMonthIdx >= 0 && (groupBy === 'quarter' ? Math.floor(data.currentMonthIdx / 3) === i : i === data.currentMonthIdx),
    changed: false,
    tooltip: '',
  }));
  const columnTotals = Array.from({ length: columnCount }).map((_, i) =>
    rowCells.reduce((sum, r) => sum + (r.cells[i]?.value ?? 0), 0)
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ ...s.table, tableLayout: 'fixed', minWidth }}>
        <colgroup>
          <col style={{ width: 200 }} />
          {Array.from({ length: columnCount }).map((_, i) => <col key={i} style={{ width: colWidth }} />)}
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...s.th, textAlign: 'left' }}>Teacher</th>
            {headerCells.map((c, i) => (
              <th
                key={i}
                style={{
                  ...s.th,
                  textAlign: 'center',
                  color: c.isCurrent ? C.primary : C.muted,
                }}
              >{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowCells.map(({ row, cells }) => (
            <tr key={row.teacherId} className="ec-row">
              <td style={{ ...s.td, fontWeight: 600, color: C.text }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', background: row.color, flexShrink: 0,
                  }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.teacherName}</span>
                  {row.employmentType === 'part-time' && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: '#d97706', background: '#fef3c7',
                      padding: '1px 6px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>PT</span>
                  )}
                  {row.isOverride && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: '#7c3aed', background: '#ede9fe',
                      padding: '1px 6px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>Override</span>
                  )}
                </div>
              </td>
              {cells.map((c, i) => (
                <td
                  key={i}
                  title={c.tooltip}
                  style={{
                    ...s.td,
                    textAlign: 'center',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: c.changed ? 800 : 600,
                    color: !c.isActive ? '#cbd5e1' : c.changed ? C.primary : C.text,
                    background: !c.isActive ? '#fafbfc' : c.changed ? '#eef0fa' : c.isCurrent ? '#f8faff' : 'transparent',
                    padding: '10px 6px',
                  }}
                >{c.isActive ? c.value.toFixed(c.value % 1 === 0 ? 0 : 2) : '—'}</td>
              ))}
            </tr>
          ))}
          {rowCells.length > 0 && (
            <tr style={{ borderTop: `2px solid ${C.border}`, background: '#f8fafc' }}>
              <td style={{ ...s.td, fontWeight: 700, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total</td>
              {columnTotals.map((total, i) => {
                const isCurrent = headerCells[i]?.isCurrent;
                return (
                  <td
                    key={i}
                    style={{
                      ...s.td,
                      textAlign: 'center',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 800,
                      color: C.text,
                      background: isCurrent ? '#eef0fa' : 'transparent',
                      padding: '10px 6px',
                    }}
                  >{total.toFixed(total % 1 === 0 ? 0 : 2)}</td>
                );
              })}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function KpiCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: '-0.01em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' as any }}>{value}</div>
      {sub && <div style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function LegendPills({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {items.map(it => (
        <span key={it.label} style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          background: '#f8fafc',
          border: `1px solid ${C.border}`,
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
          color: C.muted,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

// ── Staff Changes (joins & resignations) ─────────────────────────────────────

const SC_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface StaffEvent {
  teacher: Teacher;
  type: 'join' | 'resign';
  date: Date;
  monthIdx: number;
}

function StaffChangesList({
  teachers,
  year,
  period,
  groupBy,
  onClearPeriod,
}: {
  teachers: Teacher[];
  year: number;
  period: string;
  groupBy: GroupBy;
  onClearPeriod: () => void;
}) {
  // Resolve which months are selected
  const selectedMonths: number[] | null = (() => {
    if (period === 'all') return null;
    if (period.startsWith('q')) {
      const qi = parseInt(period[1]) - 1;
      return [qi * 3, qi * 3 + 1, qi * 3 + 2];
    }
    return [parseInt(period)];
  })();

  const events = useMemo<StaffEvent[]>(() => {
    const result: StaffEvent[] = [];
    for (const t of teachers) {
      // Join event
      if (t.createdAt) {
        const d = new Date(t.createdAt);
        if (d.getFullYear() === year) {
          result.push({ teacher: t, type: 'join', date: d, monthIdx: d.getMonth() });
        }
      }
      // Resignation event
      if (t.resignedAt) {
        const d = new Date(t.resignedAt);
        if (d.getFullYear() === year) {
          result.push({ teacher: t, type: 'resign', date: d, monthIdx: d.getMonth() });
        }
      }
    }
    // Filter to selected months if applicable
    const filtered = selectedMonths
      ? result.filter(e => selectedMonths.includes(e.monthIdx))
      : result;
    return filtered.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [teachers, year, selectedMonths]);

  const joins = events.filter(e => e.type === 'join');
  const resigns = events.filter(e => e.type === 'resign');

  const title = (() => {
    if (period === 'all') return `Staff Changes — ${year}`;
    if (period.startsWith('q')) return `Staff Changes — Q${period[1]} ${year}`;
    return `Staff Changes — ${SC_MONTHS[parseInt(period)]} ${year}`;
  })();

  const showGrouped = selectedMonths === null || selectedMonths.length > 1;

  // Group events by month (for "all" and quarter view)
  const byMonth = useMemo(() => {
    const map = new Map<number, StaffEvent[]>();
    for (const e of events) {
      const list = map.get(e.monthIdx) ?? [];
      list.push(e);
      map.set(e.monthIdx, list);
    }
    return map;
  }, [events]);

  const EventRow = ({ e }: { e: StaffEvent }) => {
    const isJoin = e.type === 'join';
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px',
        borderBottom: '1px solid #f1f5f9',
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: e.teacher.color, flexShrink: 0,
        }} />
        <span style={{ fontWeight: 600, fontSize: 13, color: C.text, flex: 1, minWidth: 0 }}>
          {e.teacher.name}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
          padding: '2px 7px', borderRadius: 4,
          color: isJoin ? C.green : C.red,
          background: isJoin ? '#dcfce7' : '#fee2e2',
        }}>
          {isJoin ? 'Joined' : 'Resigned'}
        </span>
        <span style={{ fontSize: 12, color: C.muted, minWidth: 90, textAlign: 'right' }}>
          {fmtDate(isJoin ? e.teacher.createdAt : e.teacher.resignedAt)}
        </span>
      </div>
    );
  };

  return (
    <div style={{ background: C.card, borderRadius: 14, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 2px' }}>
            {title}
            <span style={{ fontSize: 12, fontWeight: 500, color: C.muted, marginLeft: 8 }}>
              {joins.length > 0 && <span style={{ color: C.green }}>+{joins.length} joined</span>}
              {joins.length > 0 && resigns.length > 0 && <span style={{ margin: '0 4px', color: '#cbd5e1' }}>·</span>}
              {resigns.length > 0 && <span style={{ color: C.red }}>{resigns.length} resigned</span>}
              {joins.length === 0 && resigns.length === 0 && 'No changes'}
            </span>
          </h2>
        </div>
        {period !== 'all' && (
          <button
            onClick={onClearPeriod}
            style={{
              padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.border}`,
              background: '#fff', color: C.muted, cursor: 'pointer', fontSize: 11, fontWeight: 600,
            }}
          >
            ← Show whole year
          </button>
        )}
      </div>

      {events.length === 0 ? (
        <p style={{ margin: 0, padding: '16px 0', textAlign: 'center', fontSize: 13, color: '#cbd5e1' }}>
          No staff changes in this period
        </p>
      ) : showGrouped ? (
        // Grouped by month
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[...byMonth.keys()].sort((a, b) => a - b).map(mi => (
            <div key={mi}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, paddingLeft: 12 }}>
                {SC_MONTHS[mi]}
              </div>
              <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                {byMonth.get(mi)!.map((e, i) => <EventRow key={i} e={e} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Single month — flat list
        <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          {events.map((e, i) => <EventRow key={i} e={e} />)}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', maxWidth: 1200, margin: '0 auto', background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#0f172a' },
  title: { fontSize: 24, fontWeight: 700, color: '#0f172a', margin: '0 0 4px', letterSpacing: '-0.02em' },
  subtitle: { fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.5 },
  card: {
    background: C.card,
    border: '1px solid #e5e7eb',
    borderRadius: 14,
    padding: '20px 24px',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
    marginBottom: 24,
  },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 4px', letterSpacing: '-0.01em' },
  cardSub: { fontSize: 12, color: C.muted, margin: '0 0 16px' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  th: { textAlign: 'left' as const, padding: '12px 12px', fontWeight: 600, fontSize: 11, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase' as const, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' as const, background: '#fafbfc', verticalAlign: 'middle' as const },
  td: { padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: '#0f172a', whiteSpace: 'nowrap' as const, verticalAlign: 'middle' as const },
  centered: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, color: C.muted, fontSize: 14 },
  empty: { color: '#cbd5e1', fontSize: 14, textAlign: 'center' as const, padding: '40px 0', margin: 0 },
};
