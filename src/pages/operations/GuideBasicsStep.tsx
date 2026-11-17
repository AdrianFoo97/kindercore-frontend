import type { CSSProperties, ReactNode, RefObject } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

// Suggest a Guide, step 1 (teacher app): what the guide is called and what
// it's for — the two things a reviewer needs — then the optional extras.
// Required fields read plainly; optional ones say "(optional)". Nothing is
// greyed out: pressing Next with something missing says what, right here.

const C = { text: '#0f172a', body: '#334155', muted: '#64748b', border: '#d5dae3', error: '#b91c1c', accentSoft: 'var(--sop-accent-soft)', accent: 'var(--sop-accent)' };

export const MISSING_NAME = 'Give the guide a name.';
export const MISSING_GOAL = 'Say what the guide is for.';

interface Props {
  title: string; onTitle: (v: string) => void;
  goal: string; onGoal: (v: string) => void;
  videoUrl: string; onVideoUrl: (v: string) => void;
  icon: IconDefinition; iconName: string; onPickIcon: () => void;
  /** The label picker (chips + "Add label"), owned by the page. */
  labels: ReactNode;
  /** After Next was pressed with something missing — show what. */
  showErrors: boolean;
  titleRef: RefObject<HTMLInputElement>;
  goalRef: RefObject<HTMLTextAreaElement>;
}

export default function GuideBasicsStep(p: Props) {
  const nameMissing = p.showErrors && !p.title.trim();
  const goalMissing = p.showErrors && !p.goal.trim();
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Field id="guide-name" label="Guide name" error={nameMissing ? MISSING_NAME : null}>
        <input id="guide-name" ref={p.titleRef} type="text" value={p.title} onChange={e => p.onTitle(e.target.value)}
          placeholder="e.g. Morning drop-off" aria-invalid={nameMissing} aria-describedby={nameMissing ? 'guide-name-error' : undefined}
          style={input(nameMissing)} />
      </Field>

      <Field id="guide-goal" label="What's it for?" hint="One sentence: what should always happen when this guide is followed."
        error={goalMissing ? MISSING_GOAL : null}>
        <textarea id="guide-goal" ref={p.goalRef} value={p.goal} onChange={e => p.onGoal(e.target.value)} rows={3}
          placeholder="e.g. Every child is greeted and handed over to their teacher safely."
          aria-invalid={goalMissing} aria-describedby={goalMissing ? 'guide-goal-error' : 'guide-goal-hint'}
          style={{ ...input(goalMissing), minHeight: 96, resize: 'vertical', lineHeight: 1.5 }} />
      </Field>

      <Field label="Icon" optional hint="Shown next to the guide in the list.">
        <button type="button" onClick={p.onPickIcon} aria-label={`Choose an icon — currently ${p.iconName}`} style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 56, padding: '8px 14px 8px 8px',
          background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}>
          <span aria-hidden style={{ width: 40, height: 40, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.accentSoft, color: C.accent, fontSize: 17, flexShrink: 0 }}>
            <FontAwesomeIcon icon={p.icon} />
          </span>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: C.text }}>Choose an icon</span>
          <FontAwesomeIcon icon={faChevronRight} aria-hidden style={{ fontSize: 12, color: C.muted }} />
        </button>
      </Field>

      <Field label="Labels" optional hint="Help teachers find this guide later.">
        {p.labels}
      </Field>

      <Field id="guide-video" label="Training video" optional hint="A YouTube or Google Drive link.">
        <input id="guide-video" type="url" inputMode="url" value={p.videoUrl} onChange={e => p.onVideoUrl(e.target.value)}
          placeholder="https://" style={input(false)} />
      </Field>
    </div>
  );
}

function Field({ id, label, optional, hint, error, children }: {
  id?: string; label: string; optional?: boolean; hint?: string; error?: string | null; children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} style={{ display: 'block', fontSize: 15, fontWeight: 700, color: C.text }}>
        {label}{optional && <span style={{ fontWeight: 500, color: C.muted }}> (optional)</span>}
      </label>
      {hint && <p id={id ? `${id}-hint` : undefined} style={{ margin: '2px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.4 }}>{hint}</p>}
      <div style={{ marginTop: 8 }}>{children}</div>
      {error && <p id={id ? `${id}-error` : undefined} role="alert" style={{ margin: '6px 0 0', fontSize: 13, fontWeight: 600, color: C.error }}>{error}</p>}
    </div>
  );
}

const input = (bad: boolean): CSSProperties => ({
  width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: 16, fontFamily: 'inherit', color: C.text,
  background: '#fff', border: `1.5px solid ${bad ? C.error : C.border}`, borderRadius: 12, outline: 'none',
});