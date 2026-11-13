import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faLock } from '@fortawesome/free-solid-svg-icons';
import type { BenefitRules } from './benefitsCatalog.js';
import { standingLine } from './benefitsCatalog.js';
import { C } from './benefitsTheme.js';

/**
 * The answer first: your appraisal score on a bar with the two thresholds
 * ticked, the thresholds listed underneath (reached or not), and one
 * sentence on where that leaves you.
 */
export default function BenefitsStanding({ score, rules }: { score: number; rules: BenefitRules }) {
  const marks = [
    { at: rules.minimumAppraisalForEligibility, label: 'Standard' },
    { at: rules.highPerformerAppraisalThreshold, label: 'High-performer' },
  ];
  const fill = Math.min(100, Math.max(0, score));
  return (
    <section aria-label="Your standing" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.muted }}>Your appraisal score</span>
        <span style={{ fontSize: 28, fontWeight: 800, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{score}</span>
      </div>
      <div role="img" aria-label={`Score ${score} of 100`} style={{ position: 'relative', height: 8, borderRadius: 999, background: C.track, margin: '10px 0 12px' }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${fill}%`, borderRadius: 999, background: C.accent }} />
        {marks.map(m => (
          <div key={m.label} aria-hidden style={{ position: 'absolute', left: `${m.at}%`, top: -3, width: 2, height: 14, marginLeft: -1, background: C.text, opacity: 0.55 }} />
        ))}
      </div>
      <ul style={{ listStyle: 'none', margin: '0 0 12px', padding: 0, display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
        {marks.map(m => {
          const reached = score >= m.at;
          return (
            <li key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: reached ? C.good : C.muted }}>
              <FontAwesomeIcon icon={reached ? faCircleCheck : faLock} style={{ fontSize: 12 }} />
              {m.label} from {m.at}
            </li>
          );
        })}
      </ul>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.body, lineHeight: 1.45 }}>{standingLine(score, rules)}</p>
    </section>
  );
}