import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronLeft, faChevronRight, faUpload, faXmark, faSpinner, faStar,
} from '@fortawesome/free-solid-svg-icons';
import { fetchPositions, upsertPosition, fetchDepartments } from '../../api/salary.js';
import { fetchAuthRoles } from '../../api/auth-roles.js';
import { uploadBadge, uploadUrl } from '../../api/upload.js';
import { Position } from '../../types/index.js';
import { useToast } from '../../components/common/Toast.js';
import { fetchTeachers } from '../../api/planner.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { headsFrom, managementFrom, reportingProblem, reportsToOptions } from './orgStructure.js';
import PositionCareerPreview from './PositionCareerPreview.js';
import { MODULE_LABELS } from '../../constants/authModules.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.js';
import { useGoBack } from '../../hooks/useGoBack.js';
import AccessRoleOptions from './AccessRoleOptions.js';

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
  text: '#0f172a', muted: '#64748b', mutedSoft: '#64748b',
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

/** Title weight may have up to 2 decimals (e.g. 1.25). */
const TITLE_WEIGHT_DECIMALS = 2;
function numOnly(val: string): string { return val.replace(/[^\d.]/g, ''); }

// Like numOnly but collapses to a single decimal point, so a field can hold
// intermediate typing states like "1." without a controlled re-render
// snapping it back to "1" and blocking further digits. maxDecimals caps how
// many digits are kept after that point (e.g. 1 → "0.5" but not "0.55").
function decimalOnly(val: string, maxDecimals?: number): string {
  const cleaned = numOnly(val);
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  const fraction = cleaned.slice(firstDot + 1).replace(/\./g, '');
  return cleaned.slice(0, firstDot + 1) + (maxDecimals != null ? fraction.slice(0, maxDecimals) : fraction);
}

