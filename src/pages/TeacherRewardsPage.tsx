import { useState, useReducer } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronRight, faChevronLeft, faSackDollar,
  faArrowUp, faArrowDown, faGift, faBolt,
  faBullseye, faXmark, faArrowRight,
} from '@fortawesome/free-solid-svg-icons';
import { fetchTeachers } from '../api/planner.js';
import {
  pointsBalance, pointTransactions, myRewards,
  rewardCatalog, getGoal, clearGoal,
  RedeemedReward, RedemptionStatus,
} from '../data/pointsRewardsMock.js';

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — kept local so the Rewards surface owns its dialect
// (violet points currency) without leaking into the rest of the app.
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eceef2',
  cardBorderHover: '#d8dde7',
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
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  dangerBorder: '#fecaca',
  slate: '#475569',
  slateSoft: '#f1f5f9',
};

const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

// Points-specific palette — violet so points read as a distinct
// currency from the page's other surfaces (RM is gold/green/blue).
const POINTS_C = {
  accent: '#7c3aed',
  soft: '#f5f3ff',
  border: '#ddd6fe',
  deep: '#5b21b6',
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Map redemption status → badge palette + label. Keeps the My Rewards
// section consistent with the rest of the page's badge grammar.
function statusBadge(status: RedemptionStatus): { label: string; bg: string; color: string; border: string } {
  switch (status) {
    case 'available': return { label: 'Available', bg: POINTS_C.soft,    color: POINTS_C.accent, border: POINTS_C.border };
    case 'pending':   return { label: 'Pending',   bg: C.warningSoft,   color: C.warning,        border: C.warningBorder };
    case 'delivered': return { label: 'Delivered', bg: C.successSoft,   color: C.success,        border: C.successBorder };
    case 'used':      return { label: 'Used',      bg: C.slateSoft,     color: C.slate,          border: '#e2e8f0' };
    case 'expired':   return { label: 'Expired',   bg: C.dangerSoft,    color: C.danger,         border: C.dangerBorder };
  }
}

type ActivityFilter = 'all' | 'earned' | 'redeemed';
type MyRewardsFilter = 'all' | 'available' | 'used';
const RECENT_ACTIVITY_LIMIT = 5;

export default function TeacherRewardsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: teachers = [] } = useQuery({
    queryKey: ['planner-teachers'],
    queryFn: fetchTeachers,
  });
  const teacher = (teachers as any[]).find(t => t.id === id);

  // Local UI state — filters for both lists + recent-activity expand.
  // Details for individual redemptions live on their own page now, so
  // no modal state needed.
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [myRewardsFilter, setMyRewardsFilter] = useState<MyRewardsFilter>('all');
  // Force re-render after clearing the pinned goal (mutates module state).
  const [, bumpGoal] = useReducer((x: number) => x + 1, 0);

  return (
    <div style={s.page}>
      <style>{`
        .trew-back-btn:hover { background: #f1f5f9 !important; color: ${C.text} !important; border-color: #cbd5e1 !important; }
        .trew-link:hover { text-decoration: underline; text-underline-offset: 2px; }
        .trew-filter-pill { transition: background 120ms ease, color 120ms ease, border-color 120ms ease; }
        .trew-filter-pill:hover { background: ${C.slateSoft}; }
        .trew-cta { transition: background 160ms ease; }
        .trew-cta:hover { background: ${POINTS_C.deep}; }
        .trew-cta-ghost { transition: background 140ms ease, border-color 140ms ease; }
        .trew-cta-ghost:hover { background: ${POINTS_C.soft}; border-color: ${POINTS_C.accent}; }
      `}</style>

      <div style={s.inner}>
        {/* Breadcrumb */}
        <div style={s.breadcrumb}>
          <button onClick={() => navigate(`/teachers/${id}/compensation`)} className="trew-back-btn" style={s.backBtn} title="Back">
            <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 11 }} />
          </button>
          <Link to="/teachers" style={s.crumbLink}>Teachers</Link>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
          <Link to={`/teachers/${id}`} style={s.crumbLink}>{teacher?.name ?? '...'}</Link>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
          <Link to={`/teachers/${id}/compensation`} style={s.crumbLink}>Compensation</Link>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
          <span style={s.crumbCurrent}>Rewards</span>
        </div>

        {/* Page header */}
        <div style={{ marginTop: SP.xl, marginBottom: SP.lg }}>
          <div style={s.eyebrow}>Points & Rewards</div>
          <h1 style={s.heading}>{teacher?.name ? `${teacher.name}'s Rewards` : 'Rewards'}</h1>
          <p style={s.subheading}>
            Earn points through teaching activity. Redeem them for perks and track everything you&apos;ve claimed.
          </p>
        </div>

        <BalanceHero teacherId={id!} />

        {/* Goal motivation — only renders when the teacher has pinned
            a reward from the catalog as their current goal. Sits just
            below the balance hero so they always see what they're
            saving toward when they land on the rewards page. */}
        <MyGoalCard teacherId={id!} onCleared={bumpGoal} />

        {/* Sectioned layout — Owned items first (My Rewards), then
            the ledger (Recent Activity). The two reference surfaces —
            "how to earn" and "redeem catalog" — live on their own
            pages reached from the hero CTAs so this page stays
            focused on what's already happened. */}
        <div style={s.sectionStack}>
          <MyRewards
            teacherId={id!}
            filter={myRewardsFilter}
            onFilterChange={setMyRewardsFilter}
          />
          <RecentActivity
            filter={activityFilter}
            onFilterChange={setActivityFilter}
            showAll={showAllActivity}
            onToggleShowAll={() => setShowAllActivity(v => !v)}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Balance hero ─────────────────────────────────────────────────────────

