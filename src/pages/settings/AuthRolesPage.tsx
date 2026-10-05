import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faPen, faUserShield, faEye } from '@fortawesome/free-solid-svg-icons';
import { fetchAuthRoles, deleteAuthRole, AuthRoleRecord } from '../../api/auth-roles.js';
import { fetchAuthViews } from '../../api/auth-views.js';
import { MODULE_LABELS } from '../../constants/authModules.js';
import { useToast } from '../../components/common/Toast.js';
import { useDeleteDialog } from '../../components/common/DeleteDialog.js';

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eef0f4',
  text: '#0f172a',
  textSub: '#475569',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
  danger: '#dc2626',
};
const RADIUS = 14;
const SHADOW = '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)';

export default function AuthRolesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { confirm } = useDeleteDialog();

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['auth-roles'],
    queryFn: fetchAuthRoles,
  });
  const { data: views = [] } = useQuery({
    queryKey: ['auth-views'],
    queryFn: fetchAuthViews,
  });
  const viewLabels = new Map(views.map(v => [v.key, v.label]));

  const onDelete = async (role: AuthRoleRecord) => {
    await confirm({
      entityType: 'access role',
      entityName: role.name,
      consequence: 'The access role will be permanently removed.',
      blockedHint: 'Reassign any positions using this access role first, then try again.',
      onConfirm: async () => {
        try {
          await deleteAuthRole(role.id);
          qc.invalidateQueries({ queryKey: ['auth-roles'] });
          showToast('Access role deleted');
        } catch (e: any) {
          const msg = (() => { try { return JSON.parse(e?.message)?.message ?? e.message; } catch { return e?.message ?? 'Delete failed'; } })();
          showToast(msg, 'error');
          throw e;
        }
      },
    });
  };

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={s.heading}>Access Roles</h1>
          <p style={s.subheading}>
            Controls what each position can access. Assign an access role to a position on the career ladder,
            then grant it modules (nav sections) and, within a module, specific finer-grained views.
          </p>
        </div>

        <div style={s.card}>
          <div style={s.cardHeader}>
            <div>
              <h3 style={s.cardTitle}>Roles</h3>
              <div style={s.cardSub}>
                {roles.length === 0 ? 'No access roles yet' : `${roles.length} access role${roles.length === 1 ? '' : 's'}`}
              </div>
            </div>
            <button onClick={() => navigate('/settings/auth-roles/new')} style={s.primaryBtn}>
              <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
              Add access role
            </button>
          </div>

          {isLoading ? (
            <p style={{ padding: 24, color: C.mutedSoft, fontSize: 13 }}>Loading…</p>
          ) : roles.length === 0 ? (
            <p style={{ padding: 24, textAlign: 'center', color: C.muted, fontSize: 13 }}>
              No access roles configured yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {roles.map(role => (
                <div key={role.id} style={s.row}>
                  <div style={s.iconSwatch}>
                    <FontAwesomeIcon icon={faUserShield} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>
                      {role.name}
                    </div>
                    {role.description && (
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: C.mutedSoft, lineHeight: 1.5 }}>
                        {role.description}
                      </p>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {role.modules.length === 0 ? (
                        <span style={{ fontSize: 11, color: C.mutedSoft, fontStyle: 'italic' }}>No modules granted</span>
                      ) : role.modules.map(m => (
                        <span key={m} style={s.moduleBadge}>{MODULE_LABELS[m]}</span>
                      ))}
                      {role.views.map(v => (
                        <span key={v} style={s.viewBadge}>{viewLabels.get(v) ?? v}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => navigate(`/settings/auth-roles/${role.id}/edit`)} style={s.iconBtn} aria-label="Edit modules">
                      <FontAwesomeIcon icon={faPen} />
                    </button>
                    <button onClick={() => navigate(`/settings/auth-roles/${role.id}/views`)} style={s.iconBtn} aria-label="Edit views" title="Edit views">
                      <FontAwesomeIcon icon={faEye} />
                    </button>
                    <button onClick={() => onDelete(role)} style={{ ...s.iconBtn, color: C.danger }} aria-label="Delete">
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', background: C.bg, minHeight: '100vh', color: C.text },
  inner: { maxWidth: 1100, margin: '0 auto' },
  heading: { margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' },
  subheading: { margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.5, maxWidth: 720 },
  card: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS,
    padding: '22px 26px', boxShadow: SHADOW, marginBottom: 20,
  },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' },
  cardTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' },
  cardSub: { fontSize: 11, color: C.mutedSoft, marginTop: 2 },
  primaryBtn: {
    padding: '8px 16px', borderRadius: 10, border: 'none',
    background: C.primary, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  row: {
    display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px',
    border: `1px solid ${C.cardBorder}`, borderRadius: 12, background: '#fff',
  },
  iconSwatch: {
    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: C.primarySoft, color: C.primary, fontSize: 16,
  },
  moduleBadge: {
    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
    background: '#f1f5f9', color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.03em',
  },
  viewBadge: {
    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
    background: C.primarySoft, color: C.primary, letterSpacing: '0.01em',
  },
  iconBtn: {
    width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.cardBorder}`,
    background: '#fff', cursor: 'pointer', color: C.muted, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 12,
  },
};
