import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronLeft, faChevronRight, faSackDollar,
  faMedal, faReceipt, faArrowTrendUp, faStar, faBolt,
} from '@fortawesome/free-solid-svg-icons';
import { uploadUrl } from '../api/upload.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import {
  compensationData,
  computeMonthlyTotal, rewardStreamSummary, formatService,
  eligibilityFromAppraisal, benefitRules, rm,
  useCompensationData,
} from './TeacherCompensationPage.js';

// ─────────────────────────────────────────────────────────────────────────────
// NEW teacher-facing compensation experience — a gamified, mobile-first
// hub that mirrors the career hub's hub-and-spoke pattern:
//
//   Pay Breakdown  ↔  Career Journey   (the anatomy / "where am I")
//   Grow My Pay    ↔  Mission Board    (the actionable quests)
//   Benefits       ↔  Skill Badges     (the unlockable gallery)
//
// Honest-money gamification only: a real Tier ladder (driven by the
// appraisal score gates) + real-RM deltas. No points/XP layered on
// top of salary, no peer comparison. The legacy TeacherMyCompensation*
// pages and the HR-facing TeacherCompensationPage are left untouched —
// this only reads their shared data hook.
// ─────────────────────────────────────────────────────────────────────────────

const FONT =
  '"Nunito", ui-rounded, -apple-system, "SF Pro Rounded", "Avenir Next", "Segoe UI", system-ui, sans-serif';

// Shared soft palette — same dialect as the career hub so the two
// teacher surfaces read as one app. Money accents (gold = the bright
// yellow we standardised on the Mission Board; green = guaranteed).
const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eceef2',
  cardBorderSoft: '#f1f3f7',
  divider: '#eef0f3',
  text: '#475569',          // soft slate-600 (matches career hub)
  textStrong: '#334155',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
  primaryBorder: '#c7d2fe',
  primaryDeep: '#4338ca',
  gold: '#eab308',
  goldDeep: '#a16207',
  goldSoft: '#fef9c3',
  goldBorder: '#fde047',
  success: '#16a34a',
  successSoft: '#dcfce7',
  successBorder: '#bbf7d0',
  slateSoft: '#f1f5f9',
};

// Sky-blue hero tint with the same soft fade we tuned on the Mission
// Board — solid to 195px, eases to the page bg by 245px.
const HERO_BG = '#dbeafe';

// ── Tier model — honest-money "league" derived from the appraisal
// gates that already govern benefit eligibility. No invented score.
type TierKey = 'standard' | 'performer' | 'high';
interface TierInfo {
  key: TierKey;
  /** Rung the teacher is on now. */
  label: string;
  /** Next rung's label (null when already top). */
  nextLabel: string | null;
  /** 0–1 progress toward the next rung. 1 when top tier. */
  progress: number;
  /** Appraisal points still needed for the next rung (0 when top). */
  pointsToNext: number;
  /** Plain-language description of what the next rung unlocks. */
  unlockCopy: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
}

function deriveTier(): TierInfo {
  const score = compensationData.appraisalScore;
  const perfMin = benefitRules.minimumAppraisalForEligibility;
  const highMin = benefitRules.highPerformerAppraisalThreshold;
  const elig = eligibilityFromAppraisal(score);

  if (elig === 'high_performer') {
    return {
      key: 'high', label: 'High Performer', nextLabel: null,
      progress: 1, pointsToNext: 0,
      unlockCopy: 'Top tier reached — all perks unlocked.',
      accent: C.gold, accentSoft: C.goldSoft, accentBorder: C.goldBorder,
    };
  }
  if (elig === 'eligible') {
    const span = Math.max(1, highMin - perfMin);
    return {
      key: 'performer', label: 'Performer', nextLabel: 'High Performer',
      progress: Math.max(0, Math.min(1, (score - perfMin) / span)),
      pointsToNext: Math.max(0, highMin - score),
      unlockCopy: `Reach ${highMin} appraisal to unlock top-tier perks.`,
      accent: C.primary, accentSoft: C.primarySoft, accentBorder: C.primaryBorder,
    };
  }
  return {
    key: 'standard', label: 'Standard', nextLabel: 'Performer',
    progress: perfMin > 0 ? Math.max(0, Math.min(1, score / perfMin)) : 0,
    pointsToNext: Math.max(0, perfMin - score),
    unlockCopy: `Reach ${perfMin} appraisal to unlock standard benefits.`,
    accent: C.muted, accentSoft: C.slateSoft, accentBorder: '#e2e8f0',
  };
}

