import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDownWideShort } from '@fortawesome/free-solid-svg-icons';

// How-To Guides → the "sort" dropdown, used for both the guide list and the
// label list. A native <select>, so phones show their own picker.

export default function SopSortSelect<K extends string>({ options, value, onChange, label, grow }: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  /** What's being sorted, for screen readers and the tooltip ("Sort guides"). */
  label: string;
  /** Take the remaining width (phone toolbars). */
  grow?: boolean;
}) {
  return (
    <label style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0, ...(grow ? { flex: 1, minWidth: 0 } : null) }}>
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{label}</span>
      <FontAwesomeIcon icon={faArrowDownWideShort} style={{ position: 'absolute', left: 12, fontSize: 12, color: '#64748b', pointerEvents: 'none' }} />
      <select value={value} onChange={e => onChange(e.target.value as K)} title={label} style={{
        width: '100%', minHeight: 36, padding: '0 12px 0 32px', borderRadius: 10, border: '1px solid #eef0f4',
        background: '#fff', color: '#0f172a', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
      }}>
        {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
    </label>
  );
}
