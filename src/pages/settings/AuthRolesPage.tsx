import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faPen, faCopy, faLock } from '@fortawesome/free-solid-svg-icons';
import { fetchAuthRoles, fetchAuthRoleCatalog, deleteAuthRole, AuthRoleRecord } from '../../api/auth-roles.js';
import { MODULE_LABELS } from '../../constants/authModules.js';
import { useToast } from '../../components/common/Toast.js';
import { useDeleteDialog } from '../../components/common/DeleteDialog.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.js';
import { groupByArea, usageLine } from './accessRoleForm.js';

// Settings → Team & access → Access roles. Built-in roles (defined in code,
// copy-only) grouped by area, then the roles this centre built itself. Every
// card spells out the modules it opens and the functions it grants.

const C = {
  card: '#ffffff', border: '#eef0f4', text: '#0f172a', sub: '#475569', muted: '#64748b',
  primary: '#5a67d8', primarySoft: '#eef2ff', danger: '#dc2626', chip: '#f1f5f9',
};

export default function AuthRolesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { confirm } = useDeleteDialog();

  const { data: roles = [], isLoading, isError } = useQuery({ queryKey: ['auth-roles'], queryFn: fetchAuthRoles });
  const { data: catalog } = useQuery({ queryKey: ['auth-role-catalog'], queryFn: fetchAuthRoleCatalog });
  const functionLabel = new Map((catalog?.functions ?? []).map(f => [f.key, f.label]));

  const builtIn = roles.filter(r => r.builtIn);
  const own = roles.filter(r => !r.builtIn);

  const onDelete = async (role: AuthRoleRecord) => {
    await confirm({
      entityType: 'access role',
      entityName: role.name,
      consequence: 'The access role will be permanently removed.',
      dependencies: [{ label: 'user account', count: role.peopleCount }, { label: 'position', count: role.positionCount }],
      blockedHint: 'Give those people and positions another role first, then try again.',
      onConfirm: async () => {
        try {
          await deleteAuthRole(role.id);
          qc.invalidateQueries({ queryKey: ['auth-roles'] });
          showToast('Access role deleted');
        } catch (e: any) {
          showToast(e?.body?.message ?? e?.message ?? 'Delete failed', 'error');
          throw e;
        }
      },
    });
  };

  const card = (role: AuthRoleRecord) => (
    <RoleCard key={role.id} role={role} functionLabel={functionLabel} includes={catalog?.moduleIncludes}
      onCopy={() => navigate(`/settings/auth-roles/new?copy=${encodeURIComponent(role.id)}`)}
      onEdit={() => navigate(`/settings/auth-roles/${role.id}/edit`)}
      onDelete={() => onDelete(role)} />
  );

  return (
    <div className="m-pad">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Access roles</h1>
        <button onClick={() => navigate('/settings/auth-roles/new')} style={s.primaryBtn}>
          <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} /> Add access role
        </button>
      </div>

      {isLoading ? <LoadingSpinner /> : isError ? (
        <p style={{ color: C.danger, fontSize: 14 }}>Couldn’t load the access roles. Refresh to try again.</p>
      ) : (
        <>
          <h2 style={s.sectionTitle}>Built-in roles</h2>
          <p style={s.sectionNote}>Ready-made roles. They can’t be changed — make a copy to build your own version.</p>
          {groupByArea(builtIn).map(g => (
            <div key={g.area} style={{ marginBottom: 16 }}>
              <div style={s.areaLabel}>{g.area}</div>
              <div style={s.grid}>{g.roles.map(card)}</div>
            </div>
          ))}

          <h2 style={{ ...s.sectionTitle, marginTop: 32 }}>Your roles</h2>
          {own.length === 0 ? (
            <div style={s.empty}>
              No roles of your own yet. Add one, or copy a built-in role and adjust it.
            </div>
          ) : <div style={s.grid}>{own.map(card)}</div>}
        </>
      )}
    </div>
  );
}

function RoleCard({ role, functionLabel, includes, onCopy, onEdit, onDelete }: {
  role: AuthRoleRecord; functionLabel: Map<string, string>; includes?: Record<string, string[]>;
  onCopy: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div style={s.card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{role.name}</span>
            {role.builtIn && (
              <span style={s.lockBadge}><FontAwesomeIcon icon={faLock} style={{ fontSize: 9 }} /> Built-in</span>
            )}
          </div>
          {role.description && <p style={{ margin: '4px 0 0', fontSize: 13, color: C.sub, lineHeight: 1.5 }}>{role.description}</p>}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={onCopy} style={s.iconBtn} aria-label={`Make a copy of ${role.name}`} title="Make a copy"><FontAwesomeIcon icon={faCopy} /></button>
          {!role.builtIn && <>
            <button onClick={onEdit} style={s.iconBtn} aria-label={`Edit ${role.name}`} title="Edit"><FontAwesomeIcon icon={faPen} /></button>
            <button onClick={onDelete} style={{ ...s.iconBtn, color: C.danger }} aria-label={`Delete ${role.name}`} title="Delete"><FontAwesomeIcon icon={faTrash} /></button>
          </>}
        </div>
      </div>

      <div style={s.detailLabel}>Modules</div>
      {role.modules.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>None</div>}
      {role.modules.map(m => (
        <div key={m} style={{ marginBottom: 8 }}>
          <span style={s.moduleChip}>{MODULE_LABELS[m]}</span>
          {includes?.[m] && (
            <ul style={s.list}>{includes[m].map(line => <li key={line}>{line}</li>)}</ul>
          )}
        </div>
      ))}

      <div style={s.detailLabel}>Extra functions</div>
      {role.views.length === 0
        ? <div style={{ fontSize: 13, color: C.muted }}>None</div>
        : <ul style={s.list}>{role.views.map(v => <li key={v}>{functionLabel.get(v) ?? v}</li>)}</ul>}

      <div style={{ marginTop: 12, fontSize: 12, color: C.muted }}>{usageLine(role.peopleCount, role.positionCount)}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  primaryBtn: { padding: '8px 16px', borderRadius: 8, border: 'none', background: C.primary, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', minHeight: 36 },
  sectionTitle: { margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: C.text },
  sectionNote: { margin: '0 0 16px', fontSize: 13, color: C.muted },
  areaLabel: { fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 },
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' },
  lockBadge: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: C.muted, background: C.chip, padding: '2px 8px', borderRadius: 999 },
  detailLabel: { fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 6px' },
  list: { margin: '6px 0 0', paddingLeft: 18, fontSize: 13, color: C.sub, lineHeight: 1.6 },
  moduleChip: { fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: C.primarySoft, color: C.primary },
  iconBtn: { width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', color: C.muted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 },
  empty: { padding: 24, textAlign: 'center', color: C.muted, fontSize: 13, border: `1px dashed ${C.border}`, borderRadius: 12, background: '#fff' },
};
