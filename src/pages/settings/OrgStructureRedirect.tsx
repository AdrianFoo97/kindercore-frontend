import { Navigate, useSearchParams } from 'react-router-dom';

/** The old tabbed Organisational structure page → its own page for each tab (old links and bookmarks keep working). */
export default function OrgStructureRedirect() {
  const [params] = useSearchParams();
  const tab = params.get('tab');
  const to = tab === 'positions' ? '/settings/positions' : tab === 'chart' ? '/settings/org-chart' : '/settings/departments';
  return <Navigate to={to} replace />;
}
