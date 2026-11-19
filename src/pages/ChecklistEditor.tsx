import { useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUpRightFromSquare, faCheck, faGripVertical, faLink, faPen, faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { patchSetting } from '../api/settings.js';
import FormModal from '../components/common/FormModal.js';
import { type ChecklistItem, MAX_DESCRIPTION_LENGTH, checklistItemProblem, isExternalLink } from './checklistItems.js';

// Settings → a checklist template (student onboarding, HR's list, a new
// joiner's own list). Each step is text, an optional description (shown on
// hover / tap where it's ticked) and an optional button with a link. Steps
// are added and edited in a pop-up; Save sends the whole list.

const C = {
  text: '#1a1f36', sub: '#3c4257', muted: '#64748b', border: '#e2e8f0', soft: '#f8fafc',
  accent: '#4f5bd5', accentSoft: '#eef2ff', danger: '#b91c1c', ok: '#15803d',
};
/** Index used while adding a step (not a real row). */
const NEW = -1;

export default function ChecklistEditor({ settingKey, initialItems, isAdmin, onSaved }: {
  settingKey: string; initialItems: ChecklistItem[]; isAdmin: boolean; onSaved: () => void;
}) {
  const [items, setItems] = useState<ChecklistItem[]>(initialItems);
  const [editing, setEditing] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragIdx = useRef<number | null>(null);

  const change = (next: ChecklistItem[]) => { setItems(next); setDirty(true); setSaved(false); };
  const commit = (item: ChecklistItem) => {
    change(editing === NEW ? [...items, item] : items.map((it, i) => (i === editing ? item : it)));
    setEditing(null);
  };
  const drop = (target: number) => {
    const from = dragIdx.current;
    setDragOver(null); dragIdx.current = null;
    if (from === null || from === target) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(target, 0, moved);
    change(next);
  };
  const save = async () => {
    setSaving(true); setError('');
    try {
      await patchSetting(settingKey, items as unknown as Record<string, unknown>[]);
      setDirty(false); setSaved(true); onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Couldn’t save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={s.card}>
      {items.length === 0 && <p style={{ margin: 0, fontSize: 13, color: C.muted }}>No steps yet.</p>}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it, idx) => (
          <li key={idx}
            draggable={isAdmin}
            onDragStart={() => { dragIdx.current = idx; }}
            onDragOver={e => { e.preventDefault(); setDragOver(idx); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => drop(idx)}
            style={{ ...s.row, ...(dragOver === idx ? { borderColor: C.accent, background: C.accentSoft } : {}) }}>
            {isAdmin && <FontAwesomeIcon icon={faGripVertical} title="Drag to reorder" style={{ color: C.muted, cursor: 'grab', fontSize: 12, marginTop: 4 }} />}
            <span style={s.num}>{idx + 1}.</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: C.text, lineHeight: 1.45 }}>{it.task}</div>
              {it.description && <div style={s.desc}>{it.description}</div>}
              {it.linkLabel && it.linkUrl && (
                <div style={s.linkLine}>
                  <FontAwesomeIcon icon={faLink} style={{ fontSize: 10 }} />
                  <span style={{ fontWeight: 600, color: C.sub }}>{it.linkLabel}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>→ {it.linkUrl}</span>
                  {isExternalLink(it.linkUrl) && <FontAwesomeIcon icon={faArrowUpRightFromSquare} style={{ fontSize: 9 }} />}
                </div>
              )}
            </div>
            {isAdmin && (
              <>
                <button type="button" onClick={() => setEditing(idx)} aria-label={`Edit “${it.task}”`} title="Edit" style={s.iconBtn}><FontAwesomeIcon icon={faPen} /></button>
                <button type="button" onClick={() => change(items.filter((_, i) => i !== idx))} aria-label={`Remove “${it.task}”`} title="Remove" style={s.iconBtn}><FontAwesomeIcon icon={faXmark} /></button>
              </>
            )}
          </li>
        ))}
      </ol>

      {isAdmin && (
        <>
          <button type="button" onClick={() => setEditing(NEW)} style={s.addBtn}>
            <FontAwesomeIcon icon={faPlus} /> Add step
          </button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            {error && <span role="alert" style={{ fontSize: 13, color: C.danger, marginRight: 'auto' }}>{error}</span>}
            {!error && <span role="status" style={{ fontSize: 13, color: saved ? C.ok : C.muted, marginRight: 'auto' }}>
              {saved ? <><FontAwesomeIcon icon={faCheck} /> Saved</> : dirty ? 'Unsaved changes' : ''}
            </span>}
            <button type="button" onClick={save} disabled={!dirty || saving}
              style={{ ...s.saveBtn, opacity: !dirty || saving ? 0.5 : 1, cursor: !dirty || saving ? 'default' : 'pointer' }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </>
      )}

      {editing !== null && (
        <StepDialog initial={editing === NEW ? { task: '' } : items[editing]} isNew={editing === NEW}
          onCancel={() => setEditing(null)} onDone={commit} />
      )}
    </div>
  );
}

