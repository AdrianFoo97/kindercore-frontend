import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faXmark, faCheck } from '@fortawesome/free-solid-svg-icons';
import { fetchIncidentStudentOptions, todayInMalaysia, IncidentInput } from '../../api/incidents.js';

// The incident report fields — shared by the teacher app's "Report an
// incident" page and the admin Operation → Incidents form, because the two
// must always ask exactly the same questions (they replaced one Google
// Form). Only the look differs, via `theme`.

export interface IncidentDraft extends IncidentInput {
  /** Names for the picked students, so chips render before options load. */
  studentNames: Record<string, string>;
}

export function emptyIncidentDraft(): IncidentDraft {
  return {
    incidentDate: todayInMalaysia(), incidentTime: '', location: '', description: '', actionsTaken: '',
    studentIds: [], otherChildren: '', studentNames: {},
  };
}

/** First thing missing, in form order — or null when the draft can be sent. */
export function incidentDraftProblem(d: IncidentDraft): string | null {
  if (d.studentIds.length === 0 && !d.otherChildren?.trim()) return 'Add at least one child involved';
  if (!d.incidentDate) return 'Pick the date of the incident';
  if (d.incidentDate > todayInMalaysia()) return 'The date can’t be in the future';
  if (!d.incidentTime) return 'Add the time of the incident';
  if (!d.location.trim()) return 'Add where it happened';
  if (!d.description.trim()) return 'Describe what happened';
  if (!d.actionsTaken.trim()) return 'Add what was done straight away';
  return null;
}

/** The draft as the API wants it. */
export function incidentDraftToInput(d: IncidentDraft): IncidentInput {
  return {
    incidentDate: d.incidentDate, incidentTime: d.incidentTime, location: d.location.trim(),
    description: d.description.trim(), actionsTaken: d.actionsTaken.trim(),
    studentIds: d.studentIds, otherChildren: d.otherChildren?.trim() || null,
  };
}

export interface IncidentTheme {
  font: string;
  accent: string;
  accentSoft: string;
  text: string;
  label: string;
  muted: string;
  border: string;
  fieldBg: string;
  radius: number;
  /** Teacher phones need 16px inputs or iOS zooms in on focus. */
  inputSize: number;
}

export const ADMIN_INCIDENT_THEME: IncidentTheme = {
  font: 'inherit', accent: '#5a67d8', accentSoft: '#eef2ff', text: '#0f172a', label: '#334155',
  muted: '#64748b', border: '#e2e8f0', fieldBg: '#fff', radius: 9, inputSize: 13.5,
};

export const TEACHER_INCIDENT_THEME: IncidentTheme = {
  font: 'inherit', accent: '#7c3aed', accentSoft: '#f5f3ff', text: '#334155', label: '#334155',
  muted: '#64748b', border: '#e5e7eb', fieldBg: '#fff', radius: 12, inputSize: 16,
};

interface Props {
  value: IncidentDraft;
  onChange: (next: IncidentDraft) => void;
  theme: IncidentTheme;
  disabled?: boolean;
}

