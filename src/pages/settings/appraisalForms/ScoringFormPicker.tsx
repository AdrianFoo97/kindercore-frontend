import { useQuery } from '@tanstack/react-query';
import { SCORING_FORMS_KEY, fetchScoringForms, type ScoringForm } from '../../../api/appraisal-scoring-forms.js';
import { fetchPositions } from '../../../api/salary.js';
import LoadingSpinner from '../../../components/common/LoadingSpinner.js';
import type { Position } from '../../../types/index.js';
import { isUsable, scoringFormFor, scoringFormSummary, scoringFormsForPositions } from './scoringForms.js';
import { C, label } from './formTheme.js';

interface Props {
  chosenId: string | null;
  onChoose: (id: string) => void;
  /** The appraisal form's "who it's for" — only scoring forms for those positions (or for anyone) are offered. */
  positionIds: string[];
}

/**
 * Pick a scoring form (Settings → Scoring forms) for the criterion to be scored
 * from: those meant for this appraisal form's positions first, then those for
 * any position — each A–Z. One that isn't complete yet can't be picked, and says why.
 */
export default function ScoringFormPicker({ chosenId, onChoose, positionIds }: Props) {
  const { data: forms = [], isLoading } = useQuery({ queryKey: SCORING_FORMS_KEY, queryFn: fetchScoringForms });
  const { data: positions = [] } = useQuery({ queryKey: ['salary-positions'], queryFn: fetchPositions });
  if (isLoading) return <LoadingSpinner inline />;
  // Inactive scoring forms aren't offered (one already chosen stays visible).
  const { forThese, forAnyone } = scoringFormsForPositions(forms.filter(f => f.isActive || f.id === chosenId), positionIds);
  if (!forThese.length && !forAnyone.length) {
    return (
      <p style={{ fontSize: 14, color: C.muted, margin: 0, lineHeight: 1.5 }}>
        {forms.length
          ? 'No scoring forms for this form’s positions. Set one up in Settings → Scoring forms, or go back and pick another way to score it.'
          : 'No scoring forms yet. Set them up in Settings → Scoring forms, or go back and pick another way to score it.'}
      </p>
    );
  }
  const theseLabel = positionIds.length
    ? `For ${positions.filter(p => positionIds.includes(p.positionId)).map(p => p.name).join(', ') || 'these positions'}`
    : 'For particular positions';
  return (
    <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
      <legend style={label}>Scoring form</legend>
      {forThese.length > 0 && <Group title={theseLabel} forms={forThese} positions={positions} chosenId={chosenId} onChoose={onChoose} />}
      {forAnyone.length > 0 && <Group title="For any position" forms={forAnyone} positions={positions} chosenId={chosenId} onChoose={onChoose} />}
      <p style={{ fontSize: 13, color: C.muted, margin: '8px 0 0' }}>
        It scores as the form’s weighted total. A copy is kept, so later changes to the scoring form won’t change this one.
      </p>
    </fieldset>
  );
}

interface GroupProps { title: string; forms: ScoringForm[]; positions: Position[]; chosenId: string | null; onChoose: (id: string) => void }

function Group({ title, forms, positions, chosenId, onChoose }: GroupProps) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4, margin: '4px 0 8px' }}>{title}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {forms.map(f => {
          const usable = isUsable(f);
          const on = chosenId === f.id;
          return (
            <label key={f.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderRadius: 8,
              cursor: usable ? 'pointer' : 'default', opacity: usable ? 1 : 0.7,
              border: `1px solid ${on ? C.primary : C.border}`, background: on ? C.primarySoft : '#fff',
            }}>
              <input type="radio" name="crit-scoring-form" checked={on} disabled={!usable} onChange={() => onChoose(f.id)}
                style={{ marginTop: 2, accentColor: C.primary }} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.text }}>{f.name}</span>
                <span style={{ display: 'block', fontSize: 13, color: usable ? C.muted : C.amber, marginTop: 2, lineHeight: 1.45 }}>
                  {usable ? [scoringFormSummary(f), scoringFormFor(f, positions)].filter(Boolean).join(' · ') : `Not complete yet — ${f.problems[0]}`}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
