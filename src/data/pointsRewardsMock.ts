// Shared mock data for the Points & Rewards feature. Both the teacher
// rewards page and the admin settings page read from here while the
// backend is being built. Swap this module to real API calls once the
// endpoints exist — the types below double as the API contract.

import {
  faRoad, faCalendarCheck, faStar, faGraduationCap, faUserPlus,
  faMugSaucer, faUtensils, faGift, faBriefcaseMedical, faLeaf,
  faBusinessTime, faTrophy, faMedal, faHandshake, faBookOpen,
} from '@fortawesome/free-solid-svg-icons';

export type RuleCategory =
  | 'mission' | 'attendance' | 'performance' | 'training' | 'referral' | 'other';

export interface EarningRule {
  id: string;
  /** FontAwesome icon definition. Real persistence would store an icon
   *  name string and resolve via a registry. */
  icon: any;
  label: string;
  /** One-line context shown under the title in the admin list. Helps
   *  admins (and a future audit log) understand exactly when points
   *  fire without having to open the editor. */
  description: string;
  amount: number;
  /** Subtle badge in the admin list. 'other' is the catch-all for
   *  admin-defined custom rules. */
  category: RuleCategory;
  /** Inactive rules are hidden from teachers but kept in settings so
   *  admins can re-enable without re-entering data. */
  active: boolean;
}

export type RewardCategory =
  | 'food' | 'wellness' | 'merch' | 'leave' | 'experience' | 'other';

export interface RewardItem {
  id: string;
  icon: any;
  label: string;
  sub: string;
  cost: number;
  stock: 'in' | 'limited' | 'out';
  /** Same semantics as EarningRule.active — hidden from teachers when
   *  false. Distinct from stock state ('out' is "all sold out", inactive
   *  is "we're not offering this at all right now"). */
  active: boolean;
  /** Optional categorisation used by the teacher catalog page for
   *  filter chips. Defaults to 'other' when not set so legacy entries
   *  still render under the "All" filter. */
  category?: RewardCategory;
}

export interface PointsBalance {
  current: number;
  earnedThisMonth: number;
  lifetimeEarned: number;
}

export interface PointTransaction {
  id: string;
  /** ISO date string. */
  date: string;
  kind: 'earned' | 'redeemed';
  label: string;
  /** Positive for earned, negative for redeemed. */
  delta: number;
  /** Running balance immediately after this entry. */
  balanceAfter: number;
}

export const pointsBalance: PointsBalance = {
  current: 1250,
  earnedThisMonth: 280,
  lifetimeEarned: 4380,
};

// ─── Teacher goal ────────────────────────────────────────────────────────
// The teacher can pin a single reward as their active "goal". This
// surfaces as a motivation banner on the main rewards page and on the
// catalog page, so they always see a concrete target they're chasing.
// Module-level mutable state — switched to a real backend field on
// the teacher record when the API exists.

export interface TeacherGoal {
  /** Catalog item id the teacher is saving up for. */
  rewardId: string;
  /** When the goal was set (ISO date). Used for sorting/audit if we
   *  ever surface goal history; today we only show the current one. */
  setAt: string;
}

let _goal: TeacherGoal | null = null;

export function getGoal(): TeacherGoal | null {
  return _goal;
}
export function setGoal(rewardId: string): TeacherGoal | null {
  const item = rewardCatalog.find(r => r.id === rewardId);
  if (!item || !item.active) return null;
  _goal = { rewardId, setAt: new Date().toISOString().slice(0, 10) };
  return _goal;
}
export function clearGoal(): void {
  _goal = null;
}

export const earningRules: EarningRule[] = [
  {
    id: 'r-mission', icon: faRoad,
    label: 'Complete a mission',
    description: 'Awarded when a teacher completes an approved mission.',
    amount: 50, category: 'mission', active: true,
  },
  {
    id: 'r-attendance', icon: faCalendarCheck,
    label: 'Perfect monthly attendance',
    description: 'Awarded when attendance is perfect for the month.',
    amount: 30, category: 'attendance', active: true,
  },
  {
    id: 'r-appraisal', icon: faStar,
    label: 'Appraisal ≥ 80%',
    description: 'Awarded when monthly appraisal meets the performance threshold.',
    amount: 200, category: 'performance', active: true,
  },
  {
    id: 'r-training', icon: faGraduationCap,
    label: 'Attend approved training',
    description: 'Awarded after completing approved professional training.',
    amount: 40, category: 'training', active: true,
  },
  {
    id: 'r-referral', icon: faUserPlus,
    label: 'Refer a successful hire',
    description: 'Awarded when a referred candidate is successfully hired.',
    amount: 500, category: 'referral', active: true,
  },
];

