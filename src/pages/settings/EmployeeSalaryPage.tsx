import { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import ReactDOM from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faTrash, faPen, faGripVertical, faEllipsisVertical, faUpload, faXmark, faSpinner, faStar,
  // Icons exposed by the allowance icon picker — keep the IconDefinition
  // map below in sync with this list.
  faGift, faGaugeHigh, faCalendarCheck, faAward, faGraduationCap, faTrophy,
  faBookOpen, faMedal, faHandHoldingDollar, faSackDollar, faPiggyBank, faChartLine,
  faShieldHalved, faClock, faCheck, faBolt,
} from '@fortawesome/free-solid-svg-icons';
import { fetchPositions, upsertPosition, deletePosition, fetchLevelIncentives, upsertLevelIncentives, fetchTeachersWithSalary } from '../../api/salary.js';
import { uploadBadge, uploadUrl } from '../../api/upload.js';
import { fetchAllowanceTypes, createAllowanceType, updateAllowanceType, deleteAllowanceType } from '../../api/allowance.js';
import { fetchSettings, patchSetting } from '../../api/settings.js';
import { Position } from '../../types/index.js';
import { useToast } from '../../components/common/Toast.js';
import { useDeleteDialog } from '../../components/common/DeleteDialog.js';
import { SettingsBreadcrumb } from '../../components/common/SettingsBreadcrumb.js';

const C = {
  primary: '#5a67d8', card: '#fff', text: '#1e293b',
  muted: '#94a3b8', border: '#e2e8f0', danger: '#ef4444', green: '#059669',
};
const MIN_LEVEL = 1;
const MAX_LEVEL = 5;

function fmtRM(v: number) { return `RM ${v.toLocaleString('en-MY', { minimumFractionDigits: 0 })}`; }

/** Only allow digits (and optionally a decimal point) */
function numOnly(val: string): string { return val.replace(/[^\d.]/g, ''); }

