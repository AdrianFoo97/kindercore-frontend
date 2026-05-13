import { useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronLeft, faChevronRight, faChevronDown, faChevronUp,
  faSackDollar, faShieldHalved, faGaugeHigh, faCalendarCheck,
  faCheck, faClock, faLock, faLockOpen, faAward,
  faPiggyBank, faBriefcaseMedical, faBusinessTime, faGift,
  faCircleCheck, faTrophy, faFire,
  faCircle, faGraduationCap, faUserPlus,
  faBookOpen, faLeaf,
  faMugSaucer, faUtensils, faUsers, faChalkboardUser, faMedal,
  faChartLine, faHandshake,
} from '@fortawesome/free-solid-svg-icons';
import { fetchTeachers } from '../api/planner.js';
import { fetchTeachersWithSalary, fetchLevelIncentives } from '../api/salary.js';
import { fetchTeacherAppraisals } from '../api/teacher-appraisals.js';
import { fetchSettings } from '../api/settings.js';
import { fetchAllowanceTypes } from '../api/allowance.js';
import { fetchTeacherCareer } from '../api/career-missions.js';
import { uploadUrl } from '../api/upload.js';
import { pointsBalance } from '../data/pointsRewardsMock.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import {
  PERFORMER_THRESHOLD_KEY,
  HIGH_PERFORMER_THRESHOLD_KEY,
  DEFAULT_PERFORMER_THRESHOLD,
  DEFAULT_HIGH_PERFORMER_THRESHOLD,
  readScore,
} from './settings/CompensationSettingsPage.js';

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — page-scoped so the compensation surface owns its dialect
// (deep navy + gold) without leaking into the rest of the app.
// ─────────────────────────────────────────────────────────────────────────────

// Palette aligned with the Career Path page so the two surfaces feel
// like one product. Same primary blue, same neutral scale; gold stays
// available for money accents inside cards (NOT hero chrome).
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
  primary: '#5a67d8',          // matches Career Path
  primarySoft: '#eef2ff',
  primaryBorder: '#c7d2fe',
  // Money / rewards accent — bright gold for High-Performer tier
  // celebrations. Used inside cards, never as page chrome.
  gold: '#eab308',
  goldSoft: '#fef9c3',
  goldBorder: '#fde047',
  // Performer tier — cool silver. Distinct from neutral slate so it
  // reads as a deliberate tier celebration, not "muted/disabled."
  silver: '#64748b',
  silverSoft: '#f1f5f9',
  silverBorder: '#cbd5e1',
  // Earned / guaranteed (status, not tier).
  success: '#059669',
  successSoft: '#ecfdf5',
  successBorder: '#a7f3d0',
  // Not-eligible / blocked.
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  dangerBorder: '#fecaca',
  // Locked / quiet.
  slateSoft: '#f1f5f9',
  slate: '#475569',
};

const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

// ─────────────────────────────────────────────────────────────────────────────
// Page-scoped runtime data — populated from backend queries in the main
// component, read by sub-components. Sensible fallbacks let the page
// render before queries resolve.
// ─────────────────────────────────────────────────────────────────────────────

export const compensationData = {
  basicSalary: 0,
  levelIncentive: 0,                   // auto-computed from position + level
  allowances: [] as { typeId: string; typeName: string; amount: number; icon?: string; isGuaranteed?: boolean; parentId?: string | null }[],
  // Top-level allowance types that have children — populated even if
  // they have no direct teacher amount, so the comp page can render
  // them as parent cards with summed children.
  parentTypes: [] as { id: string; name: string; icon?: string; isGuaranteed?: boolean }[],
  positionName: '',                    // e.g. "Junior EI" — shown as Basic Salary sub
  positionId: null as string | null,   // current position id — used to filter level incentives
  positionMaxLevel: 0,                 // cap for level-up math (e.g. 5)
  level: 0,                            // 0 = no level
  isFixedSalary: false,                // true = no level ladder applies
  // Level → RM incentive map for the teacher's CURRENT position only.
  // Missing levels default to 0 in lookups (level 0 = no incentive).
  incentiveByLevel: {} as Record<number, number>,
  appraisalScore: 0,                   // 0–100 · 6-month average from appraisals API
  yearsOfService: 0,                   // computed from teacher.createdAt
  // Promotion fields — populated from fetchTeacherCareer so MoneyQuests
  // can render a "Get promoted" card with the live readiness gates.
  // Null when no next position (final stage or off-ladder).
  nextPositionName: null as string | null,
  nextBasicSalary: 0,                  // next position's basic (level 0) salary
  // Realistic promotion bump: compares teacher's CURRENT total
  // (basic + their level incentive) against the next position's basic.
  // A Junior L5 at RM 2,250 promoted to Senior L0 at RM 2,400 = +150,
  // not +400 — the level incentive resets at the new position.
  basicSalaryUplift: 0,
  promotionMissionsMet: false,
  promotionMissionsCompleted: 0,
  promotionMissionsTotal: 0,
  promotionAppraisalMet: false,
  promotionAppraisalRequired: 0,
  promotionAppraisalValue: null as number | null,
  promotionSupervisorApproved: false,
  promotionAllReady: false,
  // Full salary ladder — shown inside the "Get promoted" card so the
  // teacher can see every stage's base salary, not just the next one.
  promotionLadder: [] as { positionId: string; name: string; basicSalary: number; isCurrent: boolean; isNext: boolean }[],
};

// Compute monthly total on demand (compensationData fields update as
// queries resolve, so we can't bake this into a module-level const).
export function computeMonthlyTotal(): number {
  return compensationData.basicSalary
    + compensationData.levelIncentive
    + compensationData.allowances.reduce((sum, a) => sum + a.amount, 0);
}

// Tier thresholds come from the SystemSetting table (editable on the
// Compensation Settings page). Other policy values stay as code
// constants for now — they can move to settings later.
export const benefitRules = {
  minimumAppraisalForEligibility: DEFAULT_PERFORMER_THRESHOLD,
  highPerformerAppraisalThreshold: DEFAULT_HIGH_PERFORMER_THRESHOLD,
  medicalQuarterlyAllowance: 50,
  loyaltyIncentiveRate: 0.02,
  loyaltyIncentiveCap: 400,
  trainingAllowancePerDay: 20,
  petrolAllowancePerTraining: 60,
  trainingQualificationAllowance: 50,
};

// Three-tier qualification allowance — KAP, Bachelor's, Master's.
// All require MQA accreditation (where applicable) and minimum CGPA 3.3
// for degree paths.
const qualificationTiers: { label: string; sub: string; amount: number }[] = [
  { label: 'KAP Certificate', sub: 'Approved authority', amount: 100 },
  { label: "Bachelor's (ECE)", sub: 'MQA · CGPA ≥ 3.3', amount: 300 },
  { label: "Master's (ECE)",   sub: 'MQA · CGPA ≥ 3.3', amount: 500 },
];

const enrollmentCommissionTiers: { enrollments: number; rate: number; label: string }[] = [
  { enrollments: 1, rate: 0.15, label: '1' },
  { enrollments: 2, rate: 0.20, label: '2' },
  { enrollments: 3, rate: 0.25, label: '3' },
  { enrollments: 4, rate: 0.30, label: '4+' },
];

// Points chip palette — violet to distinguish points from the RM
// dialect used by the rest of this page (gold/green/blue). Balance
// itself comes from the shared pointsRewardsMock module so the chip
// stays in sync with the full rewards page.
const POINTS_C = {
  accent: '#7c3aed',
  soft: '#f5f3ff',
  border: '#ddd6fe',
};

// Derived eligibility — single function, used everywhere on the page.
// Thresholds are inclusive: a score of N qualifies as "N and above". So
// setting High-Performer to 80 means 80 itself is high-performer (the
// previous strict `>` semantics forced users to enter 79 to get 80).
export function eligibilityFromAppraisal(score: number): 'not_eligible' | 'eligible' | 'high_performer' {
  if (score < benefitRules.minimumAppraisalForEligibility) return 'not_eligible';
  if (score >= benefitRules.highPerformerAppraisalThreshold) return 'high_performer';
  return 'eligible';
}

// ─────────────────────────────────────────────────────────────────────────────
// Status grammar — central palette so badges read identically across sections.
// ─────────────────────────────────────────────────────────────────────────────

type RewardStatus =
  | 'guaranteed'         // Always paid — Basic Salary
  | 'confirmed-when-met' // Fixed amount, paid IF condition is met — KPI, Attendance, Training, Commission
  | 'variable'           // Variable amount, NOT guaranteed — Profit Sharing, Annual Bonus
  | 'earned'
  | 'in-progress'
  | 'pending'
  | 'unlocked'
  | 'locked'
  | 'eligible'
  | 'not-eligible'
  | 'achieved';

const STATUS_META: Record<RewardStatus, { label: string; bg: string; color: string; border: string; icon: any }> = {
  guaranteed:         { label: 'Guaranteed',         bg: C.successSoft, color: C.success, border: C.successBorder, icon: faShieldHalved },
  // Middle tier — the contract: do X, get RM Y. Reads in primary blue
  // with a check-mark, distinct from variable rewards.
  'confirmed-when-met':{ label: 'Subject to Criteria', bg: C.primarySoft, color: C.primary, border: C.primaryBorder, icon: faCheck },
  // Variable = uncertain/conditional, NOT premium. Quiet slate treatment;
  // gold is reserved for high-performer perks lower on the page.
  variable:           { label: 'Variable',           bg: C.slateSoft,   color: C.slate,   border: '#e2e8f0',       icon: faSackDollar },
  earned:             { label: 'Earned',             bg: C.successSoft, color: C.success, border: C.successBorder, icon: faCircleCheck },
  achieved:           { label: 'Achieved',           bg: C.successSoft, color: C.success, border: C.successBorder, icon: faTrophy },
  'in-progress':      { label: 'In Progress',        bg: C.primarySoft, color: C.primary, border: C.primaryBorder, icon: faClock },
  pending:            { label: 'Pending',            bg: C.goldSoft,    color: C.gold,    border: C.goldBorder,    icon: faClock },
  unlocked:           { label: 'Unlocked',           bg: C.goldSoft,    color: C.gold,    border: C.goldBorder,    icon: faLockOpen },
  locked:             { label: 'Locked',             bg: C.slateSoft,   color: C.slate,   border: '#e2e8f0',       icon: faLock },
  eligible:           { label: 'Eligible',           bg: C.successSoft, color: C.success, border: C.successBorder, icon: faCheck },
  'not-eligible':     { label: 'Not Eligible',       bg: C.dangerSoft,  color: C.danger,  border: C.dangerBorder,  icon: faLock },
};

function StatusBadge({ status, size = 'md' }: { status: RewardStatus; size?: 'sm' | 'md' }) {
  const meta = STATUS_META[status];
  const small = size === 'sm';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: small ? 4 : 5,
      padding: small ? '1px 8px' : '2px 10px',
      height: small ? 18 : 22,
      borderRadius: 999,
      fontSize: small ? 9 : 10, fontWeight: 700,
      background: meta.bg, color: meta.color,
      border: `1px solid ${meta.border}`,
      textTransform: 'uppercase', letterSpacing: '0.05em',
      whiteSpace: 'nowrap',
    }}>
      <FontAwesomeIcon icon={meta.icon} style={{ fontSize: small ? 8 : 9 }} />
      {meta.label}
    </span>
  );
}

function MechanicChip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', height: 18, borderRadius: 999,
      fontSize: 9, fontWeight: 700,
      background: `${color}14`, color, border: `1px solid ${color}33`,
      textTransform: 'uppercase', letterSpacing: '0.06em',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

export function rm(v: number): string {
  return `RM ${v.toLocaleString('en-MY')}`;
}

