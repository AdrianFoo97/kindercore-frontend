import { useReducer } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronRight, faPlus, faTrash, faPen, faSackDollar, faGift, faBolt,
  faEye, faChartLine,
} from '@fortawesome/free-solid-svg-icons';
import {
  earningRules, rewardCatalog,
  removeReward, removeRule,
  stockMeta, RULE_CATEGORY_META,
  EarningRule, RewardItem,
} from '../../data/pointsRewardsMock.js';
import { useDeleteDialog } from '../../components/common/DeleteDialog.js';
import { useToast } from '../../components/common/Toast.js';
import { fetchTeachers } from '../../api/planner.js';

// ─── Tokens ───────────────────────────────────────────────────────────────
// Matches the rest of the settings surfaces. Page owns its own palette
// so the points-specific violet doesn't bleed into other pages, but the
// neutrals are aligned with TeacherCompensationPage / TeacherRewardsPage.
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
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
  primaryBorder: '#c7d2fe',
  success: '#059669',
  successSoft: '#ecfdf5',
  successBorder: '#a7f3d0',
  warning: '#d97706',
  warningSoft: '#fffbeb',
  warningBorder: '#fde68a',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  dangerBorder: '#fecaca',
  slateSoft: '#f1f5f9',
};

const POINTS_C = {
  accent: '#7c3aed',
  soft: '#f5f3ff',
  border: '#ddd6fe',
  deep: '#5b21b6',
};

const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
const RADIUS = 12;
const RADIUS_LG = 14;
const SHADOW = '0 1px 2px rgba(15,23,42,0.03)';
const SHADOW_HOVER = '0 1px 2px rgba(15,23,42,0.04), 0 6px 18px rgba(15,23,42,0.05)';

