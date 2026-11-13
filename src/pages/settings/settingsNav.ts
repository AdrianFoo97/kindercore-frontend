import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBoxesStacked, faBuilding, faCalendarDays, faClipboardCheck, faClockRotateLeft, faCoins, faEye,
  faFileImport, faGears, faGraduationCap, faIdBadge, faMessage, faMoneyBillTrendUp, faPlug, faReceipt, faTrash,
  faUserCheck, faUserPlus, faUserShield, faUsers,
} from '@fortawesome/free-solid-svg-icons';

// Settings navigation — the ONE list behind the Settings home page, the
// sidebar on every settings page and settings search. Grouped by what the
// person is doing, not by how the app is built. To add a settings page, add
// it here (and its route in App.tsx); everything else picks it up.

export interface SettingsItem {
  key: string;
  label: string;
  /** Where the item opens. */
  to: string;
  /** One line under the label: what you set here. */
  description: string;
  icon: IconDefinition;
  /** Other routes that belong to this item (sub-pages, tabs with their own URL). */
  alsoAt?: string[];
  /** Extra words people might search for. */
  keywords?: string[];
  /** Only on the test server (backed by test-only endpoints). */
  testServerOnly?: boolean;
  /** Destructive — shown in red. */
  danger?: boolean;
}

export interface SettingsGroup { key: string; label: string; items: SettingsItem[] }

export const SETTINGS_HOME = '/settings';

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    key: 'organisation', label: 'Organisation', items: [
      { key: 'company', label: 'Company', to: '/settings/company', icon: faBuilding,
        description: 'Vision, mission, core values, branches and departments.', keywords: ['school', 'branch', 'department', 'values'] },
      { key: 'integrations', label: 'Integrations', to: '/settings/calendar', icon: faPlug,
        description: 'Connect Google Calendar.', keywords: ['google', 'calendar'] },
      { key: 'data', label: 'Data import', to: '/settings/data', icon: faFileImport,
        description: 'Import leads, students and candidates from a spreadsheet.', keywords: ['import', 'excel', 'csv', 'upload'] },
    ],
  },
  {
    key: 'people', label: 'People', items: [
      { key: 'recruitment', label: 'Recruitment', to: '/settings/recruitment', icon: faUserPlus,
        description: 'Job application form and hiring pipeline.', keywords: ['hiring', 'candidates', 'interview', 'apply'] },
      { key: 'staff-onboarding', label: 'Staff onboarding', to: '/settings/staff-onboarding', icon: faUserCheck,
        description: 'Checklists every new staff member gets.', keywords: ['new staff', 'joiner', 'checklist'] },
      { key: 'appraisal-forms', label: 'Appraisal forms', to: '/settings/appraisal-forms', icon: faClipboardCheck,
        description: 'What staff are appraised on, and who assesses and signs off.', keywords: ['appraisal', 'kpi', 'core values', 'review'] },
      { key: 'payroll', label: 'Payroll', to: '/settings/hr', icon: faCoins,
        alsoAt: ['/settings/employee-salary', '/settings/points-rewards', '/settings/career-missions', '/settings/mission-categories'],
        description: 'Salary bands, allowances, points and rewards, career missions.', keywords: ['salary', 'allowance', 'points', 'rewards', 'missions', 'position'] },
    ],
  },
  {
    key: 'students-sales', label: 'Students & sales', items: [
      { key: 'crm', label: 'CRM', to: '/settings/leads', icon: faUsers,
        description: 'Lead statuses and lost reasons.', keywords: ['leads', 'enquiry', 'status', 'marketing'] },
      { key: 'students', label: 'Students', to: '/settings/onboarding', icon: faGraduationCap,
        description: 'Onboarding checklist for new students.', keywords: ['enrolment', 'checklist', 'onboarding'] },
      { key: 'packages', label: 'Packages & pricing', to: '/settings/packages', icon: faBoxesStacked,
        alsoAt: ['/settings/packages/programmes', '/settings/packages/age-groups'],
        description: 'Programmes, age groups and fees.', keywords: ['fees', 'price', 'programme', 'age group'] },
      { key: 'messages', label: 'Message templates', to: '/settings/whatsapp-templates', icon: faMessage,
        description: 'WhatsApp messages for parents and candidates.', keywords: ['whatsapp', 'template', 'message'] },
    ],
  },
  {
    key: 'money', label: 'Money', items: [
      { key: 'finance', label: 'Finance', to: '/settings/finance', icon: faMoneyBillTrendUp, alsoAt: ['/settings/compensation'],
        description: 'Finance targets and compensation tiers.', keywords: ['profit share', 'bonus', 'expense ratio', 'target'] },
      { key: 'operating-cost', label: 'Operating cost', to: '/settings/operating-cost', icon: faReceipt,
        alsoAt: ['/settings/operating-cost-categories', '/settings/operating-cost-main-categories'],
        description: 'Cost categories for recording spending.', keywords: ['expenses', 'cost', 'category'] },
    ],
  },
  {
    key: 'operations', label: 'Operations', items: [
      { key: 'operation', label: 'Operation', to: '/settings/operation', icon: faGears,
        alsoAt: ['/settings/timetable', '/settings/sop-categories', '/settings/sop-sections'],
        description: 'Timetable, and how-to guide categories and sections.', keywords: ['timetable', 'sop', 'guides', 'planner'] },
      { key: 'attendance-reader', label: 'Attendance reader', to: '/settings/attendance-reader', icon: faIdBadge,
        description: 'Key for the RFID card reader at the door.', keywords: ['rfid', 'card', 'attendance', 'scanner'] },
    ],
  },
  {
    key: 'team-access', label: 'Team & access', items: [
      { key: 'users', label: 'Team members', to: '/settings/users', icon: faUsers,
        description: 'Invite people and link accounts to staff.', keywords: ['users', 'invite', 'accounts', 'login'] },
      { key: 'roles', label: 'Access roles', to: '/settings/auth-roles', icon: faUserShield,
        description: 'Which areas of the app each role can open.', keywords: ['permissions', 'modules', 'roles'] },
      { key: 'views', label: 'Views', to: '/settings/auth-views', icon: faEye,
        description: 'Fine-grained actions you can grant to roles.', keywords: ['permissions', 'actions'] },
      { key: 'access-log', label: 'Access log', to: '/admin/access-log', icon: faClockRotateLeft,
        description: 'Who opened pay, finance, appraisal and applicant records.', keywords: ['audit', 'security', 'history'] },
      { key: 'year-rollover', label: 'Year rollover', to: '/admin/year-rollover', icon: faCalendarDays,
        description: 'Start a new school year.', keywords: ['new year', 'promote'] },
    ],
  },
  {
    key: 'test-tools', label: 'Test tools', items: [
      { key: 'reset-candidates', label: 'Reset all candidates', to: '/settings/test/reset-candidates', icon: faTrash,
        description: 'Delete every candidate on this test server.', testServerOnly: true, danger: true },
    ],
  },
];

