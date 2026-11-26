import { useQuery } from '@tanstack/react-query';
import { fetchSettings } from '../../api/settings.js';
import { SCORE_BANDS_KEY, bandFor, bandsFrom, type Band } from './scoreBands.js';

/**
 * The band (name + colours) for any appraisal score, from Settings → Score
 * bands. Shares the ['settings'] cache, so a change there shows everywhere.
 */
export function useScoreBand(): (score: number) => Band {
  const { data } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  const bands = bandsFrom((data as Record<string, unknown> | undefined)?.[SCORE_BANDS_KEY]);
  return (score: number) => bandFor(score, bands);
}