export default function PointsRewardsSettingsPage() {
  // Read directly from the shared mock module — single source of truth
  // across this page, the editor page, and the teacher rewards view.
  // The reducer forces a re-render after a delete or toggle; once a
  // real backend exists, swap to react-query and the manual bump
  // disappears.
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const { confirm } = useDeleteDialog();
  const { showToast } = useToast();

  // First teacher serves as the "preview as a teacher" target. Settings
  // doesn't have its own teacher context, so we deep-link to a real
  // teacher's /rewards page — admins see exactly what teachers see.
  const { data: teachers = [] } = useQuery({
    queryKey: ['planner-teachers'],
    queryFn: fetchTeachers,
  });
  const previewTeacherId = (teachers as any[])[0]?.id ?? null;

  // ── Aggregates for the summary cards ────────────────────────────
  const activeRulesCount = earningRules.filter(r => r.active).length;
  const totalRulesCount = earningRules.length;
  const activeRewardsCount = rewardCatalog.filter(i => i.active).length;
  const totalRewardsCount = rewardCatalog.length;
  const highestRewardCost = rewardCatalog.length === 0
    ? 0
    : Math.max(...rewardCatalog.map(i => i.cost));
  const highestRewardLabel = rewardCatalog.length === 0
    ? null
    : rewardCatalog.reduce((a, b) => (a.cost >= b.cost ? a : b)).label;

  const handleDeleteRule = async (rule: EarningRule) => {
    await confirm({
      entityType: 'Earning rule',
      entityName: rule.label,
      dependencies: [],
      onConfirm: () => { removeRule(rule.id); bump(); showToast('Rule deleted'); },
    });
  };

  const handleDeleteReward = async (reward: RewardItem) => {
    await confirm({
      entityType: 'Reward',
      entityName: reward.label,
      dependencies: [],
      onConfirm: () => { removeReward(reward.id); bump(); showToast('Reward deleted'); },
    });
  };

  return (
    <div style={s.page}>
      <style>{`
        .prs-card { transition: border-color 160ms ease, box-shadow 160ms ease; }
        .prs-card:hover { border-color: ${C.cardBorderHover}; box-shadow: ${SHADOW_HOVER}; }
        .prs-edit:hover { background: ${POINTS_C.soft}; color: ${POINTS_C.accent}; border-color: ${POINTS_C.border}; }
        .prs-trash:hover { background: ${C.danger}; color: #fff; border-color: ${C.danger}; }
        .prs-row { transition: background 120ms ease; }
        .prs-row:hover { background: ${C.slateSoft}; }
        .prs-row:last-child { border-bottom: none; }
        .prs-btn-primary:hover { background: ${POINTS_C.deep}; box-shadow: 0 4px 12px ${POINTS_C.accent}40; }
        .prs-btn-primary { transition: background 160ms ease, box-shadow 160ms ease, transform 140ms ease; }
        .prs-btn-ghost:hover { background: ${C.slateSoft}; color: ${C.text}; border-color: ${C.cardBorderHover}; }
        .prs-btn-ghost { transition: background 160ms ease, border-color 160ms ease, color 160ms ease; }
        .prs-empty-cta:hover { background: ${POINTS_C.deep}; }
      `}</style>

      <div style={s.inner}>
        {/* ── Breadcrumb ───────────────────────────────────────────── */}
        <div style={s.breadcrumb}>
          <Link to="/" style={s.crumbLink}>Settings</Link>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
          <span style={s.crumbCurrent}>Points & Rewards</span>
        </div>

        {/* ── Page header ──────────────────────────────────────────── */}
        <div style={s.pageHeader}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={s.eyebrow}>
              <FontAwesomeIcon icon={faSackDollar} style={{ fontSize: 10 }} />
              Points & Rewards
            </div>
            <h1 style={s.heading}>Earning rules & redemption catalog</h1>
            <p style={s.subheading}>
              Configure how teachers earn points and what they can redeem. Only active items
              appear on the teacher&apos;s rewards page.
            </p>
          </div>
          {previewTeacherId && (
            <Link
              to={`/teachers/${previewTeacherId}/rewards`}
              className="prs-btn-ghost"
              style={s.btnGhost}
              title="See exactly what teachers see"
            >
              <FontAwesomeIcon icon={faEye} style={{ fontSize: 11 }} />
              Preview teacher view
            </Link>
          )}
        </div>

        {/* ── Summary cards ────────────────────────────────────────── */}
        <div style={s.summaryGrid}>
          <SummaryCard
            icon={faBolt}
            tone="accent"
            label="Active earning rules"
            value={activeRulesCount.toLocaleString('en-MY')}
            sub={`${totalRulesCount} total`}
          />
          <SummaryCard
            icon={faGift}
            tone="accent"
            label="Active rewards"
            value={activeRewardsCount.toLocaleString('en-MY')}
            sub={`${totalRewardsCount} total`}
          />
          <SummaryCard
            icon={faSackDollar}
            tone="muted"
            label="Highest reward cost"
            value={highestRewardCost > 0 ? highestRewardCost.toLocaleString('en-MY') : '—'}
            valueUnit={highestRewardCost > 0 ? 'pts' : undefined}
            sub={highestRewardLabel ?? 'No rewards configured'}
          />
          <SummaryCard
            icon={faChartLine}
            tone="muted"
            label="Redemption tracking"
            value="No data yet"
            sub="Coming soon"
            placeholder
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: SP.xl }}>
          <EarningRulesSection onDelete={handleDeleteRule} />
          <CatalogSection onDelete={handleDeleteReward} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary cards
// ─────────────────────────────────────────────────────────────────────────────

function SummaryCard({
  icon, tone, label, value, valueUnit, sub, placeholder,
}: {
  icon: any;
  tone: 'accent' | 'muted';
  label: string;
  value: string;
  /** Optional unit suffix rendered smaller + muted next to value (e.g. "pts"). */
  valueUnit?: string;
  sub: string;
  /** Placeholder cards dim their value so they don't compete with
   *  cards that actually have data. */
  placeholder?: boolean;
}) {
  const iconBg = tone === 'accent' ? POINTS_C.soft : C.slateSoft;
  const iconFg = tone === 'accent' ? POINTS_C.accent : C.muted;
  const iconBorder = tone === 'accent' ? POINTS_C.border : C.cardBorder;
  return (
    <div className="prs-card" style={s.summaryCard}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: iconBg, color: iconFg,
        border: `1px solid ${iconBorder}`,
        fontSize: 15, flexShrink: 0,
      }}>
        <FontAwesomeIcon icon={icon} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={s.summaryLabel}>{label}</div>
        <div style={{
          ...s.summaryValue,
          color: placeholder ? C.mutedSoft : C.text,
        }}>
          {value}
          {valueUnit && (
            <span style={{
              marginLeft: 4, fontSize: 12, fontWeight: 600, color: C.muted,
              letterSpacing: 'normal',
            }}>
              {valueUnit}
            </span>
          )}
        </div>
        <div style={s.summarySub} title={sub}>{sub}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Earning rules
