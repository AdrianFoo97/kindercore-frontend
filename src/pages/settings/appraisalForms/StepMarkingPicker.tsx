import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { fetchRatingScales } from '../../../api/appraisal-rating-scales.js';
import { useIsMobile } from '../../../hooks/useIsMobile.js';
import {
  CUSTOM_STARTER, MAX_LEVEL_LABEL, MAX_LEVELS, ONE_TO_FIVE, PASS_FAIL, levelsFromRatingScale, levelsProblem, type MarkLevel, type StepMarking,
} from './stepMarking.js';
import { C } from './formTheme.js';

/** What's typed for a custom level's percentage — kept as typed (never changed for you); a bad one is flagged. */
export interface TypedLevel { label: string; score: string }

interface Props {
  value: StepMarking;
  onChange: (m: StepMarking) => void;
  /** Custom levels exactly as typed (the % boxes). */
  typed: TypedLevel[];
  onTyped: (levels: TypedLevel[]) => void;
}

const asLevels = (t: TypedLevel[]): MarkLevel[] => t.map(l => ({ label: l.label, score: l.score.trim() === '' ? NaN : Number(l.score) }));
export const typedFromLevels = (levels: MarkLevel[]): TypedLevel[] => levels.map(l => ({ label: l.label, score: String(l.score) }));

/**
 * How SOP steps are marked: Pass / Fail, 1–5, a rating scale, or custom levels
 * (each worth a percentage). N/A is always offered and never counted.
 */
export default function StepMarkingPicker({ value, onChange, typed, onTyped }: Props) {
  const { isMobile } = useIsMobile();
  const scales = useQuery({ queryKey: ['appraisal-rating-scales'], queryFn: fetchRatingScales });
  const active = (scales.data ?? []).filter(s => s.isActive !== false);
  const choice = value.inputType === 'PASS_FAIL' ? 'PASS_FAIL' : value.source.kind === 'SCALE' ? `SCALE:${value.source.scaleId}` : value.source.kind;
  const pick = (c: string) => {
    if (c === 'PASS_FAIL') return onChange(PASS_FAIL);
    if (c === 'ONE_TO_FIVE') return onChange({ inputType: 'LEVELS', levels: ONE_TO_FIVE, source: { kind: 'ONE_TO_FIVE' } });
    if (c === 'CUSTOM') {
      const start = value.inputType === 'LEVELS' ? value.levels : CUSTOM_STARTER;
      onTyped(typedFromLevels(start));
      return onChange({ inputType: 'LEVELS', levels: start, source: { kind: 'CUSTOM' } });
    }
    const scale = active.find(s => `SCALE:${s.id}` === c);
    if (scale) onChange({ inputType: 'LEVELS', levels: levelsFromRatingScale(scale), source: { kind: 'SCALE', scaleId: scale.id } });
  };
  const editTyped = (next: TypedLevel[]) => { onTyped(next); onChange({ inputType: 'LEVELS', levels: asLevels(next), source: { kind: 'CUSTOM' } }); };
  const custom = value.inputType === 'LEVELS' && value.source.kind === 'CUSTOM';
  const problem = custom ? levelsProblem(asLevels(typed)) : null;
  const field = { minHeight: isMobile ? 44 : 36, padding: '6px 10px', fontSize: isMobile ? 16 : 14, fontFamily: 'inherit', color: C.text, border: `1px solid ${C.borderStrong}`, borderRadius: 8, background: '#fff', boxSizing: 'border-box' as const };

  return (
    <div style={{ margin: '12px 0 16px' }}>
      <label htmlFor="step-marking" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: 4 }}>How steps are marked</label>
      {/* Rating scales can be many, so it's a dropdown. */}
      <select id="step-marking" value={choice} onChange={e => pick(e.target.value)} style={{ ...field, width: '100%', maxWidth: 360 }}>
        <option value="PASS_FAIL">Pass / Fail</option>
        <option value="ONE_TO_FIVE">1 to 5</option>
        {active.length > 0 && (
          <optgroup label="Rating scales">
            {active.map(s => <option key={s.id} value={`SCALE:${s.id}`}>{s.name}</option>)}
          </optgroup>
        )}
        <option value="CUSTOM">Custom levels…</option>
      </select>
      <p style={{ margin: '6px 0 0', fontSize: 13, color: C.muted }}>
        {value.inputType === 'PASS_FAIL'
          ? 'Pass = 100%, fail = 0%. N/A is always offered and isn’t counted.'
          : `${value.levels.map(l => `${l.label || '…'} = ${Number.isFinite(l.score) ? `${l.score}%` : '…'}`).join(', ')}. N/A is always offered and isn’t counted.`}
      </p>

      {custom && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 420 }}>
          {typed.map((l, i) => {
            const bad = l.score.trim() === '' || !Number.isFinite(Number(l.score)) || Number(l.score) < 0 || Number(l.score) > 100;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input aria-label={`Level ${i + 1} name`} value={l.label} maxLength={MAX_LEVEL_LABEL} placeholder="Level name"
                  onChange={e => editTyped(typed.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  style={{ ...field, flex: 1, minWidth: 0, borderColor: l.label.trim() ? C.borderStrong : C.red }} />
                <input aria-label={`Level ${i + 1} worth (%)`} type="number" inputMode="decimal" min={0} max={100} value={l.score} aria-invalid={bad}
                  onChange={e => editTyped(typed.map((x, j) => (j === i ? { ...x, score: e.target.value } : x)))}
                  style={{ ...field, width: 84, textAlign: 'right', borderColor: bad ? C.red : C.borderStrong }} />
                <span style={{ fontSize: 14, color: C.muted }}>%</span>
                <button type="button" aria-label={`Remove level ${l.label || i + 1}`} title="Remove level" disabled={typed.length <= 2}
                  onClick={() => editTyped(typed.filter((_, j) => j !== i))}
                  style={{ width: isMobile ? 44 : 32, height: isMobile ? 44 : 32, border: 'none', background: 'none', color: typed.length <= 2 ? C.borderStrong : C.muted, cursor: typed.length <= 2 ? 'default' : 'pointer', borderRadius: 8 }}>
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            );
          })}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button type="button" disabled={typed.length >= MAX_LEVELS} onClick={() => editTyped([...typed, { label: '', score: '' }])}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: isMobile ? 44 : 32, padding: '0 4px', border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: typed.length >= MAX_LEVELS ? C.muted : C.primary, cursor: typed.length >= MAX_LEVELS ? 'default' : 'pointer' }}>
              <FontAwesomeIcon icon={faPlus} /> Add level
            </button>
            {problem && <span role="status" style={{ fontSize: 13, color: C.red }}>{problem}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
