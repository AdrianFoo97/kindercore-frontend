import { useParams } from 'react-router-dom';
import { CompanyGoalRewards, benefitRules, compensationData, useCompensationData } from './TeacherCompensationPage.js';
import { TEACHER_CONTENT_TOP } from '../components/common/TeacherTopBar.js';
import { SHOW_TEACHER_POOLS } from '../config/releaseFlags.js';
import BenefitsStanding from './teacherPay/benefits/BenefitsStanding.js';
import BenefitTierList from './teacherPay/benefits/BenefitTierList.js';
import { benefitTiers } from './teacherPay/benefits/benefitsCatalog.js';
import { C } from './teacherPay/benefits/benefitsTheme.js';

// ─────────────────────────────────────────────────────────────────────────────
// Benefits & Perks — teacher app (phone first), from the Pay hub.
//
// Answer first: your appraisal score and what it unlocks. Then each tier as a
// short list — the tier says once whether it's unlocked, each row is just the
// benefit and what it's worth (plus its own extra condition, if any), and a
// tap opens the details. The benefits themselves come from benefitsCatalog.ts,
// the same list the admin compensation page shows.
// ─────────────────────────────────────────────────────────────────────────────

export default function TeacherMyCompensationBenefitsPage() {
  const { id } = useParams<{ id: string }>();
  const { eligibility } = useCompensationData(id);
  const score = compensationData.appraisalScore;
  const tiers = benefitTiers({ score, yearsOfService: compensationData.yearsOfService, rules: benefitRules });

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <h1 style={s.title}>Benefits & Perks</h1>
        <BenefitsStanding score={score} rules={benefitRules} />
        {tiers.map(tier => <BenefitTierList key={tier.key} tier={tier} />)}
        {/* Profit sharing / annual bonus explain the pools, held back for a future release. */}
        {SHOW_TEACHER_POOLS && <CompanyGoalRewards eligibility={eligibility} />}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    paddingTop: TEACHER_CONTENT_TOP, paddingRight: 16, paddingBottom: 32, paddingLeft: 16,
    background: C.bg, minHeight: '100vh', color: C.text,
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  inner: { maxWidth: 640, margin: '0 auto' },
  title: { margin: '0 0 16px', paddingLeft: 4, fontSize: 30, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' },
};
