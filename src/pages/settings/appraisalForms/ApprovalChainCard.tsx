import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import SegmentedControl from '../../../components/common/SegmentedControl.js';
import type { StageScope } from '../../../api/appraisal-templates.js';
import type { Position } from '../../../types/index.js';
import PositionChips from './PositionChips.js';
import { assessStep, hasAcknowledge, newSignOff, orderedChain, signOffSteps, type DraftStage } from './appraisalFormDraft.js';
import { C, btn, card, cardHint, cardTitle, iconBtn, input } from './formTheme.js';

const SCOPE_TEXT: Record<StageScope, string> = {
  OWN_TEAM: 'Only for staff who report to them (set under “Reports to” on each staff record).',
  ANYONE: 'For any staff member using this form.',
};

interface Props {
  stages: DraftStage[];
  positions: Position[];
  onChange?: (stages: DraftStage[]) => void;
}

/**
 * Who handles an appraisal: one "Assessed by" step, any number of sign-offs
 * (approve or send back), and optionally the staff member acknowledging it.
 * Each step goes to positions — never fixed roles — so a new position can take it on.
 */
export default function ApprovalChainCard({ stages, positions, onChange }: Props) {
  const readOnly = !onChange;
  const assess = assessStep(stages);
  const signOffs = signOffSteps(stages);
  const acknowledge = hasAcknowledge(stages);
  const rebuild = (a = assess, s = signOffs, ack = acknowledge) => onChange?.(orderedChain(a, s, ack));
  const patchSignOff = (key: string, patch: Partial<DraftStage>) => rebuild(assess, signOffs.map(s => (s.key === key ? { ...s, ...patch } : s)));

  let n = 0;
  return (
    <section style={card} aria-labelledby="af-chain">
      <h2 id="af-chain" style={cardTitle}>Who handles it</h2>
      <p style={cardHint}>Give each step to positions. A new position, such as Assistant Supervisor, can be added to any step.</p>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 16 }}>
        <Step n={++n} title="Assessed by" subtitle="Scores every criterion.">
          <StageFields stage={assess} positions={positions} readOnly={readOnly} onPatch={patch => assess && rebuild({ ...assess, ...patch })} />
        </Step>

        {signOffs.map(s => (
          <Step
            key={s.key}
            n={++n}
            title={readOnly ? s.name : undefined}
            subtitle="Approves, or sends it back to the assessor."
            titleField={readOnly ? undefined : (
              <input aria-label={`Name of step ${n}`} style={{ ...input, fontWeight: 600, maxWidth: 320 }} value={s.name} maxLength={100}
                onChange={e => patchSignOff(s.key, { name: e.target.value })} />
            )}
            action={readOnly ? undefined : (
              <button type="button" style={iconBtn} aria-label={`Remove step “${s.name}”`} title="Remove step"
                onClick={() => rebuild(assess, signOffs.filter(x => x.key !== s.key))}>
                <FontAwesomeIcon icon={faTrash} />
              </button>
            )}
          >
            <StageFields stage={s} positions={positions} readOnly={readOnly} onPatch={patch => patchSignOff(s.key, patch)} />
          </Step>
        ))}

        {acknowledge && (
          <Step n={++n} title="Staff member acknowledges" subtitle="They see their result only once it’s signed off, then confirm they’ve read it." />
        )}
      </ol>

      {!readOnly && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginTop: 16 }}>
          <button type="button" style={btn('secondary')} onClick={() => rebuild(assess, [...signOffs, newSignOff()])}>
            <FontAwesomeIcon icon={faPlus} /> Add sign-off step
          </button>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: C.sub, cursor: 'pointer', minHeight: 36 }}>
            <input type="checkbox" checked={acknowledge} onChange={e => rebuild(assess, signOffs, e.target.checked)} style={{ width: 16, height: 16, accentColor: C.primary }} />
            Staff member acknowledges it at the end
          </label>
        </div>
      )}
    </section>
  );
}

interface StepProps {
  n: number;
  title?: string;
  titleField?: React.ReactNode;
  subtitle: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}

function Step({ n, title, titleField, subtitle, action, children }: StepProps) {
  return (
    <li style={{ display: 'flex', gap: 16 }}>
      <span aria-hidden style={{
        width: 28, height: 28, borderRadius: 999, background: C.primarySoft, color: C.primary, fontSize: 13, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{n}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {titleField ?? <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{title}</span>}
          {action && <span style={{ marginLeft: 'auto' }}>{action}</span>}
        </div>
        <div style={{ fontSize: 13, color: C.muted, margin: '2px 0 8px' }}>{subtitle}</div>
        {children}
      </div>
    </li>
  );
}

interface StageFieldsProps {
  stage: DraftStage | undefined;
  positions: Position[];
  readOnly: boolean;
  onPatch: (patch: Partial<DraftStage>) => void;
}

function StageFields({ stage, positions, readOnly, onPatch }: StageFieldsProps) {
  if (!stage) return null;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <PositionChips
        positions={positions}
        selected={stage.positionIds}
        onChange={readOnly ? undefined : positionIds => onPatch({ positionIds })}
        ariaLabel={`Positions for ${stage.name}`}
        emptyText="No positions chosen"
      />
      {readOnly ? (
        <div style={{ fontSize: 13, color: C.muted }}>{SCOPE_TEXT[stage.scope]}</div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SegmentedControl<StageScope>
            ariaLabel={`Who ${stage.name} covers`}
            accent={C.primary}
            value={stage.scope}
            onChange={scope => onPatch({ scope })}
            segments={[{ key: 'OWN_TEAM', label: 'Their own team' }, { key: 'ANYONE', label: 'Anyone' }]}
          />
          <span style={{ fontSize: 13, color: C.muted, flex: '1 1 220px' }}>{SCOPE_TEXT[stage.scope]}</span>
        </div>
      )}
    </div>
  );
}
