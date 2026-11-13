import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faAward, faBriefcaseMedical, faBusinessTime, faChalkboardUser, faChartLine, faHandshake, faLeaf,
  faMugSaucer, faUsers, faUtensils,
} from '@fortawesome/free-solid-svg-icons';
import { formatService } from '../../../utils/serviceYears.js';

// Benefits & Perks — every benefit, what it's worth, and what unlocks it.
// The one copy: the teacher's Benefits page and the admin compensation page
// both read this, so they can't disagree about who gets what.

/** A benefit's own extra gates, beyond its tier's appraisal threshold. */
const LOYALTY_MIN_YEARS = 1;
const SHAREHOLDING_MIN_YEARS = 3;
const PARTNERSHIP_MIN_YEARS = 5;
const OWNERSHIP_MIN_SCORE = 85;

export interface BenefitRules {
  /** Appraisal score that unlocks Standard benefits (inclusive). */
  minimumAppraisalForEligibility: number;
  /** Appraisal score that unlocks High-Performer benefits (inclusive). */
  highPerformerAppraisalThreshold: number;
  medicalQuarterlyAllowance: number;
  loyaltyIncentiveRate: number;
  loyaltyIncentiveCap: number;
}

export interface BenefitRequirement {
  label: string;
  /** Undefined = a process step (an interview), not something tracked here. */
  met?: boolean;
  /** Can be done when claiming (e.g. a medical certificate) — not a gate. */
  optional?: boolean;
  /** 0–100 towards it, and the "2 yr / 3 yr" text — for long-term gates. */
  progress?: number;
  current?: string;
}

/** available = yours now; in-progress = tier unlocked but this one's own gate isn't met yet; locked = tier not unlocked. */
export type BenefitStatus = 'available' | 'in-progress' | 'locked';

export interface BenefitItem {
  key: string;
  icon: IconDefinition;
  title: string;
  /** What it's worth, in one line ("RM 50 / quarter"). */
  value: string;
  description: string;
  /** This benefit's own extra condition, in a few words — shown on the row. */
  extraGate?: string;
  requirements: BenefitRequirement[];
  note?: string;
  status: BenefitStatus;
}

export interface BenefitTier {
  key: 'standard' | 'high';
  title: string;
  threshold: number;
  unlocked: boolean;
  items: BenefitItem[];
}

const rmText = (n: number) => `RM ${n.toLocaleString('en-MY')}`;
const pct = (n: number, of: number) => Math.min(100, Math.max(0, (n / of) * 100));

function itemStatus(tierUnlocked: boolean, ownGateMet = true): BenefitStatus {
  if (!tierUnlocked) return 'locked';
  return ownGateMet ? 'available' : 'in-progress';
}