/** The groups this person should see — test-only items only on the test server; empty groups dropped. */
export function visibleGroups(isTestServer: boolean, groups: SettingsGroup[] = SETTINGS_GROUPS): SettingsGroup[] {
  return groups
    .map(g => ({ ...g, items: g.items.filter(i => !i.testServerOnly || isTestServer) }))
    .filter(g => g.items.length > 0);
}

const startsWithPath = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** The item a page belongs to (its own route, or one of its sub-pages), or null. Longest match wins. */
export function itemForPath(pathname: string, groups: SettingsGroup[] = SETTINGS_GROUPS): SettingsItem | null {
  let best: { item: SettingsItem; length: number } | null = null;
  for (const item of groups.flatMap(g => g.items)) {
    for (const base of [item.to, ...(item.alsoAt ?? [])]) {
      if (startsWithPath(pathname, base) && (!best || base.length > best.length)) best = { item, length: base.length };
    }
  }
  return best?.item ?? null;
}

/** Items whose label, description, group or keywords contain every word typed (any order, any case). */
export function searchSettings(query: string, groups: SettingsGroup[] = SETTINGS_GROUPS): { group: SettingsGroup; item: SettingsItem }[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return groups.flatMap(group => group.items
    .filter(item => {
      const text = [item.label, item.description, group.label, ...(item.keywords ?? [])].join(' ').toLowerCase();
      return words.every(w => text.includes(w));
    })
    .map(item => ({ group, item })));
}

/** Does this page get the settings sidebar? Settings pages and the admin pages that moved into Settings. */
export function isSettingsArea(pathname: string): boolean {
  return pathname === SETTINGS_HOME || startsWithPath(pathname, '/settings') || itemForPath(pathname) !== null;
}
