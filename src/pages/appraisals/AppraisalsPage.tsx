import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClipboardCheck, faMagnifyingGlass, faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { fetchAppraisalOverview } from '../../api/teacher-appraisals.js';
import { cancelAppraisal } from '../../api/appraisal-runs.js';
import ConfirmDialog from '../../components/common/ConfirmDialog.js';
import NewAppraisalModal from './NewAppraisalModal.js';
import { getAvatarColor, getInitials } from '../../components/onboarding/avatar.js';
import SegmentedControl from '../../components/common/SegmentedControl.js';
import { useToast } from '../../components/common/Toast.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { AppraisalFormModal } from './AppraisalFormModal.js';
import {
  ALL_POSITIONS, MONTH_LABELS, NO_POSITION, appraisalYearOptions, matchesName, matchesPosition, positionOptions, selectableMonths,
} from './appraisalDisplay.js';
import { APPRAISAL_TABS, actionLabel, appraisedInMonth, inProgressNote, appraisalItems, inTab, initialView, tabCounts, type AppraisalItem, type AppraisalTab } from './appraisalsList.js';
import { periodLabel } from './appraisalRun.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.js';
import { useScoreBand } from './useScoreBand.js';
import type { Band } from './scoreBands.js';

// HRMS → Performance Management → Appraisals: for a month, every appraisal the
// appraisal schedule created, by step — Pending (not started), In progress (a
// draft), Sign-off, Staff to confirm, Done — plus months recorded by hand. "Start" opens the appraisal to score it. Each line shows
// the person's quarter and year averages so far and their previous score.

function thisMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

