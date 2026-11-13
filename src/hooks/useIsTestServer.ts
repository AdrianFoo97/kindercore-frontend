import { useQuery } from '@tanstack/react-query';
import { fetchTestRunner } from '../api/admin.js';

/**
 * True on the test server only — where the test runner and the wipe / seed
 * tools exist (the backend answers 404 for them elsewhere). Same probe and
 * cache key as the Test Catalog, so it's fetched once. Only asked for admins.
 */
export function useIsTestServer(isAdmin: boolean): boolean {
  const { data } = useQuery({ queryKey: ['test-runner'], queryFn: fetchTestRunner, enabled: isAdmin, retry: false });
  return !!data;
}