function BalanceHero({ teacherId }: { teacherId: string }) {
  return (
    <div className="trew-card" style={{
      ...s.card,
      padding: SP.xxl,
      background: `linear-gradient(135deg, ${POINTS_C.soft} 0%, #fff 65%)`,
      border: `1px solid ${POINTS_C.border}`,
    }}>
      {/* Three regions: identity (icon + balance), divider, secondary
          stats inline, then the View Catalog CTA pinned to the far
          right. On narrow widths everything wraps to its own row. */}
      <div style={{
        display: 'flex', alignItems: 'center',
        flexWrap: 'wrap', gap: SP.xl,
      }}>
        {/* Identity — icon + balance label + big number */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#fff', color: POINTS_C.accent,
            border: `1px solid ${POINTS_C.border}`,
            fontSize: 20, flexShrink: 0,
            boxShadow: `0 1px 2px ${POINTS_C.accent}1a, 0 4px 14px ${POINTS_C.accent}1f`,
          }}>
            <FontAwesomeIcon icon={faSackDollar} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 10, fontWeight: 800, color: POINTS_C.accent,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              marginBottom: 4,
            }}>
              Points Balance
            </div>
            <div style={{
              fontSize: 36, fontWeight: 800, color: POINTS_C.deep,
              letterSpacing: '-0.03em', lineHeight: 1.05,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {pointsBalance.current.toLocaleString('en-MY')}
              <span style={{
                fontSize: 14, fontWeight: 700, color: C.muted,
                marginLeft: 6, letterSpacing: '0.02em',
              }}>pts</span>
            </div>
          </div>
        </div>

        {/* Inline stats — compact metadata, divided by hairlines. Sits
            between identity and CTA so the eye flows left → right
            without the giant whitespace gap the old layout had. */}
        <div style={{
          display: 'flex', alignItems: 'center',
          gap: SP.lg, flexWrap: 'wrap',
        }}>
          <InlineStat label="Earned this month" value={`+${pointsBalance.earnedThisMonth.toLocaleString('en-MY')} pts`} tone="success" />
          <span style={{ width: 1, height: 28, background: POINTS_C.border, alignSelf: 'center' }} aria-hidden />
          <InlineStat label="Lifetime earned" value={`${pointsBalance.lifetimeEarned.toLocaleString('en-MY')} pts`} />
        </div>

        {/* Spacer pushes the CTA group to the right on wide widths;
            on narrow widths everything just wraps. */}
        <div style={{ flex: 1, minWidth: 0 }} />

        {/* CTA pair — secondary "How to earn" (informational) +
            primary "View redeem catalog" (action). Two distinct
            destinations, each on its own page. */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          <Link
            to={`/teachers/${teacherId}/rewards/earn`}
            className="trew-cta-ghost"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 14px', borderRadius: 10,
              background: '#fff', color: POINTS_C.deep,
              border: `1px solid ${POINTS_C.border}`,
              fontSize: 13, fontWeight: 700, textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            <FontAwesomeIcon icon={faBolt} style={{ fontSize: 12 }} />
            How to earn
          </Link>
          <Link
            to={`/teachers/${teacherId}/rewards/catalog`}
            className="trew-cta"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 10,
              background: POINTS_C.accent, color: '#fff',
              fontSize: 13, fontWeight: 700, textDecoration: 'none',
              boxShadow: `0 1px 2px ${POINTS_C.accent}30, 0 4px 12px ${POINTS_C.accent}24`,
              flexShrink: 0,
            }}
          >
            <FontAwesomeIcon icon={faGift} style={{ fontSize: 12 }} />
            Redeem rewards
            <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 10 }} />
          </Link>
        </div>
      </div>
    </div>
  );
}

