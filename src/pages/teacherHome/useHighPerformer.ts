import { useQuery } from '@tanstack/react-query';
import { fetchSettings } from '../../api/settings.js';
import { DEFAULT_HIGH_PERFORMER_THRESHOLD, HIGH_PERFORMER_THRESHOLD_KEY, readScore } from '../settings/CompensationSettingsPage.js';

// "High Performer" — the same rule as the Pay page's tier: an appraisal score
// at or above the high-performer threshold in Settings → Compensation. Shares
// the ['settings'] cache, so a change there shows everywhere.

export function useIsHighPerformer(): (score: number) => boolean {
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  const threshold = readScore(settings, HIGH_PERFORMER_THRESHOLD_KEY, DEFAULT_HIGH_PERFORMER_THRESHOLD);
  return (score: number) => score >= threshold;
}
