import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faTrash, faCheck, faXmark, faPen, faEllipsisVertical, faGripVertical,
  faChalkboardUser, faGraduationCap, faClock, faBullhorn,
} from '@fortawesome/free-solid-svg-icons';
import { fetchSettings, patchSetting } from '../../api/settings.js';
import { SettingsBreadcrumb } from '../../components/common/SettingsBreadcrumb.js';
import { useToast } from '../../components/common/Toast.js';

// Two admin-curated lists that drive the public Apply form dropdowns:
//   - recruitment_positions     → "Position" dropdown
//   - recruitment_qualifications → "Highest qualification" dropdown
// Both are stored as string[] in SystemSetting and surfaced publicly via
// /api/candidates/form-options. Server falls back to sensible defaults if
// either key is unset, so a brand-new install still has a working form.

const C = {
  text: '#0f172a',
  textSub: '#3f4b5c',
  muted: '#64748b',
  border: '#e2e8f0',
  borderSoft: '#eef0f3',
  bg: '#f8fafc',
  surface: '#ffffff',
  primary: '#5a67d8',
  primaryDeep: '#3c339a',
  primarySoft: '#eef2ff',
  success: '#059669',
  successSoft: '#ecfdf5',
  danger: '#dc2626',
};

interface RecruitmentPosition {
  name: string;
  minSalary: number | null;
  maxSalary: number | null;
}

const DEFAULT_POSITIONS: RecruitmentPosition[] = [
  { name: 'Assistant Teacher',   minSalary: null, maxSalary: null },
  { name: 'Junior Teacher',      minSalary: null, maxSalary: null },
  { name: 'Senior Teacher',      minSalary: null, maxSalary: null },
  { name: 'Kindergarten Helper', minSalary: null, maxSalary: null },
];

/** Normalises whatever the settings row currently holds into the new
 *  shape. Old deployments may have stored plain strings — promote them
 *  to objects with null bands so nothing crashes. */
function normalizePositions(raw: unknown): RecruitmentPosition[] {
  if (!Array.isArray(raw)) return DEFAULT_POSITIONS;
  const clean: RecruitmentPosition[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const name = item.trim();
      if (name) clean.push({ name, minSalary: null, maxSalary: null });
      continue;
    }
    if (item && typeof item === 'object') {
      const rec = item as Record<string, unknown>;
      const name = typeof rec.name === 'string' ? rec.name.trim() : '';
      if (!name) continue;
      const min = typeof rec.minSalary === 'number' && rec.minSalary >= 0 ? rec.minSalary : null;
      const max = typeof rec.maxSalary === 'number' && rec.maxSalary >= 0 ? rec.maxSalary : null;
      clean.push({ name, minSalary: min, maxSalary: max });
    }
  }
  return clean.length > 0 ? clean : DEFAULT_POSITIONS;
}
const DEFAULT_QUALIFICATIONS = [
  'SPM / O Level',
  'Diploma / STPM / UEC / A Level',
  "Bachelor's degree",
  'Others',
];
// Keep in sync with DEFAULT_EXPERIENCE_RANGES in
// kindercore-backend/src/controllers/candidates.controller.ts.
const DEFAULT_EXPERIENCE_RANGES = [
  'No experience',
  'Less than 1 year',
  '1 – 2 years',
  '3 – 5 years',
  'More than 5 years',
];
// Keep in sync with DEFAULT_REFERRAL_SOURCES in
// kindercore-backend/src/controllers/candidates.controller.ts —
// both are fallbacks when no `recruitment_referral_sources` DB row
// exists yet, and if they drift the Settings page and the /apply
// dropdown show different lists.
/** Same slug rule as CandidatesPage's Copy-apply-link picker — keep in
 *  sync. Renders "Facebook Ads" → "facebook_ads" while preserving CJK. */