// Inline stat — single-line "LABEL · value" pair. Lighter visual
// weight than a bordered card so the balance keeps the spotlight.
function InlineStat({ label, value, tone = 'default' }: {
  label: string; value: string;
  tone?: 'default' | 'success';
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{
        fontSize: 9, fontWeight: 800, color: C.muted,
        textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>
        {label}
      </div>
      <div style={{
        marginTop: 2,
        fontSize: 16, fontWeight: 800,
        color: tone === 'success' ? C.success : C.text,
        fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.015em',
        whiteSpace: 'nowrap',
      }}>
        {value}
      </div>
    </div>
  );
}

// ─── My Goal (motivation card) ────────────────────────────────────────────
// Surfaces the teacher's pinned reward goal between the balance hero
// and the owned-rewards list. Self-hiding when no goal is set or the
// goal has become affordable / inactive — we don't want a stale
// "saving for X" message after the teacher has already redeemed it.

function MyGoalCard({ teacherId, onCleared }: {
  teacherId: string;
  onCleared: () => void;
}) {
  const goal = getGoal();
  const item = goal
    ? rewardCatalog.find(r => r.id === goal.rewardId && r.active)
    : undefined;

  if (!item) return null;
  // Goal already reached — surface a quick "ready to redeem" call to
  // action instead of progress, then clear itself when the teacher
  // acts. We keep it rendered (not hidden) so the teacher gets the
  // payoff for hitting their target.
  const reached = pointsBalance.current >= item.cost;
  const progressPct = reached
    ? 100
    : Math.max(1, Math.round((pointsBalance.current / item.cost) * 100));
  const need = reached ? 0 : item.cost - pointsBalance.current;
  // `from=rewards` tells the details page to send the user back here
  // instead of to the catalog when they hit Back / "Back to …".
  const detailsHref = `/teachers/${teacherId}/rewards/catalog/${item.id}?from=rewards`;

  const accentColor = reached ? C.success : POINTS_C.deep;

  return (
    <div
      style={{
        marginTop: SP.md,
        padding: SP.lg,
        background: reached
          ? `linear-gradient(135deg, ${C.successSoft} 0%, #fff 70%)`
          : `linear-gradient(135deg, ${POINTS_C.soft} 0%, #fdfcff 60%, #fff 100%)`,
        border: `1px solid ${reached ? C.successBorder : POINTS_C.border}`,
        borderRadius: 14,
        boxShadow: '0 1px 2px rgba(91,33,182,0.04)',
      }}
    >
      <style>{`
        .trew-goal-clear:hover { color: ${C.text} !important; background: ${C.slateSoft} !important; }
        .trew-goal-link:hover { color: ${POINTS_C.deep} !important; }
      `}</style>

      {/* Identity row — icon + eyebrow/title/sub on the left, Remove
          anchored top-right. The standalone cost is intentionally
          omitted — the progress row below already shows the target
          inline as "1,250 / 4,000 pts", so a duplicate big number
          here was reading as a second balance and competing with the
          progress stats. */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#fff', color: reached ? C.success : POINTS_C.accent,
          border: `1px solid ${reached ? C.successBorder : POINTS_C.border}`,
          fontSize: 17, flexShrink: 0,
          boxShadow: '0 1px 2px rgba(91,33,182,0.05)',
        }}>
          <FontAwesomeIcon icon={item.icon} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 10, fontWeight: 800,
            color: accentColor,
            textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>
            <FontAwesomeIcon icon={faBullseye} style={{ fontSize: 10 }} />
            {reached ? 'Goal reached' : 'Saving toward'}
          </div>
          <div style={{
            marginTop: 2,
            fontSize: 16, fontWeight: 800, color: C.text,
            letterSpacing: '-0.015em', lineHeight: 1.2,
          }}>
            {item.label}
          </div>
          {item.sub && (
            <div style={{
              marginTop: 2, fontSize: 12, fontWeight: 500, color: C.textSub,
              lineHeight: 1.4,
            }}>
              {item.sub}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => { clearGoal(); onCleared(); }}
          className="trew-goal-clear"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 999,
            background: 'transparent', color: C.muted,
            border: `1px solid ${C.cardBorder}`,
            fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
            cursor: 'pointer', flexShrink: 0,
            transition: 'background 140ms ease, color 140ms ease',
          }}
          title="Stop tracking this as your goal"
        >
          <FontAwesomeIcon icon={faXmark} style={{ fontSize: 9 }} />
          Remove
        </button>
      </div>

      {/* Progress bar — full width below the identity block. */}
      <div style={{ marginTop: SP.md }}>
        <div style={{
          position: 'relative',
          height: 8, borderRadius: 999,
          background: '#fff',
          border: `1px solid ${reached ? C.successBorder : POINTS_C.border}`,
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', insetBlock: 0, left: 0,
            width: `${progressPct}%`,
            background: reached
              ? `linear-gradient(90deg, ${C.success}, #047857)`
              : `linear-gradient(90deg, ${POINTS_C.accent}, ${POINTS_C.deep})`,
            borderRadius: 999,
            transition: 'width 240ms ease',
          }} />
        </div>

        {/* Stats row — progress percentage on the left, gap +
            View details affordance on the right. The teacher's raw
            balance isn't repeated here; it already lives in the
            balance hero above, and showing "1,250 / 4,000" again was
            making the goal card visually echo the hero. Keeping only
            the percentage + gap lets the goal card own "progress
            toward target" without competing for the same attention. */}
        <div style={{
          marginTop: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, flexWrap: 'wrap',
        }}>
          <span style={{
            fontSize: 12, fontWeight: 600, color: C.muted,
            fontVariantNumeric: 'tabular-nums',
          }}>
            <span style={{ color: accentColor, fontWeight: 800 }}>{progressPct}%</span>
            <span style={{ color: C.mutedSoft, fontWeight: 600, margin: '0 6px' }}>of</span>
            {item.cost.toLocaleString('en-MY')} pts
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            fontSize: 12, fontWeight: 600, color: C.muted,
          }}>
            {reached
              ? <span style={{ color: C.success, fontWeight: 800 }}>You can redeem this now!</span>
              : <span>Need <span style={{ color: POINTS_C.deep, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                  {need.toLocaleString('en-MY')}
                </span> more pts</span>}
            <Link
              to={detailsHref}
              className="trew-goal-link"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                color: POINTS_C.accent, fontWeight: 800,
                textDecoration: 'none',
                transition: 'color 140ms ease',
              }}
            >
              {reached ? 'Redeem now' : 'View details'}
              <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 10 }} />
            </Link>
          </span>
        </div>

        {/* Motivational microcopy — single subtle line below the
            detailed stats. Softer than the figure-heavy row above so
            it reads as the brand voice, not another data point. */}
        <div style={{
          marginTop: 8,
          fontSize: 12, fontWeight: 500, color: C.muted,
          fontStyle: 'italic',
          lineHeight: 1.45,
        }}>
          {reached
            ? 'Nice work — your reward is ready to redeem.'
            : `Keep earning — you're ${progressPct}% there.`}
        </div>
      </div>
    </div>
  );
}

