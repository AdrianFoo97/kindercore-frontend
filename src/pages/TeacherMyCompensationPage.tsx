import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronLeft, faChevronRight, faSackDollar, faChartLine,
  faGift, faMedal, faTrophy, faCircleCheck, faLock, faAward,
} from '@fortawesome/free-solid-svg-icons';
import { fetchTeachers } from '../api/planner.js';
import { uploadUrl } from '../api/upload.js';
import { pointsBalance, getGoal, rewardCatalog } from '../data/pointsRewardsMock.js';
import {
  compensationData,
  computeMonthlyTotal, rewardStreamSummary, formatService,
  MonthlySalaryBreakdown, CompanyGoalRewards,
  useCompensationData,
} from './TeacherCompensationPage.js';

// ─────────────────────────────────────────────────────────────────────────────
// Teacher-facing compensation hub — mobile-first.
// Quick dashboard: identity + monthly pay + status + saving-toward
// goal + headline pay breakdown. Heavier sections (Earn More, Benefits)
// live on dedicated subpages reached from the two CTA buttons so the
// phone surface stays scannable.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eceef2',
  divider: '#eef0f3',
  text: '#0f172a',
  textSub: '#3f4b5c',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  success: '#059669',
  successSoft: '#ecfdf5',
  successBorder: '#a7f3d0',
  gold: '#b45309',
  goldSoft: '#fef3c7',
  goldBorder: '#fcd34d',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  dangerBorder: '#fecaca',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
  primaryBorder: '#c7d2fe',
};

const POINTS_C = {
  accent: '#7c3aed',
  soft: '#f5f3ff',
  border: '#ddd6fe',
  deep: '#5b21b6',
};