export default function EmployeeSalaryPage() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { confirm: confirmDelete } = useDeleteDialog();

  const { data: positions = [], isLoading: posLoading } = useQuery({ queryKey: ['salary-positions'], queryFn: fetchPositions });
  const { data: allowTypes = [] } = useQuery({ queryKey: ['allowance-types'], queryFn: fetchAllowanceTypes });
  const { data: teachersSalary = [] } = useQuery({ queryKey: ['salary-teachers'], queryFn: fetchTeachersWithSalary });
  const { data: incentives = [] } = useQuery({ queryKey: ['salary-incentives'], queryFn: fetchLevelIncentives });

  // ── Positions editing ──────────────────────────────────────────────
  const [editingPos, setEditingPos] = useState<Position | null>(null);
  const [posForm, setPosForm] = useState({ positionId: '', name: '', titleWeight: 0, basicSalary: 0, maxLevel: 5, inCareerProgression: true, badgeUrl: '', starColor: '' });
  const [addingPos, setAddingPos] = useState(false);
  const [badgeUploading, setBadgeUploading] = useState(false);
  const badgeFileRef = useRef<HTMLInputElement | null>(null);

  const handleBadgeUpload = async (file: File) => {
    setBadgeUploading(true);
    try {
      const { url } = await uploadBadge(file);
      setPosForm(p => ({ ...p, badgeUrl: url }));
      showToast('Badge uploaded');
    } catch (e: any) {
      showToast(e?.message ?? 'Upload failed', 'error');
    }
    setBadgeUploading(false);
  };
  const [editingAllowId, setEditingAllowId] = useState<string | null>(null);
  const [addingForParentId, setAddingForParentId] = useState<string | null>(null);
  const [newAllowanceName, setNewAllowanceName] = useState('');
  const [newAllowanceIcon, setNewAllowanceIcon] = useState('gift');
  const [menuOpenPosId, setMenuOpenPosId] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);

  // ── Employer contribution settings ────────────────────────────────────
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings, staleTime: 60_000 });
  const [contribDraft, setContribDraft] = useState<Record<string, number | boolean>>({});
  const [contribSaving, setContribSaving] = useState(false);
  const getC = (key: string, def: number | boolean) => (contribDraft[key] !== undefined ? contribDraft[key] : ((settings as any)?.[key] ?? def)) as any;
  const setC = (key: string, v: number | boolean) => setContribDraft(p => ({ ...p, [key]: v }));

  const saveContribs = async () => {
    setContribSaving(true);
    try {
      const keys: [string, number | boolean][] = [
        ['epf_enabled', getC('epf_enabled', true)],
        ['epf_rate_below', getC('epf_rate_below', 13)],
        ['epf_rate_above', getC('epf_rate_above', 12)],
        ['epf_threshold', getC('epf_threshold', 5000)],
        ['socso_enabled', getC('socso_enabled', true)],
        ['socso_rate', getC('socso_rate', 1.75)],
        ['socso_ceiling', getC('socso_ceiling', 4000)],
        ['eis_enabled', getC('eis_enabled', true)],
        ['eis_rate', getC('eis_rate', 0.4)],
        ['eis_ceiling', getC('eis_ceiling', 4000)],
      ];
      await Promise.all(keys.map(([k, v]) => patchSetting(k, v)));
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['employer-contributions'] });
      setContribDraft({});
      showToast('Contribution rates saved');
    } catch (e: any) { showToast(e?.message ?? 'Failed to save', 'error'); }
    setContribSaving(false);
  };

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
    const reordered = [...positions];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);
    onDragEnd();
    // Save new sortOrder only — weight is user-managed
    for (let i = 0; i < reordered.length; i++) {
      const pos = reordered[i];
      await upsertPosition(pos.positionId, {
        name: pos.name, titleWeight: pos.titleWeight, basicSalary: pos.basicSalary,
        maxLevel: pos.maxLevel, sortOrder: i, inCareerProgression: pos.inCareerProgression,
        badgeUrl: pos.badgeUrl, starColor: pos.starColor,
      });
    }
    qc.invalidateQueries({ queryKey: ['salary-positions'] });
    showToast('Order updated');
  };

  const openEditPos = (p: Position) => {
    setEditingPos(p);
    setPosForm({ positionId: p.positionId, name: p.name, titleWeight: p.titleWeight, basicSalary: p.basicSalary, maxLevel: p.maxLevel, inCareerProgression: p.inCareerProgression, badgeUrl: p.badgeUrl ?? '', starColor: p.starColor ?? '' });
  };

  const savePos = async () => {
    const id = addingPos ? posForm.positionId.trim().toUpperCase() : editingPos!.positionId;
    if (!id || !posForm.name.trim()) return;
    try {
      await upsertPosition(id, {
        name: posForm.name.trim(),
        titleWeight: posForm.titleWeight,
        basicSalary: posForm.basicSalary,
        maxLevel: posForm.maxLevel,
        sortOrder: addingPos ? positions.length : undefined,
        inCareerProgression: posForm.inCareerProgression,
        badgeUrl: posForm.badgeUrl.trim() || null,
        starColor: posForm.starColor.trim() || null,
      });
      qc.invalidateQueries({ queryKey: ['salary-positions'] });
      qc.invalidateQueries({ queryKey: ['salary-incentives'] });
      showToast(addingPos ? `${id} added` : `${id} updated`);
      setEditingPos(null);
      setAddingPos(false);
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to save', 'error');
    }
  };

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

  if (posLoading) return <div style={s.page}><div style={s.inner}><p style={{ color: C.muted }}>Loading...</p></div></div>;

  return (
    <div style={s.page}>
      <style>{`
        /* Allowance row action buttons — muted by default, color-shift
           on hover/focus. Edit picks up a neutral grey, Delete stays
           contained (only goes red on its own hover). */
        .allowance-action { color: #94a3b8; transition: color 120ms ease, background 120ms ease; }
        .allowance-action:hover { color: #475569; background: #f1f5f9; }
        .allowance-action.danger:hover { color: #dc2626; background: #fef2f2; }
      `}</style>
      <div style={s.inner}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
          <h1 style={{ ...s.heading, margin: 0 }}>Employee Salary</h1>
          <SettingsBreadcrumb label="Employee Salary" inline />
        </div>

        {/* ── Positions table ── */}
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={s.sectionTitle}>Positions</h2>
            <button onClick={() => { setAddingPos(true); setPosForm({ positionId: '', name: '', titleWeight: 0, basicSalary: 0, maxLevel: 5, inCareerProgression: true, badgeUrl: '', starColor: '' }); }}
              style={s.addBtn}>
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
                <col style={{ width: 84 }} />
                <col style={{ width: 96 }} />
                <col style={{ width: 130 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={s.th} />
                  {['ID', 'Position', 'Basic Salary', 'Has Levels', 'Max Level', 'Title Weight', 'Career Path', ''].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positions.map((pos, idx) => {
                  const isEditing = editingPos?.positionId === pos.positionId;
                  const tCount = teacherCountByPos.get(pos.positionId) ?? 0;
                  const isDragging = dragIdx === idx;
                  const isDropTarget = dropIdx === idx && dragIdx !== null && dragIdx !== idx;
                  return (
                    <Fragment key={pos.positionId}>
                    <tr
                      style={{ ...s.tr, cursor: 'default', opacity: isDragging ? 0.4 : 1, borderTop: isDropTarget ? '2px solid #5a67d8' : undefined }}
                      onDragOver={onDragOver(idx)}
                      onDrop={onDrop(idx)}
                    >
                      {isEditing ? (
                        <>
                          <td style={s.td} />
                          <td style={s.td}><span style={s.posId}>{pos.positionId}</span></td>
                          <td style={s.td}><input style={s.cellInput} value={posForm.name} onChange={e => setPosForm(p => ({ ...p, name: e.target.value }))} autoFocus /></td>
                          <td style={s.td}><input style={s.cellInput} type="text" inputMode="numeric" value={posForm.basicSalary} onChange={e => setPosForm(p => ({ ...p, basicSalary: Number(numOnly(e.target.value)) }))} /></td>
                          <td style={{ ...s.td, textAlign: 'center' }}>
                            <input type="checkbox" checked={posForm.maxLevel > 0} onChange={e => setPosForm(p => ({ ...p, maxLevel: e.target.checked ? 5 : 0 }))} />
                          </td>
                          <td style={s.td}>
                            {posForm.maxLevel > 0
                              ? <input style={{ ...s.cellInput, textAlign: 'center' }} type="text" inputMode="numeric" value={posForm.maxLevel} onChange={e => setPosForm(p => ({ ...p, maxLevel: Math.max(1, Number(numOnly(e.target.value))) }))} />
                              : <span style={{ color: C.muted, textAlign: 'center', display: 'block' }}>—</span>
                            }
                          </td>
                          <td style={s.td}>
                            <input style={{ ...s.cellInput, textAlign: 'center' }} type="text" inputMode="numeric" value={posForm.titleWeight} onChange={e => setPosForm(p => ({ ...p, titleWeight: Number(numOnly(e.target.value)) }))} />
                          </td>
                          <td style={{ ...s.td, textAlign: 'center' }}>
                            <input type="checkbox" checked={posForm.inCareerProgression} onChange={e => setPosForm(p => ({ ...p, inCareerProgression: e.target.checked }))} title="Include in career progression ladder" />
                          </td>
                          <td style={{ ...s.td, textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button onClick={savePos} style={s.saveBtnSm}>Save</button>
                              <button onClick={() => setEditingPos(null)} style={s.cancelBtnSm}>Cancel</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ ...s.td, padding: '6px 4px 6px 10px' }}>
                            <span draggable onDragStart={onDragStart(idx)} onDragEnd={onDragEnd}
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
                          <td style={{ ...s.td, textAlign: 'center' }}>
                            {pos.inCareerProgression
                              ? <span style={{ fontSize: 11, fontWeight: 600, color: C.green }}>On path</span>
                              : <span style={{ fontSize: 11, color: C.muted }}>Off path</span>
                            }
                          </td>
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
                        </>
                      )}
                    </tr>
                    {/* Sub-row: badge upload — only while editing this row. */}
                    {isEditing && (
                      <tr style={{ ...s.tr, background: '#fafbfc' }}>
                        <td style={s.td} />
                        <td style={s.td} />
                        <td colSpan={6} style={{ ...s.td, padding: '6px 12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                              Badge image
                            </span>
                            <div style={{
                              width: 40, height: 40, borderRadius: 8,
                              border: `1px solid ${C.border}`, background: '#fff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              overflow: 'hidden', flexShrink: 0,
                            }}>
                              {posForm.badgeUrl ? (
                                <img
                                  src={uploadUrl(posForm.badgeUrl)}
                                  alt={pos.name}
                                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                  onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                                />
                              ) : (
                                <span style={{ fontSize: 11, color: C.muted }}>—</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                              <input
                                ref={badgeFileRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                style={{ display: 'none' }}
                                onChange={e => {
                                  const f = e.target.files?.[0];
                                  if (f) handleBadgeUpload(f);
                                  e.target.value = '';
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => badgeFileRef.current?.click()}
                                disabled={badgeUploading}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 6,
                                  padding: '6px 10px', fontSize: 12, fontWeight: 600,
                                  color: C.text, background: '#fff',
                                  border: `1px solid ${C.border}`, borderRadius: 6,
                                  cursor: badgeUploading ? 'wait' : 'pointer',
                                  opacity: badgeUploading ? 0.6 : 1,
                                }}
                              >
                                <FontAwesomeIcon
                                  icon={badgeUploading ? faSpinner : faUpload}
                                  spin={badgeUploading}
                                  style={{ fontSize: 11 }}
                                />
                                {posForm.badgeUrl ? 'Replace image' : 'Upload image'}
                              </button>
                              {posForm.badgeUrl && !badgeUploading && (
                                <button
                                  type="button"
                                  onClick={() => setPosForm(p => ({ ...p, badgeUrl: '' }))}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    padding: '6px 8px', fontSize: 11, fontWeight: 600,
                                    color: C.danger, background: 'transparent',
                                    border: 'none', borderRadius: 6, cursor: 'pointer',
                                  }}
                                  title="Remove badge"
                                >
                                  <FontAwesomeIcon icon={faXmark} style={{ fontSize: 11 }} />
                                  Remove
                                </button>
                              )}
                              <span style={{ fontSize: 11, color: C.muted, marginLeft: 'auto' }}>
                                PNG, JPG, WebP or SVG · max 5 MB
                              </span>
                            </div>
                          </div>
                          {/* Star color — when a teacher completes all
                              missions in an achievement category at this
                              position, the achievement renders with a
                              star in this color. */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                              Star color
                            </span>
                            <StarColorPicker
                              value={posForm.starColor}
                              onChange={v => setPosForm(p => ({ ...p, starColor: v }))}
                            />
                            <span style={{ fontSize: 11, color: C.muted, marginLeft: 'auto' }}>
                              Earned when all category missions complete
                            </span>
                          </div>
                        </td>
                        <td style={s.td} />
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
                {addingPos && (
                  <tr style={{ ...s.tr, background: '#f0fdf4' }}>
                    <td style={s.td} />
                    <td style={s.td}><input style={s.cellInput} value={posForm.positionId} onChange={e => setPosForm(p => ({ ...p, positionId: e.target.value }))} placeholder="ID" autoFocus /></td>
                    <td style={s.td}><input style={s.cellInput} value={posForm.name} onChange={e => setPosForm(p => ({ ...p, name: e.target.value }))} placeholder="Position name" /></td>
                    <td style={s.td}><input style={s.cellInput} type="text" inputMode="numeric" value={posForm.basicSalary} onChange={e => setPosForm(p => ({ ...p, basicSalary: Number(numOnly(e.target.value)) }))} /></td>
                    <td style={{ ...s.td, textAlign: 'center' }}>
                      <input type="checkbox" checked={posForm.maxLevel > 0} onChange={e => setPosForm(p => ({ ...p, maxLevel: e.target.checked ? 5 : 0 }))} />
                    </td>
                    <td style={s.td}>
                      {posForm.maxLevel > 0
                        ? <input style={{ ...s.cellInput, textAlign: 'center' }} type="text" inputMode="numeric" value={posForm.maxLevel} onChange={e => setPosForm(p => ({ ...p, maxLevel: Math.max(1, Number(numOnly(e.target.value))) }))} />
                        : <span style={{ color: C.muted, textAlign: 'center', display: 'block' }}>—</span>
                      }
                    </td>
                    <td style={{ ...s.td, textAlign: 'center', color: C.muted }}>auto</td>
                    <td style={{ ...s.td, textAlign: 'center' }}>
                      <input type="checkbox" checked={posForm.inCareerProgression} onChange={e => setPosForm(p => ({ ...p, inCareerProgression: e.target.checked }))} title="Include in career progression ladder" />
                    </td>
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={savePos} style={s.saveBtnSm}>Add</button>
                        <button onClick={() => setAddingPos(false)} style={s.cancelBtnSm}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Level Incentive Matrix ── */}
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
                {positions.filter(pos => pos.maxLevel > 0).map(pos => (
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

        {/* ── Allowance Types ──
            System types are fixed (rename/icon/status only). Sub-types
            can be added under "Other Allowance" — these are admin-
            created and deletable. */}
        <div style={s.card}>
          <div style={{ marginBottom: 14 }}>
            <h2 style={s.sectionTitle}>Allowance Types</h2>
            <p style={{ fontSize: 12, color: C.muted, margin: '3px 0 0' }}>
              System-managed allowance categories. Sub-allowances can be added under <strong>Other Allowance</strong>.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {allowTypes
              .filter((at: any) => !at.parentId)
              .map((parent: any) => {
                const isOther = parent.name.trim().toLowerCase() === 'other allowance';
                const subTypes = allowTypes.filter((c: any) => c.parentId === parent.id);
                // Top-level rows that aren't system-seeded (isDefault=false)
                // are admin-created and removable. The 5 default types
                // stay protected.
                const topLevelDeletable = !parent.isDefault;
                return (
                  <Fragment key={parent.id}>
                    <AllowanceTypeRow
                      type={parent}
                      isEditing={editingAllowId === parent.id}
                      onStartEdit={() => setEditingAllowId(parent.id)}
                      onStopEdit={() => setEditingAllowId(null)}
                      onUpdate={async (data) => {
                        if (Object.keys(data).length === 0) return;
                        await updateAllowanceType(parent.id, data);
                        qc.invalidateQueries({ queryKey: ['allowance-types'] });
                        showToast(`${data.name ?? parent.name} updated`);
                      }}
                      onDelete={topLevelDeletable ? async () => {
                        await deleteAllowanceType(parent.id);
                        qc.invalidateQueries({ queryKey: ['allowance-types'] });
                        showToast(`${parent.name} removed`);
                      } : undefined}
                    />
                    {(subTypes.length > 0 || isOther) && (
                      <div style={{
                        paddingLeft: 24,
                        display: 'flex', flexDirection: 'column',
                      }}>
                        {subTypes.map((child: any) => (
                          <AllowanceTypeRow
                            key={child.id}
                            type={child}
                            isChild
                            isEditing={editingAllowId === child.id}
                            onStartEdit={() => setEditingAllowId(child.id)}
                            onStopEdit={() => setEditingAllowId(null)}
                            onUpdate={async (data) => {
                              if (Object.keys(data).length === 0) return;
                              await updateAllowanceType(child.id, data);
                              qc.invalidateQueries({ queryKey: ['allowance-types'] });
                              showToast(`${data.name ?? child.name} updated`);
                            }}
                            // System-managed children (isDefault=true) cannot
                            // be deleted — only admin-added customs can.
                            onDelete={child.isDefault ? undefined : async () => {
                              await deleteAllowanceType(child.id);
                              qc.invalidateQueries({ queryKey: ['allowance-types'] });
                              showToast(`${child.name} removed`);
                            }}
                          />
                        ))}
                        {isOther && (
                          addingForParentId === parent.id ? (
                            <div style={{
                              display: 'flex', flexDirection: 'column', gap: 12,
                              padding: '12px 14px',
                              background: '#fff',
                              borderRadius: 8,
                              border: `1.5px solid ${C.primary}40`,
                            }}>
                              {/* Name */}
                              <input
                                style={{ ...s.cellInput, fontSize: 14, fontWeight: 500 }}
                                value={newAllowanceName}
                                onChange={e => setNewAllowanceName(e.target.value)}
                                placeholder="e.g. Long-Service Allowance"
                                autoFocus
                                onKeyDown={e => {
                                  if (e.key === 'Escape') {
                                    setNewAllowanceName('');
                                    setNewAllowanceIcon('gift');
                                    setAddingForParentId(null);
                                  }
                                }}
                              />
                              {/* Icon picker */}
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Icon</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6 }}>
                                  {ALLOWANCE_ICONS.map(opt => {
                                    const selected = newAllowanceIcon === opt.key;
                                    return (
                                      <button
                                        key={opt.key}
                                        type="button"
                                        onClick={() => setNewAllowanceIcon(opt.key)}
                                        title={opt.label}
                                        style={{
                                          width: '100%', height: 36,
                                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                          background: selected ? `${C.primary}14` : '#fff',
                                          border: `1px solid ${selected ? C.primary : '#e5e7eb'}`,
                                          borderRadius: 8, cursor: 'pointer',
                                          color: selected ? C.primary : C.muted,
                                        }}
                                      >
                                        <FontAwesomeIcon icon={opt.icon} />
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              {/* Save / Cancel */}
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button
                                  onClick={() => {
                                    setNewAllowanceName('');
                                    setNewAllowanceIcon('gift');
                                    setAddingForParentId(null);
                                  }}
                                  style={s.cancelBtnSm}
                                >Cancel</button>
                                <button
                                  onClick={async () => {
                                    if (!newAllowanceName.trim()) return;
                                    const name = newAllowanceName.trim();
                                    // Sub-allowance inherits the parent's
                                    // isGuaranteed status — the comp page rolls
                                    // children up under the parent's badge anyway.
                                    await createAllowanceType({
                                      name,
                                      sortOrder: allowTypes.length,
                                      parentId: parent.id,
                                      icon: newAllowanceIcon,
                                      isGuaranteed: parent.isGuaranteed,
                                    });
                                    qc.invalidateQueries({ queryKey: ['allowance-types'] });
                                    showToast(`${name} added`);
                                    setNewAllowanceName('');
                                    setNewAllowanceIcon('gift');
                                    setAddingForParentId(null);
                                  }}
                                  disabled={!newAllowanceName.trim()}
                                  style={{ ...s.saveBtnSm, opacity: newAllowanceName.trim() ? 1 : 0.5 }}
                                >Add</button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setAddingForParentId(parent.id);
                                setNewAllowanceName('');
                                setNewAllowanceIcon('gift');
                                setNewAllowanceGuaranteed(true);
                              }}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: '6px 12px', alignSelf: 'flex-start',
                                fontSize: 12, fontWeight: 600,
                                border: `1px dashed ${C.border}`, borderRadius: 8,
                                background: 'transparent', color: C.muted, cursor: 'pointer',
                              }}
                            >
                              <FontAwesomeIcon icon={faPlus} style={{ fontSize: 10 }} />
                              Add sub-allowance
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </Fragment>
                );
              })}
          </div>
        </div>

        {/* ── Employer Contributions ── */}
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <h2 style={s.sectionTitle}>Employer Contribution Rates</h2>
              <p style={{ fontSize: 12, color: C.muted, margin: '3px 0 0' }}>Rates applied when calculating the employer contribution KPI</p>
            </div>
            <button onClick={saveContribs} disabled={contribSaving} style={s.saveBtn}>{contribSaving ? 'Saving…' : 'Save Rates'}</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>

            {/* EPF card */}
            {(() => {
              const enabled = getC('epf_enabled', true) as boolean;
              return (
                <div style={{ borderRadius: 10, border: `1.5px solid ${enabled ? '#5a67d8' : C.border}`, overflow: 'hidden', opacity: enabled ? 1 : 0.6, transition: 'all 0.2s' }}>
                  <div style={{ background: enabled ? '#5a67d8' : '#f1f5f9', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: enabled ? '#fff' : C.muted, letterSpacing: '0.04em' }}>EPF</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={enabled} onChange={e => setC('epf_enabled', e.target.checked)} style={{ accentColor: '#fff', width: 14, height: 14 }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: enabled ? '#ffffffcc' : C.muted }}>Enabled</span>
                    </label>
                  </div>
                  <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Salary Threshold (RM)</label>
                      <input type="text" inputMode="numeric" value={getC('epf_threshold', 5000)} onChange={e => setC('epf_threshold', Number(numOnly(e.target.value)) || 5000)} style={{ ...s.cellInput, width: '100%', boxSizing: 'border-box' as const }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Rate ≤ threshold</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="text" inputMode="numeric" value={getC('epf_rate_below', 13)} onChange={e => setC('epf_rate_below', Number(numOnly(e.target.value)) || 0)} style={{ ...s.cellInput, flex: 1 }} />
                          <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>%</span>
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Rate above</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="text" inputMode="numeric" value={getC('epf_rate_above', 12)} onChange={e => setC('epf_rate_above', Number(numOnly(e.target.value)) || 0)} style={{ ...s.cellInput, flex: 1 }} />
                          <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* SOCSO card */}
            {(() => {
              const enabled = getC('socso_enabled', true) as boolean;
              return (
                <div style={{ borderRadius: 10, border: `1.5px solid ${enabled ? '#0891b2' : C.border}`, overflow: 'hidden', opacity: enabled ? 1 : 0.6, transition: 'all 0.2s' }}>
                  <div style={{ background: enabled ? '#0891b2' : '#f1f5f9', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: enabled ? '#fff' : C.muted, letterSpacing: '0.04em' }}>SOCSO</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={enabled} onChange={e => setC('socso_enabled', e.target.checked)} style={{ accentColor: '#fff', width: 14, height: 14 }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: enabled ? '#ffffffcc' : C.muted }}>Enabled</span>
                    </label>
                  </div>
                  <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Employer Rate</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input type="text" inputMode="numeric" value={getC('socso_rate', 1.75)} onChange={e => setC('socso_rate', Number(numOnly(e.target.value)) || 0)} style={{ ...s.cellInput, flex: 1 }} />
                        <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>%</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Wage Ceiling (RM)</label>
                      <input type="text" inputMode="numeric" value={getC('socso_ceiling', 4000)} onChange={e => setC('socso_ceiling', Number(numOnly(e.target.value)) || 0)} style={{ ...s.cellInput, width: '100%', boxSizing: 'border-box' as const }} />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* EIS card */}
            {(() => {
              const enabled = getC('eis_enabled', true) as boolean;
              return (
                <div style={{ borderRadius: 10, border: `1.5px solid ${enabled ? '#059669' : C.border}`, overflow: 'hidden', opacity: enabled ? 1 : 0.6, transition: 'all 0.2s' }}>
                  <div style={{ background: enabled ? '#059669' : '#f1f5f9', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: enabled ? '#fff' : C.muted, letterSpacing: '0.04em' }}>EIS</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={enabled} onChange={e => setC('eis_enabled', e.target.checked)} style={{ accentColor: '#fff', width: 14, height: 14 }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: enabled ? '#ffffffcc' : C.muted }}>Enabled</span>
                    </label>
                  </div>
                  <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Employer Rate</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input type="text" inputMode="numeric" value={getC('eis_rate', 0.4)} onChange={e => setC('eis_rate', Number(numOnly(e.target.value)) || 0)} style={{ ...s.cellInput, flex: 1 }} />
                        <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>%</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Wage Ceiling (RM)</label>
                      <input type="text" inputMode="numeric" value={getC('eis_ceiling', 4000)} onChange={e => setC('eis_ceiling', Number(numOnly(e.target.value)) || 0)} style={{ ...s.cellInput, width: '100%', boxSizing: 'border-box' as const }} />
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>
        </div>

      </div>
    </div>
  );
}

// Curated icon set offered by the allowance type editor. Keys are the
// FontAwesome class names (without `fa` prefix) that get persisted to
// AllowanceType.icon and re-resolved on the Compensation page.
const ALLOWANCE_ICONS: { key: string; icon: any; label: string }[] = [
  { key: 'gift',                 icon: faGift,               label: 'Gift' },
  { key: 'gauge-high',           icon: faGaugeHigh,          label: 'Gauge' },
  { key: 'calendar-check',       icon: faCalendarCheck,      label: 'Calendar' },
  { key: 'award',                icon: faAward,              label: 'Award' },
  { key: 'graduation-cap',       icon: faGraduationCap,      label: 'Graduation' },
  { key: 'trophy',               icon: faTrophy,             label: 'Trophy' },
  { key: 'book-open',            icon: faBookOpen,           label: 'Book' },
  { key: 'medal',                icon: faMedal,              label: 'Medal' },
  { key: 'hand-holding-dollar',  icon: faHandHoldingDollar,  label: 'Cash' },
  { key: 'sack-dollar',          icon: faSackDollar,         label: 'Sack' },
  { key: 'piggy-bank',           icon: faPiggyBank,          label: 'Piggy' },
  { key: 'chart-line',           icon: faChartLine,          label: 'Chart' },
  { key: 'shield-halved',        icon: faShieldHalved,       label: 'Shield' },
  { key: 'clock',                icon: faClock,              label: 'Clock' },
  { key: 'check',                icon: faCheck,              label: 'Check' },
  { key: 'bolt',                 icon: faBolt,               label: 'Bolt' },
];

function getAllowanceIcon(key: string): any {
  return ALLOWANCE_ICONS.find(i => i.key === key)?.icon ?? faGift;
}

function AllowanceTypeRow({ type: at, isEditing, isChild = false, onStartEdit, onStopEdit, onUpdate, onDelete }: {
  type: any; isEditing: boolean;
  /** Sub-allowance row — rendered with lighter typography and tighter
   *  spacing so the parent/child hierarchy is obvious without
   *  relying on indentation alone. */
  isChild?: boolean;
  onStartEdit: () => void; onStopEdit: () => void;
  onUpdate: (data: { name?: string; icon?: string; isGuaranteed?: boolean }) => void;
  /** When set, renders a delete button next to Edit. Used for admin-
   *  added sub-allowances under Other Allowance. */
  onDelete?: () => void;
}) {
  const [name, setName] = useState(at.name);
  const [icon, setIcon] = useState<string>(at.icon ?? 'gift');
  const [isGuaranteed, setIsGuaranteed] = useState<boolean>(at.isGuaranteed ?? true);
  useEffect(() => {
    if (isEditing) {
      setName(at.name);
      setIcon(at.icon ?? 'gift');
      setIsGuaranteed(at.isGuaranteed ?? true);
    }
  }, [isEditing]);
  const save = () => {
    if (!name.trim()) { onStopEdit(); return; }
    const payload: { name?: string; icon?: string; isGuaranteed?: boolean } = {};
    if (name.trim() !== at.name) payload.name = name.trim();
    if (icon !== (at.icon ?? 'gift')) payload.icon = icon;
    if (isGuaranteed !== (at.isGuaranteed ?? true)) payload.isGuaranteed = isGuaranteed;
    onUpdate(payload);
    onStopEdit();
  };
  const cancel = () => {
    setName(at.name); setIcon(at.icon ?? 'gift'); setIsGuaranteed(at.isGuaranteed ?? true);
    onStopEdit();
  };
  const currentIconDef = getAllowanceIcon(at.icon ?? 'gift');

  return (
    <div className={isEditing ? '' : 'allowance-row'} style={{
      padding: isEditing ? '12px 14px' : '10px 12px',
      background: isEditing ? '#fff' : 'transparent',
      borderRadius: isEditing ? 8 : 0,
      border: isEditing ? `1.5px solid ${C.primary}40` : 'none',
      borderBottom: isEditing ? `1.5px solid ${C.primary}40` : '1px solid #f1f5f9',
    }}>
      {isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Name */}
          <input
            style={{ ...s.cellInput, fontSize: 14, fontWeight: 500 }}
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
          />
          {/* Icon picker */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Icon</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6 }}>
              {ALLOWANCE_ICONS.map(opt => {
                const selected = icon === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setIcon(opt.key)}
                    title={opt.label}
                    style={{
                      width: '100%', height: 36,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      background: selected ? `${C.primary}14` : '#fff',
                      border: `1px solid ${selected ? C.primary : '#e5e7eb'}`,
                      borderRadius: 8, cursor: 'pointer',
                      color: selected ? C.primary : C.muted,
                    }}
                  >
                    <FontAwesomeIcon icon={opt.icon} />
                  </button>
                );
              })}
            </div>
          </div>
          {/* Guarantee status — only on top-level types. Sub-allowances
              roll up under their parent on the Compensation page, so
              the parent's status drives the badge there; per-child
              status would be unused. */}
          {!isChild && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Status</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => setIsGuaranteed(true)}
                style={{
                  padding: '6px 12px', borderRadius: 6,
                  fontSize: 12, fontWeight: 600,
                  border: `1px solid ${isGuaranteed ? '#059669' : '#e5e7eb'}`,
                  background: isGuaranteed ? '#ecfdf5' : '#fff',
                  color: isGuaranteed ? '#059669' : C.muted,
                  cursor: 'pointer',
                }}
              >Guaranteed</button>
              <button
                type="button"
                onClick={() => setIsGuaranteed(false)}
                style={{
                  padding: '6px 12px', borderRadius: 6,
                  fontSize: 12, fontWeight: 600,
                  border: `1px solid ${!isGuaranteed ? C.primary : '#e5e7eb'}`,
                  background: !isGuaranteed ? '#eef2ff' : '#fff',
                  color: !isGuaranteed ? C.primary : C.muted,
                  cursor: 'pointer',
                }}
              >Has conditions</button>
            </div>
          </div>
          )}
          {/* Save / Cancel */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={cancel} style={s.cancelBtnSm}>Cancel</button>
            <button onClick={save} style={s.saveBtnSm}>Save</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 32 }}>
          <span style={{
            width: 26, height: 26, borderRadius: 6,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: '#eef0fa', color: C.primary,
            flexShrink: 0,
          }}>
            <FontAwesomeIcon icon={currentIconDef} style={{ fontSize: 11 }} />
          </span>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{
              fontSize: 13,
              fontWeight: 500,
              color: isChild ? C.sub : C.text,
            }}>
              {at.name}
            </span>
            {!isChild && (
              <span style={{
                fontSize: 10, fontWeight: 600,
                color: at.isGuaranteed ? '#059669' : C.primary,
                background: at.isGuaranteed ? '#ecfdf5' : '#eef2ff',
                padding: '2px 7px', borderRadius: 4,
                flexShrink: 0,
              }}>
                {at.isGuaranteed ? 'Guaranteed' : 'Has conditions'}
              </span>
            )}
          </div>
          <div className="row-actions" style={{ display: 'inline-flex', gap: 2 }}>
            <button
              onClick={onStartEdit}
              className="allowance-action"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              aria-label={`Edit ${at.name}`}
              title="Edit"
            >
              <FontAwesomeIcon icon={faPen} style={{ fontSize: 10 }} />
            </button>
            {onDelete && (
              <button
                onClick={onDelete}
                className="allowance-action danger"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label={`Delete ${at.name}`}
                title="Delete"
              >
                <FontAwesomeIcon icon={faTrash} style={{ fontSize: 10 }} />
              </button>
            )}
          </div>
        </div>
      )}
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

// Preset star colors mapped to common tier reads (silver → gold → blue
// → ...). Admin can pick any preset or input a custom hex via the input.
const STAR_COLOR_PRESETS: { color: string; label: string }[] = [
  { color: '#C0C0C0', label: 'Silver' },
  { color: '#FFD700', label: 'Gold' },
  { color: '#3B82F6', label: 'Blue' },
  { color: '#A855F7', label: 'Purple' },
  { color: '#10B981', label: 'Emerald' },
  { color: '#EF4444', label: 'Red' },
  { color: '#CD7F32', label: 'Bronze' },
  { color: '#1E293B', label: 'Onyx' },
];

function StarColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Preview star with the current color (or grey when unset) */}
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#fff', border: `1px solid ${C.border}`,
      }}>
        <FontAwesomeIcon
          icon={faStar}
          style={{
            fontSize: 14,
            color: value || '#cbd5e1',
            filter: value ? `drop-shadow(0 1px 2px ${value}66)` : 'none',
          }}
        />
      </div>
      {/* Preset swatches */}
      <div style={{ display: 'flex', gap: 4 }}>
        {STAR_COLOR_PRESETS.map(p => {
          const active = value.toLowerCase() === p.color.toLowerCase();
          return (
            <button
              key={p.color}
              type="button"
              title={p.label}
              onClick={() => onChange(p.color)}
              style={{
                width: 22, height: 22, borderRadius: '50%',
                background: p.color, cursor: 'pointer',
                border: active ? `2px solid ${C.text}` : `1px solid ${C.border}`,
                outline: 'none', padding: 0,
              }}
            />
          );
        })}
      </div>
      {/* Custom hex input */}
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="#FFD700"
        style={{
          width: 90, padding: '4px 8px', fontSize: 11,
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          border: `1px solid ${C.border}`, borderRadius: 6,
          color: C.text, background: '#fff',
        }}
      />
      {/* Clear button */}
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          style={{
            fontSize: 11, fontWeight: 600, color: C.danger,
            background: 'transparent', border: 'none', cursor: 'pointer', padding: 4,
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}

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
              cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left',
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

