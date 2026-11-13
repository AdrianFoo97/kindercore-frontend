import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCommentDots } from '@fortawesome/free-solid-svg-icons';
import { C, TONE } from './mySuggestionsTheme.js';

/** The supervisor's comment on one step, shown right under that step while the teacher makes the changes. */
export default function StepFeedback({ comment, label = 'To change' }: { comment: string; label?: string }) {
  const tone = TONE.action;
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 8, padding: '8px 10px',
      borderRadius: 8, background: tone.bg, borderLeft: `3px solid ${tone.fg}`,
    }}>
      <FontAwesomeIcon icon={faCommentDots} aria-hidden style={{ color: tone.fg, fontSize: 13, marginTop: 3 }} />
      <p style={{ margin: 0, fontSize: 13.5, color: C.body, lineHeight: 1.5, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
        <span style={{ fontWeight: 700, color: tone.fg }}>{label}: </span>{comment}
      </p>
    </div>
  );
}
