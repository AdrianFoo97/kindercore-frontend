import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';

// A guide's steps → which section to show, as a dropdown (sections can be
// many — a dropdown, never a row of pills). Sits right of "Full / Steps only".

export const ALL_SECTIONS = 'ALL';

interface Props {
  sections: string[];
  counts: Map<string, number>;
  total: number;
  value: string;
  onChange: (section: string) => void;
}

export default function SectionSelect({ sections, counts, total, value, onChange }: Props) {
  return (
    <label style={{ position: 'relative', display: 'inline-flex', minWidth: 0, maxWidth: '55%' }}>
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Section</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        appearance: 'none', WebkitAppearance: 'none', minHeight: 38, maxWidth: '100%', padding: '0 32px 0 12px', borderRadius: 10,
        border: '1px solid #e2e8f0', background: '#fff', color: '#0f172a', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
        cursor: 'pointer', textOverflow: 'ellipsis',
      }}>
        <option value={ALL_SECTIONS}>All sections · {total}</option>
        {sections.map(sec => <option key={sec} value={sec}>{sec} · {counts.get(sec) ?? 0}</option>)}
      </select>
      <FontAwesomeIcon icon={faChevronDown} aria-hidden style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#64748b', pointerEvents: 'none' }} />
    </label>
  );
}