// Format a fractional-year service length into human-readable form:
//   2.5  → "2 yr 6 mo"
//   1.0  → "1 yr"
//   0.5  → "6 mo"
export function formatService(years: number): string {
  const fullYears = Math.floor(years);
  const months = Math.round((years - fullYears) * 12);
  if (fullYears === 0) return `${months} mo`;
  if (months === 0) return `${fullYears} yr`;
  return `${fullYears} yr ${months} mo`;
}

// Resolve the FontAwesome icon for an allowance card. Prefers the
// admin-configured icon stored on the AllowanceType row; falls back
// to a name-based heuristic for legacy rows that don't carry an icon.
const ALLOWANCE_ICON_REGISTRY: Record<string, any> = {
  'gift': faGift,
  'gauge-high': faGaugeHigh,
  'calendar-check': faCalendarCheck,
  'award': faAward,
  'graduation-cap': faGraduationCap,
  'trophy': faTrophy,
  'book-open': faBookOpen,
  'medal': faMedal,
  'sack-dollar': faSackDollar,
  'piggy-bank': faPiggyBank,
  'shield-halved': faShieldHalved,
  'fire': faFire,
  'circle-check': faCircleCheck,
  'user-plus': faUserPlus,
  'leaf': faLeaf,
  'lock': faLock,
};
function iconForAllowance(name: string, iconKey?: string): any {
  if (iconKey && ALLOWANCE_ICON_REGISTRY[iconKey]) return ALLOWANCE_ICON_REGISTRY[iconKey];
  const lc = name.toLowerCase();
  if (lc.includes('kpi')) return faGaugeHigh;
  if (lc.includes('attendance')) return faCalendarCheck;
  if (lc.includes('qualification')) return faAward;
  if (lc.includes('level')) return faAward;
  return faGift;
}

// Build the reward-streams summary string under the headline number —
// short word per component, joined with " + ". Children are rolled up
// under their parent, mirroring the breakdown cards.
export function rewardStreamSummary(): string {
  const parts: string[] = [];
  if (compensationData.basicSalary > 0) parts.push('Basic');
  if (compensationData.levelIncentive > 0) parts.push('Level');
  const seenParentIds = new Set<string>();
  // First pass: top-level allowances with non-zero (own + children sum).
  for (const a of compensationData.allowances) {
    if (a.parentId) continue;
    const childrenSum = compensationData.allowances
      .filter(c => c.parentId === a.typeId)
      .reduce((s, c) => s + c.amount, 0);
    if (a.amount + childrenSum <= 0) continue;
    seenParentIds.add(a.typeId);
    parts.push(a.typeName.split(/\s+/)[0]);
  }
  // Second pass: synthesize parent labels for children whose parent
  // had no own amount.
  for (const c of compensationData.allowances) {
    if (!c.parentId || seenParentIds.has(c.parentId)) continue;
    const meta = compensationData.parentTypes.find(p => p.id === c.parentId);
    if (!meta) continue;
    seenParentIds.add(c.parentId);
    parts.push(meta.name.split(/\s+/)[0]);
  }
  return parts.join(' + ');
}


// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Shared data hook — runs the same backend queries every compensation
// surface needs and writes the result into the module-level
// `compensationData` / `benefitRules` objects the section components
// read from. Returns the small set of derived values pages need
// directly (teacher record, salary record, eligibility tier).
//
// Used by the principal view (this file), the mobile hub
// (TeacherMyCompensationPage), and the mobile Earn-More / Benefits
// subpages. Centralising it here means a deep-linked mobile subpage
// still loads + populates `compensationData` correctly without
// duplicating ~90 lines of prep logic.
// ─────────────────────────────────────────────────────────────────────────────

export function useCompensationData(id: string | undefined) {
  const [searchParams] = useSearchParams();

  const { data: teachers = [] } = useQuery({ queryKey: ['planner-teachers'], queryFn: fetchTeachers });
  const { data: teachersWithSalary = [] } = useQuery({
    queryKey: ['teachers-with-salary'],
    queryFn: fetchTeachersWithSalary,
  });
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  const { data: allowanceTypes = [] } = useQuery({ queryKey: ['allowance-types'], queryFn: fetchAllowanceTypes });
  const { data: appraisalData } = useQuery({
    queryKey: ['teacher-appraisals', id],
    queryFn: () => fetchTeacherAppraisals(id!),
    enabled: !!id,
  });
  const { data: careerData } = useQuery({
    queryKey: ['teacher-career', id],
    queryFn: () => fetchTeacherCareer(id!),
    enabled: !!id,
  });
  const { data: levelIncentives = [] } = useQuery({
    queryKey: ['level-incentives'],
    queryFn: fetchLevelIncentives,
  });

  const teacher = (teachers as any[]).find(t => t.id === id);
  const teacherSalary = teachersWithSalary.find(t => t.id === id);

  benefitRules.minimumAppraisalForEligibility =
    readScore(settings, PERFORMER_THRESHOLD_KEY, DEFAULT_PERFORMER_THRESHOLD);
  benefitRules.highPerformerAppraisalThreshold =
    readScore(settings, HIGH_PERFORMER_THRESHOLD_KEY, DEFAULT_HIGH_PERFORMER_THRESHOLD);

  if (teacherSalary) {
    const breakdown = teacherSalary.breakdown;
    if (teacherSalary.isFixedSalary) {
      compensationData.basicSalary = teacherSalary.fixedSalaryAmount ?? 0;
      compensationData.levelIncentive = 0;
    } else if (breakdown) {
      compensationData.basicSalary = breakdown.basic ?? 0;
      compensationData.levelIncentive = breakdown.levelIncentive ?? 0;
    }

    const out: { typeId: string; typeName: string; amount: number; icon?: string; isGuaranteed?: boolean; parentId?: string | null }[] = [];
    for (const a of breakdown?.allowances ?? []) {
      if (a.amount > 0) {
        out.push({
          typeId: a.typeId, typeName: a.typeName, amount: a.amount,
          icon: a.icon, isGuaranteed: a.isGuaranteed, parentId: a.parentId,
        });
      }
    }
    const hasName = (n: string) => out.some(o => o.typeName.toLowerCase().includes(n));
    const kpi = teacherSalary.kpiAllowance ?? 0;
    if (kpi > 0 && !hasName('kpi')) out.push({ typeId: '__legacy_kpi__', typeName: 'KPI Allowance', amount: kpi });
    const att = teacherSalary.attendanceAllowance ?? 0;
    if (att > 0 && !hasName('attendance')) out.push({ typeId: '__legacy_attendance__', typeName: 'Attendance Allowance', amount: att });

    compensationData.allowances = out;
    compensationData.positionName = teacherSalary.position?.name ?? '';
    compensationData.positionId = teacherSalary.position?.positionId ?? null;
    compensationData.positionMaxLevel = teacherSalary.position?.maxLevel ?? 0;
    compensationData.level = teacherSalary.level ?? 0;
    compensationData.isFixedSalary = teacherSalary.isFixedSalary === true;
  }

  if (compensationData.positionId) {
    const map: Record<number, number> = {};
    for (const li of levelIncentives) {
      if (li.positionId === compensationData.positionId) map[li.level] = li.amount;
    }
    compensationData.incentiveByLevel = map;
  } else {
    compensationData.incentiveByLevel = {};
  }

  compensationData.parentTypes = (allowanceTypes ?? [])
    .filter(t => !t.parentId)
    .map(t => ({ id: t.id, name: t.name, icon: t.icon, isGuaranteed: t.isGuaranteed }));

  if (teacher?.createdAt) {
    const start = new Date(teacher.createdAt).getTime();
    const ms = Date.now() - start;
    compensationData.yearsOfService = Math.max(0, ms / (1000 * 60 * 60 * 24 * 365.25));
  }

  const liveAverage = appraisalData?.summary?.average;
  if (typeof liveAverage === 'number') {
    compensationData.appraisalScore = Math.round(liveAverage);
  }
  // Dev preview override: ?score=N takes precedence over the live
  // average so we can demo any tier without recording appraisals.
  const scoreOverride = searchParams.get('score');
  if (scoreOverride !== null) {
    const n = parseInt(scoreOverride, 10);
    if (!isNaN(n) && n >= 0 && n <= 100) {
      compensationData.appraisalScore = n;
    }
  }

  if (careerData) {
    const cur = careerData.currentPosition;
    const next = careerData.nextPosition;
    const r = careerData.readiness;
    compensationData.nextPositionName = next?.name ?? null;
    compensationData.nextBasicSalary = next?.basicSalary ?? 0;
    // Compare teacher's current TOTAL (basic + level incentive) to next
    // position's basic — level incentive doesn't carry over on promotion.
    const currentTotalBasic = (cur?.basicSalary ?? 0) + compensationData.levelIncentive;
    compensationData.basicSalaryUplift = next
      ? Math.max(0, (next.basicSalary ?? 0) - currentTotalBasic)
      : 0;
    compensationData.promotionMissionsMet = r.missions.met;
    compensationData.promotionMissionsCompleted = r.missions.completed;
    compensationData.promotionMissionsTotal = r.missions.total;
    compensationData.promotionAppraisalMet = r.appraisal.met;
    compensationData.promotionAppraisalRequired = r.appraisal.required;
    compensationData.promotionAppraisalValue = r.appraisal.value;
    compensationData.promotionSupervisorApproved = r.supervisorApproval.approved;
    compensationData.promotionAllReady = r.overallReady;
    compensationData.promotionLadder = (careerData.ladder ?? []).map(p => ({
      positionId: p.positionId,
      name: p.name,
      basicSalary: p.basicSalary ?? 0,
      isCurrent: cur?.positionId === p.positionId,
      isNext: next?.positionId === p.positionId,
    }));
  }

  const eligibility = eligibilityFromAppraisal(compensationData.appraisalScore);

  return { teacher, teacherSalary, eligibility };
}

export default function TeacherCompensationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isMobile } = useIsMobile();

  const { teacher, teacherSalary, eligibility } = useCompensationData(id);

  return (
    <div style={{ ...s.page, ...(isMobile ? { padding: '16px 12px' } : null) }}>
      <style>{`
        .tcomp-back-btn:hover { background: #f1f5f9 !important; color: ${C.text} !important; border-color: #cbd5e1 !important; }
        .tcomp-card { transition: box-shadow 160ms ease, border-color 160ms ease, transform 160ms ease; }
        .tcomp-card:hover { border-color: #d8dde7; box-shadow: 0 1px 2px rgba(15,23,42,0.04), 0 6px 18px rgba(15,23,42,0.05); }
      `}</style>

      <div style={s.inner}>
        <div style={s.breadcrumb}>
          <button onClick={() => navigate('/teachers')} className="tcomp-back-btn" style={s.backBtn} title="Back">
            <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 11 }} />
          </button>
          <Link to="/teachers" style={s.crumbLink}>Teachers</Link>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
          <Link to={`/teachers/${id}`} style={s.crumbLink}>{teacher?.name ?? '...'}</Link>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
          <span style={s.crumbCurrent}>Compensation</span>
        </div>

        <Hero
          teacher={teacher}
          teacherId={id!}
          eligibility={eligibility}
          badgeUrl={teacherSalary?.position?.badgeUrl ?? null}
        />

        {/* "What You Earn" umbrella — wraps Monthly Pay and Shared
            Rewards under one motivational header so the teacher reads
            them as one income story (fixed pay + shared upside)
            instead of two separate sections. The bordered white card
            visually unifies the two sub-blocks against the page's
            off-white background. */}
        <section style={{ ...s.section, ...(isMobile ? { marginBottom: 32 } : null) }}>
          <div style={{
            background: C.card,
            border: `1px solid ${C.cardBorder}`,
            borderRadius: 16,
            padding: isMobile ? '18px 14px 20px' : '24px 24px 28px',
            boxShadow: '0 1px 3px rgba(15,23,42,0.05), 0 12px 32px rgba(15,23,42,0.06)',
          }}>
            <SectionHeader
              eyebrow="What You Earn"
              title="Your Total Rewards Overview"
              sub="Your monthly pay, allowances, and shared rewards in one clear view."
            />
            <MonthlySalaryBreakdown compact />
            <div style={{ marginTop: isMobile ? 24 : 32 }}>
              <CompanyGoalRewards eligibility={eligibility} compact />
            </div>
          </div>
        </section>

        <MoneyQuests eligibility={eligibility} />
        <MoneyBenefits eligibility={eligibility} />
        <HighPerformerBenefits unlocked={eligibility === 'high_performer'} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero — answers the five UX questions in 5 seconds.
