import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import {
  PERFORMANCE_STAFF_KEY, SCHEDULES_KEY, createAppraisalSchedules, fetchAppraisalSchedules, fetchPerformanceStaff, type ScheduleRepeat,
} from '../../api/appraisal-schedules.js';
import { fetchAppraisalTemplates } from '../../api/appraisal-templates.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.js';
import SegmentedControl from '../../components/common/SegmentedControl.js';
import { useToast } from '../../components/common/Toast.js';
import { useGoBack } from '../../hooks/useGoBack.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import {
  LAST_SCHEDULE_DAY, MONTH_NAMES, REPEATS, REPEAT_SHORT, alreadyScheduled, describeRule, draftPayload, draftProblem, formatDate, newDraft,
  fitsForm, scheduleCounts, type ScheduleDraft,
} from './appraisalSchedule.js';
import ScheduleStaffList, { type StaffOption } from './ScheduleStaffList.js';
import { ADMIN as p, button, card } from './runTheme.js';

export const SCHEDULE_PAGE = '/hr/appraisal-schedule';
type Mode = 'staff' | 'form';
const DAYS = Array.from({ length: LAST_SCHEDULE_DAY }, (_, i) => i + 1);

/**
 * HRMS → Appraisal schedule → Schedule appraisals: pick staff then a form, or
 * a form then its staff; say how often and from when. One schedule per person;
 * each appraisal is created on its day and shows as pending on HRMS → Appraisals.
 */
