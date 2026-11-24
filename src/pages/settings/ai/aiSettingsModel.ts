import type { AiFeatureView, CommonAiConfig, ProviderId, ProviderStatus } from '../../../api/ai.js';

// Settings → AI: which providers can be used, what stops Save, and the tabs.
// Pure, unit-tested. The server applies the same rule on save (ai.controller).

/** A provider can be used once it has a working API key. */
export const isUsable = (p: ProviderStatus) => !!p.keySource && !p.keyUnreadable;

/** Why the General / Providers settings can't be saved yet, or null. `saved` = what's stored now. */
export function commonProblem(draft: CommonAiConfig, saved: CommonAiConfig, providers: ProviderStatus[]): string | null {
  const byId = new Map(providers.map(p => [p.id, p]));
  if (draft.backup && draft.backup === draft.provider) return 'The backup must be a different provider.';
  for (const [p, was] of [[draft.provider, saved.provider], [draft.backup, saved.backup]] as const) {
    const provider = p ? byId.get(p) : undefined;
    if (provider && p !== was && !isUsable(provider)) return `${provider.label} has no API key — add one in the Providers tab first.`;
  }
  const needsModel = (p: ProviderId | null) => !!p && !draft.models[p]?.trim() && !byId.get(p)?.defaultModel;
  if (needsModel(draft.provider) || needsModel(draft.backup)) return 'Enter the default model for each provider you use (Providers tab).';
  return null;
}

export const GENERAL_TAB = 'general';
export const PROVIDERS_TAB = 'providers';

/** General, Providers, then one tab per module that has AI features, in the order they're listed. */
export function aiTabs(features: AiFeatureView[]): { key: string; label: string }[] {
  const modules = [...new Set(features.map(f => f.category))];
  return [{ key: GENERAL_TAB, label: 'General' }, { key: PROVIDERS_TAB, label: 'Providers' }, ...modules.map(m => ({ key: `module:${m}`, label: m }))];
}
