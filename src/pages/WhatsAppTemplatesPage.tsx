import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSettings, patchSetting } from '../api/settings.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faPen, faPlus, faTrash, faXmark, faArrowLeft, faLock, faMessage, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { useIsMobile } from '../hooks/useIsMobile.js';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CustomTemplate {
  id: string;
  name: string;
  content_en: string;
  content_zh: string;
}

interface SystemTemplate {
  id: 'enquiry' | 'follow_up' | 'confirm_appointment';
  name: string;
  settingKey_en: string;
  settingKey_zh: string;
}

const SYSTEM_TEMPLATES: SystemTemplate[] = [
  { id: 'enquiry', name: 'Enquiry', settingKey_en: 'whatsapp_template', settingKey_zh: 'whatsapp_template_zh' },
  { id: 'follow_up', name: 'Follow Up', settingKey_en: 'whatsapp_followup_template', settingKey_zh: 'whatsapp_followup_template_zh' },
  { id: 'confirm_appointment', name: 'Confirm Appointment', settingKey_en: 'whatsapp_confirm_appt_template', settingKey_zh: 'whatsapp_confirm_appt_template_zh' },
];

const VARIABLE_GROUPS = [
  { label: 'Contact', items: [
    { label: 'Child Name', value: '{{childName}}' },
    { label: 'Relationship', value: '{{relationship}}' },
  ]},
  { label: 'Appointment', items: [
    { label: 'Day', value: '{{appointmentDay}}' },
    { label: 'Date', value: '{{appointmentDate}}' },
    { label: 'Start Time', value: '{{appointmentTime}}' },
    { label: 'End Time', value: '{{appointmentEndTime}}' },
  ]},
  { label: 'Location', items: [
    { label: 'Address', value: '{{address}}' },
  ]},
];

const CUSTOM_TEMPLATES_KEY = 'whatsapp_custom_templates';

// ── Template Editor ────────────────────────────────────────────────────────────

