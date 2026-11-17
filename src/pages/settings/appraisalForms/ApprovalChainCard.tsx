import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation, faPen, faPlus, faStamp, faUserCheck } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { StageScope } from '../../../api/appraisal-templates.js';
import type { Position } from '../../../types/index.js';
import PositionChips from './PositionChips.js';
import { assessStep, hasAcknowledge, newSignOff, orderedChain, signOffSteps, type DraftStage } from './appraisalFormDraft.js';
import { C, btn, card } from './formTheme.js';
import StepHeading from './StepHeading.js';

/**
 * "Which staff can they …?" — the two answers, each with an example using the
 * position picked for the step (e.g. "A Supervisor scores only the staff who
 * report to them"), so it's clear without knowing the system.
 */
function scopeChoices(who: string, verb: string): { key: StageScope; label: string; hint: string }[] {
  // "score" → "scores", "sign off" → "signs off".
  const [first, ...rest] = verb.split(' ');
  const verbs = [first + 's', ...rest].join(' ');
  return [
    { key: 'OWN_TEAM', label: 'Only their own team',
      hint: `${who} ${verbs} only the staff who report to them. Who reports to whom is set on each staff record.` },
    { key: 'ANYONE', label: 'Anyone this form is for',
      hint: `${who} can ${verb} any staff member on this form, whoever they report to.` },
  ];
}
const NEEDS_POSITION = 'Pick at least one position.';
const NEEDS_ONE_POSITION = 'Pick one position.';

interface Props {
  stages: DraftStage[];
  positions: Position[];
  onChange?: (stages: DraftStage[]) => void;
  /** What this step still needs before the form can go live (undefined on read-only versions). */
  issues?: string[];
}

/**
 * Who handles an appraisal, as a top-to-bottom flow in the order it happens:
 * 1 Score it → 2 Sign it off (any number) → 3 the staff member confirms they've
 * read it (on / off). Each step asks two plain questions — who does it, and
 * whose appraisals they can do — and says right there what it still needs.
 * Steps go to positions — never fixed roles — so a new position can take one on.
 */
export default function ApprovalChainCard({ stages, positions, onChange, issues }: Props) {
  const readOnly = !onChange;
  const assess = assessStep(stages);
  const signOffs = signOffSteps(stages);
  const acknowledge = hasAcknowledge(stages);
  const rebuild = (a = assess, s = signOffs, ack = acknowledge) => onChange?.(orderedChain(a, s, ack));
  const patchSignOff = (key: string, patch: Partial<DraftStage>) => rebuild(assess, signOffs.map(s => (s.key === key ? { ...s, ...patch } : s)));
  const showMissing = !!issues; // drafts only

  return (
    <section style={card} aria-labelledby="af-chain">
      <StepHeading id="af-chain" title="Who appraises" issues={issues} listIssues={false}
        hint="What happens to each appraisal, in order." />

      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        <FlowStep icon={faPen} title="Score it" last={false}
          note="One person scores each appraisal, so marks never clash — pick one position.">
          <StageQuestions stage={assess} positions={positions} readOnly={readOnly} showMissing={showMissing} single
            who="Who scores it?" verb="score"
            onPatch={patch => assess && rebuild({ ...assess, ...patch })} />
        </FlowStep>

        {signOffs.map((s, i) => (
          <FlowStep key={s.key} icon={faStamp} title={signOffs.length > 1 ? `Sign it off (${i + 1} of ${signOffs.length})` : 'Sign it off'} last={false}
            note="They approve it, or send it back to whoever scored it."
            action={readOnly ? undefined : (
              <button type="button" style={btn('ghost', true)} onClick={() => rebuild(assess, signOffs.filter(x => x.key !== s.key))}>Remove</button>
            )}>
            <StageQuestions stage={s} positions={positions} readOnly={readOnly} showMissing={showMissing}
              who="Who signs it off?" verb="sign off"
              onPatch={patch => patchSignOff(s.key, patch)} />
          </FlowStep>
        ))}

        {!readOnly && (
          <li style={{ display: 'flex', gap: 16, paddingBottom: 16 }}>
            <Rail last={false} />
            <button type="button" style={{ ...btn('secondary', true), borderStyle: 'dashed' }} onClick={() => rebuild(assess, [...signOffs, newSignOff()])}>
              <FontAwesomeIcon icon={faPlus} /> {signOffs.length ? 'Add another sign-off' : 'Add a sign-off'}
            </button>
          </li>
        )}

        <FlowStep icon={faUserCheck} title="The staff member confirms they’ve read it" last muted={!acknowledge}
          note={acknowledge ? 'They see their result only once it’s signed off, then confirm.' : 'Off — the appraisal is done once it’s signed off.'}
          action={readOnly ? undefined : (
            <Switch on={acknowledge} label="Staff member confirms they’ve read it" onChange={on => rebuild(assess, signOffs, on)} />
          )} />
      </ol>
    </section>
  );
}

