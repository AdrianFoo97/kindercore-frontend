import { useReducer, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronRight, faChevronLeft, faSackDollar, faGift,
  faBullseye, faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { fetchTeachers } from '../api/planner.js';
import {
  pointsBalance, rewardCatalog, redeemReward,
  getGoal, setGoal, clearGoal,
} from '../data/pointsRewardsMock.js';
import ConfirmDialog from '../components/common/ConfirmDialog.js';
import { useToast } from '../components/common/Toast.js';

// ─────────────────────────────────────────────────────────────────────────────
// Catalog item details — reached when a teacher taps a card on the
// /teachers/:id/rewards/catalog page. Mobile-friendly full-page layout
// (instead of a modal) since the rewards experience targets phones.
// Redemption happens here, with a confirm dialog so the teacher
// can't accidentally burn points.
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
  warning: '#d97706',
  warningSoft: '#fffbeb',
  warningBorder: '#fde68a',
  slateSoft: '#f1f5f9',
};

const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

const POINTS_C = {
  accent: '#7c3aed',
  soft: '#f5f3ff',
  border: '#ddd6fe',
  deep: '#5b21b6',
};

export default function TeacherRewardDetailsPage() {
  const { id, rewardId } = useParams<{ id: string; rewardId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  const { data: teachers = [] } = useQuery({
    queryKey: ['planner-teachers'],
    queryFn: fetchTeachers,
  });
  const teacher = (teachers as any[]).find(t => t.id === id);
  const item = rewardCatalog.find(r => r.id === rewardId && r.active);

  if (!item) {
    return (
      <div style={s.page}>
        <div style={s.inner}>
          <Breadcrumb teacherId={id!} teacherName={teacher?.name ?? '...'} crumb="Not found" />
          <div style={{
            marginTop: SP.xl,
            padding: '48px 24px', textAlign: 'center',
            background: C.card, border: `1px solid ${C.cardBorder}`,
            borderRadius: 14,
          }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: C.text }}>
              Reward not found
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: C.muted }}>
              This reward may have been removed from the catalog.
            </p>
            <Link to={`/teachers/${id}/rewards/catalog`} style={primaryLinkBtn}>
              Back to Catalog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const affordable = pointsBalance.current >= item.cost;
  const inStock = item.stock !== 'out';
  const canRedeem = affordable && inStock;
  const balanceAfter = pointsBalance.current - item.cost;

  // Goal state — the teacher can pin a single reward as their "goal"
  // so it surfaces on the main rewards page as motivation. Only one
  // goal at a time: setting a new one replaces the previous (the
  // button label reads "Replace goal" so the swap is explicit).
  const currentGoal = getGoal();
  const isGoal = currentGoal?.rewardId === item.id;
  const hasOtherGoal = !!currentGoal && !isGoal;
  const toggleGoal = () => {
    if (isGoal) {
      clearGoal();
      showToast(`Removed goal: ${item.label}`);
    } else {
      setGoal(item.id);
      showToast(hasOtherGoal
        ? `Goal updated: ${item.label}`
        : `Goal set: ${item.label}`);
    }
    bump();
  };

  const onConfirmRedeem = () => {
    setRedeeming(true);
    setTimeout(() => {
      const created = redeemReward(item.id);
      setRedeeming(false);
      setConfirmOpen(false);
      if (created) {
        showToast(`Redeemed: ${item.label}`);
        bump();
        // Land the teacher on the redeemed-reward page so they can see
        // the voucher code / instructions immediately.
        navigate(`/teachers/${id}/rewards/my/${created.id}`);
      } else {
        showToast('Could not redeem this item', 'error');
      }
    }, 250);
  };

  return (
    <div style={s.page}>
      <style>{`
        .trd-back-btn:hover { background: #f1f5f9 !important; color: ${C.text} !important; border-color: #cbd5e1 !important; }
        .trd-redeem:not(:disabled):hover { background: ${POINTS_C.deep}; }
        .trd-goal-btn:hover { border-color: ${POINTS_C.accent} !important; color: ${POINTS_C.deep} !important; background: ${POINTS_C.soft} !important; }
        .trd-goal-btn[data-active="true"]:hover { background: ${POINTS_C.soft} !important; }
      `}</style>

      <div style={s.inner}>
        <Breadcrumb teacherId={id!} teacherName={teacher?.name ?? '...'} crumb={item.label} />

        {/* Single card — hero block + description + footer actions
            grouped so the page reads as one composed unit. */}
        <div style={s.card}>
          {/* Hero block — identity on the left, cost on the right.
              Outer flex centers vertically so the cost sits aligned
              with the title rather than floating up by the eyebrow. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: SP.lg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: SP.lg, flex: 1, minWidth: 240 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: POINTS_C.soft, color: POINTS_C.accent,
                border: `1px solid ${POINTS_C.border}`,
                fontSize: 26, flexShrink: 0,
              }}>
                <FontAwesomeIcon icon={item.icon} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.eyebrow}>Redeem rewards</div>
                <h1 style={s.heading}>{item.label}</h1>
                {item.sub && <p style={s.subheading}>{item.sub}</p>}
              </div>
            </div>

            {/* Cost — naked number anchored on the right edge. Stock
                state is signalled by the redeem button at the bottom
                of the card instead of a pill up here. */}
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 6,
              flexShrink: 0,
            }}>
              <span style={{
                fontSize: 28, fontWeight: 800, color: POINTS_C.deep,
                fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.025em',
                lineHeight: 1.05,
              }}>
                {item.cost.toLocaleString('en-MY')}
              </span>
              <span style={{
                fontSize: 12, fontWeight: 700, color: C.muted,
                letterSpacing: '0.02em',
              }}>pts</span>
            </div>
          </div>

          {/* Description — what the teacher gets when redeeming. */}
          <div style={{
            marginTop: SP.lg, paddingTop: SP.lg,
            borderTop: `1px solid ${C.divider}`,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 800, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: 8,
            }}>
              Description
            </div>
            <p style={{ margin: 0, fontSize: 14, color: C.textSub, lineHeight: 1.6 }}>
              {item.sub
                ? `${item.label} — ${item.sub}.`
                : item.label}
              {' '}Once redeemed, the reward shows up in your <em>My Rewards</em> with all the details you need to claim it.
            </p>
          </div>

          {/* Footer — actions grouped inside the same card so the whole
              page reads as one composed surface. "Set as goal" sits in
              the secondary action slot beside Back so it doesn't fight
              with the primary Redeem CTA. */}
          <div style={{
            marginTop: SP.lg, paddingTop: SP.lg,
            borderTop: `1px solid ${C.divider}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: 10, flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link
                to={`/teachers/${id}/rewards/catalog`}
                style={{
                  padding: '10px 18px', borderRadius: 10,
                  background: '#fff', color: C.textSub,
                  border: `1px solid ${C.cardBorder}`,
                  fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                  textDecoration: 'none',
                }}
              >
                Back to catalog
              </Link>
              <button
                type="button"
                onClick={toggleGoal}
                className="trd-goal-btn"
                data-active={isGoal}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '10px 16px', borderRadius: 10,
                  background: isGoal ? POINTS_C.soft : '#fff',
                  color: isGoal ? POINTS_C.deep : C.textSub,
                  border: `1px solid ${isGoal ? POINTS_C.border : C.cardBorder}`,
                  fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                  cursor: 'pointer',
                  transition: 'background 160ms ease, border-color 160ms ease, color 160ms ease',
                }}
                title={isGoal
                  ? 'Stop tracking this as your goal'
                  : hasOtherGoal
                    ? 'Replace your current goal with this reward'
                    : 'Pin this reward as your goal — shows on your rewards page as motivation'}
              >
                <FontAwesomeIcon icon={isGoal ? faXmark : faBullseye} style={{ fontSize: 12 }} />
                {isGoal
                  ? 'Remove goal'
                  : hasOtherGoal
                    ? 'Replace goal'
                    : 'Set as goal'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            disabled={!canRedeem}
            onClick={() => setConfirmOpen(true)}
            className="trd-redeem"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 10,
              background: canRedeem ? POINTS_C.accent : '#cbd5e1',
              color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              cursor: canRedeem ? 'pointer' : 'not-allowed',
              boxShadow: canRedeem ? `0 1px 2px ${POINTS_C.accent}30, 0 4px 12px ${POINTS_C.accent}24` : 'none',
              transition: 'background 160ms ease, box-shadow 160ms ease',
            }}
          >
            <FontAwesomeIcon icon={faGift} style={{ fontSize: 12 }} />
            {!inStock
              ? 'Out of stock'
              : !affordable
                ? `Need ${(item.cost - pointsBalance.current).toLocaleString('en-MY')} more pts`
                : `Redeem for ${item.cost.toLocaleString('en-MY')} pts`}
            </button>
            </div>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <ConfirmDialog
          title={`Redeem ${item.label}?`}
          message={
            <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.55 }}>
              <p style={{ margin: '0 0 12px' }}>
                {item.cost.toLocaleString('en-MY')} pts will be deducted from your balance.
              </p>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 10, padding: '10px 12px',
                background: POINTS_C.soft,
                border: `1px solid ${POINTS_C.border}`,
                borderRadius: 8,
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Balance after
                </span>
                <span style={{
                  fontSize: 16, fontWeight: 800, color: POINTS_C.deep,
                  fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.015em',
                }}>
                  {balanceAfter.toLocaleString('en-MY')}
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginLeft: 4 }}>pts</span>
                </span>
              </div>
            </div>
          }
          confirmLabel={`Redeem for ${item.cost.toLocaleString('en-MY')} pts`}
          loading={redeeming}
          onConfirm={onConfirmRedeem}
          onCancel={() => { if (!redeeming) setConfirmOpen(false); }}
        />
      )}
    </div>
  );
}

function Breadcrumb({ teacherId, teacherName, crumb }: {
  teacherId: string; teacherName: string; crumb: string;
}) {
  const navigate = useNavigate();
  return (
    <div style={s.breadcrumb}>
      <button onClick={() => navigate(`/teachers/${teacherId}/rewards/catalog`)} className="trd-back-btn" style={s.backBtn} title="Back">
        <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 11 }} />
      </button>
      <Link to="/teachers" style={s.crumbLink}>Teachers</Link>
      <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
      <Link to={`/teachers/${teacherId}`} style={s.crumbLink}>{teacherName}</Link>
      <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
      <Link to={`/teachers/${teacherId}/rewards`} style={s.crumbLink}>Rewards</Link>
      <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
      <Link to={`/teachers/${teacherId}/rewards/catalog`} style={s.crumbLink}>Redeem rewards</Link>
      <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
      <span style={s.crumbCurrent}>{crumb}</span>
    </div>
  );
}

const primaryLinkBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', borderRadius: 10,
  background: POINTS_C.accent, color: '#fff',
  fontSize: 13, fontWeight: 700, textDecoration: 'none',
};

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: `${SP.xxxl}px ${SP.xxxl}px ${SP.xxxl + SP.lg}px`,
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    background: C.bg, minHeight: '100vh', color: C.text,
  },
  inner: { maxWidth: 760, margin: '0 auto' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: SP.sm, fontSize: 12, flexWrap: 'wrap', rowGap: 4, minWidth: 0 },
  crumbLink: { color: C.muted, textDecoration: 'none', fontWeight: 500 },
  crumbCurrent: { color: C.text, fontWeight: 600 },
  backBtn: {
    width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.cardBorder}`,
    background: '#fff', cursor: 'pointer', color: C.muted, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 12,
  },
  // Single container card wrapping hero + description + footer.
  card: {
    marginTop: SP.xl,
    padding: SP.xl,
    background: C.card, border: `1px solid ${C.cardBorder}`,
    borderRadius: 14, boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
  },
  eyebrow: {
    fontSize: 10, fontWeight: 700, color: C.muted,
    textTransform: 'uppercase' as const, letterSpacing: '0.1em',
  },
  heading: {
    margin: '4px 0 0', fontSize: 24, fontWeight: 800, color: C.text,
    letterSpacing: '-0.025em', lineHeight: 1.15,
  },
  subheading: {
    margin: '6px 0 0', fontSize: 14, fontWeight: 500, color: C.muted,
    lineHeight: 1.55,
  },
};
