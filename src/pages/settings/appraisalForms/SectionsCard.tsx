import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowDown, faArrowUp, faCircleCheck, faCircleExclamation, faPen, faPlus, faScaleBalanced, faTrash, faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import ConfirmDialog from '../../../components/common/ConfirmDialog.js';
import CriterionModal from './CriterionModal.js';
import {
  FULL_WEIGHT, inputSummary, isFullWeight, isOverWeight, moveItem, newCriterion, newSection, remainingWeight, spreadEvenly, typedWeight, weightTotal,
  type DraftCriterion, type DraftSection,
} from './appraisalFormDraft.js';
import { C, btn, card, cardHint, cardTitle, iconBtn, input, weightInput } from './formTheme.js';

interface Props {
  sections: DraftSection[];
  onChange?: (sections: DraftSection[]) => void;
}

/** "What's scored": weighted sections, each holding weighted criteria. Read-only when onChange is omitted. */
export default function SectionsCard({ sections, onChange }: Props) {
  const [editing, setEditing] = useState<{ sectionKey: string; criterion: DraftCriterion; isNew: boolean } | null>(null);
  const [removing, setRemoving] = useState<DraftSection | null>(null);
  const readOnly = !onChange;

  const update = (key: string, patch: Partial<DraftSection>) => onChange?.(sections.map(s => (s.key === key ? { ...s, ...patch } : s)));
  const saveCriterion = (c: DraftCriterion) => {
    if (!editing) return;
    const section = sections.find(s => s.key === editing.sectionKey)!;
    const criteria = editing.isNew ? [...section.criteria, c] : section.criteria.map(x => (x.key === c.key ? c : x));
    update(section.key, { criteria });
    setEditing(null);
  };
  const removeSection = (s: DraftSection) => onChange?.(sections.filter(x => x.key !== s.key));
  const spreadSections = () => {
    const w = spreadEvenly(sections.length);
    onChange?.(sections.map((s, i) => ({ ...s, weight: w[i] })));
  };

  return (
    <section style={card} aria-labelledby="af-scored">
      <style>{`.af-crit-name:hover { color: ${C.primary}; text-decoration: underline; }`}</style>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <h2 id="af-scored" style={cardTitle}>What’s scored</h2>
        {sections.length > 0 && <WeightTotal label="Sections" weights={sections.map(s => s.weight)} />}
      </div>
      <p style={cardHint}>Each section is a share of the total. Each criterion is a share of its section. Both need to make 100%.</p>

      {sections.length === 0 && (
        <div style={{ padding: '24px 16px', textAlign: 'center', border: `1px dashed ${C.borderStrong}`, borderRadius: 8, color: C.muted, fontSize: 14 }}>
          {readOnly ? 'No sections.' : 'No sections yet. Start with one, e.g. “Core values” or “KPI”.'}
        </div>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        {sections.map((s, i) => (
          <SectionBlock
            key={s.key}
            section={s}
            sectionWeights={sections.map(x => x.weight)}
            index={i}
            count={sections.length}
            readOnly={readOnly}
            onPatch={patch => update(s.key, patch)}
            onMove={by => onChange?.(moveItem(sections, i, by))}
            onRemove={() => (s.criteria.length ? setRemoving(s) : removeSection(s))}
            onEditCriterion={(criterion, isNew) => setEditing({ sectionKey: s.key, criterion, isNew })}
          />
        ))}
      </div>

      {!readOnly && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
          <button type="button" style={btn('secondary')} onClick={() => onChange?.([...sections, { ...newSection(), weight: remainingWeight(sections.map(x => x.weight)) }])}>
            <FontAwesomeIcon icon={faPlus} /> Add section
          </button>
          {sections.length > 1 && (
            <button type="button" style={btn('ghost')} onClick={spreadSections}>
              <FontAwesomeIcon icon={faScaleBalanced} /> Split sections evenly
            </button>
          )}
        </div>
      )}

      {editing && (
        <CriterionModal criterion={editing.criterion} isNew={editing.isNew} onSave={saveCriterion} onClose={() => setEditing(null)} />
      )}
      {removing && (
        <ConfirmDialog
          destructive
          title={`Remove “${removing.name || 'this section'}”?`}
          message={`Its ${removing.criteria.length} ${removing.criteria.length === 1 ? 'criterion goes' : 'criteria go'} too. Nothing is saved until you save the draft.`}
          confirmLabel="Remove"
          onConfirm={() => { removeSection(removing); setRemoving(null); }}
          onCancel={() => setRemoving(null)}
        />
      )}
    </section>
  );
}

/**
 * "Sections: 100%" with a tick; short of 100% in amber ("still to give out");
 * over 100% in red, saying by how much — always icon + words, never colour alone.
 */
export function WeightTotal({ label, weights }: { label: string; weights: number[] }) {
  const total = weightTotal(weights);
  const state = isFullWeight(weights) ? 'ok' : isOverWeight(weights) ? 'over' : 'under';
  const color = { ok: C.green, over: C.red, under: C.amber }[state];
  const text = {
    ok: `${label}: ${total}%`,
    over: `${label}: ${total}% — ${weightTotal([total, -FULL_WEIGHT])}% over`,
    under: `${label}: ${total}% — ${weightTotal([FULL_WEIGHT, -total])}% left to give`,
  }[state];
  return (
    <span role={state === 'over' ? 'alert' : undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color }}>
      <FontAwesomeIcon icon={state === 'ok' ? faCircleCheck : state === 'over' ? faCircleExclamation : faTriangleExclamation} />
      {text}
    </span>
  );
}

