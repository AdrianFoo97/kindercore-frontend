import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBell, faBookOpen, faBoxesStacked, faBuilding, faChalkboard, faBook, faBullseye, faChalkboardUser, faGift, faTags, faCalendarDays, faClipboardCheck, faClockRotateLeft, faCoins,
  faFileImport, faGears, faRobot, faGraduationCap, faIdBadge, faLayerGroup, faUserTie, faListCheck, faMessage, faMoneyBillTrendUp, faPlug, faReceipt, faTrash,
  faStarHalfStroke, faRankingStar, faSitemap, faUserCheck, faUserPlus, faUserShield, faUsers,
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

export interface SettingsGroup {
  key: string;
  label: string;
  items: SettingsItem[];
  /** A heading the group sits under with its neighbours — e.g. the HR modules under "HRMS". */
  section?: string;
}

/** The HR modules' groups sit together under this heading (same name as the HRMS menu). */
export const HRMS = 'HRMS';

/** Groups in order, with neighbours that share a section kept together under it (no section = on their own). */
export function groupSections(groups: SettingsGroup[]): { section: string | null; groups: SettingsGroup[] }[] {
  const out: { section: string | null; groups: SettingsGroup[] }[] = [];
  for (const g of groups) {
    const section = g.section ?? null;
    const last = out[out.length - 1];
    if (last && last.section === section) last.groups.push(g);
    else out.push({ section, groups: [g] });
  }
  return out;
}

