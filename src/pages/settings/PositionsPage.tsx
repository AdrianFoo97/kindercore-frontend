import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { deletePosition, fetchDepartments, fetchPositions, setPositionReportsTo, upsertDepartment } from '../../api/salary.js';
import { useDeleteDialog } from '../../components/common/DeleteDialog.js';
import { fetchTeachers } from '../../api/planner.js';
import { fetchAuthRoles } from '../../api/auth-roles.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.js';
import { useToast } from '../../components/common/Toast.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import type { Position } from '../../types/index.js';
import { blockedHeadChoices, headsFrom, isDepartmentHead, managementFrom, reportingIssue, reportingProblem, reportsToOptions } from './orgStructure.js';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

const C = { text: '#0f172a', sub: '#334155', muted: '#64748b', border: '#e2e8f0', borderStrong: '#cbd5e1', bg: '#f8fafc', accent: '#5a67d8' };
/** The Positions tab of Settings → HR Planning → Organisational structure. */
export const POSITIONS_PATH = '/settings/positions';
const EDIT_PATH = '/settings/employee-salary/positions';

/**
 * Settings → HRMS → HR Planning → Positions: every position — its department,
 * rank, who it reports to (changed right here; the org chart follows), access
 * role and how many hold it. A row opens the position's full editor; pay stays
 * in Payroll.
 */
