import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSettings, patchSetting } from '../api/settings.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faPen, faPlus, faTrash, faXmark, faArrowLeft, faLock, faMessage, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { useIsMobile } from '../hooks/useIsMobile.js';
import LoadingSpinner from '../components/common/LoadingSpinner.js';
import DeleteDialog from '../components/common/DeleteDialog.js';
import { BUILT_IN_TEMPLATES, TEMPLATE_GROUPS, groupLabel, templateGroupOf, type TemplateGroupKey } from './messageTemplateGroups.js';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CustomTemplate {
  id: string;
  name: string;
  /** Who can use it: COMMON (everyone), MARKETING or HR (that module only). Missing = Common. */
  group?: TemplateGroupKey;
  content_en: string;
  content_zh: string;
}

type VariableGroup = { label: string; items: { label: string; value: string }[] };

interface SystemTemplate {
  id: 'enquiry' | 'follow_up' | 'confirm_appointment' | 'interview_invite' | 'interview_confirm' | 'offer_letter';
  name: string;
  settingKey_en: string;
  settingKey_zh: string;
  /** Placeholder inserts shown to admins editing this template. Each
   *  system template speaks to a different pipeline (enquiry vs
   *  recruitment) with a different set of resolved tokens, so we scope
   *  the "click to insert" chips per-template rather than one shared
   *  set that would show tokens that don't work in this context. */
  variables: VariableGroup[];
}

