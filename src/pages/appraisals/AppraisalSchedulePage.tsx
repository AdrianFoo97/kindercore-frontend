import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarCheck, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import {
  CREATED_KEY, SCHEDULES_KEY, createAppraisalNow, deleteAppraisalSchedule, fetchAppraisalSchedules, fetchCreatedAppraisals, type AppraisalSchedule,
} from '../../api/appraisal-schedules.js';
import DeleteDialog from '../../components/common/DeleteDialog.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.js';
import SegmentedControl from '../../components/common/SegmentedControl.js';
import { useToast } from '../../components/common/Toast.js';
import { getAvatarColor, getInitials } from '../../components/onboarding/avatar.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { useScoreBand } from './useScoreBand.js';
import { STATUS_LABEL, byStaff, describeRule, formatDate } from './appraisalSchedule.js';
import { APPRAISAL_TABS, inTab, tabCounts, type AppraisalTab } from './appraisalsList.js';
import { periodLabel } from './appraisalRun.js';
import { SCHEDULE_PAGE } from './ScheduleNewPage.js';
import { ADMIN as p, button, pill } from './runTheme.js';

type View = 'schedules' | 'created';

/**
 * HRMS → Appraisal schedule: the active schedules (by staff member — the form,
 * how often, and the next day one is created) and the appraisals the schedule
 * has created so far. "Schedule appraisals" opens the page to add more.
 */
