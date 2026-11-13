import { useState } from 'react';
import FormModal from '../../../components/common/FormModal.js';
import SegmentedControl from '../../../components/common/SegmentedControl.js';
import CriterionPoints from './CriterionPoints.js';
import { INPUT_LABEL, RATING_SCALES, namedPoints, numberRule, type DraftCriterion, type ManualInput } from './appraisalFormDraft.js';
import { C, input, label } from './formTheme.js';

const INPUT_HINT: Record<ManualInput, string> = {
  RATING: 'The assessor picks a level, e.g. 4 out of 5 = 80%.',
  PERCENT: 'The assessor enters 0–100%.',
  YES_NO: 'Yes = 100%, no = 0%.',
  NUMBER: 'A count compared with a target, e.g. days late.',
};
const INPUTS = Object.keys(INPUT_LABEL) as ManualInput[];
/** Longer scales (1–10) are self-explanatory; naming every level would be a chore. */
const MAX_NAMED_LEVELS = 5;
type Direction = 'lower' | 'higher';

interface Props {
  criterion: DraftCriterion;
  isNew: boolean;
  onSave: (c: DraftCriterion) => void;
  onClose: () => void;
}

/** Name, guidance and how one criterion is scored. Its weight is set on the form itself. */
export default function CriterionModal({ criterion, isNew, onSave, onClose }: Props) {
  const [c, setC] = useState(criterion);
  const [tried, setTried] = useState(false);
  const set = (patch: Partial<DraftCriterion>) => setC(prev => ({ ...prev, ...patch }));

  const nameMissing = !c.name.trim();
  const targetMissing = c.inputType === 'NUMBER' && (c.target === '' || c.target <= 0);
  const done = () => {
    setTried(true);
    if (nameMissing || targetMissing) return;
    // Blank point rows that were never filled in are left out.
    onSave({ ...c, name: c.name.trim(), points: namedPoints(c.points) });
  };
  const setLevel = (field: 'ratingLabels' | 'ratingDescriptions', i: number, text: string) => {
    const values = Array.from({ length: c.ratingMax }, (_, j) => c[field][j] ?? '');
    values[i] = text;
    set({ [field]: values });
  };

  return (
    <FormModal
      title={isNew ? 'Add criterion' : 'Edit criterion'}
      onClose={onClose}
      dirty={JSON.stringify(c) !== JSON.stringify(criterion)}
      primary={{ label: isNew ? 'Add' : 'Done', onClick: done }}
    >
      <label style={label} htmlFor="crit-name">Name</label>
      <input id="crit-name" autoFocus style={input} value={c.name} maxLength={191} placeholder="e.g. Love for children" onChange={e => set({ name: e.target.value })} />
      {tried && nameMissing && <p role="alert" style={errorText}>Give it a name.</p>}

      <label style={{ ...label, marginTop: 16 }} htmlFor="crit-desc">What good looks like <span style={optional}>Optional</span></label>
      <textarea id="crit-desc" style={{ ...input, minHeight: 72, resize: 'vertical' }} value={c.description} maxLength={1000}
        placeholder="Shown to whoever assesses it." onChange={e => set({ description: e.target.value })} />

      <CriterionPoints criterionName={c.name} points={c.points} onChange={points => set({ points })} />

      <fieldset style={{ border: 'none', padding: 0, margin: '16px 0 0' }}>
        <legend style={label}>{c.points.length ? 'How each point is scored' : 'How it’s scored'}</legend>
        <div style={{ display: 'grid', gap: 8 }}>
          {INPUTS.map(kind => (
            <label key={kind} style={choice(c.inputType === kind)}>
              <input type="radio" name="crit-input" checked={c.inputType === kind} onChange={() => set({ inputType: kind })} style={{ marginTop: 2, accentColor: C.primary }} />
              <span>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.text }}>{INPUT_LABEL[kind]}</span>
                <span style={{ display: 'block', fontSize: 13, color: C.muted, marginTop: 2 }}>{INPUT_HINT[kind]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {c.inputType === 'RATING' && (
        <div style={{ marginTop: 16 }}>
          <label style={label} htmlFor="crit-scale">Scale</label>
          <select id="crit-scale" style={{ ...input, width: 'auto' }} value={c.ratingMax} onChange={e => {
            const max = Number(e.target.value);
            const long = max > MAX_NAMED_LEVELS;
            set({ ratingMax: max, ratingLabels: long ? [] : c.ratingLabels, ratingDescriptions: long ? [] : c.ratingDescriptions });
          }}>
            {RATING_SCALES.map(n => <option key={n} value={n}>1 to {n}</option>)}
          </select>
          {c.ratingMax <= MAX_NAMED_LEVELS && (
            <>
              <div style={{ ...label, marginTop: 16 }}>Each level <span style={optional}>Optional</span></div>
              <p style={{ fontSize: 13, color: C.muted, margin: '0 0 8px', lineHeight: 1.5 }}>
                Name each level and say what it looks like, so every assessor scores the same way.
              </p>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
                {Array.from({ length: c.ratingMax }, (_, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, padding: 8, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                    <span style={levelBadge}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 4 }}>
                      <input aria-label={`Name for level ${i + 1}`} style={input} maxLength={60} value={c.ratingLabels[i] ?? ''}
                        placeholder={levelPlaceholder(i, c.ratingMax).name} onChange={e => setLevel('ratingLabels', i, e.target.value)} />
                      <textarea aria-label={`What level ${i + 1} looks like`} style={{ ...input, minHeight: 40, resize: 'vertical', fontSize: 13 }}
                        maxLength={300} rows={1} value={c.ratingDescriptions[i] ?? ''}
                        placeholder={levelPlaceholder(i, c.ratingMax).looks} onChange={e => setLevel('ratingDescriptions', i, e.target.value)} />
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}

      {c.inputType === 'NUMBER' && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={label} htmlFor="crit-target">Target</label>
              <input id="crit-target" type="number" min={0} step="any" inputMode="decimal" style={{ ...input, width: 120 }}
                value={c.target} onChange={e => set({ target: e.target.value === '' ? '' : Number(e.target.value) })} />
            </div>
            <SegmentedControl<Direction>
              ariaLabel="Which way is better"
              accent={C.primary}
              value={c.higherIsBetter ? 'higher' : 'lower'}
              onChange={k => set({ higherIsBetter: k === 'higher' })}
              segments={[{ key: 'lower', label: 'Lower is better' }, { key: 'higher', label: 'Higher is better' }]}
            />
          </div>
          <p style={{ fontSize: 13, color: tried && targetMissing ? C.red : C.muted, margin: '8px 0 0' }} role={tried && targetMissing ? 'alert' : undefined}>
            {numberRule(c.target, c.higherIsBetter)}
          </p>
        </div>
      )}
    </FormModal>
  );
}

/** Example wording on the lowest and highest levels only — the middle ones stay blank. */
function levelPlaceholder(i: number, max: number): { name: string; looks: string } {
  if (i === 0) return { name: 'Name, e.g. Needs improvement', looks: 'What it looks like, e.g. Often loses patience with children' };
  if (i === max - 1) return { name: 'Name, e.g. Outstanding', looks: 'What it looks like, e.g. Always calm and caring, even when busy' };
  return { name: 'Name', looks: 'What it looks like' };
}

const levelBadge: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 999, background: C.primarySoft, color: C.primary, fontSize: 13, fontWeight: 700,
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4,
};
const optional: React.CSSProperties ={ fontWeight: 400, color: C.muted, marginLeft: 4 };
const errorText: React.CSSProperties = { fontSize: 13, color: C.red, margin: '4px 0 0' };
const choice = (on: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
  border: `1px solid ${on ? C.primary : C.border}`, background: on ? C.primarySoft : '#fff',
});