// ── Placeholder sets ──────────────────────────────────────────────────
// LEADS_VARIABLES → resolved by leads-side code (child, appointment, kg)
// RECRUITMENT_VARIABLES → resolved by CandidatesPage template resolvers
const LEADS_VARIABLES: VariableGroup[] = [
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
const INTERVIEW_VARIABLES: VariableGroup[] = [
  { label: 'Candidate', items: [
    { label: 'First Name', value: '{{firstName}}' },
    { label: 'Full Name', value: '{{candidateName}}' },
    { label: 'Position', value: '{{position}}' },
  ]},
  { label: 'Interview', items: [
    { label: 'Day', value: '{{interviewDay}}' },
    { label: 'Date', value: '{{interviewDate}}' },
    { label: 'Start Time', value: '{{interviewTime}}' },
    { label: 'End Time', value: '{{interviewEndTime}}' },
    // Today + N calendar days, N is the
    // `recruitment_interview_confirm_lead_days` setting under
    // Recruitment settings. Resolved at message-compose time.
    { label: 'Confirm By Date', value: '{{confirmByDate}}' },
  ]},
];
const OFFER_VARIABLES: VariableGroup[] = [
  { label: 'Candidate', items: [
    { label: 'First Name', value: '{{firstName}}' },
    { label: 'Full Name', value: '{{candidateName}}' },
    { label: 'Position', value: '{{position}}' },
  ]},
  { label: 'Offer', items: [
    { label: 'Start Date', value: '{{startDate}}' },
    { label: 'Salary', value: '{{salary}}' },
  ]},
];

const SYSTEM_TEMPLATES: SystemTemplate[] = [
  { id: 'enquiry',             name: 'Enquiry',              settingKey_en: 'whatsapp_template',                 settingKey_zh: 'whatsapp_template_zh',                 variables: LEADS_VARIABLES },
  { id: 'follow_up',           name: 'Follow Up',            settingKey_en: 'whatsapp_followup_template',        settingKey_zh: 'whatsapp_followup_template_zh',        variables: LEADS_VARIABLES },
  { id: 'confirm_appointment', name: 'Confirm Appointment',  settingKey_en: 'whatsapp_confirm_appt_template',    settingKey_zh: 'whatsapp_confirm_appt_template_zh',    variables: LEADS_VARIABLES },
  { id: 'interview_invite',    name: 'Interview Invitation', settingKey_en: 'interview_wa_template',             settingKey_zh: 'interview_wa_template_zh',             variables: INTERVIEW_VARIABLES },
  { id: 'interview_confirm',   name: 'Interview Confirmation', settingKey_en: 'interview_confirm_wa_template',    settingKey_zh: 'interview_confirm_wa_template_zh',    variables: INTERVIEW_VARIABLES },
  { id: 'offer_letter',        name: 'Offer Letter',         settingKey_en: 'offer_wa_template',                 settingKey_zh: 'offer_wa_template_zh',                 variables: OFFER_VARIABLES },
];

const CUSTOM_TEMPLATES_KEY = 'whatsapp_custom_templates';

const GROUP_AUDIENCE: Record<TemplateGroupKey, string> = {
  COMMON: 'Everyone can use it',
  MARKETING: 'Only people with the Marketing module',
  HR: 'Only people with the HRMS module',
};
const systemGroupOf = (id: string): TemplateGroupKey => BUILT_IN_TEMPLATES.find(b => b.id === id)?.group ?? 'COMMON';

// ── Template Editor ────────────────────────────────────────────────────────────

function TemplateEditor({ name, group, contentEn, contentZh, isSystem, isAdmin, variables, onSave, onCancel, saving }: {
  name: string;
  /** The template's group — fixed for system templates, picked for custom ones. */
  group: TemplateGroupKey;
  contentEn: string;
  contentZh: string;
  isSystem: boolean;
  isAdmin: boolean;
  /** Placeholder chips shown above the textarea. System templates pass
   *  their scoped set; custom templates fall back to the leads set. */
  variables?: VariableGroup[];
  onSave: (name: string, en: string, zh: string, group: TemplateGroupKey) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const groups: VariableGroup[] = variables ?? LEADS_VARIABLES;
  const [draftName, setDraftName] = useState(name);
  const [draftGroup, setDraftGroup] = useState<TemplateGroupKey>(group);
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
            <span style={{ fontSize: 13, color: '#64748b' }}>{groupLabel(group)} · {GROUP_AUDIENCE[group]}</span>
          </div>
        ) : (
          <div>
            <label style={s.fieldLabel}>Template Name</label>
            <input style={s.input} value={draftName} onChange={e => setDraftName(e.target.value)} placeholder="e.g. Visit Reminder" disabled={!isAdmin} />
            <label style={{ ...s.fieldLabel, marginTop: 16 }} htmlFor="tpl-group">Group</label>
            <select id="tpl-group" style={s.input} value={draftGroup} onChange={e => setDraftGroup(e.target.value as TemplateGroupKey)} disabled={!isAdmin}>
              {TEMPLATE_GROUPS.map(g => <option key={g.key} value={g.key}>{g.label} — {GROUP_AUDIENCE[g.key]}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ── Variables section ── */}
      {isAdmin && (
        <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' as const, marginBottom: 10 }}>
            Click to insert variable
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            {groups.map(group => (
              <div key={group.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#64748b', minWidth: 72, flexShrink: 0 }}>{group.label}</span>
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
            onClick={() => onSave(draftName.trim(), draftEn, draftZh, draftGroup)}
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
  // Which group's tab is open — Common, Marketing or HR.
  const [tab, setTab] = useState<TemplateGroupKey>('COMMON');
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

  const saveCustomTemplate = async (id: string | null, name: string, en: string, zh: string, group: TemplateGroupKey) => {
    setSaving(true);
    try {
      let updated: CustomTemplate[];
      if (id) {
        updated = customTemplates.map(t => t.id === id ? { ...t, name, group, content_en: en, content_zh: zh } : t);
      } else {
        const newId = crypto.randomUUID();
        updated = [...customTemplates, { id: newId, name, group, content_en: en, content_zh: zh }];
      }
      await patchSetting(CUSTOM_TEMPLATES_KEY, updated as unknown as string[]);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setEditing(null);
      setCreating(false);
      setTab(group);
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

  if (isLoading) return <p style={s.state}><LoadingSpinner /></p>;
  if (isError) return <p style={{ ...s.state, color: '#e53e3e' }}>Failed to load settings.</p>;

  // ── Editor View ──

  if (editing) {
    if (editing.type === 'system') {
      const st = SYSTEM_TEMPLATES.find(t => t.id === editing.id)!;
      const content = getSystemContent(st);
      return (
        <div style={{ ...s.page, ...(isMobile ? { padding: '16px 12px' } : {}) }}><div style={{ ...s.inner, ...(isMobile ? { maxWidth: '100%' } : {}) }}>
          <TemplateEditor
            name={st.name} group={systemGroupOf(st.id)} contentEn={content.en} contentZh={content.zh}
            isSystem isAdmin={isAdmin} saving={saving}
            variables={st.variables}
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
          name={ct.name} group={templateGroupOf(ct)} contentEn={ct.content_en} contentZh={ct.content_zh}
          isSystem={false} isAdmin={isAdmin} saving={saving}
          onSave={(name, en, zh, group) => saveCustomTemplate(ct.id, name, en, zh, group)}
          onCancel={() => setEditing(null)}
        />
      </div></div>
    );
  }

  if (creating) {
    return (
      <div style={{ ...s.page, ...(isMobile ? { padding: '16px 12px' } : {}) }}><div style={{ ...s.inner, ...(isMobile ? { maxWidth: '100%' } : {}) }}>
        <TemplateEditor
          name="" group={tab} contentEn="" contentZh=""
          isSystem={false} isAdmin={isAdmin} saving={saving}
          onSave={(name, en, zh, group) => saveCustomTemplate(null, name, en, zh, group)}
          onCancel={() => setCreating(false)}
        />
      </div></div>
    );
  }

  // ── List View ──

  // Build unified list for search/filter
  type ListItem = { id: string; name: string; type: 'system' | 'custom'; group: TemplateGroupKey; content_en: string; content_zh: string };
  const allTemplates: ListItem[] = [
    ...SYSTEM_TEMPLATES.map(st => { const c = getSystemContent(st); return { id: st.id, name: st.name, type: 'system' as const, group: systemGroupOf(st.id), content_en: c.en, content_zh: c.zh }; }),
    ...customTemplates.map(ct => ({ id: ct.id, name: ct.name, type: 'custom' as const, group: templateGroupOf(ct), content_en: ct.content_en, content_zh: ct.content_zh })),
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

  const inTab = filtered.filter(x => x.group === tab);

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
            <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: 13 }} />
            <input
              style={s.searchInput}
              placeholder="Search by name or message content..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 12, padding: 2 }}>
                <FontAwesomeIcon icon={faXmark} />
              </button>
            )}
          </div>
        )}

        {/* One tab per group — who can use it is said under the tabs */}
        <div role="tablist" aria-label="Template groups" style={s.tabs}>
          {TEMPLATE_GROUPS.map(g => {
            const on = tab === g.key;
            const count = filtered.filter(x => x.group === g.key).length;
            return (
              <button key={g.key} role="tab" aria-selected={on} onClick={() => setTab(g.key)}
                style={{ ...s.tab, color: on ? '#4f5bd5' : '#475569', borderBottomColor: on ? '#4f5bd5' : 'transparent' }}>
                {g.label} <span style={{ ...s.tabCount, background: on ? '#eef2ff' : '#f1f5f9', color: on ? '#4f5bd5' : '#64748b' }}>{count}</span>
              </button>
            );
          })}
        </div>
        <p style={{ margin: '12px 0 16px', fontSize: 13, color: '#64748b' }}>{GROUP_AUDIENCE[tab]}.</p>

        <div role="tabpanel" aria-label={groupLabel(tab)} style={{ background: '#fff', border: '1px solid #eef0f4', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' }}>
          {inTab.map(t => {
            const preview = t.content_en || t.content_zh || '';
            const isSystem = t.type === 'system';
            return (
              <div key={t.id} style={s.row}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                    <FontAwesomeIcon icon={faMessage} style={{ color: '#64748b', fontSize: 12 }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{t.name}</span>
                    <span style={isSystem ? s.systemBadge : s.customBadge}>{isSystem ? 'System' : 'Custom'}</span>
                  </div>
                  {preview && <p style={{ margin: 0, fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{preview.length > 80 ? preview.slice(0, 80) + '...' : preview}</p>}
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

          {inTab.length === 0 && (
            <div style={{ padding: '32px 18px', textAlign: 'center' as const, color: '#64748b', fontSize: 13 }}>
              {q ? <>No {groupLabel(tab)} templates match “{search.trim()}”.</> : (
                <>
                  <div>No {groupLabel(tab)} templates yet.</div>
                  {isAdmin && (
                    <button onClick={() => setCreating(true)} style={{ ...s.editBtn, marginTop: 12 }}>
                      <FontAwesomeIcon icon={faPlus} style={{ marginRight: 5 }} /> New template
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

      </div>

      {deleteTarget && (
        <DeleteDialog entityType="Template" entityName={deleteTarget.name}
          onConfirm={() => deleteCustomTemplate(deleteTarget.id, deleteTarget.name)}
          onCancel={() => setDeleteTarget(null)} />
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
  inner: { width: '100%', maxWidth: 960 },
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
  tabs: { display: 'flex', flexWrap: 'wrap' as const, gap: 4, borderBottom: '1px solid #e2e8f0' },
  tab: { display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 12px', marginBottom: -1, border: 'none', borderBottom: '2px solid transparent', background: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const },
  tabCount: { fontSize: 12, fontWeight: 600, padding: '1px 8px', borderRadius: 999 },
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
  editorCard: {
    background: '#fff', border: '1px solid #eef0f4', borderRadius: 14, padding: '22px 26px', boxSizing: 'border-box' as const,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)',
  },
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
  toast: {
    position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
    background: '#0f172a', color: '#fff', padding: '10px 24px', borderRadius: 8,
    fontSize: 13, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
  },
};
