import SegmentedControl from '../../../components/common/SegmentedControl.js';
import type { Frequency, MissingPolicy } from '../../../api/appraisal-templates.js';
import { FREQUENCY_LABEL, type FormDraft } from './appraisalFormDraft.js';
import { C, card, cardTitle, input, label } from './formTheme.js';

const MISSING_TEXT: Record<MissingPolicy, { title: string; hint: string }> = {
  REQUIRE_ALL: { title: 'Every criterion must be scored', hint: 'The assessor can’t submit until everything has a score.' },
  REWEIGHT: { title: 'Skipped criteria share their weight', hint: 'Anything left unscored drops out; the rest make up 100%.' },
};
const FREQUENCIES = Object.keys(FREQUENCY_LABEL) as Frequency[];

interface Props {
  draft: Pick<FormDraft, 'name' | 'description' | 'frequency' | 'missingPolicy'>;
  onChange?: (patch: Partial<FormDraft>) => void;
}

/** Name, description, how often, and what an unscored criterion does. Read-only without onChange. */
export default function AboutCard({ draft, onChange }: Props) {
  if (!onChange) {
    return (
      <section style={card} aria-labelledby="af-about">
        <h2 id="af-about" style={cardTitle}>About</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, max-content) 1fr', gap: '8px 24px', margin: '16px 0 0', fontSize: 14 }}>
          <dt style={{ color: C.muted }}>Description</dt><dd style={{ margin: 0, color: C.text }}>{draft.description || '—'}</dd>
          <dt style={{ color: C.muted }}>How often</dt><dd style={{ margin: 0, color: C.text }}>{FREQUENCY_LABEL[draft.frequency]}</dd>
          <dt style={{ color: C.muted }}>Unscored criteria</dt><dd style={{ margin: 0, color: C.text }}>{MISSING_TEXT[draft.missingPolicy].title}</dd>
        </dl>
      </section>
    );
  }
  return (
    <section style={card} aria-labelledby="af-about">
      <h2 id="af-about" style={{ ...cardTitle, marginBottom: 16 }}>About</h2>
      <label style={label} htmlFor="af-name">Name</label>
      <input id="af-name" style={input} value={draft.name} maxLength={191} placeholder="e.g. Monthly teacher appraisal" onChange={e => onChange({ name: e.target.value })} />

      <label style={{ ...label, marginTop: 16 }} htmlFor="af-desc">Description <span style={{ fontWeight: 400, color: C.muted }}>Optional</span></label>
      <textarea id="af-desc" style={{ ...input, minHeight: 64, resize: 'vertical' }} value={draft.description} maxLength={2000}
        placeholder="Who it’s for and what it looks at." onChange={e => onChange({ description: e.target.value })} />

      <div style={{ ...label, marginTop: 16 }}>How often</div>
      <SegmentedControl<Frequency>
        ariaLabel="How often"
        accent={C.primary}
        value={draft.frequency}
        onChange={frequency => onChange({ frequency })}
        segments={FREQUENCIES.map(f => ({ key: f, label: FREQUENCY_LABEL[f] }))}
      />

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
    </section>
  );
}
