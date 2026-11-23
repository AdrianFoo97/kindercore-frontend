import { usePermissions } from '../../hooks/usePermissions.js';

// HRMS access functions (backend: constants/accessRoles.ts). The HR module
// alone = the people below you in the reporting line, without pay.

/** Every staff member, plus recruitment, new staff, onboarding and the reward workbench. */
export const WHOLE_SCHOOL_HR = 'HR_SEE_ALL_STAFF';
/** Salaries, allowances, pay settings and payroll. */
export const SEE_PAY = 'HR_SEE_PAY';

/** What this person may do across HRMS staff records (admins: everything). */
export function useStaffAccess() {
  const { hasView, loading } = usePermissions();
  return { wholeSchool: hasView(WHOLE_SCHOOL_HR), seesPay: hasView(SEE_PAY), loading };
}
