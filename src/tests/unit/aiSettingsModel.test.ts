import { describe, it, expect } from 'vitest';
import type { AiFeatureView, CommonAiConfig, ProviderStatus } from '../../api/ai';
import { aiTabs, commonProblem, isUsable } from '../../pages/settings/ai/aiSettingsModel';

// Settings → AI: tabs, and only providers that can be used.

const provider = (id: 'anthropic' | 'openai', keySource: 'env' | 'settings' | null, defaultModel: string | null = null): ProviderStatus =>
  ({ id, label: id === 'anthropic' ? 'Anthropic (Claude)' : 'OpenAI', defaultModel, keySource, keyHint: null, keyUnreadable: false });
const common = (over: Partial<CommonAiConfig> = {}): CommonAiConfig => ({ provider: null, backup: null, models: {}, monthlyLimit: null, ...over });

describe('Settings — AI page', () => {
  it('lets only a provider with a working key be newly chosen — one already saved can stay while its key is sorted out', () => {
    const providers = [provider('anthropic', 'settings', 'claude-x'), provider('openai', null)];
    expect(isUsable(providers[0])).toBe(true);
    expect(isUsable({ ...providers[0], keyUnreadable: true })).toBe(false);
    expect(commonProblem(common({ provider: 'openai' }), common(), providers)).toBe('OpenAI has no API key — add one in the Providers tab first.');
    expect(commonProblem(common({ provider: 'openai', models: { openai: 'gpt-x' } }), common({ provider: 'openai' }), providers)).toBeNull();
    expect(commonProblem(common({ provider: 'anthropic', backup: 'anthropic' }), common(), providers)).toBe('The backup must be a different provider.');
    expect(commonProblem(common({ provider: 'anthropic' }), common(), providers)).toBeNull();
  });

  it('shows General, Providers, then one tab per module with AI features', () => {
    const f = (key: string, category: string) => ({ key, category } as AiFeatureView);
    expect(aiTabs([f('a', 'Finance'), f('b', 'HR'), f('c', 'Finance')]).map(t => t.label)).toEqual(['General', 'Providers', 'Finance', 'HR']);
  });
});