// ─────────────────────────────────────────────────────────────────────────────

function Hero({ teacher, teacherId, eligibility, badgeUrl }: { teacher: any; teacherId: string; eligibility: ReturnType<typeof eligibilityFromAppraisal>; badgeUrl: string | null }) {
  const { isMobile } = useIsMobile();
  // Eligibility label communicates BENEFIT level, not status/rank —
  // this is a compensation page, not the Career Path. Below threshold
  // = "Not Eligible," middle = "Standard Benefits," top = "High-
  // Performer Perks." Color hierarchy: green = available/eligible,
  // gold = high-performer reward, red = locked.
  const eligibilityLabel =
    eligibility === 'high_performer' ? 'High-Performer Perks'
    : eligibility === 'eligible' ? 'Standard Benefits'
    : 'Not Eligible';
  const eligStatusVisuals =
    eligibility === 'high_performer'
      ? { color: C.gold,     bg: C.goldSoft,    border: C.goldBorder,      icon: faTrophy }
      : eligibility === 'eligible'
      ? { color: C.success,  bg: C.successSoft, border: C.successBorder,   icon: faCircleCheck }
      : { color: C.danger,   bg: C.dangerSoft,  border: C.dangerBorder,    icon: faLock };
  const badgeSize = isMobile ? 56 : 88;

  // Eligibility pill — extracted so we can render it in two distinct
  // slots: top-right header bar on mobile (paired with the eyebrow),
  // or the right side of the identity row on desktop.
  const eligibilityPill = (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: isMobile ? 6 : 8,
      padding: isMobile ? '4px 10px' : '6px 14px', borderRadius: 999, flexShrink: 0,
      background: eligStatusVisuals.bg,
      border: `1px solid ${eligStatusVisuals.border}`,
      color: eligStatusVisuals.color,
      fontSize: isMobile ? 10 : 12, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      <FontAwesomeIcon icon={eligStatusVisuals.icon} style={{ fontSize: isMobile ? 10 : 11 }} />
      {eligibilityLabel}
    </div>
  );

  return (
    <div className="tcomp-card" style={{
      ...s.heroCard,
      ...(isMobile ? { padding: '18px 16px 20px', borderRadius: 16, marginBottom: 18 } : null),
    }}>
      {/* Mobile-only header bar — eyebrow on the left, eligibility pill
          on the right. Pulls the status pill out of its orphan row
          below the identity block and pairs it with the page label so
          the top of the card carries identity + status at a glance. */}
      {isMobile && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, marginBottom: 14,
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0,
            fontSize: 10, fontWeight: 700, color: C.muted,
            textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>
            {teacher?.color && (
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: teacher.color, flexShrink: 0 }} />
            )}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Compensation & Benefits
            </span>
          </div>
          {eligibilityPill}
        </div>
      )}

      {/* Identity row — badge + title + meta pills on the left;
          eligibility pill on the right on desktop only (mobile moves
          it into the header bar above). */}
      <div style={{
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: isMobile ? 10 : 16, marginBottom: isMobile ? 16 : 22,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 18, minWidth: 0 }}>
          {/* Career badge — links pay to identity. Falls back to a gold
              wallet tile when the teacher's position has no badge image
              configured yet. The badge is rendered without a background
              tile so it reads as the prestige object it is on the
              Career Path page (matching that page's drop-shadow
              treatment), just sized down to fit this hero's compact
              header. */}
          {badgeUrl ? (
            <img
              src={uploadUrl(badgeUrl)}
              alt={compensationData.positionName || 'Position badge'}
              style={{
                width: badgeSize, height: badgeSize, objectFit: 'contain', flexShrink: 0,
                filter: 'drop-shadow(0 6px 14px rgba(15,23,42,0.18))',
              }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div style={{
              width: badgeSize, height: badgeSize, borderRadius: isMobile ? 14 : 18, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `linear-gradient(135deg, ${C.gold}1a 0%, ${C.gold}0a 100%)`,
              border: `1px solid ${C.goldBorder}`,
              color: C.gold, fontSize: isMobile ? 24 : 36,
              boxShadow: `0 6px 14px ${C.gold}1a`,
            }}>
              <FontAwesomeIcon icon={faSackDollar} />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            {!isMobile && (
              <div style={{
                fontSize: 11, fontWeight: 700, color: C.muted,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {teacher?.color && (
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: teacher.color }} />
                )}
                Compensation & Benefits
              </div>
            )}
            <h1 style={{
              margin: isMobile ? 0 : '4px 0 0', fontSize: isMobile ? 20 : 28, fontWeight: 800, color: C.text,
              letterSpacing: '-0.025em', lineHeight: 1.15,
            }}>
              {teacher?.name ? `${teacher.name}'s Rewards Wallet` : 'Your Rewards Wallet'}
            </h1>
            {/* Service period chip — long-term context relevant to
                loyalty incentive eligibility. Sits with identity info,
                not as a separate stat. Points chip sits beside it as a
                discoverable link to the full Rewards page. Mobile uses
                tighter padding + a lower-cased "1y 1m" service format
                so both pills fit on one line in the narrow column. */}
            <div style={{
              marginTop: isMobile ? 8 : 10,
              display: 'flex', alignItems: 'center', flexWrap: 'wrap',
              gap: isMobile ? 5 : 6,
            }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: isMobile ? 4 : 6,
                padding: isMobile ? '2px 8px' : '3px 10px', borderRadius: 999,
                background: C.primarySoft, color: C.primary,
                border: `1px solid ${C.primaryBorder}`,
                fontSize: isMobile ? 10 : 11, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: isMobile ? '0.04em' : '0.06em',
              }}>
                <FontAwesomeIcon icon={faAward} style={{ fontSize: 9 }} />
                {isMobile
                  ? formatService(compensationData.yearsOfService)
                  : `Tenure · ${formatService(compensationData.yearsOfService)}`}
              </span>
              <Link
                to={`/teachers/${teacherId}/rewards`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: isMobile ? 4 : 6,
                  padding: isMobile ? '2px 8px' : '3px 10px', borderRadius: 999,
                  background: POINTS_C.soft, color: POINTS_C.accent,
                  border: `1px solid ${POINTS_C.border}`,
                  fontSize: isMobile ? 10 : 11, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: isMobile ? '0.04em' : '0.06em',
                  textDecoration: 'none',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <FontAwesomeIcon icon={faSackDollar} style={{ fontSize: 9 }} />
                {pointsBalance.current.toLocaleString('en-MY')} pts
                <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 8 }} />
              </Link>
            </div>
          </div>
        </div>

        {/* Eligibility status pill — desktop only. Mobile shows the
            same pill up in the header bar at the top of the card so
            it doesn't orphan onto its own row underneath the badge. */}
        {!isMobile && eligibilityPill}
      </div>

      {/* Hero body — money on the left (analogous to Career Path's
          "required missions" progress block), appraisal score on the
          right (analogous to its "promotion checklist" block). On
          mobile, stacks vertically so the score panel sits below the
          monthly compensation block instead of beside it. */}
      <div style={{
        ...s.heroBody,
        ...(isMobile ? { gridTemplateColumns: '1fr', gap: 18 } : null),
      }}>
        {/* Left: monthly compensation — the focal number on the page.
            Label says "Monthly Compensation" because this is the
            teacher's fixed monthly compensation structure, not a
            specific month's forecast. The amount carries the gold
            "RM" prefix as a money cue. */}
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: C.muted,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            marginBottom: 10,
          }}>
            Monthly Compensation
          </div>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 8,
            fontVariantNumeric: 'tabular-nums',
          }}>
            <span style={{
              fontSize: isMobile ? 14 : 18, fontWeight: 700, color: C.gold,
              letterSpacing: '-0.005em',
            }}>
              RM
            </span>
            <span style={{
              fontSize: isMobile ? 36 : 48, fontWeight: 800, color: C.text,
              letterSpacing: '-0.035em', lineHeight: 1,
            }}>
              {computeMonthlyTotal().toLocaleString('en-MY')}
            </span>
          </div>
          {/* Reward streams summary — names only, joined with `+`. Built
              dynamically from compensationData so a teacher with no
              KPI sees just "Basic + Level" etc. */}
          <div style={{
            marginTop: 10, fontSize: 12, fontWeight: 500,
            color: C.muted, lineHeight: 1.5,
          }}>
            {rewardStreamSummary()}
          </div>
        </div>

        {/* Right: appraisal score panel — score circle sits inline
            with the tier bar in a single row, tier text below. On
            mobile the divider flips from a left border to a top
            border so the panel sits cleanly below the monthly figure. */}
        <div style={{
          ...s.heroChecklistCol,
          ...(isMobile ? {
            paddingLeft: 0,
            paddingTop: 18,
            borderLeft: 'none',
            borderTop: `1px solid ${C.divider}`,
          } : null),
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: C.muted,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            marginBottom: 12,
          }}>
            Appraisal Score
          </div>
          {/* Helper text sits directly under the eyebrow so the
              actionable cue ("Reach 80...") reads immediately, before
              the score visualization. */}
          <div style={{
            marginBottom: 12, fontSize: 12, fontWeight: 500,
            color: C.muted, lineHeight: 1.5,
          }}>
            {eligibility === 'high_performer' && `Sustained ${benefitRules.highPerformerAppraisalThreshold}+ keeps Top Tier Benefits active.`}
            {eligibility === 'eligible' && `Reach ${benefitRules.highPerformerAppraisalThreshold} to unlock Top Tier Benefits.`}
            {eligibility === 'not_eligible' && `Reach ${benefitRules.minimumAppraisalForEligibility} to unlock Standard Benefits.`}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `${eligStatusVisuals.color}14`,
              border: `2px solid ${eligStatusVisuals.color}40`,
              color: eligStatusVisuals.color,
              fontSize: 20, fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              flexShrink: 0,
            }}>
              {compensationData.appraisalScore}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <ZoneGate score={compensationData.appraisalScore} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Monthly Salary Breakdown — Basic + KPI + Attendance = Total
// ─────────────────────────────────────────────────────────────────────────────

