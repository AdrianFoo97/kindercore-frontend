import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMedal, faStar } from '@fortawesome/free-solid-svg-icons';
import { TIER_COLORS, tierFor, type TierRules } from './payTier.js';
import { GOLD } from '../benefits/benefitsTheme.js';

// Pay → "Current tier": the tier they're on and the next one, then ONE 0–100
// appraisal track with the two settings-driven thresholds and a "you are
// here" marker at their score. Zones are sized to the real ranges (grey
// 0→Performer, violet Performer→High, gold High→100), so a score at or above
// the high threshold clearly reads as High. A High Performer's card is dressed in
// gold, like the high-performer benefits. Used by the Pay hub and Benefits & Perks.

const C = { card: '#ffffff', border: '#eceef2', muted: '#64748b', track: '#e8eaee' };

export default function TierCard({ score, rules, style }: { score: number; rules: TierRules; style?: React.CSSProperties }) {
  const tier = tierFor(score, rules);
  const premium = tier.key === 'high';
  const perfMin = rules.minimumAppraisalForEligibility;
  const highMin = rules.highPerformerAppraisalThreshold;
  const pct = Math.max(0, Math.min(100, score));
  const pm = Math.max(0, Math.min(100, perfMin));
  const hm = Math.max(0, Math.min(100, highMin));
  const label: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 };
  const tick: React.CSSProperties = { position: 'absolute', fontSize: 11, fontVariantNumeric: 'tabular-nums' };

  return (
    <section aria-label={`Current tier: ${tier.label}`} style={{
      background: premium ? GOLD.wash : C.card, border: `1px solid ${premium ? GOLD.border : C.border}`, borderRadius: 18, padding: '16px 16px 18px',
      boxShadow: premium ? GOLD.glow : '0 1px 2px rgba(15,23,42,0.04)', marginBottom: 14, ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div style={label}>Current Tier</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 16, fontWeight: 800, color: tier.accent, letterSpacing: '-0.01em' }}>
            <FontAwesomeIcon icon={tier.key === 'high' ? faStar : faMedal} style={{ fontSize: 13 }} />
            {tier.label}
          </div>
        </div>
        {tier.nextLabel && (
          <div style={{ textAlign: 'right', minWidth: 0 }}>
            <div style={label}>Next</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, whiteSpace: 'nowrap' }}>{tier.nextLabel}</div>
          </div>
        )}
      </div>

      <div role="img" aria-label={`Appraisal score ${score} of 100 — Performer from ${perfMin}, High Performer from ${highMin}`} style={{ position: 'relative', height: 26 }}>
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, transform: 'translateY(-50%)', height: 10, borderRadius: 999, overflow: 'hidden' }}>
          {/* The fixed zones, sized to the real thresholds. */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
            <div style={{ flex: Math.max(1, pm), background: C.track }} />
            <div style={{ flex: Math.max(1, hm - pm), background: `${TIER_COLORS.primary}33` }} />
            <div style={{ flex: Math.max(1, 100 - hm), background: `${TIER_COLORS.gold}33` }} />
          </div>
          {/* Filled to their score, in their tier's colour. */}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${pct}%`, borderRadius: 999, background: tier.accent }} />
          {/* A tick on each threshold they've passed. */}
          {[{ pos: pm, gate: perfMin }, { pos: hm, gate: highMin }].filter(x => score >= x.gate).map(x => (
            <div key={x.gate} style={{ position: 'absolute', top: 0, bottom: 0, left: `${x.pos}%`, width: 2, transform: 'translateX(-50%)', background: '#fff', boxShadow: '0 0 0 1px rgba(15,23,42,0.18)' }} />
          ))}
        </div>
        {/* You are here — clamped so it never clips at the edges. */}
        <div style={{
          position: 'absolute', top: '50%', left: `clamp(16px, ${pct}%, calc(100% - 16px))`, transform: 'translate(-50%, -50%)',
          minWidth: 30, height: 22, padding: '0 7px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999,
          background: C.card, border: `2px solid ${tier.accent}`, color: tier.accent, fontSize: 11, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
          boxShadow: '0 1px 3px rgba(15,23,42,0.18)',
        }}>{score}</div>
      </div>
      <div aria-hidden style={{ position: 'relative', height: 13, marginTop: 3 }}>
        <span style={{ ...tick, left: 0, fontWeight: 700, color: C.muted }}>0</span>
        <span style={{ ...tick, left: `${pm}%`, transform: 'translateX(-50%)', fontWeight: 800, color: TIER_COLORS.primary }}>{perfMin}</span>
        <span style={{ ...tick, left: `${hm}%`, transform: 'translateX(-50%)', fontWeight: 800, color: TIER_COLORS.goldDeep }}>{highMin}</span>
        <span style={{ ...tick, right: 0, fontWeight: 700, color: C.muted }}>100</span>
      </div>
      <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: C.muted, lineHeight: 1.45 }}>{tier.unlockCopy}</div>
    </section>
  );
}
