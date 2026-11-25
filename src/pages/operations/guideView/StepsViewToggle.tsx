import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faListUl } from '@fortawesome/free-solid-svg-icons';

// "Full / Steps only" above a guide's steps — a two-option segmented control.

interface Props { collapsed: boolean; onChange: (collapsed: boolean) => void; accent: string }

export default function StepsViewToggle({ collapsed, onChange, accent }: Props) {
  const option = (on: boolean, label: string, icon: typeof faBars, value: boolean) => (
    <button type="button" role="radio" aria-checked={on} onClick={() => onChange(value)} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, padding: '0 12px', border: 'none', borderRadius: 8,
      background: on ? '#fff' : 'transparent', color: on ? accent : '#64748b', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
      cursor: 'pointer', boxShadow: on ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
    }}>
      <FontAwesomeIcon icon={icon} style={{ fontSize: 11 }} />{label}
    </button>
  );
  return (
    <div role="radiogroup" aria-label="How much to show" style={{ display: 'inline-flex', gap: 2, padding: 3, background: '#f1f5f9', borderRadius: 10, flexShrink: 0 }}>
      {option(!collapsed, 'Full', faBars, false)}
      {option(collapsed, 'Steps only', faListUl, true)}
    </div>
  );
}
