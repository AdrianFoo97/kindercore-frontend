import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';

// "Steps only" view: the chevron beside a step's title that opens (or closes)
// just that step's details. A 44 px tap area around a small icon.

export default function StepOpenButton({ open, title, onClick }: { open: boolean; title: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} details of “${title}”`}
      title={open ? 'Hide details' : 'Show details'} style={{
        flexShrink: 0, width: 44, height: 44, margin: '-12px -10px -12px 0', padding: 0, border: 'none', background: 'transparent',
        color: '#64748b', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
      <FontAwesomeIcon icon={open ? faChevronUp : faChevronDown} />
    </button>
  );
}