export default function IncidentFormFields({ value, onChange, theme, disabled }: Props) {
  const set = <K extends keyof IncidentDraft>(k: K, v: IncidentDraft[K]) => onChange({ ...value, [k]: v });
  const st = styles(theme);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: theme.font }}>
      <Field label="Students involved" required group theme={theme}>
        <StudentPicker value={value} onChange={onChange} theme={theme} disabled={disabled} />
        <input
          value={value.otherChildren ?? ''} disabled={disabled} maxLength={500}
          onChange={e => set('otherChildren', e.target.value)}
          aria-label="Other children involved"
          placeholder="Child not in the list? Type their name here"
          style={{ ...st.input, marginTop: 8 }}
        />
      </Field>

      {/* Side by side when there's room; stacked on a phone. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <Field label="Date" required theme={theme}>
          <input type="date" value={value.incidentDate} max={todayInMalaysia()} disabled={disabled}
            onChange={e => set('incidentDate', e.target.value)} style={st.input} />
        </Field>
        <Field label="Time" required group theme={theme}>
          <TimeSelect value={value.incidentTime} onChange={t => set('incidentTime', t)} theme={theme} disabled={disabled} />
        </Field>
      </div>

      <Field label="Location" required theme={theme}>
        <input value={value.location} disabled={disabled} maxLength={191}
          onChange={e => set('location', e.target.value)}
          placeholder="e.g. Playground, Classroom 2, toilet" style={st.input} />
      </Field>

      <Field label="What happened" required theme={theme}>
        <textarea value={value.description} disabled={disabled} maxLength={5000}
          onChange={e => set('description', e.target.value)}
          placeholder="A short, factual account — who, what, how." style={st.textarea} />
      </Field>

      <Field label="Immediate actions taken" required theme={theme}>
        <textarea value={value.actionsTaken} disabled={disabled} maxLength={5000}
          onChange={e => set('actionsTaken', e.target.value)}
          placeholder="e.g. Cleaned the wound, applied ice, child rested in the office." style={st.textarea} />
      </Field>
    </div>
  );
}

/**
 * One labelled field. `group` is for fields holding several controls
 * (student picker, time dropdowns): those must NOT sit inside a <label> —
 * a browser forwards any click in a label's empty space to the first
 * control inside it, which in the student picker is a chip's remove
 * button, so clicking "outside" the list silently un-picked a child.
 */
function Field({ label, required, group, theme, children }: {
  label: string; required?: boolean; group?: boolean; theme: IncidentTheme; children: React.ReactNode;
}) {
  const caption = (
    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: theme.label, marginBottom: 6 }}>
      {label}{required && <span style={{ color: '#dc2626' }}> *</span>}
    </span>
  );
  if (group) {
    return <div role="group" aria-label={label} style={{ minWidth: 0 }}>{caption}{children}</div>;
  }
  return <label style={{ display: 'block', minWidth: 0 }}>{caption}{children}</label>;
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = ['00', '15', '30', '45'];
type Meridiem = 'AM' | 'PM';

/** 'HH:MM' (24-hour) → its dropdown parts, or blanks. */
function splitTime(v: string): { hour: string; minute: string; meridiem: Meridiem | '' } {
  const m = v.match(/^(\d{2}):(\d{2})$/);
  if (!m) return { hour: '', minute: '', meridiem: '' };
  const h = Number(m[1]);
  return { hour: String(h % 12 || 12), minute: m[2], meridiem: h < 12 ? 'AM' : 'PM' };
}

/**
 * Hour / minute / AM-PM as three plain dropdowns (the browser time picker
 * was awkward on phones). The value only counts once all three are picked —
 * until then the form sees '' and asks for the time. Minutes are quarter
 * hours (00 / 15 / 30 / 45) — near enough for an incident — plus
 * whatever an existing report already has.
 */
