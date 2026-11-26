import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ConfirmDialog from '../../components/common/ConfirmDialog.js';
import { useToast } from '../../components/common/Toast.js';
import { copyBranch } from '../../api/planner.js';
import type { BranchOption } from './useBranch.js';
import { copyChoices, type CopyItem } from './copyChoices.js';

// Settings → Classes / Subjects → "Copy to branch…": pick the branch, then
// which of this branch's classes (or subjects) to copy — nothing ticked to
// start, so Copy stays off until at least one is picked.
// Ones the other branch already has (same name) show as "Already there" and
// are left as they are, so copying twice adds nothing.

export type CopyKind = 'classes' | 'subjects';
export type { CopyItem } from './copyChoices.js';

const C = { text: '#0f172a', sub: '#334155', muted: '#64748b', border: '#e2e8f0', divider: '#f1f5f9', accent: '#5a67d8' };
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function CopyBranchDialog({ from, branches, kind, items, allItems, onClose }: {
  from: BranchOption;
  branches: BranchOption[];
  kind: CopyKind;
  /** This branch's classes / subjects. */
  items: CopyItem[];
  /** Every branch's, to tell what the other branch already has. */
  allItems: CopyItem[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const others = branches.filter(b => b.id !== from.id);
  const [to, setTo] = useState(others[0]?.id ?? '');
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [one, many] = kind === 'classes' ? ['class', 'classes'] : ['subject', 'subjects'];

  const { isThere, copyable, picked, allOn, canCopy } = useMemo(() => copyChoices(items, allItems, to, ticked), [items, allItems, to, ticked]);
  const toggle = (id: string) => setTicked(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const copy = useMutation({
    mutationFn: () => copyBranch(from.id, to, kind === 'classes'
      ? { classIds: picked.map(i => i.id), subjectIds: [] }
      : { classIds: [], subjectIds: picked.map(i => i.id) }),
    onSuccess: r => {
      qc.invalidateQueries({ queryKey: ['planner-classrooms'] });
      qc.invalidateQueries({ queryKey: ['planner-subjects'] });
      const added = kind === 'classes' ? r.addedClasses : r.addedSubjects;
      showToast(added ? `Copied ${plural(added, one, many)}` : 'Already all there');
      onClose();
    },
    onError: (e: Error) => showToast(e.message || 'Couldn’t copy', 'error'),
  });

  return (
    <ConfirmDialog
      size="md"
      title={`Copy ${many} to another branch`}
      confirmLabel={picked.length ? `Copy ${plural(picked.length, one, many)}` : 'Copy'}
      loading={copy.isPending} disabled={!canCopy}
      message={
        <>
          <label htmlFor="copy-to" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: 6 }}>Copy to</label>
          <select id="copy-to" value={to} onChange={e => { setTo(e.target.value); setTicked(new Set()); }}
            style={{ width: '100%', minHeight: 36, padding: '6px 10px', fontSize: 14, fontFamily: 'inherit', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff' }}>
            {others.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 6px' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.sub }}>From {from.name}</span>
            {copyable.length > 1 && (
              <button type="button" onClick={() => setTicked(allOn ? new Set() : new Set(copyable.map(i => i.id)))}
                style={{ minHeight: 28, padding: '0 4px', border: 'none', background: 'none', color: C.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {allOn ? 'Select none' : 'Select all'}
              </button>
            )}
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 260, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 10 }}>
            {items.map((i, idx) => {
              const there = isThere(i);
              return (
                <li key={i.id} style={{ borderTop: idx ? `1px solid ${C.divider}` : 'none' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, padding: '0 12px', cursor: there ? 'default' : 'pointer' }}>
                    <input type="checkbox" checked={!there && ticked.has(i.id)} disabled={there} onChange={() => toggle(i.id)}
                      style={{ width: 16, height: 16, accentColor: C.accent, cursor: there ? 'default' : 'pointer' }} />
                    <span style={{ flex: 1, fontSize: 14, color: there ? C.muted : C.text }}>{i.name}</span>
                    {there && <span style={{ fontSize: 12, color: C.muted }}>Already there</span>}
                  </label>
                </li>
              );
            })}
          </ul>
          <p style={{ margin: '12px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
            {kind === 'classes'
              ? 'Each class is copied with its times, days and capacity.'
              : 'Weekly lessons carry over for classes the other branch has with the same name — copy the classes first.'}
          </p>
        </>
      }
      onConfirm={() => copy.mutate()} onCancel={onClose} />
  );
}
