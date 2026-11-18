import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERFORMANCE_STAFF_KEY, fetchPerformanceStaff, startOneOffAppraisal } from '../../api/appraisal-schedules.js';
import { fetchAppraisalTemplates } from '../../api/appraisal-templates.js';
import FormModal from '../../components/common/FormModal.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.js';
import SearchSelect from '../../components/common/SearchSelect.js';
import { MONTH_LABELS } from './appraisalDisplay.js';
import { fitsForm } from './appraisalSchedule.js';
import { ADMIN as p } from './runTheme.js';
import { ApiError } from '../../api/client.js';

/**
 * HRMS → Appraisals → New appraisal: pick someone, then a form meant for their
 * position, and the appraisal is created for the month shown and opened to
 * score. A one-off — no schedule.
 */
export default function NewAppraisalModal({ period, alreadyAppraised, onClose }: {
  period: { year: number; month: number };
  /** Staff who already have an appraisal this month → its form (one per month). */
  alreadyAppraised: Map<string, string>;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [teacherId, setTeacherId] = useState('');
  const [familyId, setFamilyId] = useState('');
  const staff = useQuery({ queryKey: PERFORMANCE_STAFF_KEY, queryFn: fetchPerformanceStaff });
  const forms = useQuery({ queryKey: ['appraisal-templates'], queryFn: fetchAppraisalTemplates });
  const person = (staff.data ?? []).find(s => s.id === teacherId) ?? null;
  // Only live forms meant for their position can be used.
  const fitting = person ? (forms.data ?? []).filter(f => f.status === 'ACTIVE' && fitsForm(person, f.positionIds)).sort((a, b) => a.name.localeCompare(b.name)) : [];
  const start = useMutation({
    mutationFn: () => startOneOffAppraisal({ teacherId, familyId, year: period.year, month: period.month, secondAnyway: !!hasOne }),
    // The lists that show it (this month's appraisals, the schedule's created ones) refresh, so it's there on the way back.
    onSuccess: r => {
      qc.invalidateQueries({ queryKey: ['appraisal-overview'] });
      qc.invalidateQueries({ queryKey: ['appraisal-schedules'] });
      navigate(`/appraisals/${r.id}`);
    },
  });
  const hasOne = person ? alreadyAppraised.get(person.id) ?? null : null;
  /** Refused because this one already exists: which, so it can be opened. */
  const existingId = start.error instanceof ApiError && typeof start.error.body?.existingId === 'string' ? start.error.body.existingId : null;
  const problem = !teacherId ? 'Pick a staff member.' : !familyId ? 'Pick an appraisal form.' : null;

  return (
    <FormModal title="New appraisal" subtitle={`For ${MONTH_LABELS[period.month]} ${period.year}. It opens straight away.`} onClose={onClose} width={480}
      primary={{ label: hasOne ? 'Start anyway' : 'Start appraisal', onClick: () => start.mutate(), busy: start.isPending, disabled: !!problem, hint: problem ?? undefined }}>
      {staff.isPending || forms.isPending ? <LoadingSpinner inline /> : (
        <>
          <label htmlFor="na-staff" style={lbl}>Staff member</label>
          {/* Staff and forms can be many — type to find them. */}
          <SearchSelect id="na-staff" value={teacherId} onChange={v => { setTeacherId(v); setFamilyId(''); }} placeholder="Search staff…"
            options={(staff.data ?? []).map(s => ({ value: s.id, label: s.name, hint: s.positionName ?? undefined }))} noMatches="No one matches." />
          {(staff.data ?? []).length === 0 && <p style={note}>Nobody reports to you, so there’s no one to appraise.</p>}
          {person && hasOne && (
            <p role="alert" style={{ ...note, color: p.amber }}>
              {person.name} already has an appraisal for {MONTH_LABELS[period.month]} {period.year} ({hasOne}). You can still start another — the month’s score will be the average of the two.
            </p>
          )}

          <label htmlFor="na-form" style={{ ...lbl, marginTop: 16 }}>Appraisal form</label>
          <SearchSelect id="na-form" value={familyId} onChange={setFamilyId} disabled={!person || fitting.length === 0}
            placeholder={person ? 'Search appraisal forms…' : 'Pick someone first'}
            options={fitting.map(f => ({ value: f.familyId, label: f.name }))} noMatches="No form matches." />
          {person && fitting.length === 0 && (
            <p style={note}>No live form is for {person.positionName ?? 'their position'} — set one’s “Who it’s for” in Settings → Appraisal forms.</p>
          )}
          {start.error && (
            <p role="alert" style={{ margin: '8px 0 0', color: p.red, fontSize: 14 }}>
              {(start.error as Error).message}
              {existingId && <> <Link to={`/appraisals/${existingId}`} onClick={() => { qc.invalidateQueries({ queryKey: ['appraisal-overview'] }); }} style={{ color: p.accent, fontWeight: 600 }}>Open it</Link></>}
            </p>
          )}
        </>
      )}
    </FormModal>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: p.sub, marginBottom: 4 };
const note: React.CSSProperties = { fontSize: 13, color: p.muted, margin: '6px 0 0', lineHeight: 1.5 };
