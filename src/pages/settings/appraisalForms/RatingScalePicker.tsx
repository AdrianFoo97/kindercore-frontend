import { useQuery } from '@tanstack/react-query';
import { RATING_SCALES_KEY, fetchRatingScales } from '../../../api/appraisal-rating-scales.js';
import LoadingSpinner from '../../../components/common/LoadingSpinner.js';
import type { DraftScale } from './appraisalFormDraft.js';
import { defaultScaleOf, hasNoWording, matchingScale, scaleSummary, scaleToDraft } from './ratingScales.js';
import { C, label, pill } from './formTheme.js';

interface Props {
  s: DraftScale;
  onChange: (patch: Partial<DraftScale>) => void;
  idPrefix: string;
  /** New criterion / point: with no wording yet it will take the default scale, so show that one chosen. */
  isNew: boolean;
  flush?: boolean;
}

/**
 * Pick a rating scale (Settings → Rating scales). Choosing one copies its
 * levels. A criterion whose wording matches no scale (its own, or a plain
 * 1–5 from before scales existed) keeps a card for "as it is now".
 * Every card is always there, so choosing never changes the pop-up's height.
 */
export default function RatingScalePicker({ s, onChange, idPrefix, isNew, flush = false }: Props) {
  const { data: scales = [], isLoading } = useQuery({ queryKey: RATING_SCALES_KEY, queryFn: fetchRatingScales });
  if (isLoading) return <LoadingSpinner inline />;

  // Inactive scales aren't offered — unless it's the one this criterion already uses.
  const matchedAny = matchingScale(s, scales);
  const offered = scales.filter(x => x.isActive || x.id === matchedAny?.id);
  const matched = matchingScale(s, offered);
  const plain = hasNoWording(s);
  const chosenId = matched?.id ?? (isNew && plain ? defaultScaleOf(offered)?.id : undefined);
  const showCurrent = !chosenId;

  return (
    <fieldset style={{ border: 'none', padding: 0, margin: flush ? 0 : '16px 0 0' }}>
      <legend style={label}>Rating scale</legend>
      <div style={{ display: 'grid', gap: 8 }}>
        {offered.map(scale => (
          <label key={scale.id} style={choice(chosenId === scale.id)}>
            <input type="radio" name={`${idPrefix}-scale`} checked={chosenId === scale.id} onChange={() => onChange({ ...scaleToDraft(scale), scaleId: scale.id })}
              style={{ marginTop: 2, accentColor: C.primary }} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 14, fontWeight: 600, color: C.text }}>
                {scale.name}
                {scale.isDefault && <span style={pill(C.primary, C.primarySoft)}>Default</span>}
              </span>
              <span style={{ display: 'block', fontSize: 13, color: C.muted, marginTop: 2, lineHeight: 1.45 }}>{scaleSummary(scale)}</span>
            </span>
          </label>
        ))}
        {showCurrent && (
          <label style={choice(true)}>
            <input type="radio" name={`${idPrefix}-scale`} checked readOnly style={{ marginTop: 2, accentColor: C.primary }} />
            <span>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.text }}>
                {plain ? `Plain 1–${s.ratingMax}` : 'Its own wording'}
              </span>
              <span style={{ display: 'block', fontSize: 13, color: C.muted, marginTop: 2 }}>
                {plain ? 'No names for the levels.' : 'Set before rating scales existed — kept as it is unless you pick a scale.'}
              </span>
            </span>
          </label>
        )}
      </div>
      <p style={{ fontSize: 13, color: C.muted, margin: '8px 0 0' }}>Rating scales are set up in Settings → Rating scales.</p>
    </fieldset>
  );
}

const choice = (on: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
  border: `1px solid ${on ? C.primary : C.border}`, background: on ? C.primarySoft : '#fff',
});
