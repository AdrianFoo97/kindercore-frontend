import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERFORMANCE_STAFF_KEY, fetchPerformanceStaff, startOneOffAppraisal, type PerformanceStaff } from '../../api/appraisal-schedules.js';
import { fetchAppraisalTemplates } from '../../api/appraisal-templates.js';
import FormModal from '../../components/common/FormModal.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.js';
import SearchSelect from '../../components/common/SearchSelect.js';
import { useToast } from '../../components/common/Toast.js';
import { MONTH_LABELS } from './appraisalDisplay.js';
import { bulkSummary, formsForAll, runEach } from './appraisalBulk.js';
import StaffMultiSelect from './StaffMultiSelect.js';
import { ADMIN as p } from './runTheme.js';
import { ApiError } from '../../api/client.js';

/**
 * HRMS → Appraisals → New appraisal: pick one or several people, then a form
 * meant for all their positions, and an appraisal is created for each for the
 * month shown. One person: it opens straight away to score. Several: they're
 * all created and listed. A one-off — no schedule.
 */
export default function NewAppraisalModal({ period, alreadyAppraised, onClose }: {
  period: { year: number; month: number };
  /** Staff who already have an appraisal this month → its form (one per month). */
  alreadyAppraised: Map<string, string>;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [teacherIds, setTeacherIds] = useState<string[]>([]);
  const [familyId, setFamilyId] = useState('');
  const [failures, setFailures] = useState<{ name: string; message: string; existingId: string | null }[]>([]);
  const staff = useQuery({ queryKey: PERFORMANCE_STAFF_KEY, queryFn: fetchPerformanceStaff });
  const forms = useQuery({ queryKey: ['appraisal-templates'], queryFn: fetchAppraisalTemplates });
  const people = (staff.data ?? []).filter(s => teacherIds.includes(s.id));
  // Only live forms meant for every picked person's position can be used.
  const fitting = formsForAll(forms.data ?? [], people).sort((a, b) => a.name.localeCompare(b.name));
  const withOne = people.filter(s => alreadyAppraised.has(s.id));
  const monthLabel = `${MONTH_LABELS[period.month]} ${period.year}`;

  const start = useMutation({
    mutationFn: () => runEach<PerformanceStaff>(people, async s => (await startOneOffAppraisal({
      teacherId: s.id, familyId, year: period.year, month: period.month, secondAnyway: alreadyAppraised.has(s.id),
    })).id),
    // The lists that show them (this month's appraisals, the schedule's created ones) refresh, so they're there on the way back.
    onSuccess: ({ done, failed }) => {
      qc.invalidateQueries({ queryKey: ['appraisal-overview'] });
      qc.invalidateQueries({ queryKey: ['appraisal-schedules'] });
      if (people.length === 1 && done.length === 1) { navigate(`/appraisals/${done[0].id}`); return; }
      if (done.length) showToast(bulkSummary('Started', done.length, failed.length), failed.length ? 'error' : 'success');
      if (!failed.length) { onClose(); return; }
      // Keep the pop-up open on the ones that didn't start, with why.
      setFailures(failed.map(f => ({ name: f.item.name, message: f.message, existingId: errorExistingId(f) })));
      setTeacherIds(failed.map(f => f.item.id));
    },
  });

  const problem = !teacherIds.length ? 'Pick at least one staff member.' : !familyId ? 'Pick an appraisal form.' : null;
  const startLabel = people.length > 1 ? `Start ${people.length} appraisals` : withOne.length ? 'Start anyway' : 'Start appraisal';

  return (
    <FormModal title="New appraisal" subtitle={`For ${monthLabel}. ${people.length > 1 ? 'One is created for each person.' : 'It opens straight away.'}`} onClose={onClose} width={480}
      primary={{ label: startLabel, onClick: () => { setFailures([]); start.mutate(); }, busy: start.isPending, disabled: !!problem, hint: problem ?? undefined }}>
      {staff.isPending || forms.isPending ? <LoadingSpinner inline /> : (
        <>
          <label htmlFor="na-staff" style={lbl}>Staff</label>
          {/* Staff and forms can be many — type to find them. */}
          <StaffMultiSelect id="na-staff" values={teacherIds} onChange={ids => { setTeacherIds(ids); setFamilyId(''); setFailures([]); }}
            placeholder="Search staff… (pick one or several)"
            options={(staff.data ?? []).map(s => ({ value: s.id, label: s.name, hint: s.positionName ?? undefined }))} noMatches="No one matches." />
          {(staff.data ?? []).length === 0 && <p style={note}>Nobody reports to you, so there’s no one to appraise.</p>}
          {withOne.length > 0 && (
            <p role="alert" style={{ ...note, color: p.amber }}>
              {withOne.length === 1 ? `${withOne[0].name} already has` : `${withOne.map(s => s.name).join(', ')} already have`} an appraisal for {monthLabel}. Another will still be started — the month’s score is the average of the two.
            </p>
          )}

          <label htmlFor="na-form" style={{ ...lbl, marginTop: 16 }}>Appraisal form</label>
          <SearchSelect id="na-form" value={familyId} onChange={setFamilyId} disabled={!people.length || fitting.length === 0}
            placeholder={people.length ? 'Search appraisal forms…' : 'Pick staff first'}
            options={fitting.map(f => ({ value: f.familyId, label: f.name }))} noMatches="No form matches." />
          {people.length > 0 && fitting.length === 0 && (
            <p style={note}>
              {people.length === 1
                ? `No live form is for ${people[0].positionName ?? 'their position'} — set one’s “Who it’s for” in Settings → Appraisal forms.`
                : 'No live form suits all of them — pick people in positions that share a form, or set its “Who it’s for” in Settings → Appraisal forms.'}
            </p>
          )}
          {failures.length > 0 && (
            <div role="alert" style={{ margin: '12px 0 0', color: p.red, fontSize: 14, lineHeight: 1.5 }}>
              {failures.map(f => (
                <div key={f.name}>
                  <strong>{f.name}:</strong> {f.message}
                  {f.existingId && <> <Link to={`/appraisals/${f.existingId}`} onClick={() => { qc.invalidateQueries({ queryKey: ['appraisal-overview'] }); }} style={{ color: p.accent, fontWeight: 600 }}>Open it</Link></>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </FormModal>
  );
}

/** When an appraisal was refused because it already exists, which one — so it can be opened. */
function errorExistingId(f: { error: unknown }): string | null {
  return f.error instanceof ApiError && typeof f.error.body?.existingId === 'string' ? f.error.body.existingId : null;
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: p.sub, marginBottom: 4 };
const note: React.CSSProperties = { fontSize: 13, color: p.muted, margin: '6px 0 0', lineHeight: 1.5 };
