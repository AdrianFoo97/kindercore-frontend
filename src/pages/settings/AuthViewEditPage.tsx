import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { fetchAuthViews, createAuthView, updateAuthView } from '../../api/auth-views.js';
import { ALL_MODULE_KEYS, MODULE_LABELS, ModuleKey } from '../../constants/authModules.js';
import { useToast } from '../../components/common/Toast.js';

// Same shape as AuthRoleEditPage.tsx — a dedicated add/edit surface, not a
// modal.
//
//   /settings/auth-views/new         → add (no :id)
//   /settings/auth-views/:id/edit    → edit

const C = {
  primary: '#5a67d8', primarySoft: '#eef2ff', primaryBorder: '#c7d2fe',
  bg: '#f8fafc', card: '#ffffff',
  text: '#0f172a', muted: '#64748b', mutedSoft: '#94a3b8',
  border: '#e2e8f0', divider: '#eceef2',
  danger: '#ef4444',
};

const KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;

export default function AuthViewEditPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const isEdit = !!id;

  const { data: views = [], isLoading } = useQuery({
    queryKey: ['auth-views'],
    queryFn: fetchAuthViews,
  });
  const existing = isEdit ? views.find(v => v.id === id) ?? null : null;

  const [form, setForm] = useState({ key: '', label: '', description: '', module: 'OPERATION' as ModuleKey });
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (hydrated) return;
    if (isEdit && existing) {
      setForm({ key: existing.key, label: existing.label, description: existing.description ?? '', module: existing.module });
      setHydrated(true);
    } else if (!isEdit) {
      setHydrated(true);
    }
  }, [hydrated, isEdit, existing]);

  const keyValid = KEY_PATTERN.test(form.key.trim());
  const canSave = form.label.trim().length > 0 && (isEdit || keyValid);

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (isEdit) {
        await updateAuthView(id!, {
          label: form.label.trim(),
          description: form.description.trim() || null,
          module: form.module,
        });
      } else {
        await createAuthView({
          key: form.key.trim(),
          label: form.label.trim(),
          description: form.description.trim() || null,
          module: form.module,
        });
      }
      qc.invalidateQueries({ queryKey: ['auth-views'] });
      showToast(isEdit ? 'View updated' : 'View added');
      navigate('/settings/auth-views');
    } catch (e: any) {
      const msg = (() => { try { return JSON.parse(e?.message)?.message ?? e.message; } catch { return e?.message ?? 'Save failed'; } })();
      showToast(msg, 'error');
    }
    setSaving(false);
  };

  if (isLoading || !hydrated) {
    return (
      <div style={s.page}><div style={s.inner}><p style={{ color: C.muted }}>Loading...</p></div></div>
    );
  }
  if (isEdit && !existing) {
    return (
      <div style={s.page}>
        <div style={s.inner}>
          <p style={{ color: C.muted }}>View not found.</p>
          <Link to="/settings/auth-views" style={s.crumbLink}>Back to Views</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <div style={s.breadcrumb}>
          <button onClick={() => navigate('/settings/auth-views')} style={s.backBtn} title="Back">
            <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 11 }} />
          </button>
          <Link to="/settings/auth-views" style={s.crumbLink}>Views</Link>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
          <span style={s.crumbCurrent}>{isEdit ? 'Edit View' : 'Add View'}</span>
        </div>

        <h1 style={s.heading}>{isEdit ? `Edit View — ${existing?.label}` : 'Add View'}</h1>

        <div style={s.card}>
          <label style={s.label}>
            <span style={s.labelText}>Key <span style={s.req}>*</span></span>
            <input
              autoFocus={!isEdit}
              value={form.key}
              onChange={e => setForm(f => ({ ...f, key: e.target.value.toUpperCase() }))}
              placeholder="OPERATION_SOP_APPROVE"
              disabled={isEdit}
              style={{ ...s.input, ...(isEdit ? s.inputDisabled : {}), fontFamily: 'ui-monospace, monospace' }}
            />
            <span style={s.help}>
              {isEdit
                ? "Can't be changed after creation — a developer may already have hardcoded a permission check against this exact string."
                : 'Uppercase letters, numbers, and underscores only. This is the exact string a developer will check in code — it does nothing on its own until they wire that check up and deploy.'}
            </span>
            {!isEdit && form.key.trim().length > 0 && !keyValid && (
              <span style={{ ...s.help, color: C.danger }}>Must start with a letter, and contain only A-Z, 0-9, and underscores.</span>
            )}
          </label>

          <label style={{ ...s.label, marginTop: 16 }}>
            <span style={s.labelText}>Label <span style={s.req}>*</span></span>
            <input
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="Approve/reject How-To Guide changes"
              style={s.input}
            />
          </label>

          <label style={{ ...s.label, marginTop: 16 }}>
            <span style={s.labelText}>Description</span>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="Review and decide on How-To Guide changes submitted by teachers."
              style={{ ...s.input, resize: 'vertical', minHeight: 70, fontFamily: 'inherit' }}
            />
          </label>

          <label style={{ ...s.label, marginTop: 16 }}>
            <span style={s.labelText}>Module <span style={s.req}>*</span></span>
            <select
              value={form.module}
              onChange={e => setForm(f => ({ ...f, module: e.target.value as ModuleKey }))}
              style={s.input}
            >
              {ALL_MODULE_KEYS.map(m => (
                <option key={m} value={m}>{MODULE_LABELS[m]}</option>
              ))}
            </select>
            <span style={s.help}>Which module this view belongs under — only offered to roles that already have this module granted.</span>
          </label>
        </div>

        <div style={s.footer}>
          <button type="button" onClick={() => navigate('/settings/auth-views')} style={s.cancelBtn}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave || saving}
            style={{ ...s.saveBtn, opacity: !canSave || saving ? 0.55 : 1, cursor: !canSave || saving ? 'default' : 'pointer' }}
          >
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Add view')}
          </button>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: '24px 32px', background: C.bg, minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', color: C.text,
  },
  inner: { maxWidth: 760, margin: '0 auto' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 12, flexWrap: 'wrap', rowGap: 4 },
  crumbLink: { color: C.muted, textDecoration: 'none', fontWeight: 500 },
  crumbCurrent: { color: C.text, fontWeight: 600 },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.border}`,
    background: C.card, color: C.muted, cursor: 'pointer', transition: 'all 160ms ease',
  },
  heading: { margin: '0 0 20px', fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' },
  card: {
    background: C.card, border: '1px solid #eef0f4', borderRadius: 14, padding: '22px 26px',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)',
  },
  label: { display: 'flex', flexDirection: 'column', gap: 6 },
  labelText: { fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase' as const, letterSpacing: '0.06em' },
  req: { color: C.danger },
  input: {
    padding: '8px 12px', fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 7,
    background: '#fff', color: C.text, fontFamily: 'inherit', outline: 'none',
  },
  inputDisabled: { background: '#f8fafc', color: C.mutedSoft, cursor: 'default' },
  help: { margin: '4px 0 0', fontSize: 11, color: C.mutedSoft, lineHeight: 1.5 },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  cancelBtn: {
    padding: '10px 18px', fontSize: 13, fontWeight: 600, color: C.text, background: '#fff',
    border: `1px solid ${C.border}`, borderRadius: 7, cursor: 'pointer',
  },
  saveBtn: {
    padding: '10px 20px', fontSize: 13, fontWeight: 700, color: '#fff', background: C.primary,
    border: 'none', borderRadius: 7,
  },
};
