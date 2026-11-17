import { useEffect, useId, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useIsMobile } from '../../hooks/useIsMobile.js';

export interface SearchOption { value: string; label: string; /** Shown muted after the label, and searched too (e.g. a position). */ hint?: string }

interface Props {
  id?: string;
  /** For screen readers when there's no visible <label htmlFor>. */
  ariaLabel?: string;
  options: SearchOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  /** Shown when nothing matches what's typed. */
  noMatches?: string;
}

const MAX_LIST_HEIGHT = 280;
const LIST_GAP = 4;
const COLORS = { text: '#0f172a', sub: '#334155', muted: '#64748b', border: '#cbd5e1', hover: '#eef2ff', accent: '#5a67d8' };

/** Every word typed appears in the label or hint, in any order, any case. */
export const matchesQuery = (o: SearchOption, query: string) => {
  const text = `${o.label} ${o.hint ?? ''}`.toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every(w => text.includes(w));
};

/**
 * A dropdown you can type into to find an option — for lists that can be long
 * (staff, forms, positions). Arrow keys + Enter pick, Esc closes. Shows the
 * chosen option's label when closed.
 */
export default function SearchSelect({ id, ariaLabel, options, value, onChange, placeholder, disabled, noMatches = 'Nothing matches.' }: Props) {
  const { isMobile } = useIsMobile();
  const auto = useId();
  const inputId = id ?? `ss-${auto}`;
  const listId = `${inputId}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // The list is placed against the screen (fixed), so a pop-up's scrolling body can't cut it off;
  // it opens upwards when there isn't room below.
  const [place, setPlace] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null);
  const chosen = options.find(o => o.value === value) ?? null;
  const shown = options.filter(o => matchesQuery(o, query));

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) { setOpen(false); setQuery(''); } };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const r = inputRef.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom;
      setPlace(below < MAX_LIST_HEIGHT + LIST_GAP && r.top > below
        ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + LIST_GAP }
        : { left: r.left, width: r.width, top: r.bottom + LIST_GAP });
    };
    measure();
    window.addEventListener('resize', measure);
    document.addEventListener('scroll', measure, true);
    return () => { window.removeEventListener('resize', measure); document.removeEventListener('scroll', measure, true); };
  }, [open]);

  const pick = (o: SearchOption) => { onChange(o.value); setOpen(false); setQuery(''); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && open && shown[active]) { e.preventDefault(); pick(shown[active]); }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  };

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <input ref={inputRef} id={inputId} role="combobox" aria-label={ariaLabel} aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
        disabled={disabled} autoComplete="off"
        value={open ? query : chosen ? `${chosen.label}${chosen.hint ? ` — ${chosen.hint}` : ''}` : ''}
        placeholder={open && chosen ? chosen.label : placeholder}
        onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onChange={e => { setQuery(e.target.value); setOpen(true); }} onKeyDown={onKey}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '8px 64px 8px 12px', minHeight: isMobile ? 44 : 40, fontSize: isMobile ? 16 : 14,
          color: COLORS.text, background: disabled ? '#f8fafc' : '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 8, fontFamily: 'inherit',
          cursor: disabled ? 'default' : 'text',
        }} />
      <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 4 }}>
        {chosen && !disabled && (
          <button type="button" aria-label="Clear" title="Clear" onClick={() => { onChange(''); setQuery(''); }}
            style={{ width: 28, height: 28, border: 'none', background: 'none', color: COLORS.muted, cursor: 'pointer', borderRadius: 6 }}>
            <FontAwesomeIcon icon={faXmark} />
          </button>
        )}
        <FontAwesomeIcon icon={faChevronDown} aria-hidden style={{ color: COLORS.muted, fontSize: 12, pointerEvents: 'none' }} />
      </span>
      {open && !disabled && place && (
        <ul id={listId} role="listbox" style={{
          position: 'fixed', left: place.left, width: place.width, top: place.top, bottom: place.bottom, zIndex: 1000, boxSizing: 'border-box', margin: 0, padding: 4, listStyle: 'none',
          maxHeight: MAX_LIST_HEIGHT, overflowY: 'auto', background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 8,
          boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
        }}>
          {shown.length === 0 && <li style={{ padding: '8px 12px', fontSize: 14, color: COLORS.muted }}>{noMatches}</li>}
          {shown.map((o, i) => (
            <li key={o.value} id={`${listId}-${i}`} role="option" aria-selected={o.value === value}
              onMouseDown={e => { e.preventDefault(); pick(o); }} onMouseEnter={() => setActive(i)}
              style={{
                display: 'flex', alignItems: 'baseline', gap: 8, padding: '8px 12px', minHeight: isMobile ? 44 : 32, boxSizing: 'border-box', borderRadius: 6,
                cursor: 'pointer', fontSize: 14, color: COLORS.text, background: i === active ? COLORS.hover : 'transparent',
                fontWeight: o.value === value ? 600 : 400,
              }}>
              <span>{o.label}</span>
              {o.hint && <span style={{ fontSize: 13, color: COLORS.muted }}>{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
