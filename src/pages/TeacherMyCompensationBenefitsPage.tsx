import { useParams, useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import {
  MoneyBenefits, HighPerformerBenefits,
  useCompensationData,
} from './TeacherCompensationPage.js';

// ─────────────────────────────────────────────────────────────────────────────
// Benefits — teacher-facing mobile subpage. Hosts the Standing-tier
// (Performer) benefits and the High-Performer tier benefits stacked
// vertically. Drilled into from the hub's "Benefits" CTA.
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
  const navigate = useNavigate();
  const { teacher, eligibility } = useCompensationData(id);

  return (
    <div style={s.page}>
      <style>{`
        .tmcb-back-btn:hover { background: #f1f5f9 !important; color: ${C.text} !important; border-color: #cbd5e1 !important; }
      `}</style>

      <div style={s.inner}>
        <div style={s.breadcrumb}>
          <button onClick={() => navigate(`/teachers/${id}/my-compensation`)} className="tmcb-back-btn" style={s.backBtn} title="Back">
            <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 11 }} />
          </button>
          <Link to="/teachers" style={s.crumbLink}>Teachers</Link>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
          <Link to={`/teachers/${id}`} style={s.crumbLink}>{teacher?.name ?? '...'}</Link>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
          <Link to={`/teachers/${id}/my-compensation`} style={s.crumbLink}>My Compensation</Link>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
          <span style={s.crumbCurrent}>Benefits</span>
        </div>

        <MoneyBenefits eligibility={eligibility} />
        <HighPerformerBenefits unlocked={eligibility === 'high_performer'} />
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: '16px 12px',
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
