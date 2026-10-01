import { useParams } from 'react-router-dom';
import {
  MoneyQuests,
  useCompensationData,
} from './TeacherCompensationPage.js';
import { TEACHER_CONTENT_TOP } from '../components/common/TeacherTopBar.js';

// ─────────────────────────────────────────────────────────────────────────────
// Earn More — teacher-facing mobile subpage. Drilled into from the
// hub's "Earn more" CTA. Hosts only the MoneyQuests grid so the
// teacher gets a focused screen instead of scrolling past it inside a
// long compensation document.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eceef2',
  text: '#0f172a',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
};

export default function TeacherMyCompensationEarnMorePage() {
  const { id } = useParams<{ id: string }>();
  const { eligibility } = useCompensationData(id);

  return (
    <div style={s.page}>
      <div style={s.inner}>
        {/* Was missing entirely — the shared bar suppresses its own
            at-rest title on every teacher page, so without an in-page
            heading this screen showed no title at all until scrolled
            far enough to trigger the small collapsed one. */}
        <h1 style={{
          margin: '0 0 16px', paddingLeft: 4, fontSize: 30, fontWeight: 800,
          color: C.text, letterSpacing: '-0.02em',
        }}>
          Grow My Pay
        </h1>
        <MoneyQuests eligibility={eligibility} />
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