// Subtle, premium palette — soft pastel backgrounds with muted text.
// Each category reads as a distinct label without competing for
// attention with the rest of the row. Borders kept very light so the
// badges feel like quiet metadata, not status pills.
export const RULE_CATEGORY_META: Record<RuleCategory, { label: string; color: string; bg: string; border: string }> = {
  mission:     { label: 'Mission',     color: '#1e40af', bg: '#eff6ff', border: '#dbeafe' },
  attendance:  { label: 'Attendance',  color: '#155e75', bg: '#ecfeff', border: '#cffafe' },
  performance: { label: 'Performance', color: '#854d0e', bg: '#fefce8', border: '#fef9c3' },
  training:    { label: 'Training',    color: '#5b21b6', bg: '#f5f3ff', border: '#ede9fe' },
  referral:    { label: 'Referral',    color: '#9f1239', bg: '#fff1f2', border: '#ffe4e6' },
  other:       { label: 'Other',       color: '#475569', bg: '#f8fafc', border: '#f1f5f9' },
};

export const rewardCatalog: RewardItem[] = [
  { id: 'i-coffee',  icon: faMugSaucer,        label: 'Coffee voucher',    sub: 'RM 15 value',          cost: 100,  stock: 'in',      active: true, category: 'food' },
  { id: 'i-lunch',   icon: faUtensils,         label: 'Lunch voucher',     sub: 'RM 30 value',          cost: 200,  stock: 'in',      active: true, category: 'food' },
  { id: 'i-merch',   icon: faGift,             label: 'Branded merch',     sub: 'T-shirt / mug / tote', cost: 350,  stock: 'limited', active: true, category: 'merch' },
  { id: 'i-health',  icon: faBriefcaseMedical, label: 'Health screening',  sub: 'Annual checkup',        cost: 600,  stock: 'in',      active: true, category: 'wellness' },
  { id: 'i-leave',   icon: faLeaf,             label: '1 extra leave day', sub: 'Use within 6 months',  cost: 800,  stock: 'in',      active: true, category: 'leave' },
  { id: 'i-spa',     icon: faBusinessTime,     label: 'Spa day voucher',   sub: 'RM 250 value',         cost: 1200, stock: 'limited', active: true, category: 'wellness' },
  // Aspirational rewards — priced above the current balance so the
  // "Save up to unlock" group on the catalog page is populated.
  { id: 'i-tech',    icon: faGift,             label: 'Tech voucher',      sub: 'RM 500 electronics store',  cost: 2500, stock: 'in',      active: true, category: 'merch' },
  { id: 'i-getaway', icon: faBusinessTime,     label: 'Weekend getaway',   sub: '2-night staycation, RM 800 value', cost: 4000, stock: 'limited', active: true, category: 'experience' },
];

// Categories shown as filter chips on the teacher catalog page. Order
// here drives the on-screen chip order. Labels kept short so the row
// scans cleanly on phones.
export const REWARD_CATEGORY_META: Record<RewardCategory, { label: string }> = {
  food:       { label: 'Food' },
  wellness:   { label: 'Wellness' },
  merch:      { label: 'Merch' },
  leave:      { label: 'Leave' },
  experience: { label: 'Experience' },
  other:      { label: 'Other' },
};

// Transaction history — newest first. Mix of earnings and redemptions
// so the teacher can scan their recent activity. Real implementation
// would page server-side; here we just slice for display.
export const pointTransactions: PointTransaction[] = [
  { id: 't-09', date: '2026-05-10', kind: 'earned',   label: 'Mission: Curriculum Contribution', delta:  50,  balanceAfter: 1250 },
  { id: 't-08', date: '2026-05-08', kind: 'redeemed', label: 'Coffee voucher',                   delta: -100, balanceAfter: 1200 },
  { id: 't-07', date: '2026-05-05', kind: 'earned',   label: 'Mission: Parent Communication',    delta:  50,  balanceAfter: 1300 },
  { id: 't-06', date: '2026-05-01', kind: 'earned',   label: 'Perfect attendance (April)',       delta:  30,  balanceAfter: 1250 },
  { id: 't-05', date: '2026-04-22', kind: 'earned',   label: 'Mission: SOP Compliance',          delta:  50,  balanceAfter: 1220 },
  { id: 't-04', date: '2026-04-18', kind: 'redeemed', label: 'Lunch voucher',                    delta: -200, balanceAfter: 1170 },
  { id: 't-03', date: '2026-04-12', kind: 'earned',   label: 'Attended training: Phonics',       delta:  40,  balanceAfter: 1370 },
  { id: 't-02', date: '2026-04-05', kind: 'earned',   label: 'Mission: Event Planning',          delta:  50,  balanceAfter: 1330 },
  { id: 't-01', date: '2026-04-01', kind: 'earned',   label: 'Perfect attendance (March)',       delta:  30,  balanceAfter: 1280 },
];

