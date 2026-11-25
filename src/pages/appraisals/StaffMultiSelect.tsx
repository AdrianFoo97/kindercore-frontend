import { useEffect, useId, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faChevronDown, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { matchesQuery, type SearchOption } from '../../components/common/SearchSelect.js';

// New appraisal → "Staff": pick one or several people. A dropdown you type
// into (staff lists grow — never chips); each row toggles with a ✓, the list
// stays open while picking, and "Select all shown" takes everyone listed.
// Same look as SearchSelect.

const MAX_LIST_HEIGHT = 280;
const LIST_GAP = 4;
const COLORS = { text: '#0f172a', muted: '#64748b', border: '#cbd5e1', hover: '#eef2ff', accent: '#5a67d8' };

interface Props {
  id?: string;
  options: SearchOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  noMatches?: string;
}

/** Closed: who's picked, in words — "Amelia", "Amelia and James", "Amelia and 4 others". */
export function pickedLabel(names: string[]): string {
  if (names.length <= 2) return names.join(' and ');
  return `${names[0]} and ${names.length - 1} others`;
}

export default function StaffMultiSelect({ id, options, values, onChange, placeholder, noMatches = 'Nothing matches.' }: Props) {
  const { isMobile } = useIsMobile();
  const auto = useId();
  const inputId = id ?? `ms-${auto}`;
  const listId = `${inputId}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [place, setPlace] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null);
  const picked = new Set(values);
  const shown = options.filter(o => matchesQuery(o, query));
  const allShownPicked = shown.length > 0 && shown.every(o => picked.has(o.value));

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) { setOpen(false); setQuery(''); } };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    if (!open) return;
    // Placed against the screen (fixed) so a pop-up's scrolling body can't cut it off; opens upwards without room below.
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

  const toggle = (v: string) => onChange(picked.has(v) ? values.filter(x => x !== v) : [...values, v]);
  const toggleAllShown = () => onChange(allShownPicked
    ? values.filter(v => !shown.some(o => o.value === v))
    : [...values, ...shown.map(o => o.value).filter(v => !picked.has(v))]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && open && shown[active]) { e.preventDefault(); toggle(shown[active].value); }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  };
  const names = options.filter(o => picked.has(o.value)).map(o => o.label);
  const row = (selected: boolean, highlighted: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', minHeight: isMobile ? 44 : 32, boxSizing: 'border-box', borderRadius: 6,
    cursor: 'pointer', fontSize: 14, color: COLORS.text, background: highlighted ? COLORS.hover : 'transparent', fontWeight: selected ? 600 : 400,
  });
  const tick = (on: boolean) => (
    <span aria-hidden style={{
      width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: `1.5px solid ${on ? COLORS.accent : COLORS.border}`, background: on ? COLORS.accent : '#fff', color: '#fff', fontSize: 9,
    }}>{on && <FontAwesomeIcon icon={faCheck} />}</span>
  );

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <input ref={inputRef} id={inputId} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined} autoComplete="off"
        value={open ? query : pickedLabel(names)} placeholder={open && names.length ? `${names.length} picked — type to find more` : placeholder}
        onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onChange={e => { setQuery(e.target.value); setOpen(true); }} onKeyDown={onKey}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '8px 64px 8px 12px', minHeight: isMobile ? 44 : 40, fontSize: isMobile ? 16 : 14,
          color: COLORS.text, background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 8, fontFamily: 'inherit', cursor: 'text',
        }} />
      <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 4 }}>
        {values.length > 0 && (
          <button type="button" aria-label="Clear" title="Clear" onClick={() => { onChange([]); setQuery(''); }}
            style={{ width: 28, height: 28, border: 'none', background: 'none', color: COLORS.muted, cursor: 'pointer', borderRadius: 6 }}>
            <FontAwesomeIcon icon={faXmark} />
          </button>
        )}
        <FontAwesomeIcon icon={faChevronDown} aria-hidden style={{ color: COLORS.muted, fontSize: 12, pointerEvents: 'none' }} />
      </span>
      {open && place && (
        <ul id={listId} role="listbox" aria-multiselectable="true" style={{
          position: 'fixed', left: place.left, width: place.width, top: place.top, bottom: place.bottom, zIndex: 1000, boxSizing: 'border-box', margin: 0, padding: 4,
          listStyle: 'none', maxHeight: MAX_LIST_HEIGHT, overflowY: 'auto', background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 8,
          boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
        }}>
          {shown.length === 0 && <li style={{ padding: '8px 12px', fontSize: 14, color: COLORS.muted }}>{noMatches}</li>}
          {shown.length > 1 && (
            <li role="option" aria-selected={allShownPicked} onMouseDown={e => { e.preventDefault(); toggleAllShown(); }}
              style={{ ...row(false, false), color: COLORS.accent, fontWeight: 600, borderBottom: '1px solid #eef0f4', borderRadius: 0 }}>
              {tick(allShownPicked)}{allShownPicked ? 'Clear all shown' : `Select all shown (${shown.length})`}
            </li>
          )}
          {shown.map((o, i) => (
            <li key={o.value} id={`${listId}-${i}`} role="option" aria-selected={picked.has(o.value)}
              onMouseDown={e => { e.preventDefault(); toggle(o.value); }} onMouseEnter={() => setActive(i)}
              style={row(picked.has(o.value), i === active)}>
              {tick(picked.has(o.value))}
              <span>{o.label}</span>
              {o.hint && <span style={{ fontSize: 13, color: COLORS.muted, fontWeight: 400 }}>{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