interface WeightFieldProps {
  value: number;
  /** Its group adds up to more than 100% — outlined in red until fixed. */
  invalid: boolean;
  onChange: (n: number) => void;
  ariaLabel: string;
}

/** A % box that keeps exactly what's typed (within 0–100) and shows empty rather than 0. */
function WeightField({ value, invalid, onChange, ariaLabel }: WeightFieldProps) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: C.muted, fontSize: 14 }}>
      <input
        type="number" min={0} max={FULL_WEIGHT} step="any" inputMode="decimal" aria-label={ariaLabel} aria-invalid={invalid || undefined}
        style={{ ...weightInput, ...(invalid ? { borderColor: C.red, background: C.redSoft } : {}) }}
        value={value === 0 ? '' : value} placeholder="0"
        onChange={e => onChange(typedWeight(Number(e.target.value)))}
      />
      %
    </span>
  );
}

/** The criterion's name opens its editor (same as the pencil) — looks like text until hovered. */
const criterionNameBtn: React.CSSProperties = {
  display: 'block', padding: 0, border: 'none', background: 'none', textAlign: 'left', fontFamily: 'inherit',
  fontSize: 14, fontWeight: 600, color: C.text, cursor: 'pointer',
};
/** Points sit indented under their criterion with a left rule — the visible third level. */
const pointList: React.CSSProperties = {
  margin: '8px 0 0', padding: '0 0 0 24px', borderLeft: `2px solid ${C.border}`, listStyle: 'disc',
};

interface MoveButtonsProps { index: number; count: number; what: string; onMove: (by: -1 | 1) => void; onRemove: () => void }

function MoveButtons({ index, count, what, onMove, onRemove }: MoveButtonsProps) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      <button type="button" style={{ ...iconBtn, color: index === 0 ? C.borderStrong : C.muted, cursor: index === 0 ? 'default' : 'pointer' }}
        disabled={index === 0} aria-label={`Move ${what} up`} title={`Move ${what} up`} onClick={() => onMove(-1)}>
        <FontAwesomeIcon icon={faArrowUp} />
      </button>
      <button type="button" style={{ ...iconBtn, color: index === count - 1 ? C.borderStrong : C.muted, cursor: index === count - 1 ? 'default' : 'pointer' }}
        disabled={index === count - 1} aria-label={`Move ${what} down`} title={`Move ${what} down`} onClick={() => onMove(1)}>
        <FontAwesomeIcon icon={faArrowDown} />
      </button>
      <button type="button" style={iconBtn} aria-label={`Remove ${what}`} title={`Remove ${what}`} onClick={onRemove}>
        <FontAwesomeIcon icon={faTrash} />
      </button>
    </span>
  );
}

interface SectionBlockProps {
  section: DraftSection;
  /** Every section's weight, in order — for capping this one. */
  sectionWeights: number[];
  index: number;
  count: number;
  readOnly: boolean;
  onPatch: (patch: Partial<DraftSection>) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  onEditCriterion: (c: DraftCriterion, isNew: boolean) => void;
}

