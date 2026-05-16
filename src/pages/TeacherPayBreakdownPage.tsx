import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import {
  MonthlySalaryBreakdown, CompanyGoalRewards,
  useCompensationData,
} from './TeacherCompensationPage.js';

// ─────────────────────────────────────────────────────────────────────────────
// Pay Breakdown — the "anatomy" spoke of the new gamified pay hub
// (cousin of the Career Journey page). Thin shell that reuses the
// shared MonthlySalaryBreakdown + CompanyGoalRewards components in
// their FULL (non-compact) form. The HR page and legacy teacher pages
// are untouched — this only consumes the shared data hook.
// ─────────────────────────────────────────────────────────────────────────────

const FONT =
  '"Nunito", ui-rounded, -apple-system, "SF Pro Rounded", "Avenir Next", "Segoe UI", system-ui, sans-serif';

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eceef2',
  text: '#475569',
  textStrong: '#334155',
};

export default function TeacherPayBreakdownPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { eligibility } = useCompensationData(id);

  const goBack = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(`/teachers/${id}/my-compensation`);
  };

  return (
    <div style={{
      padding: '16px 12px 28px',
      background: C.bg, minHeight: '100vh',
      fontFamily: FONT, color: C.text,
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, minWidth: 0 }}>
          <button
            onClick={goBack}
            aria-label="Back"
            style={{
              width: 28, height: 28, border: 'none', background: 'transparent',
              cursor: 'pointer', color: C.text, display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 19,
              padding: 0, flexShrink: 0, outline: 'none',
              WebkitAppearance: 'none' as const,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <h1 style={{
            margin: 0, fontSize: 20, fontWeight: 800, color: C.textStrong,
            letterSpacing: '-0.02em', flex: 1, minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            Pay Breakdown
          </h1>
        </div>

        <div style={{
          background: C.card,
          border: `1px solid ${C.cardBorder}`,
          borderRadius: 16,
          padding: '18px 14px 20px',
          boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.05)',
        }}>
          <MonthlySalaryBreakdown />
          <div style={{ marginTop: 24 }}>
            <CompanyGoalRewards eligibility={eligibility} />
          </div>
        </div>
      </div>
    </div>
  );
}
