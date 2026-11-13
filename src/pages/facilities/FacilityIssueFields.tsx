import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FACILITY_CATEGORIES, type FacilityDraft } from './facilityDisplay.js';
import { CATEGORY_ICON } from './facilityLook.js';
import AttachmentPicker from './AttachmentPicker.js';

// The "report a facility issue" fields — used by the teacher app's report
// page and the admin report pop-up, each with its own colours.

export interface FacilityFieldsTheme {
  accent: string;
  accentSoft: string;
  text: string;
  muted: string;
  border: string;
  inputBg: string;
}

export const TEACHER_FACILITY_THEME: FacilityFieldsTheme = {
  accent: '#7c3aed', accentSoft: '#f5f3ff', text: '#334155', muted: '#64748b', border: '#e2e8f0', inputBg: '#ffffff',
};
export const ADMIN_FACILITY_THEME: FacilityFieldsTheme = {
  accent: '#5a67d8', accentSoft: '#eef2ff', text: '#0f172a', muted: '#64748b', border: '#e2e8f0', inputBg: '#ffffff',
};

interface Props {
  value: FacilityDraft;
  onChange: (d: FacilityDraft) => void;
  theme: FacilityFieldsTheme;
  disabled?: boolean;
}

export default function FacilityIssueFields({ value, onChange, theme: t, disabled }: Props) {
  const set = <K extends keyof FacilityDraft>(key: K, v: FacilityDraft[K]) => onChange({ ...value, [key]: v });
  const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 6 };
  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '11px 12px', fontSize: 15, borderRadius: 10,
    border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontFamily: 'inherit', outline: 'none',
  };
  const urgent = value.urgency === 'URGENT';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={label} htmlFor="fac-title">What’s wrong?</label>
        <input id="fac-title" style={input} value={value.title} disabled={disabled} maxLength={191}
          placeholder="e.g. Toilet door won’t lock" onChange={e => set('title', e.target.value)} />
      </div>

      <div>
        <span style={label}>Kind of problem</span>
        <div role="radiogroup" aria-label="Kind of problem" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
          {FACILITY_CATEGORIES.map(c => {
            const on = value.category === c.key;
            return (
              <button key={c.key} type="button" role="radio" aria-checked={on} disabled={disabled}
                onClick={() => set('category', c.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10,
                  border: `1.5px solid ${on ? t.accent : t.border}`, background: on ? t.accentSoft : t.inputBg,
                  color: on ? t.accent : t.text, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', textAlign: 'left',
                  cursor: disabled ? 'default' : 'pointer', WebkitTapHighlightColor: 'transparent',
                }}>
                <FontAwesomeIcon icon={CATEGORY_ICON[c.key]} style={{ fontSize: 13, width: 16, color: on ? t.accent : t.muted }} />
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label style={label} htmlFor="fac-location">Where?</label>
        <input id="fac-location" style={input} value={value.location} disabled={disabled} maxLength={191}
          placeholder="e.g. Level 1 toilet, Sunflower class" onChange={e => set('location', e.target.value)} />
      </div>

      <div>
        <label style={label} htmlFor="fac-desc">More details <span style={{ fontWeight: 500, color: t.muted }}>(optional)</span></label>
        <textarea id="fac-desc" style={{ ...input, minHeight: 84, resize: 'vertical' }} value={value.description} disabled={disabled}
          maxLength={5000} placeholder="Anything that helps fix it — since when, how bad…" onChange={e => set('description', e.target.value)} />
      </div>

      <div>
        <span style={label}>Photo or video</span>
        <AttachmentPicker files={value.files} onChange={files => set('files', files)} theme={t} disabled={disabled} />
      </div>

      {/* Urgent = unsafe for the children or stops a class. */}
      <button type="button" role="switch" aria-checked={urgent} disabled={disabled}
        onClick={() => set('urgency', urgent ? 'NORMAL' : 'URGENT')} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, textAlign: 'left',
          border: `1.5px solid ${urgent ? '#fca5a5' : t.border}`, background: urgent ? '#fef2f2' : t.inputBg,
          fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer', WebkitTapHighlightColor: 'transparent',
        }}>
        <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 16, color: urgent ? '#dc2626' : t.muted }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: urgent ? '#b91c1c' : t.text }}>Urgent</span>
          <span style={{ display: 'block', fontSize: 12.5, color: t.muted, marginTop: 1 }}>Unsafe for the children, or stops a class running</span>
        </span>
        <span aria-hidden style={{
          width: 40, height: 24, borderRadius: 999, flexShrink: 0, position: 'relative',
          background: urgent ? '#dc2626' : '#cbd5e1', transition: 'background 0.15s',
        }}>
          <span style={{
            position: 'absolute', top: 3, left: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff',
            transform: urgent ? 'translateX(16px)' : 'none', transition: 'transform 0.15s',
          }} />
        </span>
      </button>
    </div>
  );
}
