// UI-facing constants for the Points & Rewards feature — icon name<->object
// registries, category badges, stock labels. The real backend stores icon
// as a NAME string (varchar(40)); these registries resolve that name to a
// FontAwesome icon object for display, and back to a name when saving from
// an icon picker. Data-only (no fetching) so it stays reusable from both
// api/points.ts consumers and the admin add/edit forms.

import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faRoad, faCalendarCheck, faStar, faGraduationCap, faUserPlus,
  faMugSaucer, faUtensils, faGift, faBriefcaseMedical, faLeaf,
  faBusinessTime, faTrophy, faMedal, faHandshake, faBookOpen,
} from '@fortawesome/free-solid-svg-icons';

export type RuleCategory =
  | 'mission' | 'attendance' | 'performance' | 'training' | 'referral' | 'other';

export type RewardCategory =
  | 'food' | 'wellness' | 'merch' | 'leave' | 'experience' | 'other';

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

// Stock label palette — kept here so both pages render the same chips.
export function stockMeta(s: 'in' | 'limited' | 'out') {
  return s === 'in'      ? { text: 'In stock',     palette: 'success' as const }
    :    s === 'limited' ? { text: 'Limited',      palette: 'warning' as const }
    :                      { text: 'Out of stock', palette: 'muted'   as const };
}

// Curated icon palettes for the pickers. Rule icons lean activity/effort,
// reward icons lean perks/experience. Names must match what real seed data
// and any admin-created rows use in the `icon` column.
export const RULE_ICON_OPTIONS: { name: string; icon: IconDefinition }[] = [
  { name: 'mission',     icon: faRoad },
  { name: 'attendance',  icon: faCalendarCheck },
  { name: 'excellence',  icon: faStar },
  { name: 'training',    icon: faGraduationCap },
  { name: 'referral',    icon: faUserPlus },
  { name: 'trophy',      icon: faTrophy },
  { name: 'medal',       icon: faMedal },
  { name: 'partnership', icon: faHandshake },
  { name: 'study',       icon: faBookOpen },
];
export const REWARD_ICON_OPTIONS: { name: string; icon: IconDefinition }[] = [
  { name: 'coffee',     icon: faMugSaucer },
  { name: 'food',       icon: faUtensils },
  { name: 'gift',       icon: faGift },
  { name: 'health',     icon: faBriefcaseMedical },
  { name: 'leave',      icon: faLeaf },
  { name: 'time',       icon: faBusinessTime },
  { name: 'training',   icon: faGraduationCap },
  { name: 'milestone',  icon: faStar },
  { name: 'attendance', icon: faCalendarCheck },
];

export function resolveRuleIcon(name: string): IconDefinition {
  return RULE_ICON_OPTIONS.find(o => o.name === name)?.icon ?? faStar;
}
export function resolveRewardIcon(name: string): IconDefinition {
  return REWARD_ICON_OPTIONS.find(o => o.name === name)?.icon ?? faGift;
}
