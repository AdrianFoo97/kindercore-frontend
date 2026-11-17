import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChalkboardUser } from '@fortawesome/free-solid-svg-icons';
import { fetchMyTraining, recordTrainingGiven, trainingKey, type TrainingItem } from '../api/sop-observations.js';
import FormModal from '../components/common/FormModal.js';
import { useToast } from '../components/common/Toast.js';
import LoadingSpinner from '../components/common/LoadingSpinner.js';
import { TEACHER_CONTENT_TOP } from '../components/common/TeacherTopBar.js';
import { TRAINING_STATUS, sortTraining, todayDay, trainedOnProblem } from './teacherHome/myTraining.js';

const C = {
  bg: '#f8fafc', card: '#ffffff', border: '#e2e8f0', text: '#0f172a', sub: '#334155', muted: '#64748b',
  accent: '#7c3aed', accentSoft: '#f5f3ff', green: '#047857', greenSoft: '#ecfdf5', amber: '#b45309', amberSoft: '#fffbeb',
};
const TABS = [{ key: 'trainee', label: 'Trainee' }, { key: 'trainer', label: 'Trainer' }] as const;
type Tab = typeof TABS[number]['key'];
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/**
 * Teacher app → My training: SOP observations — what they're being trained
 * on (Trainee, the default) and who they're training (Trainer).
 */
export default function TeacherMyTrainingPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'trainer' ? 'trainer' : 'trainee';
  const { data, isPending, error } = useQuery({ queryKey: trainingKey(id), queryFn: () => fetchMyTraining(id) });
  const items = sortTraining((tab === 'trainee' ? data?.asTrainee : data?.asTrainer) ?? []);
  /** The training a trainer is recording as given (the sheet is open for it). */
  const [recording, setRecording] = useState<TrainingItem | null>(null);

  return (
    <div style={{ padding: `${TEACHER_CONTENT_TOP} 16px 32px`, background: C.bg, minHeight: '100%', fontFamily: 'Nunito, system-ui, sans-serif' }}>
      <h1 style={{ margin: '0 0 16px', paddingLeft: 4, fontSize: 30, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>My Training</h1>
      <div role="tablist" aria-label="My training" style={{ display: 'flex', gap: 4, background: '#eef2f7', padding: 4, borderRadius: 12, marginBottom: 16 }}>
        {TABS.map(t => {
          const on = tab === t.key;
          const open = ((t.key === 'trainee' ? data?.asTrainee : data?.asTrainer) ?? []).filter(i => i.status !== 'CERTIFIED').length;
          return (
            <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => setParams(p => { p.set('tab', t.key); return p; }, { replace: true })}
              style={{
                flex: 1, minHeight: 44, border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 800,
                background: on ? '#fff' : 'transparent', color: on ? C.accent : C.muted, boxShadow: on ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
              }}>
              {t.label}
              {open > 0 && <span style={{ marginLeft: 6, fontSize: 12, padding: '1px 7px', borderRadius: 999, background: C.accentSoft, color: C.accent }}>{open}</span>}
            </button>
          );
        })}
      </div>

      {isPending && <LoadingSpinner />}
      {error && <p role="alert" style={{ color: '#b91c1c', fontSize: 14 }}>Couldn’t load your training. Please try again.</p>}
      {data && items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 16px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 16 }}>
          <FontAwesomeIcon icon={faChalkboardUser} style={{ fontSize: 26, color: C.accent }} />
          <p style={{ margin: '12px 0 0', fontSize: 15, fontWeight: 700, color: C.text }}>{tab === 'trainee' ? 'No training yet' : 'No one to train yet'}</p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
            {tab === 'trainee' ? 'SOP training you’re given shows here.' : 'When you’re made someone’s trainer for an SOP, it shows here.'}
          </p>
        </div>
      )}
      {items.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(i => <TrainingRow key={i.id} item={i} asTrainer={tab === 'trainer'} onRecord={() => setRecording(i)} />)}
        </ul>
      )}
      {recording && <RecordTrainingSheet teacherId={id} item={recording} onClose={() => setRecording(null)} />}
    </div>
  );
}

function TrainingRow({ item: i, asTrainer, onRecord }: { item: TrainingItem; asTrainer: boolean; onRecord: () => void }) {
  const toRecord = asTrainer && i.status === 'PENDING_TRAINER';
  const st = TRAINING_STATUS[i.status];
  const tone = st.done ? { fg: C.green, bg: C.greenSoft } : { fg: C.amber, bg: C.amberSoft };
  const who = asTrainer ? `Trainee: ${i.teacherName}` : i.trainerName ? `Trainer: ${i.trainerName}` : 'No trainer yet';
  return (
    <li>
      {/* Opens the SOP's guide (in the teacher app) — the steps being trained. */}
      <Link to={`/operations/sops/${i.sopTemplateId}?app=teacher`} style={{ display: 'block', textDecoration: 'none', color: 'inherit', background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 14px', WebkitTapHighlightColor: 'transparent' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 800, color: C.text }}>{i.sopTitle}</span>
        <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: tone.bg, color: tone.fg, whiteSpace: 'nowrap' }}>
          {asTrainer ? st.trainer : st.trainee}
        </span>
      </div>
      <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
        {who} · {st.done && i.assessorAt ? `Certified ${fmtDate(i.assessorAt)}` : `Since ${fmtDate(i.createdAt)}`}
      </div>
      </Link>
      {/* The trainer's part: say they've given it — then the assessor marks each step. */}
      {toRecord && (
        <button type="button" onClick={onRecord} style={{
          marginTop: 6, width: '100%', minHeight: 44, border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 14, fontWeight: 800, background: C.accentSoft, color: C.accent,
        }}>
          Record training given
        </button>
      )}
    </li>
  );
}

/** The trainer records the day they gave the training; it then waits for the assessor. */
function RecordTrainingSheet({ teacherId, item, onClose }: { teacherId: string; item: TrainingItem; onClose: () => void }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const today = todayDay();
  const [day, setDay] = useState(today);
  const problem = trainedOnProblem(day, today);
  const save = useMutation({
    mutationFn: () => recordTrainingGiven(teacherId, item.id, day),
    onSuccess: () => { qc.invalidateQueries({ queryKey: trainingKey(teacherId) }); showToast('Training recorded'); onClose(); },
  });
  return (
    <FormModal title="Record training given" subtitle={`${item.sopTitle} · Trainee: ${item.teacherName}`} onClose={onClose} width={420}
      primary={{ label: 'Record', onClick: () => save.mutate(), busy: save.isPending, disabled: !!problem, hint: problem ?? undefined }}>
      <label htmlFor="trained-on" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.sub, marginBottom: 4 }}>Day you gave the training</label>
      <input id="trained-on" type="date" value={day} max={today} onChange={e => setDay(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 16, fontFamily: 'inherit', color: C.text }} />
      <p style={{ margin: '8px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Next, an assessor watches {item.teacherName} and marks each step.</p>
      {save.error && <p role="alert" style={{ margin: '8px 0 0', color: '#b91c1c', fontSize: 14 }}>{(save.error as Error).message}</p>}
    </FormModal>
  );
}
