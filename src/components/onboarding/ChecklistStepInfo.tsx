import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';

// The ⓘ beside a checklist step that has a description. Hover (or keyboard
// focus) shows it on a computer; a tap shows / hides it on a phone. Clicking it
// never ticks the step.

const C = { icon: '#64748b', iconOn: '#4f5bd5', bg: '#1e293b', text: '#fff' };
const TIP_WIDTH = 260;

export default function ChecklistStepInfo({ text, size = 'md' }: { text: string; size?: 'md' | 'lg' }) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const open = hover || pinned;

  // A tapped-open tip closes when you tap anywhere else.
  useEffect(() => {
    if (!pinned) return;
    const close = (e: MouseEvent | TouchEvent) => { if (!ref.current?.contains(e.target as Node)) setPinned(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close); };
  }, [pinned]);

  const box = size === 'lg' ? 44 : 28;
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button type="button" aria-label="About this step" aria-expanded={open}
        onClick={e => { e.preventDefault(); e.stopPropagation(); setPinned(p => !p); }}
        onFocus={() => setHover(true)} onBlur={() => setHover(false)}
        onKeyDown={e => { if (e.key === 'Escape') { setPinned(false); setHover(false); } }}
        style={{
          width: box, height: box, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', background: 'none', padding: 0, cursor: 'pointer',
          color: open ? C.iconOn : C.icon, fontSize: size === 'lg' ? 16 : 14,
        }}>
        <FontAwesomeIcon icon={faCircleInfo} />
      </button>
      {open && (
        <span role="tooltip" style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', right: 0, zIndex: 20, width: TIP_WIDTH, maxWidth: '80vw',
          padding: '8px 12px', borderRadius: 8, background: C.bg, color: C.text,
          fontSize: 13, fontWeight: 500, lineHeight: 1.5, whiteSpace: 'pre-wrap', textAlign: 'left',
          boxShadow: '0 4px 16px rgba(15,23,42,0.2)',
        }}>
          {text}
        </span>
      )}
    </span>
  );
}