export default function AppraisalsPage() {
  const { isMobile } = useIsMobile();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const now = thisMonth();
  const [search0] = useSearchParams();
  // Opened after saving or submitting one: straight to its month and the tab it's now on.
  const [start] = useState(() => initialView(search0, now));
  const [period, setPeriod] = useState(start.period);
  const [editing, setEditing] = useState<AppraisalItem | null>(null);
  const [position, setPosition] = useState(ALL_POSITIONS);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<AppraisalTab>(start.tab);
  const [adding, setAdding] = useState(false);
  const [cancelling, setCancelling] = useState<AppraisalItem | null>(null);
  const queryClient = useQueryClient();
  const cancel = useMutation({
    mutationFn: (id: string) => cancelAppraisal(id),
    onSuccess: () => {
      showToast('Appraisal cancelled');
      setCancelling(null);
      queryClient.invalidateQueries({ queryKey: ['appraisal-overview'] });
    },
  });

  const { data, isPending, isError } = useQuery({
    queryKey: ['appraisal-overview', period.year, period.month],
    queryFn: () => fetchAppraisalOverview(period.year, period.month),
  });
  const atThisMonth = period.year === now.year && period.month === now.month;
  const allStaff = data?.staff ?? [];
  const positions = positionOptions(allStaff);
  const items = appraisalItems(allStaff.filter(r => matchesPosition(r, position)));
  const counts = tabCounts(items);
  const shown = items.filter(i => inTab(i, tab) && matchesName(i.row, search));

  const changeYear = (year: number) => {
    // Keep the month if that year has it; otherwise jump to the year's last available month.
    const months = selectableMonths(year, now);
    setPeriod({ year, month: months.includes(period.month) ? period.month : months[months.length - 1] });
  };
  const open = (item: AppraisalItem) => (item.run ? navigate(`/appraisals/${item.run.id}`) : setEditing(item));

  return (
    <div style={{ padding: isMobile ? '16px 12px' : '28px 32px', fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ maxWidth: isMobile ? '100%' : 860, margin: '0 auto' }}>

        {/* ── Top bar: title + position / month / year ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#0f172a' }}>Appraisals</h1>
          <div style={{ flex: 1 }} />
          <select aria-label="Position" value={position} onChange={e => setPosition(e.target.value)} style={s.select}>
            <option value={ALL_POSITIONS}>All positions</option>
            {positions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            {position !== ALL_POSITIONS && !positions.some(p => p.value === position) && (
              <option value={position}>{position === NO_POSITION ? 'No position' : position}</option>
            )}
          </select>
          <select aria-label="Month" value={period.month} onChange={e => setPeriod(p => ({ ...p, month: Number(e.target.value) }))} style={s.select}>
            {selectableMonths(period.year, now).map(m => <option key={m} value={m}>{MONTH_LABELS[m]}</option>)}
          </select>
          <select aria-label="Year" value={period.year} onChange={e => changeYear(Number(e.target.value))} style={s.select}>
            {appraisalYearOptions(now).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button type="button" onClick={() => setPeriod(now)} disabled={atThisMonth} style={s.thisMonthBtn(atThisMonth)}>This month</button>
          <button type="button" onClick={() => setAdding(true)} style={s.primaryBtn}>
            <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />New appraisal
          </button>
        </div>

        {isPending && <p style={{ textAlign: 'center', padding: 24 }}><LoadingSpinner /></p>}
        {isError && <p role="alert" style={{ color: '#dc2626', fontSize: 14, textAlign: 'center', padding: 24 }}>Could not load appraisals. Please refresh.</p>}

        {!isPending && !isError && items.length === 0 && (
          <div style={s.empty}>
            <FontAwesomeIcon icon={faClipboardCheck} style={{ fontSize: 28, color: '#64748b', marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>No appraisals for {MONTH_LABELS[period.month]} {period.year}</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              Appraisals appear here once the <Link to="/hr/appraisal-schedule" style={{ color: '#5a67d8', fontWeight: 600 }}>appraisal schedule</Link> creates them — or start one now with New appraisal.
            </div>
          </div>
        )}

        {items.length > 0 && (
          <>
            {/* Six steps don't fit side by side on a phone — the bar scrolls sideways there instead of squashing them. */}
            <div style={{ marginBottom: 12, overflowX: 'auto' }}>
              <div style={{ minWidth: isMobile ? 640 : undefined }}>
              <SegmentedControl<AppraisalTab> ariaLabel="Status" accent="#5a67d8" value={tab} onChange={setTab}
                segments={APPRAISAL_TABS.map(t => ({ key: t.key, label: `${t.label} ${counts[t.key]}` }))} />
              </div>
            </div>
            <SearchBox value={search} onChange={setSearch} />
            {shown.length === 0 ? (
              <div style={s.noneYet}>{search.trim() ? `No one matches “${search.trim()}”.` : `Nothing ${tab === 'ALL' ? '' : APPRAISAL_TABS.find(t => t.key === tab)!.label.toLowerCase()} for ${MONTH_LABELS[period.month]} ${period.year}.`}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {shown.map(item => <AppraisalLine key={item.key} item={item} month={period.month} onOpen={() => open(item)} onCancel={() => setCancelling(item)} />)}
              </div>
            )}
          </>
        )}
      </div>

      {adding && <NewAppraisalModal period={period} alreadyAppraised={appraisedInMonth(allStaff, period)} onClose={() => setAdding(false)} />}

      {cancelling?.run && (
        <ConfirmDialog destructive title="Cancel this appraisal?" confirmLabel="Cancel appraisal" cancelLabel="Keep it"
          message={`${cancelling.row.name}’s ${cancelling.run.formName} for ${MONTH_LABELS[cancelling.run.period.month]} ${cancelling.run.period.year} — and any scores already given — will be removed. Their schedule, if any, carries on.`}
          loading={cancel.isPending}
          onConfirm={() => cancel.mutate(cancelling.run!.id)}
          onCancel={() => { cancel.reset(); setCancelling(null); }} />
      )}
      {cancel.error && <p role="alert" style={{ position: 'fixed', bottom: 16, left: 16, right: 16, textAlign: 'center', color: '#b91c1c', fontSize: 14 }}>{(cancel.error as Error).message}</p>}

      {editing?.manual && (
        <AppraisalFormModal
          teacherId={editing.row.teacherId}
          name={editing.row.name}
          year={period.year}
          month={period.month}
          existing={editing.manual}
          previous={editing.row.previous}
          twelveMonthAverage={editing.row.twelveMonth.average}
          onClose={() => setEditing(null)}
          onSaved={() => { showToast('Appraisal saved'); setEditing(null); }}
        />
      )}
    </div>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ position: 'relative' }}>
      <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#64748b', pointerEvents: 'none' }} />
      <input type="search" aria-label="Search by name" placeholder="Search by name…" value={value}
        onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') onChange(''); }}
        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 34px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, fontFamily: 'inherit', color: '#0f172a', outline: 'none', background: '#fff' }} />
      {value && (
        <button type="button" aria-label="Clear search" title="Clear search" onClick={() => onChange('')} style={{
          position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 24, height: 24, borderRadius: 6,
          border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <FontAwesomeIcon icon={faXmark} style={{ fontSize: 12 }} />
        </button>
      )}
    </div>
  );
}

const MONTHS_PER_QUARTER = 3;

/** The scores of the quarter the month shown falls in (from the year's scores, which stop at that month). */
function quarterScores(yearScores: { month: number; score: number }[], month: number) {
  const start = month - (month % MONTHS_PER_QUARTER);
  return yearScores.filter(s => s.month >= start);
}