interface FlowStepProps {
  icon: IconDefinition;
  title: string;
  /** Last in the flow — no line below. */
  last: boolean;
  note?: string;
  action?: React.ReactNode;
  /** Switched off — shown quieter. */
  muted?: boolean;
  children?: React.ReactNode;
}

/** One step of the flow: an icon on the line that joins the steps, and a card with its questions. */
function FlowStep({ icon, title, last, note, action, muted = false, children }: FlowStepProps) {
  return (
    <li style={{ display: 'flex', gap: 16 }}>
      <Rail last={last} icon={icon} muted={muted} />
      <div style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : 16 }}>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, background: muted ? C.bg : '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: muted ? C.muted : C.text, flex: 1, minWidth: 0 }}>{title}</h3>
            {action}
          </div>
          {note && <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{note}</p>}
          {children}
        </div>
      </div>
    </li>
  );
}

/** The line down the left that joins the steps, with the step's icon on it. */
function Rail({ last, icon, muted = false }: { last: boolean; icon?: IconDefinition; muted?: boolean }) {
  return (
    <div aria-hidden style={{ width: 32, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {icon
        ? (
          <span style={{
            width: 32, height: 32, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            background: muted ? C.bg : C.primarySoft, color: muted ? C.muted : C.primary, border: `1px solid ${muted ? C.border : C.primarySoft}`, fontSize: 13,
          }}>
            <FontAwesomeIcon icon={icon} />
          </span>
        )
        : <span style={{ width: 2, height: 8, background: C.border }} />}
      {!last && <span style={{ width: 2, flex: 1, background: C.border, minHeight: 8 }} />}
    </div>
  );
}

interface StageQuestionsProps {
  stage: DraftStage | undefined;
  positions: Position[];
  readOnly: boolean;
  /** Say "Pick at least one position" when none is picked (drafts). */
  showMissing: boolean;
  who: string;
  /** "score" / "sign off" — used in the questions and examples. */
  verb: string;
  /** Only one position (scoring). */
  single?: boolean;
  onPatch: (patch: Partial<DraftStage>) => void;
}

/** A step's two questions: who does it (positions), and whose appraisals they can do. */
function StageQuestions({ stage, positions, readOnly, showMissing, who, verb, onPatch, single = false }: StageQuestionsProps) {
  if (!stage) return null;
  // The example names the first position picked for this step.
  const first = positions.find(p => stage.positionIds.includes(p.positionId))?.name;
  // "A Principal", "An Admin".
  const choices = scopeChoices(first ? `${/^[aeiou]/i.test(first) ? 'An' : 'A'} ${first}` : 'The person', verb);
  const whose = `Which staff can they ${verb}?`;
  const missing = showMissing && stage.positionIds.length === 0;
  const name = `scope-${stage.key}`;
  return (
    <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
      <div>
        <div style={question}>{who}</div>
        <PositionChips positions={positions} selected={stage.positionIds} ariaLabel={who} single={single}
          onChange={readOnly ? undefined : positionIds => onPatch({ positionIds })} emptyText="No positions chosen" />
        {missing && (
          <p role="status" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0 0', fontSize: 13, fontWeight: 600, color: C.amber }}>
            <FontAwesomeIcon icon={faCircleExclamation} aria-hidden /> {single ? NEEDS_ONE_POSITION : NEEDS_POSITION}
          </p>
        )}
      </div>
      <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
        <legend style={question}>{whose}</legend>
        {readOnly
          ? <div style={{ fontSize: 14, color: C.sub }}>{choices.find(c => c.key === stage.scope)?.label}</div>
          : (
            <div style={{ display: 'grid', gap: 8 }}>
              {choices.map(c => (
                <label key={c.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 14, color: C.text }}>
                  <input type="radio" name={name} checked={stage.scope === c.key} onChange={() => onPatch({ scope: c.key })}
                    style={{ marginTop: 3, accentColor: C.primary }} />
                  <span>
                    {c.label}
                    <span style={{ display: 'block', fontSize: 13, color: C.muted, marginTop: 1 }}>{c.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
      </fieldset>
    </div>
  );
}

/** An on/off switch (iOS-style), with its state also in words for screen readers. */
function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 32, padding: 0, border: 'none', background: 'none',
      cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: on ? C.primary : C.muted,
    }}>
      <span aria-hidden style={{ width: 40, height: 24, borderRadius: 999, background: on ? C.primary : C.borderStrong, position: 'relative', transition: 'background 150ms' }}>
        <span style={{
          position: 'absolute', top: 2, left: 2, width: 20, height: 20, borderRadius: '50%', background: '#fff',
          transform: on ? 'translateX(16px)' : 'none', transition: 'transform 150ms', boxShadow: '0 1px 2px rgba(15,23,42,0.2)',
        }} />
      </span>
      {on ? 'On' : 'Off'}
    </button>
  );
}

const question: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: C.sub, marginBottom: 8, padding: 0 };
