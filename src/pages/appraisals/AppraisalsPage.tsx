import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faClipboardCheck, faMagnifyingGlass, faPen, faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { fetchAppraisalOverview, type AppraisalOverviewRow } from '../../api/teacher-appraisals.js';
import { getAvatarColor, getInitials } from '../../components/onboarding/avatar.js';
import { toolbarCard } from '../../components/onboarding/filterStyles.js';
import { useToast } from '../../components/common/Toast.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { AppraisalFormModal } from './AppraisalFormModal.js';
import {
  ALL_POSITIONS, MONTH_LABELS, NO_POSITION, appraisalYearOptions, matchesName, matchesPosition, positionOptions, scoreColors, selectableMonths,
} from './appraisalDisplay.js';

// HR → Team → Appraisals: pick a month, see every current staff member in two
// groups — Pending (not appraised yet) and Done (with their score) — so HR can
// work through the month. Each person also shows their 12-month average.

function thisMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

export default function AppraisalsPage() {
  const { isMobile } = useIsMobile();
  const { showToast } = useToast();
  const now = thisMonth();
  const [period, setPeriod] = useState(now);
  const [editing, setEditing] = useState<AppraisalOverviewRow | null>(null);
  const [position, setPosition] = useState(ALL_POSITIONS);
  const [search, setSearch] = useState('');

  const { data, isPending, isError } = useQuery({
    queryKey: ['appraisal-overview', period.year, period.month],
    queryFn: () => fetchAppraisalOverview(period.year, period.month),
  });
  const atThisMonth = period.year === now.year && period.month === now.month;
  const allStaff = data?.staff ?? [];
  const positions = positionOptions(allStaff);
  const staff = allStaff.filter(r => matchesPosition(r, position));
  const pending = staff.filter(r => !r.appraisal);
  const done = staff.filter(r => r.appraisal);
  // The search narrows the lists only — progress still counts everyone in the position.
  const searching = search.trim() !== '';
  const shownPending = pending.filter(r => matchesName(r, search));
  const shownDone = done.filter(r => matchesName(r, search));

  const changeYear = (year: number) => {
    // Keep the month if that year has it; otherwise jump to the year's last available month.
    const months = selectableMonths(year, now);
    setPeriod({ year, month: months.includes(period.month) ? period.month : months[months.length - 1] });
  };

  return (
    <div style={{ padding: isMobile ? '16px 12px' : '28px 32px', fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ maxWidth: isMobile ? '100%' : 860, margin: '0 auto' }}>

        {/* ── Top bar: title + month / year pickers ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isMobile ? 14 : 20, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#0f172a' }}>Appraisals</h1>
          <div style={{ flex: 1 }} />
          <select aria-label="Position" value={position} onChange={e => setPosition(e.target.value)} style={s.select}>
            <option value={ALL_POSITIONS}>All positions</option>
            {positions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            {/* Keep a chosen position selectable even in a month where nobody holds it. */}
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
          <button
            type="button"
            className="ap-this-month"
            onClick={() => setPeriod(now)}
            disabled={atThisMonth}
            style={s.thisMonthBtn(atThisMonth)}
          >
            This month
          </button>
        </div>

        {/* ── Search + progress ── */}
        {!isPending && !isError && staff.length > 0 && (
          <div style={toolbarCard}>
            <SearchBox value={search} onChange={setSearch} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
              <div style={{ flex: 1, height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round((done.length / staff.length) * 100)}%`, background: pending.length === 0 ? '#10b981' : '#5a67d8', borderRadius: 4, transition: 'width 0.3s ease' }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
                {done.length} of {staff.length} done
              </span>
            </div>
          </div>
        )}

        {isPending && <p style={{ color: '#64748b', fontSize: 14, textAlign: 'center', padding: 24 }}>Loading…</p>}
        {isError && <p style={{ color: '#dc2626', fontSize: 14, textAlign: 'center', padding: 24 }}>Could not load appraisals. Please refresh.</p>}

        {!isPending && !isError && staff.length === 0 && (
          <div style={{ padding: '48px 20px', textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <FontAwesomeIcon icon={faClipboardCheck} style={{ fontSize: 28, color: '#64748b', marginBottom: 10 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
              {allStaff.length > 0 ? 'No staff in this position for' : 'No staff for'} {MONTH_LABELS[period.month]} {period.year}
            </div>
          </div>
        )}

        {staff.length > 0 && searching && shownPending.length + shownDone.length === 0 && (
          <div style={{ ...s.noneYet, marginTop: 18 }}>No staff match “{search.trim()}”.</div>
        )}

        {staff.length > 0 && !(searching && shownPending.length + shownDone.length === 0) && (
          <>
            <GroupHeading label="Pending" count={shownPending.length} color="#b45309" />
            {shownPending.length > 0 ? (
              <div style={s.list}>{shownPending.map(r => <StaffAppraisalCard key={r.teacherId} row={r} onRecord={() => setEditing(r)} />)}</div>
            ) : searching ? (
              <div style={s.noneYet}>No pending staff match your search.</div>
            ) : (
              <div style={s.allDone}><FontAwesomeIcon icon={faCheck} /> Everyone has been appraised for {MONTH_LABELS[period.month]} {period.year}.</div>
            )}

            <GroupHeading label="Done" count={shownDone.length} color="#047857" />
            {shownDone.length > 0 ? (
              <div style={s.list}>{shownDone.map(r => <StaffAppraisalCard key={r.teacherId} row={r} onRecord={() => setEditing(r)} />)}</div>
            ) : (
              <div style={s.noneYet}>
                {searching ? 'No appraised staff match your search.' : `Nobody appraised yet for ${MONTH_LABELS[period.month]} ${period.year}.`}
              </div>
            )}
          </>
        )}
      </div>

      {editing && (
        <AppraisalFormModal
          teacherId={editing.teacherId}
          name={editing.name}
          year={period.year}
          month={period.month}
          existing={editing.appraisal}
          previous={editing.previous}
          twelveMonthAverage={editing.twelveMonth.average}
          onClose={() => setEditing(null)}
          onSaved={() => {
            showToast('Appraisal saved');
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ position: 'relative' }}>
      <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#64748b', pointerEvents: 'none' }} />
      <input
        type="search"
        aria-label="Search by name"
        placeholder="Search by name…"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') onChange(''); }}
        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 34px 9px 34px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, fontFamily: 'inherit', color: '#0f172a', outline: 'none', background: '#fff' }}
      />
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

function GroupHeading({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '18px 2px 8px' }}>
      <span style={{ fontSize: 11, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 10, background: `${color}14`, color }}>{count}</span>
    </div>
  );
}

function StaffAppraisalCard({ row, onRecord }: { row: AppraisalOverviewRow; onRecord: () => void }) {
  const avatar = getAvatarColor(row.name);
  const avg = row.twelveMonth.average;
  return (
    <div className="m-wrap" style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '14px 16px' }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: avatar.bg, color: avatar.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
        {getInitials(row.name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link to={`/teachers/${row.teacherId}/appraisal`} style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', textDecoration: 'none' }}>{row.name}</Link>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
          {row.positionName ?? 'No position'} · 12-month average{' '}
          <strong style={{ color: avg != null ? scoreColors(avg).color : '#94a3b8' }}>{avg != null ? `${avg}%` : '—'}</strong>
          {row.previous && !row.appraisal && (
            <> · Previous <strong style={{ color: scoreColors(row.previous.score).color }}>{Math.round(row.previous.score)}%</strong> ({MONTH_LABELS[row.previous.month]} {row.previous.year})</>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {row.appraisal && (
          <span title={row.appraisal.evaluatedBy ? `By ${row.appraisal.evaluatedBy}` : undefined} style={{ ...s.pill, background: scoreColors(row.appraisal.score).bg, color: scoreColors(row.appraisal.score).color }}>
            {Math.round(row.appraisal.score)}%
          </span>
        )}
        <button type="button" onClick={onRecord} style={row.appraisal ? s.editBtn : s.recordBtn}>
          <FontAwesomeIcon icon={row.appraisal ? faPen : faPlus} style={{ fontSize: 11 }} /> {row.appraisal ? 'Edit' : 'Record'}
        </button>
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
    color: current ? '#94a3b8' : '#5a67d8', cursor: current ? 'default' : 'pointer',
  }),
  list: { display: 'flex', flexDirection: 'column', gap: 8 } as React.CSSProperties,
  allDone: { padding: '12px 14px', borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 } as React.CSSProperties,
  noneYet: { padding: '12px 14px', borderRadius: 12, background: '#fff', border: '1px dashed #e2e8f0', color: '#64748b', fontSize: 13 } as React.CSSProperties,
  pill: { minWidth: 52, textAlign: 'center', padding: '5px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700 } as React.CSSProperties,
  recordBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', background: '#5a67d8', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  editBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
};
