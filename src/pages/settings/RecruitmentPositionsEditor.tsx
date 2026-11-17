import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faXmark, faPlus, faChalkboardUser, faLink } from '@fortawesome/free-solid-svg-icons';
import { fetchPositions } from '../../api/salary.js';
import { patchSetting } from '../../api/settings.js';
import { useToast } from '../../components/common/Toast.js';
import { C, S, DragGrip, RowMenu, useDragReorder } from './recruitmentSettingsUi.js';
import { formName, openingProblem, readOpenings, toStored, type Opening, type PositionLite } from './recruitmentOpenings.js';
import { payRangeLabel } from './payRange.js';

const PAYROLL_PATH = '/settings/hr';
const AMBER = '#b45309';
const SAVED_FLASH_MS = 1500;

/** The row being added (at = null) or edited: which position, and its name on the apply form. */
interface Draft { at: number | null; positionId: string; publicName: string }

/**
 * Settings → Recruitment → Positions: the roles the apply form offers. Each is one of the
 * positions; its name on the form is the position's (or a public name), and its pay range
 * is the one set in Payroll — never typed here.
 */
export default function RecruitmentPositionsEditor({ stored, isAdmin }: { stored: unknown; isAdmin: boolean }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const positionsQ = useQuery({ queryKey: ['salary-positions'], queryFn: fetchPositions });
  const positions: PositionLite[] = (positionsQ.data ?? []).map(p => ({ positionId: p.positionId, name: p.name, payRangeMin: p.payRangeMin ?? null, payRangeMax: p.payRangeMax ?? null }));
  const initial = readOpenings(stored);
  const [items, setItems] = useState<Opening[]>(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const initialKey = JSON.stringify(toStored(initial));
  // Re-seed when the settings refresh (e.g. another list on this page was saved).
  useEffect(() => { setItems(readOpenings(stored)); }, [initialKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(toStored(items)) !== initialKey;
  const reorder = useDragReorder<Opening>(setItems, isAdmin && !draft);
  const problem = draft ? openingProblem(draft, items, positions, draft.at) : null;
  const unlinked = items.filter(o => o.kind === 'unlinked').length;

  const startAdd = () => setDraft({ at: null, positionId: '', publicName: '' });
  const startEdit = (at: number) => {
    const o = items[at];
    // An unlinked one keeps its name as the public name while a position is picked for it.
    setDraft(o.kind === 'linked' ? { at, positionId: o.positionId, publicName: o.publicName } : { at, positionId: '', publicName: o.name });
  };
  const confirm = () => {
    if (!draft || problem) return;
    const next: Opening = { kind: 'linked', positionId: draft.positionId, publicName: draft.publicName };
    setItems(prev => (draft.at == null ? [...prev, next] : prev.map((o, i) => (i === draft.at ? next : o))));
    setDraft(null);
  };
  const remove = (at: number) => { setDraft(null); setItems(prev => prev.filter((_, i) => i !== at)); };
  const save = async () => {
    setSaving(true);
    try {
      await patchSetting('recruitment_positions', toStored(items) as never);
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['candidate-form-options'] });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), SAVED_FLASH_MS);
    } catch (e) {
      showToast((e as Error).message || 'Couldn’t save', 'error');
    }
    setSaving(false);
  };

  const rowFor = (o: Opening, at: number) => (draft && draft.at === at
    ? <DraftRow key={`edit-${at}`} draft={draft} problem={problem} items={items} positions={positions} onChange={setDraft} onConfirm={confirm} onCancel={() => setDraft(null)} />
    : (
      <tr key={`${o.kind === 'linked' ? o.positionId : o.name}-${at}`} className="recruit-row" style={{ height: 52, ...reorder.rowStyle(at) }}
        onDragOver={reorder.onDragOver(at)} onDrop={reorder.onDrop(at)}>
        <td style={S.td}><DragGrip idx={at} enabled={isAdmin && !draft} reorder={reorder} /></td>
        <td style={S.td}><PositionCell o={o} positions={positions} /></td>
        <td style={S.td}><span style={{ fontSize: 14, color: C.text }}>{formName(o, positions)}</span></td>
        <td style={S.td}><RangeCell o={o} positions={positions} /></td>
        <td style={{ ...S.td, textAlign: 'right' }}>
          {isAdmin && <RowMenu renameLabel={o.kind === 'linked' ? 'Edit' : 'Link a position'} onRename={() => startEdit(at)} onDelete={() => remove(at)} />}
        </td>
      </tr>
    ));

  return (
    <section style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={S.cardTitleWrap}>
          <FontAwesomeIcon icon={faChalkboardUser} style={{ color: C.primary, fontSize: 14 }} />
          <h2 style={S.sectionTitle}>Positions</h2>
        </div>
        {isAdmin && (
          <button type="button" onClick={startAdd} disabled={!!draft} style={{ ...S.addBtn, opacity: draft ? 0.5 : 1, cursor: draft ? 'default' : 'pointer' }}>
            <FontAwesomeIcon icon={faPlus} style={{ fontSize: 10 }} /> Add position
          </button>
        )}
      </div>
      <p style={{ ...S.cardDesc, marginBottom: 16 }}>
        Roles candidates can choose from — each is one of your positions. The apply form shows its pay range from <Link to={PAYROLL_PATH} style={{ color: C.primary, fontWeight: 600 }}>Payroll</Link>.
      </p>
      {unlinked > 0 && (
        <p role="status" style={{ margin: '0 0 12px', padding: '10px 12px', borderRadius: 8, background: '#fffbeb', color: AMBER, fontSize: 13, lineHeight: 1.5 }}>
          {unlinked === 1 ? '1 role isn’t' : `${unlinked} roles aren’t`} linked to a position yet, so {unlinked === 1 ? 'it keeps its' : 'they keep their'} old salary band. Use <strong>⋮ → Link a position</strong> to use Payroll’s range.
        </p>
      )}

      <div className="m-scroll-x">
        <table style={{ ...S.table, tableLayout: 'fixed' }} className="recruit-table m-minw">
          <colgroup>
            <col style={{ width: 32 }} />
            <col />
            <col />
            <col style={{ width: 190 }} />
            <col style={{ width: 88 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={S.th} />
              <th style={{ ...S.th, textAlign: 'left' }}>Position</th>
              <th style={{ ...S.th, textAlign: 'left' }}>Name on the apply form</th>
              <th style={{ ...S.th, textAlign: 'left' }}>Pay range</th>
              <th style={S.th} />
            </tr>
          </thead>
          <tbody>
            {items.map(rowFor)}
            {draft && draft.at == null && (
              <DraftRow draft={draft} problem={problem} items={items} positions={positions} onChange={setDraft} onConfirm={confirm} onCancel={() => setDraft(null)} />
            )}
            {items.length === 0 && !draft && (
              <tr><td colSpan={5} style={{ ...S.td, textAlign: 'center', color: C.muted, padding: '32px 0' }}>No positions yet — the apply form uses the default list.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <div style={S.saveRow}>
          <span style={S.dirtyHint}>
            {savedFlash ? <span style={{ color: C.success }}><FontAwesomeIcon icon={faCheck} /> Saved</span> : dirty ? 'Unsaved changes' : 'All changes saved'}
          </span>
          <button type="button" style={S.saveBtn(dirty && !saving && !draft)} disabled={!dirty || saving || !!draft} onClick={save}
            title={draft ? 'Finish the row you’re editing first.' : undefined}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}
    </section>
  );
}

function PositionCell({ o, positions }: { o: Opening; positions: PositionLite[] }) {
  if (o.kind === 'unlinked') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: AMBER }}>
        <FontAwesomeIcon icon={faLink} /> Not linked
      </span>
    );
  }
  const pos = positions.find(p => p.positionId === o.positionId);
  return <span style={{ fontSize: 14, fontWeight: 600, color: pos ? C.text : AMBER }}>{pos?.name ?? 'Position removed'}</span>;
}

