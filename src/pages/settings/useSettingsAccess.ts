import { useLocation } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useIsTestServer } from '../../hooks/useIsTestServer.js';
import type { ModuleKey } from '../../constants/authModules.js';
import { SETTINGS_GROUPS, canOpenSetting, itemForPath, visibleGroups, type SettingsViewer } from './settingsNav.js';

/** The person viewing Settings, for settingsNav's access rules. */
function useViewer(): { viewer: SettingsViewer; loading: boolean } {
  const { isAdmin, hasModule, hasView, loading } = usePermissions();
  return { viewer: { isAdmin, hasModule: m => hasModule(m as ModuleKey), hasView }, loading };
}

/** The settings groups this person may see (their pages only). */
export function useSettingsGroups() {
  const { viewer, loading } = useViewer();
  const isTestServer = useIsTestServer(viewer.isAdmin);
  return { groups: visibleGroups(isTestServer, SETTINGS_GROUPS, viewer), loading };
}

/**
 * May this person open — and change — the settings page at `pathname`?
 * A page that isn't a listed setting is Admin-only.
 */
export function useCanOpenSettingsPath(pathname: string): { allowed: boolean; loading: boolean } {
  const { viewer, loading } = useViewer();
  const item = itemForPath(pathname);
  return { allowed: viewer.isAdmin || (!!item && canOpenSetting(item, viewer)), loading };
}

/** On a settings page: whether this person may change it (same rule as opening it; the server checks each save). */
export function useCanEditThisSetting(): boolean {
  const { pathname } = useLocation();
  return useCanOpenSettingsPath(pathname).allowed;
}
