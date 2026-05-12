import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronRight, faChevronLeft, faSackDollar, faLock,
  faGem, faGift, faCheck,
} from '@fortawesome/free-solid-svg-icons';
import { fetchTeachers } from '../api/planner.js';
import {
  pointsBalance, rewardCatalog, stockMeta,
  REWARD_CATEGORY_META,
} from '../data/pointsRewardsMock.js';
import type { RewardCategory, RewardItem } from '../data/pointsRewardsMock.js';

// ─────────────────────────────────────────────────────────────────────────────
// Standalone catalog page reached from the "View redeem catalog" CTA
// on /teachers/:id/rewards. Items are split into two groups by
// affordability so the teacher's eye lands on what's claimable now,
// then on what to save up for — locked rewards carry a progress bar
// so they feel motivating rather than discouraging.
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

// Anything at or above this cost picks up the "Premium reward" pill.
// Locked items at or above 1.5× the threshold are labelled "Big goal"
// to set a stronger aspirational tone for the rare top-tier items.
const PREMIUM_THRESHOLD = 2000;
const BIG_GOAL_THRESHOLD = 3000;

type FilterKey = 'all' | RewardCategory;

export default function TeacherRedeemCatalogPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: teachers = [] } = useQuery({
    queryKey: ['planner-teachers'],
    queryFn: fetchTeachers,
  });
  const teacher = (teachers as any[]).find(t => t.id === id);
  const [filter, setFilter] = useState<FilterKey>('all');
  // Independent toggle layered on top of the category filter. Hides
  // the "Save up to unlock" group so the teacher can scan only what
  // they can act on right now.
  const [affordableOnly, setAffordableOnly] = useState(false);

  // Categories that actually have items — drives the filter chip row
  // so we never show a chip that filters to nothing.
  const availableCategories = useMemo<RewardCategory[]>(() => {
    const order: RewardCategory[] = ['food', 'wellness', 'merch', 'leave', 'experience', 'other'];
    const present = new Set<RewardCategory>();
    rewardCatalog
      .filter(i => i.active)
      .forEach(i => { if (i.category) present.add(i.category); });
    return order.filter(c => present.has(c));
  }, []);

  // Only active items reach teachers. Apply the category filter first,
  // then split by affordability. Within each group sort by cost
  // ascending: cheapest claimable first (most flexible), closest to
  // unlocked first (most motivating).
  const active = rewardCatalog.filter(i => i.active);
  const filtered = filter === 'all'
    ? active
    : active.filter(i => i.category === filter);

  const canRedeem = filtered
    .filter(i => pointsBalance.current >= i.cost)
    .slice()
    .sort((a, b) => a.cost - b.cost);
  const cannotRedeem = affordableOnly
    ? []
    : filtered
        .filter(i => pointsBalance.current < i.cost)
        .slice()
        .sort((a, b) => a.cost - b.cost);


  const stockChip = (st: 'in' | 'limited' | 'out') => {
    const meta = stockMeta(st);
    return meta.palette === 'success' ? { text: meta.text, color: C.success, bg: C.successSoft, border: C.successBorder }
      :    meta.palette === 'warning' ? { text: meta.text, color: C.warning, bg: C.warningSoft, border: C.warningBorder }
      :                                 { text: meta.text, color: C.muted,   bg: C.slateSoft,   border: '#e2e8f0' };
  };

  return (
    <div style={s.page}>
      <style>{`
        .trc-back-btn:hover { background: #f1f5f9 !important; color: ${C.text} !important; border-color: #cbd5e1 !important; }
        .trc-chip { transition: background 140ms ease, border-color 140ms ease, color 140ms ease; }
        .trc-chip:hover { border-color: ${POINTS_C.border}; color: ${POINTS_C.deep}; }
        .trc-chip[data-active="true"]:hover { background: ${POINTS_C.deep}; }
        .trc-redeem-btn:hover { background: ${POINTS_C.deep} !important; }
        .trc-goal-btn:hover { background: ${POINTS_C.soft} !important; border-color: ${POINTS_C.accent} !important; color: ${POINTS_C.deep} !important; }
      `}</style>

      <div style={s.inner}>
        <div style={s.breadcrumb}>
          <button onClick={() => navigate(`/teachers/${id}/rewards`)} className="trc-back-btn" style={s.backBtn} title="Back">
            <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 11 }} />
          </button>
          <Link to="/teachers" style={s.crumbLink}>Teachers</Link>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
          <Link to={`/teachers/${id}`} style={s.crumbLink}>{teacher?.name ?? '...'}</Link>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
          <Link to={`/teachers/${id}/rewards`} style={s.crumbLink}>Rewards</Link>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
          <span style={s.crumbCurrent}>Redeem rewards</span>
        </div>

        {/* Header — title on the left, compact balance chip on the right
            so the teacher always knows their spending power without
            scrolling back to the rewards page. */}
        <div style={s.header}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={s.eyebrow}>Points & Rewards</div>
            <h1 style={s.heading}>Redeem rewards</h1>
            <p style={s.subheading}>
              Spend your points on the rewards below. Items you can&apos;t afford yet stay visible with a progress bar so you can see how close you are.
            </p>
          </div>
          <div style={s.balanceChip}>
            <FontAwesomeIcon icon={faSackDollar} style={{ fontSize: 13, color: POINTS_C.accent }} />
            <span style={{
              fontSize: 18, fontWeight: 800, color: POINTS_C.deep,
              fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.015em',
            }}>
              {pointsBalance.current.toLocaleString('en-MY')}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '0.02em' }}>
              pts
            </span>
          </div>
        </div>

        {/* Filter chips — category chips on the left, "Affordable only"
            toggle pushed to the right as a separate concept. Hidden
            entirely when there's only one category to filter on. */}
        {availableCategories.length > 1 && (
          <div style={s.chipRow}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, flex: 1, minWidth: 0 }}>
              <FilterChip
                label="All"
                count={active.length}
                active={filter === 'all'}
                onClick={() => setFilter('all')}
              />
              {availableCategories.map(cat => {
                const count = active.filter(i => i.category === cat).length;
                return (
                  <FilterChip
                    key={cat}
                    label={REWARD_CATEGORY_META[cat].label}
                    count={count}
                    active={filter === cat}
                    onClick={() => setFilter(cat)}
                  />
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setAffordableOnly(v => !v)}
              className="trc-chip"
              data-active={affordableOnly}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', height: 30, borderRadius: 999,
                background: affordableOnly ? POINTS_C.accent : '#fff',
                color: affordableOnly ? '#fff' : C.textSub,
                border: `1px solid ${affordableOnly ? POINTS_C.accent : C.cardBorder}`,
                fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              <FontAwesomeIcon icon={faCheck} style={{
                fontSize: 9,
                opacity: affordableOnly ? 1 : 0.45,
              }} />
              Affordable only
            </button>
          </div>
        )}

        {/* Grouped catalog — claimable section first, locked section
            below with progress bars. Empty filter result falls back to
            a small inline message so the teacher knows the filter is
            the reason, not an empty catalog. */}
        {canRedeem.length + cannotRedeem.length === 0 ? (
          <div style={s.emptyState}>
            {filter === 'all'
              ? 'No rewards available right now. Check back later.'
              : 'No rewards match this filter. Try another category.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xxxl }}>
            {canRedeem.length > 0 && (
              <CatalogGroup
                label="Available to redeem"
                description="Rewards you can claim with your current points balance."
                count={canRedeem.length}
                tone="success"
                items={canRedeem}
                stockChip={stockChip}
                teacherId={id!}
                locked={false}
                isFirst
              />
            )}
            {cannotRedeem.length > 0 && (
              <CatalogGroup
                label="Save up to unlock"
                description="Rewards you are working towards. Keep earning to close the gap."
                count={cannotRedeem.length}
                tone="muted"
                items={cannotRedeem}
                stockChip={stockChip}
                teacherId={id!}
                locked
                isFirst={canRedeem.length === 0}
              />
            )}
          </div>
        )}
      </div>

    </div>
  );
}

