import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCopy, faCheck,
} from '@fortawesome/free-solid-svg-icons';
import { fetchMyRewards, RedemptionStatus } from '../api/points.js';
import { resolveRewardIcon } from '../constants/pointsMeta.js';
import { TEACHER_CONTENT_TOP } from '../components/common/TeacherTopBar.js';

// ─────────────────────────────────────────────────────────────────────────────
// Mobile-friendly details surface for a single redeemed reward. Reached
// from the "View details" button on the rewards page's My Rewards
// section. Built as a full page rather than a modal so a teacher on
// a phone can read voucher codes / instructions without modal chrome
// eating the viewport.
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
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  dangerBorder: '#fecaca',
  slate: '#475569',
  slateSoft: '#f1f5f9',
};

const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

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

function statusBadge(status: RedemptionStatus): { label: string; bg: string; color: string; border: string } {
  switch (status) {
    case 'redeemed':  return { label: 'In your wallet', bg: POINTS_C.soft, color: POINTS_C.accent, border: POINTS_C.border };
    case 'pending':   return { label: 'Pending',   bg: C.warningSoft, color: C.warning,      border: C.warningBorder };
    case 'delivered': return { label: 'Delivered', bg: C.successSoft, color: C.success,      border: C.successBorder };
  }
}

export default function TeacherRedeemedRewardPage() {
  const { id, redemptionId } = useParams<{ id: string; redemptionId: string }>();
  const navigate = useNavigate();
  const { data: myRewards, isLoading } = useQuery({
    queryKey: ['points-redemptions', id], queryFn: () => fetchMyRewards(id!), enabled: !!id,
  });
  const reward = myRewards?.find(r => r.id === redemptionId);

  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — silently ignore;
      // teachers can still read and type the code manually.
    }
  };

  if (isLoading) {
    return (
      <div style={s.page}>
        <div style={s.inner}>
          <div style={{ marginTop: SP.xl, padding: '48px 24px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
            Loading…
          </div>
        </div>
      </div>
    );
  }

  if (!reward) {
    return (
      <div style={s.page}>
        <div style={s.inner}>
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
              This redemption may have been removed.
            </p>
            <Link
              to={`/teachers/${id}/rewards`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 10,
                background: POINTS_C.accent, color: '#fff',
                fontSize: 13, fontWeight: 700, textDecoration: 'none',
              }}
            >
              Back to Rewards
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const badge = statusBadge(reward.status);

  return (
    <div style={s.page}>
      <style>{`
        .trr-copy-btn:hover { background: ${POINTS_C.soft}; color: ${POINTS_C.accent}; border-color: ${POINTS_C.border}; }
        .trr-done:hover { background: ${POINTS_C.deep}; }
      `}</style>

      <div style={s.inner}>
        {/* Single card — mirrors the catalog details page so the two
            detail surfaces feel like the same product. Hero block at
            the top, then content sections separated by hairline
            dividers, then footer with the close-out action. */}
        <div style={s.card}>
          {/* Hero block — identity on the left, points-spent on the
              right, vertically centered like the catalog page. */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: SP.lg,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: SP.lg, flex: 1, minWidth: 240 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: POINTS_C.soft, color: POINTS_C.accent,
                border: `1px solid ${POINTS_C.border}`,
                fontSize: 26, flexShrink: 0,
              }}>
                <FontAwesomeIcon icon={resolveRewardIcon(reward.icon)} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.eyebrow}>My Reward</div>
                <h1 style={s.heading}>{reward.label}</h1>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '2px 9px', height: 22, borderRadius: 999,
                    fontSize: 10, fontWeight: 700,
                    background: badge.bg, color: badge.color,
                    border: `1px solid ${badge.border}`,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    {badge.label}
                  </span>
                  <span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>
                    Redeemed {fmtDate(reward.redeemedDate)}
                  </span>
                </div>
              </div>
            </div>

            {/* Cost on the right — naked number, mirrors the catalog
                details hero. Prefixed with a minus since this is a
                spent amount, not a price. */}
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 6,
              flexShrink: 0,
            }}>
              <span style={{
                fontSize: 28, fontWeight: 800, color: POINTS_C.deep,
                fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.025em',
                lineHeight: 1.05,
              }}>
                −{reward.pointsSpent.toLocaleString('en-MY')}
              </span>
              <span style={{
                fontSize: 12, fontWeight: 700, color: C.muted,
                letterSpacing: '0.02em',
              }}>pts</span>
            </div>
          </div>

          {/* Redemption code — monospace, always present */}
          <div style={s.section}>
            <div style={s.sectionLabel}>Redemption code</div>
            <span style={{
              fontSize: 14, fontWeight: 700, color: C.text,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              letterSpacing: '-0.005em',
            }}>
              {reward.redemptionCode}
            </span>
          </div>

          {/* Voucher code — only if the reward carries one */}
          {reward.voucherCode && (
            <div style={s.section}>
              <div style={s.sectionLabel}>Voucher code</div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 14px',
                background: POINTS_C.soft,
                border: `1px dashed ${POINTS_C.border}`,
                borderRadius: 10,
                flexWrap: 'wrap',
              }}>
                <span style={{
                  flex: 1, minWidth: 0,
                  fontSize: 16, fontWeight: 800, color: POINTS_C.deep,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  letterSpacing: '0.04em',
                  wordBreak: 'break-all' as const,
                }}>
                  {reward.voucherCode}
                </span>
                <button
                  type="button"
                  onClick={() => copy(reward.voucherCode!)}
                  className="trr-copy-btn"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 8,
                    background: '#fff', color: C.textSub,
                    border: `1px solid ${C.cardBorder}`,
                    fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                    cursor: 'pointer', flexShrink: 0,
                    transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
                  }}
                >
                  <FontAwesomeIcon icon={copied ? faCheck : faCopy} style={{ fontSize: 11 }} />
                  {copied ? 'Copied' : 'Copy code'}
                </button>
              </div>
            </div>
          )}

          {/* Instructions — long-form copy explaining how to claim */}
          {reward.instructions && (
            <div style={s.section}>
              <div style={s.sectionLabel}>Instructions</div>
              <p style={{
                margin: 0, fontSize: 14, color: C.textSub,
                lineHeight: 1.6,
              }}>
                {reward.instructions}
              </p>
            </div>
          )}

          {/* Footer — single Done action, matches the catalog page's
              button placement on the right edge of the card. */}
          <div style={{
            marginTop: SP.lg, paddingTop: SP.lg,
            borderTop: `1px solid ${C.divider}`,
            display: 'flex', justifyContent: 'flex-end',
          }}>
            <button
              type="button"
              onClick={() => navigate(`/teachers/${id}/rewards`)}
              className="trr-done"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '10px 22px', borderRadius: 10,
                background: POINTS_C.accent, color: '#fff', border: 'none',
                fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'background 160ms ease',
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


