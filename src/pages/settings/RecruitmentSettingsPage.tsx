import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faTrash, faCheck, faGripVertical, faChalkboardUser, faGraduationCap, faClock,
  faBullhorn,
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
const DEFAULT_EXPERIENCE_RANGES = [
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

export default function RecruitmentSettingsPage() {
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
    <div style={S.page}>
      <div style={S.inner}>
        <SettingsBreadcrumb label="Recruitment" />
        <h1 style={S.heading}>Recruitment</h1>
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

// ─── Positions editor ────────────────────────────────────────────────────────
//
// Dedicated editor for `recruitment_positions` because rows carry an
// optional salary band (min + max). Same add/remove/reorder mechanics as
// ListEditor, plus two extra numeric inputs per row.

function PositionsEditor(props: { initial: RecruitmentPosition[]; isAdmin: boolean }) {
  const qc = useQueryClient();
  const { showToast } = useToast();

  const [items, setItems] = useState<RecruitmentPosition[]>(props.initial);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Re-seed when the query refreshes (e.g. after saving one of the other
  // lists on this same page). Compare by JSON to avoid a shallow-eq trap.
  useEffect(() => { setItems(props.initial); }, [JSON.stringify(props.initial)]);

  const dirty = JSON.stringify(items) !== JSON.stringify(props.initial);

  const add = () => {
    const t = newName.trim();
    if (!t) return;
    if (items.some(x => x.name.toLowerCase() === t.toLowerCase())) {
      showToast('Already in the list', 'error');
      return;
    }
    setItems(prev => [...prev, { name: t, minSalary: null, maxSalary: null }]);
    setNewName('');
  };
  const remove = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    setItems(prev => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };
  const patchAt = (idx: number, patch: Partial<RecruitmentPosition>) =>
    setItems(prev => prev.map((x, i) => i === idx ? { ...x, ...patch } : x));

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

  return (
    <section style={S.card}>
      <header style={S.cardHeader}>
        <div style={S.cardTitleWrap}>
          <FontAwesomeIcon icon={faChalkboardUser} style={{ color: C.primary }} />
          <h2 style={S.cardTitle}>Positions</h2>
        </div>
        <p style={S.cardDesc}>
          Roles candidates can choose from. When you set a salary band, the
          apply form shows it as a hint below the position dropdown so
          candidates know the typical range before naming their expected pay.
        </p>
      </header>

      <ul style={S.list}>
        {items.map((p, idx) => (
          <li key={`${p.name}-${idx}`} style={S.positionRow}>
            <div style={S.handles}>
              <button type="button" style={S.arrowBtn(props.isAdmin && idx > 0)}
                onClick={() => move(idx, -1)} disabled={!props.isAdmin || idx === 0}
                aria-label="Move up">▲</button>
              <button type="button" style={S.arrowBtn(props.isAdmin && idx < items.length - 1)}
                onClick={() => move(idx, 1)} disabled={!props.isAdmin || idx === items.length - 1}
                aria-label="Move down">▼</button>
            </div>
            <FontAwesomeIcon icon={faGripVertical} style={{ color: C.muted, fontSize: 12 }} />
            <input
              style={{ ...S.itemInput, flex: 2 }}
              value={p.name}
              disabled={!props.isAdmin}
              onChange={e => patchAt(idx, { name: e.target.value })}
              placeholder="Position name"
            />
            <input
              style={{ ...S.itemInput, flex: 1, maxWidth: 130 }}
              type="number"
              min={0}
              value={p.minSalary ?? ''}
              disabled={!props.isAdmin}
              onChange={e => patchAt(idx, { minSalary: numOrNull(e.target.value) })}
              placeholder="Min RM"
            />
            <span style={S.dash}>–</span>
            <input
              style={{ ...S.itemInput, flex: 1, maxWidth: 130 }}
              type="number"
              min={0}
              value={p.maxSalary ?? ''}
              disabled={!props.isAdmin}
              onChange={e => patchAt(idx, { maxSalary: numOrNull(e.target.value) })}
              placeholder="Max RM"
            />
            {props.isAdmin && (
              <button type="button" style={S.removeBtn}
                onClick={() => remove(idx)} aria-label="Remove">
                <FontAwesomeIcon icon={faTrash} />
              </button>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li style={S.empty}>No positions yet. Add one below.</li>
        )}
      </ul>

      {props.isAdmin && (
        <div style={S.addRow}>
          <input
            style={S.addInput}
            placeholder="e.g. Junior Teacher"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          />
          <button type="button" style={S.addBtn(newName.trim().length > 0)}
            disabled={!newName.trim()} onClick={add}>
            <FontAwesomeIcon icon={faPlus} /> Add
          </button>
        </div>
      )}

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
  const [newItem, setNewItem] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const lockedSet = new Set((props.lockedValues ?? []).map(v => v.toLowerCase()));
  const isLocked = (v: string) => lockedSet.has(v.toLowerCase());

  // Re-seed local state when the query refreshes — e.g. after cache invalidation
  // from the OTHER list saving on the same page.
  useEffect(() => { setItems(props.initial); }, [props.initial.join('||')]);

  const dirty = items.length !== props.initial.length
    || items.some((v, i) => v !== props.initial[i]);

  const add = () => {
    const t = newItem.trim();
    if (!t) return;
    // No duplicates — the dropdown collapses them anyway.
    if (items.some(x => x.toLowerCase() === t.toLowerCase())) {
      showToast('Already in the list', 'error');
      return;
    }
    setItems(prev => [...prev, t]);
    setNewItem('');
  };

  const remove = (idx: number) => setItems(prev => {
    const target = prev[idx];
    if (target && isLocked(target)) {
      showToast(`"${target}" is a system option and can't be removed.`, 'error');
      return prev;
    }
    return prev.filter((_, i) => i !== idx);
  });

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    setItems(prev => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

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
      <header style={S.cardHeader}>
        <div style={S.cardTitleWrap}>
          <FontAwesomeIcon icon={props.icon} style={{ color: C.primary }} />
          <h2 style={S.cardTitle}>{props.title}</h2>
        </div>
        <p style={S.cardDesc}>{props.description}</p>
      </header>

      <ul style={S.list}>
        {items.map((label, idx) => {
          const locked = isLocked(label);
          return (
          <li key={`${label}-${idx}`} style={S.listItem}>
            <div style={S.handles}>
              <button type="button" style={S.arrowBtn(props.isAdmin && idx > 0)}
                onClick={() => move(idx, -1)} disabled={!props.isAdmin || idx === 0}
                aria-label="Move up">▲</button>
              <button type="button" style={S.arrowBtn(props.isAdmin && idx < items.length - 1)}
                onClick={() => move(idx, 1)} disabled={!props.isAdmin || idx === items.length - 1}
                aria-label="Move down">▼</button>
            </div>
            <FontAwesomeIcon icon={faGripVertical} style={{ color: C.muted, fontSize: 12 }} />
            <input
              style={S.itemInput}
              value={label}
              disabled={!props.isAdmin || locked}
              onChange={e => {
                const v = e.target.value;
                setItems(prev => prev.map((x, i) => i === idx ? v : x));
              }}
            />
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
            {props.isAdmin && !locked && (
              <button type="button" style={S.removeBtn}
                onClick={() => remove(idx)} aria-label="Remove">
                <FontAwesomeIcon icon={faTrash} />
              </button>
            )}
          </li>
          );
        })}
        {items.length === 0 && (
          <li style={S.empty}>No entries yet. Add one below.</li>
        )}
      </ul>

      {props.isAdmin && (
        <div style={S.addRow}>
          <input
            style={S.addInput}
            placeholder={props.placeholder}
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          />
          <button type="button" style={S.addBtn(newItem.trim().length > 0)}
            disabled={!newItem.trim()} onClick={add}>
            <FontAwesomeIcon icon={faPlus} /> Add
          </button>
        </div>
      )}

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
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
    padding: 18, marginBottom: 16,
  } as React.CSSProperties,
  cardHeader: { marginBottom: 12 } as React.CSSProperties,
  cardTitleWrap: { display: 'flex', alignItems: 'center', gap: 10 } as React.CSSProperties,
  cardTitle: { fontSize: 16, fontWeight: 700, margin: 0, color: C.text } as React.CSSProperties,
  cardDesc: { fontSize: 13, color: C.muted, margin: '4px 0 0' } as React.CSSProperties,
  list: { listStyle: 'none', padding: 0, margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 6 } as React.CSSProperties,
  listItem: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: C.bg, padding: '6px 8px', borderRadius: 8,
    border: `1px solid ${C.borderSoft}`,
  } as React.CSSProperties,
  positionRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: C.bg, padding: '6px 8px', borderRadius: 8,
    border: `1px solid ${C.borderSoft}`, flexWrap: 'wrap',
  } as React.CSSProperties,
  dash: { color: C.muted, fontSize: 14 } as React.CSSProperties,
  handles: { display: 'flex', flexDirection: 'column', gap: 2 } as React.CSSProperties,
  arrowBtn: (enabled: boolean): React.CSSProperties => ({
    width: 18, height: 14, fontSize: 9, lineHeight: 1,
    border: `1px solid ${C.border}`, background: '#fff',
    borderRadius: 3, padding: 0,
    color: enabled ? C.textSub : '#cbd5e1',
    cursor: enabled ? 'pointer' : 'default',
  }),
  itemInput: {
    flex: 1, border: `1px solid ${C.border}`, borderRadius: 6,
    padding: '8px 10px', fontSize: 14, background: '#fff', color: C.text,
    outline: 'none',
  } as React.CSSProperties,
  removeBtn: {
    border: `1px solid ${C.border}`, background: '#fff', color: C.danger,
    borderRadius: 6, width: 32, height: 32, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
  } as React.CSSProperties,
  empty: {
    padding: '20px 12px', textAlign: 'center', fontSize: 13, color: C.muted,
    background: C.bg, borderRadius: 8, border: `1px dashed ${C.border}`,
  } as React.CSSProperties,
  addRow: { display: 'flex', gap: 8, marginTop: 8 } as React.CSSProperties,
  addInput: {
    flex: 1, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: '9px 12px', fontSize: 14, background: '#fff', color: C.text, outline: 'none',
  } as React.CSSProperties,
  addBtn: (active: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: active ? C.primary : '#cbd5e1', color: '#fff', border: 'none',
    padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: active ? 'pointer' : 'default',
  }),
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