// ─── Filter chip ──────────────────────────────────────────────────────────

function FilterChip({ label, count, active, onClick }: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="trc-chip"
      data-active={active}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', height: 30, borderRadius: 999,
        background: active ? POINTS_C.accent : '#fff',
        color: active ? '#fff' : C.textSub,
        border: `1px solid ${active ? POINTS_C.accent : C.cardBorder}`,
        fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
        cursor: 'pointer',
        letterSpacing: '0.005em',
      }}
    >
      {label}
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 18, height: 16, padding: '0 5px',
        borderRadius: 999, fontSize: 10, fontWeight: 800,
        background: active ? 'rgba(255,255,255,0.22)' : C.slateSoft,
        color: active ? '#fff' : C.muted,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {count}
      </span>
    </button>
  );
}

// ─── Catalog group ────────────────────────────────────────────────────────

function CatalogGroup({
  label, description, count, tone, items, stockChip, teacherId, locked, isFirst,
}: {
  label: string;
  description: string;
  count: number;
  /** Tints the group's accent bar + count chip. */
  tone: 'success' | 'muted';
  items: typeof rewardCatalog;
  stockChip: (st: 'in' | 'limited' | 'out') =>
    { text: string; color: string; bg: string; border: string };
  teacherId: string;
  /** Whether this group's items are above the teacher's current
   *  balance. Drives the locked card variant. */
  locked: boolean;
  isFirst?: boolean;
}) {
  const palette = tone === 'success'
    ? { accent: C.success, soft: C.successSoft, border: C.successBorder }
    : { accent: C.muted,   soft: C.slateSoft,   border: '#e2e8f0' };

  return (
    <section style={{
      paddingTop: isFirst ? 0 : SP.lg,
      borderTop: isFirst ? 'none' : `1px solid ${C.cardBorder}`,
    }}>
      <div style={s.groupHeader}>
        <span style={{ width: 4, height: 22, borderRadius: 999, background: palette.accent, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={s.groupTitle}>{label}</h2>
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '1px 8px', height: 20, borderRadius: 999,
              fontSize: 10, fontWeight: 800,
              background: palette.soft, color: palette.accent,
              border: `1px solid ${palette.border}`,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {count}
            </span>
          </div>
          <p style={s.groupSub}>{description}</p>
        </div>
      </div>
      <div style={s.grid}>
        {items.map(item => (
          <RewardCard
            key={item.id}
            item={item}
            locked={locked}
            stockChip={stockChip}
            teacherId={teacherId}
          />
        ))}
      </div>
    </section>
  );
}

// ─── Reward card ──────────────────────────────────────────────────────────

function RewardCard({ item, locked, stockChip, teacherId }: {
  item: RewardItem;
  locked: boolean;
  stockChip: (st: 'in' | 'limited' | 'out') =>
    { text: string; color: string; bg: string; border: string };
  teacherId: string;
}) {
  const stock = stockChip(item.stock);
  const outOfStock = item.stock === 'out';
  const isBigGoal = item.cost >= BIG_GOAL_THRESHOLD;
  const isPremium = item.cost >= PREMIUM_THRESHOLD;

  const detailsHref = `/teachers/${teacherId}/rewards/catalog/${item.id}`;

  // Progress for locked items — clamped to 1% min so the bar always
  // shows a sliver of fill (reads as "you've started" instead of
  // empty). Percentage rounded for the on-screen label.
  const progressPct = locked
    ? Math.max(1, Math.round((pointsBalance.current / item.cost) * 100))
    : 100;
  const need = locked ? item.cost - pointsBalance.current : 0;

  return (
    <div style={{
      position: 'relative',
      padding: 18,
      background: C.card,
      border: `1px solid ${C.cardBorder}`,
      borderRadius: 14,
      boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
      display: 'flex', flexDirection: 'column', gap: 14,
      minHeight: locked ? 232 : 200,
    }}>
      {/* Stock pill — anchored to the top-right corner so it reads as
          metadata, not a footer element. */}
      <span style={{
        position: 'absolute', top: 14, right: 14,
        display: 'inline-flex', alignItems: 'center',
        padding: '2px 8px', height: 20, borderRadius: 999,
        fontSize: 9, fontWeight: 800,
        background: stock.bg, color: stock.color,
        border: `1px solid ${stock.border}`,
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        {stock.text}
      </span>

      {/* Icon tile + premium label row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: POINTS_C.soft, color: POINTS_C.accent,
          border: `1px solid ${POINTS_C.border}`,
          fontSize: 19, flexShrink: 0,
        }}>
          <FontAwesomeIcon icon={item.icon} />
        </div>
        {isPremium && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 9px', height: 22, borderRadius: 999,
            fontSize: 10, fontWeight: 800,
            background: POINTS_C.soft, color: POINTS_C.deep,
            border: `1px solid ${POINTS_C.border}`,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            marginTop: 2, flexShrink: 0,
          }}>
            <FontAwesomeIcon icon={faGem} style={{ fontSize: 9 }} />
            {isBigGoal ? 'Big goal' : 'Premium'}
          </span>
        )}
      </div>

      {/* Title + sub */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 15, fontWeight: 700, color: C.text,
          letterSpacing: '-0.01em', lineHeight: 1.25,
        }}>
          {item.label}
        </div>
        {item.sub && (
          <div style={{
            marginTop: 3, fontSize: 12, fontWeight: 500, color: C.muted,
            lineHeight: 1.4,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box' as const,
            WebkitLineClamp: 2 as any,
            WebkitBoxOrient: 'vertical' as any,
          }}>
            {item.sub}
          </div>
        )}
      </div>

      {/* Progress block — only shown for locked items. Bar + the
          current/required figure on top, "need X more" on the bottom.
          Sits above the footer so the footer's cost line stays the
          last horizontal element the eye lands on. */}
      {locked && (
        <div style={{ marginTop: 2 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            marginBottom: 6, gap: 8,
          }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: C.textSub,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {pointsBalance.current.toLocaleString('en-MY')} <span style={{ color: C.mutedSoft }}>/</span> {item.cost.toLocaleString('en-MY')} pts
            </span>
            <span style={{
              fontSize: 11, fontWeight: 800, color: POINTS_C.deep,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {progressPct}%
            </span>
          </div>
          <div style={{
            position: 'relative',
            height: 6, borderRadius: 999,
            background: C.slateSoft,
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              width: `${progressPct}%`,
              background: `linear-gradient(90deg, ${POINTS_C.accent}, ${POINTS_C.deep})`,
              borderRadius: 999,
              transition: 'width 240ms ease',
            }} />
          </div>
          <div style={{
            marginTop: 6,
            fontSize: 11, fontWeight: 600, color: C.muted,
          }}>
            Need <span style={{ color: C.textSub, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
              {need.toLocaleString('en-MY')}
            </span> more pts
          </div>
        </div>
      )}

      {/* Footer — cost on the left, primary action on the right. The
          action varies by state: Redeem (affordable + in stock),
          Out of stock (disabled-style label), or View goal (locked). */}
      <div style={{
        marginTop: 'auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, paddingTop: 12, borderTop: `1px solid ${C.divider}`,
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'baseline', gap: 4,
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 22, fontWeight: 800, color: POINTS_C.deep,
            fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.022em',
            lineHeight: 1,
          }}>
            {item.cost.toLocaleString('en-MY')}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, color: C.muted,
            letterSpacing: '0.02em',
          }}>pts</span>
        </span>

        {locked ? (
          <Link
            to={detailsHref}
            className="trc-goal-btn"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 10,
              background: '#fff', color: C.textSub,
              border: `1px solid ${C.cardBorder}`,
              fontSize: 12, fontWeight: 700,
              textDecoration: 'none',
              transition: 'background 140ms ease, border-color 140ms ease, color 140ms ease',
            }}
          >
            <FontAwesomeIcon icon={faLock} style={{ fontSize: 10 }} />
            View details
          </Link>
        ) : outOfStock ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10,
            background: C.slateSoft, color: C.muted,
            border: `1px solid #e2e8f0`,
            fontSize: 12, fontWeight: 700,
            cursor: 'not-allowed',
          }}>
            Sold out
          </span>
        ) : (
          <Link
            to={detailsHref}
            className="trc-redeem-btn"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 10,
              background: POINTS_C.accent, color: '#fff',
              border: 'none',
              fontSize: 12, fontWeight: 800,
              textDecoration: 'none',
              boxShadow: `0 1px 2px ${POINTS_C.accent}30, 0 4px 12px ${POINTS_C.accent}24`,
              transition: 'background 140ms ease, box-shadow 140ms ease',
            }}
          >
            <FontAwesomeIcon icon={faGift} style={{ fontSize: 10 }} />
            Redeem
          </Link>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: `${SP.xxxl}px ${SP.xxxl}px ${SP.xxxl + SP.lg}px`,
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    background: C.bg, minHeight: '100vh', color: C.text,
  },
  inner: { maxWidth: 1280, margin: '0 auto' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: SP.sm, fontSize: 12, flexWrap: 'wrap', rowGap: 4, minWidth: 0 },
  crumbLink: { color: C.muted, textDecoration: 'none', fontWeight: 500 },
  crumbCurrent: { color: C.text, fontWeight: 600 },
  backBtn: {
    width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.cardBorder}`,
    background: '#fff', cursor: 'pointer', color: C.muted, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 12,
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: SP.md,
    marginTop: SP.xl, marginBottom: SP.lg,
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
  balanceChip: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '8px 14px', borderRadius: 999,
    background: '#fff', border: `1px solid ${POINTS_C.border}`,
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
    flexShrink: 0,
  },
  chipRow: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
    marginBottom: SP.xl,
  },
  emptyState: {
    padding: '48px 24px', textAlign: 'center',
    background: C.card, border: `1px solid ${C.cardBorder}`,
    borderRadius: 14,
    color: C.muted, fontSize: 13,
  },
  grid: {
    display: 'grid', gap: 12,
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  },
  groupHeader: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    marginBottom: SP.lg,
  },
  groupTitle: {
    margin: 0, fontSize: 15, fontWeight: 800, color: C.text,
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
  },
  groupSub: {
    margin: '4px 0 0', fontSize: 12, fontWeight: 500, color: C.muted,
    lineHeight: 1.5,
  },
};