/**
 * "Quarter 79%" — hover, focus or tap it to see the months it's made of.
 * A tooltip rather than more text on every line, which is already busy.
 */
function Breakdown({ label, average, scores }: { label: string; average: number | null; scores: { month: number; score: number }[] }) {
  const [open, setOpen] = useState(false);
  const bandOf = useScoreBand();
  const id = `bd-${label}-${scores.map(s => s.month).join('-')}`;
  if (average == null) return <span>{label} —</span>;
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-describedby={open ? id : undefined} aria-expanded={open}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(o => !o)}
        style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
        {label} {pct(average, bandOf)}
      </button>
      {open && (
        <span role="tooltip" id={id} style={{
          position: 'absolute', left: 0, top: '100%', marginTop: 6, zIndex: 5, minWidth: 140, padding: '8px 12px', borderRadius: 8,
          background: '#0f172a', color: '#fff', fontSize: 12, lineHeight: 1.6, boxShadow: '0 4px 12px rgba(15,23,42,0.18)', whiteSpace: 'nowrap',
        }}>
          {scores.map(s => (
            <span key={s.month} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <span>{MONTH_LABELS[s.month]}</span><strong>{Math.round(s.score)}%</strong>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

const pct = (n: number | null, bandOf: (score: number) => Band) => (n != null ? <strong style={{ color: bandOf(n).color }}>{Math.round(n)}%</strong> : <span>—</span>);

/** One appraisal: who, which form and period, their averages so far, where it is, and Start / Continue / View. */
function AppraisalLine({ item, month, onOpen, onCancel }: { item: AppraisalItem; month: number; onOpen: () => void; onCancel: () => void }) {
  const { row, run, manual } = item;
  const bandOf = useScoreBand();
  const avatar = getAvatarColor(row.name);
  const score = run?.totalScore ?? manual?.score ?? null;
  const verb = actionLabel(item);
  const what = run ? `${run.formName} · ${periodLabel(run.periodType, run.period)}` : 'Recorded by hand';
  return (
    <div className="m-wrap" style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '14px 16px' }}>
      <div aria-hidden style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: avatar.bg, color: avatar.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
        {getInitials(row.name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link to={`/teachers/${row.teacherId}/appraisal`} style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', textDecoration: 'none' }}>{row.name}</Link>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{row.positionName ?? 'No position'} · {what}</div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
          <Breakdown label="Quarter" average={row.averages.quarter} scores={quarterScores(row.yearScores, month)} />
          {' · '}
          <Breakdown label="Year" average={row.averages.year} scores={row.yearScores} />
          {row.previous && <> · Previous {pct(row.previous.score, bandOf)} ({MONTH_LABELS[row.previous.month]} {row.previous.year})</>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {item.stage === 'DONE' && score != null && (
          <span title={bandOf(score).label} style={{ ...s.pill, background: bandOf(score).bg, color: bandOf(score).color }}>{Math.round(score)}% · {bandOf(score).label}</span>
        )}
        {item.stage === 'IN_PROGRESS' && run && <span style={s.status}>{inProgressNote(run.status)}</span>}
        {/* Only an unfinished appraisal can be cancelled; a done one is part of their record. */}
        {run && item.stage !== 'DONE' && <button type="button" onClick={onCancel} style={s.cancelBtn}>Cancel</button>}
        <button type="button" onClick={onOpen} style={verb === 'Start' ? s.primaryBtn : s.secondaryBtn}>{verb}</button>
      </div>
    </div>
  );
}

const s = {
  select: { padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, fontWeight: 600, color: '#374151', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  // Jump back to the current month — greyed out when you're already on it.
  thisMonthBtn: (current: boolean): React.CSSProperties => ({
    padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
    border: `1px solid ${current ? '#e2e8f0' : '#c7d2fe'}`, background: current ? '#f8fafc' : '#eef2ff',
    color: current ? '#64748b' : '#5a67d8', cursor: current ? 'default' : 'pointer',
  }),
  empty: { padding: '48px 20px', textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' } as React.CSSProperties,
  noneYet: { marginTop: 12, padding: '12px 14px', borderRadius: 12, background: '#fff', border: '1px dashed #e2e8f0', color: '#64748b', fontSize: 13 } as React.CSSProperties,
  pill: { minWidth: 52, textAlign: 'center', padding: '5px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700 } as React.CSSProperties,
  status: { padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: '#b45309', background: '#fffbeb' } as React.CSSProperties,
  primaryBtn: { minWidth: 84, padding: '8px 14px', borderRadius: 8, border: 'none', background: '#5a67d8', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  cancelBtn: { padding: '8px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  secondaryBtn: { minWidth: 84, padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
};