/** Both tiers, with each benefit's status for this teacher. */
export function benefitTiers({ score, yearsOfService, rules }: { score: number; yearsOfService: number; rules: BenefitRules }): BenefitTier[] {
  const standardOn = score >= rules.minimumAppraisalForEligibility;
  const highOn = score >= rules.highPerformerAppraisalThreshold;
  const loyal = yearsOfService >= LOYALTY_MIN_YEARS;
  const yearGate = (title: string): BenefitRequirement => ({ label: title, met: loyal });
  const ownership = (years: number): BenefitRequirement[] => [
    { label: `At least ${years} years of service`, met: yearsOfService >= years, progress: pct(yearsOfService, years), current: `${formatService(yearsOfService)} / ${years} yr` },
    { label: `Average appraisal ${OWNERSHIP_MIN_SCORE} or above over your service`, met: score >= OWNERSHIP_MIN_SCORE, progress: pct(score, OWNERSHIP_MIN_SCORE), current: `${score} / ${OWNERSHIP_MIN_SCORE}` },
  ];

  const standard: BenefitItem[] = [
    {
      key: 'medical', icon: faBriefcaseMedical, title: 'Medical benefit',
      value: `${rmText(rules.medicalQuarterlyAllowance)} / quarter`,
      description: 'A quarterly allowance for medical expenses. Submit a valid medical certificate to claim it back.',
      requirements: [{ label: 'Active employment', met: true }, { label: 'A valid medical certificate when you claim', met: false, optional: true }],
      note: 'Reimbursement follows the school policy.',
      status: itemStatus(standardOn),
    },
    {
      key: 'loyalty', icon: faAward, title: 'Loyalty incentive',
      value: `+${Math.round(rules.loyaltyIncentiveRate * 100)}% of basic salary / year, up to ${rmText(rules.loyaltyIncentiveCap)}`,
      description: 'A reward for staying with the school. It grows each year, up to the cap.',
      extraGate: `After ${LOYALTY_MIN_YEARS} year of service`,
      requirements: [yearGate(`At least ${LOYALTY_MIN_YEARS} full year of service`)],
      note: `Your service: ${formatService(yearsOfService)}`,
      status: itemStatus(standardOn, loyal),
    },
    {
      key: 'snacks', icon: faMugSaucer, title: 'Snacks & tea',
      value: 'Every month',
      description: 'Snacks and tea in the staff lounge, to recharge during breaks.',
      requirements: [], note: 'Nothing to claim — it’s in the staff lounge.',
      status: itemStatus(standardOn),
    },
    {
      key: 'team-building', icon: faUsers, title: 'Annual team building',
      value: 'Yearly company event',
      description: 'A yearly event to work together and recharge with colleagues away from the classroom.',
      extraGate: `After ${LOYALTY_MIN_YEARS} year of service`,
      requirements: [yearGate(`At least ${LOYALTY_MIN_YEARS} full year of service`)],
      note: 'Fully paid by the school.',
      status: itemStatus(standardOn, loyal),
    },
    {
      key: 'annual-dinner', icon: faUtensils, title: 'Annual dinner',
      value: 'Year-end celebration',
      description: 'A year-end dinner to celebrate the year together.',
      extraGate: `After ${LOYALTY_MIN_YEARS} year of service`,
      requirements: [yearGate(`At least ${LOYALTY_MIN_YEARS} full year of service`)],
      note: 'Theme and dress code are announced before the event.',
      status: itemStatus(standardOn, loyal),
    },
    {
      key: 'training', icon: faChalkboardUser, title: 'Internal training',
      value: 'All year',
      description: 'Training run by the school to build your skills and prepare you for promotion.',
      requirements: [], note: 'Sign up with HR any time.',
      status: itemStatus(standardOn),
    },
  ];

  const high: BenefitItem[] = [
    {
      key: 'flexible-hours', icon: faBusinessTime, title: 'Semi-flexible hours',
      value: 'Adjust your schedule',
      description: 'Shift your hours to fit personal or study needs.',
      requirements: [
        { label: 'Your daily duties are still done' },
        { label: 'Your supervisor approves the change' },
        { label: 'Classes and the school keep running normally' },
      ],
      status: itemStatus(highOn),
    },
    {
      key: 'extra-leave', icon: faLeaf, title: 'Extra annual leave',
      value: '1 day per weekend training',
      description: 'Extra leave for approved weekend training — e.g. 2 weekend trainings = 2 leave days.',
      requirements: [{ label: 'Approved by your supervisor first' }, { label: 'Taken during school holidays' }],
      status: itemStatus(highOn),
    },
    {
      key: 'shareholding', icon: faChartLine, title: 'Teacher shareholding',
      value: 'Shares, dividends and a say',
      description: 'Become a co-owner of the school: a share of it, dividends, and a voice in big decisions.',
      extraGate: `After ${SHAREHOLDING_MIN_YEARS} years · score ${OWNERSHIP_MIN_SCORE}+`,
      requirements: [...ownership(SHAREHOLDING_MIN_YEARS), { label: 'An alignment interview' }],
      status: itemStatus(highOn, yearsOfService >= SHAREHOLDING_MIN_YEARS && score >= OWNERSHIP_MIN_SCORE),
    },
    {
      key: 'partnership', icon: faHandshake, title: 'Kindergarten partnership',
      value: 'Co-own a new branch',
      description: 'Co-own and lead a new branch, with part of the capital, ownership and ongoing support from the school.',
      extraGate: `After ${PARTNERSHIP_MIN_YEARS} years · score ${OWNERSHIP_MIN_SCORE}+`,
      requirements: [...ownership(PARTNERSHIP_MIN_YEARS), { label: 'A leadership and partnership interview' }],
      status: itemStatus(highOn, yearsOfService >= PARTNERSHIP_MIN_YEARS && score >= OWNERSHIP_MIN_SCORE),
    },
  ];

  return [
    { key: 'standard', title: 'Standard benefits', threshold: rules.minimumAppraisalForEligibility, unlocked: standardOn, items: standard },
    { key: 'high', title: 'High-performer benefits', threshold: rules.highPerformerAppraisalThreshold, unlocked: highOn, items: high },
  ];
}

/** The one-line answer at the top: where you stand and what's next. */
export function standingLine(score: number, rules: BenefitRules): string {
  if (score >= rules.highPerformerAppraisalThreshold) return 'You have every benefit tier. Keep your score to keep them.';
  if (score >= rules.minimumAppraisalForEligibility) {
    const gap = rules.highPerformerAppraisalThreshold - score;
    return `Standard benefits are yours. ${gap} more point${gap === 1 ? '' : 's'} unlocks high-performer benefits.`;
  }
  const gap = rules.minimumAppraisalForEligibility - score;
  return `${gap} more point${gap === 1 ? '' : 's'} unlocks standard benefits.`;
}