export default function ScheduleNewPage() {
  const { isMobile } = useIsMobile();
  const navigate = useNavigate();
  const goBack = useGoBack(SCHEDULE_PAGE);
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get('by') === 'form' ? 'form' : 'staff');
  const [d, setD] = useState<ScheduleDraft>(() => newDraft());
  const patch = (x: Partial<ScheduleDraft>) => setD(prev => ({ ...prev, ...x }));

  const schedules = useQuery({ queryKey: SCHEDULES_KEY, queryFn: fetchAppraisalSchedules });
  // Only staff you may appraise: your team, or everyone if your access role allows.
  const teachers = useQuery({ queryKey: PERFORMANCE_STAFF_KEY, queryFn: fetchPerformanceStaff });
  const templates = useQuery({ queryKey: ['appraisal-templates'], queryFn: fetchAppraisalTemplates });
  const counts = scheduleCounts(schedules.data ?? []);
  const staff: StaffOption[] = (teachers.data ?? []).map(t => ({ ...t, scheduleCount: counts.get(t.id) ?? 0 }));
  const forms = (templates.data ?? []).filter(f => f.status === 'ACTIVE').sort((a, b) => a.name.localeCompare(b.name));
  const form = forms.find(f => f.familyId === d.familyId) ?? null;
  // "Junior Teacher Appraisal — Junior EI, Senior EI": the positions each form is for, so they're easy to tell apart in a long list.
  const positionName = new Map(staff.filter(s => s.positionId).map(s => [s.positionId!, s.positionName ?? s.positionId!]));
  const formOptionLabel = (f: { name: string; positionIds: string[] }) =>
    f.positionIds.length ? `${f.name} — ${f.positionIds.map(id => positionName.get(id) ?? id).join(', ')}` : f.name;

  // Who can't be picked, and why: not in the form's positions, or already on a repeating schedule for it (a one-off is fine).
  const formPositions = form?.positionIds ?? [];
  const positionNames = [...new Set(formPositions.map(id => staff.find(s => s.positionId === id)?.positionName ?? id))].join(', ');
  const taken = d.repeat === 'ONCE' ? new Set<string>() : alreadyScheduled(schedules.data ?? [], d.familyId);
  const disabled = new Map<string, string>();
  for (const s of staff) {
    if (form && !fitsForm(s, formPositions)) disabled.set(s.id, `For ${positionNames} only`);
    else if (taken.has(s.id)) disabled.set(s.id, 'Already on this form');
  }
  const chosen = d.teacherIds.filter(id => !disabled.has(id));
  const problem = draftProblem({ ...d, teacherIds: chosen });
  const save = useMutation({
    mutationFn: () => createAppraisalSchedules(draftPayload({ ...d, teacherIds: chosen })),
    onSuccess: r => { qc.invalidateQueries({ queryKey: SCHEDULES_KEY }); showToast(`Scheduled ${r.created} staff`); navigate(SCHEDULE_PAGE); },
  });
  const loading = teachers.isPending || templates.isPending || schedules.isPending;
  // Picking the form first lists only the staff it's for; picking staff first lists everyone, greying out who doesn't fit the form.
  const listed = mode === 'form' && form ? staff.filter(s => fitsForm(s, formPositions)) : staff;

  const staffList = staff.length === 0 ? (
    <p style={{ ...note, marginTop: 0 }}>Nobody reports to you, so there’s no one to schedule. Who reports to whom is set on each staff record.</p>
  ) : (
    <>
      {form && <p style={{ ...note, marginTop: 0, marginBottom: 8 }}>{form.name} is for {positionNames} only.</p>}
      {listed.length === 0
        ? <p style={note}>None of your staff are {positionNames}.</p>
        : <ScheduleStaffList key={mode + d.familyId} staff={listed} picked={d.teacherIds} disabled={disabled} onChange={teacherIds => patch({ teacherIds })} mobile={isMobile} />}
    </>
  );

  return (
    <div style={{ padding: isMobile ? 16 : '24px 32px 48px', fontFamily: p.font, background: p.bg, minHeight: '100%' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <button type="button" onClick={goBack} style={{ ...button(p, 'ghost', { small: true }), padding: '4px 8px 4px 0', marginBottom: 8 }}>
          <FontAwesomeIcon icon={faChevronLeft} /> Appraisal schedule
        </button>
        <h1 style={{ margin: '0 0 16px', fontSize: isMobile ? 20 : 24, fontWeight: 700, color: p.text }}>Schedule appraisals</h1>
        <div style={{ marginBottom: 16, maxWidth: 480 }}>
          <SegmentedControl<Mode> ariaLabel="Choose" accent={p.accent} value={mode} onChange={setMode}
            segments={[{ key: 'staff', label: 'By staff' }, { key: 'form', label: 'By appraisal form' }]} />
        </div>
        {loading ? <LoadingSpinner /> : (
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row' }}>
            <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
              {mode === 'form' && (
                <section style={card(p)} aria-labelledby="pick-form">
                  <h2 id="pick-form" style={h2}>1. Appraisal form</h2>
                  <label htmlFor="sch-form-first" style={lbl}>Which form</label>
                  <select id="sch-form-first" value={d.familyId} onChange={e => patch({ familyId: e.target.value })} style={{ ...field, maxWidth: 480 }}>
                    <option value="">Pick a form…</option>
                    {forms.map(f => <option key={f.familyId} value={f.familyId}>{formOptionLabel(f)}</option>)}
                  </select>
                </section>
              )}
              {(mode === 'staff' || form) && (
                <section style={card(p)} aria-labelledby="pick-staff">
                  <h2 id="pick-staff" style={h2}>{mode === 'form' ? '2. Staff' : '1. Staff'}</h2>
                  {staffList}
                </section>
              )}
            </div>

            <aside style={{ ...card(p), width: isMobile ? '100%' : 360, boxSizing: 'border-box', position: isMobile ? 'static' : 'sticky', top: 16 }} aria-labelledby="sch-settings">
              <h2 id="sch-settings" style={h2}>{mode === 'form' ? '3. When' : '2. Form and when'}</h2>
              {mode === 'staff' ? (
                <>
                  <label htmlFor="sch-form" style={lbl}>Appraisal form</label>
                  <select id="sch-form" value={d.familyId} onChange={e => patch({ familyId: e.target.value })} style={field}>
                    <option value="">Pick a form…</option>
                    {forms.map(f => <option key={f.familyId} value={f.familyId}>{formOptionLabel(f)}</option>)}
                  </select>
                </>
              ) : form && <p style={{ ...note, marginTop: 0 }}>Form: <strong style={{ color: p.text }}>{form.name}</strong></p>}
              {forms.length === 0 && <p style={note}>No appraisal forms are live yet — make one live in Settings → Appraisal forms.</p>}

              <div style={{ ...lbl, marginTop: 16 }}>How often</div>
              <SegmentedControl<ScheduleRepeat> ariaLabel="How often" accent={p.accent} value={d.repeat} onChange={repeat => patch({ repeat })}
                segments={REPEATS.map(r => ({ key: r, label: REPEAT_SHORT[r] }))} />

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                {d.repeat === 'YEARLY' && (
                  <span>
                    <label htmlFor="sch-month" style={lbl}>Month</label>
                    <select id="sch-month" value={d.monthOfYear ?? 0} onChange={e => patch({ monthOfYear: Number(e.target.value) })} style={{ ...field, width: 140 }}>
                      {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
                    </select>
                  </span>
                )}
                {d.repeat !== 'ONCE' && (
                  <span>
                    <label htmlFor="sch-day" style={lbl}>On day</label>
                    <select id="sch-day" value={d.dayOfMonth} onChange={e => patch({ dayOfMonth: Number(e.target.value) })} style={{ ...field, width: 88 }}>
                      {DAYS.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </span>
                )}
                <span>
                  <label htmlFor="sch-start" style={lbl}>{d.repeat === 'ONCE' ? 'Date' : 'Starting from'}</label>
                  <input id="sch-start" type="date" value={d.startsOn} onChange={e => patch({ startsOn: e.target.value })} style={{ ...field, width: 160 }} />
                </span>
              </div>

              {/^\d{4}-\d{2}-\d{2}$/.test(d.startsOn) && (
                <p style={{ ...note, color: p.sub }}>
                  {describeRule(d)}{d.repeat !== 'ONCE' && `, from ${formatDate(d.startsOn)}`}, for <strong>{chosen.length}</strong> staff. Each appraisal is created on its day and shows as pending on HRMS → Appraisals.
                </p>
              )}
              {save.error && <p role="alert" style={{ margin: '8px 0 0', color: p.red, fontSize: 14 }}>{(save.error as Error).message}</p>}
              <button type="button" disabled={!!problem || save.isPending} onClick={() => save.mutate()} aria-describedby={problem ? 'sch-problem' : undefined}
                style={{ ...button(p, 'primary', { mobile: isMobile, disabled: !!problem || save.isPending }), width: '100%', marginTop: 16 }}>
                {save.isPending ? 'Scheduling…' : chosen.length > 1 ? `Schedule ${chosen.length} staff` : 'Schedule'}
              </button>
              {problem && <p id="sch-problem" style={{ ...note, textAlign: 'center' }}>{problem}</p>}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

const h2: React.CSSProperties = { margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: p.text };
const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: p.sub, marginBottom: 4 };
const field: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 12px', minHeight: 36, fontSize: 14, color: p.text, background: '#fff',
  border: `1px solid ${p.borderStrong}`, borderRadius: 8, fontFamily: 'inherit',
};
const note: React.CSSProperties = { fontSize: 13, color: p.muted, margin: '8px 0 0', lineHeight: 1.5 };