export function MonthlySalaryBreakdown({ compact = false }: { compact?: boolean }) {
  // Cards mirror the EditTeacherPage allowances 1:1. Basic always
  // shows; level incentive shows if the position has one; every
  // remaining allowance with amount > 0 gets its own card. Parent
  // cards (e.g. Other Allowance with sub-types) carry a structured
  // breakdownItems list so the children render as a small list inside
  // the card rather than getting crammed into the sub-line.
  const lines: { icon: any; label: string; amount: number; status: RewardStatus; accent: string; sub?: string; breakdownItems?: { name: string; amount: number }[] }[] = [];

  lines.push({
    icon: faShieldHalved,
    label: 'Basic Salary',
    amount: compensationData.basicSalary,
    status: 'guaranteed',
    accent: C.success,
    sub: compensationData.positionName ? `Position basic · ${compensationData.positionName}` : 'Position basic',
  });

  // Level Allowance — always renders alongside other main categories
  // for layout consistency. Muted when there's no level-matrix entry
  // for this teacher's position+level.
  {
    const levelAmount = compensationData.levelIncentive;
    const isZero = levelAmount <= 0;
    lines.push({
      icon: faAward,
      label: 'Level Allowance',
      amount: levelAmount,
      status: 'guaranteed',
      accent: C.success,
      sub: compensationData.level
        ? `Level ${compensationData.level}`
        : (isZero ? 'No level set' : undefined),
      muted: isZero,
    });
  }

  // Always render every system-managed top-level allowance type so the
  // page structure stays consistent across teachers — categories with
  // RM 0 (the teacher hasn't been assigned that allowance) render as
  // muted "not set" cards. Iterates parentTypes (driven by the
  // /api/allowance-types query) to cover types the teacher has zero
  // amount for; allowances list provides per-teacher amounts.
  const children = compensationData.allowances.filter(a => !!a.parentId);
  const renderedParentIds = new Set<string>();

  // Map children to the breakdownItems shape RewardChip expects.
  const toBreakdownItems = (kids: typeof children) =>
    kids.map(c => ({ name: c.typeName, amount: c.amount }));

  for (const parentType of compensationData.parentTypes) {
    // Skip Level Allowance — already rendered as its own card above
    // using the level-matrix value.
    if (parentType.name.trim().toLowerCase() === 'level allowance') continue;

    const direct = compensationData.allowances.find(
      a => !a.parentId && a.typeId === parentType.id
    );
    const myChildren = children.filter(c => c.parentId === parentType.id);
    const childrenSum = myChildren.reduce((s, c) => s + c.amount, 0);
    const total = (direct?.amount ?? 0) + childrenSum;
    renderedParentIds.add(parentType.id);
    const guaranteed = parentType.isGuaranteed !== false;
    const isZero = total <= 0;
    lines.push({
      icon: iconForAllowance(parentType.name, parentType.icon),
      label: parentType.name,
      amount: total,
      status: guaranteed ? 'guaranteed' : 'confirmed-when-met',
      accent: guaranteed ? C.success : C.primary,
      breakdownItems: myChildren.length > 0 ? toBreakdownItems(myChildren) : undefined,
      muted: isZero,
    });
  }

  // Catch any teacher allowances at the top level that aren't system-
  // seeded categories (legacy custom allowances created before the
  // hierarchy refactor). They still get their own card.
  const topLevelOrphans = compensationData.allowances.filter(
    a => !a.parentId && !renderedParentIds.has(a.typeId)
  );
  for (const a of topLevelOrphans) {
    if (a.amount <= 0) continue;
    const guaranteed = a.isGuaranteed !== false;
    lines.push({
      icon: iconForAllowance(a.typeName, a.icon),
      label: a.typeName,
      amount: a.amount,
      status: guaranteed ? 'guaranteed' : 'confirmed-when-met',
      accent: guaranteed ? C.success : C.primary,
    });
  }

  // Compact mode is used when this section is rendered inside the
  // "What You Earn" umbrella. The page-hero already shows the monthly
  // total as the headline figure, so we don't re-hero it here — the
  // sub-header just carries the small inline total as a sanity-check
  // sum. Chips are then split by character (guaranteed vs confirmed-
  // when-met) so the structure of the pay packet is visible at a
  // glance.
  const monthlyTotal = lines.reduce((acc, l) => acc + l.amount, 0);
  const guaranteedLines = lines.filter(l => l.status === 'guaranteed');
  const confirmedLines = lines.filter(l => l.status === 'confirmed-when-met');
  const hasBothGroups = guaranteedLines.length > 0 && confirmedLines.length > 0;

  // Single-row chip layout: guaranteed chips first, then a thin
  // divider line, then confirmed-when-met chips. Flex-wrap is used
  // (not grid) so the divider can be placed inline as its own item.
  // Each chip flexes between a 220px floor and the available track,
  // matching the previous auto-fit grid behaviour. align-items:
  // stretch keeps all chips the same height in a row.
  const chipFlex: React.CSSProperties = { flex: '1 1 220px', minWidth: 0 };

  return (
    <section style={compact ? undefined : s.section}>
      {compact ? (
        <SubSectionHeader
          title="Monthly Pay"
          right={
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 6,
              fontVariantNumeric: 'tabular-nums',
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: '0.02em' }}>
                Total
              </span>
              <span style={{ fontSize: 16, fontWeight: 800, color: C.text, letterSpacing: '-0.01em' }}>
                {rm(monthlyTotal)}
              </span>
            </div>
          }
        />
      ) : (
        <SectionHeader eyebrow="Monthly Pay" title="Your reward streams" />
      )}

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: SP.md, alignItems: 'stretch',
      }}>
        {guaranteedLines.map(l => (
          <RewardChip key={l.label} item={l} style={chipFlex} />
        ))}
        {hasBothGroups && (
          <div style={{
            alignSelf: 'stretch', width: 1, background: C.divider, flexShrink: 0,
          }} />
        )}
        {confirmedLines.map(l => (
          <RewardChip key={l.label} item={l} style={chipFlex} />
        ))}
      </div>
    </section>
  );
}