function toUtmSlug(label: string): string {
  return String(label ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^\w一-鿿]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const DEFAULT_REFERRAL_SOURCES = [
  'Transfer from other Ten Toes branch',
  'JobStreet',
  'Indeed',
  'Maukerja',
  'Facebook Group',
  'Facebook Ads',
  'MyFuture Job',
  'Other',
];

export default function RecruitmentSettingsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  const raw = localStorage.getItem('user');
  const user = raw ? (JSON.parse(raw) as { role: string }) : null;
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

  if (isLoading) return <p style={S.state}>Loading…</p>;
  if (isError) return <p style={{ ...S.state, color: C.danger }}>Failed to load settings.</p>;

  const positions: RecruitmentPosition[] = normalizePositions(data?.recruitment_positions);
  const qualifications: string[] = Array.isArray(data?.recruitment_qualifications)
    ? (data.recruitment_qualifications as string[])
    : DEFAULT_QUALIFICATIONS;
  const experienceRanges: string[] = Array.isArray(data?.recruitment_experience_ranges)
    ? (data.recruitment_experience_ranges as string[])
    : DEFAULT_EXPERIENCE_RANGES;
  const referralSources: string[] = Array.isArray(data?.recruitment_referral_sources)
    ? (data.recruitment_referral_sources as string[])
    : DEFAULT_REFERRAL_SOURCES;

  return (
    <div style={embedded ? undefined : S.page}>
      <style>{`
        .recruit-row { transition: background 0.12s ease; }
        .recruit-row:hover { background: #f7f9fc; }
        .recruit-row .row-actions { opacity: 0; transition: opacity 0.15s; }
        .recruit-row:hover .row-actions { opacity: 1; }
        .recruit-row:hover .recruit-grip { color: ${C.textSub} !important; }
        .recruit-grip:hover { color: ${C.primary} !important; background: ${C.primarySoft} !important; }
        .recruit-table tbody tr:last-child td { border-bottom: none !important; }
        .recruit-menu-btn:hover { background: #e2e8f0 !important; color: ${C.text} !important; }
        .recruit-menu-rename:hover { background: ${C.primarySoft} !important; color: ${C.primary} !important; }
        .recruit-menu-rename:hover svg { color: ${C.primary} !important; }
        .recruit-menu-danger:hover { background: #fef2f2 !important; }
      `}</style>
      <div style={embedded ? undefined : S.inner}>
        {!embedded && (
          <>
            <SettingsBreadcrumb label="Recruitment" />
            <h1 style={S.heading}>Recruitment</h1>
          </>
        )}
        <p style={S.sub}>
          Choices candidates see on the public apply form. Keep the list short
          and candidate-friendly — these are not the same as internal career
          ranks.
        </p>
        {!isAdmin && (
          <p style={S.readonly}>Read-only — admin role required to save changes.</p>
        )}

        <PositionsEditor
          initial={positions}
          isAdmin={isAdmin}
        />

        <ListEditor
          icon={faGraduationCap}
          title="Qualifications"
          description={'Highest education levels candidates can pick. Include "Others" to let candidates type in their own.'}
          settingKey="recruitment_qualifications"
          initial={qualifications}
          placeholder="e.g. Diploma / STPM"
          isAdmin={isAdmin}
        />

        <ListEditor
          icon={faClock}
          title="Years of teaching experience"
          description="Buckets candidates pick from on the apply form."
          settingKey="recruitment_experience_ranges"
          initial={experienceRanges}
          placeholder="e.g. 3 – 5 years"
          isAdmin={isAdmin}
        />

        <ListEditor
          icon={faBullhorn}
          title="How did you hear about us?"
          description="Sources candidates can pick to tell you where they found the job posting. Each source auto-derives a utm_source slug used by the Candidates page's tracked apply links."
          settingKey="recruitment_referral_sources"
          initial={referralSources}
          placeholder="e.g. LinkedIn"
          isAdmin={isAdmin}
          lockedValues={['Other']}
          showUtmSlug
        />

        <NumberEditor
          icon={faClock}
          title="Interview duration"
          description="How long each interview slot is blocked out in the scheduler and on Google Calendar."
          settingKey="interview_duration_minutes"
          initial={Number(data?.interview_duration_minutes) || 45}
          suffix="minutes"
          min={5}
          max={240}
          step={5}
          isAdmin={isAdmin}
        />

        <NumberEditor
          icon={faClock}
          title="Confirm-by lead time"
          description="How many calendar days after today the candidate has to confirm their interview slot. Used by the {{confirmByDate}} placeholder in the Interview Invitation WhatsApp template."
          settingKey="recruitment_interview_confirm_lead_days"
          initial={Number(data?.recruitment_interview_confirm_lead_days) || 2}
          suffix="days"
          min={1}
          max={30}
          step={1}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}

// ── Number editor ────────────────────────────────────────────────────
// Reusable single-number setting. Kept simple: number input, save button,
// works on any SystemSetting key that stores a numeric value.
function NumberEditor(props: {
  icon: any;
  title: string;
  description: string;
  settingKey: string;
  initial: number;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [value, setValue] = useState<string>(String(props.initial));
  useEffect(() => { setValue(String(props.initial)); }, [props.initial]);

  const parsed = Number(value);
  const isValid = Number.isFinite(parsed) && parsed > 0
    && (props.min == null || parsed >= props.min)
    && (props.max == null || parsed <= props.max);
  const dirty = String(props.initial) !== value.trim();

  const save = async () => {
    if (!isValid) return;
    try {
      await patchSetting(props.settingKey, parsed);
      showToast('Setting saved');
      qc.invalidateQueries({ queryKey: ['settings'] });
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to save', 'error');
    }
  };

  return (
    <section style={S.card}>
      <div style={S.cardHeader}>
        <div style={S.cardTitleWrap}>
          <FontAwesomeIcon icon={props.icon} style={{ color: C.primary, fontSize: 16 }} />
          <h2 style={S.cardTitle}>{props.title}</h2>
        </div>
        <p style={S.cardDesc}>{props.description}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <input
          type="number"
          value={value}
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          onChange={e => setValue(e.target.value)}
          readOnly={!props.isAdmin}
          style={{
            width: 120, padding: '9px 12px', border: `1px solid ${C.border}`,
            borderRadius: 8, fontSize: 14, background: props.isAdmin ? '#fff' : '#fafafa',
            color: C.text, fontFamily: 'inherit',
          }}
        />
        {props.suffix && (
          <span style={{ fontSize: 13, color: C.muted }}>{props.suffix}</span>
        )}
        {props.isAdmin && (
          <button
            type="button"
            onClick={save}
            disabled={!dirty || !isValid}
            style={{
              marginLeft: 'auto',
              background: dirty && isValid ? C.primary : '#cbd5e1', color: '#fff',
              border: 'none', padding: '7px 14px', borderRadius: 8,
              fontSize: 13, fontWeight: 600,
              cursor: dirty && isValid ? 'pointer' : 'default',
            }}
          >
            Save
          </button>
        )}
      </div>
    </section>
  );
}

// ─── Drag-to-reorder ─────────────────────────────────────────────────────────
// Same grip-only drag mechanics as DepartmentsPage — no up/down arrow
// buttons. Reorders local draft state; persisted on the next Save.
function useDragReorder<T>(setItems: React.Dispatch<React.SetStateAction<T[]>>, enabled: boolean) {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dragOverPos, setDragOverPos] = useState<'above' | 'below' | null>(null);

  const onDragStart = (idx: number) => (e: React.DragEvent) => {
    if (!enabled) return;
    e.dataTransfer.effectAllowed = 'move';
    setDraggedIdx(idx);
  };
  const onDragOver = (idx: number) => (e: React.DragEvent<HTMLElement>) => {
    if (!enabled || draggedIdx === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const pos: 'above' | 'below' = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
    if (dragOverIdx !== idx || dragOverPos !== pos) { setDragOverIdx(idx); setDragOverPos(pos); }
  };
  const onDragEnd = () => { setDraggedIdx(null); setDragOverIdx(null); setDragOverPos(null); };
  const onDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIdx === null) { onDragEnd(); return; }
    let insertIdx = dragOverPos === 'below' ? idx + 1 : idx;
    if (draggedIdx < insertIdx) insertIdx--;
    const from = draggedIdx;
    onDragEnd();
    if (insertIdx === from) return;
    setItems(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(insertIdx, 0, moved);
      return next;
    });
  };

  const rowStyle = (idx: number): React.CSSProperties => {
    const isDragging = draggedIdx === idx;
    const isDropTarget = dragOverIdx === idx && draggedIdx !== null && draggedIdx !== idx;
    // Only include border keys when actually needed — spreading an
    // explicit `undefined` value still overwrites the base row style's
    // borderBottom divider, silently erasing it on every render.
    const style: React.CSSProperties = { opacity: isDragging ? 0.4 : 1 };
    if (isDropTarget && dragOverPos === 'above') style.borderTop = `2px solid ${C.primary}`;
    if (isDropTarget && dragOverPos === 'below') style.borderBottom = `2px solid ${C.primary}`;
    return style;
  };

  return { onDragStart, onDragOver, onDragEnd, onDrop, rowStyle };
}

