import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAiSettings, saveAiCommon, type AiSettings, type CommonAiConfig, type ProviderId, type ProviderStatus } from '../../../api/ai.js';
import LoadingSpinner from '../../../components/common/LoadingSpinner.js';
import { useToast } from '../../../components/common/Toast.js';
import { ProviderCard } from './ProviderCard.js';
import { FeatureCard } from './FeatureCard.js';
import { S, SC } from '../cardStyles.js';
import { useIsTestServer } from '../../../hooks/useIsTestServer.js';
import { GENERAL_TAB, PROVIDERS_TAB, aiTabs, commonProblem, isUsable } from './aiSettingsModel.js';

// Settings → AI, in tabs: General (the default and backup provider, and the
// monthly limit — only providers that can be used), Providers (their API keys
// and default models), then one tab per module with that module's AI features.

const QUERY_KEY = ['ai-settings'];

export default function AiSettingsPage() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: QUERY_KEY, queryFn: fetchAiSettings });
  const [draft, setDraft] = useState<CommonAiConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const isTestServer = useIsTestServer(true); // this page is admins-only

  useEffect(() => { if (data && !draft) setDraft(data.common); }, [data, draft]);
  const update = (next: AiSettings) => {
    qc.setQueryData(QUERY_KEY, next);
    qc.invalidateQueries({ queryKey: ['operating-cost-import-status'] });
  };

  if (isLoading || (data && !draft)) return <div className="m-pad"><LoadingSpinner /></div>;
  if (isError || !data || !draft) {
    return (
      <div className="m-pad">
        <h1>AI</h1>
        <p style={{ color: SC.danger, fontSize: 14 }}>Couldn’t load the AI settings.</p>
        <button type="button" onClick={() => refetch()} style={S.secondary}>Retry</button>
      </div>
    );
  }

  const tabs = aiTabs(data.features);
  const tab = tabs.some(t => t.key === params.get('tab')) ? params.get('tab')! : GENERAL_TAB;
  const goTo = (key: string) => setParams(p => { const n = new URLSearchParams(p); n.set('tab', key); return n; }, { replace: true });
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.common);
  const problem = commonProblem(draft, data.common, data.providers);
  const label = (id: ProviderId | null) => data.providers.find(p => p.id === id)?.label ?? 'none set';

  const save = async () => {
    setSaving(true);
    try {
      const next = await saveAiCommon(draft);
      update(next); setDraft(next.common); showToast('Saved');
    } catch (e) { showToast(e instanceof Error ? e.message : 'Couldn’t save.', 'error'); } finally { setSaving(false); }
  };
  const saveBar = <SaveBar dirty={dirty} problem={problem} saving={saving} onSave={save} />;

  return (
    <div className="m-pad">
      <h1>AI</h1>
      <div role="tablist" aria-label="AI settings" style={s.tabs}>
        {tabs.map(t => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => goTo(t.key)}
            style={{ ...s.tab, ...(tab === t.key ? s.tabOn : null) }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === GENERAL_TAB && (
        <GeneralTab draft={draft} setDraft={setDraft} providers={data.providers} onAddKey={() => goTo(PROVIDERS_TAB)}>{saveBar}</GeneralTab>
      )}

      {tab === PROVIDERS_TAB && (
        <>
          {data.providers.map(p => (
            <ProviderCard key={p.id} provider={p} model={draft.models[p.id] ?? ''} requests={data.usage.byProvider[p.id]?.requests ?? 0}
              onModel={m => setDraft({ ...draft, models: { ...draft.models, [p.id]: m } })} onSaved={update} />
          ))}
          {saveBar}
        </>
      )}

      {tab.startsWith('module:') && data.features.filter(f => `module:${f.category}` === tab).map(f => (
        <FeatureCard key={f.key} feature={f} providers={data.providers} defaultLabel={label(data.common.provider)}
          requests={data.usage.byFeature[f.key]?.requests ?? 0} stats={data.stats.filter(st => st.feature === f.key)}
          isTestServer={isTestServer} onSaved={update} />
      ))}
    </div>
  );
}

