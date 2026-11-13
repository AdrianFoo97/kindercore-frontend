import { describe, it, expect } from 'vitest';
import { benefitTiers, standingLine } from '../../pages/teacherPay/benefits/benefitsCatalog';

// Benefits & Perks — which benefits a teacher has, from their appraisal score
// and years of service. The teacher app and the admin page read this one list.

const rules = { minimumAppraisalForEligibility: 60, highPerformerAppraisalThreshold: 80, medicalQuarterlyAllowance: 50, loyaltyIncentiveRate: 0.02, loyaltyIncentiveCap: 400 };
const statusOf = (score: number, years: number) => Object.fromEntries(
  benefitTiers({ score, yearsOfService: years, rules }).flatMap(t => t.items.map(i => [i.key, i.status])),
);

describe('Benefits & Perks', () => {
  it('keeps every benefit locked below the standard threshold', () => {
    const tiers = benefitTiers({ score: 52, yearsOfService: 4, rules });
    expect(tiers.map(t => t.unlocked)).toEqual([false, false]);
    expect(new Set(Object.values(statusOf(52, 4)))).toEqual(new Set(['locked']));
  });

  it('opens standard benefits at the threshold; ones needing a year of service wait until then', () => {
    const s = statusOf(60, 0.5);
    expect(s.medical).toBe('available');
    expect(s.loyalty).toBe('in-progress');
    expect(statusOf(60, 1).loyalty).toBe('available');
    expect(s['flexible-hours']).toBe('locked');
  });

  it('opens high-performer benefits at their threshold; ownership programmes also need years and a score of 85', () => {
    expect(statusOf(80, 1)['flexible-hours']).toBe('available');
    expect(statusOf(80, 4).shareholding).toBe('in-progress'); // score under 85
    expect(statusOf(90, 4).shareholding).toBe('available');
    expect(statusOf(90, 4).partnership).toBe('in-progress'); // needs 5 years
  });

  it('says in one line where the teacher stands and what is next', () => {
    expect(standingLine(52, rules)).toBe('8 more points unlocks standard benefits.');
    expect(standingLine(79, rules)).toBe('Standard benefits are yours. 1 more point unlocks high-performer benefits.');
    expect(standingLine(85, rules)).toBe('You have every benefit tier. Keep your score to keep them.');
  });
});