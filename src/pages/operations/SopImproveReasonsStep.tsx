import { useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { MAX_REASONS, MAX_REASON_LENGTH, REASON_SUGGESTIONS, addReason, cleanReasons } from './sopImproveReasons.js';

interface Props {
  guideTitle: string;
  reasons: string[];
  onChange: (reasons: string[]) => void;
  /** The wizard's own styles, so this step looks like the rest of it. */
  wrapperStyle?: React.CSSProperties;
  labelStyle: React.CSSProperties;
  inputStyle: React.CSSProperties;
}

/**
 * Step 1 of "Suggest an improvement": identify what needs improving in this
 * guide — one reason per row (or tap a common one) — before changing steps.
 */
export default function SopImproveReasonsStep({ guideTitle, reasons, onChange, wrapperStyle, labelStyle, inputStyle }: Props) {
  const listRef = useRef<HTMLOListElement>(null);
  const rows = reasons.length ? reasons : [''];
  const used = new Set(cleanReasons(reasons).map(r => r.toLowerCase()));
  const focusRow = (i: number) => requestAnimationFrame(() => listRef.current?.querySelectorAll('input')[i]?.focus());

  const setRow = (i: number, text: string) => onChange(rows.map((r, j) => (j === i ? text : r)));
  const addRow = (after = rows.length - 1) => {
    if (rows.length >= MAX_REASONS) return;
    onChange([...rows.slice(0, after + 1), '', ...rows.slice(after + 1)]);
    focusRow(after + 1);
  };
  const removeRow = (i: number) => onChange(rows.length === 1 ? [''] : rows.filter((_, j) => j !== i));

  return (
    <div style={wrapperStyle}>
      <label style={labelStyle} htmlFor="improve-reason-0">
        What needs improving in “{guideTitle}”?
      </label>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
        List each reason on its own line. Your supervisor sees these with your suggestion.
      </p>

      <ol ref={listRef} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
        {rows.map((r, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span aria-hidden style={{ width: 18, flexShrink: 0, textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#64748b' }}>{i + 1}.</span>
            <input
              id={`improve-reason-${i}`} type="text" value={r} maxLength={MAX_REASON_LENGTH}
              aria-label={`Reason ${i + 1}`}
              placeholder={i === 0 ? 'e.g. Parents now sign in on the tablet, not on paper' : 'Another reason'}
              onChange={e => setRow(i, e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (r.trim()) addRow(i); } }}
              style={{ ...inputStyle, flex: 1, minWidth: 0 }}
            />
            {(rows.length > 1 || r) && (
              <button type="button" onClick={() => removeRow(i)} aria-label={`Remove reason ${i + 1}`} title="Remove"
                style={{ width: 36, height: 36, flexShrink: 0, border: 'none', background: 'none', color: '#64748b', borderRadius: 8, cursor: 'pointer' }}>
                <FontAwesomeIcon icon={faXmark} />
              </button>
            )}
          </li>
        ))}
      </ol>

      {rows.length < MAX_REASONS && (
        <button type="button" onClick={() => addRow()}
          style={{ marginTop: 10, minHeight: 36, padding: '6px 4px', border: 'none', background: 'none', color: 'var(--sop-accent)', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <FontAwesomeIcon icon={faPlus} /> Add another reason
        </button>
      )}

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>Common reasons</div>
        <div role="group" aria-label="Common reasons" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {REASON_SUGGESTIONS.map(text => {
            const picked = used.has(text.toLowerCase());
            return (
              <button key={text} type="button" aria-pressed={picked} disabled={picked}
                onClick={() => onChange(addReason(reasons, text))}
                style={{
                  minHeight: 36, padding: '6px 12px', borderRadius: 999, fontSize: 13, fontFamily: 'inherit',
                  border: `1px solid ${picked ? 'var(--sop-accent)' : '#cbd5e1'}`,
                  background: picked ? 'var(--sop-accent-soft)' : '#fff', color: picked ? 'var(--sop-accent)' : '#334155',
                  fontWeight: picked ? 600 : 500, cursor: picked ? 'default' : 'pointer',
                }}>
                <FontAwesomeIcon icon={picked ? faCheck : faPlus} style={{ fontSize: 11, marginRight: 6 }} />{text}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
