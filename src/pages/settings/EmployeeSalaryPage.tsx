import { useState, useMemo, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faTrash, faPen, faGripVertical, faEllipsisVertical,
} from '@fortawesome/free-solid-svg-icons';
import { fetchPositions, upsertPosition, deletePosition, fetchLevelIncentives, upsertLevelIncentives, fetchTeachersWithSalary, fetchDepartments } from '../../api/salary.js';
import { uploadUrl } from '../../api/upload.js';
import { Position } from '../../types/index.js';
import { useToast } from '../../components/common/Toast.js';
import { useDeleteDialog } from '../../components/common/DeleteDialog.js';
import { SettingsBreadcrumb } from '../../components/common/SettingsBreadcrumb.js';

const C = {
  primary: '#5a67d8', primaryLight: '#eef0fa', card: '#fff', text: '#1e293b',
  muted: '#94a3b8', sub: '#475569', border: '#e2e8f0', danger: '#ef4444', green: '#059669',
};
const MIN_LEVEL = 1;
const MAX_LEVEL = 5;

function fmtRM(v: number) { return `RM ${v.toLocaleString('en-MY', { minimumFractionDigits: 0 })}`; }

/** Only allow digits (and optionally a decimal point) */
function numOnly(val: string): string { return val.replace(/[^\d.]/g, ''); }

