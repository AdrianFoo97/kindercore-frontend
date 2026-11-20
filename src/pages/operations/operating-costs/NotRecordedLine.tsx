import { useState } from 'react';
import { HAS_AMOUNT, recordNotRecordedLine } from '../../../api/pnlImport.js';
import { ApiError } from '../../../api/client.js';
import type { OperatingCostCategory } from '../../../api/operatingCost.js';
import { formatMoney } from '../pnl-import/format.js';
import { C } from './shared.js';

// One line a P&L import didn't record (in the month's "not recorded" pop-up),
// with a Record action: pick a category and save the amount into this month.
// If that category already has an amount, it asks — replace, or add to it.

export interface NotRecordedLineProps {
  importId: string;
  /** Its position in the import's list (sent with the name so the server can be sure it's this line). */
  index: number;
  line: { name: string; amount: number; reason: string };
  categories: OperatingCostCategory[];
  onRecorded: () => void;
  first: boolean;
}

const az = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

export function NotRecordedLine({ importId, index, line, categories, onRecorded, first }: NotRecordedLineProps) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  /** The category already has this amount for the month — waiting for "replace" or "add". */
  const [existing, setExisting] = useState<number | null>(null);
  const chosen = categories.find(c => c.id === categoryId);
  const groups = [...new Set(categories.map(c => c.groupName))].sort(az);

  const record = async (choice?: 'replace' | 'add') => {
    setBusy(true); setProblem('');
    try {
      await recordNotRecordedLine(importId, { index, name: line.name, categoryId, existing: choice, remember });
      onRecorded();
    } catch (e) {
      if (e instanceof ApiError && e.code === HAS_AMOUNT) setExisting(Number(e.body?.existingAmount ?? 0));
      else setProblem(e instanceof Error ? e.message : 'Couldn’t record it.');
    } finally { setBusy(false); }
  };
  const cancel = () => { setOpen(false); setCategoryId(''); setExisting(null); setProblem(''); };

  return (
    <div style={{ padding: '8px 4px', borderTop: first ? 'none' : `1px solid ${C.divider}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ flex: '1 1 auto', minWidth: 0, fontSize: 14, fontWeight: 600, color: C.text }}>
          {line.name} <span style={{ fontSize: 12, fontWeight: 500, color: C.muted }}>· {line.reason}</span>
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatMoney(line.amount)}</span>
        {!open && line.amount >= 0 && (
          <button type="button" onClick={() => setOpen(true)} style={s.link}>Record</button>
        )}
      </div>

      {open && existing === null && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
          <select aria-label={`Category to record ${line.name} in`} value={categoryId} onChange={e => setCategoryId(e.target.value)} style={s.select}>
            <option value="" disabled>Choose a category…</option>
            {groups.map(g => (
              <optgroup key={g} label={g}>
                {categories.filter(c => c.groupName === g).sort((a, b) => az(a.name, b.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textSub, cursor: 'pointer' }}>
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ width: 16, height: 16, accentColor: C.primary }} />
            Remember for next month
          </label>
          <span style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button type="button" onClick={cancel} style={s.secondary}>Cancel</button>
            <button type="button" disabled={!categoryId || busy} onClick={() => void record()}
              style={{ ...s.primary, opacity: !categoryId || busy ? 0.5 : 1, cursor: !categoryId || busy ? 'default' : 'pointer' }}>{busy ? 'Recording…' : 'Record'}</button>
          </span>
        </div>
      )}

      {open && existing !== null && chosen && (
        <div role="alert" style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', fontSize: 13, color: '#78350f' }}>
          {chosen.name} already has {formatMoney(existing)} for this month.
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={cancel} style={s.secondary}>Cancel</button>
            <button type="button" disabled={busy} onClick={() => void record('replace')} style={s.secondary}>Replace with {formatMoney(line.amount)}</button>
            <button type="button" disabled={busy} onClick={() => void record('add')} style={s.primary}>
              Add — {formatMoney(Math.round((existing + line.amount) * 100) / 100)}
            </button>
          </div>
        </div>
      )}

      {problem && <p role="alert" style={{ margin: '8px 0 0', fontSize: 13, color: C.red }}>{problem}</p>}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  link: { border: 'none', background: 'none', padding: 0, minHeight: 28, color: C.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  select: { flex: '1 1 200px', minHeight: 32, padding: '0 8px', borderRadius: 7, border: `1px solid ${C.border}`, background: '#fff', fontSize: 13, color: C.text, fontFamily: 'inherit', cursor: 'pointer' },
  primary: { minHeight: 32, padding: '0 14px', borderRadius: 7, border: 'none', background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' },
  secondary: { minHeight: 32, padding: '0 12px', borderRadius: 7, border: `1px solid ${C.border}`, background: '#fff', color: C.textSub, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' },
};
