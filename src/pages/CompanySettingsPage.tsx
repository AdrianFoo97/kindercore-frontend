import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSettings, patchSetting } from '../api/settings.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faXmark, faCheck, faPlus, faLocationDot, faBuilding, faSitemap } from '@fortawesome/free-solid-svg-icons';
import { CompanyBranch } from '../types/index.js';
import DepartmentsPage from './settings/DepartmentsPage.js';

const C = {
  primary: '#5a67d8', card: '#fff', text: '#1e293b',
  muted: '#94a3b8', border: '#e2e8f0', danger: '#ef4444',
};

// ── Save button ──────────────────────────────────────────────────────────────

function SaveButton({ saving, saved, dirty, onSave, onCancel, error }: {
  saving: boolean; saved: boolean; dirty: boolean; onSave: () => void; onCancel: () => void; error: string;
}) {
  if (!dirty && !error) return null;
  return (
    <>
      {error && <p style={{ color: '#c47272', fontSize: 12, margin: '8px 0 0' }}>{error}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <button onClick={onCancel} disabled={saving} style={st.cancelBtn}>Cancel</button>
        <button onClick={onSave} disabled={saving} style={saved ? st.savedBtn : st.saveBtn}>
          {saving ? 'Saving…' : saved ? <><FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />Saved</> : 'Save Changes'}
        </button>
      </div>
    </>
  );
}

// ── Vision — single value ────────────────────────────────────────────────────

function VisionCard({ value, isAdmin, onSaved }: { value: string; isAdmin: boolean; onSaved: () => void }) {
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const dirty = text.trim() !== value.trim();

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await patchSetting('company_vision', text.trim());
      setSaved(true); onSaved();
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  };
  const reset = () => { setText(value); setError(''); };

  return (
    <div style={st.card}>
      <div style={st.cardHeader}>
        <h2 style={st.cardTitle}>Vision</h2>
        <p style={st.cardSub}>The single long-term goal our company is working toward.</p>
      </div>
      <div style={st.cardBody}>
        <textarea
          style={st.textarea}
          rows={3}
          value={text}
          disabled={!isAdmin}
          onChange={e => { setText(e.target.value); setSaved(false); }}
          placeholder="e.g. To be the most trusted childcare provider in every neighbourhood we serve."
        />
        <SaveButton saving={saving} saved={saved} dirty={dirty} onSave={handleSave} onCancel={reset} error={error} />
      </div>
    </div>
  );
}

// ── Mission / Core Values — multi-value list ────────────────────────────────