// ─── Recent Activity ──────────────────────────────────────────────────────

function RecentActivity({
  filter, onFilterChange, showAll, onToggleShowAll,
}: {
  filter: ActivityFilter;
  onFilterChange: (f: ActivityFilter) => void;
  showAll: boolean;
  onToggleShowAll: () => void;
}) {
  const filtered = pointTransactions.filter(t => {
    if (filter === 'earned')   return t.kind === 'earned';
    if (filter === 'redeemed') return t.kind === 'redeemed';
    return true;
  });
  const visible = showAll ? filtered : filtered.slice(0, RECENT_ACTIVITY_LIMIT);
  const hasMore = filtered.length > RECENT_ACTIVITY_LIMIT;

  return (
    <div className="trew-card" style={s.card}>
      <SectionHeader
        title="Recent activity"
        sub="Earn and redeem transactions, newest first."
        tone="muted"
        right={
          <div style={{ display: 'inline-flex', gap: 4 }}>
            <FilterPill active={filter === 'all'} onClick={() => onFilterChange('all')}>All</FilterPill>
            <FilterPill active={filter === 'earned'} onClick={() => onFilterChange('earned')}>Earned</FilterPill>
            <FilterPill active={filter === 'redeemed'} onClick={() => onFilterChange('redeemed')}>Redeemed</FilterPill>
          </div>
        }
      />

      {visible.length === 0 ? (
        <div style={s.emptyInline}>
          No {filter === 'all' ? '' : filter} activity yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Column header row — labels the otherwise-unlabelled
              "amount" and "balance" columns so the rightmost number
              isn't just a floating figure the teacher has to decode. */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '32px minmax(0, 1fr) 100px 90px',
            gap: 10, alignItems: 'center',
            padding: '4px 0 8px',
            fontSize: 9, fontWeight: 800, color: C.muted,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            borderBottom: `1px solid ${C.divider}`,
          }}>
            <span />
            <span>Activity</span>
            <span style={{ textAlign: 'right' }}>Amount</span>
            <span style={{ textAlign: 'right' }}>Balance</span>
          </div>
          {visible.map((tx, i) => {
            const isEarn = tx.kind === 'earned';
            const arrowColor = isEarn ? C.success : C.danger;
            const arrowBg = isEarn ? C.successSoft : '#fef2f2';
            return (
              <div key={tx.id} style={{
                display: 'grid',
                gridTemplateColumns: '32px minmax(0, 1fr) 100px 90px',
                gap: 10, alignItems: 'center',
                padding: '10px 0',
                borderTop: i === 0 ? 'none' : `1px solid ${C.divider}`,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: arrowBg, color: arrowColor,
                  fontSize: 11, flexShrink: 0,
                }}>
                  <FontAwesomeIcon icon={isEarn ? faArrowUp : faArrowDown} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: C.text,
                    letterSpacing: '-0.005em',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {tx.label}
                  </div>
                  <div style={{
                    marginTop: 1, fontSize: 11, color: C.mutedSoft, fontWeight: 500,
                  }}>
                    {fmtDate(tx.date)}
                  </div>
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 800,
                  color: isEarn ? C.success : C.danger,
                  fontVariantNumeric: 'tabular-nums',
                  textAlign: 'right',
                }}>
                  {tx.delta > 0 ? '+' : '−'}{Math.abs(tx.delta).toLocaleString('en-MY')}
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: C.muted, marginLeft: 3,
                  }}>pts</span>
                </div>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: C.muted,
                  fontVariantNumeric: 'tabular-nums', textAlign: 'right',
                }}>
                  {tx.balanceAfter.toLocaleString('en-MY')}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div style={{
          marginTop: 12, paddingTop: 12,
          borderTop: `1px solid ${C.divider}`,
          textAlign: 'center',
        }}>
          <button
            type="button"
            onClick={onToggleShowAll}
            className="trew-link"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: POINTS_C.accent, fontWeight: 700, fontSize: 12,
              fontFamily: 'inherit',
            }}
          >
            {showAll ? 'Show less' : `View all activity (${filtered.length})`}
          </button>
        </div>
      )}
    </div>
  );
}

