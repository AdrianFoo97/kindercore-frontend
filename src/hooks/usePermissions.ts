import { useQuery } from '@tanstack/react-query';
import { fetchMyPermissions } from '../api/me.js';
import { ModuleKey, ViewKey } from '../constants/authModules.js';

export function usePermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-permissions'],
    queryFn: fetchMyPermissions,
  });

  return {
    isAdmin: data?.isAdmin ?? false,
    hasModule: (m: ModuleKey) => !!data && (data.isAdmin || data.modules.includes(m)),
    hasView: (v: ViewKey) => !!data && (data.isAdmin || data.views.includes(v)),
    loading: isLoading,
  };
}