// ─────────────────────────────────────────────────────────────────────────────

function EarningRulesSection({ onDelete }: {
  onDelete: (rule: EarningRule) => void;
}) {
  return (
    <section className="prs-card" style={s.section}>
      <SectionHeader
        title="Earning rules"
        sub="Each rule grants points when teachers complete the activity."
        action={
          <Link to="/settings/points-rewards/add/rule" className="prs-btn-primary" style={s.btnPrimary}>
            <FontAwesomeIcon icon={faPlus} style={{ fontSize: 10 }} />
            Add rule
          </Link>
        }
      />
      {earningRules.length === 0 ? (
        <EmptyState
          icon={faBolt}
          title="No earning rules yet"
          hint="Define how teachers earn points — by completing missions, training, or other activities."
          ctaLabel="Add first rule"
          ctaTo="/settings/points-rewards/add/rule"
        />
      ) : (
        <>
          <div style={{ ...s.tableHeader, gridTemplateColumns: RULES_GRID }}>
            <span>Rule</span>
            <span style={{ textAlign: 'right' }}>Points</span>
            <span>Status</span>
            <span style={{ textAlign: 'right' }}>Actions</span>
          </div>
          <div style={s.list}>
            {earningRules.map(r => (
              <RuleRow key={r.id} rule={r} onDelete={() => onDelete(r)} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// Grid template shared between the rules header and each rule row.
// Keeps column edges perfectly aligned without giving the rows their
// own width math.
const RULES_GRID = 'minmax(0, 1fr) 120px 90px 100px';

function RuleRow({ rule, onDelete }: {
  rule: EarningRule;
  onDelete: () => void;
}) {
  const dim = rule.active ? 1 : 0.5;
  const cat = RULE_CATEGORY_META[rule.category];
  return (
    <div className="prs-row" style={{ ...s.row, gridTemplateColumns: RULES_GRID }}>
      {/* Rule column — icon + title row (name + subtle category badge)
          + description sub-line. Two-line layout fills the natural
          horizontal slack the row otherwise had. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0, opacity: dim }}>
        <div style={{ ...iconTile(POINTS_C.soft, POINTS_C.accent, POINTS_C.border), marginTop: 1 }}>
          {rule.icon && <FontAwesomeIcon icon={rule.icon} style={{ fontSize: 13 }} />}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={s.rowTitle}>{rule.label}</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '1px 7px', height: 18, borderRadius: 6,
              fontSize: 10, fontWeight: 600,
              background: cat.bg, color: cat.color,
              border: `1px solid ${cat.border}`,
              letterSpacing: '-0.005em',
              flexShrink: 0,
            }}>
              {cat.label}
            </span>
          </div>
          {rule.description && (
            <div style={s.rowDescription}>{rule.description}</div>
          )}
        </div>
      </div>

      {/* Points column — right-aligned, bold, tabular-nums */}
      <div style={{ ...s.amountCell, opacity: dim }}>
        <span style={s.amountValue}>+{rule.amount.toLocaleString('en-MY')}</span>
        <span style={s.amountUnit}>pts</span>
      </div>

      {/* Status column — pill badge (edit page to flip) */}
      <div style={s.statusCell}>
        <StatusBadge tone={rule.active ? 'success' : 'muted'} label={rule.active ? 'Active' : 'Inactive'} />
      </div>

      {/* Actions column */}
      <div style={s.actionsCell}>
        <Link
          to={`/settings/points-rewards/edit/rule/${rule.id}`}
          className="prs-edit"
          aria-label={`Edit ${rule.label}`}
          style={s.iconBtnEdit}
        >
          <FontAwesomeIcon icon={faPen} style={{ fontSize: 11 }} />
        </Link>
        <button
          type="button"
          onClick={onDelete}
          className="prs-trash"
          aria-label={`Remove ${rule.label}`}
          style={s.iconBtnDanger}
        >
          <FontAwesomeIcon icon={faTrash} style={{ fontSize: 11 }} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reward catalog
// ─────────────────────────────────────────────────────────────────────────────

function CatalogSection({ onDelete }: {
  onDelete: (item: RewardItem) => void;
}) {
  return (
    <section className="prs-card" style={s.section}>
      <SectionHeader
        title="Reward catalog"
        sub="Items teachers can redeem with their points balance. Stock state controls availability; active toggle controls visibility."
        action={
          <Link to="/settings/points-rewards/add/reward" className="prs-btn-primary" style={s.btnPrimary}>
            <FontAwesomeIcon icon={faPlus} style={{ fontSize: 10 }} />
            Add reward
          </Link>
        }
      />
      {rewardCatalog.length === 0 ? (
        <EmptyState
          icon={faGift}
          title="No rewards yet"
          hint="Add items teachers can redeem with their points — vouchers, leave days, branded merch, and more."
          ctaLabel="Add first reward"
          ctaTo="/settings/points-rewards/add/reward"
        />
      ) : (
        <>
          <div style={{ ...s.tableHeader, gridTemplateColumns: REWARDS_GRID }}>
            <span>Reward</span>
            <span>Stock</span>
            <span style={{ textAlign: 'right' }}>Cost</span>
            <span>Status</span>
            <span style={{ textAlign: 'right' }}>Actions</span>
          </div>
          <div style={s.list}>
            {rewardCatalog.map(it => (
              <RewardRow key={it.id} item={it} onDelete={() => onDelete(it)} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

const REWARDS_GRID = 'minmax(0, 1fr) 110px 110px 90px 100px';

function RewardRow({ item, onDelete }: {
  item: RewardItem;
  onDelete: () => void;
}) {
  const sm = stockMeta(item.stock);
  const stockTone = sm.palette === 'success' ? 'success'
    : sm.palette === 'warning' ? 'warning'
    : 'muted';
  const dim = item.active ? 1 : 0.5;
  return (
    <div className="prs-row" style={{ ...s.row, gridTemplateColumns: REWARDS_GRID }}>
      {/* Reward column — icon + label + description sub-line */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0, opacity: dim }}>
        <div style={{ ...iconTile(POINTS_C.soft, POINTS_C.accent, POINTS_C.border), marginTop: 1 }}>
          {item.icon && <FontAwesomeIcon icon={item.icon} style={{ fontSize: 13 }} />}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={s.rowTitle}>{item.label}</div>
          {item.sub && <div style={s.rowDescription}>{item.sub}</div>}
        </div>
      </div>

      {/* Stock column */}
      <div style={{ opacity: dim }}>
        <StatusBadge tone={stockTone} label={sm.text} />
      </div>

      {/* Cost column — bold, right-aligned, tabular-nums */}
      <div style={{ ...s.amountCell, opacity: dim }}>
        <span style={s.amountValue}>{item.cost.toLocaleString('en-MY')}</span>
        <span style={s.amountUnit}>pts</span>
      </div>

      {/* Status column — pill badge (edit page to flip) */}
      <div style={s.statusCell}>
        <StatusBadge tone={item.active ? 'success' : 'muted'} label={item.active ? 'Active' : 'Inactive'} />
      </div>

      {/* Actions column */}
      <div style={s.actionsCell}>
        <Link
          to={`/settings/points-rewards/edit/reward/${item.id}`}
          className="prs-edit"
          aria-label={`Edit ${item.label}`}
          style={s.iconBtnEdit}
        >
          <FontAwesomeIcon icon={faPen} style={{ fontSize: 11 }} />
        </Link>
        <button
          type="button"
          onClick={onDelete}
          className="prs-trash"
          aria-label={`Remove ${item.label}`}
          style={s.iconBtnDanger}
        >
          <FontAwesomeIcon icon={faTrash} style={{ fontSize: 11 }} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────────────────────

// Unified status pill — used for Active/Inactive AND for In Stock /
// Limited / Out of Stock. Same shape across the page so the column
// reads as a true "Status" column with consistent grammar.
type BadgeTone = 'success' | 'warning' | 'muted' | 'danger';
function StatusBadge({ tone, label }: { tone: BadgeTone; label: string }) {
  const palette =
    tone === 'success' ? { color: C.success, bg: C.successSoft, border: C.successBorder }
    : tone === 'warning' ? { color: C.warning, bg: C.warningSoft, border: C.warningBorder }
    : tone === 'danger'  ? { color: C.danger,  bg: C.dangerSoft,  border: C.dangerBorder }
    :                      { color: C.muted,   bg: C.slateSoft,   border: '#e2e8f0' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', height: 20, borderRadius: 999,
      fontSize: 10, fontWeight: 700,
      background: palette.bg, color: palette.color,
      border: `1px solid ${palette.border}`,
      textTransform: 'uppercase', letterSpacing: '0.06em',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function SectionHeader({
  title, sub, action,
}: {
  title: string; sub?: string; action?: React.ReactNode;
}) {
  return (
    <div style={s.sectionHeader}>
      <div style={{ minWidth: 0 }}>
        <h2 style={s.sectionTitle}>{title}</h2>
        {sub && <p style={s.sectionSub}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

function EmptyState({
  icon, title, hint, ctaLabel, ctaTo,
}: {
  icon: any; title: string; hint: string; ctaLabel: string; ctaTo: string;
}) {
  return (
    <div style={s.emptyState}>
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: POINTS_C.soft, color: POINTS_C.accent,
        border: `1px solid ${POINTS_C.border}`,
        fontSize: 18, marginBottom: 12,
      }}>
        <FontAwesomeIcon icon={icon} />
      </div>
      <h3 style={{
        margin: '0 0 4px', fontSize: 15, fontWeight: 800, color: C.text,
        letterSpacing: '-0.012em',
      }}>
        {title}
      </h3>
      <p style={{
        margin: '0 auto 14px', fontSize: 13, color: C.muted, lineHeight: 1.55,
        maxWidth: 380,
      }}>
        {hint}
      </p>
      <Link to={ctaTo} className="prs-empty-cta" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 32, padding: '0 14px', borderRadius: 8,
        background: POINTS_C.accent, color: '#fff',
        fontSize: 12, fontWeight: 700, textDecoration: 'none',
        transition: 'background 160ms ease',
      }}>
        <FontAwesomeIcon icon={faPlus} style={{ fontSize: 10 }} />
        {ctaLabel}
      </Link>
    </div>
  );
}

function iconTile(bg: string, fg: string, border: string): React.CSSProperties {
  return {
    width: 36, height: 36, borderRadius: 9,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: bg, color: fg,
    border: `1px solid ${border}`,
    flexShrink: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: `${SP.xxl}px ${SP.xxl}px ${SP.xxxl + SP.lg}px`,
    background: C.bg, minHeight: '100vh', color: C.text,
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  inner: { maxWidth: 1200, margin: '0 auto' },

  // Breadcrumb
  breadcrumb: {
    display: 'flex', alignItems: 'center', gap: SP.sm, fontSize: 12,
    flexWrap: 'wrap', rowGap: 4, minWidth: 0,
    marginBottom: 14,
  },
  crumbLink: { color: C.muted, textDecoration: 'none', fontWeight: 500 },
  crumbCurrent: { color: C.text, fontWeight: 600 },

  // Page header
  pageHeader: {
    display: 'flex', alignItems: 'flex-start',
    flexWrap: 'wrap', gap: SP.md,
    marginBottom: SP.xl,
  },
  eyebrow: {
    fontSize: 10, fontWeight: 800, color: POINTS_C.accent,
    textTransform: 'uppercase' as const, letterSpacing: '0.1em',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  },
  heading: {
    margin: '4px 0 0', fontSize: 26, fontWeight: 800, color: C.text,
    letterSpacing: '-0.025em', lineHeight: 1.15,
  },
  subheading: {
    margin: '6px 0 0', fontSize: 13, fontWeight: 500, color: C.muted,
    lineHeight: 1.55, maxWidth: 640,
  },

  // Summary cards
  summaryGrid: {
    display: 'grid', gap: SP.md,
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    marginBottom: SP.xl,
  },
  summaryCard: {
    background: C.card, border: `1px solid ${C.cardBorder}`,
    borderRadius: RADIUS, padding: SP.lg,
    boxShadow: SHADOW,
    display: 'flex', alignItems: 'center', gap: SP.md,
    minWidth: 0,
  },
  summaryLabel: {
    fontSize: 11, fontWeight: 700, color: C.muted,
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
  },
  summaryValue: {
    marginTop: 2, fontSize: 22, fontWeight: 800,
    letterSpacing: '-0.018em', lineHeight: 1.1,
    fontVariantNumeric: 'tabular-nums' as const,
  },
  summarySub: {
    marginTop: 2, fontSize: 11, fontWeight: 500, color: C.mutedSoft,
    lineHeight: 1.4,
    overflow: 'hidden' as const, textOverflow: 'ellipsis' as const,
    display: '-webkit-box' as const,
    WebkitLineClamp: 2 as any,
    WebkitBoxOrient: 'vertical' as any,
  },

  // Section card
  section: {
    background: C.card, border: `1px solid ${C.cardBorder}`,
    borderRadius: RADIUS_LG, boxShadow: SHADOW,
    overflow: 'hidden',
  },
  sectionHeader: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: SP.md, padding: '18px 20px',
    borderBottom: `1px solid ${C.divider}`,
  },
  sectionTitle: {
    margin: 0, fontSize: 16, fontWeight: 800, color: C.text,
    letterSpacing: '-0.012em',
  },
  sectionSub: {
    margin: '4px 0 0', fontSize: 12, fontWeight: 500, color: C.muted,
    lineHeight: 1.5, maxWidth: 640,
  },

  // Table header — column labels above the rows. Mirrors the row's
  // grid template so columns line up perfectly with their data.
  tableHeader: {
    display: 'grid', alignItems: 'center', gap: 16,
    padding: '10px 20px',
    background: C.slateSoft,
    borderBottom: `1px solid ${C.divider}`,
    fontSize: 10, fontWeight: 800, color: C.muted,
    textTransform: 'uppercase' as const, letterSpacing: '0.08em',
  },
  // List + rows — grid-based so columns align with the table header.
  // Each row component sets its own gridTemplateColumns (RULES_GRID
  // or REWARDS_GRID) so rules and rewards can have different layouts.
  list: { display: 'flex', flexDirection: 'column' as const },
  row: {
    display: 'grid', alignItems: 'center', gap: 16,
    padding: '10px 20px',
    borderBottom: `1px solid ${C.divider}`,
  },
  rowDescription: {
    marginTop: 2, fontSize: 12, fontWeight: 500, color: C.muted,
    lineHeight: 1.4,
    overflow: 'hidden' as const, textOverflow: 'ellipsis' as const,
    display: '-webkit-box' as const,
    WebkitLineClamp: 2 as any,
    WebkitBoxOrient: 'vertical' as any,
  },
  // Cell helpers — each maps to a column in the table.
  amountCell: {
    display: 'inline-flex', alignItems: 'baseline', justifyContent: 'flex-end',
    gap: 4, whiteSpace: 'nowrap' as const,
  },
  statusCell: {
    display: 'inline-flex', alignItems: 'center', gap: 10,
  },
  actionsCell: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end',
    gap: 6,
  },
  rowTitle: {
    fontSize: 14, fontWeight: 700, color: C.text,
    letterSpacing: '-0.005em',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
  },
  // Points value typography — bold, deep violet, tabular-nums so
  // column values line up perfectly down the table.
  amountValue: {
    fontSize: 16, fontWeight: 800, color: POINTS_C.deep,
    letterSpacing: '-0.018em', fontVariantNumeric: 'tabular-nums' as const,
  },
  amountUnit: {
    fontSize: 11, fontWeight: 600, color: C.muted,
  },
  iconBtnEdit: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 8,
    background: '#fff', color: C.muted,
    border: `1px solid ${C.cardBorder}`,
    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
    textDecoration: 'none',
    transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
  },
  iconBtnDanger: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 8,
    background: '#fff', color: C.danger,
    border: `1px solid ${C.dangerBorder}`,
    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
    transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
  },

  // Primary CTA (Add rule / Add reward)
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    height: 32, padding: '0 14px', borderRadius: 8,
    fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
    background: POINTS_C.accent, color: '#fff', border: 'none',
    cursor: 'pointer', flexShrink: 0,
    textDecoration: 'none',
    boxShadow: `0 1px 2px ${POINTS_C.accent}40`,
  },

  // Secondary ghost (Preview teacher view)
  btnGhost: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    height: 36, padding: '0 14px', borderRadius: 10,
    fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
    background: C.card, color: C.textSub,
    border: `1px solid ${C.cardBorder}`,
    cursor: 'pointer', flexShrink: 0,
    textDecoration: 'none',
  },

  // Empty state
  emptyState: {
    padding: '40px 20px', textAlign: 'center' as const,
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
  },
};
