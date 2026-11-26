import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLocationDot } from '@fortawesome/free-solid-svg-icons';
import type { BranchOption } from './useBranch.js';

// Which branch's classes and subjects you're looking at. Hidden with one branch (nothing to choose).

export default function BranchPicker({ branches, value, onChange }: { branches: BranchOption[]; value: string | null; onChange: (id: string) => void }) {
  if (branches.length < 2) return null;
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 36, padding: '0 12px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
      <FontAwesomeIcon icon={faLocationDot} style={{ fontSize: 12, color: '#64748b' }} />
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Branch</span>
      <select value={value ?? ''} onChange={e => onChange(e.target.value)} aria-label="Branch"
        style={{ border: 'none', background: 'none', fontSize: 13, fontWeight: 600, color: '#0f172a', fontFamily: 'inherit', cursor: 'pointer', padding: '6px 0', outline: 'none' }}>
        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
    </label>
  );
}
