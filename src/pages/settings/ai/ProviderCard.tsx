import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faCircleExclamation, faKey } from '@fortawesome/free-solid-svg-icons';
import { removeAiKey, saveAiKey, testAiProvider, type AiSettings, type ProviderStatus } from '../../../api/ai.js';
import ConfirmDialog from '../../../components/common/ConfirmDialog.js';
import { useToast } from '../../../components/common/Toast.js';
import { S, SC } from '../cardStyles.js';
import { ModelPicker } from './ModelPicker.js';

// Settings → AI → one provider: its key (write-only), its default model,
// Test connection, and how much it was used this month.

export interface ProviderCardProps {
  provider: ProviderStatus;
  /** Its default model as being edited (saved with the settings below). */
  model: string;
  requests: number;
  onModel: (m: string) => void;
  onSaved: (next: AiSettings) => void;
}

export function ProviderCard({ provider: p, model, requests, onModel, onSaved }: ProviderCardProps) {
  const { showToast } = useToast();
  const [editingKey, setEditingKey] = useState(false);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);

  const keyLine = p.keySource === 'env' ? 'Key set on the server (environment)'
    : p.keySource === 'settings' ? `Key saved ···${p.keyHint ?? ''}` : 'No key';
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { showToast(e instanceof Error ? e.message : 'Something went wrong.', 'error'); } finally { setBusy(false); }
  };
  const keyOk = key.trim().length >= 8 && !busy;

  return (
    <section style={S.card} aria-label={p.label}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h3 style={S.cardTitle}>{p.label}</h3>
        <span style={{ fontSize: 12, color: SC.muted }}>This month: {requests} request{requests === 1 ? '' : 's'}</span>
      </div>

      <div style={S.grid}>
        <div style={S.field}>
          <span style={S.label}>Default model</span>
          <ModelPicker label={`${p.label} default model`} provider={p.id} hasKey={!!p.keySource && !p.keyUnreadable} value={model} onChange={onModel}
            emptyLabel={p.defaultModel ? `Default — ${p.defaultModel}` : null} />
        </div>
        <div style={S.field}>
          <span style={S.label}>API key</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: SC.textSub, minHeight: 36 }}>
            <FontAwesomeIcon icon={faKey} style={{ color: SC.muted }} />{keyLine}
          </span>
          {p.keyUnreadable && <span style={{ ...S.hint, color: SC.danger }}>The saved key can’t be read (the server’s secret changed). Enter it again.</span>}
        </div>
      </div>

      {editingKey ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
          <input type="password" autoComplete="off" aria-label={`${p.label} API key`} placeholder="Paste the API key" value={key}
            onChange={e => setKey(e.target.value)} style={{ ...S.input, flex: '1 1 240px', width: 'auto' }} />
          <button type="button" onClick={() => { setEditingKey(false); setKey(''); }} style={S.secondary}>Cancel</button>
          <button type="button" disabled={!keyOk}
            onClick={() => run(async () => { onSaved(await saveAiKey(p.id, key.trim())); setEditingKey(false); setKey(''); setTest(null); showToast('Key saved'); })}
            style={{ ...S.primary, opacity: keyOk ? 1 : 0.5, cursor: keyOk ? 'pointer' : 'default' }}>Save key</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
          {p.keySource !== 'env' && (
            <button type="button" onClick={() => setEditingKey(true)} style={S.secondary}>{p.keySource ? 'Replace key' : 'Add key'}</button>
          )}
          {p.keySource === 'settings' && (
            <button type="button" onClick={() => setConfirmRemove(true)} style={{ ...S.secondary, color: SC.danger }}>Remove key</button>
          )}
          <button type="button" disabled={!p.keySource || busy}
            onClick={() => run(async () => setTest(await testAiProvider(p.id, model.trim() || undefined)))}
            style={{ ...S.secondary, opacity: !p.keySource || busy ? 0.5 : 1, cursor: !p.keySource || busy ? 'default' : 'pointer' }}>
            {busy ? 'Checking…' : 'Test connection'}
          </button>
        </div>
      )}

      {test && (
        <p role="status" style={{ margin: '12px 0 0', fontSize: 13, color: test.ok ? SC.ok : SC.danger }}>
          <FontAwesomeIcon icon={test.ok ? faCircleCheck : faCircleExclamation} style={{ marginRight: 6 }} />{test.message}
        </p>
      )}

      {confirmRemove && (
        <ConfirmDialog title={`Remove the ${p.label} key?`} destructive confirmLabel="Remove" loading={busy}
          message="AI features stop using this provider until a new key is added."
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => run(async () => { onSaved(await removeAiKey(p.id)); setConfirmRemove(false); setTest(null); showToast('Key removed'); })} />
      )}
    </section>
  );
}