export const SETTINGS_HOME = '/settings';

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    key: 'organisation', label: 'Organisation', items: [
      { key: 'company', label: 'Company', to: '/settings/company', icon: faBuilding,
        description: 'Vision, mission, core values and branches.', keywords: ['school', 'branch', 'values'] },
      { key: 'integrations', label: 'Integrations', to: '/settings/calendar', icon: faPlug,
        description: 'Connect Google Calendar.', keywords: ['google', 'calendar'] },
      // Next to Integrations: AI is a connection to outside services too, plus what each AI feature does.
      { key: 'ai', label: 'AI', to: '/settings/ai', icon: faRobot,
        description: 'AI providers and keys, and each feature that uses AI.',
        keywords: ['ai', 'anthropic', 'claude', 'openai', 'gpt', 'api key', 'model', 'p&l reading', 'integration'] },
      { key: 'data', label: 'Data import', to: '/settings/data', icon: faFileImport,
        description: 'Import leads, students and candidates from a spreadsheet.', keywords: ['import', 'excel', 'csv', 'upload'] },
      { key: 'notifications', label: 'Notifications', to: '/settings/notifications', icon: faBell,
        description: 'Choose which events the bell tells you about.', keywords: ['bell', 'alerts', 'notify', 'new lead', 'incident'] },
      { key: 'messages', label: 'Message templates', to: '/settings/whatsapp-templates', icon: faMessage,
        description: 'Message templates by group — Common for everyone, Marketing and HR for those modules.', keywords: ['whatsapp', 'template', 'message'] },
    ],
  },
  // HR settings follow the classic HR modules, in their usual order — the same sections as the HRMS menu:
  // HR Planning → Compensation & Benefits → Recruitment & Hiring → Training & Development → Performance Management.
  // (Employee Relations has no settings yet.)
  {
    // HR Planning: how the organisation is shaped — departments, positions and who reports to whom.
    key: 'hr-planning', label: 'HR Planning', section: HRMS, items: [
      { key: 'departments', label: 'Departments', to: '/settings/departments', icon: faLayerGroup,
        description: 'The departments positions belong to, each with its head.', keywords: ['hr', 'department', 'team', 'management', 'head', 'organisation', 'organization'] },
      { key: 'positions', label: 'Positions', to: '/settings/positions', icon: faUserTie, alsoAt: ['/settings/employee-salary/positions'],
        description: 'Job titles, their department and who each reports to.', keywords: ['hr', 'position', 'job', 'title', 'rank', 'reports to', 'access role', 'career'] },
      { key: 'org-chart', label: 'Org chart', to: '/settings/org-chart', icon: faSitemap, alsoAt: ['/settings/org-structure'],
        description: 'Who reports to whom, with the people in each position.', keywords: ['hr', 'org chart', 'organisation', 'organization', 'hierarchy', 'reports to', 'structure', 'people'] },
    ],
  },
  {
    key: 'compensation', label: 'Compensation & Benefits', section: HRMS, items: [
      { key: 'payroll', label: 'Payroll', to: '/settings/hr', icon: faCoins, alsoAt: ['/settings/employee-salary'],
        description: 'Salary bands by position, and allowances.', keywords: ['hr', 'salary', 'allowance', 'position', 'pay', 'people'] },
      { key: 'points-rewards', label: 'Points & rewards', to: '/settings/points-rewards', icon: faGift,
        description: 'Earning rules for granting points, and the reward catalog.', keywords: ['hr', 'points', 'rewards', 'redeem', 'benefits'] },
    ],
  },
  {
    key: 'recruitment', label: 'Recruitment & Hiring', section: HRMS, items: [
      { key: 'recruitment', label: 'Recruitment', to: '/settings/recruitment', icon: faUserPlus,
        description: 'Job application form and hiring pipeline.', keywords: ['hr', 'hiring', 'candidates', 'interview', 'apply', 'people'] },
      { key: 'staff-onboarding', label: 'Staff onboarding', to: '/settings/staff-onboarding', icon: faUserCheck,
        description: 'Checklists every new staff member gets — items can have a link button.', keywords: ['hr', 'new staff', 'joiner', 'checklist', 'checklists', 'people', 'link', 'button'] },
    ],
  },
  {
    key: 'training', label: 'Training & Development', section: HRMS, items: [
      { key: 'career-missions', label: 'Career missions', to: '/settings/career-missions', icon: faBullseye,
        description: 'Missions staff complete to grow towards their next role.', keywords: ['hr', 'career', 'missions', 'promotion', 'quests', 'people'] },
      { key: 'mission-categories', label: 'Mission categories', to: '/settings/mission-categories', icon: faTags,
        description: 'The categories career missions are grouped into.', keywords: ['hr', 'career', 'missions', 'category'] },
    ],
  },
  {
    // Performance management: everything that builds an appraisal — the forms, and the scoring forms and
    // rating scales they use. (HRMS → Performance Management is where appraisals are then run.)
    key: 'performance', label: 'Performance Management', section: HRMS, items: [
      { key: 'appraisal-forms', label: 'Appraisal forms', to: '/settings/appraisal-forms', icon: faClipboardCheck,
        description: 'What staff are appraised on, and who assesses and signs off.', keywords: ['appraisals', 'kpi', 'core values', 'review', 'people'] },
      { key: 'scoring-forms', label: 'Scoring forms', to: '/settings/scoring-forms', icon: faListCheck,
        description: 'Reusable sections and criteria a criterion can be scored from.', keywords: ['appraisals', 'points', 'template', 'checklist', 'criteria'] },
      { key: 'rating-scales', label: 'Rating scales', to: '/settings/rating-scales', icon: faStarHalfStroke,
        description: 'Named rating levels that appraisal criteria pick from.', keywords: ['appraisals', 'rating', 'scale', 'levels', 'rubric'] },
      { key: 'score-bands', label: 'Score bands', to: '/settings/score-bands', icon: faRankingStar,
        description: 'What appraisal scores are called and their colours — e.g. 80+ Outstanding.', keywords: ['appraisals', 'score', 'band', 'grade', 'outstanding', 'satisfactory', 'threshold'] },
      { key: 'practice-observations', label: 'Practice observations', to: '/settings/practice-observations', icon: faChalkboardUser,
        description: 'How observation steps are marked — pass / fail or levels — and what passes.', keywords: ['sop', 'observation', 'training', 'certify', 'pass', 'fail', 'level', 'rating', 'marking'] },
    ],
  },
  {
    // Marketing — what the Marketing Manager looks after: the leads pipeline and what we sell.
    key: 'marketing', label: 'Marketing', items: [
      { key: 'crm', label: 'CRM', to: '/settings/leads', icon: faUsers,
        description: 'Lead statuses and lost reasons.', keywords: ['leads', 'enquiry', 'status', 'marketing', 'sales'] },
      { key: 'packages', label: 'Packages & pricing', to: '/settings/packages', icon: faBoxesStacked,
        alsoAt: ['/settings/packages/programmes', '/settings/packages/age-groups'],
        description: 'Programmes, age groups and fees.', keywords: ['fees', 'price', 'programme', 'age group', 'sales', 'marketing'] },
    ],
  },
  {
    key: 'students', label: 'Students', items: [
      { key: 'students', label: 'Student onboarding', to: '/settings/onboarding', icon: faGraduationCap,
        description: 'Checklist for new students — items can have a link button.', keywords: ['enrolment', 'checklist', 'checklists', 'onboarding', 'students', 'link', 'button'] },
      { key: 'attendance-reader', label: 'Attendance reader', to: '/settings/attendance-reader', icon: faIdBadge,
        description: 'Key for the RFID card reader at the door.', keywords: ['rfid', 'card', 'attendance', 'scanner'] },
    ],
  },
  {
    key: 'money', label: 'Money', items: [
      { key: 'finance', label: 'Finance', to: '/settings/finance', icon: faMoneyBillTrendUp, alsoAt: ['/settings/compensation'],
        description: 'Finance targets and compensation tiers.', keywords: ['profit share', 'bonus', 'expense ratio', 'target'] },
      { key: 'operating-cost', label: 'Operating cost', to: '/settings/operating-cost', icon: faReceipt,
        // Tabs: Main categories · Categories · Import rules (P&L import).
        alsoAt: ['/settings/operating-cost-categories', '/settings/operating-cost-main-categories'],
        description: 'Cost categories and P&L import rules.',
        keywords: ['expenses', 'cost', 'category', 'p&l', 'profit and loss', 'import', 'rules'] },
    ],
  },
  {
    key: 'operations', label: 'Operations', items: [
      { key: 'classes', label: 'Classes', to: '/settings/timetable/classes', icon: faChalkboard,
        description: 'Classes, their hours and capacity.', keywords: ['timetable', 'planner', 'classroom', 'capacity'] },
      { key: 'subjects', label: 'Subjects', to: '/settings/timetable/subjects', icon: faBookOpen,
        description: 'Subjects taught, for the timetable.', keywords: ['timetable', 'planner', 'lessons'] },
      { key: 'tasks', label: 'Tasks', to: '/settings/timetable/tasks', icon: faListCheck,
        description: 'Non-teaching blocks for the timetable, like lunch break.', keywords: ['timetable', 'planner', 'duties', 'break'] },
      { key: 'how-to-guides', label: 'How-to guides', to: '/settings/how-to-guides', icon: faBook,
        alsoAt: ['/settings/sop-categories', '/settings/sop-sections'],
        description: 'Categories and sections for organising guides.', keywords: ['sop', 'guides', 'categories', 'sections'] },
    ],
  },
  {
    key: 'team-access', label: 'Team & access', items: [
      { key: 'users', label: 'Team members', to: '/settings/users', icon: faUsers,
        description: 'Invite people and link accounts to staff.', keywords: ['users', 'invite', 'accounts', 'login'] },
      { key: 'roles', label: 'Access roles', to: '/settings/auth-roles', icon: faUserShield,
        description: 'Built-in and your own roles — which modules and functions each can open.', keywords: ['permissions', 'modules', 'roles', 'functions', 'views'] },
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

/** Items whose label, description, group (or its section) or keywords contain every word typed (any order, any case). */
export function searchSettings(query: string, groups: SettingsGroup[] = SETTINGS_GROUPS): { group: SettingsGroup; item: SettingsItem }[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return groups.flatMap(group => group.items
    .filter(item => {
      const text = [item.label, item.description, group.label, group.section ?? '', ...(item.keywords ?? [])].join(' ').toLowerCase();
      return words.every(w => text.includes(w));
    })
    .map(item => ({ group, item })));
}

/** Does this page get the settings sidebar? Settings pages and the admin pages that moved into Settings. */
export function isSettingsArea(pathname: string): boolean {
  return pathname === SETTINGS_HOME || startsWithPath(pathname, '/settings') || itemForPath(pathname) !== null;
}
