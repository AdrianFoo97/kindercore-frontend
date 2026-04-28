import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faXmark, faCircleInfo, faChevronDown, faUsers, faCalendar } from '@fortawesome/free-solid-svg-icons';
import { fetchTeacherWeightsByMonth } from '../api/salary.js';
import { fetchFinanceSummary } from '../api/finance.js';
import { fetchSettings } from '../api/settings.js';
import { DEFAULT_EXPENSE_RATIO_TARGET, DEFAULT_ANNUAL_BONUS_PERCENT } from './FinanceSettingsPage.js';
import { FilterPillStyles, PillSelect } from '../components/common/FilterPill.js';

// ── Design tokens ───────────────────────────────────────────────────────
const C = {
  bg:           '#f8fafc',
  surface:      '#ffffff',
  surfaceMuted: '#fafbfc',
  surfaceFail:  '#fefafa',
  border:       '#e5e7eb',
  borderSoft:   '#eceef1',
  divider:      '#f1f3f6',
  dividerSoft:  '#f6f7f9',
  text:         '#0f172a',
  textSub:      '#475569',
  muted:        '#64748b',
  faint:        '#94a3b8',
  ghost:        '#cbd5e1',

  success:      '#059669',
  successSoft:  '#10b981',
  successBg:    '#ecfdf5',

  danger:       '#dc2626',
  dangerBg:     '#fef2f2',

  brand:        '#4f46e5',
  brandBg:      '#eef2ff',
};

const SHADOW_SM = '0 1px 2px rgba(15, 23, 42, 0.04)';
const SHADOW_MD = '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.04)';

const SP = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40 } as const;

const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_LABELS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const QUARTER_KEYS = [0, 1, 2, 3] as const;
const QUARTER_LABELS_SHORT = ['Q1', 'Q2', 'Q3', 'Q4'];
const QUARTER_RANGES = ['Jan – Mar', 'Apr – Jun', 'Jul – Sep', 'Oct – Dec'];

