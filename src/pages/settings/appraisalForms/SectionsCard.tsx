import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown,
  faArrowDown, faArrowUp, faCircleCheck, faCircleExclamation, faPen, faPlus, faScaleBalanced, faTrash, faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import ConfirmDialog from '../../../components/common/ConfirmDialog.js';
import CriterionModal from './CriterionModal.js';
import {
  FULL_WEIGHT, inputSummary, isFullWeight, isOverWeight, moveItem, newCriterion, newSection, remainingWeight, spreadEvenly, typedWeight, weightTotal,
  type DraftCriterion, type DraftSection,
} from './appraisalFormDraft.js';
import { C, btn, card, iconBtn, input, weightInput } from './formTheme.js';
import StepHeading from './StepHeading.js';

interface Props {
  sections: DraftSection[];
  onChange?: (sections: DraftSection[]) => void;
  /** What this step still needs before the form can go live (undefined on read-only versions). */
  issues?: string[];
  /** This is a scoring form's body: its criteria are scored directly — no "on several points", no scoring form. */
  inScoringForm?: boolean;
  /** The appraisal form's "who it's for" — narrows the scoring forms offered. */
  positionIds?: string[];
}

/** "What's scored": weighted sections, each holding weighted criteria. Read-only when onChange is omitted. */
export default function SectionsCard({ sections, onChange, issues, inScoringForm = false, positionIds = [] }: Props) {
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
      <StepHeading id="af-scored" title="What’s scored" issues={issues}
        hint="Sections share the total; criteria share their section. Each group makes 100%."
        right={sections.length > 0 ? <WeightTotal label="Sections" weights={sections.map(s => s.weight)} /> : undefined} />

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
        <CriterionModal criterion={editing.criterion} isNew={editing.isNew} onSave={saveCriterion} onClose={() => setEditing(null)} inScoringForm={inScoringForm} positionIds={positionIds} />
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

const sectionNumber: React.CSSProperties = {
  width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 13, fontWeight: 700, color: C.primary, background: C.primarySoft,
};
const criterionNumber: React.CSSProperties = { minWidth: 28, flexShrink: 0, fontSize: 14, fontWeight: 600, color: C.muted, lineHeight: '20px', fontVariantNumeric: 'tabular-nums' };


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
        {/* Numbered for easy counting: sections 1, 2…; criteria 1.1, 1.2… */}
        <span aria-hidden style={sectionNumber}>{index + 1}</span>
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
          <span aria-hidden style={criterionNumber}>{index + 1}.{i + 1}</span>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            {/* Plain text — the pencil on the right edits it. */}
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{c.name}</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
              {[inputSummary(c), c.description].filter(Boolean).join(' · ')}
            </div>
            {/* Scored from a copied scoring form: what's in it, a tap away. */}
            {c.inputType === 'FORM' && <ScoringFormItems copy={c.otherConfig} />}
            {/* "On several points" is no longer offered: an old one says so until it's changed (it can't go live like this). */}
            {c.inputType === 'POINTS' && !readOnly && (
              <p role="status" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '6px 0 0', fontSize: 13, fontWeight: 600, color: C.amber }}>
                <FontAwesomeIcon icon={faCircleExclamation} aria-hidden />
                No longer offered — edit it to pick how it’s scored
              </p>
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

interface CopiedSection { name: string; weight: number; criteria: { name: string; weight: number; description?: string | null }[] }

/**
 * Under a criterion scored from a scoring form: "Show items" opens a read-only
 * list of the copy it uses — each section and item with its weight — so you can
 * see what will be scored without leaving the form.
 */
function ScoringFormItems({ copy }: { copy: unknown }) {
  const [open, setOpen] = useState(false);
  const sections = ((copy as { sections?: CopiedSection[] } | null)?.sections ?? []);
  const count = sections.reduce((a, s) => a + s.criteria.length, 0);
  if (count === 0) return null;
  return (
    <div style={{ marginTop: 4 }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 28, padding: 0, border: 'none', background: 'none', color: C.primary, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
        <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 11, transform: open ? 'rotate(180deg)' : 'none' }} />
        {open ? 'Hide items' : `Show ${count} item${count === 1 ? '' : 's'}`}
      </button>
      {open && (
        <div style={{ marginTop: 6, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
          {sections.map((s, si) => (
            <div key={si}>
              {(sections.length > 1 || s.name) && (
                <div style={{ display: 'flex', gap: 8, padding: '6px 12px', background: C.bg, fontSize: 12, fontWeight: 700, color: C.muted, borderTop: si ? `1px solid ${C.border}` : 'none' }}>
                  <span style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.name}</span><span>{s.weight}%</span>
                </div>
              )}
              <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {s.criteria.map((c, ci) => (
                  <li key={ci} style={{ display: 'flex', gap: 8, padding: '6px 12px', fontSize: 13, color: C.sub, borderTop: `1px solid ${C.border}` }}>
                    <span style={{ flex: 1, minWidth: 0 }}>{c.name}</span><span style={{ color: C.muted }}>{c.weight}%</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}