function FilterPill({
  active, onClick, children,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="trew-filter-pill"
      style={{
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 11, fontWeight: 700,
        background: active ? POINTS_C.soft : 'transparent',
        color: active ? POINTS_C.accent : C.muted,
        border: `1px solid ${active ? POINTS_C.border : 'transparent'}`,
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

// ─── My Rewards (redeemed) ────────────────────────────────────────────────

function MyRewards({ teacherId, filter, onFilterChange }: {
  teacherId: string;
  filter: MyRewardsFilter;
  onFilterChange: (f: MyRewardsFilter) => void;
}) {
  // Filter mapping — "Used" buckets 'used' (voucher consumed) and
  // 'delivered' (item received) since both mean "redemption complete
  // from the teacher's perspective". 'pending' and 'expired' stay
  // visible only in "All" — not every reward expires, so a dedicated
  // Expired filter would mostly stay empty.
  const matchesFilter = (r: RedeemedReward) => {
    if (filter === 'all') return true;
    if (filter === 'available') return r.status === 'available';
    if (filter === 'used')      return r.status === 'used' || r.status === 'delivered';
    return true;
  };
  const filtered = myRewards.filter(matchesFilter);

  return (
    <div className="trew-card" style={s.card}>
      <SectionHeader
        title="My rewards"
        sub="Your reward wallet — rewards you've already claimed. Tap a card for voucher codes, instructions, and redemption details."
        right={
          <div style={{ display: 'inline-flex', gap: 4 }}>
            <FilterPill active={filter === 'all'}       onClick={() => onFilterChange('all')}>All</FilterPill>
            <FilterPill active={filter === 'available'} onClick={() => onFilterChange('available')}>Available</FilterPill>
            <FilterPill active={filter === 'used'}      onClick={() => onFilterChange('used')}>Used</FilterPill>
          </div>
        }
      />

      {filtered.length === 0 ? (
        <div style={s.emptyInline}>
          {myRewards.length === 0
            ? 'Nothing redeemed yet. Spend points from the catalog to start your collection.'
            : `No ${filter === 'all' ? '' : filter} rewards.`}
        </div>
      ) : (
        <div style={{
          display: 'grid', gap: 10,
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        }}>
          {filtered.map(r => {
            const badge = statusBadge(r.status);
            return (
              <Link
                key={r.id}
                to={`/teachers/${teacherId}/rewards/my/${r.id}`}
                className="trew-mr-card"
                style={{
                  padding: 14,
                  background: C.card,
                  border: `1px solid ${C.divider}`,
                  borderRadius: 12,
                  display: 'flex', flexDirection: 'column', gap: 10,
                  textDecoration: 'none', color: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: POINTS_C.soft, color: POINTS_C.accent,
                    border: `1px solid ${POINTS_C.border}`,
                    fontSize: 14, flexShrink: 0,
                  }}>
                    <FontAwesomeIcon icon={r.icon} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 700, color: C.text,
                      letterSpacing: '-0.008em',
                    }}>
                      {r.label}
                    </div>
                    <div style={{
                      marginTop: 2, fontSize: 11, fontWeight: 500, color: C.mutedSoft,
                    }}>
                      Redeemed {fmtDate(r.redeemedDate)}
                    </div>
                  </div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '2px 8px 2px 7px', height: 20, borderRadius: 999,
                    fontSize: 10, fontWeight: 700,
                    background: badge.bg, color: badge.color,
                    border: `1px solid ${badge.border}`,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    flexShrink: 0,
                  }}>
                    {/* Status dot — solid for actionable states
                        (available/pending), hollow for terminal states
                        (used/delivered/expired) so the eye picks up
                        "still claimable" vs "history" at a glance. */}
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: r.status === 'available' || r.status === 'pending' ? badge.color : 'transparent',
                      border: `1.5px solid ${badge.color}`,
                      flexShrink: 0,
                    }} />
                    {badge.label}
                  </span>
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 8, paddingTop: 8, borderTop: `1px solid ${C.divider}`,
                }}>
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: C.muted,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    <span style={{ color: POINTS_C.deep, fontWeight: 800 }}>
                      −{r.pointsSpent.toLocaleString('en-MY')}
                    </span>
                    <span style={{ marginLeft: 4 }}>pts spent</span>
                  </span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 12, fontWeight: 700,
                    color: POINTS_C.accent,
                  }}>
                    View details
                    <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9 }} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Shared section header ────────────────────────────────────────────────

