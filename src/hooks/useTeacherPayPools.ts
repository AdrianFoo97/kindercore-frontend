import { useQuery } from '@tanstack/react-query';
import { fetchTeacherPayPools } from '../api/finance.js';

/**
 * A teacher's own pool figures, worked out on the server (this quarter's team
 * pool + this year's annual bonus). One request and one cache entry shared by
 * the Home, Pay Breakdown, Team Pool and Annual Bonus pages, so they never disagree.
 */
export function useTeacherPayPools(teacherId: string | undefined) {
  const now = new Date();
  const year = now.getFullYear();
  const quarterIdx = Math.floor(now.getMonth() / 3);
  return useQuery({
    queryKey: ['teacher-pay-pools', teacherId, year, quarterIdx],
    queryFn: () => fetchTeacherPayPools(teacherId!, year, quarterIdx),
    enabled: !!teacherId,
  });
}