// ─── Redeemed rewards ────────────────────────────────────────────────────
// "My Rewards" — the teacher's owned/claimed rewards, distinct from
// the transaction ledger. Each entry represents a redemption the
// teacher actually made; status tracks the redemption lifecycle.

export type RedemptionStatus = 'available' | 'used' | 'expired' | 'pending' | 'delivered';

export interface RedeemedReward {
  id: string;
  /** Source catalog item id — lets us link back to the catalog entry
   *  if we ever want to show "you redeemed this" badges there. */
  rewardId: string;
  label: string;
  icon: any;
  /** ISO date string of when the teacher redeemed. */
  redeemedDate: string;
  pointsSpent: number;
  status: RedemptionStatus;
  /** Optional fields surfaced in the details modal. Some redemptions
   *  produce a voucher / claim code; others (e.g. extra leave day) just
   *  carry a redemption id + instructions. */
  voucherCode?: string;
  redemptionId?: string;
  instructions?: string;
}

export const myRewards: RedeemedReward[] = [
  {
    id: 'mr-04', rewardId: 'i-coffee', label: 'Coffee voucher', icon: faMugSaucer,
    redeemedDate: '2026-05-08', pointsSpent: 100, status: 'available',
    voucherCode: 'COFFEE-7B2F-9K3',
    redemptionId: 'RDM-2026-0042',
    instructions: 'Show the voucher code at the café counter. Valid for 30 days from redemption.',
  },
  {
    id: 'mr-03', rewardId: 'i-lunch', label: 'Lunch voucher', icon: faUtensils,
    redeemedDate: '2026-04-18', pointsSpent: 200, status: 'used',
    voucherCode: 'LUNCH-5A1C-2M9',
    redemptionId: 'RDM-2026-0037',
    instructions: 'Redeemed on 2026-04-22 at Lunch Vendor.',
  },
  {
    id: 'mr-02', rewardId: 'i-merch', label: 'Branded merch', icon: faGift,
    redeemedDate: '2026-03-30', pointsSpent: 350, status: 'delivered',
    redemptionId: 'RDM-2026-0029',
    instructions: 'T-shirt (size M) delivered to staff lounge on 2026-04-05.',
  },
  {
    id: 'mr-01', rewardId: 'i-health', label: 'Health screening', icon: faBriefcaseMedical,
    redeemedDate: '2026-02-12', pointsSpent: 600, status: 'expired',
    redemptionId: 'RDM-2026-0014',
    instructions: 'Booking window closed. Contact HR if you still need to schedule.',
  },
];

// Stock label palette — kept here so both pages render the same chips.
export function stockMeta(s: RewardItem['stock']) {
  return s === 'in'      ? { text: 'In stock',     palette: 'success' as const }
    :    s === 'limited' ? { text: 'Limited',      palette: 'warning' as const }
    :                      { text: 'Out of stock', palette: 'muted'   as const };
}

// Mutations — mock equivalents of what would otherwise be POST/PATCH/
// DELETE API calls. Mutate the in-memory arrays so the settings page,
// editor page, and teacher view all share one source of truth. New
// items default to active so they immediately surface to teachers
// unless the admin toggles them off.
export function addReward(item: Omit<RewardItem, 'id' | 'active'> & { active?: boolean }): RewardItem {
  const created: RewardItem = { id: `i-new-${Date.now()}`, active: true, ...item };
  rewardCatalog.push(created);
  return created;
}
export function addRule(rule: Omit<EarningRule, 'id' | 'active' | 'category' | 'description'> & {
  active?: boolean; category?: RuleCategory; description?: string;
}): EarningRule {
  const created: EarningRule = {
    id: `r-new-${Date.now()}`,
    active: true, category: 'other', description: '',
    ...rule,
  };
  earningRules.push(created);
  return created;
}
export function setRewardActive(id: string, active: boolean): void {
  updateReward(id, { active });
}
export function setRuleActive(id: string, active: boolean): void {
  updateRule(id, { active });
}