export default function EmployeeSalaryPage({ embedded = false }: { embedded?: boolean } = {}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { confirm: confirmDelete } = useDeleteDialog();

  const { data: positions = [], isLoading: posLoading } = useQuery({ queryKey: ['salary-positions'], queryFn: fetchPositions });
  const { data: teachersSalary = [] } = useQuery({ queryKey: ['salary-teachers'], queryFn: fetchTeachersWithSalary });
  const { data: incentives = [] } = useQuery({ queryKey: ['salary-incentives'], queryFn: fetchLevelIncentives });
  const { data: departmentList = [] } = useQuery({ queryKey: ['departments'], queryFn: fetchDepartments });

  const [deptFilter, setDeptFilter] = useState<string>('');
  useEffect(() => {
    if (!deptFilter && departmentList.length > 0) setDeptFilter(departmentList[0].departmentId);
  }, [deptFilter, departmentList]);
  const departmentById = useMemo(() => new Map(departmentList.map(d => [d.departmentId, d])), [departmentList]);
  const filteredPositions = deptFilter ? positions.filter(p => p.departmentId === deptFilter) : positions;
  const selectedDeptHasCareerPath = departmentById.get(deptFilter)?.hasCareerPath ?? true;

  // ── Positions editing ──────────────────────────────────────────────
  // Inline editing moved to a dedicated page at
  //   /settings/employee-salary/positions/new
  //   /settings/employee-salary/positions/:id/edit
  // The list page now just renders the table + dispatches navigation.
  const [menuOpenPosId, setMenuOpenPosId] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);

  const onDragStart = (idx: number) => (e: React.DragEvent) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropIdx !== idx) setDropIdx(idx);
  };
  const onDragEnd = () => { setDragIdx(null); setDropIdx(null); };
  const onDrop = (idx: number) => async (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) { onDragEnd(); return; }
    // Reorder within the currently-filtered department only — reuse that
    // department's own existing sortOrder values so other departments'
    // positions (outside this filtered view) are never touched.
    const currentList = filteredPositions;
    const reordered = [...currentList];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);
    onDragEnd();
    const sortOrders = currentList.map(p => p.sortOrder).slice().sort((a, b) => a - b);
    for (let i = 0; i < reordered.length; i++) {
      const pos = reordered[i];
      const newSortOrder = sortOrders[i];
      if (pos.sortOrder === newSortOrder) continue;
      await upsertPosition(pos.positionId, {
        name: pos.name, titleWeight: pos.titleWeight, basicSalary: pos.basicSalary,
        maxLevel: pos.maxLevel, sortOrder: newSortOrder, inCareerProgression: pos.inCareerProgression,
        badgeUrl: pos.badgeUrl, starColor: pos.starColor,
      });
    }
    qc.invalidateQueries({ queryKey: ['salary-positions'] });
    showToast('Order updated');
  };

  // Edit / Add navigate to the dedicated page instead of inline-
  // editing the row. Keeps the list clean and gives the form room
  // for fields like description and richer help text.
  const openEditPos = (p: Position) => navigate(`/settings/employee-salary/positions/${p.positionId}/edit`);
  const openAddPos = () => navigate('/settings/employee-salary/positions/new');

  const removePos = async (pos: Position) => {
    const ok = await confirmDelete({
      entityType: 'position',
      entityName: `${pos.positionId} — ${pos.name}`,
      title: 'Delete this position?',
      consequence: <>Position <strong>{pos.positionId}</strong> and its level incentives will be permanently removed.</>,
      dependencies: [{ label: 'teacher', count: teacherCountByPos.get(pos.positionId) ?? 0 }],
      onConfirm: async () => {
        try {
          await deletePosition(pos.positionId);
          qc.invalidateQueries({ queryKey: ['salary-positions'] });
          qc.invalidateQueries({ queryKey: ['salary-incentives'] });
        } catch (e: any) {
          const msg = e?.message ?? 'Failed to delete';
          try { showToast(JSON.parse(msg).message, 'error'); } catch { showToast(msg, 'error'); }
          throw e;
        }
      },
    });
    if (ok) showToast(`${pos.positionId} deleted`);
  };

  // ── Level incentive matrix ─────────────────────────────────────────
  const incMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of incentives) m.set(`${i.positionId}|${i.level}`, i.amount);
    return m;
  }, [incentives]);

  const [matrixDraft, setMatrixDraft] = useState<Map<string, string>>(new Map());
  const [matrixSaving, setMatrixSaving] = useState(false);

  const getMatrixVal = (posId: string, level: number): string => {
    const key = `${posId}|${level}`;
    if (matrixDraft.has(key)) return matrixDraft.get(key)!;
    return String(incMap.get(key) ?? 0);
  };

  const setMatrixVal = (posId: string, level: number, val: string) => {
    setMatrixDraft(prev => {
      const next = new Map(prev);
      next.set(`${posId}|${level}`, val);
      return next;
    });
  };

  const saveMatrix = async () => {
    setMatrixSaving(true);
    const matrix: { positionId: string; level: number; amount: number }[] = [];
    for (const pos of positions) {
      for (let lvl = 0; lvl <= pos.maxLevel; lvl++) {
        const val = parseFloat(getMatrixVal(pos.positionId, lvl)) || 0;
        matrix.push({ positionId: pos.positionId, level: lvl, amount: val });
      }
    }
    try {
      await upsertLevelIncentives(matrix);
      qc.invalidateQueries({ queryKey: ['salary-incentives'] });
      qc.invalidateQueries({ queryKey: ['salary-teachers'] });
      setMatrixDraft(new Map());
      showToast('Level incentives saved');
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to save', 'error');
    }
    setMatrixSaving(false);
  };

  const hasMatrixChanges = matrixDraft.size > 0;

  // ── Teacher salary count ───────────────────────────────────────────
  const teacherCountByPos = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of teachersSalary) if (t.positionId) m.set(t.positionId, (m.get(t.positionId) ?? 0) + 1);
    return m;
  }, [teachersSalary]);

  if (posLoading) return <div style={embedded ? undefined : s.page}><div style={s.inner}><p style={{ color: C.muted }}>Loading...</p></div></div>;

  return (
    <div style={embedded ? undefined : s.page}>
      <div style={s.inner}>
        {!embedded && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
            <h1 style={{ ...s.heading, margin: 0 }}>Employee Salary</h1>
            <SettingsBreadcrumb label="Employee Salary" inline />
          </div>
        )}

        {departmentList.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {departmentList.map(d => (
              <button key={d.departmentId} onClick={() => setDeptFilter(d.departmentId)} style={deptFilter === d.departmentId ? s.deptPillActive : s.deptPill}>
                {d.name}
              </button>
            ))}
          </div>
        )}

        {/* ── Positions table ── */}
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={s.sectionTitle}>Positions</h2>
            <button onClick={openAddPos} style={s.addBtn}>
              <FontAwesomeIcon icon={faPlus} style={{ fontSize: 10 }} /> Add Position
            </button>
          </div>

          <div>
            <table style={{ ...s.table, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 32 }} />
                <col style={{ width: 56 }} />
                <col />
                <col style={{ width: 100 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 76 }} />
                <col style={{ width: 96 }} />
                <col style={{ width: 130 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={s.th} />
                  {['ID', 'Position', 'Basic Salary', 'Has Levels', 'Max Level', 'Title Weight', ''].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPositions.map((pos, idx) => {
                  const tCount = teacherCountByPos.get(pos.positionId) ?? 0;
                  const isDragging = dragIdx === idx;
                  const isDropTarget = dropIdx === idx && dragIdx !== null && dragIdx !== idx;
                  return (
                    <tr
                      key={pos.positionId}
                      style={{ ...s.tr, cursor: 'default', opacity: isDragging ? 0.4 : 1, borderTop: isDropTarget ? '2px solid #5a67d8' : undefined }}
                      onDragOver={onDragOver(idx)}
                      onDrop={onDrop(idx)}
                    >
                      <td style={{ ...s.td, padding: '6px 4px 6px 10px' }}>
                        <span draggable onDragStart={onDragStart(idx)} onDragEnd={onDragEnd}
                          title="Drag to reorder"
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, color: C.muted, cursor: 'grab', fontSize: 12 }}>
                          <FontAwesomeIcon icon={faGripVertical} />
                        </span>
                      </td>
                      <td style={s.td}><span style={s.posId}>{pos.positionId}</span></td>
                      <td style={s.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {pos.badgeUrl && (
                            <img
                              src={uploadUrl(pos.badgeUrl)}
                              alt=""
                              style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }}
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          )}
                          <span style={{ fontWeight: 600, color: C.text }}>{pos.name}</span>
                          {departmentList.length > 1 && pos.departmentId && (
                            <span style={s.deptBadge}>{departmentById.get(pos.departmentId)?.name ?? pos.departmentId}</span>
                          )}
                        </div>
                      </td>
                      <td style={s.td}><span style={{ fontWeight: 600 }}>{fmtRM(pos.basicSalary)}</span></td>
                      <td style={{ ...s.td, textAlign: 'center' }}>
                        {pos.maxLevel > 0
                          ? <span style={{ fontSize: 11, fontWeight: 600, color: C.green }}>Yes</span>
                          : <span style={{ fontSize: 11, color: C.muted }}>No</span>
                        }
                      </td>
                      <td style={{ ...s.td, textAlign: 'center' }}>{pos.maxLevel > 0 ? pos.maxLevel : '—'}</td>
                      <td style={{ ...s.td, textAlign: 'center', color: C.muted }}>{pos.titleWeight}</td>
                      <td style={{ ...s.td, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button onClick={() => openEditPos(pos)} style={s.actionBtn} title="Edit">
                            <FontAwesomeIcon icon={faPen} style={{ fontSize: 11 }} />
                          </button>
                          <MoreMenuTrigger
                            isOpen={menuOpenPosId === pos.positionId}
                            onToggle={() => setMenuOpenPosId(menuOpenPosId === pos.positionId ? null : pos.positionId)}
                            onDelete={() => { setMenuOpenPosId(null); removePos(pos); }}
                            onClose={() => setMenuOpenPosId(null)}
                            disabled={tCount > 0}
                            disabledReason={tCount > 0 ? `Cannot delete — ${tCount} teacher(s) assigned` : undefined}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Level Incentive Matrix — only applicable to departments with a
             career ladder; levels-based pay increments don't mean anything
             for a department that has no career path. ── */}
        {selectedDeptHasCareerPath ? (
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={s.sectionTitle}>Level Incentive Matrix</h2>
                <p style={{ fontSize: 12, color: C.muted, margin: '4px 0 0' }}>Incentive amount per position and level</p>
              </div>
              <button onClick={saveMatrix} disabled={!hasMatrixChanges || matrixSaving}
                style={{ ...s.saveBtn, opacity: hasMatrixChanges && !matrixSaving ? 1 : 0.4 }}>
                {matrixSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Position</th>
                    {Array.from({ length: MAX_LEVEL - MIN_LEVEL + 1 }, (_, i) => i + MIN_LEVEL).map(lvl => (
                      <th key={lvl} style={{ ...s.th, textAlign: 'center' }}>Level {lvl}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPositions.filter(pos => pos.maxLevel > 0).map(pos => (
                    <tr key={pos.positionId} style={s.tr}>
                      <td style={s.td}>
                        <span style={{ fontWeight: 600, color: C.text }}>{pos.positionId}</span>
                        <span style={{ fontSize: 11, color: C.muted, marginLeft: 6 }}>{pos.name}</span>
                      </td>
                      {Array.from({ length: MAX_LEVEL - MIN_LEVEL + 1 }, (_, i) => i + MIN_LEVEL).map(lvl => (
                        <td key={lvl} style={{ ...s.td, textAlign: 'center', padding: '4px 6px' }}>
                          {lvl <= pos.maxLevel ? (
                            <input
                              type="text" inputMode="numeric"
                                                         value={getMatrixVal(pos.positionId, lvl)}
                              onChange={e => setMatrixVal(pos.positionId, lvl, numOnly(e.target.value))}
                              style={s.matrixInput}
                            />
                          ) : (
                            <span style={{ color: '#e2e8f0' }}>—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{ ...s.card, textAlign: 'center', padding: '28px 20px', color: C.muted, fontSize: 13 }}>
            {departmentById.get(deptFilter)?.name ?? 'This department'} has no career path — the Level Incentive Matrix doesn't apply.
          </div>
        )}

      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: C.text },
  inner: { maxWidth: 960, margin: '0 auto' },
  heading: { fontSize: 22, fontWeight: 800, color: C.text, margin: '0 0 4px' },
  subtitle: { fontSize: 13, color: C.muted, margin: '0 0 24px' },
  card: {
    background: C.card,
    borderRadius: 14,
    padding: '22px 26px',
    border: '1px solid #eef0f4',
    marginBottom: 20,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)',
  },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: C.text, margin: 0 },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  th: { textAlign: 'left' as const, padding: '8px 12px', fontWeight: 600, fontSize: 11, color: C.muted, letterSpacing: '0.04em', textTransform: 'uppercase' as const, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' as const },
  td: { padding: '6px 8px', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: C.text, whiteSpace: 'nowrap' as const, height: 48, verticalAlign: 'middle' as const, overflow: 'hidden' as const },
  tr: { cursor: 'pointer', transition: 'background 0.1s' },
  posId: { display: 'inline-block', padding: '2px 8px', fontSize: 11, fontWeight: 700, borderRadius: 4, background: '#f1f5f9', color: C.text, letterSpacing: '0.03em' },
  deptBadge: { display: 'inline-block', padding: '1px 7px', fontSize: 10, fontWeight: 600, borderRadius: 10, background: C.primaryLight, color: C.primary },
  deptPill: { padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 20, border: `1px solid ${C.border}`, background: '#fff', color: C.muted, cursor: 'pointer' },
  deptPillActive: { padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 20, border: `1px solid ${C.primary}`, background: C.primary, color: '#fff', cursor: 'pointer' },
  countBadge: { display: 'inline-block', padding: '2px 8px', fontSize: 11, fontWeight: 600, borderRadius: 10, background: '#f1f5f9', color: C.muted },
  cellInput: { width: '100%', padding: '5px 8px', fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 6, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit', height: 32 },
  matrixInput: { width: 70, padding: '6px 8px', fontSize: 13, fontWeight: 600, border: `1px solid ${C.border}`, borderRadius: 6, outline: 'none', textAlign: 'center' as const, fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums' as any },
  addBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 7, border: `1px solid ${C.border}`, background: C.card, color: C.text, cursor: 'pointer' },
  saveBtn: { padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: C.primary, color: '#fff', cursor: 'pointer' },
  saveBtnSm: { padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', background: C.primary, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' as const },
  cancelBtnSm: { padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: C.muted, cursor: 'pointer', whiteSpace: 'nowrap' as const },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', color: C.danger, fontSize: 12, padding: '4px 6px' },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: '6px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s' },
};

function MoreMenuTrigger({ isOpen, onToggle, onDelete, onClose, disabled, disabledReason }: {
  isOpen: boolean; onToggle: () => void; onDelete: () => void; onClose: () => void;
  disabled?: boolean; disabledReason?: string;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.right - 140 });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (btnRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  return (
    <>
      <button ref={btnRef} onClick={onToggle} style={s.actionBtn}>
        <FontAwesomeIcon icon={faEllipsisVertical} style={{ fontSize: 13 }} />
      </button>
      {isOpen && ReactDOM.createPortal(
        <div ref={menuRef} style={{
          position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999,
          background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 140, overflow: 'hidden',
        }}>
          <button onClick={disabled ? undefined : onDelete} disabled={disabled} title={disabledReason}
            onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = '#fef2f2'; }}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '9px 14px', fontSize: 13, fontWeight: 500,
              color: disabled ? C.muted : C.danger,
              background: '#fff', border: 'none',
              cursor: disabled ? 'default' : 'pointer', textAlign: 'left',
              opacity: disabled ? 0.5 : 1,
            }}>
            <FontAwesomeIcon icon={faTrash} style={{ fontSize: 11 }} />
            Delete
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}