export default function AppraisalSchedulePage() {
  const { isMobile } = useIsMobile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [view, setView] = useState<View>('schedules');
  const [removing, setRemoving] = useState<AppraisalSchedule | null>(null);

  const schedules = useQuery({ queryKey: SCHEDULES_KEY, queryFn: fetchAppraisalSchedules });
  const refresh = () => { qc.invalidateQueries({ queryKey: SCHEDULES_KEY }); qc.invalidateQueries({ queryKey: ['appraisal-overview'] }); };
  const createNow = useMutation({ mutationFn: (s: AppraisalSchedule) => createAppraisalNow(s.id), onSuccess: (_, s) => { refresh(); showToast(`Appraisal created for ${s.teacherName}`); } });
  const remove = async (s: AppraisalSchedule) => { await deleteAppraisalSchedule(s.id); refresh(); showToast('Schedule removed'); };
  const people = byStaff(schedules.data ?? []);
  const error = (schedules.error ?? createNow.error) as Error | null;

  return (
    <div style={{ padding: isMobile ? '16px' : '24px 32px 48px', fontFamily: p.font, background: p.bg, minHeight: '100%' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 700, color: p.text, flex: '1 1 auto' }}>Appraisal schedule</h1>
          <button type="button" style={button(p, 'primary', { mobile: isMobile })} onClick={() => navigate(`${SCHEDULE_PAGE}/new`)}>
            <FontAwesomeIcon icon={faPlus} /> Schedule appraisals
          </button>
        </header>

        <div style={{ marginBottom: 16 }}>
          <SegmentedControl<View> ariaLabel="Show" accent={p.accent} value={view} onChange={setView}
            segments={[{ key: 'schedules', label: `Active schedules ${people.length}` }, { key: 'created', label: 'Created appraisals' }]} />
        </div>
        {error && <p role="alert" style={{ color: p.red, fontSize: 14 }}>{error.message}</p>}

        {view === 'schedules' && (schedules.isPending ? <LoadingSpinner /> : people.length === 0 ? (
          <Empty text="Nobody is scheduled yet." action={<button type="button" style={{ ...button(p, 'primary'), marginTop: 12 }} onClick={() => navigate(`${SCHEDULE_PAGE}/new`)}>Schedule appraisals</button>} />
        ) : (
          <ul style={listBox}>
            {people.map((person, i) => {
              const avatar = getAvatarColor(person.teacherName);
              return (
                <li key={person.teacherId} style={{ display: 'flex', gap: 12, padding: isMobile ? 12 : '12px 16px', borderTop: i ? `1px solid ${p.border}` : 'none', alignItems: 'flex-start' }}>
                  <div aria-hidden style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: avatar.bg, color: avatar.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>
                    {getInitials(person.teacherName)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: p.text }}>{person.teacherName}</div>
                    <div style={{ fontSize: 13, color: p.muted }}>{person.positionName ?? 'No position'}</div>
                    {person.schedules.map(s => (
                      <ScheduleLine key={s.id} s={s} mobile={isMobile} creating={createNow.isPending && createNow.variables?.id === s.id}
                        onCreateNow={() => createNow.mutate(s)} onRemove={() => setRemoving(s)} />
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        ))}

        {view === 'created' && <CreatedList mobile={isMobile} />}
      </div>

      {removing && (
        <DeleteDialog entityType="Schedule" entityName={`${removing.teacherName} — ${removing.formName}`} actionLabel="Remove"
          consequence="No more appraisals will be created for them from it. Appraisals already created stay."
          onConfirm={() => remove(removing)} onCancel={() => setRemoving(null)} />
      )}
    </div>
  );
}

interface LineProps { s: AppraisalSchedule; mobile: boolean; creating: boolean; onCreateNow: () => void; onRemove: () => void }

/** One schedule: the form, how often, the next day it creates one — and Create now / Remove. */
function ScheduleLine({ s, mobile, creating, onCreateNow, onRemove }: LineProps) {
  const canCreate = s.status !== 'FINISHED' && s.formLive;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '8px 12px', background: p.bg, border: `1px solid ${p.border}`, borderRadius: 8, flexWrap: mobile ? 'wrap' : 'nowrap' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: p.text }}>{s.formName}</span>
          {s.status !== 'ONGOING' && <span style={pill(s.status === 'PAUSED' ? p.amber : p.muted, s.status === 'PAUSED' ? p.amberSoft : '#f1f5f9')}
            title={s.status === 'PAUSED' ? 'Its form isn’t live, or they’ve left — nothing is created until that changes' : undefined}>{STATUS_LABEL[s.status]}</span>}
        </div>
        <div style={{ fontSize: 13, color: p.muted, marginTop: 2 }}>
          {describeRule(s)}
          {s.nextOn ? <> · Next: <strong style={{ color: p.sub }}>{formatDate(s.nextOn)}</strong></> : ' · No more to create'}
        </div>
      </div>
      <button type="button" disabled={!canCreate || creating} onClick={onCreateNow}
        title={canCreate ? 'Create this period’s appraisal now instead of waiting for its day' : 'Nothing left to create'}
        style={button(p, 'ghost', { small: true, mobile, disabled: !canCreate || creating })}>
        {creating ? 'Creating…' : 'Create now'}
      </button>
      <button type="button" onClick={onRemove} aria-label={`Remove ${s.teacherName} from ${s.formName}`} title="Remove — stops future appraisals"
        style={{ width: mobile ? 44 : 28, height: mobile ? 44 : 28, border: 'none', background: 'none', color: p.muted, cursor: 'pointer', borderRadius: 8 }}>
        <FontAwesomeIcon icon={faTrash} style={{ fontSize: 13 }} />
      </button>
    </div>
  );
}

/** Created appraisals: newest first, filtered by where they are; each opens the appraisal. */
function CreatedList({ mobile }: { mobile: boolean }) {
  const bandOf = useScoreBand();
  const [tab, setTab] = useState<AppraisalTab>('ALL');
  const { data = [], isPending, error } = useQuery({ queryKey: CREATED_KEY, queryFn: fetchCreatedAppraisals });
  if (isPending) return <LoadingSpinner />;
  if (error) return <p role="alert" style={{ color: p.red, fontSize: 14 }}>{(error as Error).message}</p>;
  if (data.length === 0) return <Empty text="No appraisals have been created yet." />;
  const counts = tabCounts(data);
  const shown = data.filter(r => inTab(r, tab));
  return (
    <>
      <div style={{ marginBottom: 12, overflowX: 'auto' }}>
        <div style={{ minWidth: mobile ? 640 : undefined }}>
        <SegmentedControl<AppraisalTab> ariaLabel="Status" accent={p.accent} value={tab} onChange={setTab}
          segments={APPRAISAL_TABS.map(t => ({ key: t.key, label: `${t.label} ${counts[t.key]}` }))} />
        </div>
      </div>
      {shown.length === 0 ? <Empty text="None here." /> : (
        <ul style={listBox}>
          {shown.map((r, i) => {
            const band = r.stage === 'DONE' && r.totalScore != null ? bandOf(r.totalScore) : null;
            return (
              <li key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: mobile ? 12 : '12px 16px', borderTop: i ? `1px solid ${p.border}` : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: p.text }}>{r.teacherName}</div>
                  <div style={{ fontSize: 13, color: p.muted }}>{r.formName} · {periodLabel(r.periodType, r.period)} · Created {formatDate(r.createdAt.slice(0, 10))}</div>
                </div>
                {band ? <span style={pill(band.color, band.bg)}>{Math.round(r.totalScore!)}%</span>
                  : <span style={pill(r.stage === 'PENDING' ? p.accent : p.amber, r.stage === 'PENDING' ? p.accentSoft : p.amberSoft)}>{r.status === 'SENT_BACK' ? 'Sent back' : APPRAISAL_TABS.find(x => x.key === r.stage)?.label}</span>}
                <Link to={`/appraisals/${r.id}`} style={{ ...button(p, 'secondary', { small: true, mobile }), textDecoration: 'none' }}>Open</Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div style={{ padding: '48px 16px', textAlign: 'center', background: p.card, borderRadius: 12, border: `1px solid ${p.border}` }}>
      <FontAwesomeIcon icon={faCalendarCheck} style={{ fontSize: 24, color: p.muted, marginBottom: 8 }} />
      <div style={{ fontSize: 14, fontWeight: 600, color: p.sub }}>{text}</div>
      {action}
    </div>
  );
}

const listBox: React.CSSProperties = { listStyle: 'none', margin: 0, padding: 0, background: p.card, border: `1px solid ${p.border}`, borderRadius: 12 };
