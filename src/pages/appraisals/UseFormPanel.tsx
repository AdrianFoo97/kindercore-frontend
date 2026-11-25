import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERFORMANCE_STAFF_KEY, fetchPerformanceStaff, startOneOffAppraisal } from '../../api/appraisal-schedules.js';
import { fetchAppraisalTemplates } from '../../api/appraisal-templates.js';
import { ApiError } from '../../api/client.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.js';
import SearchSelect from '../../components/common/SearchSelect.js';
import { formsForAll } from './appraisalBulk.js';

// Staff record → Record appraisal → "Use a form": pick one of the live
// appraisal forms meant for their position, and it's created for the chosen
// month and opened to score — the same as HRMS → Appraisals → New appraisal.

interface Props {
  teacherId: string;
  period: { year: number; month: number };
  onClose: () => void;
  styles: { label: React.CSSProperties; footer: React.CSSProperties; cancel: React.CSSProperties; save: (disabled: boolean) => React.CSSProperties; error: React.CSSProperties };
}

export default function UseFormPanel({ teacherId, period, onClose, styles: s }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [familyId, setFamilyId] = useState('');
  const staff = useQuery({ queryKey: PERFORMANCE_STAFF_KEY, queryFn: fetchPerformanceStaff });
  const forms = useQuery({ queryKey: ['appraisal-templates'], queryFn: fetchAppraisalTemplates });
  const person = (staff.data ?? []).find(p => p.id === teacherId) ?? null;
  const fitting = person ? formsForAll(forms.data ?? [], [person]).sort((a, b) => a.name.localeCompare(b.name)) : [];
  const start = useMutation({
    mutationFn: () => startOneOffAppraisal({ teacherId, familyId, year: period.year, month: period.month }),
    onSuccess: r => {
      qc.invalidateQueries({ queryKey: ['appraisal-overview'] });
      qc.invalidateQueries({ queryKey: ['appraisal-schedules'] });
      navigate(`/appraisals/${r.id}`);
    },
  });
  /** Refused because this one already exists: which, so it can be opened. */
  const existingId = start.error instanceof ApiError && typeof start.error.body?.existingId === 'string' ? start.error.body.existingId : null;

  if (staff.isPending || forms.isPending) return <LoadingSpinner inline />;
  const off = !familyId || start.isPending;
  return (
    <>
      <label htmlFor="uf-form" style={s.label}>Appraisal form</label>
      <SearchSelect id="uf-form" value={familyId} onChange={setFamilyId} disabled={fitting.length === 0}
        placeholder="Search appraisal forms…" options={fitting.map(f => ({ value: f.familyId, label: f.name }))} noMatches="No form matches." />
      <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0 0', lineHeight: 1.5 }}>
        {!person
          ? 'They’re not in your team, so a form can’t be started for them here — enter the score instead.'
          : fitting.length === 0
            ? `No live form is for ${person.positionName ?? 'their position'} — set one’s “Who it’s for” in Settings → Appraisal forms, or enter the score instead.`
            : 'It’s created for the month above and opens straight away to score.'}
      </p>
      {start.error && (
        <div role="alert" style={s.error}>
          {(start.error as Error).message}
          {existingId && <> <Link to={`/appraisals/${existingId}`} style={{ color: '#5a67d8', fontWeight: 600 }}>Open it</Link></>}
        </div>
      )}
      <div style={s.footer}>
        <button type="button" onClick={onClose} style={s.cancel}>Cancel</button>
        <button type="button" onClick={() => start.mutate()} disabled={off} title={!familyId ? 'Pick an appraisal form' : undefined} style={s.save(off)}>
          {start.isPending ? 'Starting…' : 'Start appraisal'}
        </button>
      </div>
    </>
  );
}