export default function TeacherMyCompensationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // Teacher list is loaded by the shared hook too, but we re-query
  // here just for the avatar color which isn't part of the hook's
  // return shape. React Query dedupes the actual request.
  const { data: teachers = [] } = useQuery({ queryKey: ['planner-teachers'], queryFn: fetchTeachers });
  void teachers; // queried for cache warm-up; hook's `teacher` is what we read below
  const { teacher, teacherSalary, eligibility } = useCompensationData(id);

  const eligibilityLabel =
    eligibility === 'high_performer' ? 'Top-tier benefits'
    : eligibility === 'eligible' ? 'Standard benefits'
    : 'Not eligible';
  const eligibilityVisuals =
    eligibility === 'high_performer' ? { color: C.gold, bg: C.goldSoft, border: C.goldBorder, icon: faTrophy }
    : eligibility === 'eligible' ? { color: C.success, bg: C.successSoft, border: C.successBorder, icon: faCircleCheck }
    : { color: C.danger, bg: C.dangerSoft, border: C.dangerBorder, icon: faLock };

  // Pinned goal — surfaces the teacher's next reward target on the
  // comp surface too. Only renders when the item exists AND is still
  // locked (i.e. the teacher hasn't hit the cost yet).
  const goal = getGoal();
  const goalItem = goal
    ? rewardCatalog.find(r => r.id === goal.rewardId && r.active)
    : undefined;
  const showGoal = !!goalItem && pointsBalance.current < goalItem.cost;

  return (
    <div style={s.page}>
      <style>{`
        .tmc-back-btn:hover { background: #f1f5f9 !important; color: ${C.text} !important; border-color: #cbd5e1 !important; }
        .tmc-quick-btn:active { background: ${C.primarySoft} !important; }
      `}</style>

      <div style={s.inner}>
        <div style={s.breadcrumb}>
          <button onClick={() => navigate(`/teachers/${id}`)} className="tmc-back-btn" style={s.backBtn} title="Back">
            <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 11 }} />
          </button>
          <Link to="/teachers" style={s.crumbLink}>Teachers</Link>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
          <Link to={`/teachers/${id}`} style={s.crumbLink}>{teacher?.name ?? '...'}</Link>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
          <span style={s.crumbCurrent}>My Compensation</span>
        </div>

        {/* Hero — identity, monthly pay, eligibility, quick-nav. */}
        <div style={s.heroCard}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 10, marginBottom: 14, flexWrap: 'wrap',
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 10, fontWeight: 700, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>
              {teacher?.color && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: teacher.color, flexShrink: 0 }} />
              )}
              My Compensation
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 999, flexShrink: 0,
              background: eligibilityVisuals.bg,
              border: `1px solid ${eligibilityVisuals.border}`,
              color: eligibilityVisuals.color,
              fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              <FontAwesomeIcon icon={eligibilityVisuals.icon} style={{ fontSize: 10 }} />
              {eligibilityLabel}
            </span>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            marginBottom: 18,
          }}>
            {teacherSalary?.position?.badgeUrl ? (
              <img
                src={uploadUrl(teacherSalary.position.badgeUrl)}
                alt={teacherSalary.position?.name ?? 'Position badge'}
                style={{
                  width: 48, height: 48, objectFit: 'contain', flexShrink: 0,
                  filter: 'drop-shadow(0 4px 10px rgba(15,23,42,0.14))',
                }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div style={{
                width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `linear-gradient(135deg, ${C.gold}1a 0%, ${C.gold}0a 100%)`,
                border: `1px solid ${C.goldBorder}`,
                color: C.gold, fontSize: 20,
              }}>
                <FontAwesomeIcon icon={faSackDollar} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{
                margin: 0, fontSize: 18, fontWeight: 800, color: C.text,
                letterSpacing: '-0.02em', lineHeight: 1.2,
              }}>
                {teacher?.name ? `${teacher.name}'s Rewards Wallet` : 'My Rewards Wallet'}
              </h1>
              <div style={{
                marginTop: 4,
                display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5,
              }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', borderRadius: 999,
                  background: C.primarySoft, color: C.primary,
                  border: `1px solid ${C.primaryBorder}`,
                  fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  <FontAwesomeIcon icon={faAward} style={{ fontSize: 9 }} />
                  {formatService(compensationData.yearsOfService)}
                </span>
                <Link
                  to={`/teachers/${id}/rewards`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 999,
                    background: POINTS_C.soft, color: POINTS_C.accent,
                    border: `1px solid ${POINTS_C.border}`,
                    fontSize: 10, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                    textDecoration: 'none',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <FontAwesomeIcon icon={faSackDollar} style={{ fontSize: 9 }} />
                  {pointsBalance.current.toLocaleString('en-MY')} pts
                  <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 8 }} />
                </Link>
              </div>
            </div>
          </div>

          {/* Focal number */}
          <div style={{
            paddingTop: 14,
            borderTop: `1px solid ${C.divider}`,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: 6,
            }}>
              Monthly compensation
            </div>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 6,
              fontVariantNumeric: 'tabular-nums',
            }}>
              <span style={{
                fontSize: 14, fontWeight: 700, color: C.gold,
                letterSpacing: '-0.005em',
              }}>RM</span>
              <span style={{
                fontSize: 36, fontWeight: 800, color: C.text,
                letterSpacing: '-0.03em', lineHeight: 1,
              }}>
                {computeMonthlyTotal().toLocaleString('en-MY')}
              </span>
            </div>
            <div style={{
              marginTop: 6, fontSize: 11, fontWeight: 500, color: C.muted,
              lineHeight: 1.45,
            }}>
              {rewardStreamSummary()}
            </div>
          </div>

          {/* Quick-nav — primary CTAs that drill into focused
              subpages instead of scrolling a long hub. Each is a
              full-width Link so a phone tap target is comfortable. */}
          <div style={{
            marginTop: 16,
            display: 'grid', gap: 8,
            gridTemplateColumns: '1fr 1fr',
          }}>
            <Link
              to={`/teachers/${id}/my-compensation/earn-more`}
              className="tmc-quick-btn"
              style={s.quickBtn}
            >
              <FontAwesomeIcon icon={faChartLine} style={{ fontSize: 11, color: C.primary }} />
              Earn more
              <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft, marginLeft: 'auto' }} />
            </Link>
            <Link
              to={`/teachers/${id}/my-compensation/benefits`}
              className="tmc-quick-btn"
              style={s.quickBtn}
            >
              <FontAwesomeIcon icon={faMedal} style={{ fontSize: 11, color: C.primary }} />
              Benefits
              <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft, marginLeft: 'auto' }} />
            </Link>
          </div>
        </div>

        {/* Saving-toward callout — links to the rewards page with the
            goal context. Only renders when the teacher has actually
            pinned a goal AND hasn't reached its cost yet. */}
        {showGoal && goalItem && (
          <Link
            to={`/teachers/${id}/rewards/catalog/${goalItem.id}?from=rewards`}
            style={{
              display: 'block',
              marginTop: 14,
              padding: 14,
              background: `linear-gradient(135deg, ${POINTS_C.soft} 0%, #fff 70%)`,
              border: `1px solid ${POINTS_C.border}`,
              borderRadius: 14,
              textDecoration: 'none', color: 'inherit',
            }}
          >
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 10, fontWeight: 800, color: POINTS_C.deep,
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              <FontAwesomeIcon icon={faGift} style={{ fontSize: 10 }} />
              Saving toward
            </div>
            <div style={{
              marginTop: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 10,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 800, color: C.text,
                  letterSpacing: '-0.01em', lineHeight: 1.2,
                }}>
                  {goalItem.label}
                </div>
                <div style={{
                  marginTop: 2,
                  fontSize: 11, fontWeight: 600, color: C.muted,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {pointsBalance.current.toLocaleString('en-MY')} <span style={{ color: C.mutedSoft }}>/</span> {goalItem.cost.toLocaleString('en-MY')} pts
                </div>
              </div>
              <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 11, color: POINTS_C.accent, flexShrink: 0 }} />
            </div>
          </Link>
        )}

        {/* What You Earn — Monthly Pay + Shared Rewards. The
            headline pay info stays on the hub since it's the answer
            to the teacher's primary question ("what do I make"). */}
        <section style={s.section}>
          <div style={s.sectionCard}>
            <MonthlySalaryBreakdown compact />
            <div style={{ marginTop: 24 }}>
              <CompanyGoalRewards eligibility={eligibility} compact />
            </div>
          </div>
        </section>
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

  heroCard: {
    padding: '18px 16px',
    background: C.card,
    border: `1px solid ${C.cardBorder}`,
    borderRadius: 16,
    boxShadow: '0 1px 3px rgba(15,23,42,0.05), 0 6px 18px rgba(15,23,42,0.04)',
  },
  quickBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '10px 12px', borderRadius: 10,
    background: '#fff', color: C.text,
    border: `1px solid ${C.cardBorder}`,
    fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
    cursor: 'pointer',
    textAlign: 'left',
    textDecoration: 'none',
  },

  section: { marginTop: 14, marginBottom: 14 },
  sectionCard: {
    background: C.card,
    border: `1px solid ${C.cardBorder}`,
    borderRadius: 16,
    padding: '18px 14px 20px',
    boxShadow: '0 1px 3px rgba(15,23,42,0.05), 0 6px 18px rgba(15,23,42,0.04)',
  },
};