function RewardChip({ item, style }: { item: { icon: any; label: string; amount: number; status: RewardStatus; accent: string; sub?: string; muted?: boolean; breakdownItems?: { name: string; amount: number }[] }; style?: React.CSSProperties }) {
  // Breakdown rendering rules:
  //  • ≤ 2 items: show all inline, no toggle
  //  • > 2 items: show the largest 2 always; rest hidden behind a
  //    "+ N more" toggle. Sorting by amount desc surfaces the most
  //    consequential rows up front.
  const [expanded, setExpanded] = useState(false);
  const hasBreakdown = !!item.breakdownItems && item.breakdownItems.length > 0;
  const sortedItems = hasBreakdown
    ? [...item.breakdownItems!].sort((a, b) =>
        b.amount - a.amount || a.name.localeCompare(b.name))
    : [];
  const TOP_N = 2;
  const visibleItems = expanded ? sortedItems : sortedItems.slice(0, TOP_N);
  const hiddenCount = Math.max(0, sortedItems.length - TOP_N);
  const hasMore = hiddenCount > 0;
  return (
    <div className="tcomp-card" style={{
      ...s.card, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 8,
      opacity: item.muted ? 0.85 : 1,
      background: item.muted ? '#fafbfc' : C.card,
      ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${item.accent}14`, color: item.accent, fontSize: 12,
          flexShrink: 0,
        }}>
          <FontAwesomeIcon icon={item.icon} />
        </div>
        <div style={{
          flex: 1, minWidth: 0,
          fontSize: 11, fontWeight: 700, color: C.muted,
          textTransform: 'uppercase', letterSpacing: '0.06em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.label}
        </div>
      </div>
      <div style={{
        fontSize: 22, fontWeight: 800, color: C.text,
        letterSpacing: '-0.025em', lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {rm(item.amount)}
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'flex-start', gap: 4,
      }}>
        <StatusBadge status={item.status} size="sm" />
        {item.sub && !hasBreakdown && (
          <span style={{
            fontSize: 11, fontWeight: 500, color: C.muted, lineHeight: 1.4,
          }}>
            {item.sub}
          </span>
        )}
      </div>
      {hasBreakdown && (
        <div style={{
          marginTop: 4,
          paddingTop: 10,
          borderTop: `1px solid ${C.divider}`,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {visibleItems.map(child => (
            <div key={child.name} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              gap: 8,
            }}>
              <span style={{
                fontSize: 11, fontWeight: 500, color: C.muted,
                lineHeight: 1.4, minWidth: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {child.name}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, color: C.textSub,
                fontVariantNumeric: 'tabular-nums',
                flexShrink: 0,
              }}>
                {rm(child.amount)}
              </span>
            </div>
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded(e => !e)}
              style={{
                marginTop: 2,
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: 0,
                alignSelf: 'flex-start',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 600, color: C.primary,
                fontFamily: 'inherit',
              }}
              aria-expanded={expanded}
              aria-label={expanded ? 'Show fewer items' : `Show ${hiddenCount} more items`}
            >
              {expanded ? 'Show less' : `+ ${hiddenCount} more`}
              <FontAwesomeIcon
                icon={expanded ? faChevronUp : faChevronDown}
                style={{ fontSize: 9 }}
              />
            </button>
          )}
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// ZoneGate — appraisal-score 3-zone bar, used inline in the Hero.
// ─────────────────────────────────────────────────────────────────────────────

function ZoneGate({ score }: { score: number }) {
  // Three-zone benefit-eligibility scale. Color hierarchy:
  // - Red zone (0 → min): Not Eligible
  // - Green zone (min → high): Standard Benefits available
  // - Gold zone (high → 100): High-Performer Perks unlocked
  const min = benefitRules.minimumAppraisalForEligibility;
  const high = benefitRules.highPerformerAppraisalThreshold;
  const pct = Math.min(100, Math.max(0, score));
  const zoneColor = score < min ? C.danger : score >= high ? C.gold : C.success;

  return (
    <div>
      <div style={{
        position: 'relative',
        height: 12, borderRadius: 999,
        background: `linear-gradient(90deg, ${C.danger}26 0%, ${C.danger}26 ${min}%, ${C.success}33 ${min}%, ${C.success}33 ${high}%, ${C.gold}33 ${high}%, ${C.gold}33 100%)`,
        overflow: 'visible',
      }}>
        {/* Zone dividers */}
        <div style={{
          position: 'absolute', top: -2, left: `${min}%`,
          width: 2, height: 16, background: '#fff',
        }} />
        <div style={{
          position: 'absolute', top: -2, left: `${high}%`,
          width: 2, height: 16, background: '#fff',
        }} />
        {/* Score marker */}
        <div style={{
          position: 'absolute', top: -8, left: `${pct}%`,
          width: 28, height: 28, borderRadius: '50%',
          transform: 'translateX(-50%)',
          background: '#fff',
          border: `3px solid ${zoneColor}`,
          boxShadow: '0 1px 3px rgba(15,23,42,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 800, color: C.text,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {score}
        </div>
      </div>

      {/* Threshold + category stacked at each zone-start position. To
          avoid the score-marker bubble visually overlapping with the
          threshold number it's sitting on, we hide the matching
          threshold label whenever the score equals it. */}
      <div style={{
        position: 'relative', marginTop: 14, height: 30,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {/* 0 — start of the locked zone */}
        {score !== 0 && (
          <ThresholdLabel
            left={0}
            align="start"
            number="0"
            numberColor={C.mutedSoft}
            label="Not Eligible"
            labelColor={C.danger}
          />
        )}
        {/* min — start of the standard zone */}
        {score !== min && (
          <ThresholdLabel
            left={min}
            align="center"
            number={String(min)}
            numberColor={C.danger}
            label="Standard"
            labelColor={C.success}
          />
        )}
        {/* high — start of the top-tier zone. Short label keeps it
            within the 20-pixel-ish gold zone without overlapping the
            "Standard" label or the "100" end label. */}
        {score !== high && (
          <ThresholdLabel
            left={high}
            align="center"
            number={String(high)}
            numberColor={C.gold}
            label="Top Tier"
            labelColor={C.gold}
          />
        )}
        {/* 100 — end of scale */}
        {score !== 100 && (
          <ThresholdLabel
            left={100}
            align="end"
            number="100"
            numberColor={C.mutedSoft}
          />
        )}
      </div>
    </div>
  );
}

function ThresholdLabel({
  left, align, number, numberColor, label, labelColor,
}: {
  left: number;
  align: 'start' | 'center' | 'end';
  number: string;
  numberColor: string;
  label?: string;
  labelColor?: string;
}) {
  // Two-line stack at each threshold position: numeric value on top,
  // optional category label below. Edge labels (0 / 100) anchor flush
  // with the bar's edges via `left: 0` / `right: 0` and no transform;
  // middle labels use `transform: translateX(-50%)` to center over the
  // threshold line.
  return (
    <div style={{
      position: 'absolute',
      left: align === 'end' ? undefined : (align === 'start' ? 0 : `${left}%`),
      right: align === 'end' ? 0 : undefined,
      transform: align === 'center' ? 'translateX(-50%)' : undefined,
      display: 'flex', flexDirection: 'column', alignItems: align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center',
      gap: 2,
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, color: numberColor,
        letterSpacing: '0.08em',
      }}>{number}</span>
      {label && (
        <span style={{
          fontSize: 9, fontWeight: 700, color: labelColor,
          textTransform: 'uppercase', letterSpacing: '0.06em',
          whiteSpace: 'nowrap',
        }}>{label}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// This Month's Money Quests
// ─────────────────────────────────────────────────────────────────────────────

// Expandable "Salary path" disclosure rendered inside the Get Promoted
// card. Lets the teacher see every ladder stage's base salary without
// leaving the page. Current and next positions are highlighted so the
// teacher can locate themselves in the path at a glance.
function SalaryLadder({ ladder }: {
  ladder: { positionId: string; name: string; basicSalary: number; isCurrent: boolean; isNext: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  if (ladder.length === 0) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 8,
          background: open ? C.primarySoft : 'transparent',
          border: `1px solid ${open ? C.primaryBorder : C.cardBorder}`,
          color: C.primary, fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        <FontAwesomeIcon icon={faChartLine} style={{ fontSize: 11 }} />
        {open ? 'Hide salary path' : 'View salary path'}
        <FontAwesomeIcon icon={open ? faChevronUp : faChevronDown} style={{ fontSize: 9 }} />
      </button>
      {open && (
        <div style={{
          marginTop: 10,
          border: `1px solid ${C.cardBorder}`, borderRadius: 10,
          background: '#fff', overflow: 'hidden',
        }}>
          {ladder.map((p, i) => {
            const isLast = i === ladder.length - 1;
            const accent = p.isCurrent ? C.primary : p.isNext ? C.success : null;
            return (
              <div
                key={p.positionId}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px',
                  borderBottom: isLast ? 'none' : `1px solid ${C.divider}`,
                  background: p.isCurrent ? C.primarySoft : p.isNext ? C.successSoft : '#fff',
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: 999,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: accent ?? C.slateSoft,
                  color: accent ? '#fff' : C.muted,
                  fontSize: 10, fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: C.text,
                    letterSpacing: '-0.005em',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {p.name}
                  </div>
                  {(p.isCurrent || p.isNext) && (
                    <div style={{
                      marginTop: 2, fontSize: 10, fontWeight: 700,
                      color: accent ?? C.muted,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>
                      {p.isCurrent ? 'You are here' : 'Next stage'}
                    </div>
                  )}
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: C.text,
                  fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                }}>
                  {rm(p.basicSalary)}
                  <span style={{ color: C.mutedSoft, fontWeight: 500, fontSize: 11 }}> / mo</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MoneyQuests({ eligibility: _eligibility }: { eligibility: ReturnType<typeof eligibilityFromAppraisal> }) {
  const { isMobile } = useIsMobile();
  // Anchor id is referenced by the Hero's "Grow your earnings" quick
  // link so teachers can jump straight to this section from the top.
  // Each card represents one earning stream. Mix of "actions" the
  // teacher actively does (training, enrolments) and "outcomes" the
  // teacher works toward via missions + appraisal (promotion, level
  // up). The section title intentionally says "Ways your earnings
  // can grow" so both flavours fit.
  const nextPos = compensationData.nextPositionName;
  const promotionStatus: RewardStatus = compensationData.promotionAllReady
    ? 'achieved'
    : 'in-progress';
  const promotionAmount = compensationData.basicSalaryUplift > 0
    ? `+${rm(compensationData.basicSalaryUplift)} / month · ongoing`
    : 'Salary bump · ongoing';
  const appraisalValueStr = compensationData.promotionAppraisalValue != null
    ? `${compensationData.promotionAppraisalValue}%`
    : 'Not evaluated';
  const showLevel = compensationData.positionName && !compensationData.isFixedSalary;

  return (
    <section id="earn-more" style={{ ...s.section, scrollMarginTop: 80 }}>
      <SectionHeader
        eyebrow="Earn More"
        title="Ways your earnings can grow"
      />

      {/* Single grid for all earning streams — sub-grouping created
          a lonely card in the "one-time" row. The status badges and
          amount labels (per-day, per-semester, ongoing) already convey
          each card's cadence without needing section dividers. */}
      <div style={{
        ...s.benefitGrid,
        ...(isMobile ? { gridTemplateColumns: 'minmax(0, 1fr)' } : null),
      }}>
        {nextPos && (
          <BenefitCard
            icon={faChartLine}
            title={`Get promoted${nextPos ? ` to ${nextPos}` : ''}`}
            amount={promotionAmount}
            status={promotionStatus}
            description="Step up to the next career stage to permanently lift your base salary. Earned by clearing the required missions, sustaining a strong appraisal, and supervisor approval."
            requirements={[
              {
                label: `Required missions (${compensationData.promotionMissionsCompleted}/${compensationData.promotionMissionsTotal})`,
                met: compensationData.promotionMissionsMet,
              },
              {
                label: `Average appraisal ≥ ${compensationData.promotionAppraisalRequired}% · currently ${appraisalValueStr}`,
                met: compensationData.promotionAppraisalMet,
              },
              {
                label: 'Supervisor approval',
                met: compensationData.promotionSupervisorApproved,
              },
            ]}
            extra={<SalaryLadder ladder={compensationData.promotionLadder} />}
            policyNote="Promotion is recorded by admin once all gates are met."
          />
        )}
        {showLevel && (() => {
          // Level promotion = moving up the level ladder WITHIN the same
          // position. RM amounts come from the per-position incentive
          // table. Max level is derived from BOTH the position record's
          // `maxLevel` field AND the highest level actually configured
          // in the incentive table — that way mis-configured positions
          // (maxLevel = 0 but incentives exist) still produce sensible
          // numbers instead of "No change" on every row.
          const incLevels = Object.keys(compensationData.incentiveByLevel)
            .map(Number).filter(n => Number.isFinite(n));
          // No incentive table configured for this position → the level
          // ladder simply doesn't apply, so hide the card.
          if (incLevels.length === 0) return null;
          const inferredMax = Math.max(...incLevels, 0);
          const maxLv = Math.max(compensationData.positionMaxLevel, inferredMax);
          const curLv = Math.max(0, compensationData.level ?? 0);
          const inc = (lv: number) => compensationData.incentiveByLevel[lv] ?? 0;
          const curInc = inc(curLv);
          const up1Delta = inc(Math.min(maxLv, curLv + 1)) - curInc;
          const up2Delta = inc(Math.min(maxLv, curLv + 2)) - curInc;
          const maxUpside = Math.max(up1Delta, up2Delta);
          const levelAmount = maxUpside > 0
            ? `Up to +${rm(maxUpside)} / month at next review`
            : 'Max level reached';
          return (
            <BenefitCard
              icon={faChevronUp}
              title={`Level up within ${compensationData.positionName}`}
              amount={levelAmount}
              status="variable"
              description="Within your current position your level allowance can move at each review cycle based on your average appraisal score. Strong scores earn 1 or 2 levels up; the RM amount depends on your current level."
              requirements={[]}
              extra={<LevelPromotionTierStrip up1Delta={up1Delta} up2Delta={up2Delta} />}
              policyNote="Applied at the next review cycle."
            />
          );
        })()}
        <BenefitCard
          icon={faGraduationCap}
          title="Attend approved training"
          amount={`${rm(benefitRules.trainingAllowancePerDay)} / day`}
          bonus={`${rm(benefitRules.petrolAllowancePerTraining)} drive bonus / trip`}
          status="eligible"
          description="Earn an allowance for each approved training day. Teachers who drive and carpool with others earn an additional bonus per trip — paid above petrol cost."
          requirements={[
            { label: 'Attended approved training', met: false, optional: true },
            { label: 'Drives own vehicle (for drive bonus)', met: false, optional: true },
            { label: 'Carpools with other teachers (for drive bonus)', met: false, optional: true },
          ]}
          policyNote="Submit attendance and trip details to HR."
        />
        <BenefitCard
          icon={faUserPlus}
          title="Enrol new student with full payment"
          amount="15% – 30% of monthly fees"
          status="eligible"
          description="Earn commission for each successfully enrolled student who has made full payment."
          requirements={[
            { label: 'Successfully enrolled student', met: false, optional: true },
            { label: 'Full payment received', met: false, optional: true },
          ]}
          extra={<EnrollmentTierStrip />}
          policyNote="Tracked by HR. Higher rates apply for more enrolments per month."
        />
        <BenefitCard
          icon={faBookOpen}
          title="Complete all required training"
          amount={`${rm(benefitRules.trainingQualificationAllowance)} · per semester`}
          status="eligible"
          description="Allowance paid the following semester after fully completing this semester's required training."
          requirements={[
            { label: 'All required training completed in the semester', met: false },
          ]}
          policyNote="Paid out the following semester."
        />
        <BenefitCard
          icon={faAward}
          title="Earn a qualification"
          amount={`${rm(qualificationTiers[0].amount)} – ${rm(qualificationTiers[qualificationTiers.length - 1].amount)} / month · ongoing`}
          status="locked"
          description="Permanent monthly allowance for an early childhood education qualification — three credentials, three tiers."
          requirements={[]}
          extra={<QualificationTierStrip />}
          policyNote="Submit qualification documents to HR for verification."
        />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Company Goal Rewards — Quarterly Profit Sharing + Annual Bonus
// ─────────────────────────────────────────────────────────────────────────────

export function CompanyGoalRewards({ eligibility, compact = false }: { eligibility: ReturnType<typeof eligibilityFromAppraisal>; compact?: boolean }) {
  const { isMobile } = useIsMobile();
  // Both sides must hit goals — the school AND the teacher. Eligibility
  // here piggybacks on the appraisal threshold (≥60). When the teacher
  // hasn't met their part, the share is locked even if the school does
  // hit its goals.
  const teacherEligible = eligibility !== 'not_eligible';

  return (
    <section style={compact ? undefined : s.section}>
      {compact ? (
        <SubSectionHeader
          title="Shared Rewards"
          sub="Shared rewards are unlocked when school performance goals are achieved."
          right={
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '4px 8px', borderRadius: 999,
              color: teacherEligible ? C.success : C.muted,
              background: teacherEligible ? C.successSoft : C.slateSoft,
              border: `1px solid ${teacherEligible ? C.successBorder : C.cardBorder}`,
            }}>
              {teacherEligible ? 'Unlocked' : 'Variable upside'}
            </span>
          }
          spacing="loose"
        />
      ) : (
        <SectionHeader
          eyebrow="Shared Rewards"
          title="When the school hits its goals, you share"
        />
      )}

      {/* Eligibility status callout — softly tinted panel so the
          appraisal gate reads as a distinct status block rather than
          a third line of body text packed up against the description.
          Green tint when eligible, neutral slate when not. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px',
        background: teacherEligible ? C.successSoft : C.slateSoft,
        border: `1px solid ${teacherEligible ? C.successBorder : C.cardBorder}`,
        borderRadius: 10,
        marginBottom: 18,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: teacherEligible ? '#fff' : C.card,
          border: `1px solid ${teacherEligible ? C.successBorder : C.cardBorder}`,
          color: teacherEligible ? C.success : C.muted,
          fontSize: 11,
          flexShrink: 0,
        }}>
          <FontAwesomeIcon icon={teacherEligible ? faCheck : faLock} />
        </div>
        <div style={{
          fontSize: 13, fontWeight: 600, color: C.text,
          letterSpacing: '-0.005em', lineHeight: 1.4, minWidth: 0,
        }}>
          <span style={{ color: teacherEligible ? C.success : C.muted, fontWeight: 700 }}>
            {teacherEligible ? 'Eligible' : 'Not yet eligible'}
          </span>
          <span style={{ color: C.muted, fontWeight: 500 }}> based on appraisal score: </span>
          <span style={{ color: C.text, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {compensationData.appraisalScore} / {benefitRules.minimumAppraisalForEligibility}
          </span>
        </div>
      </div>

      <div style={{
        display: 'grid', gap: SP.md,
        gridTemplateColumns: isMobile
          ? 'minmax(0, 1fr)'
          : 'repeat(auto-fit, minmax(360px, 1fr))',
      }}>
        <CompanyGoalCard
          icon={faPiggyBank}
          title="Quarterly Profit Sharing"
          badgeLabel="Variable"
          description="Added to the pool only in months where school fee collection exceeds the revenue target and operating cost stays below 85%."
          conditions={[
            'School fees hit target',
            'Operating cost below 85%',
            'Appraisal score ≥ 60',
            'Attendance ≥ 97%',
          ]}
          accent={C.success}
        />
        <CompanyGoalCard
          icon={faTrophy}
          title="Annual Bonus"
          badgeLabel="Year-End"
          description="Built from eligible monthly pools and paid out at year-end. Distribution is based on average yearly appraisal score."
          conditions={[
            'Appraisal score ≥ 60',
            'Attendance ≥ 97%',
            'Higher appraisal score earns a larger share',
          ]}
          accent={C.success}
        />
      </div>
    </section>
  );
}

function CompanyGoalCard({
  icon, title, badgeLabel, description, conditions, accent,
}: {
  icon: any; title: string;
  badgeLabel: string;
  description: string;
  conditions: string[];
  accent: string;
}) {
  const badgePalette = { bg: C.slateSoft, fg: C.slate, border: '#e2e8f0' };

  return (
    <div className="tcomp-card" style={{
      ...s.card,
      background: `linear-gradient(135deg, ${accent}08, #fff)`,
      padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${accent}14`, color: accent, fontSize: 14, flexShrink: 0,
        }}>
          <FontAwesomeIcon icon={icon} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: '-0.005em',
          }}>
            {title}
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            marginTop: 4,
            padding: '2px 8px', borderRadius: 999,
            background: badgePalette.bg, color: badgePalette.fg,
            border: `1px solid ${badgePalette.border}`,
            fontSize: 9, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            {badgeLabel}
          </span>
        </div>

      </div>

      <p style={{
        margin: '0 0 12px', fontSize: 12, fontWeight: 500,
        color: C.textSub, lineHeight: 1.5,
      }}>
        {description}
      </p>

      <div style={{
        padding: 12,
        background: C.slateSoft, borderRadius: 10,
        border: `1px solid ${C.divider}`,
      }}>
        <div style={{
          fontSize: 9, fontWeight: 800, color: C.muted,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          marginBottom: 8,
        }}>
          Conditions
        </div>
        <ul style={{
          margin: 0, padding: 0, listStyle: 'none',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {conditions.map((c, i) => (
            <li key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 12, fontWeight: 500, color: C.text, lineHeight: 1.4,
            }}>
              <span style={{
                width: 16, height: 16, borderRadius: '50%',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: '#fff', color: C.mutedSoft,
                border: `1px solid #cbd5e1`,
                fontSize: 4,
                flexShrink: 0,
              }}>
                <FontAwesomeIcon icon={faCircle} />
              </span>
              {c}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Money-Related Benefits — 4 grouped sections.
// ─────────────────────────────────────────────────────────────────────────────

export function MoneyBenefits({ eligibility }: { eligibility: ReturnType<typeof eligibilityFromAppraisal> }) {
  const { isMobile } = useIsMobile();
  const isEligibleForBenefits = eligibility !== 'not_eligible';

  return (
    <section style={s.section}>
      {/* Pill divider — silver medal when the appraisal gate is
          cleared, slate lock when not. Always renders so the section's
          place in the tier ladder is visible regardless of standing.
          Mirrors the High-Performer pill below. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16,
      }}>
        <div style={{ flex: 1, height: 1, background: C.divider }} />
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 999,
          background: isEligibleForBenefits ? C.silverSoft : C.slateSoft,
          color: isEligibleForBenefits ? C.silver : C.muted,
          border: `1px solid ${isEligibleForBenefits ? C.silverBorder : '#e2e8f0'}`,
          fontSize: 10, fontWeight: 800,
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          <FontAwesomeIcon icon={isEligibleForBenefits ? faMedal : faLock} style={{ fontSize: 10 }} />
          Performer Tier · {isEligibleForBenefits ? 'Unlocked' : 'Locked'}
        </div>
        <div style={{ flex: 1, height: 1, background: C.divider }} />
      </div>

      <SectionHeader
        eyebrow="Standing Benefits"
        title="Benefits beyond the paycheck"
      />

      {/* Wrapper card mirrors the High-Performer section's structure —
          silver-tinted gradient when the appraisal gate is cleared,
          slate when locked. Inside: a "You qualify" panel + grid. */}
      <div style={{
        ...s.card,
        padding: SP.xl,
        background: isEligibleForBenefits
          ? `linear-gradient(135deg, ${C.silver}10, ${C.silver}04)`
          : C.slateSoft,
        border: `1px solid ${isEligibleForBenefits ? `${C.silver}40` : C.cardBorder}`,
        boxShadow: isEligibleForBenefits
          ? `0 1px 3px ${C.silver}1f, 0 6px 16px ${C.silver}14`
          : 'none',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isEligibleForBenefits ? '#fff' : C.slateSoft,
            color: isEligibleForBenefits ? C.silver : C.muted,
            border: `1px solid ${isEligibleForBenefits ? C.silverBorder : C.divider}`,
            fontSize: 18,
            flexShrink: 0,
          }}>
            <FontAwesomeIcon icon={isEligibleForBenefits ? faMedal : faLock} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 9, fontWeight: 800, color: isEligibleForBenefits ? C.silver : C.muted,
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>
              {isEligibleForBenefits ? 'You qualify' : 'Eligibility threshold'}
            </div>
            <div style={{
              marginTop: 2, fontSize: 16, fontWeight: 800, color: C.text,
              letterSpacing: '-0.012em',
            }}>
              {isEligibleForBenefits
                ? `Appraisal score ${compensationData.appraisalScore} · above ${benefitRules.minimumAppraisalForEligibility}`
                : `Score above ${benefitRules.minimumAppraisalForEligibility} required`}
            </div>
            <div style={{
              marginTop: 4, fontSize: 12, fontWeight: 500, color: C.muted, lineHeight: 1.4,
            }}>
              {isEligibleForBenefits
                ? 'Standard benefits below are available to claim.'
                : 'Reach the threshold to unlock standard benefits.'}
            </div>
          </div>
        </div>

        <div style={{
          ...s.benefitGrid,
          ...(isMobile ? { gridTemplateColumns: 'minmax(0, 1fr)' } : null),
        }}>
          {(() => {
            // Inner cards use a lighter silver tint than the wrapper so
            // they feel contained inside it rather than competing with
            // the outer border. Locked wrapper falls back to default.
            const innerBorder = isEligibleForBenefits ? `${C.silver}26` : undefined;
            // Icon tint matches the tier color (silver for Performer)
            // when eligible, so the icons read as "tier perks" rather
            // than re-stating the green eligible-status color.
            const innerIcon = isEligibleForBenefits ? C.silver : undefined;
            // Per-card status badges show ELIGIBLE / NOT ELIGIBLE so
            // teachers can see the state of each benefit at a glance —
            // useful when individual cards have additional gates beyond
            // the section-level appraisal threshold (e.g. tenure for
            // Loyalty / Team Building / Annual Dinner).
            return (
              <>
                <BenefitCard
                  icon={faBriefcaseMedical}
                  title="Medical Benefit Program"
                  amount={`${rm(benefitRules.medicalQuarterlyAllowance)} / quarter`}
                  status={isEligibleForBenefits ? 'eligible' : 'locked'}
                  description="Quarterly allowance for medical expenses. Submit a valid medical certificate to claim reimbursement."
                  requirements={[
                    { label: 'Active employment', met: true },
                    { label: 'Valid medical certificate', met: false, optional: true },
                  ]}
                  policyNote="Reimbursement subject to policy."
                  borderColor={innerBorder}
                  iconAccent={innerIcon}
                />
                <BenefitCard
                  icon={faAward}
                  title="Loyalty Incentive"
                  amount={`+${(benefitRules.loyaltyIncentiveRate * 100).toFixed(0)}% of basic salary / year · capped ${rm(benefitRules.loyaltyIncentiveCap)}`}
                  status={
                    !isEligibleForBenefits ? 'locked'
                    : compensationData.yearsOfService >= 1 ? 'eligible'
                    : 'in-progress'
                  }
                  description="Reward for staying with the school. Increases each year up to the cap."
                  requirements={[
                    { label: 'Completed at least 1 full year of service', met: compensationData.yearsOfService >= 1 },
                  ]}
                  policyNote={`Years of service: ${compensationData.yearsOfService} yr`}
                  borderColor={innerBorder}
                  iconAccent={innerIcon}
                />
                <BenefitCard
                  icon={faMugSaucer}
                  title="Snack & Tea"
                  amount="Monthly · all teachers"
                  status={isEligibleForBenefits ? 'eligible' : 'locked'}
                  description="A monthly allocation of snacks and tea, available in the staff lounge to support well-being and recharge during breaks."
                  requirements={[]}
                  policyNote="No claim needed — provided in the staff lounge."
                  borderColor={innerBorder}
                  iconAccent={innerIcon}
                />
                <BenefitCard
                  icon={faUsers}
                  title="Annual Team Building"
                  amount="Yearly company event"
                  status={
                    !isEligibleForBenefits ? 'locked'
                    : compensationData.yearsOfService >= 1 ? 'eligible'
                    : 'in-progress'
                  }
                  description="An annual event to strengthen collaboration and recharge with colleagues outside the daily work environment."
                  requirements={[
                    { label: 'Completed at least 1 full year of service', met: compensationData.yearsOfService >= 1 },
                  ]}
                  policyNote="Fully sponsored by the company."
                  borderColor={innerBorder}
                  iconAccent={innerIcon}
                />
                <BenefitCard
                  icon={faUtensils}
                  title="Annual Dinner"
                  amount="Year-end celebration"
                  status={
                    !isEligibleForBenefits ? 'locked'
                    : compensationData.yearsOfService >= 1 ? 'eligible'
                    : 'in-progress'
                  }
                  description="A year-end gathering to celebrate achievements and foster camaraderie among staff."
                  requirements={[
                    { label: 'Completed at least 1 full year of service', met: compensationData.yearsOfService >= 1 },
                  ]}
                  policyNote="Hosted yearly. Theme and dress code announced ahead of the event."
                  borderColor={innerBorder}
                  iconAccent={innerIcon}
                />
                <BenefitCard
                  icon={faChalkboardUser}
                  title="Internal Training Program"
                  amount="Ongoing professional development"
                  status={isEligibleForBenefits ? 'eligible' : 'locked'}
                  description="Skill-building and career-advancement training run internally — refine your capabilities and position yourself for future promotions."
                  requirements={[]}
                  policyNote="Sign up via HR throughout the year."
                  borderColor={innerBorder}
                  iconAccent={innerIcon}
                />
              </>
            );
          })()}
        </div>
      </div>
    </section>
  );
}

interface BenefitCardProps {
  icon: any;
  title: string;
  amount: string;
  /** Optional add-on reward shown on its own line below the base amount,
   *  e.g. a conditional bonus that shouldn't read as part of the base. */
  bonus?: string;
  status: RewardStatus;
  description: string;
  requirements: { label: string; met: boolean; optional?: boolean }[];
  policyNote?: string;
  extra?: React.ReactNode;
  /** Optional border override — used when card sits inside a tinted
   *  wrapper (e.g. the silver Performer-tier card) so the inner cards
   *  don't fade into the wrapper's background. */
  borderColor?: string;
  /** Hide the per-card status badge — used when an outer wrapper
   *  already communicates eligibility, making per-card badges
   *  redundant. */
  hideBadge?: boolean;
  /** Optional accent override for the icon tile. Defaults to a color
   *  derived from `status` (green for eligible, etc.). Override when
   *  the card sits inside a tier wrapper that wants the icon to match
   *  the tier color (e.g. silver) instead of the status color. */
  iconAccent?: string;
}

function BenefitCard({ icon, title, amount, bonus, status, description, requirements, policyNote, extra, borderColor, hideBadge, iconAccent }: BenefitCardProps) {
  const isLocked = status === 'locked' || status === 'not-eligible';
  const statusAccent =
    status === 'eligible' || status === 'earned' || status === 'achieved' ? C.success
    : status === 'in-progress' ? C.primary
    : status === 'unlocked' ? C.gold
    : status === 'not-eligible' ? C.danger
    : C.muted;
  const accent = iconAccent ?? statusAccent;
  const metCount = requirements.filter(r => r.met).length;
  const totalRequired = requirements.filter(r => !r.optional).length;
  const hasOptional = requirements.some(r => r.optional);

  return (
    <div className="tcomp-card" style={{
      ...s.card,
      opacity: isLocked ? 0.92 : 1,
      border: `1px solid ${borderColor ?? C.cardBorder}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${accent}14`, color: accent, fontSize: 15, flexShrink: 0,
        }}>
          <FontAwesomeIcon icon={isLocked ? faLock : icon} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: '-0.01em',
          }}>
            {title}
          </div>
          <div style={{
            marginTop: 4, fontSize: 12, fontWeight: 500, color: C.textSub,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {amount}
          </div>
          {bonus && (
            <div style={{
              marginTop: 2, fontSize: 12, fontWeight: 500, color: C.textSub,
              fontVariantNumeric: 'tabular-nums',
            }}>
              <span style={{ color: C.success, fontWeight: 600 }}>+</span> {bonus}
            </div>
          )}
        </div>
        {!hideBadge && <StatusBadge status={status} size="sm" />}
      </div>

      <p style={{
        margin: '0 0 12px', fontSize: 12, fontWeight: 500,
        color: C.textSub, lineHeight: 1.5,
      }}>
        {description}
      </p>

      {extra}

      {requirements.length > 0 && (
        <div style={{
          marginTop: extra ? 12 : 0,
          padding: 12,
          background: C.slateSoft, borderRadius: 10,
          border: `1px solid ${C.divider}`,
        }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 8,
          }}>
            <span style={{
              fontSize: 9, fontWeight: 800, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              {hasOptional ? 'Conditions' : 'Requirements'}
            </span>
            {!hasOptional && totalRequired > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, color: C.text,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {metCount} <span style={{ color: C.mutedSoft, fontWeight: 500 }}>/ {totalRequired} met</span>
              </span>
            )}
          </div>
          <ul style={{
            margin: 0, padding: 0, listStyle: 'none',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {requirements.map((r, i) => (
              <li key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 12, fontWeight: 500,
                color: r.met ? C.text : C.muted,
                lineHeight: 1.4,
              }}>
                <span style={{
                  width: 16, height: 16, borderRadius: '50%',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: r.met ? C.successSoft : '#fff',
                  color: r.met ? C.success : C.mutedSoft,
                  border: `1px solid ${r.met ? C.successBorder : '#cbd5e1'}`,
                  fontSize: 8,
                  flexShrink: 0,
                }}>
                  <FontAwesomeIcon icon={r.met ? faCheck : faCircle} style={{
                    fontSize: r.met ? 8 : 4,
                  }} />
                </span>
                {r.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {policyNote && (
        <div style={{
          marginTop: 10, fontSize: 11, color: C.mutedSoft, lineHeight: 1.5,
          fontStyle: 'italic',
        }}>
          {policyNote}
        </div>
      )}
    </div>
  );
}

function EnrollmentTierStrip() {
  const { isMobile } = useIsMobile();
  return (
    <div style={{
      padding: 12,
      background: C.slateSoft,
      border: `1px solid ${C.divider}`,
      borderRadius: 10,
      marginBottom: 12,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 800, color: C.muted,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: 8,
      }}>
        Commission Tiers
      </div>
      <div style={{
        display: 'grid', gap: 6,
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
      }}>
        {enrollmentCommissionTiers.map(tier => (
          <div key={tier.label} style={{
            padding: '8px 6px',
            background: '#fff',
            border: `1px solid ${C.divider}`,
            borderRadius: 8,
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: 9, fontWeight: 700, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {tier.label}
            </div>
            <div style={{
              marginTop: 2, fontSize: 14, fontWeight: 800, color: C.text,
              letterSpacing: '-0.012em',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {(tier.rate * 100).toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QualificationTierStrip() {
  return (
    <div style={{
      padding: 12,
      background: C.slateSoft,
      border: `1px solid ${C.divider}`,
      borderRadius: 10,
      marginBottom: 12,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 800, color: C.muted,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: 8,
      }}>
        Qualification Tiers
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        {qualificationTiers.map(tier => (
          <div key={tier.label} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12,
            padding: '8px 12px',
            background: '#fff',
            border: `1px solid ${C.divider}`,
            borderRadius: 8,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, color: C.text, letterSpacing: '-0.005em',
              }}>
                {tier.label}
              </div>
              <div style={{
                marginTop: 1, fontSize: 10, fontWeight: 500, color: C.muted,
              }}>
                {tier.sub}
              </div>
            </div>
            <div style={{
              fontSize: 14, fontWeight: 800, color: C.text,
              letterSpacing: '-0.012em',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}>
              {rm(tier.amount)}<span style={{
                fontSize: 10, fontWeight: 600, color: C.muted, marginLeft: 4,
              }}>/ mo</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Surface the RM allowance the teacher would gain by moving up one
// or two levels at the next review. No personalisation — the 6-month
// rolling appraisal that decides the actual move isn't tracked in
// the system yet, so we just show the two upside outcomes side by side.
function LevelPromotionTierStrip({
  up1Delta, up2Delta,
}: {
  up1Delta: number;
  up2Delta: number;
}) {
  const fmt = (n: number) => n > 0 ? `+${rm(n)}` : 'No change';
  const tiers = [
    { key: 'up1', label: '+1 level',  effect: fmt(up1Delta) },
    { key: 'up2', label: '+2 levels', effect: fmt(up2Delta) },
  ];
  return (
    <div style={{
      padding: 12,
      background: C.slateSoft,
      border: `1px solid ${C.divider}`,
      borderRadius: 10,
      marginBottom: 12,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 800, color: C.muted,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: 8,
      }}>
        Level Up
      </div>
      <div style={{
        display: 'grid', gap: 6,
        gridTemplateColumns: 'repeat(2, 1fr)',
      }}>
        {tiers.map(t => (
          <div key={t.key} style={{
            padding: '8px 6px',
            background: '#fff',
            border: `1px solid ${C.divider}`,
            borderRadius: 8,
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: 9, fontWeight: 700, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {t.label}
            </div>
            <div style={{
              marginTop: 2, fontSize: 14, fontWeight: 800, color: C.text,
              letterSpacing: '-0.012em',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {t.effect}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// High-Performer Benefits — unlocked when appraisal > 80.
// ─────────────────────────────────────────────────────────────────────────────

export function HighPerformerBenefits({ unlocked }: { unlocked: boolean }) {
  const { isMobile } = useIsMobile();
  return (
    <section style={s.section}>
      {/* Pill divider — gold + trophy when unlocked, slate + lock when
          not. Always renders so the section's place in the tier ladder
          is visible regardless of the teacher's current standing. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16,
      }}>
        <div style={{ flex: 1, height: 1, background: C.divider }} />
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 999,
          background: unlocked ? C.goldSoft : C.slateSoft,
          color: unlocked ? C.gold : C.muted,
          border: `1px solid ${unlocked ? C.goldBorder : '#e2e8f0'}`,
          fontSize: 10, fontWeight: 800,
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          <FontAwesomeIcon icon={unlocked ? faTrophy : faLock} style={{ fontSize: 10 }} />
          High-Performer Tier · {unlocked ? 'Unlocked' : 'Locked'}
        </div>
        <div style={{ flex: 1, height: 1, background: C.divider }} />
      </div>

      <SectionHeader
        eyebrow="High-Performer Benefits"
        title={unlocked ? 'Unlocked high-performer benefits' : 'High-performer benefits — locked'}
      />

      <div style={{
        ...s.card,
        padding: SP.xl,
        background: unlocked
          ? `linear-gradient(135deg, ${C.gold}10, ${C.gold}04)`
          : C.slateSoft,
        border: `1px solid ${unlocked ? `${C.gold}40` : C.cardBorder}`,
        boxShadow: unlocked
          ? `0 1px 3px ${C.gold}1f, 0 6px 16px ${C.gold}14`
          : 'none',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: unlocked ? '#fff' : C.slateSoft,
            color: unlocked ? C.gold : C.muted,
            border: `1px solid ${unlocked ? C.goldBorder : C.divider}`,
            fontSize: 18,
            flexShrink: 0,
          }}>
            <FontAwesomeIcon icon={unlocked ? faTrophy : faLock} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 9, fontWeight: 800, color: unlocked ? C.gold : C.muted,
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>
              {unlocked ? 'You qualify' : 'Eligibility threshold'}
            </div>
            <div style={{
              marginTop: 2, fontSize: 16, fontWeight: 800, color: C.text,
              letterSpacing: '-0.012em',
            }}>
              {unlocked
                ? `Appraisal score ${compensationData.appraisalScore} · ${benefitRules.highPerformerAppraisalThreshold} and above`
                : `Score ${benefitRules.highPerformerAppraisalThreshold} and above required`}
            </div>
            <div style={{
              marginTop: 4, fontSize: 12, fontWeight: 500, color: C.muted, lineHeight: 1.4,
            }}>
              {unlocked
                ? 'Benefits arrive next month.'
                : 'Reach the threshold to unlock these benefits next month.'}
            </div>
          </div>
        </div>

        <div style={{
          display: 'grid', gap: SP.md,
          gridTemplateColumns: isMobile
            ? 'minmax(0, 1fr)'
            : 'repeat(auto-fit, minmax(320px, 1fr))',
        }}>
          <HighPerformerCard
            icon={faBusinessTime}
            title="Semi-Flexible Working Hours"
            unlocked={unlocked}
            sectionUnlocked={unlocked}
            description="Adjust schedule to better accommodate personal or professional needs."
            conditions={[
              { label: 'Daily duties must still be fulfilled' },
              { label: 'Schedule adjustment requires supervisor approval' },
              { label: 'Classroom and school operations must be maintained' },
            ]}
          />
          <HighPerformerCard
            icon={faLeaf}
            title="Additional Conditional Annual Leave"
            unlocked={unlocked}
            sectionUnlocked={unlocked}
            description="Extra leave days for attending approved weekend training. Example: 2 weekend trainings = 2 leave days."
            conditions={[
              { label: 'Requires prior supervisor approval' },
              { label: 'Can only be taken during school holidays' },
            ]}
          />
          <HighPerformerCard
            icon={faChartLine}
            title="Teacher Shareholding Program"
            unlocked={
              unlocked
              && compensationData.yearsOfService >= 3
              && compensationData.appraisalScore >= 85
            }
            sectionUnlocked={unlocked}
            description="Become a co-owner of the school. Receive a percentage of shares, ongoing dividends, and a voice in strategic decisions."
            conditions={[
              {
                label: 'Minimum 3 years of service',
                met: compensationData.yearsOfService >= 3,
                progress: (compensationData.yearsOfService / 3) * 100,
                current: `${formatService(compensationData.yearsOfService)} / 3 yr`,
              },
              {
                label: 'Average appraisal ≥ 85% over service period',
                met: compensationData.appraisalScore >= 85,
                progress: (compensationData.appraisalScore / 85) * 100,
                current: compensationData.appraisalScore >= 85
                  ? `${compensationData.appraisalScore}% (target 85%)`
                  : `${compensationData.appraisalScore}% / 85%`,
              },
              { label: 'Successful alignment interview' },
            ]}
          />
          <HighPerformerCard
            icon={faHandshake}
            title="Kindergarten Partnership Program"
            unlocked={
              unlocked
              && compensationData.yearsOfService >= 5
              && compensationData.appraisalScore >= 85
            }
            sectionUnlocked={unlocked}
            description="Co-own and lead a new kindergarten branch. Receive partial capital investment, ownership equity, and ongoing operational support."
            conditions={[
              {
                label: 'Minimum 5 years of service',
                met: compensationData.yearsOfService >= 5,
                progress: (compensationData.yearsOfService / 5) * 100,
                current: `${formatService(compensationData.yearsOfService)} / 5 yr`,
              },
              {
                label: 'Average appraisal ≥ 85% over service period',
                met: compensationData.appraisalScore >= 85,
                progress: (compensationData.appraisalScore / 85) * 100,
                current: compensationData.appraisalScore >= 85
                  ? `${compensationData.appraisalScore}% (target 85%)`
                  : `${compensationData.appraisalScore}% / 85%`,
              },
              { label: 'Leadership & partnership readiness interview' },
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function HighPerformerCard({
  icon, title, unlocked, sectionUnlocked, description, conditions,
}: {
  icon: any; title: string; unlocked: boolean; sectionUnlocked: boolean;
  description: string;
  /** Items without `met` stay as plain dot-bulleted prose (process
   *  conditions like interviews). Items with `met` render a tickable
   *  check icon so the teacher sees their live progress against
   *  measurable gates (years of service, appraisal score). Optional
   *  `progress` (0–100, may exceed 100 — clamped at render) drives a
   *  mini bar under the label; `current` is the textual readout
   *  alongside it (e.g. "1 yr 1 mo / 3 yr"). */
  conditions: Array<{
    label: string;
    met?: boolean;
    progress?: number;
    current?: string;
  }>;
}) {
  // Two layers of state:
  // 1. sectionUnlocked = is the teacher in the high-performer tier this
  //    month? Drives the overall mood (full gold vs preview/dimmed).
  // 2. unlocked = does the teacher meet THIS card's specific criteria
  //    (e.g. 3+ years for Shareholding)? Drives the UNLOCKED badge.
  // Locked-section cards stay visible in a dimmed preview state — they
  // show what's available without pretending the teacher qualifies.
  return (
    <div style={{
      padding: SP.lg,
      background: '#fff',
      border: `1px solid ${sectionUnlocked ? C.goldBorder : C.cardBorder}`,
      borderRadius: 12,
      opacity: sectionUnlocked ? 1 : 0.7,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: sectionUnlocked ? `${C.gold}14` : C.slateSoft,
          color: sectionUnlocked ? C.gold : C.muted,
          fontSize: 16,
          border: `1px solid ${sectionUnlocked ? `${C.gold}33` : C.divider}`,
          flexShrink: 0,
        }}>
          <FontAwesomeIcon icon={icon} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: '-0.01em',
          }}>
            {title}
          </div>
        </div>
        {/* Badge logic: LOCKED when section gate not cleared (slate),
            UNLOCKED when both section AND per-card met (gold + open
            lock), PENDING when section is unlocked but per-card
            criteria are still being earned (gold + clock). Both
            unlocked/pending stay in the gold family so the tier feels
            cohesive — distinguished by icon and label. */}
        <StatusBadge
          status={!sectionUnlocked ? 'locked' : unlocked ? 'unlocked' : 'pending'}
          size="sm"
        />
      </div>
      <p style={{
        margin: '0 0 12px', fontSize: 12, fontWeight: 500,
        color: C.textSub, lineHeight: 1.55,
      }}>
        {description}
      </p>
      <div style={{
        padding: 10,
        background: C.slateSoft, borderRadius: 8,
        border: `1px solid ${C.divider}`,
      }}>
        {(() => {
          const tracked = conditions.filter(c => typeof c.met === 'boolean');
          const trackedMet = tracked.filter(c => c.met).length;
          return (
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              marginBottom: 6,
            }}>
              <span style={{
                fontSize: 9, fontWeight: 800, color: C.muted,
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Conditions
              </span>
              {tracked.length > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700, color: C.text,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {trackedMet} <span style={{ color: C.mutedSoft, fontWeight: 500 }}>/ {tracked.length} met</span>
                </span>
              )}
            </div>
          );
        })()}
        <ul style={{
          margin: 0, padding: 0, listStyle: 'none',
          display: 'flex', flexDirection: 'column', gap: 5,
        }}>
          {conditions.map((c, i) => {
            const tracked = typeof c.met === 'boolean';
            return (
              <li key={i} style={{
                fontSize: 11, fontWeight: 500,
                color: tracked && c.met ? C.text : C.textSub,
                display: 'flex', alignItems: 'flex-start', gap: 8, lineHeight: 1.5,
                minWidth: 0,
              }}>
                {tracked ? (
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: c.met ? C.successSoft : '#fff',
                    color: c.met ? C.success : C.mutedSoft,
                    border: `1px solid ${c.met ? C.successBorder : '#cbd5e1'}`,
                    fontSize: 7, flexShrink: 0,
                    marginTop: 2,
                  }}>
                    <FontAwesomeIcon icon={c.met ? faCheck : faCircle} style={{
                      fontSize: c.met ? 7 : 3,
                    }} />
                  </span>
                ) : (
                  <FontAwesomeIcon icon={faCircle} style={{
                    fontSize: 4, color: C.mutedSoft, marginTop: 6, flexShrink: 0,
                  }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div>{c.label}</div>
                  {typeof c.progress === 'number' && (
                    <div style={{
                      marginTop: 5,
                      height: 4, background: C.divider,
                      borderRadius: 999, overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.max(0, Math.min(100, c.progress))}%`,
                        background: tracked && c.met ? C.success : C.primary,
                        borderRadius: 999,
                        transition: 'width 500ms cubic-bezier(0.4, 0, 0.2, 1)',
                      }} />
                    </div>
                  )}
                  {c.current && (
                    <div style={{
                      marginTop: 3,
                      fontSize: 10, fontWeight: 600,
                      color: tracked && c.met ? C.success : C.muted,
                      fontVariantNumeric: 'tabular-nums',
                      lineHeight: 1.3,
                    }}>
                      {c.current}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: SP.lg }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: C.muted,
        textTransform: 'uppercase', letterSpacing: '0.1em',
      }}>
        {eyebrow}
      </div>
      <h2 style={{
        margin: '4px 0 0', fontSize: 20, fontWeight: 800, color: C.text,
        letterSpacing: '-0.022em', lineHeight: 1.15,
      }}>
        {title}
      </h2>
      {sub && (
        <p style={{
          margin: '6px 0 0', fontSize: 13, fontWeight: 500, color: C.muted,
          lineHeight: 1.55, maxWidth: 720,
        }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// Smaller, lighter header used for sub-sections nested inside an
// umbrella SectionHeader. Visual hierarchy: SectionHeader is page-
// level (h2, 20px), SubSectionHeader is umbrella-level (h3, 15px).
// `right` lets callers slot a tabular total / status label flush to
// the right edge so the sub-header reads "label  ·····  number" and
// the headline value is visible without scanning the chips below.
function SubSectionHeader({
  title,
  sub,
  right,
  spacing = 'tight',
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
  /** 'tight' keeps the original compact rhythm. 'loose' gives the
   *  title more weight, lets the sub wrap normally (no white-space
   *  nowrap on the title), and adds more space between title/sub and
   *  the section content below — used when the sub line is more than
   *  a few words and the section sits inside another card. */
  spacing?: 'tight' | 'loose';
}) {
  const loose = spacing === 'loose';
  return (
    <div style={{ marginBottom: loose ? SP.lg : SP.md }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: loose ? 'wrap' : 'nowrap',
      }}>
        <h3 style={{
          margin: 0, flex: 1, minWidth: 0,
          fontSize: loose ? 17 : 15, fontWeight: 800, color: C.text,
          letterSpacing: '-0.012em', lineHeight: 1.2,
          ...(loose ? null : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
        }}>
          {title}
        </h3>
        {right && <div style={{ flexShrink: 0 }}>{right}</div>}
      </div>
      {sub && (
        <p style={{
          margin: loose ? '8px 0 0' : '4px 0 0',
          fontSize: loose ? 13 : 12, fontWeight: 500, color: C.muted,
          lineHeight: loose ? 1.55 : 1.5, maxWidth: 720,
        }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: '28px 32px',
    background: C.bg,
    minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    color: C.text,
  },
  inner: { maxWidth: 1280, margin: '0 auto' },

  breadcrumb: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
    fontSize: 12,
  },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 7,
    border: `1px solid ${C.cardBorder}`,
    background: C.card, color: C.muted,
    cursor: 'pointer', transition: 'all 0.1s',
  },
  crumbLink: { color: C.muted, textDecoration: 'none', fontWeight: 500 },
  crumbCurrent: { color: C.text, fontWeight: 600 },

  // White-card hero matching the Career Path page chrome — soft border,
  // gentle shadow, generous padding. No more dark navy gradient.
  heroCard: {
    padding: '32px 36px',
    background: C.card,
    border: `1px solid ${C.cardBorder}`,
    borderRadius: 20,
    boxShadow: '0 1px 3px rgba(15,23,42,0.05), 0 12px 32px rgba(15,23,42,0.06)',
    marginBottom: 28,
  },
  // Two-column hero body: amount on the left (Career Path's mission-
  // progress slot), appraisal score panel on the right (its checklist
  // slot). Same minmax pattern as the Career Path hero.
  heroBody: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 380px)',
    gap: SP.xxl,
    alignItems: 'start',
  },
  heroChecklistCol: {
    paddingLeft: SP.xl,
    borderLeft: `1px solid ${C.divider}`,
    minWidth: 0,
  },

  section: { marginBottom: 56 },
  card: {
    background: C.card,
    border: `1px solid ${C.cardBorder}`,
    borderRadius: 14,
    padding: SP.xl,
    boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
  },

  // Reward chips row — auto-fits to the actual allowance count for
  // this teacher (1–5 cards depending on which allowances are set).
  // Each card has a min width so the grid degrades cleanly when
  // there's only 1–2 cards.
  chipsRow: {
    display: 'grid',
    gap: SP.md,
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  },

  benefitGrid: {
    display: 'grid', gap: SP.md,
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
  },
};
