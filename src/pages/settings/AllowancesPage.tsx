import { useState, useEffect, Fragment } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faTrash, faPen,
  // Icons exposed by the allowance icon picker — keep the IconDefinition
  // map below in sync with this list.
  faGift, faGaugeHigh, faCalendarCheck, faAward, faGraduationCap, faTrophy,
  faBookOpen, faMedal, faHandHoldingDollar, faSackDollar, faPiggyBank, faChartLine,
  faShieldHalved, faClock, faCheck, faBolt,
} from '@fortawesome/free-solid-svg-icons';
import { fetchAllowanceTypes, createAllowanceType, updateAllowanceType, deleteAllowanceType } from '../../api/allowance.js';
import { fetchSettings, patchSetting } from '../../api/settings.js';
import { useToast } from '../../components/common/Toast.js';

const C = {
  primary: '#5a67d8', primaryLight: '#eef0fa', card: '#fff', text: '#1e293b',
  muted: '#94a3b8', sub: '#475569', border: '#e2e8f0', danger: '#ef4444', green: '#059669',
};

/** Only allow digits (and optionally a decimal point) */
function numOnly(val: string): string { return val.replace(/[^\d.]/g, ''); }

// Applies to every employee regardless of department or career path —
// kept as its own destination so it doesn't sit inside the
// department-filtered Employee Salary tab.
export default function AllowancesPage() {
  const qc = useQueryClient();
  const { showToast } = useToast();

  const { data: allowTypes = [] } = useQuery({ queryKey: ['allowance-types'], queryFn: fetchAllowanceTypes });
  const [editingAllowId, setEditingAllowId] = useState<string | null>(null);
  const [addingForParentId, setAddingForParentId] = useState<string | null>(null);
  const [newAllowanceName, setNewAllowanceName] = useState('');
  const [newAllowanceIcon, setNewAllowanceIcon] = useState('gift');

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

  return (
    <div>
      <style>{`
        /* Allowance row action buttons — muted by default, color-shift
           on hover/focus. Edit picks up a neutral grey, Delete stays
           contained (only goes red on its own hover). */
        .allowance-action { color: #94a3b8; transition: color 120ms ease, background 120ms ease; }
        .allowance-action:hover { color: #475569; background: #f1f5f9; }
        .allowance-action.danger:hover { color: #dc2626; background: #fef2f2; }
      `}</style>

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
  card: {
    background: C.card,
    borderRadius: 14,
    padding: '22px 26px',
    border: '1px solid #eef0f4',
    marginBottom: 20,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)',
  },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: C.text, margin: 0 },
  cellInput: { width: '100%', padding: '5px 8px', fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 6, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit', height: 32 },
  saveBtn: { padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: C.primary, color: '#fff', cursor: 'pointer' },
  saveBtnSm: { padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', background: C.primary, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' as const },
  cancelBtnSm: { padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: C.muted, cursor: 'pointer', whiteSpace: 'nowrap' as const },
};
