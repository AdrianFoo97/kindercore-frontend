import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronRight, faChevronLeft, faCheck, faSackDollar,
} from '@fortawesome/free-solid-svg-icons';
import {
  addReward, addRule, updateReward, updateRule,
  getReward, getRule,
  REWARD_ICON_OPTIONS, RULE_ICON_OPTIONS,
  RULE_CATEGORY_META,
  RewardItem, RuleCategory,
} from '../../data/pointsRewardsMock.js';

// One page, four modes — picked from the route params. Same form
// chrome, icon picker, and validation for add vs edit; rule vs reward
// just swaps which fields show and which mutators run on save.
type Mode = 'rule' | 'reward';

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eceef2',
  divider: '#eef0f3',
  text: '#0f172a',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  danger: '#dc2626',
};
const POINTS_C = {
  accent: '#7c3aed',
  soft: '#f5f3ff',
  border: '#ddd6fe',
};
const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

export default function PointsRewardsAddPage() {
  // Mode + intent are encoded in the URL path:
  //   /settings/points-rewards/add/:kind          — new
  //   /settings/points-rewards/edit/:kind/:id     — edit existing
  // Keeps the page bookmarkable and avoids stuffing the same intent
  // into query state.
  const { kind, id } = useParams<{ kind: string; id?: string }>();
  const mode: Mode = kind === 'rule' ? 'rule' : 'reward';
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const iconOptions = mode === 'rule' ? RULE_ICON_OPTIONS : REWARD_ICON_OPTIONS;

  // Pre-fill state from the existing item when editing. Falls back to
  // defaults if the id is bogus (e.g. stale link) — the form is still
  // usable as an add.
  const existing = isEdit
    ? (mode === 'rule' ? getRule(id!) : getReward(id!))
    : undefined;
  const existingIconName = existing
    ? iconOptions.find(o => o.icon === existing.icon)?.name
    : undefined;

  const [iconName, setIconName] = useState<string>(existingIconName ?? iconOptions[0].name);
  const [label, setLabel] = useState(existing?.label ?? '');
  // Rule mode reuses `sub` state to hold the rule's description so we
  // don't need a parallel variable. The shape difference between rule
  // and reward is hidden behind the save function below.
  const [sub, setSub] = useState(
    existing
      ? ('sub' in existing ? existing.sub : (existing as { description?: string }).description ?? '')
      : ''
  );
  const [category, setCategory] = useState<RuleCategory>(
    existing && 'category' in existing ? existing.category : 'mission',
  );
  const [amount, setAmount] = useState<number>(
    existing
      ? ('amount' in existing ? existing.amount : existing.cost)
      : (mode === 'rule' ? 50 : 100)
  );
  const [stock, setStock] = useState<RewardItem['stock']>(
    existing && 'stock' in existing ? existing.stock : 'in',
  );
  // Active state is editable here. New items default to active so they
  // immediately surface to teachers; admins can flip them off here or
  // any time later from the settings list.
  const [active, setActive] = useState<boolean>(existing?.active ?? true);

  const canSave = label.trim().length > 0 && amount > 0;

  const selectedIcon = iconOptions.find(o => o.name === iconName)?.icon
    ?? iconOptions[0].icon;

  const save = () => {
    if (!canSave) return;
    if (mode === 'rule') {
      const payload = {
        icon: selectedIcon, label: label.trim(),
        description: sub.trim(), amount, category, active,
      };
      if (isEdit && id) updateRule(id, payload);
      else addRule(payload);
    } else {
      const payload = {
        icon: selectedIcon, label: label.trim(), sub: sub.trim(),
        cost: amount, stock, active,
      };
      if (isEdit && id) updateReward(id, payload);
      else addReward(payload);
    }
    navigate('/settings/points-rewards');
  };

  const title = isEdit
    ? (mode === 'rule' ? 'Edit earning rule' : 'Edit reward')
    : (mode === 'rule' ? 'Add earning rule' : 'Add reward');
  const subtitle = mode === 'rule'
    ? 'Define an activity that grants points when teachers complete it.'
    : 'Define a reward teachers can redeem with their points.';
  const amountLabel = mode === 'rule' ? 'Points granted' : 'Cost (points)';
  const saveLabel = isEdit ? 'Save changes' : (mode === 'rule' ? 'Save rule' : 'Save reward');

  return (
    <div style={{ padding: '28px 32px', background: C.bg, minHeight: '100vh', color: C.text }}>
      <style>{`
        .pra-icon-btn:not([aria-pressed="true"]):hover { background: #f1f5f9; border-color: #cbd5e1; color: ${C.text}; }
        .pra-input:focus { outline: none; border-color: ${POINTS_C.accent}; box-shadow: 0 0 0 3px ${POINTS_C.accent}1a; }
        .pra-cancel:hover { background: #f1f5f9; }
        .pra-back-btn:hover { background: #f1f5f9; color: ${C.text}; border-color: #cbd5e1; }
      `}</style>

      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        {/* Back button + breadcrumb row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => navigate('/settings/points-rewards')}
            className="pra-back-btn"
            title="Back to Points & Rewards"
            aria-label="Back"
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: `1px solid ${C.cardBorder}`,
              background: '#fff', color: C.muted,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, cursor: 'pointer', flexShrink: 0,
              transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
            }}
          >
            <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 11 }} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, flexWrap: 'wrap', rowGap: 4, minWidth: 0 }}>
            <Link to="/" style={{ color: C.muted, textDecoration: 'none', fontWeight: 500 }}>Settings</Link>
            <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
            <Link to="/settings/points-rewards" style={{ color: C.muted, textDecoration: 'none', fontWeight: 500 }}>Points & Rewards</Link>
            <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
            <span style={{ color: C.text, fontWeight: 600 }}>
              {isEdit
                ? (mode === 'rule' ? 'Edit rule' : 'Edit reward')
                : (mode === 'rule' ? 'Add rule' : 'Add reward')}
            </span>
          </div>
        </div>

        {/* Header */}
        <div style={{ marginBottom: SP.lg }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: POINTS_C.accent,
            textTransform: 'uppercase', letterSpacing: '0.1em',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <FontAwesomeIcon icon={faSackDollar} style={{ fontSize: 10 }} />
            Points & Rewards
          </div>
          <h1 style={{
            margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: C.text,
            letterSpacing: '-0.02em',
          }}>
            {title}
          </h1>
          <p style={{
            margin: '6px 0 0', fontSize: 13, fontWeight: 500, color: C.muted,
            lineHeight: 1.55,
          }}>
            {subtitle}
          </p>
        </div>

        {/* Form card */}
        <div style={{
          background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 14,
          boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
          padding: SP.xl, display: 'flex', flexDirection: 'column', gap: SP.lg,
        }}>
          {/* Icon picker */}
          <Field label="Icon" hint="Pick the icon that best represents this item.">
            <div style={{
              display: 'grid', gap: 8,
              gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))',
            }}>
              {iconOptions.map(opt => {
                const active = opt.name === iconName;
                return (
                  <button
                    key={opt.name}
                    type="button"
                    onClick={() => setIconName(opt.name)}
                    className="pra-icon-btn"
                    aria-pressed={active}
                    title={opt.name}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      height: 56, borderRadius: 10,
                      background: active ? POINTS_C.soft : '#fff',
                      color: active ? POINTS_C.accent : C.muted,
                      border: `1px solid ${active ? POINTS_C.accent : C.cardBorder}`,
                      cursor: 'pointer', fontSize: 18,
                      transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease',
                      boxShadow: active ? `0 0 0 3px ${POINTS_C.accent}1a` : 'none',
                    }}
                  >
                    <FontAwesomeIcon icon={opt.icon} />
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Label */}
          <Field
            label={mode === 'rule' ? 'Activity' : 'Reward name'}
            hint={mode === 'rule' ? 'e.g. "Complete a mission".' : 'e.g. "Coffee voucher".'}
          >
            <input
              className="pra-input"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder={mode === 'rule' ? 'Complete a mission' : 'Coffee voucher'}
              style={inputStyle}
            />
          </Field>

          {/* Category — rule only. Drives the subtle badge in the list. */}
          {mode === 'rule' && (
            <Field label="Category" hint="Subtle badge shown next to the rule name in the admin list.">
              <select
                className="pra-input"
                value={category}
                onChange={e => setCategory(e.target.value as RuleCategory)}
                style={inputStyle}
              >
                {(Object.keys(RULE_CATEGORY_META) as RuleCategory[]).map(k => (
                  <option key={k} value={k}>{RULE_CATEGORY_META[k].label}</option>
                ))}
              </select>
            </Field>
          )}

          {/* Description — shown for both rules and rewards. For rules
              it's the awarded-when context; for rewards it's the RM
              value / short detail under the name. */}
          <Field
            label="Description"
            hint={mode === 'rule'
              ? 'One-line context shown under the rule name (e.g. when the rule fires).'
              : 'A short detail under the name, e.g. "RM 15 value".'}
          >
            <textarea
              className="pra-input"
              value={sub}
              onChange={e => setSub(e.target.value)}
              placeholder={mode === 'rule'
                ? 'Awarded when a teacher completes an approved mission.'
                : 'RM 15 value'}
              rows={3}
              style={{
                ...inputStyle,
                resize: 'vertical',
                minHeight: 72,
                lineHeight: 1.5,
              }}
            />
          </Field>

          {/* Status — flips whether the item is shown to teachers. */}
          <Field
            label="Status"
            hint="Only active items appear on the teacher's rewards page. Toggle off to hide without deleting."
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 12px',
              border: `1px solid ${C.cardBorder}`, borderRadius: 8,
              background: '#fff',
            }}>
              <ActiveToggle
                active={active}
                onChange={() => setActive(v => !v)}
                label={active ? 'Deactivate' : 'Activate'}
              />
              <span style={{
                fontSize: 13, fontWeight: 600,
                color: active ? '#059669' : C.muted,
              }}>
                {active ? 'Active' : 'Inactive'}
              </span>
              <span style={{
                marginLeft: 'auto', fontSize: 11, fontWeight: 500,
                color: C.muted,
              }}>
                {active ? 'Visible to teachers' : 'Hidden from teachers'}
              </span>
            </div>
          </Field>

          {/* Amount + Stock side by side for reward, full-width for rule */}
          <div style={{
            display: 'grid', gap: SP.md,
            gridTemplateColumns: mode === 'reward' ? 'minmax(0, 1fr) minmax(0, 1fr)' : '1fr',
          }}>
            <Field label={amountLabel}>
              <input
                className="pra-input"
                type="number" min={1}
                value={amount}
                onChange={e => setAmount(Math.max(0, parseInt(e.target.value || '0', 10)))}
                style={{ ...inputStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
              />
            </Field>
            {mode === 'reward' && (
              <Field label="Stock">
                <select
                  className="pra-input"
                  value={stock}
                  onChange={e => setStock(e.target.value as RewardItem['stock'])}
                  style={inputStyle}
                >
                  <option value="in">In stock</option>
                  <option value="limited">Limited</option>
                  <option value="out">Out of stock</option>
                </select>
              </Field>
            )}
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 10,
            paddingTop: SP.md,
            borderTop: `1px solid ${C.divider}`,
          }}>
            <button
              type="button"
              onClick={() => navigate('/settings/points-rewards')}
              className="pra-cancel"
              style={{
                display: 'inline-flex', alignItems: 'center',
                height: 34, padding: '0 16px', borderRadius: 8,
                background: '#fff', color: C.muted,
                border: `1px solid ${C.cardBorder}`,
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 34, padding: '0 16px', borderRadius: 8,
                background: canSave ? POINTS_C.accent : '#cbd5e1',
                color: '#fff', border: 'none',
                fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                cursor: canSave ? 'pointer' : 'not-allowed',
              }}
            >
              <FontAwesomeIcon icon={faCheck} style={{ fontSize: 11 }} />
              {saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Inline switch — violet when active, slate when inactive. Used in
// the Status field above; flips active state without leaving the form.
function ActiveToggle({
  active, onChange, label,
}: {
  active: boolean; onChange: () => void; label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      onClick={onChange}
      style={{
        position: 'relative',
        width: 36, height: 20, borderRadius: 999,
        background: active ? POINTS_C.accent : '#cbd5e1',
        border: 'none', cursor: 'pointer',
        padding: 0, flexShrink: 0,
        transition: 'background 160ms ease',
      }}
    >
      <span style={{
        position: 'absolute',
        top: 2, left: active ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 2px rgba(15,23,42,0.18)',
        transition: 'left 160ms cubic-bezier(0.4, 0, 0.2, 1)',
      }} />
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span style={{
        fontSize: 11, fontWeight: 700, color: C.text,
        letterSpacing: '-0.005em',
      }}>
        {label}
      </span>
      {hint && (
        <span style={{ fontSize: 11, fontWeight: 500, color: C.muted, lineHeight: 1.4 }}>
          {hint}
        </span>
      )}
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', minWidth: 0,
  padding: '8px 12px', borderRadius: 8,
  border: `1px solid ${C.cardBorder}`,
  background: '#fff', color: C.text,
  fontSize: 13, fontFamily: 'inherit',
  boxSizing: 'border-box',
  transition: 'border-color 120ms ease, box-shadow 120ms ease',
};