// Redeem a catalog item — debits the balance, logs a transaction,
// and inserts a fresh entry into myRewards. Returns the created
// redemption (or null if the redemption isn't allowed because the
// teacher can't afford it or the item is out of stock).
export function redeemReward(rewardId: string): RedeemedReward | null {
  const item = rewardCatalog.find(r => r.id === rewardId);
  if (!item) return null;
  if (!item.active) return null;
  if (item.stock === 'out') return null;
  if (pointsBalance.current < item.cost) return null;

  pointsBalance.current -= item.cost;

  const today = new Date().toISOString().slice(0, 10);
  const id = Date.now();

  // Voucher-style rewards get a generated code so the teacher has
  // something to copy on the details page. Non-voucher rewards
  // (leave day, health screening, etc.) just carry a redemption
  // ID + a pickup-style instruction.
  const isVoucher = /voucher|merch/i.test(item.label);
  const voucherCode = isVoucher
    ? `${item.label.split(' ')[0].toUpperCase()}-${id.toString(36).slice(-7).toUpperCase()}`
    : undefined;

  const created: RedeemedReward = {
    id: `mr-${id}`,
    rewardId: item.id,
    label: item.label,
    icon: item.icon,
    redeemedDate: today,
    pointsSpent: item.cost,
    status: 'available',
    redemptionId: `RDM-${today.replace(/-/g, '').slice(2)}-${id.toString().slice(-4)}`,
    voucherCode,
    instructions: voucherCode
      ? 'Show the voucher code to the vendor at the point of sale. Keep this page handy.'
      : 'HR will follow up to schedule or deliver this reward. Check your email for next steps.',
  };
  myRewards.unshift(created);

  pointTransactions.unshift({
    id: `t-${id}`,
    date: today,
    kind: 'redeemed',
    label: item.label,
    delta: -item.cost,
    balanceAfter: pointsBalance.current,
  });

  return created;
}

export function getReward(id: string): RewardItem | undefined {
  return rewardCatalog.find(r => r.id === id);
}
export function getRule(id: string): EarningRule | undefined {
  return earningRules.find(r => r.id === id);
}
export function updateReward(id: string, patch: Partial<Omit<RewardItem, 'id'>>): void {
  const i = rewardCatalog.findIndex(r => r.id === id);
  if (i >= 0) rewardCatalog[i] = { ...rewardCatalog[i], ...patch };
}
export function updateRule(id: string, patch: Partial<Omit<EarningRule, 'id'>>): void {
  const i = earningRules.findIndex(r => r.id === id);
  if (i >= 0) earningRules[i] = { ...earningRules[i], ...patch };
}
export function removeReward(id: string): void {
  const i = rewardCatalog.findIndex(r => r.id === id);
  if (i >= 0) rewardCatalog.splice(i, 1);
}
export function removeRule(id: string): void {
  const i = earningRules.findIndex(r => r.id === id);
  if (i >= 0) earningRules.splice(i, 1);
}

// Curated icon palettes for the pickers. Kept here so the add pages
// (and any future edit pages) draw from the same canonical sets — rule
// icons lean activity/effort, reward icons lean perks/experience.
export const RULE_ICON_OPTIONS: { name: string; icon: any }[] = [
  { name: 'mission',   icon: faRoad },
  { name: 'attendance',icon: faCalendarCheck },
  { name: 'excellence',icon: faStar },
  { name: 'training',  icon: faGraduationCap },
  { name: 'referral',  icon: faUserPlus },
  { name: 'trophy',    icon: faTrophy },
  { name: 'medal',     icon: faMedal },
  { name: 'partnership',icon: faHandshake },
  { name: 'study',     icon: faBookOpen },
];
export const REWARD_ICON_OPTIONS: { name: string; icon: any }[] = [
  { name: 'coffee',   icon: faMugSaucer },
  { name: 'food',     icon: faUtensils },
  { name: 'gift',     icon: faGift },
  { name: 'health',   icon: faBriefcaseMedical },
  { name: 'leave',    icon: faLeaf },
  { name: 'time',     icon: faBusinessTime },
  { name: 'training', icon: faGraduationCap },
  { name: 'milestone',icon: faStar },
  { name: 'attendance',icon: faCalendarCheck },
];