export default function PositionsPage({ embedded = false }: { embedded?: boolean }) {
  const { isMobile } = useIsMobile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const positions = useQuery({ queryKey: ['salary-positions'], queryFn: fetchPositions });
  const departments = useQuery({ queryKey: ['departments'], queryFn: fetchDepartments });
  const staff = useQuery({ queryKey: ['planner-teachers'], queryFn: fetchTeachers });
  const roles = useQuery({ queryKey: ['auth-roles'], queryFn: fetchAuthRoles });
  const { confirm: confirmDelete } = useDeleteDialog();
  /** The department shown — the first one until another is picked. */
  const [deptPicked, setDeptPicked] = useState<string | null>(null);
  // The department's head — the position that reports outside it.
  const setHead = useMutation({
    mutationFn: (v: { dept: { departmentId: string; name: string; sortOrder: number; hasCareerPath: boolean }; head: string | null }) =>
      upsertDepartment(v.dept.departmentId, { name: v.dept.name, sortOrder: v.dept.sortOrder, hasCareerPath: v.dept.hasCareerPath, headPositionId: v.head }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); showToast('Department head saved'); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });
  const link = useMutation({
    mutationFn: ({ id, parent }: { id: string; parent: string | null }) => setPositionReportsTo(id, parent),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salary-positions'] }); showToast('Reporting line saved'); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const addButton = (
    <button type="button" onClick={() => navigate(`${EDIT_PATH}/new`)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: isMobile ? 44 : 36, padding: '0 16px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
      <FontAwesomeIcon icon={faPlus} /> Add position
    </button>
  );
  if (positions.isPending || departments.isPending) return <LoadingSpinner />;

  const all = positions.data ?? [];
  const depts = [...(departments.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const deptName = (id: string | null) => depts.find(d => d.departmentId === id)?.name ?? 'No department';
  const deptRank = (id: string | null) => { const i = depts.findIndex(d => d.departmentId === id); return i < 0 ? depts.length : i; };
  // Positions with no department get their own choice, so none goes missing.
  const NO_DEPT = '__none';
  const hasUnassigned = all.some(p => !p.departmentId || !depts.some(d => d.departmentId === p.departmentId));
  const deptFilter = deptPicked ?? depts[0]?.departmentId ?? NO_DEPT;
  const inDept = (p: Position) => (deptFilter === NO_DEPT ? !p.departmentId || !depts.some(d => d.departmentId === p.departmentId) : p.departmentId === deptFilter);
  const rows = [...all].filter(inDept).sort((a, b) => deptRank(a.departmentId) - deptRank(b.departmentId) || b.titleWeight - a.titleWeight || a.sortOrder - b.sortOrder);
  const holders = (id: string) => (staff.data ?? []).filter(s => s.isActive && s.positionId === id).length;
  // Deleting a position (people can't hold one that's gone, so it's blocked while anyone does).
  const remove = (p: Position) => confirmDelete({
    entityType: 'position', entityName: p.name, title: 'Delete this position?',
    consequence: <>The position <strong>{p.name}</strong>, its level incentives and its reporting line are removed.</>,
    dependencies: [{ label: 'staff member', count: holders(p.positionId) }],
    onConfirm: async () => {
      await deletePosition(p.positionId);
      qc.invalidateQueries({ queryKey: ['salary-positions'] });
      qc.invalidateQueries({ queryKey: ['salary-incentives'] });
      showToast(`${p.name} deleted`);
    },
  });
  const deleteButton = (p: Position) => {
    const n = holders(p.positionId);
    return (
      <button type="button" onClick={() => remove(p)} disabled={n > 0} aria-label={`Delete ${p.name}`}
        title={n > 0 ? `Can’t delete — ${n} ${n === 1 ? 'person holds' : 'people hold'} it` : 'Delete'}
        style={{ width: isMobile ? 44 : 32, height: isMobile ? 44 : 32, border: 'none', background: 'none', borderRadius: 8, color: n > 0 ? C.borderStrong : C.muted, cursor: n > 0 ? 'default' : 'pointer' }}>
        <FontAwesomeIcon icon={faTrash} />
      </button>
    );
  };
  const roleName = (id: string | null) => (roles.data ?? []).find(r => r.id === id)?.name ?? '—';

  const heads = headsFrom(depts);
  const management = managementFrom(depts);
  const reportsTo = (p: Position) => {
    const options = reportsToOptions(all, heads, p, management);
    // A head's other-department choices it can't pick — greyed out with the reason, never just missing.
    const blocked = blockedHeadChoices(all, heads, p, management);
    const nobodyOk = !reportingProblem(all, heads, p, null, management);
    const current = all.find(o => o.positionId === p.reportsToPositionId);
    const issue = reportingIssue(all, heads, p, management);
    return (
      <div>
        <select aria-label={`${p.name} reports to`} value={p.reportsToPositionId ?? ''} disabled={link.isPending} aria-invalid={!!issue}
          onChange={e => link.mutate({ id: p.positionId, parent: e.target.value || null })}
          style={{ width: '100%', maxWidth: 240, minHeight: isMobile ? 44 : 36, padding: '4px 8px', fontSize: 14, fontFamily: 'inherit', color: C.text, background: '#fff', border: `1px solid ${issue ? '#b45309' : C.borderStrong}`, borderRadius: 8 }}>
          {(nobodyOk || !p.reportsToPositionId) && <option value="">{nobodyOk ? 'Nobody — top of its line' : 'Pick who it reports to…'}</option>}
          {current && !options.some(o => o.positionId === current.positionId) && <option value={current.positionId}>{current.name} (needs changing)</option>}
          {options.map(o => <option key={o.positionId} value={o.positionId}>{o.name}{o.departmentId !== p.departmentId ? ` — ${deptName(o.departmentId)}` : ''}</option>)}
          {blocked.map(b => <option key={b.position.positionId} value={b.position.positionId} disabled>{b.position.name} — {deptName(b.position.departmentId)} ({b.why})</option>)}
        </select>
        {/* A line set before the rules (or a head change) can break them — shown, never changed for you. */}
        {issue && (
          <div role="status" style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 4, fontSize: 12, color: '#b45309', lineHeight: 1.4, maxWidth: 260 }}>
            <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginTop: 2 }} />{issue}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        {!embedded && <h1>Positions</h1>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginRight: 'auto' }}>
          {/* Departments can be many, so it's a dropdown. */}
          <select aria-label="Department" value={deptFilter} onChange={e => setDeptPicked(e.target.value)}
            style={{ minHeight: isMobile ? 44 : 36, padding: '4px 10px', fontSize: 14, fontFamily: 'inherit', color: C.text, background: '#fff', border: `1px solid ${C.borderStrong}`, borderRadius: 8 }}>
            {depts.map(d => <option key={d.departmentId} value={d.departmentId}>{d.name}</option>)}
            {hasUnassigned && <option value={NO_DEPT}>No department</option>}
          </select>
          {(() => {
            const dept = depts.find(d => d.departmentId === deptFilter);
            if (!dept) return null;
            return (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: C.sub }}>
                Head
                <select aria-label={`Head of ${dept.name}`} value={dept.headPositionId ?? ''} disabled={setHead.isPending}
                  onChange={e => setHead.mutate({ dept, head: e.target.value || null })}
                  title="The department's head reports to a position in another department; everyone else reports within the department."
                  style={{ minHeight: isMobile ? 44 : 36, padding: '4px 10px', fontSize: 14, fontFamily: 'inherit', color: C.text, background: '#fff', border: `1px solid ${C.borderStrong}`, borderRadius: 8 }}>
                  <option value="">Not set</option>
                  {rows.map(p => <option key={p.positionId} value={p.positionId}>{p.name}</option>)}
                </select>
              </label>
            );
          })()}
          <span style={{ fontSize: 13, color: C.muted }}>{rows.length} {rows.length === 1 ? 'position' : 'positions'}</span>
        </div>
        {addButton}
      </header>
      {rows.length === 0 && <p style={{ fontSize: 14, color: C.muted }}>No positions in this department yet.</p>}

      {isMobile ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(p => (
            <li key={p.positionId} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
              <Link to={`${EDIT_PATH}/${p.positionId}/edit`} style={{ fontSize: 15, fontWeight: 700, color: C.text, textDecoration: 'none' }}>{p.name}</Link>
              <div style={{ fontSize: 13, color: C.muted, margin: '2px 0 8px' }}>rank {p.titleWeight} · {holders(p.positionId)} people · {roleName(p.authRoleId)}</div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 4 }}>Reports to</label>
              {reportsTo(p)}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>{deleteButton(p)}</div>
            </li>
          ))}
        </ul>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <thead style={{ background: C.bg }}>
            <tr>
              {['Position', 'Reports to', 'Rank', 'Access role', 'People', '', ''].map((h, hi) => (
                <th key={hi} scope="col" style={{ textAlign: h === 'Rank' || h === 'People' ? 'right' : 'left', padding: '10px 16px', fontSize: 12, fontWeight: 700, color: C.muted, borderBottom: `1px solid ${C.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const td: React.CSSProperties = { padding: '10px 16px', fontSize: 14, color: C.sub, borderTop: i ? `1px solid ${C.border}` : 'none', verticalAlign: 'middle' };
              return (
                <tr key={p.positionId} className="kc-pos-row">
                  <th scope="row" style={{ ...td, textAlign: 'left', fontWeight: 600 }}>
                    <Link to={`${EDIT_PATH}/${p.positionId}/edit`} style={{ color: C.text, textDecoration: 'none' }}>{p.name}</Link>
                    {isDepartmentHead(heads, p) && <span style={{ marginLeft: 8, padding: '1px 8px', borderRadius: 999, background: '#eef2ff', color: C.accent, fontSize: 12, fontWeight: 700 }}>Head</span>}
                  </th>
                  <td style={td}>{reportsTo(p)}</td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.titleWeight}</td>
                  <td style={td}>{roleName(p.authRoleId)}</td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{holders(p.positionId)}</td>
                  <td style={{ ...td, width: 40, textAlign: 'right', padding: '10px 4px' }}>{deleteButton(p)}</td>
                  <td style={{ ...td, width: 40, textAlign: 'right' }}>
                    <Link to={`${EDIT_PATH}/${p.positionId}/edit`} aria-label={`Edit ${p.name}`} title="Edit" style={{ color: C.muted }}>
                      <FontAwesomeIcon icon={faChevronRight} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <style>{`.kc-pos-row:hover { background: ${C.bg}; }`}</style>
    </div>
  );
}