function TemplateEditor({ name, contentEn, contentZh, isSystem, isAdmin, onSave, onCancel, saving }: {
  name: string;
  contentEn: string;
  contentZh: string;
  isSystem: boolean;
  isAdmin: boolean;
  onSave: (name: string, en: string, zh: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [draftName, setDraftName] = useState(name);
  const [draftEn, setDraftEn] = useState(contentEn);
  const [draftZh, setDraftZh] = useState(contentZh);
  const [lang, setLang] = useState<'en' | 'zh'>('zh');
  const taRef = useRef<HTMLTextAreaElement>(null);

  const insertPlaceholder = (placeholder: string) => {
    const ta = taRef.current;
    if (!ta) return;
    ta.focus();
    const inserted = document.execCommand('insertText', false, placeholder);
    if (!inserted) {
      const start = ta.selectionStart ?? 0;
      const end = ta.selectionEnd ?? 0;
      const current = lang === 'en' ? draftEn : draftZh;
      const next = current.slice(0, start) + placeholder + current.slice(end);
      if (lang === 'en') setDraftEn(next); else setDraftZh(next);
      requestAnimationFrame(() => ta.setSelectionRange(start + placeholder.length, start + placeholder.length));
    }
  };

  const chipStyle: React.CSSProperties = {
    padding: '3px 10px', background: '#fff', border: '1px solid #e2e8f0',
    borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 500, color: '#475569',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={s.editorCard}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <button onClick={onCancel} style={s.backBtn}>
          <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: 6 }} /> Back to templates
        </button>
      </div>

      {/* ── Template info ── */}
      <div style={{ marginBottom: 24 }}>
        {isSystem ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{draftName}</h2>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '3px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
              <FontAwesomeIcon icon={faLock} style={{ fontSize: 8 }} /> System
            </span>
          </div>
        ) : (
          <div>
            <label style={s.fieldLabel}>Template Name</label>
            <input style={s.input} value={draftName} onChange={e => setDraftName(e.target.value)} placeholder="e.g. Visit Reminder" disabled={!isAdmin} />
          </div>
        )}
      </div>

      {/* ── Variables section ── */}
      {isAdmin && (
        <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase' as const, marginBottom: 10 }}>
            Click to insert variable
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            {VARIABLE_GROUPS.map(group => (
              <div key={group.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', minWidth: 72, flexShrink: 0 }}>{group.label}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5 }}>
                  {group.items.map(p => (
                    <button key={p.value} onClick={() => insertPlaceholder(p.value)} style={chipStyle}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Editor section ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#475569', letterSpacing: '0.03em', textTransform: 'uppercase' as const }}>Message Template</span>
          <div style={{ display: 'inline-flex', borderRadius: 6, background: '#f1f5f9', padding: 2 }}>
            {(['en', 'zh'] as const).map(t => (
              <button key={t} onClick={() => setLang(t)} style={{
                padding: '3px 14px', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer', lineHeight: '18px',
                border: 'none', background: lang === t ? '#fff' : 'transparent',
                color: lang === t ? '#1e293b' : '#94a3b8',
                boxShadow: lang === t ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}>{t === 'en' ? 'English' : '中文'}</button>
            ))}
          </div>
        </div>
        <textarea
          ref={taRef}
          style={{ ...s.input, height: 260, resize: 'vertical', lineHeight: 1.75, fontSize: 14, padding: '14px 16px' }}
          value={lang === 'en' ? draftEn : draftZh}
          onChange={e => lang === 'en' ? setDraftEn(e.target.value) : setDraftZh(e.target.value)}
          placeholder={lang === 'en' ? 'Enter English message template...' : 'Enter Chinese message template...'}
          disabled={!isAdmin}
        />
      </div>

      {/* ── Footer ── */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
          <button onClick={onCancel} style={s.cancelBtn}>Cancel</button>
          <button
            onClick={() => onSave(draftName.trim(), draftEn, draftZh)}
            disabled={saving || (!isSystem && !draftName.trim())}
            style={saving ? { ...s.primaryBtn, opacity: 0.6 } : s.primaryBtn}
          >
            <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function WhatsAppTemplatesPage() {
  const { isMobile } = useIsMobile();
  const queryClient = useQueryClient();
  const { data: settings, isLoading, isError } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });

  const raw = localStorage.getItem('user');
  const user = raw ? (JSON.parse(raw) as { role: string }) : null;
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

  // Editing state: null = list view, { type, id } = editing
  const [editing, setEditing] = useState<{ type: 'system' | 'custom'; id: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  // Get custom templates from settings
  const customTemplates: CustomTemplate[] = Array.isArray(settings?.[CUSTOM_TEMPLATES_KEY])
    ? settings[CUSTOM_TEMPLATES_KEY] as CustomTemplate[]
    : [];

  // Get system template content from settings
  const getSystemContent = (st: SystemTemplate) => ({
    en: String(settings?.[st.settingKey_en] ?? ''),
    zh: String(settings?.[st.settingKey_zh] ?? ''),
  });

  // ── Save handlers ──

  const saveSystemTemplate = async (st: SystemTemplate, _name: string, en: string, zh: string) => {
    setSaving(true);
    try {
      await patchSetting(st.settingKey_en, en);
      await patchSetting(st.settingKey_zh, zh);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setEditing(null);
      showToast(`${st.name} template saved`);
    } catch { showToast('Failed to save'); }
    finally { setSaving(false); }
  };

  const saveCustomTemplate = async (id: string | null, name: string, en: string, zh: string) => {
    setSaving(true);
    try {
      let updated: CustomTemplate[];
      if (id) {
        updated = customTemplates.map(t => t.id === id ? { ...t, name, content_en: en, content_zh: zh } : t);
      } else {
        const newId = crypto.randomUUID();
        updated = [...customTemplates, { id: newId, name, content_en: en, content_zh: zh }];
      }
      await patchSetting(CUSTOM_TEMPLATES_KEY, updated as unknown as string[]);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setEditing(null);
      setCreating(false);
      showToast(id ? `${name} updated` : `${name} created`);
    } catch { showToast('Failed to save'); }
    finally { setSaving(false); }
  };

  const deleteCustomTemplate = async (id: string, name: string) => {
    try {
      const updated = customTemplates.filter(t => t.id !== id);
      await patchSetting(CUSTOM_TEMPLATES_KEY, updated as unknown as string[]);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      showToast(`${name} deleted`);
    } catch { showToast('Failed to delete'); }
    finally { setDeleteTarget(null); }
  };

  // ── Loading / Error ──

  if (isLoading) return <p style={s.state}>Loading...</p>;
  if (isError) return <p style={{ ...s.state, color: '#e53e3e' }}>Failed to load settings.</p>;

  // ── Editor View ──

  if (editing) {
    if (editing.type === 'system') {
      const st = SYSTEM_TEMPLATES.find(t => t.id === editing.id)!;
      const content = getSystemContent(st);
      return (
        <div style={{ ...s.page, ...(isMobile ? { padding: '16px 12px' } : {}) }}><div style={{ ...s.inner, ...(isMobile ? { maxWidth: '100%' } : {}) }}>
          <TemplateEditor
            name={st.name} contentEn={content.en} contentZh={content.zh}
            isSystem isAdmin={isAdmin} saving={saving}
            onSave={(_, en, zh) => saveSystemTemplate(st, st.name, en, zh)}
            onCancel={() => setEditing(null)}
          />
        </div></div>
      );
    }
    const ct = customTemplates.find(t => t.id === editing.id);
    if (!ct) { setEditing(null); return null; }
    return (
      <div style={{ ...s.page, ...(isMobile ? { padding: '16px 12px' } : {}) }}><div style={{ ...s.inner, ...(isMobile ? { maxWidth: '100%' } : {}) }}>
        <TemplateEditor
          name={ct.name} contentEn={ct.content_en} contentZh={ct.content_zh}
          isSystem={false} isAdmin={isAdmin} saving={saving}
          onSave={(name, en, zh) => saveCustomTemplate(ct.id, name, en, zh)}
          onCancel={() => setEditing(null)}
        />
      </div></div>
    );
  }

  if (creating) {
    return (
      <div style={{ ...s.page, ...(isMobile ? { padding: '16px 12px' } : {}) }}><div style={{ ...s.inner, ...(isMobile ? { maxWidth: '100%' } : {}) }}>
        <TemplateEditor
          name="" contentEn="" contentZh=""
          isSystem={false} isAdmin={isAdmin} saving={saving}
          onSave={(name, en, zh) => saveCustomTemplate(null, name, en, zh)}
          onCancel={() => setCreating(false)}
        />
      </div></div>
    );
  }

  // ── List View ──

  // Build unified list for search/filter
  type ListItem = { id: string; name: string; type: 'system' | 'custom'; content_en: string; content_zh: string };
  const allTemplates: ListItem[] = [
    ...SYSTEM_TEMPLATES.map(st => { const c = getSystemContent(st); return { id: st.id, name: st.name, type: 'system' as const, content_en: c.en, content_zh: c.zh }; }),
    ...customTemplates.map(ct => ({ id: ct.id, name: ct.name, type: 'custom' as const, content_en: ct.content_en, content_zh: ct.content_zh })),
  ];

  const q = search.trim().toLowerCase();
  const filtered = q ? (() => {
    const nameMatches: ListItem[] = [];
    const contentMatches: ListItem[] = [];
    for (const t of allTemplates) {
      if (t.name.toLowerCase().includes(q)) nameMatches.push(t);
      else if (t.content_en.toLowerCase().includes(q) || t.content_zh.toLowerCase().includes(q)) contentMatches.push(t);
    }
    return [...nameMatches, ...contentMatches];
  })() : allTemplates;

  const langPill = (has: boolean, label: string) => (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 4, background: has ? '#f0fdf4' : '#f8fafc', color: has ? '#16a34a' : '#cbd5e0', border: `1px solid ${has ? '#bbf7d0' : '#e2e8f0'}` }}>{label} {has ? '✓' : '—'}</span>
  );

  return (
    <div style={{ ...s.page, ...(isMobile ? { padding: '16px 12px' } : {}) }}>
      <div style={{ ...s.inner, ...(isMobile ? { maxWidth: '100%' } : {}) }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={s.heading}>Message Templates</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#8893a7' }}>Manage message templates used when contacting leads.</p>
          </div>
          {isAdmin && (
            <button onClick={() => setCreating(true)} style={s.addBtn}>
              <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} /> New Template
            </button>
          )}
        </div>

        {!isAdmin && (
          <p style={{ color: '#718096', fontSize: 13, marginBottom: 16 }}>You have read-only access. Admin role required to edit templates.</p>
        )}

        {/* Search */}
        {(
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 13 }} />
            <input
              style={s.searchInput}
              placeholder="Search by name or message content..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 12, padding: 2 }}>
                <FontAwesomeIcon icon={faXmark} />
              </button>
            )}
          </div>
        )}

        {/* Template table */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 11, fontWeight: 600, color: '#8893a7', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>
            <span>Template {q && <span style={{ fontWeight: 400, textTransform: 'none' as const, color: '#b0b8c9' }}>({filtered.length} of {allTemplates.length})</span>}</span>
          </div>

          {/* Template rows */}
          {filtered.map(t => {
            const preview = t.content_en || t.content_zh || '';
            const isSystem = t.type === 'system';
            return (
              <div key={t.id} style={s.row}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                    <FontAwesomeIcon icon={faMessage} style={{ color: '#94a3b8', fontSize: 12 }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{t.name}</span>
                    <span style={isSystem ? s.systemBadge : s.customBadge}>{isSystem ? 'System' : 'Custom'}</span>
                  </div>
                  {preview && <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{preview.length > 80 ? preview.slice(0, 80) + '...' : preview}</p>}
                </div>
                <div style={{ display: 'flex', gap: 4, alignSelf: 'center' }}>
                  {langPill(!!t.content_en, 'EN')}
                  {langPill(!!t.content_zh, '中文')}
                </div>
                <div style={{ display: 'flex', gap: 4, alignSelf: 'center' }}>
                  <button onClick={() => setEditing({ type: t.type, id: t.id })} style={s.editBtn}>
                    <FontAwesomeIcon icon={faPen} style={{ marginRight: 5 }} /> Edit
                  </button>
                  {!isSystem && isAdmin && (
                    <button onClick={() => setDeleteTarget({ id: t.id, name: t.name })} style={s.deleteBtn} title="Delete">
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Empty states */}
          {filtered.length === 0 && q && (
            <div style={{ padding: '24px 18px', textAlign: 'center' as const, color: '#94a3b8', fontSize: 13 }}>
              No templates matching "{search.trim()}"
            </div>
          )}
        </div>

      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div style={s.backdrop} onClick={() => setDeleteTarget(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Delete Template</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b' }}>
              Are you sure you want to delete <strong>"{deleteTarget.name}"</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteTarget(null)} style={s.cancelBtn}>Cancel</button>
              <button onClick={() => deleteCustomTemplate(deleteTarget.id, deleteTarget.name)} style={s.deletePrimaryBtn}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={s.toast}>
          <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} /> {toast}
        </div>
      )}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: { padding: '32px 24px', fontFamily: 'system-ui, sans-serif', display: 'flex', justifyContent: 'center' },
  inner: { width: '100%', maxWidth: 680 },
  heading: { margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' },
  state: { padding: 32, fontSize: 16, color: '#4a5568' },
  searchInput: {
    width: '100%', padding: '9px 32px 9px 36px', border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const, color: '#1e293b',
    background: '#fff', outline: 'none',
  },

  row: {
    display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'start',
    padding: '14px 18px', borderBottom: '1px solid #f1f5f9',
  },
  systemBadge: { fontSize: 10, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '2px 9px', borderRadius: 20, letterSpacing: '0.03em', whiteSpace: 'nowrap' as const },
  customBadge: { fontSize: 10, fontWeight: 600, color: '#6366f1', background: '#eef2ff', padding: '2px 9px', borderRadius: 20, letterSpacing: '0.03em', whiteSpace: 'nowrap' as const },

  editBtn: {
    background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px',
    cursor: 'pointer', color: '#64748b', fontSize: 12, fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' as const,
  },
  deleteBtn: {
    background: 'none', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 8px',
    cursor: 'pointer', color: '#dc2626', fontSize: 12, flexShrink: 0,
  },
  addBtn: {
    padding: '8px 16px', background: '#5a79c8', color: '#fff', border: 'none',
    borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0,
  },

  // Editor
  editorCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '24px 28px', boxSizing: 'border-box' as const },
  backBtn: {
    background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#64748b', fontWeight: 500, padding: 0,
  },
  fieldLabel: { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' },
  input: {
    display: 'block', width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', color: '#1e293b', lineHeight: 1.5,
  },
  insertBtn: {
    padding: '3px 10px', background: '#f1f5f9', border: '1px solid #e2e8f0',
    borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#475569',
  },
  cancelBtn: {
    padding: '8px 18px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
    cursor: 'pointer', fontSize: 13, color: '#64748b', fontWeight: 500,
  },
  primaryBtn: {
    padding: '8px 20px', background: '#5a79c8', color: '#fff', border: 'none',
    borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    background: '#fff', borderRadius: 12, padding: '24px 28px', width: '100%', maxWidth: 400,
    boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
  },
  deletePrimaryBtn: {
    padding: '8px 20px', background: '#dc2626', color: '#fff', border: 'none',
    borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  toast: {
    position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
    background: '#0f172a', color: '#fff', padding: '10px 24px', borderRadius: 8,
    fontSize: 13, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
  },
};