function SectionHeader({
  title, sub, right, tone = 'primary',
}: {
  title: string; sub?: string; right?: React.ReactNode;
  /** 'primary' uses the violet brand accent (My Rewards). 'muted'
   *  uses a quieter slate accent so secondary sections like Recent
   *  Activity sit visually below the primary sections without losing
   *  the section-header pattern. */
  tone?: 'primary' | 'muted';
}) {
  const accent = tone === 'muted' ? C.mutedSoft : POINTS_C.accent;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: 12, marginBottom: 14, flexWrap: 'wrap',
    }}>
      <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ width: 3, height: 14, borderRadius: 999, background: accent, flexShrink: 0, marginTop: 3 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{
            margin: 0, fontSize: 14, fontWeight: 800, color: C.text,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {title}
          </h3>
          {sub && (
            <p style={{
              margin: '4px 0 0', fontSize: 12, fontWeight: 500, color: C.muted,
              lineHeight: 1.45, textTransform: 'none', letterSpacing: 'normal',
            }}>
              {sub}
            </p>
          )}
        </div>
      </div>
      {right}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: `${SP.xxxl}px ${SP.xxxl}px ${SP.xxxl + SP.lg}px`,
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    background: C.bg, minHeight: '100vh', color: C.text,
  },
  inner: { maxWidth: 1440, margin: '0 auto' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: SP.sm, fontSize: 12, flexWrap: 'wrap', rowGap: 4, minWidth: 0 },
  crumbLink: { color: C.muted, textDecoration: 'none', fontWeight: 500 },
  crumbCurrent: { color: C.text, fontWeight: 600 },
  backBtn: {
    width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.cardBorder}`,
    background: '#fff', cursor: 'pointer', color: C.muted, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 12,
  },
  eyebrow: {
    fontSize: 10, fontWeight: 700, color: C.muted,
    textTransform: 'uppercase' as const, letterSpacing: '0.1em',
  },
  heading: {
    margin: '4px 0 0', fontSize: 26, fontWeight: 800, color: C.text,
    letterSpacing: '-0.025em', lineHeight: 1.15,
  },
  subheading: {
    margin: '6px 0 0', fontSize: 13, fontWeight: 500, color: C.muted,
    lineHeight: 1.55, maxWidth: 640,
  },
  card: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12,
    padding: `${SP.xxl}px ${SP.xxl}px`,
    boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
  },
  sectionStack: {
    display: 'flex', flexDirection: 'column' as const, gap: SP.md, marginTop: SP.md,
  },
  emptyInline: {
    padding: '24px 12px', textAlign: 'center' as const,
    color: C.muted, fontSize: 13,
  },
};