function TextListEditor({ title, subtitle, settingKey, items, isAdmin, onSaved, placeholder, itemNoun }: {
  title: string; subtitle: string; settingKey: string; items: string[]; isAdmin: boolean;
  onSaved: () => void; placeholder: string; itemNoun: string;
}) {
  const [list, setList] = useState<string[]>(items);
  const [newItem, setNewItem] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragIdx = useRef<number | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const mark = () => { setDirty(true); setSaved(false); };
  const reset = () => {
    setList(items); setNewItem(''); setEditingIdx(null); setEditingValue('');
    setDirty(false); setError('');
  };

  const handleDragStart = (idx: number) => { dragIdx.current = idx; };
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOver(idx); };
  const handleDrop = (targetIdx: number) => {
    const from = dragIdx.current;
    if (from === null || from === targetIdx) { setDragOver(null); return; }
    setList(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
    dragIdx.current = null; setDragOver(null); mark();
  };

  const addItem = () => {
    const trimmed = newItem.trim();
    if (!trimmed || list.includes(trimmed)) return;
    setList(prev => [...prev, trimmed]);
    setNewItem(''); mark();
  };

  const removeItem = (idx: number) => { setList(prev => prev.filter((_, i) => i !== idx)); mark(); };

  const startEdit = (idx: number) => { setEditingIdx(idx); setEditingValue(list[idx]); };
  const commitEdit = () => {
    if (editingIdx === null) return;
    const trimmed = editingValue.trim();
    if (trimmed) { setList(prev => prev.map((item, i) => i === editingIdx ? trimmed : item)); mark(); }
    setEditingIdx(null); setEditingValue('');
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await patchSetting(settingKey, list);
      setSaved(true); setDirty(false); onSaved();
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div style={st.card}>
      <div style={{ ...st.cardHeader, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={st.cardTitle}>{title}</h2>
          <p style={st.cardSub}>{subtitle}</p>
        </div>
        <span style={{ fontSize: 11, color: '#b0b8c9', flexShrink: 0, marginLeft: 12 }}>{list.length} {list.length === 1 ? itemNoun : `${itemNoun}s`}</span>
      </div>
      <div style={st.cardBody}>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
            <input
              style={{ ...st.textInput, flex: 1 }}
              placeholder={placeholder}
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
            />
            <button onClick={addItem} style={rs.addBtn} disabled={!newItem.trim()}>
              <FontAwesomeIcon icon={faPlus} style={{ marginRight: 5 }} /> Add
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {list.length === 0 && (
            <p style={{ fontSize: 12, color: '#c4c9d4', fontStyle: 'italic', margin: '4px 0' }}>No {itemNoun}s added yet.</p>
          )}
          {list.map((item, idx) => (
            <div
              key={idx}
              draggable={isAdmin && editingIdx !== idx}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragLeave={() => setDragOver(null)}
              style={{
                ...rs.row,
                ...(dragOver === idx ? { borderColor: '#5a79c8', background: '#f0f4fa' } : {}),
                cursor: isAdmin && editingIdx !== idx ? 'grab' : 'default',
              }}
            >
              {isAdmin && <span style={rs.handle}>⠿</span>}
              {editingIdx === idx ? (
                <input
                  autoFocus
                  style={{ ...st.textInput, flex: 1, padding: '2px 7px' }}
                  value={editingValue}
                  onChange={e => setEditingValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditingIdx(null); setEditingValue(''); } }}
                />
              ) : (
                <span style={rs.text}>{item}</span>
              )}
              {isAdmin && editingIdx !== idx && (
                <div style={rs.actions}>
                  <button onClick={() => startEdit(idx)} style={rs.actionBtn} title="Rename"><FontAwesomeIcon icon={faPen} /></button>
                  <button onClick={() => removeItem(idx)} style={{ ...rs.actionBtn, color: '#dca0a0' }} title="Remove"><FontAwesomeIcon icon={faXmark} /></button>
                </div>
              )}
            </div>
          ))}
        </div>

        <SaveButton saving={saving} saved={saved} dirty={dirty} onSave={handleSave} onCancel={reset} error={error} />
      </div>
    </div>
  );
}

// ── Branches — multi-value list, each with a name and an address ───────────

