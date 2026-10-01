import { useParams } from 'react-router-dom';
import {
  MoneyBenefits, HighPerformerBenefits, CompanyGoalRewards,
  useCompensationData,
} from './TeacherCompensationPage.js';
import { TEACHER_CONTENT_TOP } from '../components/common/TeacherTopBar.js';

// ─────────────────────────────────────────────────────────────────────────────
// Benefits — teacher-facing mobile subpage. Three tiers stacked in
// gate order: Standing Benefits (≥60 appraisal), Shared Rewards —
// Quarterly Profit Sharing / Annual Bonus conditions — (same ≥60 gate,
// so it sits right after Standing rather than trailing the whole
// page), then High-Performer Benefits (≥80). Shared Rewards lives here
// (not Pay Breakdown) because it's the same kind of thing as the
// benefit tiers around it: an eligibility gate to read once, not a
// number that changes month to month — the live pool figures moved to
// a compact preview on Pay Breakdown instead (see CompanyGoalRewards'
// `compact` sibling usages) with the full live detail on Team Pool.
// Drilled into from the hub's "Benefits" CTA.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eceef2',
  text: '#0f172a',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
};

export default function TeacherMyCompensationBenefitsPage() {
  const { id } = useParams<{ id: string }>();
  const { eligibility } = useCompensationData(id);

  return (
    <div style={s.page}>
      <div style={s.inner}>
        {/* Was missing entirely — same fix as the other Pay spokes; the
            shared bar suppresses its own at-rest title, so this screen
            had no visible title until scrolled. */}
        <h1 style={{
          margin: '0 0 16px', paddingLeft: 4, fontSize: 30, fontWeight: 800,
          color: C.text, letterSpacing: '-0.02em',
        }}>
          Benefits & Perks
        </h1>
        <MoneyBenefits eligibility={eligibility} />
        {/* Same appraisal gate as MoneyBenefits above (≥60) — Quarterly
            Profit Sharing and Annual Bonus are part of the Standing
            tier, not a separate rung, so this sits directly after it
            and before the High-Performer (≥80) section below. */}
        <CompanyGoalRewards eligibility={eligibility} />
        <HighPerformerBenefits unlocked={eligibility === 'high_performer'} />
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    paddingTop: TEACHER_CONTENT_TOP,
    paddingRight: 12,
    paddingBottom: 16,
    paddingLeft: 12,
    background: C.bg, minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    color: C.text,
  },
  inner: { maxWidth: 640, margin: '0 auto' },

  breadcrumb: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
    fontSize: 12, flexWrap: 'wrap', rowGap: 4,
  },
  crumbLink: { color: C.muted, textDecoration: 'none', fontWeight: 500 },
  crumbCurrent: { color: C.text, fontWeight: 600 },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 7,
    border: `1px solid ${C.cardBorder}`,
    background: C.card, color: C.muted,
    cursor: 'pointer',
  },
};
