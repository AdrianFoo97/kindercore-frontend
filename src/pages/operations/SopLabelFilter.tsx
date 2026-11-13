import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faChevronDown } from '@fortawesome/free-solid-svg-icons';

// How-To Guides → "All labels ▾": filter the guide list to one label. A
// dropdown (not a row of pills) so it stays one control however many labels
// exist. Escape or a click outside closes it.

const C = { border: '#eef0f4', text: '#0f172a', textSub: '#475569', muted: '#64748b', divider: '#f1f5f9' };

interface Label { id: string; name: string; color: string }

export default function SopLabelFilter({ labels, value, onChange, compact, fullWidth }: {
  labels: Label[];
  /** 'ALL' or a label id. */
  value: string;
  onChange: (value: string) => void;
  /** The teacher app's narrow toolbar. */
  compact?: boolean;
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = labels.find(l => l.id === value);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const pick = (v: string) => { onChange(v); setOpen(false); };
  const ellipsis: React.CSSProperties | undefined = compact ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 } : undefined;

  return (
    <div ref={ref} onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
      style={compact ? { position: 'relative', flexShrink: 0, width: 132 } : { position: 'relative', ...(fullWidth ? { width: '100%' } : null) }}>
      <style>{`.sop-catfilter-trigger:hover { border-color: var(--sop-accent-border) !important; background: var(--sop-accent-soft) !important; }
        .sop-catfilter-item:hover { background: ${C.divider} !important; }`}</style>
      <button type="button" className="sop-catfilter-trigger" onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}
        style={{ ...trigger, ...(compact ? { width: '100%', minWidth: 0, padding: '0 10px' } : fullWidth ? { width: '100%' } : null) }}>
        {selected && <span style={{ ...dot, background: selected.color }} />}
        <span style={ellipsis}>{selected ? selected.name : 'All labels'}</span>
        <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 9, color: C.muted, marginLeft: 'auto', paddingLeft: 6, flexShrink: 0 }} />
      </button>
      {open && (
        <div role="listbox" aria-label="Filter by label" style={{ ...menu, ...(compact ? { width: 220, left: 'auto', right: 0 } : fullWidth ? { width: '100%' } : null) }}>
          <Option selected={value === 'ALL'} onPick={() => pick('ALL')}>All labels</Option>
          {labels.map(l => (
            <Option key={l.id} selected={value === l.id} onPick={() => pick(l.id)}>
              <span style={{ ...dot, background: l.color }} />{l.name}
            </Option>
          ))}
        </div>
      )}
    </div>
  );
}

function Option({ selected, onPick, children }: { selected: boolean; onPick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="option" aria-selected={selected} className="sop-catfilter-item" onClick={onPick} style={item}>
      <span style={{ width: 14 }}>{selected && <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10, color: 'var(--sop-accent)' }} />}</span>
      {children}
    </button>
  );
}

const trigger: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 36, padding: '0 14px',
  border: `1px solid ${C.border}`, borderRadius: 10, background: '#fff', fontFamily: 'inherit',
  cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.textSub,
  minWidth: 180, transition: 'border-color 120ms ease, background 120ms ease',
};
const dot: React.CSSProperties = { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 };
const menu: React.CSSProperties = {
  position: 'absolute', top: '100%', left: 0, marginTop: 6, width: 240,
  background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10,
  boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 25,
  maxHeight: 280, overflowY: 'auto', padding: 6,
};
const item: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 32, padding: '0 8px',
  border: 'none', background: 'transparent', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 13, color: C.text, textAlign: 'left',
};
