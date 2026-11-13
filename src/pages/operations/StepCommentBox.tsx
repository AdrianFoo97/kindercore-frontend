import { useEffect, useRef, type CSSProperties } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCommentDots } from '@fortawesome/free-solid-svg-icons';

const MAX_COMMENT_LENGTH = 1000;
const C = { text: '#0f172a', body: '#334155', muted: '#64748b', border: '#fcd34d', bg: '#fffbeb', accent: '#b45309', link: '#5a67d8' };

interface Props {
  stepTitle: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  onEdit: () => void;
  onDone: () => void;
  onRemove: () => void;
}

/**
 * A supervisor's comment on one step, written right under it while going
 * through the suggestion. Editing: a box + Done / Remove. Done: the comment
 * stays visible under the step so they can see what they've noted so far.
 */
export default function StepCommentBox({ stepTitle, value, editing, onChange, onEdit, onDone, onRemove }: Props) {
  const boxRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing) boxRef.current?.focus(); }, [editing]);

  const linkBtn = (color: string): CSSProperties => ({
    border: 'none', background: 'none', padding: '6px 4px', minHeight: 28, color, fontSize: 12.5, fontWeight: 600,
    fontFamily: 'inherit', cursor: 'pointer',
  });

  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 6 }}>
        <FontAwesomeIcon icon={faCommentDots} aria-hidden /> Your comment for the teacher
      </div>
      {editing ? (
        <>
          <textarea
            ref={boxRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onDone(); }}
            maxLength={MAX_COMMENT_LENGTH}
            rows={2}
            aria-label={`Comment on "${stepTitle}"`}
            placeholder="What should change in this step?"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
              fontSize: 13.5, fontFamily: 'inherit', color: C.text, lineHeight: 1.5, resize: 'vertical', background: '#fff',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onRemove} style={linkBtn(C.muted)}>Remove</button>
            <button type="button" onClick={onDone} style={linkBtn(C.link)}>Done</button>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <p style={{ flex: 1, margin: 0, fontSize: 13.5, color: C.body, lineHeight: 1.5, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{value}</p>
          <button type="button" onClick={onEdit} style={linkBtn(C.link)}>Edit</button>
          <button type="button" onClick={onRemove} style={linkBtn(C.muted)}>Remove</button>
        </div>
      )}
    </div>
  );
}
