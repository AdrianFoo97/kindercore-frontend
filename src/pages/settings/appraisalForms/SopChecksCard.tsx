import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronRight, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useIsMobile } from '../../../hooks/useIsMobile.js';
import { newKey, sectionsFromSaved, type DraftSection } from './appraisalFormDraft.js';
import SopPickerModal, { type SopCriterion } from './SopPickerModal.js';
import { sopGroupingProblem, splitWeights } from './scoringForms.js';
import { WeightTotal } from './SectionsCard.js';
import { C, btn, card, cardHint, iconBtn } from './formTheme.js';

interface Props {
  /** Sections → SOPs (criteria scored on their steps) → steps. */
  sections: DraftSection[];
  onChange: (sections: DraftSection[]) => void;
  /** What stops it being saved (names, empty sections, shares), or null. */
  onProblem: (problem: string | null) => void;
}

/** Shares exactly as typed, by section / SOP key — never changed for you; a bad one is flagged. */
type Typed = Record<string, string>;
const typedFrom = (sections: DraftSection[]): Typed =>
  Object.fromEntries(sections.flatMap(s => [[s.key, String(s.weight)], ...s.criteria.map(c => [c.key, String(c.weight)])]));
const asNumber = (t: string | undefined) => (t != null && t.trim() !== '' && Number.isFinite(Number(t)) ? Number(t) : 0);
const shareBad = (t: string | undefined) => t == null || t.trim() === '' || !Number.isFinite(Number(t)) || Number(t) < 0 || Number(t) > 100;

/**
 * Step 2 of a scoring form made from SOPs: group the SOPs into sections, each
 * section with its share of the total and each SOP with its share of its
 * section. Each SOP is scored like an observation — passed ÷ (passed + failed),
 * N/A left out — so there are no criteria to add and no step weights.
 */
