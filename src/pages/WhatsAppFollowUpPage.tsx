import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSettings, patchSetting } from '../api/settings.js';
import { Settings } from '../types/index.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';

interface FieldConfig {
  key: keyof Settings;
  label: string;
  description: string;
  type: 'text';
}

const TEMPLATE_FIELDS: FieldConfig[] = [
  {
    key: 'whatsapp_followup_template',
    label: 'WhatsApp Follow-up Template (English)',
    description: 'Use the Insert buttons below to add dynamic placeholders.',
    type: 'text',
  },
  {
    key: 'whatsapp_followup_template_zh',
    label: 'WhatsApp Follow-up Template (Chinese)',
    description: 'Use the Insert buttons below to add dynamic placeholders.',
    type: 'text',
  },
];

const PLACEHOLDER_INSERTS = [
  { label: 'Child Name', value: '{{childName}}' },
  { label: 'Relationship', value: '{{relationship}}' },
  { label: 'Appt. Day', value: '{{appointmentDay}}' },
  { label: 'Appt. Date', value: '{{appointmentDate}}' },
  { label: 'Appt. Start Time', value: '{{appointmentTime}}' },
  { label: 'Appt. End Time', value: '{{appointmentEndTime}}' },
  { label: 'Address', value: '{{address}}' },
];

export default function WhatsAppFollowUpPage() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Partial<Record<keyof Settings, string>>>({});
  const taRef = useRef<HTMLTextAreaElement>(null);
  const taZhRef = useRef<HTMLTextAreaElement>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  const raw = localStorage.getItem('user');
  const user = raw ? (JSON.parse(raw) as { role: string }) : null;
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

  const getValue = (field: FieldConfig): string => {
    if (drafts[field.key] !== undefined) return drafts[field.key]!;
    if (!data) return '';
    const v = data[field.key];
    return v !== undefined && v !== null ? String(v) : '';
  };

  const handleChange = (key: keyof Settings, value: string) => {
    setDrafts(prev => ({ ...prev, [key]: value }));
    setSaved(prev => ({ ...prev, [key]: false }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const handleSave = async (field: FieldConfig) => {
    const value = getValue(field);
    setSaving(prev => ({ ...prev, [field.key]: true }));
    setErrors(prev => ({ ...prev, [field.key]: '' }));
    try {
      await patchSetting(field.key as string, value);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setDrafts(prev => { const n = { ...prev }; delete n[field.key]; return n; });
      setSaved(prev => ({ ...prev, [field.key]: true }));
      setTimeout(() => setSaved(prev => ({ ...prev, [field.key]: false })), 2000);
    } catch (err: unknown) {
      setErrors(prev => ({ ...prev, [field.key]: err instanceof Error ? err.message : 'Save failed' }));
    } finally {
      setSaving(prev => ({ ...prev, [field.key]: false }));
    }
  };

  const insertPlaceholder = (key: keyof Settings, placeholder: string) => {
    const ta = key === 'whatsapp_followup_template_zh' ? taZhRef.current : taRef.current;
    if (!ta) return;
    ta.focus();
    const inserted = document.execCommand('insertText', false, placeholder);
    if (!inserted) {
      const start = ta.selectionStart ?? 0;
      const end = ta.selectionEnd ?? 0;
      const current = drafts[key] !== undefined ? drafts[key]! : String(data?.[key] ?? '');
      const next = current.slice(0, start) + placeholder + current.slice(end);
      handleChange(key, next);
      requestAnimationFrame(() => {
        ta.setSelectionRange(start + placeholder.length, start + placeholder.length);
      });
    }
  };

  if (isLoading) return <p style={styles.state}>Loading settings…</p>;
  if (isError) return <p style={{ ...styles.state, color: '#e53e3e' }}>Failed to load settings.</p>;

  return (
    <div style={styles.page}>
      <div style={styles.inner}>
        <h1 style={styles.heading}>WhatsApp Template — Follow-up</h1>
        {!isAdmin && (
          <p style={styles.readonlyNote}>You have read-only access. Admin role required to save changes.</p>
        )}

        <div style={styles.list}>
          {TEMPLATE_FIELDS.map(field => {
            const isSaving = saving[field.key];
            const isJustSaved = saved[field.key];
            const fieldError = errors[field.key];
            const value = getValue(field);
            return (
              <div key={String(field.key)} style={styles.card}>
                <label style={styles.label}>{field.label}</label>
                <p style={styles.desc}>{field.description}</p>
                <textarea
                  ref={field.key === 'whatsapp_followup_template_zh' ? taZhRef : taRef}
                  style={{ ...styles.input, height: 80, resize: 'vertical' }}
                  value={value}
                  onChange={e => handleChange(field.key, e.target.value)}
                  disabled={!isAdmin}
                />
                {isAdmin && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: '#718096', alignSelf: 'center', marginRight: 2 }}>Insert:</span>
                    {PLACEHOLDER_INSERTS.map(p => (
                      <button key={p.value} onClick={() => insertPlaceholder(field.key, p.value)} style={styles.insertBtn}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
                {fieldError && <p style={styles.error}>{fieldError}</p>}
                {isAdmin && (
                  <button onClick={() => handleSave(field)} disabled={isSaving} style={isJustSaved ? styles.savedBtn : styles.saveBtn}>
                    {isSaving ? 'Saving…' : isJustSaved ? <>Saved <FontAwesomeIcon icon={faCheck} /></> : 'Save'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px 24px', fontFamily: 'system-ui, sans-serif', display: 'flex', justifyContent: 'center' },
  inner: { width: '100%', maxWidth: 680 },
  heading: { margin: '0 0 8px', fontSize: 24 },
  readonlyNote: { color: '#718096', fontSize: 13, marginBottom: 24 },
  state: { padding: 32, fontSize: 16, color: '#4a5568' },
  list: { display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 },
  card: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20,
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  label: { fontWeight: 700, fontSize: 14, color: '#2d3748' },
  desc: { fontSize: 12, color: '#718096', margin: 0 },
  input: {
    padding: '8px 10px', border: '1px solid #cbd5e0', borderRadius: 4,
    fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  },
  error: { color: '#e53e3e', fontSize: 12, margin: 0 },
  saveBtn: {
    alignSelf: 'flex-end', padding: '7px 18px',
    background: '#4299e1', color: '#fff', border: 'none',
    borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  savedBtn: {
    alignSelf: 'flex-end', padding: '7px 18px',
    background: '#38a169', color: '#fff', border: 'none',
    borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  insertBtn: {
    padding: '3px 10px', background: '#edf2f7', border: '1px solid #e2e8f0',
    borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#4a5568',
  },
};
