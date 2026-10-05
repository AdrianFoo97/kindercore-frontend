import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faCheck } from '@fortawesome/free-solid-svg-icons';
import { fetchAuthRoles, setAuthRoleViews } from '../../api/auth-roles.js';
import { fetchAuthViews } from '../../api/auth-views.js';
import { MODULE_LABELS, ViewKey } from '../../constants/authModules.js';
import { useToast } from '../../components/common/Toast.js';
import RoleEditTabs from './RoleEditTabs.js';

// Step 2 of 2 for an AuthRole — see AuthRoleEditPage.tsx for step 1
// (name/description/Modules). Only views belonging to at least one of this
// role's already-saved modules are offered here.
//
//   /settings/auth-roles/:id/views

const C = {
  primary: '#5a67d8', primarySoft: '#eef2ff',
  bg: '#f8fafc', card: '#ffffff',
  text: '#0f172a', muted: '#64748b', mutedSoft: '#94a3b8',
  border: '#e2e8f0', divider: '#eceef2',
};

export default function AuthRoleViewsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['auth-roles'],
    queryFn: fetchAuthRoles,
  });
  const { data: viewCatalog = [], isLoading: viewsLoading } = useQuery({
    queryKey: ['auth-views'],
    queryFn: fetchAuthViews,
  });
  const existing = roles.find(r => r.id === id) ?? null;
  const isLoading = rolesLoading || viewsLoading;

  const [views, setViews] = useState<ViewKey[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (hydrated || !existing) return;
    setViews(existing.views);
    setHydrated(true);
  }, [hydrated, existing]);

  const toggleView = (v: ViewKey) => {
    setViews(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await setAuthRoleViews(id!, views);
      qc.invalidateQueries({ queryKey: ['auth-roles'] });
      showToast('Views updated');
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
  if (!existing) {
    return (
      <div style={s.page}>
        <div style={s.inner}>
          <p style={{ color: C.muted }}>Access role not found.</p>
          <Link to="/settings/auth-roles" style={s.crumbLink}>Back to Access Roles</Link>
        </div>
      </div>
    );
  }

  const availableViews = viewCatalog.filter(v => v.modules.some(m => existing.modules.includes(m)));
  // Grouped by module for display — a view with 2+ granted modules shows
  // once under each, since it's genuinely reachable from either.
  const viewsByModule = existing.modules
    .map(m => ({ module: m, views: availableViews.filter(v => v.modules.includes(m)) }))
    .filter(g => g.views.length > 0);

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <div style={s.breadcrumb}>
          <button onClick={() => navigate('/settings/auth-roles')} style={s.backBtn} title="Back">
            <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 11 }} />
          </button>
          <Link to="/settings/auth-roles" style={s.crumbLink}>Access Roles</Link>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
          <span style={s.crumbCurrent}>{existing.name} — Views</span>
        </div>

        <h1 style={s.heading}>{existing.name} — Views</h1>

        <RoleEditTabs roleId={id!} active="views" />

        <div style={s.card}>
          {existing.modules.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
              This role has no modules granted yet, so there's nothing to offer here. Go to the{' '}
              <Link to={`/settings/auth-roles/${id}/edit`} style={{ color: C.primary, fontWeight: 600 }}>
                Modules tab
              </Link>{' '}
              and grant at least one first.
            </p>
          ) : (
            <>
              <span style={s.labelText}>Granted modules</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 20 }}>
                {existing.modules.map(m => (
                  <span key={m} style={s.moduleBadge}>{MODULE_LABELS[m]}</span>
                ))}
              </div>

              <div style={{ paddingTop: 20, borderTop: `1px solid ${C.divider}` }}>
                <span style={s.labelText}>Views</span>
                <p style={s.help}>
                  Finer-grained actions within a module — only views belonging to at least one module above are
                  offered.
                </p>
                {viewsByModule.length === 0 ? (
                  <p style={{ margin: '10px 0 0', fontSize: 12, color: C.mutedSoft, fontStyle: 'italic' }}>
                    No views defined yet for {existing.modules.map(m => MODULE_LABELS[m]).join(', ')}.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 10 }}>
                    {viewsByModule.map(group => (
                      <div key={group.module}>
                        <div style={s.moduleGroupLabel}>{MODULE_LABELS[group.module]}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                          {group.views.map(v => {
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div style={s.footer}>
          <button type="button" onClick={() => navigate('/settings/auth-roles')} style={s.cancelBtn}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            style={{ ...s.saveBtn, opacity: saving ? 0.55 : 1, cursor: saving ? 'default' : 'pointer' }}
          >
            {saving ? 'Saving…' : 'Save changes'}
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
  labelText: { fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase' as const, letterSpacing: '0.06em' },
  moduleGroupLabel: { fontSize: 12, fontWeight: 700, color: C.text },
  help: { margin: '4px 0 0', fontSize: 11, color: C.mutedSoft },
  moduleBadge: {
    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
    background: '#f1f5f9', color: C.text, textTransform: 'uppercase', letterSpacing: '0.03em',
  },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
    border: `1px solid ${C.border}`, background: '#fff', color: C.text, cursor: 'pointer',
  },
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