function fmtRM(n: number): string {
  return `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtRM0(n: number): string {
  return `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface MonthlyPool {
  monthIdx: number;
  revenue: number;
  expenses: number;
  ratio: number | null;
  /** True only when actuals confirm the ratio meets target. */
  hit: boolean;
  /** Real contribution to the pool — 0 for forecast months. */
  pool: number;
  /** Hypothetical contribution this month would make if its ratio holds —
   *  for forecast months this is the projected amount; for elapsed months
   *  it equals `pool`. */
  projectedPool: number;
  isForecast: boolean;
}

export default function AnnualBonusPage() {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [teacherFilterOpen, setTeacherFilterOpen] = useState(false);
  const teacherFilterRef = React.useRef<HTMLDivElement | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['teacher-weights-by-month', year],
    queryFn: () => fetchTeacherWeightsByMonth(year),
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const { data: finance } = useQuery({
    queryKey: ['finance-summary', year],
    queryFn: () => fetchFinanceSummary(year),
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  const expenseTarget = (() => {
    const v = settings?.expense_ratio_target;
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
    return Number.isFinite(n) && n > 0 && n <= 2 ? n : DEFAULT_EXPENSE_RATIO_TARGET;
  })();
  const annualBonusPct = (() => {
    const v = settings?.annual_bonus_percent;
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
    return Number.isFinite(n) && n > 0 && n <= 1 ? n : DEFAULT_ANNUAL_BONUS_PERCENT;
  })();

  // Per-month pool: revenue × percent if month's expense ratio meets target,
  // else 0. Forecast months haven't elapsed yet — they hold at 0 until
  // actual numbers arrive (we don't pay out on forecast).
  const monthlyPools = useMemo<MonthlyPool[]>(() => {
    return Array.from({ length: 12 }, (_, mi) => {
      const m = finance?.months[mi];
      if (!m) return { monthIdx: mi, revenue: 0, expenses: 0, ratio: null, hit: false, pool: 0, projectedPool: 0, isForecast: true };
      const expenses = m.staffCost + m.operatingCost;
      const ratio = m.revenue > 0 ? expenses / m.revenue : null;
      const wouldQualify = ratio !== null && ratio <= expenseTarget;
      const hit = !m.isForecast && wouldQualify;
      const projectedPool = wouldQualify ? m.revenue * annualBonusPct : 0;
      const pool = hit ? projectedPool : 0;
      return { monthIdx: mi, revenue: m.revenue, expenses, ratio, hit, pool, projectedPool, isForecast: m.isForecast };
    });
  }, [finance, expenseTarget, annualBonusPct]);

  const amount = useMemo(() => monthlyPools.reduce((s, m) => s + m.pool, 0), [monthlyPools]);
  const forecastAmount = useMemo(
    () => monthlyPools.filter(m => m.isForecast).reduce((s, m) => s + m.projectedPool, 0),
    [monthlyPools],
  );

  React.useEffect(() => {
    if (!teacherFilterOpen) return;
    const onDown = (e: MouseEvent) => {
      if (teacherFilterRef.current && !teacherFilterRef.current.contains(e.target as Node)) {
        setTeacherFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [teacherFilterOpen]);

  // Eligible teachers: any teacher with non-zero total weight across the year.
  // Each row carries 12 monthly entries plus 4 pre-aggregated quarter entries
  // (so the table can render quarter columns with month-level tooltips).
  const eligibleInYear = useMemo(() => {
    if (!data) return [] as Array<{
      teacherId: string;
      name: string;
      color: string;
      weight: number;
      activeMonths: number;
      isOverride: boolean;
      months: Array<{
        monthIdx: number; weight: number; fullWeight: number;
        isActive: boolean; partial: boolean;
        activeDays: number; daysInMonth: number;
        tooltip: string;
      }>;
      quarters: Array<{ quarterIdx: number; weight: number; activeMonths: number; tooltip: string }>;
    }>;
    return data.teachers
      .map(t => {
        let weight = 0;
        let activeMonths = 0;
        const months = Array.from({ length: 12 }, (_, mi) => {
          const m = t.months[mi];
          const isActive = !!(m && m.isActive && m.weight > 0);
          if (isActive && m) {
            weight += m.weight;
            activeMonths++;
          }
          const partial = isActive && !!m && m.activeDayRatio > 0 && m.activeDayRatio < 1;
          let tooltip: string;
          if (!m || !m.isActive) {
            tooltip = `${MONTH_LABELS[mi]} · Inactive`;
          } else if (t.isOverride) {
            const prorationLine = partial
              ? `\nActive ${m.activeDays}/${m.daysInMonth} days → ${m.fullWeight.toFixed(2)} × ${m.activeDayRatio.toFixed(3)} = ${m.weight.toFixed(2)}`
              : '';
            tooltip = `${MONTH_LABELS[mi]}\nOverride: ${m.fullWeight.toFixed(2)}${prorationLine}`;
          } else {
            const header = `${MONTH_LABELS[mi]} · ${m.positionName ?? 'Unassigned'}${m.level > 0 ? ` · L${m.level}` : ''}`;
            const baseLine = `Base: ${m.baseWeight}${m.levelWeight > 0 ? ` + ${m.levelWeight.toFixed(2)}` : ''}${m.isPartTime ? ' ÷ 2 (part-time)' : ''} = ${m.fullWeight.toFixed(2)}`;
            const prorationLine = partial
              ? `\nActive ${m.activeDays}/${m.daysInMonth} days → ${m.fullWeight.toFixed(2)} × ${m.activeDayRatio.toFixed(3)} = ${m.weight.toFixed(2)}`
              : '';
            tooltip = `${header}\n${baseLine}${prorationLine}`;
          }
          return {
            monthIdx: mi,
            weight: m?.weight ?? 0,
            fullWeight: m?.fullWeight ?? 0,
            isActive,
            partial,
            activeDays: m?.activeDays ?? 0,
            daysInMonth: m?.daysInMonth ?? 0,
            tooltip,
          };
        });
        if (weight <= 0) return null;
        const quarters = QUARTER_KEYS.map(qi => {
          const monthIdxs = [qi * 3, qi * 3 + 1, qi * 3 + 2];
          let qWeight = 0;
          let qActive = 0;
          const lines: string[] = [];
          for (const mi of monthIdxs) {
            const mm = months[mi];
            if (mm.isActive) {
              qWeight += mm.weight;
              qActive++;
              lines.push(`${MONTH_LABELS_SHORT[mi]}: ${mm.weight.toFixed(2)}`);
            } else {
              lines.push(`${MONTH_LABELS_SHORT[mi]}: —`);
            }
          }
          const tooltip = `${QUARTER_LABELS_SHORT[qi]} · ${QUARTER_RANGES[qi]}\n${lines.join('\n')}\nTotal: ${qWeight.toFixed(2)}`;
          return { quarterIdx: qi, weight: qWeight, activeMonths: qActive, tooltip };
        });
        return {
          teacherId: t.teacherId,
          name: t.teacherName,
          color: t.color,
          weight,
          activeMonths,
          isOverride: t.isOverride,
          months,
          quarters,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [data]);

  const distribution = useMemo(() => {
    const rows = eligibleInYear.filter(r => !excluded.has(r.teacherId));
    const totalWeight = rows.reduce((s, r) => s + r.weight, 0);
    let allocated = 0;
    const ordered = [...rows].sort((a, b) => b.weight - a.weight);
    const withAmount = ordered.map((r, i) => {
      const raw = totalWeight > 0 ? (r.weight / totalWeight) * amount : 0;
      const isLast = i === ordered.length - 1;
      const a = isLast ? Math.max(0, amount - allocated) : Math.round(raw * 100) / 100;
      allocated += a;
      return { ...r, share: totalWeight > 0 ? r.weight / totalWeight : 0, amount: a };
    });
    return { rows: withAmount, totalWeight };
  }, [eligibleInYear, excluded, amount]);

  const includedCount = eligibleInYear.length - excluded.size;
  const filterLabel = excluded.size === 0
    ? 'All teachers'
    : `${includedCount} of ${eligibleInYear.length}`;

  const toggleTeacher = (id: string) => {
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const availableYears = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
  }, []);

  return (
    <div style={{ padding: '28px 32px', background: C.bg, minHeight: '100vh' }}>
      <style>{`
        .ab-row { transition: background 100ms ease; }
        .ab-row td { cursor: default; transition: background 120ms ease; }
        .ab-row:hover td { background: #eef2f7; }
        .ab-link { transition: color 100ms ease; }
        .ab-link:hover { color: ${C.text}; }
      `}</style>

      <FilterPillStyles />
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* ── Header ────────────────────────────────────────────── */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16, flexWrap: 'wrap' as const, marginBottom: SP[6],
        }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
            Annual Bonus
          </h1>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' as const }}>
            <PillSelect
              icon={faCalendar}
              value={String(year)}
              onChange={v => setYear(Number(v))}
              options={availableYears.map(y => ({ value: String(y), label: String(y) }))}
            />
            <div ref={teacherFilterRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setTeacherFilterOpen(o => !o)}
                className="pill-select"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  height: 36, padding: '0 12px',
                  fontSize: 13, fontWeight: 600,
                  color: C.text, fontFamily: 'inherit',
                  background: C.surface,
                  border: `1px solid #e2e8f0`, borderRadius: 9,
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                  cursor: 'pointer', minWidth: 160,
                  transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
                }}
              >
                <FontAwesomeIcon icon={faUsers} style={{ fontSize: 12, color: C.muted }} />
                <span style={{ flex: 1, textAlign: 'left' as const }}>{filterLabel}</span>
                <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 10, color: C.muted, marginLeft: 2 }} />
              </button>
              {teacherFilterOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                  minWidth: 260, maxHeight: 360, overflowY: 'auto' as const,
                  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
                  boxShadow: SHADOW_MD, zIndex: 10, padding: 6,
                }}>
                  <div style={{ display: 'flex', gap: 6, padding: '4px 8px 8px', borderBottom: `1px solid ${C.divider}`, marginBottom: 4 }}>
                    <button type="button" onClick={() => setExcluded(new Set())} style={smallLinkBtn} className="ab-link">Select all</button>
                    <span style={{ color: C.faint }}>·</span>
                    <button type="button" onClick={() => setExcluded(new Set(eligibleInYear.map(t => t.teacherId)))} style={smallLinkBtn} className="ab-link">Clear</button>
                  </div>
                  {eligibleInYear.length === 0 && (
                    <div style={{ padding: 16, fontSize: 12, color: C.muted, textAlign: 'center' as const }}>
                      No eligible teachers for this year.
                    </div>
                  )}
                  {eligibleInYear.map(t => {
                    const isIncluded = !excluded.has(t.teacherId);
                    return (
                      <label
                        key={t.teacherId}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
                          fontSize: 13, color: C.text,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = C.surfaceMuted; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <input type="checkbox" checked={isIncluded} onChange={() => toggleTeacher(t.teacherId)} style={{ cursor: 'pointer', accentColor: C.brand }} />
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                        <span style={{ flex: 1 }}>{t.name}</span>
                        <span style={{ fontSize: 11, color: C.faint, fontVariantNumeric: 'tabular-nums' as any }}>
                          {t.weight.toFixed(2)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Pool Hero ─────────────────────────────────────────── */}
        <PoolCard
          year={year}
          monthlyPools={monthlyPools}
          total={amount}
          forecastTotal={forecastAmount}
          expenseTarget={expenseTarget}
          annualBonusPct={annualBonusPct}
        />

        {/* ── Distribution Table ───────────────────────────────── */}
        <div style={{ ...cardStyle, padding: 0, marginTop: SP[6], overflow: 'hidden' as const }}>
          <div style={{
            padding: `${SP[5]}px ${SP[6]}px`, borderBottom: `1px solid ${C.divider}`,
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            gap: SP[4], flexWrap: 'wrap' as const,
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.005em' }}>
                Distribution
              </h2>
              <div style={{ marginTop: 3, fontSize: 12, color: C.muted }}>
                Annual · {year}
              </div>
            </div>
            {distribution.rows.length > 0 && (
              <div style={{ fontSize: 11, color: C.faint, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                {distribution.rows.length} {distribution.rows.length === 1 ? 'teacher' : 'teachers'}
              </div>
            )}
          </div>

          {isLoading && <p style={centerEmpty}>Loading…</p>}
          {isError && <p style={{ ...centerEmpty, color: C.danger }}>Failed to load teacher weights.</p>}
          {!isLoading && !isError && distribution.rows.length === 0 && (
            <p style={centerEmpty}>
              {amount === 0
                ? 'Pool is RM 0 — no months in this year met the expense target.'
                : 'No active teachers with weight in this year.'}
            </p>
          )}

          {distribution.rows.length > 0 && (
            <div style={{ overflowX: 'auto' as const }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const, tableLayout: 'fixed' as const }}>
                <colgroup>
                  <col style={{ width: '24%' }} />
                  {QUARTER_KEYS.map(qi => <col key={qi} style={{ width: '8%' }} />)}
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '18%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={thLeft}>Teacher</th>
                    {QUARTER_KEYS.map(qi => (
                      <th key={qi} style={thRight} title={`${QUARTER_LABELS_SHORT[qi]} · ${QUARTER_RANGES[qi]}`}>
                        {QUARTER_LABELS_SHORT[qi]}
                      </th>
                    ))}
                    <th style={thRight}>Weight</th>
                    <th style={thRight}>Share</th>
                    <th style={thRight}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {distribution.rows.map(r => {
                    const partial = r.activeMonths < 12;
                    const calculation = r.quarters
                      .map(q => `${QUARTER_LABELS_SHORT[q.quarterIdx]} ${q.weight.toFixed(2)}`)
                      .join(' + ') + ' = ' + r.weight.toFixed(2);
                    return (
                      <tr key={r.teacherId} className="ab-row" style={{ borderTop: `1px solid ${C.dividerSoft}` }}>
                        <td style={tdLeft}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const }}>
                            <span style={{ width: 9, height: 9, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>{r.name}</span>
                            {r.isOverride && <MiniTag>Override</MiniTag>}
                            {partial && (
                              <MiniTag color={C.brand} bg={C.brandBg}>
                                {r.activeMonths}/12 months
                              </MiniTag>
                            )}
                          </div>
                        </td>
                        {r.quarters.map(q => (
                          <td
                            key={q.quarterIdx}
                            style={{
                              ...tdNumSecondary,
                              color: q.activeMonths > 0
                                ? (q.activeMonths < 3 ? C.brand : C.faint)
                                : C.ghost,
                              fontWeight: q.activeMonths > 0 && q.activeMonths < 3 ? 600 : 400,
                            }}
                            title={q.tooltip}
                          >
                            {q.activeMonths > 0 ? q.weight.toFixed(2) : '–'}
                          </td>
                        ))}
                        <td style={{ ...tdNum, fontWeight: 600, color: C.textSub }} title={calculation}>
                          {r.weight.toFixed(2)}
                        </td>
                        <td style={tdNum}>
                          <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 5 }}>
                            <span style={{ fontWeight: 600, color: C.textSub, fontSize: 13 }}>{(r.share * 100).toFixed(1)}%</span>
                            <div style={{ width: 56, height: 2.5, background: C.divider, borderRadius: 999, overflow: 'hidden' as const }}>
                              <div style={{
                                width: `${Math.min(100, r.share * 100)}%`,
                                height: '100%',
                                background: r.color,
                                borderRadius: 999,
                              }} />
                            </div>
                          </div>
                        </td>
                        <td style={{
                          ...tdNum,
                          fontWeight: 700,
                          fontSize: 14.5,
                          color: amount > 0 ? C.text : C.faint,
                        }}>
                          {amount > 0 ? fmtRM(r.amount) : '–'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: `1px solid ${C.border}`, background: C.surfaceMuted }}>
                    <td style={tdFootLabel}>Total</td>
                    {QUARTER_KEYS.map(qi => {
                      const sum = distribution.rows.reduce((s, r) => {
                        const q = r.quarters.find(x => x.quarterIdx === qi);
                        return s + (q ? q.weight : 0);
                      }, 0);
                      return (
                        <td key={qi} style={{ ...tdFootNum, color: C.muted, fontSize: 12 }}>{sum.toFixed(2)}</td>
                      );
                    })}
                    <td style={{ ...tdFootNum, color: C.textSub }}>{distribution.totalWeight.toFixed(2)}</td>
                    <td style={{ ...tdFootNum, color: C.textSub }}>100.0%</td>
                    <td style={{
                      ...tdFootNum,
                      fontSize: 14.5,
                      color: amount > 0 ? C.text : C.faint,
                    }}>
                      {amount > 0 ? fmtRM(distribution.rows.reduce((s, r) => s + r.amount, 0)) : '–'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Pool Card ──────────────────────────────────────────────────────────
function PoolCard({
  year,
  monthlyPools,
  total,
  forecastTotal,
  expenseTarget,
  annualBonusPct,
}: {
  year: number;
  monthlyPools: MonthlyPool[];
  total: number;
  forecastTotal: number;
  expenseTarget: number;
  annualBonusPct: number;
}) {
  const targetPctNum = expenseTarget * 100;
  const targetPct = `${targetPctNum.toFixed(0)}%`;
  const sharePctNum = annualBonusPct * 100;
  const sharePct = `${sharePctNum.toFixed(sharePctNum % 1 === 0 ? 0 : 1)}%`;

  // Only elapsed (actual) months count toward hit/fail and lost-potential.
  // Forecast months are "pending" — they can't have failed yet.
  const elapsed = monthlyPools.filter(m => !m.isForecast);
  const elapsedCount = elapsed.length;
  const totalCount = monthlyPools.length;
  const hitCount = elapsed.filter(m => m.hit).length;
  const failedCount = elapsed.filter(m => !m.hit && m.ratio !== null).length;
  const pendingCount = totalCount - elapsedCount;

  const elapsedPotential = elapsed.reduce((s, m) => s + m.revenue * annualBonusPct, 0);
  const lostPool = Math.max(0, elapsedPotential - total);
  const lostPct = elapsedPotential > 0 ? (lostPool / elapsedPotential) * 100 : 0;

  const pendingSuffix = pendingCount > 0
    ? ` · ${pendingCount} ${pendingCount === 1 ? 'month' : 'months'} pending`
    : '';

  const insight: React.ReactNode = (() => {
    if (totalCount === 0) return 'No data yet for this year.';
    if (elapsedCount === 0) return 'Year hasn’t started — pool will accrue as months close.';
    if (failedCount === 0) {
      return <>All <strong style={{ color: C.text, fontWeight: 600 }}>{elapsedCount}</strong> elapsed {elapsedCount === 1 ? 'month' : 'months'} met the {targetPct} expense target{pendingSuffix}.</>;
    }
    if (failedCount === elapsedCount) {
      return <>All <strong style={{ color: C.text, fontWeight: 600 }}>{elapsedCount}</strong> elapsed {elapsedCount === 1 ? 'month' : 'months'} exceeded the {targetPct} expense ratio threshold — no pool generated yet{pendingSuffix}.</>;
    }
    return (
      <>
        <strong style={{ color: C.text, fontWeight: 600 }}>{failedCount}</strong> of {elapsedCount} elapsed months failed —
        about <strong style={{ color: C.danger, fontWeight: 600 }}>{lostPct.toFixed(0)}%</strong> of the potential pool was lost
        to the expense ratio breach{pendingSuffix}.
      </>
    );
  })();

  return (
    <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' as const }}>
      {/* ── Hero KPI ────────────────────────────────────────── */}
      <div style={{ padding: `${SP[7]}px ${SP[7]}px ${SP[6]}px` }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: SP[3], marginBottom: SP[3],
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: C.muted,
            textTransform: 'uppercase' as const, letterSpacing: '0.08em',
          }}>
            Annual Bonus Pool · {year} · {sharePct} of qualifying revenue
          </div>
          {totalCount > 0 && <DotIndicator monthlyPools={monthlyPools} />}
        </div>

        <div style={{
          display: 'flex', alignItems: 'baseline', gap: SP[3],
          flexWrap: 'wrap' as const,
          marginBottom: SP[5],
        }}>
          <div style={{
            fontSize: 40, fontWeight: 700,
            color: total > 0 ? C.text : C.faint,
            letterSpacing: '-0.03em', lineHeight: 1.05,
            fontVariantNumeric: 'tabular-nums' as any,
          }}>
            {fmtRM(total)}
          </div>
          {forecastTotal > 0 && (
            <div
              title="Projected contribution from forecast months — not part of the actual pool until those months close."
              style={{
                fontSize: 13, fontWeight: 500,
                color: C.muted, lineHeight: 1.2,
                fontVariantNumeric: 'tabular-nums' as any,
                paddingBottom: 4,
              }}
            >
              <span style={{ color: C.faint }}>+</span>
              <span style={{ marginLeft: 4, color: C.textSub, fontWeight: 600 }}>{fmtRM(forecastTotal)}</span>
              <span style={{ marginLeft: 6, fontSize: 11, color: C.faint, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>forecast</span>
            </div>
          )}
        </div>

        <div style={{
          padding: `${SP[3]}px ${SP[4]}px`,
          background: C.surfaceMuted,
          border: `1px solid ${C.borderSoft}`,
          borderRadius: 10,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <FontAwesomeIcon icon={faCircleInfo} style={{ fontSize: 13, color: C.faint, flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.55, flex: 1, fontWeight: 400 }}>
            {insight}
          </div>
        </div>
      </div>

      {/* ── 12-month status strip ─────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
        borderTop: `1px solid ${C.divider}`,
      }}>
        {monthlyPools.map((m, i) => (
          <MonthCell key={m.monthIdx} m={m} targetPctNum={targetPctNum} hasLeftBorder={i > 0} />
        ))}
      </div>
    </div>
  );
}

// ── Dot indicator ──────────────────────────────────────────────────────
function DotIndicator({ monthlyPools }: { monthlyPools: MonthlyPool[] }) {
  return (
    <div style={{ display: 'inline-flex', gap: 4 }}>
      {monthlyPools.map(m => {
        const color = m.hit
          ? C.successSoft
          : m.isForecast || m.ratio === null
            ? C.ghost
            : C.danger;
        const status = m.hit
          ? 'Met'
          : m.isForecast
            ? 'Pending'
            : m.ratio === null
              ? 'No data'
              : 'Missed';
        return (
          <span
            key={m.monthIdx}
            title={`${MONTH_LABELS[m.monthIdx]} · ${status}`}
            style={{ width: 6, height: 6, borderRadius: '50%', background: color }}
          />
        );
      })}
    </div>
  );
}

// ── Month Cell (compact 12-col strip) ──────────────────────────────────
function MonthCell({
  m,
  targetPctNum,
  hasLeftBorder,
}: {
  m: MonthlyPool;
  targetPctNum: number;
  hasLeftBorder: boolean;
}) {
  const ratioPct = m.ratio === null ? null : m.ratio * 100;
  const ratioLabel = ratioPct === null ? '—' : `${ratioPct.toFixed(0)}%`;
  const hasRatio = ratioPct !== null;
  // State: met (green) | missed (red) | pending forecast (neutral) | no data (neutral)
  const isPending = m.isForecast;
  const isMet = !isPending && m.hit;
  const isMissed = !isPending && hasRatio && !m.hit;
  const accentColor = isMet ? C.success : isMissed ? C.danger : C.ghost;
  const ratioColor = isMet ? C.success : isMissed ? C.danger : C.faint;

  const tooltip = isPending
    ? `${MONTH_LABELS[m.monthIdx]} · Pending\nForecast ratio: ${ratioLabel} (target ≤ ${targetPctNum.toFixed(0)}%)\nProjected contribution: ${fmtRM(m.projectedPool)} (not in pool until month closes)`
    : hasRatio
      ? `${MONTH_LABELS[m.monthIdx]}\nExpense ratio: ${ratioLabel} (target ≤ ${targetPctNum.toFixed(0)}%)\nContribution: ${m.hit ? fmtRM(m.pool) : 'RM 0'}`
      : `${MONTH_LABELS[m.monthIdx]} · No data`;

  return (
    <div
      title={tooltip}
      style={{
        position: 'relative',
        padding: `${SP[3] + 2}px 6px ${SP[3]}px`,
        borderLeft: hasLeftBorder ? `1px solid ${C.divider}` : 'none',
        opacity: isPending ? 0.55 : 1,
        background: isMissed ? C.surfaceFail : C.surface,
        textAlign: 'center' as const,
        minWidth: 0,
      }}
    >
      {/* Top accent stripe */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 2, background: accentColor,
      }} />

      {/* Month label */}
      <div style={{
        fontSize: 10, fontWeight: 700,
        color: C.muted, letterSpacing: '0.06em',
        textTransform: 'uppercase' as const,
        marginBottom: 6,
      }}>
        {MONTH_LABELS_SHORT[m.monthIdx]}
      </div>

      {/* Ratio */}
      <div style={{
        fontSize: 16, fontWeight: 700,
        color: ratioColor,
        fontVariantNumeric: 'tabular-nums' as any,
        letterSpacing: '-0.015em',
        lineHeight: 1.1,
      }}>
        {ratioLabel}
      </div>

      {/* Pool contribution — actual for elapsed, projected for forecast */}
      <div style={{
        marginTop: 6, fontSize: 11, fontWeight: 600,
        color: isMet ? C.success : C.faint,
        fontVariantNumeric: 'tabular-nums' as any,
        fontStyle: isPending && m.projectedPool > 0 ? 'italic' as const : 'normal' as const,
      }}>
        {isMet
          ? fmtRM0(m.pool)
          : isPending && m.projectedPool > 0
            ? `~${fmtRM0(m.projectedPool)}`
            : 'RM 0'}
      </div>
    </div>
  );
}

// ── Mini tag ───────────────────────────────────────────────────────────
function MiniTag({ children, color, bg, title }: { children: React.ReactNode; color?: string; bg?: string; title?: string }) {
  return (
    <span
      title={title}
      style={{
        display: 'inline-block',
        padding: '2px 7px',
        fontSize: 9.5,
        fontWeight: 700,
        borderRadius: 999,
        background: bg ?? C.divider,
        color: color ?? C.muted,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        lineHeight: 1.4,
      }}
    >
      {children}
    </span>
  );
}

// ── Static styles ──────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.borderSoft}`,
  borderRadius: 14,
  padding: SP[6],
  boxShadow: SHADOW_SM,
};

const smallLinkBtn: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: C.brand,
  fontSize: 11,
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
  padding: '2px 4px',
};

const thLeft: React.CSSProperties = {
  textAlign: 'left' as const,
  padding: `${SP[3]}px ${SP[6]}px`,
  fontSize: 11,
  fontWeight: 600,
  color: C.faint,
  background: C.surfaceMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  borderBottom: `1px solid ${C.divider}`,
};
const thRight: React.CSSProperties = { ...thLeft, textAlign: 'right' as const };

const tdLeft: React.CSSProperties = {
  padding: `${SP[4]}px ${SP[6]}px`,
  fontSize: 14,
  color: C.text,
  verticalAlign: 'middle' as const,
};
const tdNum: React.CSSProperties = {
  padding: `${SP[4]}px ${SP[4]}px`,
  fontSize: 13,
  color: C.text,
  verticalAlign: 'middle' as const,
  textAlign: 'right' as const,
  fontVariantNumeric: 'tabular-nums' as any,
};
const tdNumSecondary: React.CSSProperties = {
  ...tdNum,
  fontSize: 12,
  color: C.faint,
};
const tdFootLabel: React.CSSProperties = {
  padding: `${SP[4]}px ${SP[6]}px`,
  fontSize: 11,
  fontWeight: 700,
  color: C.muted,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};
const tdFootNum: React.CSSProperties = {
  padding: `${SP[4]}px ${SP[4]}px`,
  fontSize: 13,
  fontWeight: 700,
  color: C.text,
  textAlign: 'right' as const,
  fontVariantNumeric: 'tabular-nums' as any,
};

const centerEmpty: React.CSSProperties = {
  padding: `${SP[8]}px ${SP[6]}px`,
  textAlign: 'center' as const,
  fontSize: 13,
  color: C.muted,
  margin: 0,
};