/** The provider every feature uses unless it picks its own, the backup, and the monthly limit. */
function GeneralTab({ draft, setDraft, providers, onAddKey, children }: {
  draft: CommonAiConfig; setDraft: (c: CommonAiConfig) => void; providers: ProviderStatus[]; onAddKey: () => void; children: React.ReactNode;
}) {
  const anyUsable = providers.some(isUsable);
  // Only providers that can be used are listed — plus the one already chosen, if its key has since gone.
  const choices = (current: ProviderId | null) => providers.filter(p => isUsable(p) || p.id === current);
  const option = (p: ProviderStatus) => (
    <option key={p.id} value={p.id}>{p.label}{isUsable(p) ? '' : ' — no API key'}</option>
  );
  return (
    <section style={S.card} aria-label="General AI settings">
      {!anyUsable && (
        <p style={{ margin: '0 0 16px', fontSize: 14, color: SC.text }}>
          No provider has an API key yet, so AI can’t be used.{' '}
          <button type="button" onClick={onAddKey} style={s.link}>Add a key in Providers</button>
        </p>
      )}
      <div style={{ ...S.grid, marginTop: 0 }}>
        <label style={S.field}>
          <span style={S.label}>Default provider</span>
          <select value={draft.provider ?? ''} onChange={e => {
            const provider = (e.target.value || null) as ProviderId | null;
            setDraft({ ...draft, provider, backup: draft.backup === provider ? null : draft.backup });
          }} style={{ ...S.input, cursor: 'pointer' }}>
            <option value="">None — AI is off</option>
            {choices(draft.provider).map(option)}
          </select>
          <span style={S.hint}>Every AI feature uses this unless it picks its own.</span>
        </label>
        <label style={S.field}>
          <span style={S.label}>Backup provider</span>
          <select value={draft.backup ?? ''} disabled={!draft.provider} onChange={e => setDraft({ ...draft, backup: (e.target.value || null) as ProviderId | null })}
            style={{ ...S.input, cursor: draft.provider ? 'pointer' : 'default' }}>
            <option value="">None</option>
            {choices(draft.backup).filter(p => p.id !== draft.provider).map(option)}
          </select>
          <span style={S.hint}>Tries when the main one fails, or its answer doesn’t pass a feature’s checks.</span>
        </label>
        <label style={S.field}>
          <span style={S.label}>Monthly limit</span>
          <input type="number" min={1} max={10000} inputMode="numeric" placeholder="No limit" value={draft.monthlyLimit ?? ''}
            onChange={e => setDraft({ ...draft, monthlyLimit: e.target.value === '' ? null : Math.max(1, Math.floor(Number(e.target.value))) })} style={S.input} />
          <span style={S.hint}>Requests per provider per month, across all features. Set a spending limit with the provider too.</span>
        </label>
      </div>
      {children}
    </section>
  );
}

/** Save for the General and Providers tabs (they share one settings record). */
function SaveBar({ dirty, problem, saving, onSave }: { dirty: boolean; problem: string | null; saving: boolean; onSave: () => void }) {
  const off = !dirty || !!problem || saving;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
      {dirty && problem && <span role="status" style={{ fontSize: 13, color: SC.muted, marginRight: 'auto' }}>{problem}</span>}
      <button type="button" onClick={onSave} disabled={off} style={{ ...S.primary, opacity: off ? 0.5 : 1, cursor: off ? 'default' : 'pointer' }}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  // Segmented control (same look as the app's other view switches): a soft track, the active tab a raised white pill.
  tabs: { display: 'inline-flex', flexWrap: 'wrap', gap: 2, padding: 3, marginBottom: 24, background: '#f1f5f9', borderRadius: 10 },
  tab: {
    minHeight: 32, padding: '0 16px', border: 'none', borderRadius: 8, background: 'transparent',
    fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: SC.muted, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  tabOn: { background: '#fff', color: SC.text, boxShadow: '0 1px 2px rgba(15,23,42,0.08)' },
  link: { border: 'none', background: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: SC.primary, cursor: 'pointer' },
};
