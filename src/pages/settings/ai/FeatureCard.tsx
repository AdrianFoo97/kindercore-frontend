import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faCircleCheck, faCircleExclamation, faCircleMinus } from '@fortawesome/free-solid-svg-icons';
import { saveAiFeature, type AiFeatureView, type AiSettings, type FeatureAiConfig, type ProviderId, type ProviderStat, type ProviderStatus } from '../../../api/ai.js';
import { useToast } from '../../../components/common/Toast.js';
import { S, SC } from '../cardStyles.js';
import { ModelPicker } from './ModelPicker.js';

// Settings → AI → one feature that uses AI: on/off, which provider (the
// default, or its own) and model, its usage — and a link to the feature's
// own, non-AI settings where it has some.

/** Where each feature's own settings live (not AI settings — e.g. P&L import rules). */
const OWN_SETTINGS: Record<string, { label: string; to: string }> = {
  'pnl-reading': { label: 'Import rules', to: '/settings/operating-cost?tab=importRules' },
};

/** Features with a side-by-side provider comparison (test site only). */
const COMPARE_TOOL: Record<string, string> = {
  'pnl-reading': '/settings/ai/compare/pnl-reading',
};

export interface FeatureCardProps {
  feature: AiFeatureView;
  providers: ProviderStatus[];
  defaultLabel: string;
  requests: number;
  /** How each provider + model did for this feature this month. */
  stats: ProviderStat[];
  isTestServer: boolean;
  onSaved: (next: AiSettings) => void;
}

export function FeatureCard({ feature: f, providers, defaultLabel, requests, stats, isTestServer, onSaved }: FeatureCardProps) {
  const { showToast } = useToast();
  const [draft, setDraft] = useState<FeatureAiConfig>(f.config);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(f.config);
  const own = OWN_SETTINGS[f.key];
  const providerLabel = (id: ProviderId | null) => providers.find(p => p.id === id)?.label ?? 'none';

  const status = !f.config.enabled ? { icon: faCircleMinus, text: 'Off', color: SC.muted }
    : f.effective.ready ? { icon: faCircleCheck, text: `Ready — ${providerLabel(f.effective.provider)}, ${f.effective.model}`, color: SC.ok }
    : { icon: faCircleExclamation, text: 'Needs a provider with a key and model', color: SC.danger };

  const save = async () => {
    setSaving(true);
    try {
      const next = await saveAiFeature(f.key, draft);
      onSaved(next);
      setDraft(next.features.find(x => x.key === f.key)?.config ?? draft);
      showToast('Saved');
    } catch (e) { showToast(e instanceof Error ? e.message : 'Couldn’t save.', 'error'); } finally { setSaving(false); }
  };

  return (
    <section style={S.card} aria-label={f.label}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <h3 style={S.cardTitle}>{f.label}</h3>
          <p style={{ ...S.hint, margin: '4px 0 0' }}>{f.description}</p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: SC.textSub, cursor: 'pointer' }}>
          <input type="checkbox" checked={draft.enabled} onChange={e => setDraft({ ...draft, enabled: e.target.checked })}
            style={{ width: 16, height: 16, accentColor: SC.primary, cursor: 'pointer' }} />
          On
        </label>
      </div>

      <p role="status" style={{ margin: '12px 0 0', fontSize: 13, color: status.color }}>
        <FontAwesomeIcon icon={status.icon} style={{ marginRight: 6 }} />{status.text}
        <span style={{ color: SC.muted }}> · this month: {requests} request{requests === 1 ? '' : 's'}</span>
      </p>

      <div style={S.grid}>
        <label style={S.field}>
          <span style={S.label}>Provider</span>
          <select value={draft.provider ?? ''} disabled={!draft.enabled}
            onChange={e => setDraft({ ...draft, provider: (e.target.value || null) as ProviderId | null, model: null })}
            style={{ ...S.input, cursor: draft.enabled ? 'pointer' : 'default' }}>
            <option value="">Default ({defaultLabel})</option>
            {providers.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        {draft.provider && (() => {
          const chosen = providers.find(p => p.id === draft.provider)!;
          return (
            <div style={S.field}>
              <span style={S.label}>Model</span>
              <ModelPicker label={`Model for ${f.label}`} provider={chosen.id} hasKey={!!chosen.keySource && !chosen.keyUnreadable}
                value={draft.model ?? ''} onChange={m => setDraft({ ...draft, model: m || null })} disabled={!draft.enabled}
                emptyLabel={`${chosen.label}’s default model`} />
            </div>
          );
        })()}
      </div>

      {stats.length > 0 && <ProviderRecord stats={stats} providers={providers} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
        {own && (
          <Link to={own.to} style={{ marginRight: 'auto', fontSize: 13, fontWeight: 600, color: SC.primary, textDecoration: 'none' }}>
            {own.label} <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 11 }} />
          </Link>
        )}
        {isTestServer && COMPARE_TOOL[f.key] && (
          <Link to={COMPARE_TOOL[f.key]} style={{ marginRight: own ? undefined : 'auto', fontSize: 13, fontWeight: 600, color: SC.primary, textDecoration: 'none' }}>
            Compare providers (test site) <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 11 }} />
          </Link>
        )}
        <button type="button" onClick={save} disabled={!dirty || saving}
          style={{ ...S.primary, opacity: !dirty || saving ? 0.5 : 1, cursor: !dirty || saving ? 'default' : 'pointer' }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </section>
  );
}

/** How each provider + model did for this feature this month (starts again on the 1st) — the evidence for choosing one. */
function ProviderRecord({ stats, providers }: { stats: ProviderStat[]; providers: ProviderStatus[] }) {
  const label = (id: string) => providers.find(p => p.id === id)?.label ?? id;
  const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '—');
  return (
    <div style={{ marginTop: 16, overflowX: 'auto' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: SC.muted, marginBottom: 4 }}>This month</div>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
        <thead>
          <tr>
            {['Provider', 'Requests', 'Passed the checks', 'Tokens in / out'].map((h, i) => (
              <th key={h} style={{ textAlign: i ? 'right' : 'left', padding: '6px 8px', fontSize: 12, fontWeight: 600, color: SC.muted, borderBottom: `1px solid ${SC.border}`, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...stats].sort((a, b) => b.requests - a.requests).map(r => (
            <tr key={`${r.provider}:${r.model}`}>
              <td style={{ padding: '6px 8px', color: SC.text }}>{label(r.provider)} <span style={{ color: SC.muted }}>({r.model})</span></td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.requests}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.passed} · {pct(r.passed, r.requests)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(r.inputTokens ?? 0).toLocaleString()} / {(r.outputTokens ?? 0).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