export default function SopChecksCard({ sections, onChange, onProblem }: Props) {
  const { isMobile } = useIsMobile();
  const [typed, setTyped] = useState<Typed>(() => typedFrom(sections));
  const [open, setOpen] = useState<string | null>(null);
  /** The section SOPs are being added to (the pop-up is open). */
  const [addingTo, setAddingTo] = useState<string | null>(null);
  // One section: no section name or share to show — it's simply the SOP list (and it's the whole total).
  const grouped = sections.length > 1;
  const problem = sopGroupingProblem(sections.map(s => ({
    name: s.name, share: typed[s.key] ?? String(s.weight), sops: s.criteria.map(c => ({ name: c.name, share: typed[c.key] ?? String(c.weight) })),
  })));
  useEffect(() => { onProblem(problem); }, [problem]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Apply a change, with the shares it sets shown as typed. */
  const commit = (next: DraftSection[], shares: Typed = {}) => { setTyped(t => ({ ...t, ...shares })); onChange(next); };
  const setShare = (key: string, text: string) => {
    setTyped(t => ({ ...t, [key]: text }));
    if (shareBad(text)) return;
    const n = Number(text);
    onChange(sections.map(s => (s.key === key ? { ...s, weight: n } : { ...s, criteria: s.criteria.map(c => (c.key === key ? { ...c, weight: n } : c)) })));
  };
  const evenSops = (s: DraftSection): [DraftSection, Typed] => {
    const w = splitWeights(100, s.criteria.map(() => 1));
    return [{ ...s, criteria: s.criteria.map((c, i) => ({ ...c, weight: w[i] })) }, Object.fromEntries(s.criteria.map((c, i) => [c.key, String(w[i])]))];
  };
  const splitSops = (key: string) => {
    const s = sections.find(x => x.key === key)!;
    const [even, shares] = evenSops(s);
    commit(sections.map(x => (x.key === key ? even : x)), shares);
  };
  const splitSections = () => {
    const w = splitWeights(100, sections.map(() => 1));
    commit(sections.map((s, i) => ({ ...s, weight: w[i] })), Object.fromEntries(sections.map((s, i) => [s.key, String(w[i])])));
  };
  const addSection = () => {
    const s: DraftSection = { key: newKey('s'), name: `Section ${sections.length + 1}`, weight: 0, criteria: [] };
    commit([...sections, s], { [s.key]: '0' });
  };
  // Removing a section hands its SOPs (with their shares) to the first other one — nothing is lost. If one
  // section is left it's the whole total (its share isn't shown any more).
  const removeSection = (key: string) => {
    const gone = sections.find(s => s.key === key)!;
    const rest = sections.filter(s => s.key !== key);
    const merged = { ...rest[0], criteria: [...rest[0].criteria, ...gone.criteria] };
    const only = rest.length === 1;
    commit([only ? { ...merged, weight: 100 } : merged, ...rest.slice(1)], only ? { [merged.key]: '100' } : {});
  };
  // Adding or removing SOPs never changes anyone's share: new SOPs start at 0% and the status says what's
  // left to share — "Split evenly" is there when that's what's wanted.
  const addSops = (key: string, picked: { criterion: SopCriterion }[]) => {
    const added = sectionsFromSaved([{ name: '', weight: 0, criteria: picked.map(p => ({ ...p.criterion, weight: 0 })) }])[0].criteria;
    commit(sections.map(x => (x.key === key ? { ...x, criteria: [...x.criteria, ...added] } : x)), Object.fromEntries(added.map(c => [c.key, '0'])));
    setAddingTo(null);
  };
  const removeSop = (sectionKey: string, sopKey: string) =>
    commit(sections.map(x => (x.key === sectionKey ? { ...x, criteria: x.criteria.filter(c => c.key !== sopKey) } : x)));
  const rename = (key: string, name: string) => onChange(sections.map(s => (s.key === key ? { ...s, name } : s)));

  const shareInput = (key: string, label: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: C.muted, flexShrink: 0 }}>
      <input type="number" inputMode="decimal" min={0} max={100} step="any" aria-label={label} aria-invalid={shareBad(typed[key])}
        value={typed[key] ?? ''} onChange={e => setShare(key, e.target.value)}
        style={{
          width: 84, boxSizing: 'border-box', padding: '6px 10px', minHeight: isMobile ? 44 : 36, fontSize: isMobile ? 16 : 14, fontFamily: 'inherit',
          textAlign: 'right', color: C.text, borderRadius: 8, border: `1px solid ${shareBad(typed[key]) ? C.red : C.borderStrong}`, background: shareBad(typed[key]) ? C.redSoft : '#fff',
        }} />
      %
    </span>
  );

  return (
    <section style={card} aria-labelledby="sop-checks">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h2 id="sop-checks" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text, flex: 1 }}>Score</h2>
        {grouped && <WeightTotal label="Sections" weights={sections.map(s => asNumber(typed[s.key]))} />}
      </div>
      <p style={cardHint}>
        Add the SOPs to check and set how much each counts — add sections to group them. Each SOP is scored like an SOP observation: steps passed ÷ (passed + failed); N/A isn’t counted.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {sections.map((s, si) => (
          <div key={s.key} style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
            {/* The section: its name, its share of the total, and whether its SOPs' shares add up. */}
            {grouped && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: C.bg, borderBottom: `1px solid ${C.border}`, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
              <input aria-label={`Section ${si + 1} name`} value={s.name} maxLength={191} onChange={e => rename(s.key, e.target.value)} placeholder="Section name"
                style={{ flex: 1, minWidth: 0, padding: '6px 10px', minHeight: isMobile ? 44 : 36, fontSize: 15, fontWeight: 600, fontFamily: 'inherit', color: C.text, borderRadius: 8, border: `1px solid ${s.name.trim() ? C.border : C.red}`, background: '#fff' }} />
              {shareInput(s.key, `${s.name || `Section ${si + 1}`} — share of the total`)}
              {sections.length > 1 && (
                <button type="button" style={iconBtn} aria-label={`Remove ${s.name || `section ${si + 1}`}`} title="Remove section — its SOPs move to the first section"
                  onClick={() => removeSection(s.key)}>
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              )}
            </div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderBottom: s.criteria.length ? `1px solid ${C.border}` : 'none', flexWrap: 'wrap' }}>
              {s.criteria.length
                ? <WeightTotal label="SOP shares" weights={s.criteria.map(c => asNumber(typed[c.key]))} />
                : <span style={{ fontSize: 13, color: C.amber, fontWeight: 600 }}>No SOPs yet — add some.</span>}
              <span style={{ flex: 1 }} />
              {s.criteria.length > 1 && <button type="button" style={btn('ghost', true)} onClick={() => splitSops(s.key)}>Split evenly</button>}
              <button type="button" style={btn('secondary', true)} onClick={() => setAddingTo(s.key)}><FontAwesomeIcon icon={faPlus} /> Add SOPs</button>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {s.criteria.map((c, ci) => {
                const isOpen = open === c.key;
                return (
                  <li key={c.key} style={{ borderTop: ci ? `1px solid ${C.border}` : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                      <button type="button" onClick={() => setOpen(isOpen ? null : c.key)} aria-expanded={isOpen}
                        style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, minHeight: isMobile ? 44 : 32, padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                        <FontAwesomeIcon icon={isOpen ? faChevronDown : faChevronRight} style={{ color: C.muted, fontSize: 12, width: 12 }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{c.name}</span>
                        <span style={{ fontSize: 13, color: C.muted, whiteSpace: 'nowrap' }}>{c.points.length} {c.points.length === 1 ? 'step' : 'steps'}</span>
                      </button>
                      {shareInput(c.key, `${c.name} — share of ${s.name || 'its section'}`)}
                      <button type="button" style={iconBtn} aria-label={`Remove ${c.name}`} title="Remove this SOP" onClick={() => removeSop(s.key, c.key)}>
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                    {/* Just the step names — their details show to the assessor while scoring. */}
                    {isOpen && (
                      <ol style={{ margin: 0, padding: '0 16px 10px 46px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {c.points.map(pt => <li key={pt.key} style={{ fontSize: 14, color: C.text, lineHeight: 1.5 }}>{pt.name}</li>)}
                      </ol>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {addingTo && (
        <SopPickerModal sectionName={grouped ? sections.find(s => s.key === addingTo)?.name ?? null : null}
          excludeTitles={sections.flatMap(s => s.criteria.map(c => c.name))}
          onAdd={picked => addSops(addingTo, picked)} onClose={() => setAddingTo(null)} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        <button type="button" style={btn('ghost', true)} onClick={addSection}><FontAwesomeIcon icon={faPlus} /> Add section</button>
        {sections.length > 1 && <button type="button" style={btn('ghost', true)} onClick={splitSections}>Split sections evenly</button>}
        <span style={{ flex: 1 }} />
        {problem && <span role="status" style={{ fontSize: 13, color: C.muted }}>Can’t save yet — {problem}</span>}
      </div>
    </section>
  );
}
