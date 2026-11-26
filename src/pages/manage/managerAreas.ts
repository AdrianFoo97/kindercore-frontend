import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBug, faBullhorn, faCalendarCheck, faCartShopping, faChalkboardUser, faChartLine, faChartPie, faClipboardCheck,
  faClipboardList, faCoins, faFileLines, faGears, faGift, faIdCard, faInbox, faLightbulb, faListCheck,
  faMoneyBillTrendUp, faReceipt, faScrewdriverWrench, faStar, faTriangleExclamation, faUserPlus, faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { MODULES, type ModuleKey, type ViewKey } from '../../constants/authModules.js';

// Manager view (opened from the staff app's ⋯ menu): every area someone can
// manage, as tiles grouped like the admin menus — HR in the classic module
// order, Operation like its menu. What shows comes only from the person's
// access roles (modules + functions), never from their position. Each tile's
// access matches its page's guard in App.tsx (managerAreas.test.ts checks).

export interface ManagerArea {
  label: string;
  path: string;
  icon: IconDefinition;
  /** The module the page needs. Absent only for Settings, which has its own rule. */
  module?: ModuleKey;
  /** A function inside the module the page (or its list) needs. */
  view?: ViewKey;
}

export interface ManagerAreaGroup {
  heading: string;
  /** Shown without its heading — a group of one whose heading would just repeat the tile (Settings). */
  untitled?: boolean;
  areas: ManagerArea[];
}

export const MANAGER_AREA_GROUPS: ManagerAreaGroup[] = [
  { heading: 'Marketing', areas: [
    { label: 'Leads', path: '/leads', icon: faInbox, module: MODULES.MARKETING },
    { label: 'Campaigns', path: '/marketing/campaigns', icon: faBullhorn, module: MODULES.MARKETING },
  ] },
  { heading: 'Students', areas: [
    { label: 'All Students', path: '/students', icon: faUsers, module: MODULES.STUDENTS },
    { label: 'Student Onboarding', path: '/onboarding', icon: faClipboardList, module: MODULES.STUDENTS },
  ] },
  { heading: 'Team', areas: [
    { label: 'Staff', path: '/teachers', icon: faChalkboardUser, module: MODULES.HR },
  ] },
  { heading: 'Recruitment & Hiring', areas: [
    { label: 'Recruitment', path: '/hr/candidates', icon: faUserPlus, module: MODULES.HR, view: 'HR_SEE_ALL_STAFF' },
    { label: 'New Staff', path: '/hr/new-staff', icon: faIdCard, module: MODULES.HR, view: 'HR_SEE_ALL_STAFF' },
    { label: 'Staff Onboarding', path: '/hr/onboarding', icon: faListCheck, module: MODULES.HR, view: 'HR_SEE_ALL_STAFF' },
  ] },
  { heading: 'Performance Management', areas: [
    { label: 'Appraisals', path: '/hr/appraisals', icon: faStar, module: MODULES.HR },
    { label: 'Appraisal Schedule', path: '/hr/appraisal-schedule', icon: faCalendarCheck, module: MODULES.HR },
    { label: 'Practice Observations', path: '/hr/sop-observations', icon: faClipboardCheck, module: MODULES.HR },
  ] },
  { heading: 'Finance', areas: [
    { label: 'Operating Costs', path: '/operations/operating-costs', icon: faReceipt, module: MODULES.FINANCE },
  ] },
  { heading: 'Guides', areas: [
    // The library with editing — the staff app's Guides tab is read + suggest only.
    { label: 'Manage Guides', path: '/operations/sops', icon: faClipboardCheck, module: MODULES.OPERATION, view: 'OPERATION_SOP_APPROVE' },
    { label: 'Author Guides', path: '/operations/sops/author', icon: faFileLines, module: MODULES.OPERATION, view: 'OPERATION_SOP_APPROVE' },
    { label: 'Improvement Inbox', path: '/hr/sop-revisions', icon: faClipboardList, module: MODULES.OPERATION, view: 'OPERATION_SOP_APPROVE' },
  ] },
  { heading: 'Incidents', areas: [
    { label: 'Incident Reports', path: '/operations/incidents', icon: faTriangleExclamation, module: MODULES.OPERATION, view: 'OPERATION_INCIDENT_MANAGE' },
  ] },
  { heading: 'Facilities', areas: [
    { label: 'Facility Issues', path: '/operations/facilities', icon: faScrewdriverWrench, module: MODULES.OPERATION, view: 'OPERATION_FACILITY_MANAGE' },
    { label: 'Shopping List', path: '/operations/shopping-list', icon: faCartShopping, module: MODULES.OPERATION, view: 'OPERATION_PURCHASE_MANAGE' },
  ] },
  { heading: 'Planning', areas: [
    { label: 'Planner', path: '/tools/operations-planner', icon: faClipboardList, module: MODULES.TOOLS },
  ] },
  { heading: 'Analysis', areas: [
    { label: 'Marketing', path: '/analysis/sales-marketing', icon: faBullhorn, module: MODULES.ANALYSIS },
    { label: 'Sales', path: '/analysis/sales', icon: faChartLine, module: MODULES.ANALYSIS },
    { label: 'Revenue', path: '/analysis/revenue', icon: faCoins, module: MODULES.ANALYSIS },
    { label: 'Staff Cost', path: '/analysis/employee-cost', icon: faUsers, module: MODULES.ANALYSIS },
    { label: 'Operating Cost', path: '/analysis/operating-cost', icon: faReceipt, module: MODULES.ANALYSIS },
    { label: 'Finance', path: '/analysis/finance', icon: faMoneyBillTrendUp, module: MODULES.ANALYSIS },
    { label: 'Profit Sharing', path: '/analysis/profit-sharing', icon: faChartPie, module: MODULES.ANALYSIS },
    { label: 'Annual Bonus', path: '/analysis/annual-bonus', icon: faGift, module: MODULES.ANALYSIS },
  ] },
  { heading: 'Feedback', areas: [
    { label: 'Bug Reports', path: '/tools/bug-reports', icon: faBug, module: MODULES.TOOLS },
    { label: 'Feature Requests', path: '/tools/feature-requests', icon: faLightbulb, module: MODULES.TOOLS },
  ] },
  { heading: 'Settings', untitled: true, areas: [
    { label: 'Settings', path: '/settings', icon: faGears },
  ] },
];

export interface ManagerAccess {
  hasModule: (m: ModuleKey) => boolean;
  hasView: (v: ViewKey) => boolean;
  /** Has at least one Settings page they may open (every one of them manages something). */
  hasSettings: boolean;
}


export function canOpenArea(area: ManagerArea, access: ManagerAccess): boolean {
  if (!area.module) return access.hasSettings;
  return access.hasModule(area.module) && (!area.view || access.hasView(area.view));
}

/** The groups with something this person can open — each holding only those areas, in catalog order. */
export function visibleManagerGroups(access: ManagerAccess, groups: ManagerAreaGroup[] = MANAGER_AREA_GROUPS): ManagerAreaGroup[] {
  return groups
    .map(g => ({ ...g, areas: g.areas.filter(a => canOpenArea(a, access)) }))
    .filter(g => g.areas.length > 0);
}
