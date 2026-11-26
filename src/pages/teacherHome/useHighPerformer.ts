import { useQuery } from '@tanstack/react-query';
import { fetchSettings } from '../../api/settings.js';
import { tierMarksFrom } from '../appraisals/scoreBands.js';

// "High Performer" — the same rule as the Pay page's tier: an appraisal score
// in the top band of Settings → Score bands. Shares the ['settings'] cache, so
// a change there shows everywhere.

export function useIsHighPerformer(): (score: number) => boolean {
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  const { highPerformer } = tierMarksFrom(settings as Record<string, unknown> | undefined);
  // Judged on the whole-number score, as the Pay page shows it (79.6 → 80).
  return (score: number) => Math.round(score) >= highPerformer;
}
