import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { fetchTemplates } from '../../../api/sop-templates.js';
import FormModal from '../../../components/common/FormModal.js';
import LoadingSpinner from '../../../components/common/LoadingSpinner.js';
import { useIsMobile } from '../../../hooks/useIsMobile.js';
import { filterSops, sectionsFromSops, sopTags } from './scoringForms.js';
import { useSopSteps } from './useSopSteps.js';
import type { ScoringForm } from '../../../api/appraisal-scoring-forms.js';
import { C } from './formTheme.js';

/** Rows shown before the list scrolls — never taller than about half the screen. */
const VISIBLE_ROWS = 8;
const ROW_HEIGHT = 44;
const MAX_LIST_SCREEN = 0.45;

export type SopCriterion = ScoringForm['sections'][number]['criteria'][number];

/**
 * Add SOPs to a section of an SOP scoring form: search, narrow by tag, tick
 * several. SOPs already in the form aren't offered, nor SOPs with no steps.
 * Each one picked comes back as a criterion scored on its pass / fail / N/A steps.
 */
export default function SopPickerModal({ sectionName, excludeTitles, onAdd, onClose }: {
  sectionName: string | null;
  /** Titles of the SOPs already in the form. */
  excludeTitles: string[];
  onAdd: (sops: { id: string; criterion: SopCriterion }[]) => void;
  onClose: () => void;
}) {
  const { isMobile } = useIsMobile();
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [tagId, setTagId] = useState('');
  const sops = useQuery({ queryKey: ['sop-templates'], queryFn: fetchTemplates });
  const offered = (sops.data ?? [])
    .filter(s => !s.deletedAt && (s.stepCount ?? 0) > 0 && !excludeTitles.includes(s.title))
    .sort((a, b) => a.title.localeCompare(b.title));
  const tags = sopTags(offered);
  const shown = filterSops(offered, query, tagId);
  const { steps, loading, error } = useSopSteps(picked);
  const chosen = offered.filter(s => picked.includes(s.id));
  const built = picked.length && !loading ? sectionsFromSops(chosen.map(s => ({ id: s.id, title: s.title, steps: steps[s.id] ?? [] }))) : null;
  const problem = !picked.length ? 'Tick at least one SOP.' : loading ? 'Loading their steps…' : built && 'problem' in built ? built.problem : null;
  const toggle = (id: string) => setPicked(ps => (ps.includes(id) ? ps.filter(x => x !== id) : [...ps, id]));
  const field: React.CSSProperties = {
    fontSize: isMobile ? 16 : 14, fontFamily: 'inherit', color: C.text, border: `1px solid ${C.borderStrong}`, borderRadius: 8,
    minHeight: isMobile ? 44 : 36, boxSizing: 'border-box', background: '#fff',
  };

  return (
    <FormModal title={sectionName ? `Add SOPs to ${sectionName}` : 'Add SOPs'} onClose={onClose} width={560}
      primary={{
        label: picked.length > 1 ? `Add ${picked.length} SOPs` : 'Add SOP', disabled: !!problem, hint: problem ?? undefined,
        onClick: () => {
          if (!built || !('sections' in built)) return;
          onAdd(chosen.map((s, i) => ({ id: s.id, criterion: built.sections[0].criteria[i] })));
        },
      }}>
      {sops.isPending ? <LoadingSpinner inline /> : offered.length === 0 ? (
        <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>Every SOP with steps is already in this form.</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexDirection: isMobile ? 'column' : 'row' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 13 }} />
              <input type="search" aria-label="Search SOPs" placeholder="Search SOPs or tags…" value={query} onChange={e => setQuery(e.target.value)}
                style={{ ...field, width: '100%', padding: '8px 12px 8px 34px' }} />
            </div>
            {/* Tags can be many, so they're a dropdown. */}
            {tags.length > 0 && (
              <select aria-label="Filter by tag" value={tagId} onChange={e => setTagId(e.target.value)} style={{ ...field, width: isMobile ? '100%' : 180, padding: '8px 12px' }}>
                <option value="">All tags</option>
                {tags.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, border: `1px solid ${C.border}`, borderRadius: 8, maxHeight: `min(${VISIBLE_ROWS * ROW_HEIGHT}px, ${MAX_LIST_SCREEN * 100}vh)`, overflowY: 'auto' }}>
            {shown.length === 0 && <li style={{ padding: 12, fontSize: 14, color: C.muted }}>No SOPs match.</li>}
            {shown.map((s, i) => (
              <li key={s.id} style={{ borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: isMobile ? 48 : ROW_HEIGHT, padding: '0 12px', cursor: 'pointer', fontSize: 14, color: C.text }}>
                  <input type="checkbox" checked={picked.includes(s.id)} onChange={() => toggle(s.id)} style={{ width: 16, height: 16, accentColor: C.primary }} />
                  <span style={{ flex: 1, minWidth: 0 }}>{s.title}</span>
                  <span style={{ fontSize: 12, color: C.muted, whiteSpace: 'nowrap' }}>{s.stepCount} {s.stepCount === 1 ? 'step' : 'steps'}</span>
                </label>
              </li>
            ))}
          </ul>
          {error && <p role="alert" style={{ fontSize: 13, color: C.red, margin: '8px 0 0' }}>{error.message}</p>}
          {built && 'problem' in built && <p role="alert" style={{ fontSize: 13, color: C.red, margin: '8px 0 0' }}>{built.problem}</p>}
        </>
      )}
    </FormModal>
  );
}