export default function TeacherPayPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useIsMobile();
  const { teacher, teacherSalary } = useCompensationData(id);

  // History-aware back (same pattern as the Mission Board): pop real
  // in-app history, else fall back to the teacher overview.
  const goBack = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(`/teachers/${id}`);
  };

  const tier = deriveTier();
  // Real appraisal scale + the two configurable thresholds (from the
  // Compensation Settings). The tier bar is drawn against THESE, not
  // even thirds, so the rungs match the actual score ranges.
  const score = compensationData.appraisalScore;
  const perfMin = benefitRules.minimumAppraisalForEligibility;
  const highMin = benefitRules.highPerformerAppraisalThreshold;
  const monthly = computeMonthlyTotal();
  const basic = compensationData.basicSalary;
  const levelInc = compensationData.levelIncentive;
  const allowanceCount = compensationData.allowances.length;
  const uplift = compensationData.basicSalaryUplift;
  const nextPos = compensationData.nextPositionName;
  const promoDone = compensationData.promotionMissionsCompleted;
  const promoTotal = compensationData.promotionMissionsTotal;

  // The single highest-RM honest lever, surfaced as "best next move".
  const bestMove = (() => {
    if (nextPos && uplift > 0) {
      return {
        title: `Get promoted to ${nextPos}`,
        sub: `+${rm(uplift)}/mo · ${promoDone}/${promoTotal} promotion missions done`,
        to: `/teachers/${id}/my-compensation/earn-more`,
      };
    }
    if (tier.key !== 'high') {
      return {
        title: `Climb to ${tier.nextLabel}`,
        sub: `${tier.pointsToNext} appraisal points away · ${tier.unlockCopy}`,
        to: `/teachers/${id}/my-compensation/benefits`,
      };
    }
    return {
      title: 'You’re at the top tier',
      sub: 'Keep your appraisal up to hold every perk.',
      to: `/teachers/${id}/my-compensation/benefits`,
    };
  })();

  const spokes: {
    icon: any; title: string; summary: string; to: string;
  }[] = [
    {
      icon: faReceipt,
      title: 'Pay Breakdown',
      summary: `${rm(basic)} base${levelInc > 0 ? ` + ${rm(levelInc)} level` : ''}${allowanceCount > 0 ? ` + ${allowanceCount} extra${allowanceCount === 1 ? '' : 's'}` : ''}`,
      to: `/teachers/${id}/my-compensation/breakdown`,
    },
    {
      icon: faArrowTrendUp,
      title: 'Grow My Pay',
      summary: nextPos && uplift > 0
        ? `Promotion to ${nextPos} = +${rm(uplift)}/mo`
        : 'Qualifications, commission & bonuses',
      to: `/teachers/${id}/my-compensation/earn-more`,
    },
    {
      icon: faMedal,
      title: 'Benefits & Perks',
      summary: tier.key === 'high'
        ? 'Top-tier perks unlocked'
        : tier.key === 'performer'
          ? 'Standard benefits active · top tier locked'
          : `Locked — reach ${benefitRules.minimumAppraisalForEligibility} appraisal`,
      to: `/teachers/${id}/my-compensation/benefits`,
    },
  ];

  const pageStyle: React.CSSProperties = {
    padding: isMobile ? '16px 12px 28px' : '28px 32px',
    minHeight: '100vh',
    fontFamily: FONT,
    color: C.text,
    background: isMobile
      ? `linear-gradient(to bottom, ${HERO_BG} 0, ${HERO_BG} 195px, ${C.bg} 245px, ${C.bg} 100%)`
      : C.bg,
  };

  return (
    <div style={pageStyle}>
      <style>{`
        .tpay-back { -webkit-tap-highlight-color: transparent; }
        .tpay-row { transition: box-shadow 180ms ease, border-color 180ms ease; }
        .tpay-row:active { background: ${C.slateSoft} !important; }
      `}</style>

      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* Header — bare chevron + title beside it (same compact
            phone-app pattern as the Mission Board). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isMobile ? 18 : 20, minWidth: 0 }}>
          <button
            onClick={goBack}
            className="tpay-back"
            aria-label="Back"
            style={{
              width: 28, height: 28, border: 'none', background: 'transparent',
              cursor: 'pointer', color: C.text, display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 19,
              padding: 0, flexShrink: 0, outline: 'none',
              WebkitAppearance: 'none' as const,
            }}
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <h1 style={{
            margin: 0, fontSize: 20, fontWeight: 800, color: C.textStrong,
            letterSpacing: '-0.02em', flex: 1, minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            My Pay
          </h1>
        </div>

        {/* ── Hero: the teacher's current pay status. Calm white card
            (no heavy gold) so the amount is the single clear focus;
            identity is intentionally secondary. ─────────────────── */}
        <div style={{
          background: C.card,
          border: `1px solid ${C.cardBorder}`,
          borderRadius: 20,
          padding: '18px 18px 20px',
          boxShadow: '0 1px 2px rgba(15,23,42,0.05), 0 6px 16px rgba(15,23,42,0.06)',
          marginBottom: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            {teacherSalary?.position?.badgeUrl ? (
              <img
                src={uploadUrl(teacherSalary.position.badgeUrl)}
                alt={teacherSalary.position?.name ?? 'Position'}
                style={{
                  width: 40, height: 40, objectFit: 'contain', flexShrink: 0,
                  filter: 'drop-shadow(0 3px 8px rgba(15,23,42,0.10))',
                }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${C.primary}14`, color: C.primary, fontSize: 17,
              }}>
                <FontAwesomeIcon icon={faSackDollar} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 10, fontWeight: 800, color: C.muted,
                textTransform: 'uppercase', letterSpacing: '0.1em',
              }}>
                Your Pay
              </div>
              <div style={{
                marginTop: 3, fontSize: 12, fontWeight: 600, color: C.mutedSoft,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {compensationData.positionName || teacher?.name || 'Teacher'}
                {compensationData.level > 0 ? ` · Level ${compensationData.level}` : ''}
                {' · '}{formatService(compensationData.yearsOfService)}
              </div>
            </div>
          </div>

          {/* The hero number — the answer to "how much am I earning". */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: C.gold }}>RM</span>
            <span style={{ fontSize: 42, fontWeight: 800, color: C.textStrong, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {monthly.toLocaleString('en-MY')}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.mutedSoft, marginLeft: 2 }}>/ mo</span>
          </div>
          {/* The "why" — kept short and plain. */}
          <div style={{ marginTop: 7, fontSize: 12, fontWeight: 600, color: C.muted, lineHeight: 1.4 }}>
            {rewardStreamSummary()}
          </div>
          {nextPos && uplift > 0 && (
            <div style={{
              marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 11px', borderRadius: 999,
              background: C.successSoft, color: C.success,
              fontSize: 11.5, fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}>
              <FontAwesomeIcon icon={faArrowTrendUp} style={{ fontSize: 10 }} />
              +{rm(uplift)}/mo within reach
            </div>
          )}
        </div>

        {/* ── Tier card — current tier, next tier, what unlocks it.
            Plain labels, one simple progress bar. ──────────────── */}
        <div style={{
          background: C.card,
          border: `1px solid ${C.cardBorder}`,
          borderRadius: 18,
          padding: '16px 16px 18px',
          boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
          marginBottom: 14,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 10, marginBottom: 14,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 10, fontWeight: 800, color: C.mutedSoft,
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3,
              }}>
                Current Tier
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 16, fontWeight: 800, color: tier.accent, letterSpacing: '-0.01em',
              }}>
                <FontAwesomeIcon icon={tier.key === 'high' ? faStar : faMedal} style={{ fontSize: 13 }} />
                {tier.label}
              </div>
            </div>
            {tier.nextLabel && (
              <div style={{ textAlign: 'right', minWidth: 0 }}>
                <div style={{
                  fontSize: 10, fontWeight: 800, color: C.mutedSoft,
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3,
                }}>
                  Next
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, whiteSpace: 'nowrap' }}>
                  {tier.nextLabel}
                </div>
              </div>
            )}
          </div>

          {/* Appraisal scale — ONE continuous 0–100 track with the two
              settings-driven gates as ticks and a "you are here" marker
              at the actual score. Zones are sized to the real ranges
              (grey 0→min, purple min→high, gold high→100), so it's
              never "even" and a score ≥ the high gate is clearly High. */}
          {(() => {
            const pct = Math.max(0, Math.min(100, score));
            const pm = Math.max(0, Math.min(100, perfMin));
            const hm = Math.max(0, Math.min(100, highMin));
            return (
              <>
                <div style={{ position: 'relative', height: 26 }}>
                  <div style={{
                    position: 'absolute', top: '50%', left: 0, right: 0,
                    transform: 'translateY(-50%)',
                    height: 10, borderRadius: 999, overflow: 'hidden',
                  }}>
                    {/* Fixed gate-zone background — proportional to the
                        real settings thresholds and never recoloured:
                        grey 0→min, purple min→high, gold high→100. */}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
                      <div style={{ flex: Math.max(1, pm), background: '#e8eaee' }} />
                      <div style={{ flex: Math.max(1, hm - pm), background: `${C.primary}33` }} />
                      <div style={{ flex: Math.max(1, 100 - hm), background: `${C.gold}33` }} />
                    </div>
                    {/* Progress fill 0→score, solid in the colour of the
                        gate the score has passed through (grey < min,
                        purple ≥ min, gold ≥ high = the tier accent). */}
                    <div style={{
                      position: 'absolute', top: 0, bottom: 0, left: 0,
                      width: `${pct}%`, borderRadius: 999,
                      background: tier.accent,
                      transition: 'width 500ms cubic-bezier(0.4,0,0.2,1)',
                    }} />
                    {/* Gate markers — only for gates the score has
                        actually PASSED, drawn on the colour fill as a
                        "crossed this gate" tick. Unreached gates are
                        already shown by the number below the bar. */}
                    {[
                      { pos: pm, gate: perfMin },
                      { pos: hm, gate: highMin },
                    ].filter(x => score >= x.gate).map(x => (
                      <div key={x.gate} style={{
                        position: 'absolute', top: 0, bottom: 0,
                        left: `${x.pos}%`, width: 2, transform: 'translateX(-50%)',
                        background: '#ffffff',
                        boxShadow: '0 0 0 1px rgba(15,23,42,0.18)',
                      }} />
                    ))}
                  </div>
                  {/* You-are-here marker — ring uses the current tier
                      colour; clamped so it never clips at the edges. */}
                  <div style={{
                    position: 'absolute', top: '50%',
                    left: `clamp(16px, ${pct}%, calc(100% - 16px))`,
                    transform: 'translate(-50%, -50%)',
                    minWidth: 30, height: 22, padding: '0 7px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 999, background: C.card,
                    border: `2px solid ${tier.accent}`,
                    color: tier.accent, fontSize: 11, fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                    boxShadow: '0 1px 3px rgba(15,23,42,0.18)',
                  }}>
                    {score}
                  </div>
                </div>
                {/* Gate ticks — the explicit settings values. */}
                <div style={{ position: 'relative', height: 13, marginTop: 3 }}>
                  <span style={{ position: 'absolute', left: 0, fontSize: 10, fontWeight: 700, color: C.mutedSoft, fontVariantNumeric: 'tabular-nums' }}>0</span>
                  <span style={{ position: 'absolute', left: `${pm}%`, transform: 'translateX(-50%)', fontSize: 10, fontWeight: 800, color: C.primary, fontVariantNumeric: 'tabular-nums' }}>{perfMin}</span>
                  <span style={{ position: 'absolute', left: `${hm}%`, transform: 'translateX(-50%)', fontSize: 10, fontWeight: 800, color: C.goldDeep, fontVariantNumeric: 'tabular-nums' }}>{highMin}</span>
                  <span style={{ position: 'absolute', right: 0, fontSize: 10, fontWeight: 700, color: C.mutedSoft, fontVariantNumeric: 'tabular-nums' }}>100</span>
                </div>
              </>
            );
          })()}
          <div style={{ marginTop: 12, fontSize: 11.5, fontWeight: 600, color: C.muted, lineHeight: 1.45 }}>
            {tier.unlockCopy}
          </div>
        </div>

        {/* ── Next Pay Quest — the one action that grows pay most.
            Sits above the list cards with a tinted surface so it
            reads as the priority objective, not just another row. */}
        {(() => {
          const isPromoQuest = !!(nextPos && uplift > 0);
          const questPct = promoTotal > 0
            ? Math.max(0, Math.min(100, Math.round((promoDone / promoTotal) * 100)))
            : 0;
          return (
            <Link
              to={bestMove.to}
              className="tpay-row"
              style={{
                display: 'block',
                textDecoration: 'none', color: 'inherit',
                background: `linear-gradient(135deg, ${C.primary}12, ${C.primary}05), ${C.card}`,
                border: `1px solid ${C.primaryBorder}`,
                borderRadius: 16, padding: '16px 16px', marginBottom: 14,
                boxShadow: `0 1px 2px ${C.primary}14, 0 4px 12px ${C.primary}0a`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: C.primarySoft, color: C.primary, fontSize: 15,
                }}>
                  <FontAwesomeIcon icon={faBolt} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 800, color: C.primaryDeep,
                    textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 3,
                  }}>
                    Next Pay Quest
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.textStrong, letterSpacing: '-0.01em', lineHeight: 1.25 }}>
                    {bestMove.title}
                  </div>
                </div>
                <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 12, color: C.primary, flexShrink: 0 }} />
              </div>

              {isPromoQuest ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 10, marginBottom: 7, fontVariantNumeric: 'tabular-nums',
                  }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 12, fontWeight: 800, color: C.success,
                    }}>
                      <FontAwesomeIcon icon={faArrowTrendUp} style={{ fontSize: 10 }} />
                      +{rm(uplift)}/mo
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: C.muted }}>
                      {promoDone}/{promoTotal} missions done
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: C.slateSoft, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${questPct}%`, borderRadius: 999,
                      background: C.primary,
                      transition: 'width 500ms cubic-bezier(0.4,0,0.2,1)',
                    }} />
                  </div>
                </div>
              ) : (
                <div style={{
                  marginTop: 8, fontSize: 12, fontWeight: 600, color: C.muted,
                  lineHeight: 1.4,
                }}>
                  {bestMove.sub}
                </div>
              )}
            </Link>
          );
        })()}

        {/* ── Spokes ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {spokes.map(sp => (
            <Link
              key={sp.title}
              to={sp.to}
              className="tpay-row"
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                textDecoration: 'none', color: 'inherit',
                background: C.card,
                border: `1px solid ${C.cardBorder}`,
                borderRadius: 14, padding: '15px 16px',
                boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${C.primary}12`, color: C.primary, fontSize: 15,
              }}>
                <FontAwesomeIcon icon={sp.icon} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.textStrong, letterSpacing: '-0.008em' }}>
                  {sp.title}
                </div>
                <div style={{
                  marginTop: 3, fontSize: 12, fontWeight: 600, color: C.muted,
                  lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {sp.summary}
                </div>
              </div>
              <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 12, color: C.mutedSoft, flexShrink: 0 }} />
            </Link>
          ))}
        </div>

        {/* Quiet link to the (separate) redeemable Rewards wallet —
            kept distinct from salary on purpose: those are real
            redeemable points, not a score layered on pay. */}
        <Link
          to={`/teachers/${id}/rewards`}
          className="tpay-row"
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            marginTop: 14, padding: '12px 14px',
            textDecoration: 'none',
            background: 'transparent',
            border: `1px dashed ${C.cardBorder}`,
            borderRadius: 12,
            color: C.muted, fontSize: 12, fontWeight: 700,
          }}
        >
          <FontAwesomeIcon icon={faSackDollar} style={{ fontSize: 12 }} />
          Rewards wallet
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 10, marginLeft: 'auto' }} />
        </Link>
      </div>
    </div>
  );
}