/** Adding or editing one step: its text, an optional description and an optional link button. */
function StepDialog({ initial, isNew, onCancel, onDone }: {
  initial: ChecklistItem; isNew: boolean; onCancel: () => void; onDone: (item: ChecklistItem) => void;
}) {
  const [draft, setDraft] = useState<ChecklistItem>(initial);
  const [showLink, setShowLink] = useState(!!(initial.linkLabel || initial.linkUrl));
  const [touched, setTouched] = useState(false);
  const problem = checklistItemProblem(draft);
  const finish = () => {
    setTouched(true);
    if (problem) return;
    const item: ChecklistItem = { task: draft.task.trim() };
    if (draft.description?.trim()) item.description = draft.description.trim();
    if (draft.linkLabel?.trim() || draft.linkUrl?.trim()) { item.linkLabel = draft.linkLabel!.trim(); item.linkUrl = draft.linkUrl!.trim(); }
    onDone(item);
  };
  const descLength = (draft.description ?? '').trim().length;

  return (
    <FormModal title={isNew ? 'Add step' : 'Edit step'} onClose={onCancel} width={520}
      primary={{ label: isNew ? 'Add step' : 'Done', onClick: finish, disabled: !!problem }}>
      <label style={s.label} htmlFor="step-text">Step</label>
      <input id="step-text" autoFocus value={draft.task} placeholder="e.g. Fill in the EPF form"
        onChange={e => setDraft({ ...draft, task: e.target.value })}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); finish(); } }} style={s.input} />

      <label style={{ ...s.label, marginTop: 16 }} htmlFor="step-desc">Description <span style={s.optional}>(optional)</span></label>
      <textarea id="step-desc" rows={3} value={draft.description ?? ''} placeholder="More detail — shown when someone hovers over the step (taps it on a phone)."
        onChange={e => setDraft({ ...draft, description: e.target.value })}
        style={{ ...s.input, minHeight: 80, padding: '8px 10px', resize: 'vertical' }} />
      <div style={{ fontSize: 12, color: descLength > MAX_DESCRIPTION_LENGTH ? C.danger : C.muted, textAlign: 'right', marginTop: 4 }}>
        {descLength} / {MAX_DESCRIPTION_LENGTH}
      </div>

      {showLink ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={s.label}>Button <span style={s.optional}>(optional)</span></span>
            <button type="button" onClick={() => { setShowLink(false); setDraft({ task: draft.task, description: draft.description }); }} style={s.linkBtn}>Remove button</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
            <input aria-label="Button label" value={draft.linkLabel ?? ''} placeholder="Label, e.g. Open form"
              onChange={e => setDraft({ ...draft, linkLabel: e.target.value })} style={s.input} />
            <input aria-label="Link" value={draft.linkUrl ?? ''} placeholder="https://… or /page-in-the-app"
              onChange={e => setDraft({ ...draft, linkUrl: e.target.value })} onBlur={() => setTouched(true)} style={s.input} />
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.muted }}>Web links open in a new tab; app pages open in place.</p>
        </div>
      ) : (
        <button type="button" onClick={() => setShowLink(true)} style={{ ...s.linkBtn, marginTop: 8 }}>
          <FontAwesomeIcon icon={faLink} /> Add a button with a link
        </button>
      )}

      {touched && problem && draft.task.trim() && <p role="alert" style={{ margin: '12px 0 0', fontSize: 13, color: C.danger }}>{problem}</p>}
    </FormModal>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 },
  row: { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 8px 8px 12px', background: C.soft, border: `1px solid ${C.border}`, borderRadius: 8 },
  num: { fontSize: 12, fontWeight: 700, color: C.muted, width: 22, textAlign: 'right', flexShrink: 0, marginTop: 3 },
  desc: { marginTop: 2, fontSize: 13, color: C.muted, lineHeight: 1.5, whiteSpace: 'pre-wrap' },
  linkLine: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 12, color: C.muted, minWidth: 0 },
  iconBtn: { width: 32, height: 32, border: 'none', borderRadius: 6, background: 'transparent', color: C.muted, cursor: 'pointer', flexShrink: 0 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: 6 },
  optional: { fontWeight: 400, color: C.muted },
  input: { width: '100%', minHeight: 38, padding: '0 10px', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff', color: C.text },
  linkBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, padding: 0, border: 'none', background: 'none', color: C.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  addBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, minHeight: 36, padding: '0 14px', border: `1px dashed ${C.border}`, borderRadius: 8, background: '#fff', color: C.accent, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' },
  saveBtn: { minHeight: 36, padding: '0 18px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' },
};
