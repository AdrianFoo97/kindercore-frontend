import { apiFetch } from './client.js';

/** Analysis → Profit Sharing: each month's pool now, and what (if anything) staff have been shown. */
export interface PublicationMonth {
  monthIdx: number;
  /** The month has ended — its figures are actuals, so it can be published. */
  finished: boolean;
  /** The month's profit-sharing pool now (RM). */
  livePool: number;
  /** The month's annual-bonus contribution now (RM). */
  liveBonus: number;
  liveHit: boolean;
  published: { poolAmount: number; annualBonusAmount: number; hit: boolean; publishedAt: string; byName: string } | null;
}

export interface PublicationHistoryRow {
  month: number;
  action: 'PUBLISHED' | 'UNPUBLISHED';
  poolAmount: number | null;
  annualBonusAmount: number | null;
  reason: string | null;
  byName: string;
  at: string;
}

export interface PublicationOverview { year: number; months: PublicationMonth[]; history: PublicationHistoryRow[] }

/** Who may publish — the Finance Manager's access function. */
export const PROFIT_PUBLISH_FUNCTION = 'ANALYSIS_PROFIT_PUBLISH';

export const publicationsKey = (year: number) => ['profit-share-publications', year];

export function fetchPublications(year: number) {
  return apiFetch<PublicationOverview>(`/api/profit-sharing/publications?year=${year}`);
}

export function publishMonth(year: number, monthIdx: number) {
  return apiFetch<PublicationOverview>(`/api/profit-sharing/publications/${year}/${monthIdx}/publish`, { method: 'POST' });
}

export function unpublishMonth(year: number, monthIdx: number, reason: string) {
  return apiFetch<PublicationOverview>(`/api/profit-sharing/publications/${year}/${monthIdx}/unpublish`, { method: 'POST', body: JSON.stringify({ reason }) });
}