function TimeSelect({ value, onChange, theme, disabled }: {
  value: string; onChange: (v: string) => void; theme: IncidentTheme; disabled?: boolean;
}) {
  const st = styles(theme);
  const [parts, setParts] = useState(() => splitTime(value));
  const minutes = parts.minute && !MINUTES.includes(parts.minute) ? [...MINUTES, parts.minute].sort() : MINUTES;

  const update = (patch: Partial<typeof parts>) => {
    const next = { ...parts, ...patch };
    setParts(next);
    if (!next.hour || !next.minute || !next.meridiem) { onChange(''); return; }
    const h = (Number(next.hour) % 12) + (next.meridiem === 'PM' ? 12 : 0);
    onChange(`${String(h).padStart(2, '0')}:${next.minute}`);
  };

  const select = (placeholderOn: boolean): React.CSSProperties => ({
    ...st.input, flex: 1, minWidth: 0, padding: '9px 8px', color: placeholderOn ? theme.muted : theme.text, cursor: disabled ? 'default' : 'pointer',
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <select aria-label="Hour" value={parts.hour} disabled={disabled} onChange={e => update({ hour: e.target.value })} style={select(!parts.hour)}>
        <option value="" disabled>Hour</option>
        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <span style={{ color: theme.muted, fontWeight: 700 }}>:</span>
      <select aria-label="Minute" value={parts.minute} disabled={disabled} onChange={e => update({ minute: e.target.value })} style={select(!parts.minute)}>
        <option value="" disabled>Min</option>
        {minutes.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <select aria-label="AM or PM" value={parts.meridiem} disabled={disabled} onChange={e => update({ meridiem: e.target.value as Meridiem })} style={select(!parts.meridiem)}>
        <option value="" disabled>AM/PM</option>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

/** Search-and-tick list of current students; picked ones show as chips above. */
function StudentPicker({ value, onChange, theme, disabled }: Props) {
  const st = styles(theme);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { data: options = [], isLoading } = useQuery({
    queryKey: ['incident-student-options'],
    queryFn: fetchIncidentStudentOptions,
    staleTime: 5 * 60 * 1000,
  });

  const q = query.trim().toLowerCase();
  // Grouped by age (the API already sorts youngest first, then by name).
  const groups = useMemo(() => {
    const hits = q ? options.filter(o => o.childName.toLowerCase().includes(q)) : options;
    const out: { label: string; items: typeof options }[] = [];
    for (const o of hits) {
      const label = o.age === null ? 'Age not set' : `Age ${o.age}`;
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(o);
      else out.push({ label, items: [o] });
    }
    return out;
  }, [options, q]);

  const toggle = (id: string, name: string) => {
    const has = value.studentIds.includes(id);
    onChange({
      ...value,
      studentIds: has ? value.studentIds.filter(x => x !== id) : [...value.studentIds, id],
      studentNames: { ...value.studentNames, [id]: name },
    });
  };

  return (
    <div>
      {value.studentIds.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {value.studentIds.map(id => {
            const name = value.studentNames[id] ?? options.find(o => o.id === id)?.childName ?? 'Student';
            return (
              <span key={id} style={st.chip}>
                {name}
                <button type="button" onClick={() => toggle(id, name)} disabled={disabled}
                  aria-label={`Remove ${name}`} style={st.chipX}>
                  <FontAwesomeIcon icon={faXmark} style={{ fontSize: 10 }} />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <FontAwesomeIcon icon={faMagnifyingGlass}
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: theme.muted }} />
        <input
          value={query} disabled={disabled}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          // Delay so a tap on an option lands before the list closes.
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          aria-label="Search students"
          placeholder={isLoading ? 'Loading students…' : 'Search a student’s name'}
          style={{ ...st.input, paddingLeft: 32 }}
        />
        {open && !disabled && (
          <div style={st.menu} role="listbox" aria-multiselectable>
            {groups.length === 0 ? (
              <div style={{ padding: '10px 12px', fontSize: 13, color: theme.muted }}>
                {isLoading ? 'Loading…' : 'No student matches — type the name in the box below instead.'}
              </div>
            ) : groups.map(g => (
              <div key={g.label} role="group" aria-label={g.label}>
                <div style={st.groupLabel}>{g.label}</div>
                {g.items.map(o => {
                  const on = value.studentIds.includes(o.id);
                  return (
                    <button key={o.id} type="button" role="option" aria-selected={on}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => toggle(o.id, o.childName)}
                      style={st.option(on)}>
                      <span style={st.tick(on)}>{on && <FontAwesomeIcon icon={faCheck} style={{ fontSize: 9 }} />}</span>
                      {o.childName}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function styles(t: IncidentTheme) {
  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '9px 12px', fontSize: t.inputSize,
    border: `1px solid ${t.border}`, borderRadius: t.radius, background: t.fieldBg, color: t.text,
    fontFamily: 'inherit', outline: 'none',
  };
  return {
    input,
    textarea: { ...input, minHeight: 96, resize: 'vertical', lineHeight: 1.5 } as React.CSSProperties,
    chip: {
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 4px 4px 10px', borderRadius: 999,
      background: t.accentSoft, color: t.accent, fontSize: 13, fontWeight: 600,
    } as React.CSSProperties,
    chipX: {
      width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      border: 'none', borderRadius: '50%', background: 'transparent', color: t.accent, cursor: 'pointer', padding: 0,
    } as React.CSSProperties,
    menu: {
      position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20, maxHeight: 300, overflowY: 'auto',
      background: '#fff', border: `1px solid ${t.border}`, borderRadius: t.radius, padding: 4,
      boxShadow: '0 10px 30px rgba(15,23,42,0.12)',
    } as React.CSSProperties,
    // Sticks while scrolling its group, so you always know which age you're in.
    groupLabel: {
      position: 'sticky', top: -4, zIndex: 1, padding: '7px 10px 4px', background: '#fff',
      fontSize: 10.5, fontWeight: 800, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.07em',
    } as React.CSSProperties,
    option: (on: boolean): React.CSSProperties => ({
      display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', border: 'none',
      borderRadius: 6, background: on ? t.accentSoft : 'transparent', color: t.text, fontSize: 13.5,
      fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
    }),
    tick: (on: boolean): React.CSSProperties => ({
      width: 16, height: 16, flexShrink: 0, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      border: `1.5px solid ${on ? t.accent : '#cbd5e1'}`, background: on ? t.accent : '#fff', color: '#fff',
    }),
  };
}
