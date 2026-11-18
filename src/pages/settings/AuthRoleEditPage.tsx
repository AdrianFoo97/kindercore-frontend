import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import {
  fetchAuthRoles, fetchAuthRoleCatalog, createAuthRole, updateAuthRole, setAuthRoleModules, setAuthRoleViews,
} from '../../api/auth-roles.js';
import { MODULE_LABELS, type ModuleKey } from '../../constants/authModules.js';
import { useToast } from '../../components/common/Toast.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.js';
import { toggleFunction, toggleModule, type RoleGrants } from './accessRoleForm.js';

// Add / edit one of the centre's own access roles: name, description, and
// which modules it opens — each with the functions inside that module.
//
//   /settings/auth-roles/new            → add
//   /settings/auth-roles/new?copy=<id>  → add, starting from another role (e.g. a built-in one)
//   /settings/auth-roles/:id/edit       → edit (built-in roles can't be edited)

const C = {
  primary: '#5a67d8', primarySoft: '#eef2ff', card: '#ffffff', text: '#0f172a', sub: '#475569',
  muted: '#64748b', border: '#e2e8f0', divider: '#eceef2', danger: '#dc2626',
};

export default function AuthRoleEditPage() {
  const { id } = useParams<{ id?: string }>();
  const [params] = useSearchParams();
  const copyFrom = params.get('copy');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const isEdit = !!id;

  const { data: roles = [], isLoading: rolesLoading } = useQuery({ queryKey: ['auth-roles'], queryFn: fetchAuthRoles });
  const { data: catalog, isLoading: catalogLoading } = useQuery({ queryKey: ['auth-role-catalog'], queryFn: fetchAuthRoleCatalog });
  const existing = isEdit ? roles.find(r => r.id === id) ?? null : null;
  const source = isEdit ? existing : (copyFrom ? roles.find(r => r.id === copyFrom) ?? null : null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [grants, setGrants] = useState<RoleGrants>({ modules: [], functions: [] });
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (hydrated || rolesLoading) return;
    if (source) {
      setName(isEdit ? source.name : `${source.name} (copy)`);
      setDescription(source.description ?? '');
      setGrants({ modules: source.modules, functions: source.views });
    }
    setHydrated(true);
  }, [hydrated, rolesLoading, source, isEdit]);

  const functions = catalog?.functions ?? [];
  const modules = catalog?.modules ?? [];
  const nameTaken = roles.some(r => r.id !== id && r.name.trim().toLowerCase() === name.trim().toLowerCase());
  const problem = !name.trim() ? 'Give the role a name.'
    : nameTaken ? 'Another role already has this name.'
    : grants.modules.length === 0 ? 'Tick at least one module.'
    : null;

  const onSave = async () => {
    if (problem) return;
    setSaving(true);
    try {
      const payload = { name: name.trim(), description: description.trim() || null };
      const role = isEdit ? await updateAuthRole(id!, payload) : await createAuthRole(payload);
      await setAuthRoleModules(role.id, grants.modules);
      await setAuthRoleViews(role.id, grants.functions);
      qc.invalidateQueries({ queryKey: ['auth-roles'] });
      showToast(isEdit ? 'Access role saved' : 'Access role added');
      navigate('/settings/auth-roles');
    } catch (e: any) {
      showToast(e?.message ?? 'Save failed', 'error');
    }
    setSaving(false);
  };

  const back = () => navigate('/settings/auth-roles');

  if (rolesLoading || catalogLoading || !hydrated) return <LoadingSpinner />;
  if (isEdit && (!existing || existing.builtIn)) {
    return (
      <div>
        <p style={{ color: C.muted, fontSize: 14 }}>
          {existing?.builtIn ? 'Built-in roles can’t be changed — make a copy to build your own version.' : 'Access role not found.'}
        </p>
        <button onClick={back} style={s.cancelBtn}>Back to access roles</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={back} style={s.backBtn} aria-label="Back to access roles" title="Back">
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>
        <h1 style={{ margin: 0 }}>{isEdit ? `Edit ${existing!.name}` : 'Add access role'}</h1>
      </div>

      <div style={s.card}>
        <label style={s.label} htmlFor="role-name">Name</label>
        <input id="role-name" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Admissions Lead" style={s.input} />

        <label style={{ ...s.label, marginTop: 16 }} htmlFor="role-desc">Description</label>
        <textarea id="role-desc" value={description} onChange={e => setDescription(e.target.value)} rows={2}
          placeholder="What this person does" style={{ ...s.input, resize: 'vertical', fontFamily: 'inherit' }} />
      </div>

      <div style={{ ...s.card, marginTop: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>What this role can open</div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Tick a module to open it, then any functions inside it.</div>
        {modules.map(m => (
          <ModuleBlock key={m} module={m} ticked={grants.modules.includes(m)} includes={catalog?.moduleIncludes?.[m] ?? []}
            functions={functions.filter(f => f.module === m)} chosen={grants.functions}
            onModule={() => setGrants(g => toggleModule(g, m, functions))}
            onFunction={f => setGrants(g => toggleFunction(g, f))} />
        ))}
      </div>

      <div style={s.footer}>
        {problem && <span role="status" style={{ fontSize: 13, color: C.muted, marginRight: 'auto' }}>{problem}</span>}
        <button type="button" onClick={back} style={s.cancelBtn}>Cancel</button>
        <button type="button" onClick={onSave} disabled={!!problem || saving}
          style={{ ...s.saveBtn, opacity: problem || saving ? 0.55 : 1, cursor: problem || saving ? 'default' : 'pointer' }}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add role'}
        </button>
      </div>
    </div>
  );
}

function ModuleBlock({ module, ticked, includes, functions, chosen, onModule, onFunction }: {
  module: ModuleKey; ticked: boolean; includes: string[]; functions: { key: string; module: ModuleKey; label: string; description: string }[];
  chosen: string[]; onModule: () => void; onFunction: (f: { key: string; module: ModuleKey; label: string; description: string }) => void;
}) {
  return (
    <div style={{ borderTop: `1px solid ${C.divider}`, marginTop: 16, paddingTop: 16 }}>
      <label style={s.checkRow}>
        <input type="checkbox" checked={ticked} onChange={onModule} style={s.checkbox} />
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{MODULE_LABELS[module]}</span>
      </label>
      {includes.length > 0 && (
        <div style={{ marginLeft: 30, fontSize: 12, color: C.sub, lineHeight: 1.6 }}>Opens: {includes.join(' · ')}</div>
      )}
      {functions.length > 0 && (
        <div style={{ marginLeft: 30, marginTop: 4 }}>
          {functions.map(f => (
            <label key={f.key} style={{ ...s.checkRow, alignItems: 'flex-start', cursor: ticked ? 'pointer' : 'default', opacity: ticked ? 1 : 0.55 }}>
              <input type="checkbox" checked={chosen.includes(f.key)} disabled={!ticked} onChange={() => onFunction(f)}
                style={{ ...s.checkbox, marginTop: 2, cursor: ticked ? 'pointer' : 'default' }} />
              <span>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text }}>{f.label}</span>
                <span style={{ display: 'block', fontSize: 12, color: C.sub, lineHeight: 1.5 }}>{f.description}</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: { background: C.card, border: '1px solid #eef0f4', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: 6 },
  input: { width: '100%', boxSizing: 'border-box', padding: '8px 12px', fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, background: '#fff' },
  checkRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', cursor: 'pointer', minHeight: 32 },
  checkbox: { width: 18, height: 18, accentColor: C.primary, cursor: 'pointer', flexShrink: 0 },
  backBtn: { width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.muted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  cancelBtn: { padding: '8px 16px', fontSize: 13, fontWeight: 600, color: C.text, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer', minHeight: 36 },
  saveBtn: { padding: '8px 18px', fontSize: 13, fontWeight: 700, color: '#fff', background: C.primary, border: 'none', borderRadius: 8, minHeight: 36 },
};
