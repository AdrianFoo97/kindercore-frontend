import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faCircleQuestion, faCircleExclamation, faBan, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { ImportCategory, LineStatus, PreviewLine } from '../../../api/pnlImport.js';
import type { Decision } from './importPlan.js';
import { formatMoney } from './format.js';
import { C } from '../operating-costs/shared.js';

// One P&L line on the Import P&L screen: what it is, how it matched, and
// what to do with it. Status always shows an icon + words, never colour alone.

const STATUS: Record<LineStatus, { icon: IconDefinition; label: string; color: string }> = {
  MATCHED: { icon: faCircleCheck, label: 'Matched', color: C.green },
  SUGGESTED: { icon: faCircleQuestion, label: 'Check this match', color: C.amber },
  NEW: { icon: faCircleExclamation, label: 'Not in the system', color: C.amber },
  SKIP_RULE: { icon: faBan, label: 'Skipped by a rule', color: C.muted },
  NEGATIVE: { icon: faBan, label: 'A credit — enter it by hand', color: C.muted },
  NOT_A_COST: { icon: faBan, label: 'Not a cost', color: C.muted },
  ZERO: { icon: faBan, label: 'Nothing spent', color: C.muted },
};

/** The row's element id — the review's “Go to next” scrolls to it. */
export const lineElementId = (key: string) => `pnl-line-${key}`;

/** A→Z, ignoring case (groups and categories in the dropdown). */
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/** How a decision is held in the category dropdown (skipping is its own button). */
const valueOf = (d: Decision) => (d === null || d.kind === 'SKIP' ? '' : d.kind === 'NEW' ? 'new' : `cat:${d.categoryId}`);

export interface LineRowProps {
  line: PreviewLine;
  decision: Decision;
  categories: ImportCategory[];
  groups: { id: string; name: string }[];
  canAddCategory: boolean;
  /** A different amount already entered for the chosen category, if any. */
  existing: number | null;
  replace: boolean;
  /** Amounts are checked against the PDF's text (false for a scanned PDF). */
  hasText: boolean;
  onDecide: (d: Decision) => void;
  onReplace: (on: boolean) => void;
}

export function LineRow({ line, decision, categories, groups, canAddCategory, existing, replace, hasText, onDecide, onReplace }: LineRowProps) {
  const st = STATUS[line.status];
  const suggested = line.status === 'SUGGESTED' && line.categoryId ? categories.find(c => c.id === line.categoryId) : undefined;
  const fixed = line.status === 'NEGATIVE';
  const skipped = decision?.kind === 'SKIP';
  /** Still needs a choice — flagged so it can't be missed. */
  const undecided = decision === null && !fixed;
  const choose = (v: string) => {
    if (v === '') onDecide(null);
    else if (v === 'new') onDecide({ kind: 'NEW', name: line.name, groupId: groups[0]?.id ?? '' });
    else onDecide({ kind: 'RECORD', categoryId: v.slice(4) });
  };
  /** Undo a skip: back to the category it matched, else undecided. */
  const recordInstead = () => onDecide(line.categoryId && categories.some(c => c.id === line.categoryId) ? { kind: 'RECORD', categoryId: line.categoryId } : null);
  const byGroup = [...groups].sort(byName)
    .map(g => ({ ...g, cats: categories.filter(c => c.groupId === g.id).sort(byName) }))
    .filter(g => g.cats.length);

  return (
    <div className="pnl-row" id={lineElementId(line.key)} style={{ ...s.row, ...(undecided ? s.undecided : null) }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{line.name}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 4, fontSize: 12 }}>
          <span style={{ color: st.color, fontWeight: 600 }}><FontAwesomeIcon icon={st.icon} style={{ marginRight: 4 }} />{st.label}</span>
          {undecided && (
            <span style={{ color: '#b45309', fontWeight: 700 }}><FontAwesomeIcon icon={faCircleExclamation} style={{ marginRight: 4 }} />Needs a decision — choose a category or Skip</span>
          )}
          {line.textAmount !== null && (
            <span style={{ color: C.red, fontWeight: 600 }}><FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: 4 }} />The PDF’s text says {formatMoney(line.textAmount)}</span>
          )}
          {hasText && !line.found && (
            <span style={{ color: C.red, fontWeight: 600 }}><FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: 4 }} />Amount not found in the PDF</span>
          )}
        </div>
      </div>

      <div style={s.amount}>{formatMoney(line.amount)}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        {skipped || fixed ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={s.notRecorded}><FontAwesomeIcon icon={faBan} style={{ marginRight: 6 }} />Not recorded</span>
            {!fixed && <button type="button" onClick={recordInstead} style={s.secondary}>Record instead</button>}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <select aria-label={`Category for ${line.name}`} value={valueOf(decision)} onChange={e => choose(e.target.value)}
              style={{ ...s.select, flex: 1, minWidth: 0, borderColor: decision === null ? C.amber : C.border, cursor: 'pointer' }}>
              <option value="" disabled>Choose a category…</option>
              {byGroup.map(g => (
                <optgroup key={g.id} label={g.name}>
                  {g.cats.map(c => <option key={c.id} value={`cat:${c.id}`}>{c.name}</option>)}
                </optgroup>
              ))}
              {canAddCategory && <option value="new">New category…</option>}
            </select>
            <button type="button" onClick={() => onDecide({ kind: 'SKIP' })} aria-label={`Skip ${line.name}`} style={s.secondary}>Skip</button>
          </div>
        )}

        {suggested && decision === null && (
          <button type="button" onClick={() => onDecide({ kind: 'RECORD', categoryId: suggested.id })} style={s.linkBtn}>
            Use “{suggested.name}”
          </button>
        )}

        {decision?.kind === 'NEW' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input aria-label="New category name" value={decision.name} maxLength={191}
              onChange={e => onDecide({ ...decision, name: e.target.value })} style={{ ...s.select, flex: '1 1 140px' }} />
            <select aria-label="Group for the new category" value={decision.groupId}
              onChange={e => onDecide({ ...decision, groupId: e.target.value })} style={{ ...s.select, flex: '1 1 120px', cursor: 'pointer' }}>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        )}

        {existing !== null && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.textSub, cursor: 'pointer' }}>
            <input type="checkbox" checked={replace} onChange={e => onReplace(e.target.checked)} style={{ width: 16, height: 16, accentColor: C.primary }} />
            Replace the {formatMoney(existing)} already entered
          </label>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  row: {
    display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) 120px minmax(0, 1fr)', gap: 16, alignItems: 'start',
    padding: '16px 24px', borderTop: `1px solid ${C.divider}`,
  },
  // Undecided: a light amber wash and a bar on the left (the label says it in words too).
  undecided: { background: '#fffbeb', boxShadow: `inset 3px 0 0 ${C.amber}` },
  amount: { fontSize: 14, fontWeight: 600, color: C.text, textAlign: 'right', fontVariantNumeric: 'tabular-nums', paddingTop: 2 },
  select: {
    minHeight: 34, padding: '0 10px', borderRadius: 7, border: `1px solid ${C.border}`, background: '#fff',
    fontSize: 13, color: C.text, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  },
  secondary: {
    minHeight: 34, padding: '0 12px', borderRadius: 7, border: `1px solid ${C.border}`, background: '#fff', color: C.textSub,
    fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
  },
  notRecorded: {
    display: 'inline-flex', alignItems: 'center', minHeight: 34, padding: '0 12px', borderRadius: 7, background: C.hover,
    color: C.textSub, fontSize: 13, fontWeight: 600,
  },
  linkBtn: { alignSelf: 'flex-start', border: 'none', background: 'none', padding: '4px 0', color: C.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
