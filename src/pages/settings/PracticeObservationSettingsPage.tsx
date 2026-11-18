import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { fetchSettings } from '../../api/settings.js';
import { saveObservationMarking } from '../../api/sop-observations.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.js';
import StepMarkingPicker, { typedFromLevels, type TypedLevel } from './appraisalForms/StepMarkingPicker.js';
import { CUSTOM_STARTER, PASS_FAIL, levelsProblem, type LevelsSource, type StepMarking } from './appraisalForms/stepMarking.js';
import { OBSERVATION_MARKING_KEY } from '../observationMarking.js';
import { C } from './appraisalForms/formTheme.js';

const SAVED_NOTE_MS = 2000;
interface Saved { inputType: 'PASS_FAIL' | 'LEVELS'; levels?: { label: string; score: number }[]; source?: LevelsSource; passMark?: number }

/** The saved setting → the picker's marking and pass mark. */
function fromSaved(raw: unknown): { marking: StepMarking; passMark: number | null } {
  const v = raw as Saved | null;
  if (v?.inputType !== 'LEVELS' || !v.levels?.length) return { marking: PASS_FAIL, passMark: null };
  return { marking: { inputType: 'LEVELS', levels: v.levels, source: v.source ?? { kind: 'CUSTOM' } }, passMark: v.passMark ?? null };
}
/** The pass mark to start with: the lowest level worth more than nothing. */
const defaultPassMark = (levels: { score: number }[]) => Math.min(...levels.filter(l => l.score > 0).map(l => l.score), 100);

/**
 * Settings → Performance Management → Practice observations: how an observation's
 * steps are marked (Pass / Fail, 1–5, a rating scale or custom levels — always with
 * N/A), and which level passes. Each observation keeps the marking it was assigned with.
 */
export default function PracticeObservationSettingsPage() {
  const { isMobile } = useIsMobile();
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  const saved = fromSaved((data as Record<string, unknown> | undefined)?.[OBSERVATION_MARKING_KEY]);
  const [marking, setMarking] = useState<StepMarking | null>(null);
  const [passMark, setPassMark] = useState<number | null>(null);
  const [typed, setTyped] = useState<TypedLevel[]>(typedFromLevels(CUSTOM_STARTER));
  const [savedNote, setSavedNote] = useState(false);
  useEffect(() => {
    if (!data || marking) return;
    setMarking(saved.marking);
    setPassMark(saved.passMark);
    if (saved.marking.inputType === 'LEVELS') setTyped(typedFromLevels(saved.marking.levels));
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!savedNote) return; const t = setTimeout(() => setSavedNote(false), SAVED_NOTE_MS); return () => clearTimeout(t); }, [savedNote]);

  const save = useMutation({
    mutationFn: (value: Saved) => saveObservationMarking(value),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['settings'] }); setSavedNote(true); },
  });
  if (isPending || !marking) return <div className="m-pad"><h1>Practice observations</h1><LoadingSpinner /></div>;

  const onLevels = marking.inputType === 'LEVELS';
  const mark = onLevels ? passMark ?? defaultPassMark(marking.levels) : null;
  const value: Saved = onLevels ? { inputType: 'LEVELS', levels: marking.levels.map(l => ({ label: l.label.trim(), score: l.score })), source: marking.source, passMark: mark! } : { inputType: 'PASS_FAIL' };
  const problem = onLevels ? levelsProblem(marking.levels) : null;
  const dirty = JSON.stringify(value) !== JSON.stringify(saved.marking.inputType === 'LEVELS'
    ? { inputType: 'LEVELS', levels: saved.marking.levels, source: saved.marking.source, passMark: saved.passMark ?? defaultPassMark(saved.marking.levels) }
    : { inputType: 'PASS_FAIL' });
  const change = (m: StepMarking) => {
    setSavedNote(false);
    setMarking(m);
    // A pass mark that no level reaches any more starts again from the lowest level worth something.
    if (m.inputType === 'LEVELS' && !m.levels.some(l => l.score >= (passMark ?? Infinity))) setPassMark(null);
  };
  const levelsByScore = onLevels ? [...marking.levels].filter(l => Number.isFinite(l.score)).sort((a, b) => a.score - b.score) : [];
  const btn = (primary: boolean, enabled: boolean): React.CSSProperties => ({
    minHeight: isMobile ? 44 : 36, padding: '0 16px', borderRadius: 8, fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
    border: primary ? 'none' : `1px solid ${C.borderStrong}`, background: primary ? (enabled ? C.primary : '#cbd5e1') : '#fff', color: primary ? '#fff' : enabled ? C.sub : C.muted,
    cursor: enabled ? 'pointer' : 'default',
  });

  return (
    <div className="m-pad">
      <h1>Practice observations</h1>
      <section style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
        <StepMarkingPicker value={marking} onChange={change} typed={typed} onTyped={setTyped} />
        {onLevels && !problem && (
          <div style={{ marginTop: 8 }}>
            <label htmlFor="pass-mark" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: 4 }}>A step passes at</label>
            <select id="pass-mark" value={mark ?? ''} onChange={e => { setSavedNote(false); setPassMark(Number(e.target.value)); }}
              style={{ minHeight: isMobile ? 44 : 36, padding: '6px 10px', fontSize: isMobile ? 16 : 14, fontFamily: 'inherit', color: C.text, border: `1px solid ${C.borderStrong}`, borderRadius: 8, background: '#fff', width: '100%', maxWidth: 360 }}>
              {levelsByScore.map(l => <option key={l.label} value={l.score}>{l.label} ({l.score}%) and above</option>)}
            </select>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: C.muted }}>A step below this fails — the trainee isn’t certified and goes back for more training.</p>
          </div>
        )}
        <p style={{ margin: '16px 0 0', fontSize: 13, color: C.muted }}>New observations use this. Ones already assigned keep the marking they started with.</p>
      </section>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        <span style={{ flex: 1 }} />
        {problem && <span role="status" style={{ fontSize: 13, color: C.red }}>{problem}</span>}
        {save.error && <span role="alert" style={{ fontSize: 13, color: C.red }}>{(save.error as Error).message}</span>}
        {savedNote && <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: C.green }}><FontAwesomeIcon icon={faCheck} /> Saved</span>}
        <button type="button" disabled={!dirty} onClick={() => { setMarking(saved.marking); setPassMark(saved.passMark); if (saved.marking.inputType === 'LEVELS') setTyped(typedFromLevels(saved.marking.levels)); }} style={btn(false, dirty)}>Discard</button>
        <button type="button" disabled={!dirty || !!problem || save.isPending} onClick={() => save.mutate(value)} title={problem ?? undefined} style={btn(true, dirty && !problem && !save.isPending)}>
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
