// Pay → the benefit tier a teacher is on: Standard, Performer or High
// Performer, from their appraisal score and the two thresholds in Settings →
// Compensation (honest money — no invented score). Pure; shared by the Pay
// hub and Benefits & Perks so they never disagree.

export interface TierRules {
  /** At or above: Performer (standard benefits). */
  minimumAppraisalForEligibility: number;
  /** At or above: High Performer (every benefit). */
  highPerformerAppraisalThreshold: number;
}

export const TIER_COLORS = {
  gold: '#eab308', goldDeep: '#a16207', goldSoft: '#fef9c3', goldBorder: '#fde047',
  primary: '#5a67d8', primarySoft: '#eef2ff', primaryBorder: '#c7d2fe',
  muted: '#64748b', slateSoft: '#f1f5f9',
} as const;

export type TierKey = 'standard' | 'performer' | 'high';

export interface TierInfo {
  key: TierKey;
  /** Rung they're on now. */
  label: string;
  /** The next rung's label (null at the top). */
  nextLabel: string | null;
  /** 0–1 toward the next rung (1 at the top). */
  progress: number;
  /** Appraisal points still needed for the next rung (0 at the top). */
  pointsToNext: number;
  /** One line on what the next rung unlocks. */
  unlockCopy: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
}

export function tierFor(score: number, rules: TierRules): TierInfo {
  const perfMin = rules.minimumAppraisalForEligibility;
  const highMin = rules.highPerformerAppraisalThreshold;
  if (score >= highMin) {
    return {
      key: 'high', label: 'High Performer', nextLabel: null, progress: 1, pointsToNext: 0,
      unlockCopy: 'Top tier reached — all perks unlocked.',
      accent: TIER_COLORS.gold, accentSoft: TIER_COLORS.goldSoft, accentBorder: TIER_COLORS.goldBorder,
    };
  }
  if (score >= perfMin) {
    const span = Math.max(1, highMin - perfMin);
    return {
      key: 'performer', label: 'Performer', nextLabel: 'High Performer',
      progress: Math.max(0, Math.min(1, (score - perfMin) / span)), pointsToNext: Math.max(0, highMin - score),
      unlockCopy: `Reach ${highMin} appraisal to unlock top-tier perks.`,
      accent: TIER_COLORS.primary, accentSoft: TIER_COLORS.primarySoft, accentBorder: TIER_COLORS.primaryBorder,
    };
  }
  return {
    key: 'standard', label: 'Standard', nextLabel: 'Performer',
    progress: perfMin > 0 ? Math.max(0, Math.min(1, score / perfMin)) : 0, pointsToNext: Math.max(0, perfMin - score),
    unlockCopy: `Reach ${perfMin} appraisal to unlock standard benefits.`,
    accent: TIER_COLORS.muted, accentSoft: TIER_COLORS.slateSoft, accentBorder: '#e2e8f0',
  };
}