function DragGrip({ idx, enabled, reorder }: { idx: number; enabled: boolean; reorder: ReturnType<typeof useDragReorder> }) {
  return (
    <span
      draggable={enabled}
      onDragStart={reorder.onDragStart(idx)}
      onDragEnd={reorder.onDragEnd}
      title={enabled ? 'Drag to reorder' : undefined}
      className="recruit-grip"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 22, height: 22, flexShrink: 0, color: C.muted, fontSize: 12, borderRadius: 4,
        cursor: enabled ? 'grab' : 'default', transition: 'color 0.12s, background 0.12s',
      }}
    >
      <FontAwesomeIcon icon={faGripVertical} />
    </span>
  );
}

// ─── Row menu ────────────────────────────────────────────────────────────────
// Same "…" kebab → Rename/Delete dropdown as DepartmentsPage. Rows display
// as plain text; clicking Rename swaps the row into an editable input with
// Save/Cancel, instead of every row being permanently an open text field.
function RowMenu({ onRename, onDelete, renameLabel = 'Rename' }: {
  onRename: () => void; onDelete?: () => void; renameLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.right - 168 });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <>
      <button ref={btnRef} type="button" className="recruit-menu-btn" onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }} style={S.menuBtn} aria-label="More actions">
        <FontAwesomeIcon icon={faEllipsisVertical} style={{ fontSize: 14 }} />
      </button>
      {open && ReactDOM.createPortal(
        <div ref={menuRef} style={{ ...S.menu, top: pos.top, left: pos.left }}>
          <button type="button" className="recruit-menu-rename" style={S.menuItem} onClick={(e) => { e.stopPropagation(); setOpen(false); onRename(); }}>
            <FontAwesomeIcon icon={faPen} style={{ fontSize: 11, width: 14, color: C.muted }} />
            {renameLabel}
          </button>
          {onDelete && (
            <button type="button" className="recruit-menu-danger" style={{ ...S.menuItem, color: C.danger }} onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(); }}>
              <FontAwesomeIcon icon={faTrash} style={{ fontSize: 11, width: 14 }} />
              Delete
            </button>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

// ─── Positions editor ────────────────────────────────────────────────────────
//
// Dedicated editor for `recruitment_positions` because rows carry an
// optional salary band (min + max). Same add/remove/reorder mechanics as
// ListEditor, plus two extra numeric inputs per row.

function PositionsEditor(props: { initial: RecruitmentPosition[]; isAdmin: boolean }) {
  const qc = useQueryClient();
  const { showToast } = useToast();

  const [items, setItems] = useState<RecruitmentPosition[]>(props.initial);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<RecruitmentPosition | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newDraft, setNewDraft] = useState<RecruitmentPosition>({ name: '', minSalary: null, maxSalary: null });

  // Re-seed when the query refreshes (e.g. after saving one of the other
  // lists on this same page). Compare by JSON to avoid a shallow-eq trap.
  useEffect(() => { setItems(props.initial); }, [JSON.stringify(props.initial)]);

  const dirty = JSON.stringify(items) !== JSON.stringify(props.initial);

  const startAdd = () => { setEditingIdx(null); setDraft(null); setNewDraft({ name: '', minSalary: null, maxSalary: null }); setIsAdding(true); };
  const cancelAdd = () => { setIsAdding(false); setNewDraft({ name: '', minSalary: null, maxSalary: null }); };
  const confirmAdd = () => {
    const name = newDraft.name.trim();
    if (!name) return;
    if (items.some(x => x.name.toLowerCase() === name.toLowerCase())) {
      showToast('Already in the list', 'error');
      return;
    }
    if (newDraft.minSalary != null && newDraft.maxSalary != null && newDraft.maxSalary < newDraft.minSalary) {
      showToast('Max salary must be ≥ min', 'error');
      return;
    }
    setItems(prev => [...prev, { ...newDraft, name }]);
    cancelAdd();
  };

  const remove = (idx: number) => {
    if (editingIdx === idx) { setEditingIdx(null); setDraft(null); }
    setItems(prev => prev.filter((_, i) => i !== idx));
  };
  const startEdit = (idx: number) => { setIsAdding(false); setEditingIdx(idx); setDraft({ ...items[idx] }); };
  const cancelEdit = () => { setEditingIdx(null); setDraft(null); };
  const saveEdit = () => {
    if (editingIdx === null || !draft) return;
    const name = draft.name.trim();
    if (!name) return;
    if (items.some((x, i) => i !== editingIdx && x.name.toLowerCase() === name.toLowerCase())) {
      showToast('Already in the list', 'error');
      return;
    }
    if (draft.minSalary != null && draft.maxSalary != null && draft.maxSalary < draft.minSalary) {
      showToast('Max salary must be ≥ min', 'error');
      return;
    }
    setItems(prev => prev.map((x, i) => i === editingIdx ? { ...draft, name } : x));
    cancelEdit();
  };
  const dragReorder = useDragReorder<RecruitmentPosition>(setItems, props.isAdmin);

  const save = async () => {
    if (items.length === 0) {
      showToast('Add at least one position', 'error');
      return;
    }
    // Reject bands where max < min — the "typical range" hint would look
    // wrong on the apply form. Zero-only bands are treated as unset.
    for (const p of items) {
      if (p.minSalary != null && p.maxSalary != null && p.maxSalary < p.minSalary) {
        showToast(`Max salary must be ≥ min for ${p.name}`, 'error');
        return;
      }
    }
    setSaving(true);
    try {
      await patchSetting('recruitment_positions', items as any);
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['candidate-form-options'] });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (e: any) {
      showToast(e?.message ?? 'Save failed', 'error');
    }
    setSaving(false);
  };

  const numOrNull = (v: string) => {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const rangeText = (p: RecruitmentPosition) => p.minSalary != null && p.maxSalary != null
    ? `RM ${p.minSalary.toLocaleString('en-MY')} – RM ${p.maxSalary.toLocaleString('en-MY')}`
    : p.minSalary != null ? `From RM ${p.minSalary.toLocaleString('en-MY')}`
    : p.maxSalary != null ? `Up to RM ${p.maxSalary.toLocaleString('en-MY')}`
    : 'No salary band set';

  return (
    <section style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={S.cardTitleWrap}>
          <FontAwesomeIcon icon={faChalkboardUser} style={{ color: C.primary, fontSize: 14 }} />
          <h2 style={S.sectionTitle}>Positions</h2>
        </div>
        {props.isAdmin && (
          <button type="button" onClick={startAdd} disabled={isAdding}
            style={{ ...S.addBtn, opacity: isAdding ? 0.5 : 1, cursor: isAdding ? 'default' : 'pointer' }}>
            <FontAwesomeIcon icon={faPlus} style={{ fontSize: 10 }} /> Add Position
          </button>
        )}
      </div>
      <p style={{ ...S.cardDesc, marginBottom: 16 }}>
        Roles candidates can choose from. When you set a salary band, the
        apply form shows it as a hint below the position dropdown so
        candidates know the typical range before naming their expected pay.
      </p>

      <div>
        <table style={{ ...S.table, tableLayout: 'fixed' }} className="recruit-table">
          <colgroup>
            <col style={{ width: 32 }} />
            <col />
            <col style={{ width: 260 }} />
            <col style={{ width: 88 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={S.th} />
              <th style={{ ...S.th, textAlign: 'left' }}>Position</th>
              <th style={{ ...S.th, textAlign: 'left' }}>Salary Range</th>
              <th style={S.th} />
            </tr>
          </thead>
          <tbody>
            {isAdding && (
              <tr style={{ height: 52 }}>
                <td style={S.td} />
                <td style={S.td}>
                  <input
                    style={S.cellInput}
                    value={newDraft.name}
                    autoFocus
                    onChange={e => setNewDraft({ ...newDraft, name: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') cancelAdd(); }}
                    placeholder="Position name"
                  />
                </td>
                <td style={S.td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      style={{ ...S.cellInput, width: 90 }}
                      type="number" min={0}
                      value={newDraft.minSalary ?? ''}
                      onChange={e => setNewDraft({ ...newDraft, minSalary: numOrNull(e.target.value) })}
                      onKeyDown={e => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') cancelAdd(); }}
                      placeholder="Min"
                    />
                    <span style={S.dash}>–</span>
                    <input
                      style={{ ...S.cellInput, width: 90 }}
                      type="number" min={0}
                      value={newDraft.maxSalary ?? ''}
                      onChange={e => setNewDraft({ ...newDraft, maxSalary: numOrNull(e.target.value) })}
                      onKeyDown={e => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') cancelAdd(); }}
                      placeholder="Max"
                    />
                  </div>
                </td>
                <td style={{ ...S.td, textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: 2 }}>
                    <button type="button" onClick={confirmAdd} style={S.saveIconBtn} title="Save">
                      <FontAwesomeIcon icon={faCheck} style={{ fontSize: 12 }} />
                    </button>
                    <button type="button" onClick={cancelAdd} style={S.cancelIconBtn} title="Cancel">
                      <FontAwesomeIcon icon={faXmark} style={{ fontSize: 12 }} />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {items.map((p, idx) => {
              const isEditing = editingIdx === idx;
              const d = isEditing ? draft! : p;
              return (
                <tr
                  key={`${p.name}-${idx}`}
                  className="recruit-row"
                  style={{ height: 52, ...dragReorder.rowStyle(idx) }}
                  onDragOver={dragReorder.onDragOver(idx)}
                  onDrop={dragReorder.onDrop(idx)}
                >
                  <td style={S.td}><DragGrip idx={idx} enabled={props.isAdmin && !isEditing} reorder={dragReorder} /></td>
                  {isEditing ? (
                    <>
                      <td style={S.td}>
                        <input
                          style={S.cellInput}
                          value={d.name}
                          autoFocus
                          onChange={e => setDraft({ ...d, name: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                          placeholder="Position name"
                        />
                      </td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            style={{ ...S.cellInput, width: 90 }}
                            type="number" min={0}
                            value={d.minSalary ?? ''}
                            onChange={e => setDraft({ ...d, minSalary: numOrNull(e.target.value) })}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                            placeholder="Min"
                          />
                          <span style={S.dash}>–</span>
                          <input
                            style={{ ...S.cellInput, width: 90 }}
                            type="number" min={0}
                            value={d.maxSalary ?? ''}
                            onChange={e => setDraft({ ...d, maxSalary: numOrNull(e.target.value) })}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                            placeholder="Max"
                          />
                        </div>
                      </td>
                      <td style={{ ...S.td, textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 2 }}>
                          <button type="button" onClick={saveEdit} style={S.saveIconBtn} title="Save">
                            <FontAwesomeIcon icon={faCheck} style={{ fontSize: 12 }} />
                          </button>
                          <button type="button" onClick={cancelEdit} style={S.cancelIconBtn} title="Cancel">
                            <FontAwesomeIcon icon={faXmark} style={{ fontSize: 12 }} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={S.td}><span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{p.name}</span></td>
                      <td style={S.td}><span style={{ fontSize: 13, color: C.muted }}>{rangeText(p)}</span></td>
                      <td style={{ ...S.td, textAlign: 'right' }}>
                        {props.isAdmin && (
                          <RowMenu renameLabel="Edit" onRename={() => startEdit(idx)} onDelete={() => remove(idx)} />
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}

            {items.length === 0 && !isAdding && (
              <tr>
                <td colSpan={4} style={{ ...S.td, textAlign: 'center', color: C.muted, padding: '32px 0' }}>
                  No positions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {props.isAdmin && (
        <div style={S.saveRow}>
          <span style={S.dirtyHint}>
            {savedFlash ? (
              <span style={{ color: C.success }}>
                <FontAwesomeIcon icon={faCheck} /> Saved
              </span>
            ) : dirty ? 'Unsaved changes' : 'All changes saved'}
          </span>
          <button type="button" style={S.saveBtn(dirty && !saving)}
            disabled={!dirty || saving} onClick={save}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}
    </section>
  );
}

// ─── List editor ─────────────────────────────────────────────────────────────

function ListEditor(props: {
  icon: any;
  title: string;
  description: string;
  settingKey: string;
  initial: string[];
  placeholder: string;
  isAdmin: boolean;
  /** Values that are system-reserved. They can't be renamed, removed, or
   *  re-added as duplicates. The apply form and other consumers depend
   *  on their presence (e.g. "Other" is the sentinel that triggers the
   *  free-text fallback). Matched case-insensitively. */
  lockedValues?: string[];
  /** When true, renders a small monospace preview of the derived utm
   *  slug next to each entry (used on the referral-sources card so the
   *  admin can see what /apply?utm_source=... will be generated). */
  showUtmSlug?: boolean;
}) {
  const qc = useQueryClient();
  const { showToast } = useToast();

  const [items, setItems] = useState<string[]>(props.initial);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState('');
  const lockedSet = new Set((props.lockedValues ?? []).map(v => v.toLowerCase()));
  const isLocked = (v: string) => lockedSet.has(v.toLowerCase());

  const startEdit = (idx: number) => { setIsAdding(false); setEditingIdx(idx); setEditValue(items[idx]); };
  const cancelEdit = () => { setEditingIdx(null); setEditValue(''); };
  const saveEdit = () => {
    if (editingIdx === null) return;
    const t = editValue.trim();
    if (!t) { cancelEdit(); return; }
    if (items.some((x, i) => i !== editingIdx && x.toLowerCase() === t.toLowerCase())) {
      showToast('Already in the list', 'error');
      return;
    }
    setItems(prev => prev.map((x, i) => i === editingIdx ? t : x));
    cancelEdit();
  };

  const startAdd = () => { setEditingIdx(null); setNewItem(''); setIsAdding(true); };
  const cancelAdd = () => { setIsAdding(false); setNewItem(''); };

  // Re-seed local state when the query refreshes — e.g. after cache invalidation
  // from the OTHER list saving on the same page.
  useEffect(() => { setItems(props.initial); }, [props.initial.join('||')]);

  const dirty = items.length !== props.initial.length
    || items.some((v, i) => v !== props.initial[i]);

  const confirmAdd = () => {
    const t = newItem.trim();
    if (!t) return;
    // No duplicates — the dropdown collapses them anyway.
    if (items.some(x => x.toLowerCase() === t.toLowerCase())) {
      showToast('Already in the list', 'error');
      return;
    }
    setItems(prev => [...prev, t]);
    cancelAdd();
  };

  const remove = (idx: number) => {
    if (editingIdx === idx) cancelEdit();
    setItems(prev => {
      const target = prev[idx];
      if (target && isLocked(target)) {
        showToast(`"${target}" is a system option and can't be removed.`, 'error');
        return prev;
      }
      return prev.filter((_, i) => i !== idx);
    });
  };

  const dragReorder = useDragReorder<string>(setItems, props.isAdmin);

  const save = async () => {
    if (items.length === 0) {
      showToast('Add at least one entry', 'error');
      return;
    }
    // Defense in depth: if a locked value was somehow removed from the
    // list (e.g. paste-replace on the input), re-inject it at the end
    // so downstream consumers keep working.
    const withLocks = [
      ...items,
      ...(props.lockedValues ?? []).filter(v => !items.some(x => x.toLowerCase() === v.toLowerCase())),
    ];
    setSaving(true);
    try {
      await patchSetting(props.settingKey, withLocks);
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['candidate-form-options'] });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (e: any) {
      showToast(e?.message ?? 'Save failed', 'error');
    }
    setSaving(false);
  };

  return (
    <section style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={S.cardTitleWrap}>
          <FontAwesomeIcon icon={props.icon} style={{ color: C.primary, fontSize: 14 }} />
          <h2 style={S.sectionTitle}>{props.title}</h2>
        </div>
        {props.isAdmin && (
          <button type="button" onClick={startAdd} disabled={isAdding}
            style={{ ...S.addBtn, opacity: isAdding ? 0.5 : 1, cursor: isAdding ? 'default' : 'pointer' }}>
            <FontAwesomeIcon icon={faPlus} style={{ fontSize: 10 }} /> Add
          </button>
        )}
      </div>
      <p style={{ ...S.cardDesc, marginBottom: 16 }}>{props.description}</p>

      <div>
        <table style={S.table} className="recruit-table">
          <colgroup>
            <col style={{ width: 32 }} />
            <col />
            <col style={{ width: 96 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={S.th} />
              <th style={{ ...S.th, textAlign: 'left' }}>Value</th>
              <th style={S.th} />
            </tr>
          </thead>
          <tbody>
            {isAdding && (
              <tr style={{ height: 48 }}>
                <td style={S.td} />
                <td style={S.td}>
                  <input
                    style={S.cellInput}
                    value={newItem}
                    autoFocus
                    placeholder={props.placeholder}
                    onChange={e => setNewItem(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') cancelAdd(); }}
                  />
                </td>
                <td style={{ ...S.td, textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: 2 }}>
                    <button type="button" onClick={confirmAdd} style={S.saveIconBtn} title="Save">
                      <FontAwesomeIcon icon={faCheck} style={{ fontSize: 12 }} />
                    </button>
                    <button type="button" onClick={cancelAdd} style={S.cancelIconBtn} title="Cancel">
                      <FontAwesomeIcon icon={faXmark} style={{ fontSize: 12 }} />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {items.map((label, idx) => {
              const locked = isLocked(label);
              const isEditing = editingIdx === idx;
              return (
                <tr
                  key={`${label}-${idx}`}
                  className="recruit-row"
                  style={{ height: 48, ...dragReorder.rowStyle(idx) }}
                  onDragOver={dragReorder.onDragOver(idx)}
                  onDrop={dragReorder.onDrop(idx)}
                >
                  <td style={S.td}><DragGrip idx={idx} enabled={props.isAdmin && !isEditing} reorder={dragReorder} /></td>
                  {isEditing ? (
                    <>
                      <td style={S.td}>
                        <input
                          style={S.cellInput}
                          value={editValue}
                          autoFocus
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                        />
                      </td>
                      <td style={{ ...S.td, textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 2 }}>
                          <button type="button" onClick={saveEdit} style={S.saveIconBtn} title="Save">
                            <FontAwesomeIcon icon={faCheck} style={{ fontSize: 12 }} />
                          </button>
                          <button type="button" onClick={cancelEdit} style={S.cancelIconBtn} title="Cancel">
                            <FontAwesomeIcon icon={faXmark} style={{ fontSize: 12 }} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={S.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, color: C.text }}>{label}</span>
                          {props.showUtmSlug && !locked && label && (
                            <span
                              title={`Tracked link: /apply?utm_source=${toUtmSlug(label)}`}
                              style={{
                                fontSize: 10, fontFamily: 'monospace',
                                color: '#64748b', background: '#f1f5f9',
                                padding: '2px 6px', borderRadius: 4,
                                whiteSpace: 'nowrap' as const, flexShrink: 0,
                              }}
                            >
                              utm: {toUtmSlug(label)}
                            </span>
                          )}
                          {locked && (
                            <span
                              style={{
                                fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
                                padding: '2px 6px', borderRadius: 4, background: '#eef2ff', color: '#4f46e5',
                                whiteSpace: 'nowrap',
                              }}
                              title="This is a system option and can't be renamed or removed."
                            >
                              System
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ ...S.td, textAlign: 'right' }}>
                        {props.isAdmin && !locked && (
                          <RowMenu onRename={() => startEdit(idx)} onDelete={() => remove(idx)} />
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}

            {items.length === 0 && !isAdding && (
              <tr>
                <td colSpan={3} style={{ ...S.td, textAlign: 'center', color: C.muted, padding: '32px 0' }}>
                  No entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {props.isAdmin && (
        <div style={S.saveRow}>
          <span style={S.dirtyHint}>
            {savedFlash ? (
              <span style={{ color: C.success }}>
                <FontAwesomeIcon icon={faCheck} /> Saved
              </span>
            ) : dirty ? 'Unsaved changes' : 'All changes saved'}
          </span>
          <button type="button" style={S.saveBtn(dirty && !saving)}
            disabled={!dirty || saving} onClick={save}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}
    </section>
  );
}

const S = {
  page: { background: C.bg, minHeight: '100%', padding: '24px 16px' } as React.CSSProperties,
  inner: { maxWidth: 760, margin: '0 auto' } as React.CSSProperties,
  state: { padding: 24, color: C.muted } as React.CSSProperties,
  heading: { fontSize: 24, fontWeight: 700, margin: '8px 0 4px', color: C.text } as React.CSSProperties,
  sub: { fontSize: 14, color: C.muted, margin: '0 0 18px', lineHeight: 1.55 } as React.CSSProperties,
  readonly: {
    background: '#fffbeb', color: '#92400e', padding: '8px 12px',
    borderRadius: 8, fontSize: 13, marginBottom: 12,
  } as React.CSSProperties,
  card: {
    background: C.surface, border: '1px solid #eef0f4', borderRadius: 14,
    padding: '22px 26px', marginBottom: 20,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)',
  } as React.CSSProperties,
  cardHeader: { marginBottom: 12 } as React.CSSProperties,
  cardTitleWrap: { display: 'flex', alignItems: 'center', gap: 10 } as React.CSSProperties,
  cardTitle: { fontSize: 16, fontWeight: 700, margin: 0, color: C.text } as React.CSSProperties,
  cardDesc: { fontSize: 13, color: C.muted, margin: '4px 0 0' } as React.CSSProperties,
  sectionTitle: { fontSize: 13, fontWeight: 700, color: C.text, margin: 0 } as React.CSSProperties,
  addBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600,
    borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface, color: C.text, cursor: 'pointer',
  } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 } as React.CSSProperties,
  th: {
    textAlign: 'left' as const, padding: '8px 12px', fontWeight: 600, fontSize: 11, color: C.muted,
    letterSpacing: '0.04em', textTransform: 'uppercase' as const, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  td: {
    padding: '6px 8px', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: C.text,
    height: 48, verticalAlign: 'middle' as const,
  } as React.CSSProperties,
  cellInput: {
    display: 'block', width: '100%', padding: '7px 10px',
    border: `1px solid ${C.border}`, borderRadius: 6, background: C.surface, fontSize: 13, color: C.text,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  menuBtn: {
    background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', padding: '6px 8px', borderRadius: 6,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'background 120ms ease, color 120ms ease',
  } as React.CSSProperties,
  menu: {
    position: 'fixed' as const, zIndex: 9999, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14), 0 2px 6px rgba(15, 23, 42, 0.06)', width: 168, overflow: 'hidden', padding: '4px 0',
  } as React.CSSProperties,
  menuItem: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', fontSize: 13, fontWeight: 500,
    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const, fontFamily: 'inherit', color: C.text,
  } as React.CSSProperties,
  saveIconBtn: {
    background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', cursor: 'pointer', padding: 8, borderRadius: 6,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  } as React.CSSProperties,
  cancelIconBtn: {
    background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', padding: 8, borderRadius: 6,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  } as React.CSSProperties,
  dash: { color: C.muted, fontSize: 14 } as React.CSSProperties,
  saveRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.borderSoft}`,
  } as React.CSSProperties,
  dirtyHint: { fontSize: 12, color: C.muted } as React.CSSProperties,
  saveBtn: (active: boolean): React.CSSProperties => ({
    background: active ? C.primary : '#cbd5e1', color: '#fff',
    border: 'none', padding: '8px 16px', borderRadius: 8,
    fontSize: 13, fontWeight: 600,
    cursor: active ? 'pointer' : 'default',
  }),
};