function BranchListEditor({ items, isAdmin, onSaved }: {
  items: CompanyBranch[]; isAdmin: boolean; onSaved: () => void;
}) {
  const [list, setList] = useState<CompanyBranch[]>(items);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragIdx = useRef<number | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');

  const mark = () => { setDirty(true); setSaved(false); };
  const reset = () => {
    setList(items); setNewName(''); setNewAddress(''); setEditingIdx(null);
    setEditName(''); setEditAddress(''); setDirty(false); setError('');
  };

  const handleDragStart = (idx: number) => { dragIdx.current = idx; };
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOver(idx); };
  const handleDrop = (targetIdx: number) => {
    const from = dragIdx.current;
    if (from === null || from === targetIdx) { setDragOver(null); return; }
    setList(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
    dragIdx.current = null; setDragOver(null); mark();
  };

  const addBranch = () => {
    const name = newName.trim();
    const address = newAddress.trim();
    if (!name || !address) return;
    setList(prev => [...prev, { name, address }]);
    setNewName(''); setNewAddress(''); mark();
  };

  const removeBranch = (idx: number) => { setList(prev => prev.filter((_, i) => i !== idx)); mark(); };

  const startEdit = (idx: number) => { setEditingIdx(idx); setEditName(list[idx].name); setEditAddress(list[idx].address); };
  const commitEdit = () => {
    if (editingIdx === null) return;
    const name = editName.trim();
    const address = editAddress.trim();
    if (name && address) {
      setList(prev => prev.map((b, i) => i === editingIdx ? { name, address } : b));
      mark();
    }
    setEditingIdx(null); setEditName(''); setEditAddress('');
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await patchSetting('company_branches', list as unknown as Record<string, unknown>[]);
      setSaved(true); setDirty(false); onSaved();
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div style={st.card}>
      <div style={{ ...st.cardHeader, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={st.cardTitle}>Branches</h2>
          <p style={st.cardSub}>Physical locations, each with an address.</p>
        </div>
        <span style={{ fontSize: 11, color: '#b0b8c9', flexShrink: 0, marginLeft: 12 }}>{list.length} {list.length === 1 ? 'branch' : 'branches'}</span>
      </div>
      <div style={st.cardBody}>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
            <input
              style={{ ...st.textInput, flex: 1 }}
              placeholder="Branch name…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addBranch()}
            />
            <input
              style={{ ...st.textInput, flex: 2 }}
              placeholder="Address…"
              value={newAddress}
              onChange={e => setNewAddress(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addBranch()}
            />
            <button onClick={addBranch} style={rs.addBtn} disabled={!newName.trim() || !newAddress.trim()}>
              <FontAwesomeIcon icon={faPlus} style={{ marginRight: 5 }} /> Add
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {list.length === 0 && (
            <p style={{ fontSize: 12, color: '#c4c9d4', fontStyle: 'italic', margin: '4px 0' }}>No branches added yet.</p>
          )}
          {list.map((branch, idx) => (
            <div
              key={idx}
              draggable={isAdmin && editingIdx !== idx}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragLeave={() => setDragOver(null)}
              style={{
                ...rs.row, minHeight: 44,
                ...(dragOver === idx ? { borderColor: '#5a79c8', background: '#f0f4fa' } : {}),
                cursor: isAdmin && editingIdx !== idx ? 'grab' : 'default',
              }}
            >
              {isAdmin && <span style={rs.handle}>⠿</span>}
              {editingIdx === idx ? (
                <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                  <input
                    autoFocus
                    style={{ ...st.textInput, flex: 1, padding: '2px 7px' }}
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditingIdx(null); setEditName(''); setEditAddress(''); } }}
                    placeholder="Branch name…"
                  />
                  <input
                    style={{ ...st.textInput, flex: 2, padding: '2px 7px' }}
                    value={editAddress}
                    onChange={e => setEditAddress(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditingIdx(null); setEditName(''); setEditAddress(''); } }}
                    placeholder="Address…"
                  />
                </div>
              ) : (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{branch.name}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
                    <FontAwesomeIcon icon={faLocationDot} style={{ fontSize: 10 }} />
                    {branch.address}
                  </div>
                </div>
              )}
              {isAdmin && editingIdx !== idx && (
                <div style={rs.actions}>
                  <button onClick={() => startEdit(idx)} style={rs.actionBtn} title="Edit"><FontAwesomeIcon icon={faPen} /></button>
                  <button onClick={() => removeBranch(idx)} style={{ ...rs.actionBtn, color: '#dca0a0' }} title="Remove"><FontAwesomeIcon icon={faXmark} /></button>
                </div>
              )}
            </div>
          ))}
        </div>

        <SaveButton saving={saving} saved={saved} dirty={dirty} onSave={handleSave} onCancel={reset} error={error} />
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

type TabKey = 'info' | 'branches' | 'departments';

// Branches and Departments have no page-level subtitle — their own card
// header / internal description already says it, so a subtitle here
// would just duplicate it.
const TABS: { key: TabKey; label: string; icon: any; subtitle: string }[] = [
  { key: 'info', label: 'Company', icon: faBuilding, subtitle: 'Vision, mission, and core values — set once, referenced across the app.' },
  { key: 'branches', label: 'Branches', icon: faLocationDot, subtitle: '' },
  { key: 'departments', label: 'Departments', icon: faSitemap, subtitle: '' },
];

export default function CompanySettingsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>('info');
  const active = TABS.find(t => t.key === tab)!;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  const raw = localStorage.getItem('user');
  const user = raw ? (JSON.parse(raw) as { role: string }) : null;
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

  if (isLoading) return <p style={{ padding: 32, fontSize: 16, color: '#4a5568' }}>Loading settings…</p>;
  if (isError) return <p style={{ padding: 32, fontSize: 16, color: '#c47272' }}>Failed to load settings.</p>;

  const vision = typeof data?.company_vision === 'string' ? data.company_vision : '';
  const missions: string[] = Array.isArray(data?.company_missions) ? data.company_missions as string[] : [];
  const coreValues: string[] = Array.isArray(data?.company_core_values) ? data.company_core_values as string[] : [];
  const branches: CompanyBranch[] = Array.isArray(data?.company_branches) ? data.company_branches as CompanyBranch[] : [];
  const onSaved = () => queryClient.invalidateQueries({ queryKey: ['settings'] });

  return (
    <div style={st.page}>
      <style>{`.company-settings-tab:hover { color: ${C.text} !important; background: #f1f5f9 !important; }`}</style>
      <div style={st.inner}>
        <h1 style={st.heading}>{active.label}</h1>
        {active.subtitle && <p style={st.subtitle}>{active.subtitle}</p>}
        {!isAdmin && (
          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 6 }}>Read-only access. Admin role required to save changes.</p>
        )}

        <div style={st.tabStrip}>
          {TABS.map(t => (
            <button
              key={t.key}
              className="company-settings-tab"
              onClick={() => setTab(t.key)}
              style={{ ...st.tabBtn, ...(tab === t.key ? st.tabBtnActive : {}) }}
            >
              <FontAwesomeIcon icon={t.icon} style={{ fontSize: 12, width: 14 }} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'info' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <VisionCard value={vision} isAdmin={isAdmin} onSaved={onSaved} />
            <TextListEditor
              title="Mission" subtitle="The concrete commitments that support our vision."
              settingKey="company_missions" items={missions} isAdmin={isAdmin} onSaved={onSaved}
              placeholder="Add a mission statement…" itemNoun="mission"
            />
            <TextListEditor
              title="Core Values" subtitle="The principles that guide how we work."
              settingKey="company_core_values" items={coreValues} isAdmin={isAdmin} onSaved={onSaved}
              placeholder="Add a core value…" itemNoun="core value"
            />
          </div>
        )}

        {tab === 'branches' && (
          <BranchListEditor items={branches} isAdmin={isAdmin} onSaved={onSaved} />
        )}

        {tab === 'departments' && <DepartmentsPage />}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: C.text },
  inner: { maxWidth: 960, margin: '0 auto' },
  heading: { fontSize: 22, fontWeight: 800, color: C.text, margin: '4px 0 0' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#94a3b8' },
  tabStrip: { display: 'flex', flexWrap: 'wrap' as const, gap: 2, borderBottom: `1px solid ${C.border}`, margin: '20px 0 20px' },
  tabBtn: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500,
    color: C.muted, background: 'none', border: 'none', borderBottom: '2px solid transparent', borderRadius: '8px 8px 0 0',
    cursor: 'pointer', whiteSpace: 'nowrap' as const, fontFamily: 'inherit', transition: 'all 0.1s', marginBottom: -1,
  },
  tabBtnActive: { color: C.primary, fontWeight: 600, borderBottom: `2px solid ${C.primary}` },

  // Card
  card: {
    background: '#fff', border: '1px solid #eef0f4', borderRadius: 14, overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)',
  },
  cardHeader: {
    padding: '14px 20px', borderBottom: '1px solid #f1f3f5',
  },
  cardTitle: { margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' },
  cardSub: { margin: '3px 0 0', fontSize: 12, color: '#94a3b8' },
  cardBody: { padding: '16px 20px' },

  // Inputs
  textarea: {
    width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 6,
    fontSize: 13, fontFamily: 'inherit', color: '#1e293b', background: '#fff',
    outline: 'none', boxSizing: 'border-box' as const, resize: 'vertical' as const, lineHeight: 1.5,
  },
  textInput: {
    padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6,
    fontSize: 13, fontFamily: 'inherit', color: '#1e293b', background: '#fff',
    outline: 'none', width: '100%', boxSizing: 'border-box' as const,
  },

  // Save
  cancelBtn: {
    padding: '7px 16px', background: '#fff', color: '#64748b', border: '1px solid #e2e8f0',
    borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500,
  },
  saveBtn: {
    padding: '7px 20px', background: '#5a67d8', color: '#fff', border: 'none',
    borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  savedBtn: {
    padding: '7px 20px', background: '#5b9a6f', color: '#fff', border: 'none',
    borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
};

const rs: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 8px', background: '#fff',
    borderRadius: 5, border: '1px solid #eef0f3',
    minHeight: 32,
  },
  handle: { color: '#d4d4d8', fontSize: 12, cursor: 'grab', userSelect: 'none' as const, flexShrink: 0, width: 12, textAlign: 'center' as const },
  text: { flex: 1, fontSize: 13, color: '#334155' },
  actions: { display: 'flex', gap: 4, flexShrink: 0, marginLeft: 'auto' },
  actionBtn: {
    background: 'none', border: 'none', cursor: 'pointer', color: '#d4d4d8',
    fontSize: 12, padding: '2px 4px', lineHeight: 1, borderRadius: 3,
  },
  addBtn: {
    padding: '7px 14px', background: '#fff', border: '1px solid #e2e8f0',
    borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#475569',
    whiteSpace: 'nowrap' as const, flexShrink: 0,
  },
};
