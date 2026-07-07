import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronLeft, faChevronRight, faUpload, faXmark, faSpinner, faStar,
} from '@fortawesome/free-solid-svg-icons';
import { fetchPositions, upsertPosition } from '../../api/salary.js';
import { uploadBadge, uploadUrl } from '../../api/upload.js';
import { Position } from '../../types/index.js';
import { useToast } from '../../components/common/Toast.js';

// Dedicated add/edit surface for a salary position. Replaces the old
// inline-row editor on EmployeeSalaryPage so the form has room for a
// proper description field and the list page stays scannable.
//
// One route handles both add and edit:
//   /settings/employee-salary/positions/new          → add (no :id)
//   /settings/employee-salary/positions/:id/edit     → edit
//
// On save we navigate back to the parent list.

const C = {
  primary: '#5a67d8', primarySoft: '#eef2ff', primaryBorder: '#c7d2fe',
  bg: '#f8fafc', card: '#ffffff',
  text: '#0f172a', muted: '#64748b', mutedSoft: '#94a3b8',
  border: '#e2e8f0', divider: '#eceef2',
  danger: '#ef4444',
};

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

function numOnly(val: string): string { return val.replace(/[^\d.]/g, ''); }

export default function PositionEditPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const isEdit = !!id;

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ['salary-positions'],
    queryFn: fetchPositions,
  });
  const existing = isEdit ? positions.find(p => p.positionId === id) ?? null : null;

  const [form, setForm] = useState({
    positionId: '',
    name: '',
    titleWeight: 0,
    basicSalary: 0,
    maxLevel: 5,
    inCareerProgression: true,
    badgeUrl: '',
    starColor: '',
    roleFocus: '',
    description: '',
  });
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [badgeUploading, setBadgeUploading] = useState(false);
  const badgeFileRef = useRef<HTMLInputElement | null>(null);

  // Hydrate the form once the target position is loaded (edit mode).
  useEffect(() => {
    if (hydrated) return;
    if (isEdit && existing) {
      setForm({
        positionId: existing.positionId,
        name: existing.name,
        titleWeight: existing.titleWeight,
        basicSalary: existing.basicSalary,
        maxLevel: existing.maxLevel,
        inCareerProgression: existing.inCareerProgression,
        badgeUrl: existing.badgeUrl ?? '',
        starColor: existing.starColor ?? '',
        roleFocus: existing.roleFocus ?? '',
        description: existing.description ?? '',
      });
      setHydrated(true);
    } else if (!isEdit) {
      setHydrated(true);
    }
  }, [hydrated, isEdit, existing]);

  const handleBadgeUpload = async (file: File) => {
    setBadgeUploading(true);
    try {
      const { url } = await uploadBadge(file);
      setForm(f => ({ ...f, badgeUrl: url }));
      showToast('Badge uploaded');
    } catch (e: any) {
      showToast(e?.message ?? 'Upload failed', 'error');
    }
    setBadgeUploading(false);
  };

  const canSave = (() => {
    if (!form.name.trim()) return false;
    if (!isEdit && !form.positionId.trim()) return false;
    return true;
  })();

  const onSave = async () => {
    if (!canSave) return;
    const positionId = isEdit ? form.positionId : form.positionId.trim().toUpperCase();
    setSaving(true);
    try {
      await upsertPosition(positionId, {
        name: form.name.trim(),
        titleWeight: form.titleWeight,
        basicSalary: form.basicSalary,
        maxLevel: form.maxLevel,
        sortOrder: isEdit ? undefined : positions.length,
        inCareerProgression: form.inCareerProgression,
        badgeUrl: form.badgeUrl.trim() || null,
        starColor: form.starColor.trim() || null,
        roleFocus: form.roleFocus.trim() || null,
        description: form.description.trim() || null,
      });
      qc.invalidateQueries({ queryKey: ['salary-positions'] });
      qc.invalidateQueries({ queryKey: ['salary-incentives'] });
      showToast(isEdit ? `${positionId} updated` : `${positionId} added`);
      navigate('/settings/employee-salary');
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to save', 'error');
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
          <p style={{ color: C.muted }}>Position not found.</p>
          <Link to="/settings/employee-salary" style={s.crumbLink}>Back to Employee Salary</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.inner}>
        {/* Breadcrumb */}
        <div style={s.breadcrumb}>
          <button onClick={() => navigate('/settings/employee-salary')} style={s.backBtn} title="Back">
            <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 11 }} />
          </button>
          <Link to="/settings/employee-salary" style={s.crumbLink}>Employee Salary</Link>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
          <span style={s.crumbCurrent}>{isEdit ? 'Edit Position' : 'Add Position'}</span>
        </div>

        <h1 style={s.heading}>{isEdit ? `Edit Position — ${existing?.positionId}` : 'Add Position'}</h1>

        {/* Form card */}
        <div style={s.card}>
          {/* ID + name */}
          <div style={s.row}>
            <label style={s.label}>
              <span style={s.labelText}>ID <span style={s.req}>*</span></span>
              {isEdit ? (
                <input
                  value={form.positionId}
                  disabled
                  style={{ ...s.input, background: C.bg, color: C.muted }}
                />
              ) : (
                <input
                  value={form.positionId}
                  onChange={e => setForm(f => ({ ...f, positionId: e.target.value }))}
                  maxLength={10}
                  placeholder="e.g. AE"
                  style={s.input}
                  autoFocus
                />
              )}
              <span style={s.help}>Short code, max 10 chars. Used internally.</span>
            </label>
            <label style={{ ...s.label, flex: 2 }}>
              <span style={s.labelText}>Position name <span style={s.req}>*</span></span>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Assistant EI"
                style={s.input}
              />
            </label>
          </div>

          {/* Role Focus — short headline shown above the description */}
          <label style={{ ...s.label, marginTop: 16 }}>
            <span style={s.labelText}>Role focus</span>
            <input
              value={form.roleFocus}
              onChange={e => setForm(f => ({ ...f, roleFocus: e.target.value }))}
              placeholder="e.g. Overall School Management"
              style={s.input}
            />
            <span style={s.help}>One short phrase that names this rank's main responsibility. Rendered bold above the description.</span>
          </label>

          {/* Description */}
          <label style={{ ...s.label, marginTop: 16 }}>
            <span style={s.labelText}>Description</span>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={4}
              placeholder="The detail behind the role focus. What responsibilities, decisions, and outcomes does this rank own?"
              style={{ ...s.input, resize: 'vertical', minHeight: 100, fontFamily: 'inherit' }}
            />
            <span style={s.help}>Plain text. Shown to teachers on their Career Journey page.</span>
          </label>

          {/* Salary + levels */}
          <div style={{ ...s.row, marginTop: 16 }}>
            <label style={s.label}>
              <span style={s.labelText}>Basic salary (RM)</span>
              <input
                type="text"
                inputMode="numeric"
                value={form.basicSalary}
                onChange={e => setForm(f => ({ ...f, basicSalary: Number(numOnly(e.target.value)) }))}
                style={s.input}
              />
            </label>
            <label style={s.label}>
              <span style={s.labelText}>Title weight</span>
              <input
                type="text"
                inputMode="numeric"
                value={form.titleWeight}
                onChange={e => setForm(f => ({ ...f, titleWeight: Number(numOnly(e.target.value)) }))}
                style={s.input}
              />
              <span style={s.help}>Profit-sharing weight multiplier.</span>
            </label>
          </div>

          {/* Levels + career path — explicit grid columns so the three
              controls line up cleanly without overlap on any width. */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: form.maxLevel > 0
              ? 'minmax(160px, 1fr) minmax(120px, 1fr) minmax(160px, 1fr)'
              : 'minmax(160px, 1fr) minmax(160px, 1fr)',
            gap: 16,
            marginTop: 16,
          }}>
            <label style={s.label}>
              <span style={s.labelText}>Has levels?</span>
              <label style={s.toggleRow}>
                <input
                  type="checkbox"
                  checked={form.maxLevel > 0}
                  onChange={e => setForm(f => ({ ...f, maxLevel: e.target.checked ? 5 : 0 }))}
                />
                <span style={{ fontSize: 13, color: C.text }}>
                  {form.maxLevel > 0 ? 'Yes' : 'No'}
                </span>
              </label>
            </label>
            {form.maxLevel > 0 && (
              <label style={s.label}>
                <span style={s.labelText}>Max level</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.maxLevel}
                  onChange={e => setForm(f => ({ ...f, maxLevel: Math.max(1, Number(numOnly(e.target.value))) }))}
                  style={s.input}
                />
              </label>
            )}
            <label style={s.label}>
              <span style={s.labelText}>Career path</span>
              <label style={s.toggleRow}>
                <input
                  type="checkbox"
                  checked={form.inCareerProgression}
                  onChange={e => setForm(f => ({ ...f, inCareerProgression: e.target.checked }))}
                />
                <span style={{ fontSize: 13, color: C.text }}>
                  {form.inCareerProgression ? 'On path' : 'Off path'}
                </span>
              </label>
            </label>
          </div>

          {/* Badge upload */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.divider}` }}>
            <span style={s.labelText}>Badge image</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 10,
                border: `1px solid ${C.border}`, background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', flexShrink: 0,
              }}>
                {form.badgeUrl ? (
                  <img
                    src={uploadUrl(form.badgeUrl)}
                    alt={form.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                  />
                ) : (
                  <span style={{ fontSize: 12, color: C.muted }}>—</span>
                )}
              </div>
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
                  padding: '8px 12px', fontSize: 13, fontWeight: 600,
                  color: C.text, background: '#fff',
                  border: `1px solid ${C.border}`, borderRadius: 7,
                  cursor: badgeUploading ? 'wait' : 'pointer',
                  opacity: badgeUploading ? 0.6 : 1,
                }}
              >
                <FontAwesomeIcon
                  icon={badgeUploading ? faSpinner : faUpload}
                  spin={badgeUploading}
                  style={{ fontSize: 12 }}
                />
                {form.badgeUrl ? 'Replace image' : 'Upload image'}
              </button>
              {form.badgeUrl && !badgeUploading && (
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, badgeUrl: '' }))}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '8px 10px', fontSize: 12, fontWeight: 600,
                    color: C.danger, background: 'transparent',
                    border: 'none', borderRadius: 6, cursor: 'pointer',
                  }}
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

          {/* Star color */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.divider}` }}>
            <span style={s.labelText}>Star color</span>
            <div style={{ marginTop: 8 }}>
              <StarColorPicker
                value={form.starColor}
                onChange={v => setForm(f => ({ ...f, starColor: v }))}
              />
            </div>
            <span style={{ ...s.help, marginTop: 8 }}>
              Earned when a teacher completes all category missions at this rank.
            </span>
          </div>
        </div>

        {/* Footer actions */}
        <div style={s.footer}>
          <button
            type="button"
            onClick={() => navigate('/settings/employee-salary')}
            style={s.cancelBtn}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave || saving}
            style={{
              ...s.saveBtn,
              opacity: !canSave || saving ? 0.55 : 1,
              cursor: !canSave || saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Add position')}
          </button>
        </div>
      </div>
    </div>
  );
}

function StarColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#fff', border: `1px solid ${C.border}`,
      }}>
        <FontAwesomeIcon
          icon={faStar}
          style={{
            fontSize: 16,
            color: value || '#cbd5e1',
            filter: value ? `drop-shadow(0 1px 2px ${value}66)` : 'none',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {STAR_COLOR_PRESETS.map(p => {
          const active = value.toLowerCase() === p.color.toLowerCase();
          return (
            <button
              key={p.color}
              type="button"
              title={p.label}
              onClick={() => onChange(p.color)}
              style={{
                width: 26, height: 26, borderRadius: '50%',
                background: p.color, cursor: 'pointer',
                border: active ? `2px solid ${C.text}` : `1px solid ${C.border}`,
                outline: 'none', padding: 0,
              }}
            />
          );
        })}
      </div>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="#FFD700"
        style={{
          width: 100, padding: '6px 10px', fontSize: 12,
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          border: `1px solid ${C.border}`, borderRadius: 6,
          color: C.text, background: '#fff',
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          style={{
            fontSize: 12, fontWeight: 600, color: C.danger,
            background: 'transparent', border: 'none', cursor: 'pointer', padding: 4,
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: '24px 32px',
    background: C.bg, minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    color: C.text,
  },
  inner: { maxWidth: 760, margin: '0 auto' },

  breadcrumb: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
    fontSize: 12, flexWrap: 'wrap', rowGap: 4,
  },
  crumbLink: { color: C.muted, textDecoration: 'none', fontWeight: 500 },
  crumbCurrent: { color: C.text, fontWeight: 600 },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 7,
    border: `1px solid ${C.border}`,
    background: C.card, color: C.muted,
    cursor: 'pointer',
    transition: 'all 160ms ease',
  },

  heading: {
    margin: '0 0 20px',
    fontSize: 22, fontWeight: 700, color: C.text,
    letterSpacing: '-0.02em',
  },

  card: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: 24,
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
  },

  row: {
    display: 'flex', gap: 16, alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  label: {
    display: 'flex', flexDirection: 'column', gap: 6,
    flex: 1, minWidth: 0,
  },
  labelText: {
    fontSize: 11, fontWeight: 700, color: C.muted,
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
  },
  req: { color: C.danger },
  input: {
    padding: '8px 12px', fontSize: 14,
    border: `1px solid ${C.border}`, borderRadius: 7,
    background: '#fff', color: C.text,
    fontFamily: 'inherit',
    outline: 'none',
  },
  help: { fontSize: 11, color: C.mutedSoft, marginTop: 2 },
  toggleRow: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '8px 12px', borderRadius: 7,
    border: `1px solid ${C.border}`, background: '#fff',
    cursor: 'pointer', minHeight: 36,
  },

  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    padding: '10px 18px', fontSize: 13, fontWeight: 600,
    color: C.text, background: '#fff',
    border: `1px solid ${C.border}`, borderRadius: 7,
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '10px 20px', fontSize: 13, fontWeight: 700,
    color: '#fff', background: C.primary,
    border: 'none', borderRadius: 7,
  },
};
