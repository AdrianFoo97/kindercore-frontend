import { useQuery } from '@tanstack/react-query';
import { fetchMyPermissions } from '../api/me.js';
import { ModuleKey, ViewKey } from '../constants/authModules.js';

// Reads the currently logged-in user id straight from localStorage (same
// place Navbar.tsx reads `user` from) so the query key below can be scoped
// per-account.
function currentUserId(): string | null {
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as { id?: string }).id ?? null : null;
  } catch {
    return null;
  }
}

export function usePermissions() {
  // Keyed by user id, not just 'my-permissions' — without this, switching
  // which account is logged in (e.g. testing Test Teacher then Test
  // Supervisor in the same tab/session, or localStorage changing under a
  // tab that never reloaded) could keep serving one account's cached
  // module/view grants to a completely different account, since React
  // Query has no other way to know the identity behind a bare
  // 'my-permissions' key changed. Confirmed this exact symptom: a
  // teacher-only account briefly showing the Improvement Inbox and its
  // Approve/Reject buttons after switching from a supervisor account.
  const { data, isLoading } = useQuery({
    queryKey: ['my-permissions', currentUserId()],
    queryFn: fetchMyPermissions,
  });

  return {
    isAdmin: data?.isAdmin ?? false,
    hasModule: (m: ModuleKey) => !!data && (data.isAdmin || data.modules.includes(m)),
    hasView: (v: ViewKey) => !!data && (data.isAdmin || data.views.includes(v)),
    loading: isLoading,
  };
}
