import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { addImportRule, changeImportRule, deleteImportRule, fetchImportRules, type ImportRule } from '../../../api/pnlImport.js';
import { fetchOperatingCostCategories, type OperatingCostCategory } from '../../../api/operatingCost.js';
import LoadingSpinner from '../../../components/common/LoadingSpinner.js';
import ConfirmDialog from '../../../components/common/ConfirmDialog.js';
import { useToast } from '../../../components/common/Toast.js';
import { S, SC } from '../cardStyles.js';

// Settings → Operating cost → Import rules: what a P&L import does with each
// line name — record into a category, or always skip. Choices remembered
// during an import show up here too.

const QUERY_KEY = ['pnl-import-rules'];
type Choice = { action: 'RECORD' | 'SKIP'; categoryId: string | null };
const valueOf = (c: Choice) => (c.action === 'SKIP' ? 'skip' : c.categoryId ? `cat:${c.categoryId}` : '');
const choiceOf = (v: string): Choice => (v === 'skip' ? { action: 'SKIP', categoryId: null } : { action: 'RECORD', categoryId: v.slice(4) });

function ChoiceSelect({ value, categories, onChange, label }: { value: string; categories: OperatingCostCategory[]; onChange: (v: string) => void; label: string }) {
  const az = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
  const groups = [...new Set(categories.map(c => c.groupName))].sort(az);
  return (
    <select aria-label={label} value={value} onChange={e => onChange(e.target.value)} style={{ ...S.input, cursor: 'pointer' }}>
      <option value="" disabled>Choose…</option>
      <option value="skip">Always skip</option>
      {groups.map(g => (
        <optgroup key={g} label={`Record into — ${g}`}>
          {categories.filter(c => c.groupName === g).sort((a, b) => az(a.name, b.name)).map(c => <option key={c.id} value={`cat:${c.id}`}>{c.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

export default function ImportRulesSettings() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { data: rules, isLoading, isError, refetch } = useQuery({ queryKey: QUERY_KEY, queryFn: fetchImportRules });
  const { data: categories = [] } = useQuery({ queryKey: ['operating-cost-categories'], queryFn: fetchOperatingCostCategories });
  const [name, setName] = useState('');
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<ImportRule | null>(null);

  const run = async (fn: () => Promise<ImportRule[]>, done: string) => {
    setBusy(true);
    try { qc.setQueryData(QUERY_KEY, await fn()); showToast(done); return true; }
    catch (e) { showToast(e instanceof Error ? e.message : 'Something went wrong.', 'error'); return false; }
    finally { setBusy(false); }
  };

  if (isLoading) return <LoadingSpinner />;
  if (isError || !rules) {
    return <div style={S.card}><p style={{ margin: 0, color: SC.danger }}>Couldn’t load the import rules.</p><button type="button" onClick={() => refetch()} style={{ ...S.secondary, marginTop: 12 }}>Retry</button></div>;
  }
  const canAdd = name.trim().length > 0 && choice !== '' && !busy;

  return (
    <div>
      <section style={S.card} aria-label="Add a rule">
        <h2 style={S.cardTitle}>Add a rule</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
          <input aria-label="P&L line name" placeholder="Line name as on the P&L, e.g. Fire Extinguisher" value={name} maxLength={191}
            onChange={e => setName(e.target.value)} style={{ ...S.input, flex: '2 1 240px', width: 'auto' }} />
          <div style={{ flex: '1 1 200px' }}>
            <ChoiceSelect label="What to do with it" value={choice} categories={categories} onChange={setChoice} />
          </div>
          <button type="button" disabled={!canAdd}
            onClick={async () => { if (await run(() => addImportRule({ lineName: name.trim(), ...choiceOf(choice) }), 'Rule added')) { setName(''); setChoice(''); } }}
            style={{ ...S.primary, opacity: canAdd ? 1 : 0.5, cursor: canAdd ? 'pointer' : 'default' }}>Add rule</button>
        </div>
      </section>

      <section style={{ ...S.card, padding: 0, overflow: 'hidden' }} aria-label="Rules">
        {rules.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', fontSize: 14, color: SC.muted }}>
            No rules yet. Choices remembered during an import appear here.
          </div>
        ) : rules.map((r, i) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '12px 24px', borderTop: i ? `1px solid ${SC.divider}` : 'none' }}>
            <span style={{ flex: '1 1 200px', fontSize: 14, fontWeight: 600, color: SC.text, minWidth: 0 }}>{r.lineName}</span>
            <div style={{ flex: '1 1 220px' }}>
              <ChoiceSelect label={`What to do with ${r.lineName}`} value={valueOf(r)} categories={categories}
                onChange={v => void run(() => changeImportRule(r.id, choiceOf(v)), 'Rule updated')} />
            </div>
            <button type="button" onClick={() => setRemoving(r)} aria-label={`Remove the rule for ${r.lineName}`} title="Remove"
              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${SC.border}`, background: '#fff', color: SC.muted, cursor: 'pointer' }}>
              <FontAwesomeIcon icon={faTrash} />
            </button>
          </div>
        ))}
      </section>

      {removing && (
        <ConfirmDialog title={`Remove the rule for “${removing.lineName}”?`} destructive confirmLabel="Remove" loading={busy}
          message="The next import will ask what to do with this line again."
          onCancel={() => setRemoving(null)}
          onConfirm={async () => { if (await run(() => deleteImportRule(removing.id), 'Rule removed')) setRemoving(null); }} />
      )}
    </div>
  );
}
