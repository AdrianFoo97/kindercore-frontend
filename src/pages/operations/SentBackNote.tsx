import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCommentDots } from '@fortawesome/free-solid-svg-icons';
import type { ReviewComment } from '../../api/sop-revisions.js';
import { feedbackHeading } from './mySuggestions.js';
import { C, TONE } from './mySuggestionsTheme.js';

interface Props {
  note: string | null;
  comments: ReviewComment[] | null;
  reviewer: string | null;
  /** Which status the heading describes ("What to change" vs "Earlier feedback"). */
  status?: 'CHANGES_REQUESTED' | 'PENDING';
}

/**
 * The supervisor's feedback in one place — the overall note plus every step
 * comment (by step name). Pinned at the top of the form while the teacher
 * makes the changes, and on the idea's own page.
 */
export default function SentBackNote({ note, comments, reviewer, status = 'CHANGES_REQUESTED' }: Props) {
  const tone = TONE.action;
  const list = comments ?? [];
  if (!note && list.length === 0) return null;
  return (
    <section style={{
      display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16, padding: 16,
      borderRadius: 14, background: tone.bg, border: `1px solid ${C.border}`, borderLeft: `3px solid ${tone.fg}`,
    }}>
      <FontAwesomeIcon icon={faCommentDots} aria-hidden style={{ color: tone.fg, fontSize: 16, marginTop: 2 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: tone.fg }}>{feedbackHeading(status, reviewer)}</h2>
        {note && <p style={{ margin: 0, fontSize: 14, color: C.body, lineHeight: 1.5, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{note}</p>}
        {list.length > 0 && (
          <ul style={{ listStyle: 'none', margin: note ? '10px 0 0' : 0, padding: 0, display: 'grid', gap: 8 }}>
            {list.map((c, i) => (
              <li key={i} style={{ fontSize: 14, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
                <div style={{ fontWeight: 700, color: C.text }}>{c.stepTitle}</div>
                <div style={{ color: C.body, whiteSpace: 'pre-line' }}>{c.comment}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