function SectionBlock({ section: s, sectionWeights, index, count, readOnly, onPatch, onMove, onRemove, onEditCriterion }: SectionBlockProps) {
  const label = s.name || `section ${index + 1}`;
  const spread = () => {
    const w = spreadEvenly(s.criteria.length);
    onPatch({ criteria: s.criteria.map((c, i) => ({ ...c, weight: w[i] })) });
  };
  const patchCriterion = (key: string, patch: Partial<DraftCriterion>) =>
    onPatch({ criteria: s.criteria.map(c => (c.key === key ? { ...c, ...patch } : c)) });

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '12px 16px', background: C.bg, borderBottom: `1px solid ${C.border}` }}>
        {readOnly
          ? <span style={{ flex: '1 1 200px', fontSize: 15, fontWeight: 700, color: C.text }}>{s.name}</span>
          : <input aria-label={`Name of section ${index + 1}`} style={{ ...input, flex: '1 1 200px', fontWeight: 600 }} value={s.name} maxLength={191}
              placeholder="Section name, e.g. Core values" onChange={e => onPatch({ name: e.target.value })} />}
        {readOnly
          ? <span style={{ fontSize: 14, fontWeight: 600, color: C.sub }}>{s.weight}%</span>
          : <WeightField value={s.weight} invalid={isOverWeight(sectionWeights)} onChange={weight => onPatch({ weight })} ariaLabel={`Weight of ${label}`} />}
        {!readOnly && <MoveButtons index={index} count={count} what={`section “${label}”`} onMove={onMove} onRemove={onRemove} />}
      </div>

      {s.criteria.length === 0 && (
        <div style={{ padding: '12px 16px', fontSize: 13, color: C.muted }}>No criteria yet — add what this section looks at.</div>
      )}
      {s.criteria.map((c, i) => (
        <div key={c.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap', padding: '12px 16px', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            {readOnly
              ? <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{c.name}</div>
              : (
                <button type="button" className="af-crit-name" onClick={() => onEditCriterion(c, false)} title={`Edit ${c.name}`} style={criterionNameBtn}>
                  {c.name}
                </button>
              )}
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
              {[
                c.points.length ? `${c.points.length} ${c.points.length === 1 ? 'point' : 'points'}` : '',
                inputSummary(c),
                c.description,
              ].filter(Boolean).join(' · ')}
            </div>
            {c.points.length > 0 && (
              <ul aria-label={`Points for ${c.name}`} style={pointList}>
                {c.points.map(p => <li key={p.key} style={{ fontSize: 13, color: C.sub, lineHeight: 1.6 }}>{p.name}</li>)}
              </ul>
            )}
          </div>
          {readOnly
            ? <span style={{ fontSize: 14, color: C.sub }}>{c.weight}%</span>
            : <WeightField value={c.weight} invalid={isOverWeight(s.criteria.map(x => x.weight))} onChange={weight => patchCriterion(c.key, { weight })} ariaLabel={`Weight of ${c.name}`} />}
          {!readOnly && (
            <>
              <button type="button" style={iconBtn} aria-label={`Edit ${c.name}`} title={`Edit ${c.name}`} onClick={() => onEditCriterion(c, false)}>
                <FontAwesomeIcon icon={faPen} />
              </button>
              <MoveButtons index={i} count={s.criteria.length} what={`“${c.name}”`}
                onMove={by => onPatch({ criteria: moveItem(s.criteria, i, by) })}
                onRemove={() => onPatch({ criteria: s.criteria.filter(x => x.key !== c.key) })} />
            </>
          )}
        </div>
      ))}

      {(!readOnly || s.criteria.length > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 16px', borderTop: `1px solid ${C.border}` }}>
          {!readOnly && (
            <button type="button" style={btn('ghost', true)} onClick={() => onEditCriterion({ ...newCriterion(), weight: remainingWeight(s.criteria.map(c => c.weight)) }, true)}>
              <FontAwesomeIcon icon={faPlus} /> Add criterion
            </button>
          )}
          {!readOnly && s.criteria.length > 1 && (
            <button type="button" style={btn('ghost', true)} onClick={spread}>
              <FontAwesomeIcon icon={faScaleBalanced} /> Split evenly
            </button>
          )}
          {s.criteria.length > 0 && <span style={{ marginLeft: 'auto' }}><WeightTotal label="Criteria" weights={s.criteria.map(c => c.weight)} /></span>}
        </div>
      )}
    </div>
  );
}
