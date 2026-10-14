import { apiFetch } from './client.js';

export interface MarketingCampaignRecord {
  id: string;
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  leadCount: number;
}

export interface UpsertMarketingCampaignPayload {
  name: string;
  code: string;
  startDate: string;
  endDate: string;
}

export function fetchMarketingCampaigns() {
  return apiFetch<MarketingCampaignRecord[]>('/api/marketing-campaigns');
}

export function createMarketingCampaign(payload: UpsertMarketingCampaignPayload) {
  return apiFetch<MarketingCampaignRecord>('/api/marketing-campaigns', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateMarketingCampaign(id: string, payload: Partial<Omit<UpsertMarketingCampaignPayload, 'code'>>) {
  return apiFetch<MarketingCampaignRecord>(`/api/marketing-campaigns/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteMarketingCampaign(id: string) {
  return apiFetch<{ ok: true }>(`/api/marketing-campaigns/${id}`, { method: 'DELETE' });
}
