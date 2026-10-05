import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faCheck } from '@fortawesome/free-solid-svg-icons';
import {
  fetchAuthRoles, createAuthRole, updateAuthRole, setAuthRoleModules, setAuthRoleViews,
} from '../../api/auth-roles.js';
import { fetchAuthViews } from '../../api/auth-views.js';
import { ALL_MODULE_KEYS, MODULE_LABELS, ModuleKey, ViewKey } from '../../constants/authModules.js';
import { useToast } from '../../components/common/Toast.js';

// Dedicated add/edit surface for an AuthRole, same shape as
// PositionEditPage.tsx — a modal stopped being enough room once the
// modules/views pickers grew, and this is expected to keep growing
// (more views as more of the app adopts requireView).
//
//   /settings/auth-roles/new         → add (no :id)
//   /settings/auth-roles/:id/edit    → edit

const C = {
  primary: '#5a67d8', primarySoft: '#eef2ff', primaryBorder: '#c7d2fe',
  bg: '#f8fafc', card: '#ffffff',
  text: '#0f172a', muted: '#64748b', mutedSoft: '#94a3b8',
  border: '#e2e8f0', divider: '#eceef2',
  danger: '#ef4444',
};

export default function AuthRoleEditPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const isEdit = !!id;

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['auth-roles'],
    queryFn: fetchAuthRoles,
  });
  const { data: viewCatalog = [] } = useQuery({
    queryKey: ['auth-views'],
    queryFn: fetchAuthViews,
  });
  const viewModules = new Map(viewCatalog.map(v => [v.key, v.modules]));
  const existing = isEdit ? roles.find(r => r.id === id) ?? null : null;

  const [form, setForm] = useState({ name: '', description: '' });
  const [modules, setModules] = useState<ModuleKey[]>([]);
  const [views, setViews] = useState<ViewKey[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (hydrated) return;
    if (isEdit && existing) {
      setForm({ name: existing.name, description: existing.description ?? '' });
      setModules(existing.modules);
      setViews(existing.views);
      setHydrated(true);
    } else if (!isEdit) {
      setHydrated(true);
    }
  }, [hydrated, isEdit, existing]);

  const toggleModule = (m: ModuleKey) => {
    setModules(prev => {
      const next = prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m];
      // Dropping a module drops any view that belonged ONLY to it — a
      // multi-module view stays granted as long as at least one of its
      // modules is still checked.
      if (!next.includes(m)) {
        setViews(vPrev => vPrev.filter(v => (viewModules.get(v) ?? []).some(vm => next.includes(vm))));
      }
      return next;
    });
  };
  const toggleView = (v: ViewKey) => {
    setViews(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  };

  const canSave = form.name.trim().length > 0;

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), description: form.description.trim() || null };
      const role = isEdit ? await updateAuthRole(id!, payload) : await createAuthRole(payload);
      await setAuthRoleModules(role.id, modules);
      await setAuthRoleViews(role.id, views);
      qc.invalidateQueries({ queryKey: ['auth-roles'] });
      showToast(isEdit ? 'Access role updated' : 'Access role added');
      navigate('/settings/auth-roles');
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
          <p style={{ color: C.muted }}>Access role not found.</p>
          <Link to="/settings/auth-roles" style={s.crumbLink}>Back to Access Roles</Link>
        </div>
      </div>
    );
  }

  const availableViews = viewCatalog.filter(v => v.modules.some(m => modules.includes(m)));

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <div style={s.breadcrumb}>
          <button onClick={() => navigate('/settings/auth-roles')} style={s.backBtn} title="Back">
            <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 11 }} />
          </button>
          <Link to="/settings/auth-roles" style={s.crumbLink}>Access Roles</Link>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
          <span style={s.crumbCurrent}>{isEdit ? 'Edit Access Role' : 'Add Access Role'}</span>
        </div>

        <h1 style={s.heading}>{isEdit ? `Edit Access Role — ${existing?.name}` : 'Add Access Role'}</h1>

        <div style={s.card}>
          <label style={s.label}>
            <span style={s.labelText}>Name <span style={s.req}>*</span></span>
            <input
              autoFocus
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Supervisor"
              style={s.input}
            />
          </label>

          <label style={{ ...s.label, marginTop: 16 }}>
            <span style={s.labelText}>Description</span>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="Can approve How-To Guide changes in the Operation module."
              style={{ ...s.input, resize: 'vertical', minHeight: 70, fontFamily: 'inherit' }}
            />
          </label>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.divider}` }}>
            <span style={s.labelText}>Modules</span>
            <p style={s.help}>Top-level nav sections this role can see.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {ALL_MODULE_KEYS.map(m => {
                const active = modules.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleModule(m)}
                    style={{ ...s.chip, ...(active ? s.chipActive : {}) }}
                  >
                    {active && <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10 }} />}
                    {MODULE_LABELS[m]}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.divider}` }}>
            <span style={s.labelText}>Views</span>
            <p style={s.help}>
              Finer-grained actions within a module — only offered once that module is granted above. Manage the
              catalog of views under Admin → Views.
            </p>
            {availableViews.length === 0 ? (
              <p style={{ margin: '10px 0 0', fontSize: 12, color: C.mutedSoft, fontStyle: 'italic' }}>
                {viewCatalog.length === 0 ? 'No views defined yet — add one under Admin → Views.' : 'Grant a module above to see its views.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {availableViews.map(v => {
                  const active = views.includes(v.key);
                  return (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => toggleView(v.key)}
                      style={{ ...s.chip, ...(active ? s.chipActiveView : {}) }}
                      title={v.description ?? undefined}
                    >
                      {active && <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10 }} />}
                      {v.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={s.footer}>
          <button type="button" onClick={() => navigate('/settings/auth-roles')} style={s.cancelBtn}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave || saving}
            style={{ ...s.saveBtn, opacity: !canSave || saving ? 0.55 : 1, cursor: !canSave || saving ? 'default' : 'pointer' }}
          >
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Add access role')}
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
  help: { margin: '4px 0 0', fontSize: 11, color: C.mutedSoft },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
    border: `1px solid ${C.border}`, background: '#fff', color: C.text, cursor: 'pointer',
  },
  chipActive: { background: C.primarySoft, borderColor: C.primary, color: C.primary },
  chipActiveView: { background: '#ecfdf5', borderColor: '#10b981', color: '#047857' },
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
