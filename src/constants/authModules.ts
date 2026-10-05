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

// Views used to be a hardcoded object here too. They're now a real,
// admin-managed catalog fetched from the backend (see src/api/auth-views.ts,
// the "Views" admin page) instead of a fixed TS union — a view created
// there still does nothing on its own until a developer hardcodes a
// matching hasView(...)/RequireView call somewhere in code, same as
// before; the catalog just makes key/label/description admin-editable
// without a deploy. Kept as a plain string alias (not a union) so
// usePermissions/RequireView/etc. don't need signature changes.
export type ViewKey = string;