function RangeCell({ o, positions }: { o: Opening; positions: PositionLite[] }) {
  if (o.kind === 'unlinked') {
    const old = payRangeLabel(o.minSalary, o.maxSalary);
    return old
      ? <span style={{ display: 'inline-flex', flexDirection: 'column', fontSize: 13, color: C.muted }}><span style={{ whiteSpace: 'nowrap' }}>{old}</span><span style={{ fontSize: 11 }}>Old band</span></span>
      : <span style={{ fontSize: 13, color: C.muted }}>No band</span>;
  }
  const pos = positions.find(p => p.positionId === o.positionId);
  const label = pos ? payRangeLabel(pos.payRangeMin, pos.payRangeMax) : null;
  return label
    ? <span style={{ fontSize: 13, color: C.text }}>{label}</span>
    : <Link to={PAYROLL_PATH} style={{ fontSize: 13, color: C.primary, fontWeight: 600 }}>Set in Payroll</Link>;
}

/** Adding or editing a role: pick the position (a dropdown — there can be many) and, optionally, its public name. */
function DraftRow({ draft, problem, items, positions, onChange, onConfirm, onCancel }: {
  draft: Draft; problem: string | null; items: Opening[]; positions: PositionLite[];
  onChange: (d: Draft) => void; onConfirm: () => void; onCancel: () => void;
}) {
  const taken = new Set(items.filter((o, i) => i !== draft.at && o.kind === 'linked').map(o => (o as { positionId: string }).positionId));
  const picked = positions.find(p => p.positionId === draft.positionId);
  const keys = (e: React.KeyboardEvent) => { if (e.key === 'Enter') onConfirm(); if (e.key === 'Escape') onCancel(); };
  return (
    <tr style={{ height: 52, background: '#f8fafc' }}>
      <td style={S.td} />
      <td style={S.td}>
        <select aria-label="Position" autoFocus value={draft.positionId} onChange={e => onChange({ ...draft, positionId: e.target.value })} onKeyDown={keys} style={{ ...S.cellInput, width: '100%' }}>
          <option value="">Pick a position…</option>
          {positions.map(p => <option key={p.positionId} value={p.positionId} disabled={taken.has(p.positionId)}>{p.name}{taken.has(p.positionId) ? ' (on the list)' : ''}</option>)}
        </select>
      </td>
      <td style={S.td}>
        <input aria-label="Name on the apply form" value={draft.publicName} onChange={e => onChange({ ...draft, publicName: e.target.value })} onKeyDown={keys}
          placeholder={picked ? `Same as position (${picked.name})` : 'Same as position'} style={{ ...S.cellInput, width: '100%' }} />
      </td>
      <td style={S.td}>
        <span style={{ fontSize: 13, color: C.muted }}>{picked ? payRangeLabel(picked.payRangeMin, picked.payRangeMax) ?? 'Not set in Payroll' : '—'}</span>
        {problem && draft.positionId && <div role="alert" style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>{problem}</div>}
      </td>
      <td style={{ ...S.td, textAlign: 'right' }}>
        <div style={{ display: 'inline-flex', gap: 2 }}>
          <button type="button" onClick={onConfirm} disabled={!!problem} title={problem ?? 'Done'} aria-label="Done"
            style={{ ...S.saveIconBtn, opacity: problem ? 0.4 : 1, cursor: problem ? 'default' : 'pointer' }}>
            <FontAwesomeIcon icon={faCheck} style={{ fontSize: 12 }} />
          </button>
          <button type="button" onClick={onCancel} style={S.cancelIconBtn} title="Cancel" aria-label="Cancel">
            <FontAwesomeIcon icon={faXmark} style={{ fontSize: 12 }} />
          </button>
        </div>
      </td>
    </tr>
  );
}
