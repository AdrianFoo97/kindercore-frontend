import { ApiError, apiFetch, withSession } from './client.js';

// Settings → AI (admins): the providers, keys and limit every AI feature
// shares, and each feature's own choices (backend controllers/ai.controller).

export type ProviderId = 'anthropic' | 'openai';

export interface CommonAiConfig {
  provider: ProviderId | null;
  backup: ProviderId | null;
  /** Each provider's default model (empty = its built-in default). */
  models: Partial<Record<ProviderId, string>>;
  /** Most requests per provider per month, across every feature. */
  monthlyLimit: number | null;
}

export interface FeatureAiConfig { enabled: boolean; provider: ProviderId | null; model: string | null }

export interface ProviderStatus {
  id: ProviderId;
  label: string;
  defaultModel: string | null;
  keySource: 'env' | 'settings' | null;
  keyHint: string | null;
  keyUnreadable: boolean;
}

export interface AiFeatureView {
  key: string;
  label: string;
  category: string;
  description: string;
  config: FeatureAiConfig;
  /** What it actually uses after its own choices and the common settings. */
  effective: { provider: ProviderId | null; model: string | null; backup: ProviderId | null; ready: boolean };
}

type Totals = { requests: number; inputTokens: number; outputTokens: number };

export interface AiSettings {
  common: CommonAiConfig;
  providers: ProviderStatus[];
  features: AiFeatureView[];
  /** This calendar month. */
  usage: { byProvider: Record<string, Totals>; byFeature: Record<string, Totals> };
  /** How each provider + model did per feature this calendar month (starts again on the 1st). */
  stats: ProviderStat[];
}

export interface ProviderStat {
  feature: string;
  provider: string;
  model: string;
  requests: number;
  /** Answers in the feature's format. */
  answered: number;
  /** Answers that also passed the feature's checks. */
  passed: number;
  /** Total tokens this month. */
  inputTokens: number;
  outputTokens: number;
  lastAt: string;
}

export const fetchAiSettings = () => apiFetch<AiSettings>('/api/ai/settings');
export const saveAiCommon = (c: CommonAiConfig) => apiFetch<AiSettings>('/api/ai/settings', { method: 'PUT', body: JSON.stringify(c) });
export const saveAiFeature = (key: string, c: FeatureAiConfig) =>
  apiFetch<AiSettings>(`/api/ai/features/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(c) });
export const saveAiKey = (p: ProviderId, key: string) => apiFetch<AiSettings>(`/api/ai/keys/${p}`, { method: 'PUT', body: JSON.stringify({ key }) });
export const removeAiKey = (p: ProviderId) => apiFetch<AiSettings>(`/api/ai/keys/${p}`, { method: 'DELETE' });
export const testAiProvider = (p: ProviderId, model?: string) =>
  apiFetch<{ ok: boolean; message: string }>('/api/ai/test', { method: 'POST', body: JSON.stringify({ provider: p, model }) });

export interface ModelOption { id: string; label: string }

/** The models a provider's key can use (empty with a reason when there's no key or the provider can't be reached). */
export const fetchAiModels = (p: ProviderId) => apiFetch<{ models: ModelOption[]; message: string | null }>(`/api/ai/models/${p}`);

export interface CompareResult {
  provider: string;
  model: string;
  answered: boolean;
  passedChecks: boolean;
  period: { year: number; month: number } | null;
  costLines: number;
  costTotal: number | null;
  problems: number;
  seconds: number;
  inputTokens: number | null;
  outputTokens: number | null;
  error: string | null;
}

export interface Comparison {
  hasText: boolean;
  results: CompareResult[];
  /** Cost lines the providers read differently. Keys are "provider:model"; null = not found by that one. */
  differences: { name: string; amounts: Record<string, number | null> }[];
}

/** Test site only: read one P&L with every provider that has a key. Imports nothing. */
export async function compareProvidersOnPnl(file: File): Promise<Comparison> {
  const fd = new FormData();
  fd.append('file', file);
  const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
  const res = await fetch(`${BASE_URL}/api/ai/compare/pnl-reading`, withSession({ method: 'POST', body: fd }));
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.message ?? 'Couldn’t compare the providers.', res.status, body.code, body);
  return body as Comparison;
}
