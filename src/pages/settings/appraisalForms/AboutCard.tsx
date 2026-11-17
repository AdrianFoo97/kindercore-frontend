import { useState, type ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import type { MissingPolicy } from '../../../api/appraisal-templates.js';
import type { FormDraft } from './appraisalFormDraft.js';
import StepHeading from './StepHeading.js';
import { C, card, input, label } from './formTheme.js';

const MISSING_TEXT: Record<MissingPolicy, { title: string; hint: string }> = {
  REQUIRE_ALL: { title: 'Every criterion must be scored', hint: 'The assessor can’t submit until everything has a score.' },
  REWEIGHT: { title: 'Skipped criteria share their weight', hint: 'Anything left unscored drops out; the rest make up 100%.' },
};
const DEFAULT_MISSING: MissingPolicy = 'REQUIRE_ALL';

interface Props {
  draft: Pick<FormDraft, 'name' | 'description' | 'missingPolicy'>;
  onChange?: (patch: Partial<FormDraft>) => void;
  /** What this step still needs (undefined on read-only versions). */
  issues?: string[];
  /** "Who it's for" — shown in this step, after the name. */
  children?: ReactNode;
}

/**
 * Step 1 — the form's name and who it's for. When and how often staff are appraised is set on HRMS → Appraisal schedule. The description and what
 * an unscored criterion does are rarely changed, so they sit under "More
 * options" (open already when either isn't the default). Read-only without onChange.
 */
export default function AboutCard({ draft, onChange, issues, children }: Props) {
  const customised = !!draft.description.trim() || draft.missingPolicy !== DEFAULT_MISSING;
  const [moreOpen, setMoreOpen] = useState(customised);

  if (!onChange) {
    return (
      <section style={card} aria-labelledby="af-about">
        <StepHeading id="af-about" title="Basics" />
        <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, max-content) 1fr', gap: '8px 24px', margin: 0, fontSize: 14 }}>
          <dt style={{ color: C.muted }}>Description</dt><dd style={{ margin: 0, color: C.text }}>{draft.description || '—'}</dd>
          <dt style={{ color: C.muted }}>Unscored criteria</dt><dd style={{ margin: 0, color: C.text }}>{MISSING_TEXT[draft.missingPolicy].title}</dd>
        </dl>
        {children}
      </section>
    );
  }
  return (
    <section style={card} aria-labelledby="af-about">
      <StepHeading id="af-about" title="Basics" issues={issues} />
      <label style={label} htmlFor="af-name">Name</label>
      <input id="af-name" style={input} value={draft.name} maxLength={191} placeholder="e.g. Monthly teacher appraisal" onChange={e => onChange({ name: e.target.value })} />

      {children}

      <button type="button" onClick={() => setMoreOpen(o => !o)} aria-expanded={moreOpen} aria-controls="af-more" style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 8, minHeight: 32, padding: 0,
        background: 'none', border: 'none', color: C.primary, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
      }}>
        <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 11, transform: moreOpen ? 'rotate(180deg)' : 'none' }} />
        More options
      </button>

      {moreOpen && (
        <div id="af-more" style={{ marginTop: 12, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <label style={label} htmlFor="af-desc">Description <span style={{ fontWeight: 400, color: C.muted }}>(optional)</span></label>
          <textarea id="af-desc" style={{ ...input, minHeight: 64, resize: 'vertical' }} value={draft.description} maxLength={2000}
            placeholder="Who it’s for and what it looks at." onChange={e => onChange({ description: e.target.value })} />

          <fieldset style={{ border: 'none', padding: 0, margin: '16px 0 0' }}>
            <legend style={label}>If a criterion isn’t scored</legend>
            <div style={{ display: 'grid', gap: 8 }}>
              {(Object.keys(MISSING_TEXT) as MissingPolicy[]).map(p => (
                <label key={p} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', fontSize: 14 }}>
                  <input type="radio" name="af-missing" checked={draft.missingPolicy === p} onChange={() => onChange({ missingPolicy: p })}
                    style={{ marginTop: 3, accentColor: C.primary }} />
                  <span>
                    <span style={{ display: 'block', fontWeight: 600, color: C.text }}>{MISSING_TEXT[p].title}</span>
                    <span style={{ display: 'block', fontSize: 13, color: C.muted, marginTop: 2 }}>{MISSING_TEXT[p].hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </section>
  );
}
