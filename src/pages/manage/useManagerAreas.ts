import { usePermissions } from '../../hooks/usePermissions.js';
import { useSettingsGroups } from '../settings/useSettingsAccess.js';
import { visibleManagerGroups, type ManagerAreaGroup } from './managerAreas.js';

/** The manager-view groups the signed-in person can open (empty while their access is loading). */
export function useManagerAreas(): { groups: ManagerAreaGroup[]; loading: boolean } {
  const { hasModule, hasView, loading } = usePermissions();
  const { groups: settingsGroups, loading: settingsLoading } = useSettingsGroups();
  if (loading || settingsLoading) return { groups: [], loading: true };
  return { groups: visibleManagerGroups({ hasModule, hasView, hasSettings: settingsGroups.length > 0 }), loading: false };
}

/** Where the manager view lives. */
export const MANAGER_HOME = '/manage';