const s: Record<string, React.CSSProperties> = {
  page: {
    // Bottom padding intentionally untouched here — see STICKY_CTA in
    // TeacherMobileNav.tsx, which suppresses the bottom tab bar on this
    // route.
    paddingTop: TEACHER_CONTENT_TOP,
    paddingRight: SP.xxxl,
    paddingBottom: SP.xxxl + SP.lg,
    paddingLeft: SP.xxxl,
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    background: C.bg, minHeight: '100vh', color: C.text,
  },
  inner: { maxWidth: 720, margin: '0 auto' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: SP.sm, fontSize: 12, flexWrap: 'wrap', rowGap: 4, minWidth: 0 },
  crumbLink: { color: C.muted, textDecoration: 'none', fontWeight: 500 },
  crumbCurrent: { color: C.text, fontWeight: 600 },
  backBtn: {
    width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.cardBorder}`,
    background: '#fff', cursor: 'pointer', color: C.muted, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 12,
  },
  // Single container card wrapping hero + sections + footer, mirrors
  // the catalog details page for visual consistency.
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
  // Content section inside the card — top divider keeps the visual
  // rhythm matching the catalog page.
  section: {
    marginTop: SP.lg, paddingTop: SP.lg,
    borderTop: `1px solid ${C.divider}`,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: 800, color: C.muted,
    textTransform: 'uppercase' as const, letterSpacing: '0.08em',
    marginBottom: 10,
  },
};
