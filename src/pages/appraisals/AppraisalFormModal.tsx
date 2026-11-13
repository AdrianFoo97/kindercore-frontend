import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { fetchAppraisalOverview, upsertTeacherAppraisal, type TeacherAppraisal } from '../../api/teacher-appraisals.js';
import { MONTH_LABELS, appraisalYearOptions, scoreColors, selectableMonths } from './appraisalDisplay.js';

// Record or edit one staff member's appraisal — the one pop-up used by
// HR → Appraisals and the staff record's Appraisals tab. Shows their previous
// mark and 12-month average for comparison; when a caller doesn't already have
// those (the staff record), the pop-up looks them up for the month itself.

const MIN_SCORE = 0;
const MAX_SCORE = 100;

type PreviousMark = { year: number; month: number; score: number } | null;

function thisMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

export function AppraisalFormModal({
  teacherId, name, year, month, existing, previous, twelveMonthAverage, canChangeMonth = false, onClose, onSaved,
}: {
  teacherId: string;
  /** Shown in the subtitle; looked up when omitted. */
  name?: string;
  year: number;
  month: number;
  /** The appraisal being edited, or null to record a new one. */
  existing: TeacherAppraisal | null;
  /** Their latest appraisal before this month — looked up when omitted. */
  previous?: PreviousMark;
  /** Their 12-month average up to this month — looked up when omitted. */
  twelveMonthAverage?: number | null;
  /** Let the user pick which month to record (staff record → Record appraisal). */
  canChangeMonth?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const now = thisMonth();
  const [period, setPeriod] = useState({ year, month });
  const [score, setScore] = useState(existing ? String(existing.score) : '');
  const [evaluatedBy, setEvaluatedBy] = useState(existing?.evaluatedBy ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Look up this person's row for the chosen month when the caller didn't
  // hand us the context (same data and cache as HR → Appraisals).
  const needsLookup = canChangeMonth || previous === undefined || twelveMonthAverage === undefined || name === undefined;
  const { data: overview } = useQuery({
    queryKey: ['appraisal-overview', period.year, period.month],
    queryFn: () => fetchAppraisalOverview(period.year, period.month),
    enabled: needsLookup,
  });
  const row = overview?.staff.find(r => r.teacherId === teacherId);
  const shownName = name ?? row?.name ?? '';
  const shownPrevious: PreviousMark = previous !== undefined && !canChangeMonth ? previous : row?.previous ?? null;
  const shownAverage = twelveMonthAverage !== undefined && !canChangeMonth ? twelveMonthAverage : row?.twelveMonth.average ?? null;
  // Recording a new month that already has a score: saving replaces it.
  const alreadyRecorded = !existing && canChangeMonth ? row?.appraisal ?? null : null;

  const changeYear = (y: number) => {
    const months = selectableMonths(y, now);
    setPeriod(p => ({ year: y, month: months.includes(p.month) ? p.month : months[months.length - 1] }));
  };

  const save = async () => {
    const value = parseFloat(score);
    if (Number.isNaN(value) || value < MIN_SCORE || value > MAX_SCORE) {
      setError(`Score must be between ${MIN_SCORE} and ${MAX_SCORE}.`);
      return;
    }
    setSaving(true); setError('');
    try {
      await upsertTeacherAppraisal(teacherId, { year: period.year, month: period.month, score: value, evaluatedBy: evaluatedBy.trim() || null, notes: notes.trim() || null });
      qc.invalidateQueries({ queryKey: ['appraisal-overview'] });
      qc.invalidateQueries({ queryKey: ['teacher-appraisals', teacherId] });
      qc.invalidateQueries({ queryKey: ['teacher-career', teacherId] });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    // No click-outside close — a half-typed appraisal is easy to lose.
    <div style={s.backdrop}>
      <div role="dialog" aria-label={`Appraisal${shownName ? ` for ${shownName}` : ''}`} style={s.card}>
        <div style={s.header}>
          <div>
            <h2 style={s.title}>{existing ? 'Edit appraisal' : 'Record appraisal'}</h2>
            <p style={s.sub}>{[shownName, canChangeMonth ? null : `${MONTH_LABELS[period.month]} ${period.year}`].filter(Boolean).join(' · ')}</p>
          </div>
          <button type="button" onClick={onClose} style={s.close} aria-label="Close" title="Close"><FontAwesomeIcon icon={faXmark} /></button>
        </div>

        {canChangeMonth && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <label style={{ flex: 1 }}>
              <span style={s.label}>Month</span>
              <select value={period.month} onChange={e => setPeriod(p => ({ ...p, month: Number(e.target.value) }))} style={s.input}>
                {selectableMonths(period.year, now).map(m => <option key={m} value={m}>{MONTH_LABELS[m]}</option>)}
              </select>
            </label>
            <label style={{ flex: 1 }}>
              <span style={s.label}>Year</span>
              <select value={period.year} onChange={e => changeYear(Number(e.target.value))} style={s.input}>
                {appraisalYearOptions(now).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>
        )}

        {/* For comparison while scoring: last time, and the 12-month trend. */}
        <div style={s.context}>
          <Stat
            label="Previous mark"
            value={shownPrevious ? `${Math.round(shownPrevious.score)}%` : '—'}
            note={shownPrevious ? `${MONTH_LABELS[shownPrevious.month]} ${shownPrevious.year}` : 'None recorded'}
            color={shownPrevious ? scoreColors(shownPrevious.score).color : undefined}
          />
          <Stat
            label="12-month average"
            value={shownAverage != null ? `${shownAverage}%` : '—'}
            note={shownAverage != null ? 'Up to this month' : 'No appraisals yet'}
            color={shownAverage != null ? scoreColors(shownAverage).color : undefined}
          />
        </div>

        {alreadyRecorded && (
          <div style={s.warn}>
            {MONTH_LABELS[period.month]} {period.year} already has an appraisal ({Math.round(alreadyRecorded.score)}%). Saving will replace it.
          </div>
        )}

        <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, marginBottom: 12 }}>
          <label>
            <span style={s.label}>Score (0–100)</span>
            <input type="number" min={MIN_SCORE} max={MAX_SCORE} step={1} value={score} onChange={e => setScore(e.target.value)} placeholder="e.g. 78" style={s.input} autoFocus />
          </label>
          <label>
            <span style={s.label}>Evaluator (optional)</span>
            <input value={evaluatedBy} onChange={e => setEvaluatedBy(e.target.value)} placeholder="e.g. Principal Tan" style={s.input} />
          </label>
        </div>
        <label>
          <span style={s.label}>Notes (optional)</span>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Strengths, areas for growth, next-month focus…" style={{ ...s.input, minHeight: 72, resize: 'vertical' }} />
        </label>

        {error && <div role="alert" style={s.error}>{error}</div>}
        <div style={s.footer}>
          <button type="button" onClick={onClose} style={s.cancel}>Cancel</button>
          <button type="button" onClick={save} disabled={saving || !score.trim()} style={s.save(saving || !score.trim())}>
            {saving ? 'Saving…' : existing ? 'Save changes' : alreadyRecorded ? 'Replace appraisal' : 'Record appraisal'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, note, color }: { label: string; value: string; note: string; color?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color ?? '#94a3b8', lineHeight: 1.2, marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748b' }}>{note}</div>
    </div>
  );
}

const s = {
  context: { display: 'flex', gap: 16, padding: '12px 14px', marginBottom: 16, borderRadius: 12, background: '#f8fafc', border: '1px solid #eef0f4' } as React.CSSProperties,
  warn: { padding: '8px 12px', marginBottom: 12, borderRadius: 8, background: '#fef9c3', color: '#854d0e', fontSize: 12, fontWeight: 500 } as React.CSSProperties,
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 } as React.CSSProperties,
  card: { background: '#fff', borderRadius: 16, padding: '24px 26px', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' } as React.CSSProperties,
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 } as React.CSSProperties,
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' } as React.CSSProperties,
  sub: { margin: '4px 0 0', fontSize: 13, color: '#64748b' } as React.CSSProperties,
  close: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#64748b', padding: 4 } as React.CSSProperties,
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 } as React.CSSProperties,
  input: { width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid #e2e8f0', borderRadius: 8, boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' } as React.CSSProperties,
  error: { marginTop: 12, padding: '8px 10px', borderRadius: 8, background: '#fef2f2', color: '#dc2626', fontSize: 13 } as React.CSSProperties,
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18, flexWrap: 'wrap' } as React.CSSProperties,
  cancel: { padding: '9px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  save: (disabled: boolean): React.CSSProperties => ({
    padding: '9px 18px', borderRadius: 8, border: 'none', background: '#5a67d8', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1,
  }),
};
