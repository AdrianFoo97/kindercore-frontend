import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAiSettings, saveAiCommon, type AiSettings, type CommonAiConfig, type ProviderId } from '../../../api/ai.js';
import LoadingSpinner from '../../../components/common/LoadingSpinner.js';
import { useToast } from '../../../components/common/Toast.js';
import { ProviderCard } from './ProviderCard.js';
import { FeatureCard } from './FeatureCard.js';
import { S, SC } from '../cardStyles.js';
import { useIsTestServer } from '../../../hooks/useIsTestServer.js';

// Settings → AI: one place for everything AI. Providers, keys and the
// defaults are shared by every AI feature; below them, each feature's own
// settings, grouped by the area of the app it belongs to.

const QUERY_KEY = ['ai-settings'];

export default function AiSettingsPage() {
  const qc = useQueryClient();
  const { showToast } = useToast();
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

  const dirty = JSON.stringify(draft) !== JSON.stringify(data.common);
  const needsModel = (p: ProviderId | null) => !!p && !draft.models[p]?.trim() && !data.providers.find(x => x.id === p)?.defaultModel;
  const problem = draft.backup && draft.backup === draft.provider ? 'The backup must be a different provider.'
    : needsModel(draft.provider) || needsModel(draft.backup) ? 'Enter the default model for each provider you use.' : null;
  const label = (id: ProviderId | null) => data.providers.find(p => p.id === id)?.label ?? 'none set';

  const save = async () => {
    setSaving(true);
    try {
      const next = await saveAiCommon(draft);
      update(next); setDraft(next.common); showToast('Saved');
    } catch (e) { showToast(e instanceof Error ? e.message : 'Couldn’t save.', 'error'); } finally { setSaving(false); }
  };

  const categories = [...new Set(data.features.map(f => f.category))];

  return (
    <div className="m-pad">
      <h1>AI</h1>

      <h2 style={{ ...s.section, marginTop: 0 }}>Providers</h2>
      {data.providers.map(p => (
        <ProviderCard key={p.id} provider={p} model={draft.models[p.id] ?? ''} requests={data.usage.byProvider[p.id]?.requests ?? 0}
          onModel={m => setDraft({ ...draft, models: { ...draft.models, [p.id]: m } })} onSaved={update} />
      ))}

      <h2 style={s.section}>Every AI feature</h2>
      <section style={S.card} aria-label="Defaults for every AI feature">
        <div style={{ ...S.grid, marginTop: 0 }}>
          <label style={S.field}>
            <span style={S.label}>Default provider</span>
            <select value={draft.provider ?? ''} onChange={e => {
              const provider = (e.target.value || null) as ProviderId | null;
              setDraft({ ...draft, provider, backup: draft.backup === provider ? null : draft.backup });
            }} style={{ ...S.input, cursor: 'pointer' }}>
              <option value="">None — AI is off</option>
              {data.providers.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <label style={S.field}>
            <span style={S.label}>Backup provider</span>
            <select value={draft.backup ?? ''} disabled={!draft.provider} onChange={e => setDraft({ ...draft, backup: (e.target.value || null) as ProviderId | null })}
              style={{ ...S.input, cursor: draft.provider ? 'pointer' : 'default' }}>
              <option value="">None</option>
              {data.providers.filter(p => p.id !== draft.provider).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
          {problem && <span role="status" style={{ fontSize: 13, color: SC.muted, marginRight: 'auto' }}>{problem}</span>}
          <button type="button" onClick={save} disabled={!dirty || !!problem || saving}
            style={{ ...S.primary, opacity: !dirty || problem || saving ? 0.5 : 1, cursor: !dirty || problem || saving ? 'default' : 'pointer' }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </section>

      {categories.map(cat => (
        <div key={cat}>
          <h2 style={s.section}>{cat}</h2>
          {data.features.filter(f => f.category === cat).map(f => (
            <FeatureCard key={f.key} feature={f} providers={data.providers} defaultLabel={label(data.common.provider)}
              requests={data.usage.byFeature[f.key]?.requests ?? 0} stats={data.stats.filter(s => s.feature === f.key)}
              isTestServer={isTestServer} onSaved={update} />
          ))}
        </div>
      ))}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  section: { margin: '32px 0 12px', fontSize: 12, fontWeight: 700, color: SC.muted, textTransform: 'uppercase', letterSpacing: '0.06em' },
};