export default function PositionEditPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const goBack = useGoBack('/settings/positions');
  const qc = useQueryClient();
  const { showToast } = useToast();
  const isEdit = !!id;

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ['salary-positions'],
    queryFn: fetchPositions,
  });
  const { data: departmentList = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
  });
  const { data: authRoleList = [] } = useQuery({
    queryKey: ['auth-roles'],
    queryFn: fetchAuthRoles,
  });
  const existing = isEdit ? positions.find(p => p.positionId === id) ?? null : null;

  const [form, setForm] = useState({
    positionId: '',
    departmentId: '',
    name: '',
    titleWeight: '0',
    basicSalary: 0,
    maxLevel: 5,
    inCareerProgression: true,
    badgeUrl: '',
    starColor: '',
    roleFocus: '',
    description: '',
    authRoleId: '',
    reportsToPositionId: '',
  });
  const [hydrated, setHydrated] = useState(false);
  const { isMobile } = useIsMobile();
  const { data: staff = [] } = useQuery({ queryKey: ['planner-teachers'], queryFn: fetchTeachers });
  const [saving, setSaving] = useState(false);
  const [badgeUploading, setBadgeUploading] = useState(false);
  const badgeFileRef = useRef<HTMLInputElement | null>(null);

  // Hydrate the form once the target position is loaded (edit mode).
  useEffect(() => {
    if (hydrated) return;
    if (isEdit && existing) {
      setForm({
        positionId: existing.positionId,
        departmentId: existing.departmentId ?? '',
        name: existing.name,
        titleWeight: String(existing.titleWeight),
        basicSalary: existing.basicSalary,
        maxLevel: existing.maxLevel,
        inCareerProgression: existing.inCareerProgression,
        badgeUrl: existing.badgeUrl ?? '',
        starColor: existing.starColor ?? '',
        roleFocus: existing.roleFocus ?? '',
        description: existing.description ?? '',
        authRoleId: existing.authRoleId ?? '',
        reportsToPositionId: existing.reportsToPositionId ?? '',
      });
      setHydrated(true);
    } else if (!isEdit) {
      setHydrated(true);
    }
  }, [hydrated, isEdit, existing]);

  // Default a new position onto the first department (Academic) once
  // departments have loaded — admins can still change it before saving.
  useEffect(() => {
    if (!isEdit && !form.departmentId && departmentList.length > 0) {
      setForm(f => ({ ...f, departmentId: departmentList[0].departmentId }));
    }
  }, [isEdit, departmentList, form.departmentId]);

  const selectedDepartment = departmentList.find(d => d.departmentId === form.departmentId);
  const deptHasCareerPath = selectedDepartment?.hasCareerPath ?? true;

  // A position can't be on a career path if its department has none —
  // force it off (and keep it off) whenever the department says so.
  useEffect(() => {
    if (!deptHasCareerPath && form.inCareerProgression) {
      setForm(f => ({ ...f, inCareerProgression: false }));
    }
  }, [deptHasCareerPath, form.inCareerProgression]);

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

  // Why it can't be saved yet (shown beside the disabled Save) — or null.
  const codeTaken = !isEdit && positions.some(p => p.positionId === form.positionId.trim().toUpperCase());
  const titleWeightBad = form.titleWeight.trim() === '' || !Number.isFinite(Number(form.titleWeight));
  const blocker = !form.name.trim() ? 'Give the position a name.'
    : !isEdit && !form.positionId.trim() ? 'Give the position a code.'
    : codeTaken ? 'That code is already used by another position.'
    : !form.departmentId ? 'Pick a department.'
    : titleWeightBad ? 'Give it a rank (a number).'
    : null;
  const canSave = !blocker;
  const holders = isEdit ? staff.filter(s => s.isActive && s.positionId === form.positionId).length : 0;
  const reportsChoices = reportsToOptions(positions, headsFrom(departmentList), { positionId: isEdit ? form.positionId : '__new__', departmentId: form.departmentId || null, titleWeight: Number(form.titleWeight) || 0 }, managementFrom(departmentList));

  const onSave = async () => {
    if (!canSave) return;
    const positionId = isEdit ? form.positionId : form.positionId.trim().toUpperCase();
    setSaving(true);
    try {
      await upsertPosition(positionId, {
        name: form.name.trim(),
        departmentId: form.departmentId || null,
        titleWeight: Number(form.titleWeight) || 0,
        basicSalary: form.basicSalary,
        maxLevel: form.maxLevel,
        sortOrder: isEdit ? undefined : positions.length,
        inCareerProgression: form.inCareerProgression,
        badgeUrl: form.badgeUrl.trim() || null,
        starColor: form.starColor.trim() || null,
        roleFocus: form.roleFocus.trim() || null,
        description: form.description.trim() || null,
        authRoleId: form.authRoleId || null,
        reportsToPositionId: form.reportsToPositionId || null,
      });
      qc.invalidateQueries({ queryKey: ['salary-positions'] });
      qc.invalidateQueries({ queryKey: ['salary-incentives'] });
      showToast(isEdit ? `${form.name.trim()} saved` : `${form.name.trim()} added`);
      // Back where it was opened from — Positions, or Payroll's salary table.
      goBack();
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to save', 'error');
    }
    setSaving(false);
  };

  if (isLoading || !hydrated) {
    return (
      <div className="m-pad" style={s.page}><div style={s.inner}><p style={{ color: C.muted }}><LoadingSpinner /></p></div></div>
    );
  }
  if (isEdit && !existing) {
    return (
      <div className="m-pad" style={s.page}>
        <div style={s.inner}>
          <p style={{ color: C.muted }}>Position not found.</p>
          <Link to="/settings/positions" style={s.crumbLink}>Back to Positions</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="m-pad" style={s.page}>
      <div style={s.inner}>
        {/* Who it is: the name (its code beside it), and where it sits. */}
        <header style={{ marginBottom: 24 }}>
          <h1 style={s.heading}>
            {form.name.trim() || (isEdit ? existing?.name : 'New position')}
            {form.positionId.trim() && <span style={s.codeTag}>{form.positionId.trim().toUpperCase()}</span>}
          </h1>
          {isEdit && (
            <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
              {selectedDepartment?.name ?? 'No department'} · {holders} {holders === 1 ? 'person' : 'people'}
            </div>
          )}
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 300px', gap: 24, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <section aria-labelledby="pe-basics" style={s.card}>
              <h2 id="pe-basics" style={s.cardTitle}>Basics</h2>
              <div style={s.row}>
                <label style={{ ...s.label, flex: 2 }}>
                  <span style={s.labelText}>Name <span style={s.req}>*</span></span>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Assistant EI" style={s.input} autoFocus={!isEdit} />
                </label>
                <label style={s.label}>
                  <span style={s.labelText}>Code <span style={s.req}>*</span></span>
                  <input value={form.positionId} disabled={isEdit} maxLength={10} placeholder="e.g. AEI" aria-invalid={codeTaken}
                    onChange={e => setForm(f => ({ ...f, positionId: e.target.value }))}
                    style={{ ...s.input, ...(isEdit ? { background: C.bg, color: C.muted } : {}), ...(codeTaken ? { borderColor: C.danger } : {}) }} />
                  <span style={s.help}>{isEdit ? 'Can’t change once created.' : 'Short, up to 10 letters — used in reports.'}</span>
                </label>
              </div>
              <label style={{ ...s.label, marginTop: 16 }}>
                <span style={s.labelText}>Department <span style={s.req}>*</span></span>
                <select value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))} style={s.input}>
                  {departmentList.length === 0 && <option value="">No departments yet</option>}
                  {departmentList.map(d => <option key={d.departmentId} value={d.departmentId}>{d.name}</option>)}
                </select>
              </label>
            </section>

            <section aria-labelledby="pe-org" style={s.card}>
              <h2 id="pe-org" style={s.cardTitle}>Place in the organisation</h2>
              <div style={s.row}>
                <label style={{ ...s.label, flex: 2 }}>
                  <span style={s.labelText}>Reports to</span>
                  <select value={form.reportsToPositionId} onChange={e => setForm(f => ({ ...f, reportsToPositionId: e.target.value }))} style={s.input}>
                    {(!reportingProblem(positions, headsFrom(departmentList), { positionId: form.positionId || '__new__', departmentId: form.departmentId || null, titleWeight: Number(form.titleWeight) || 0 }, null, managementFrom(departmentList)) || !form.reportsToPositionId)
                      && <option value="">Nobody — top of its line</option>}
                    {reportsChoices.map(p => <option key={p.positionId} value={p.positionId}>{p.name}</option>)}
                  </select>
                  <span style={s.help}>A higher position in its own department — or, for the department’s head, a position in another department.</span>
                </label>
                <label style={s.label}>
                  <span style={s.labelText}>Rank</span>
                  <input type="text" inputMode="decimal" value={form.titleWeight} aria-invalid={titleWeightBad}
                    onChange={e => setForm(f => ({ ...f, titleWeight: decimalOnly(e.target.value, TITLE_WEIGHT_DECIMALS) }))}
                    style={{ ...s.input, ...(titleWeightBad ? { borderColor: C.danger } : {}) }} />
                  <span style={s.help}>Higher sits higher. Also the profit-sharing weight — up to 2 decimals.</span>
                </label>
              </div>
              <p style={{ ...s.help, margin: '12px 0 0' }}>
                Pay is set in <Link to="/settings/employee-salary" style={s.link}>Payroll</Link>.
              </p>
            </section>

            <section aria-labelledby="pe-access" style={s.card}>
              <h2 id="pe-access" style={s.cardTitle}>Access</h2>
              {/* What an access role is, in plain words — and what the chosen one gives, so it's clear before saving. */}
              <p style={{ ...s.help, margin: '-8px 0 12px', fontSize: 13 }}>
                An access role is a set of permissions: which parts of the app (menus) staff in this position can open, and which actions they can take there.
                Several positions can share one — e.g. every teacher position uses “Teacher”.
              </p>
              <label style={s.label}>
                <span style={s.labelText}>Access role</span>
                <select value={form.authRoleId} onChange={e => setForm(f => ({ ...f, authRoleId: e.target.value }))} style={s.input}>
                  <option value="">No access role</option>
                  <AccessRoleOptions roles={authRoleList} />
                </select>
              </label>
              {(() => {
                const role = authRoleList.find(r => r.id === form.authRoleId);
                if (!role) {
                  return <p style={{ ...s.help, marginTop: 8, color: C.danger }}>No access role: staff in this position can sign in but open nothing until one is set.</p>;
                }
                return (
                  <div style={{ marginTop: 12, padding: '10px 12px', background: C.bg, borderRadius: 8, fontSize: 13, color: C.text, lineHeight: 1.6 }}>
                    {role.description && <div style={{ color: C.muted, marginBottom: 4 }}>{role.description}</div>}
                    <div><strong>Can open:</strong> {role.modules.length ? role.modules.map(m => MODULE_LABELS[m] ?? m).join(', ') : 'nothing yet'}</div>
                    <div><strong>Extra permissions:</strong> {role.views.length ? `${role.views.length}` : 'none'}</div>
                    <Link to="/settings/auth-roles" style={{ ...s.link, display: 'inline-block', marginTop: 4 }}>See or change what “{role.name}” allows</Link>
                  </div>
                );
              })()}
            </section>

            <section aria-labelledby="pe-career" style={s.card}>
              <h2 id="pe-career" style={s.cardTitle}>Career</h2>
              <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: form.maxLevel > 0 ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                <label style={s.label}>
                  <span style={s.labelText}>Career path</span>
                  <label style={{ ...s.toggleRow, ...(deptHasCareerPath ? {} : { opacity: 0.5, cursor: 'default' }) }}>
                    <input type="checkbox" checked={form.inCareerProgression} disabled={!deptHasCareerPath}
                      onChange={e => setForm(f => ({ ...f, inCareerProgression: e.target.checked }))} />
                    <span style={{ fontSize: 14, color: C.text }}>On the career path</span>
                  </label>
                  {!deptHasCareerPath && <span style={s.help}>Its department has no career path.</span>}
                </label>
                <label style={s.label}>
                  <span style={s.labelText}>Levels</span>
                  <label style={s.toggleRow}>
                    <input type="checkbox" checked={form.maxLevel > 0} onChange={e => setForm(f => ({ ...f, maxLevel: e.target.checked ? 5 : 0 }))} />
                    <span style={{ fontSize: 14, color: C.text }}>Has levels</span>
                  </label>
                </label>
                {form.maxLevel > 0 && (
                  <label style={s.label}>
                    <span style={s.labelText}>Highest level</span>
                    <input type="text" inputMode="numeric" value={form.maxLevel}
                      onChange={e => setForm(f => ({ ...f, maxLevel: Math.max(1, Number(numOnly(e.target.value))) }))} style={s.input} />
                  </label>
                )}
              </div>
              <label style={{ ...s.label, marginTop: 16 }}>
                <span style={s.labelText}>Role focus</span>
                <input value={form.roleFocus} onChange={e => setForm(f => ({ ...f, roleFocus: e.target.value }))} placeholder="e.g. Overall school management" style={s.input} />
                <span style={s.help}>One short phrase for its main responsibility — shown in bold above the description.</span>
              </label>
              <label style={{ ...s.label, marginTop: 16 }}>
                <span style={s.labelText}>Description</span>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4}
                  placeholder="What this position is responsible for, decides and delivers."
                  style={{ ...s.input, resize: 'vertical', minHeight: 100, fontFamily: 'inherit' }} />
              </label>
              <div style={{ ...s.row, marginTop: 16, alignItems: 'flex-start' }}>
                <div style={s.label}>
                  <span style={s.labelText}>Badge</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <input ref={badgeFileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: 'none' }}
                      onChange={e => { const file = e.target.files?.[0]; if (file) handleBadgeUpload(file); e.target.value = ''; }} />
                    <button type="button" onClick={() => badgeFileRef.current?.click()} disabled={badgeUploading} style={s.secondaryBtn}>
                      <FontAwesomeIcon icon={badgeUploading ? faSpinner : faUpload} spin={badgeUploading} style={{ fontSize: 12 }} />
                      {form.badgeUrl ? 'Replace' : 'Upload'}
                    </button>
                    {form.badgeUrl && !badgeUploading && (
                      <button type="button" onClick={() => setForm(f => ({ ...f, badgeUrl: '' }))} style={{ ...s.secondaryBtn, color: C.danger, border: 'none' }}>
                        <FontAwesomeIcon icon={faXmark} style={{ fontSize: 11 }} /> Remove
                      </button>
                    )}
                  </div>
                  <span style={s.help}>PNG, JPG, WebP or SVG, up to 5 MB.</span>
                </div>
                <div style={s.label}>
                  <span style={s.labelText}>Star colour</span>
                  <StarColorPicker value={form.starColor} onChange={v => setForm(f => ({ ...f, starColor: v }))} />
                  <span style={s.help}>Earned for finishing every mission category at this rank.</span>
                </div>
              </div>
            </section>
          </div>

          {/* The result, in view while editing. */}
          <div style={{ position: isMobile ? 'static' : 'sticky', top: 16 }}>
            <PositionCareerPreview name={form.name} roleFocus={form.roleFocus} description={form.description}
              badgeUrl={form.badgeUrl} starColor={form.starColor} onPath={form.inCareerProgression} />
          </div>
        </div>

        <div style={s.footer}>
          {blocker && <span role="status" style={{ fontSize: 13, color: C.muted, marginRight: 'auto', alignSelf: 'center' }}>{blocker}</span>}
          <button type="button" onClick={goBack} style={s.cancelBtn}>Cancel</button>
          <button type="button" onClick={onSave} disabled={!canSave || saving} title={blocker ?? undefined}
            style={{ ...s.saveBtn, opacity: !canSave || saving ? 0.55 : 1, cursor: !canSave || saving ? 'default' : 'pointer' }}>
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
  inner: { maxWidth: 1040, margin: '0 auto' },

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
    margin: 0,
    fontSize: 22, fontWeight: 700, color: C.text,
    letterSpacing: '-0.02em',
  },

  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 },

  row: {
    display: 'flex', gap: 16, alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  label: {
    display: 'flex', flexDirection: 'column', gap: 6,
    flex: 1, minWidth: 0,
  },
  labelText: { fontSize: 13, fontWeight: 600, color: C.text },
  cardTitle: { margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: C.text },
  codeTag: { marginLeft: 10, padding: '2px 8px', borderRadius: 6, background: '#f1f5f9', color: C.muted, fontSize: 13, fontWeight: 700, verticalAlign: 'middle' },
  link: { color: '#5a67d8', fontWeight: 600, textDecoration: 'none' },
  secondaryBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 12px', fontSize: 13, fontWeight: 600, color: C.text, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' },
  req: { color: C.danger },
  input: {
    padding: '8px 12px', fontSize: 14,
    border: `1px solid ${C.border}`, borderRadius: 7,
    background: '#fff', color: C.text,
    fontFamily: 'inherit',
    outline: 'none',
  },
  help: { fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.5 },
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
