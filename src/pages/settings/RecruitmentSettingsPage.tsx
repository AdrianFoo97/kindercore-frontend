import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faCheck, faXmark, faGraduationCap, faClock, faBullhorn,
} from '@fortawesome/free-solid-svg-icons';
import { fetchSettings, patchSetting } from '../../api/settings.js';
import { C, S, DragGrip, RowMenu, useDragReorder } from './recruitmentSettingsUi.js';
import RecruitmentPositionsEditor from './RecruitmentPositionsEditor.js';
import { useToast } from '../../components/common/Toast.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.js';
import { useCanEditThisSetting } from './useSettingsAccess.js';

// Two admin-curated lists that drive the public Apply form dropdowns:
//   - recruitment_positions     → "Position" dropdown
//   - recruitment_qualifications → "Highest qualification" dropdown
// Both are stored as string[] in SystemSetting and surfaced publicly via
// /api/candidates/form-options. Server falls back to sensible defaults if
// either key is unset, so a brand-new install still has a working form.


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

/** Recruitment settings, in two tabs: what the public job application form offers, and how interviews are scheduled. */
const TABS = [
  { key: 'form', label: 'Job application form', about: 'What candidates see and choose from on the public apply form.' },
  { key: 'interviews', label: 'Interviews', about: 'How interview slots are scheduled and confirmed.' },
] as const;
type TabKey = typeof TABS[number]['key'];

export default function RecruitmentSettingsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [tab, setTab] = useState<TabKey>('form');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  const raw = localStorage.getItem('user');
  const user = raw ? (JSON.parse(raw) as { role: string }) : null;
  // Whoever this settings page is for may change it (settingsNav SETTINGS_ACCESS; the server checks each save).
  const isAdmin = useCanEditThisSetting();

  if (isLoading) return <p style={S.state}><LoadingSpinner /></p>;
  if (isError) return <p style={{ ...S.state, color: C.danger }}>Failed to load settings.</p>;

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
            <h1 style={S.heading}>Recruitment</h1>
          </>
        )}
        {!isAdmin && (
          <p style={S.readonly}>Read-only — admin role required to save changes.</p>
        )}

        <div role="tablist" aria-label="Recruitment settings" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, borderBottom: '1px solid #e2e8f0' }}>
          {TABS.map(x => {
            const on = x.key === tab;
            return (
              <button key={x.key} type="button" role="tab" aria-selected={on} onClick={() => setTab(x.key)} style={{
                minHeight: 44, padding: '0 12px', marginBottom: -1, border: 'none', background: 'none', whiteSpace: 'nowrap',
                borderBottom: `2px solid ${on ? C.primary : 'transparent'}`, color: on ? C.primary : C.textSub,
                fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{x.label}</button>
            );
          })}
        </div>
        <p style={{ margin: '12px 0 16px', fontSize: 13, color: C.textSub }}>{TABS.find(x => x.key === tab)!.about}</p>

        {/* Both tabs stay mounted (just hidden), so switching keeps unsaved edits. */}
        <div role="tabpanel" aria-label="Job application form" hidden={tab !== 'form'}>
        <RecruitmentPositionsEditor stored={data?.recruitment_positions} isAdmin={isAdmin} />

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
        </div>

        <div role="tabpanel" aria-label="Interviews" hidden={tab !== 'interviews'}>

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

      <div className="m-scroll-x">
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
