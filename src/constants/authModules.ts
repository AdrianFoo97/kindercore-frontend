// Mirrors kindercore-backend/src/constants/authModules.ts — keep both in
// sync by hand (no shared package, this isn't a monorepo). One entry per
// Navbar dropdown currently shown to any authenticated user with zero role
// gating: Leads, Students, HR, Finance, Operation, Analysis, Tools.
// Settings/Admin/Dev stay hard-gated to ADMIN/SUPERADMIN as today — they
// are NOT part of this catalog.
export const MODULES = {
  LEADS: 'LEADS',
  STUDENTS: 'STUDENTS',
  HR: 'HR',
  FINANCE: 'FINANCE',
  OPERATION: 'OPERATION',
  ANALYSIS: 'ANALYSIS',
  TOOLS: 'TOOLS',
} as const;
export type ModuleKey = typeof MODULES[keyof typeof MODULES];
export const ALL_MODULE_KEYS: ModuleKey[] = Object.values(MODULES);

export const MODULE_LABELS: Record<ModuleKey, string> = {
  LEADS: 'Leads',
  STUDENTS: 'Students',
  HR: 'HR',
  FINANCE: 'Finance',
  OPERATION: 'Operation',
  ANALYSIS: 'Analysis',
  TOOLS: 'Tools',
};

export const VIEWS = {
  OPERATION_SOP_APPROVE: 'OPERATION_SOP_APPROVE',
} as const;
export type ViewKey = typeof VIEWS[keyof typeof VIEWS];
export const ALL_VIEW_KEYS: ViewKey[] = Object.values(VIEWS);

export const VIEW_LABELS: Record<ViewKey, string> = {
  OPERATION_SOP_APPROVE: 'Approve/reject How-To Guide changes',
};

// Which module each view belongs to — drives the AuthRolesPage views
// picker (only offer views whose module is currently checked).
export const VIEW_MODULE: Record<ViewKey, ModuleKey> = {
  OPERATION_SOP_APPROVE: 'OPERATION',
};
