import { useQueries } from '@tanstack/react-query';
import { fetchSteps, type SopStep } from '../../../api/sop-steps.js';

/** The steps of several SOPs, by SOP id — shared cache with the SOP pages (['sop-steps', id]). */
export function useSopSteps(sopIds: string[]): { steps: Record<string, SopStep[]>; loading: boolean; error: Error | null } {
  const results = useQueries({
    queries: sopIds.map(id => ({ queryKey: ['sop-steps', id], queryFn: () => fetchSteps(id), refetchOnWindowFocus: false })),
  });
  const steps: Record<string, SopStep[]> = {};
  results.forEach((r, i) => { if (r.data) steps[sopIds[i]] = r.data; });
  return {
    steps,
    loading: results.some(r => r.isPending),
    error: (results.find(r => r.error)?.error as Error | undefined) ?? null,
  };
}
