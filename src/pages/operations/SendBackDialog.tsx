import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReviewComment } from '../../api/sop-revisions.js';
import { commentCountLabel, hasFeedback } from './reviewComments.js';

const MAX_FEEDBACK_LENGTH = 1000;

const C = {
  text: '#0f172a', body: '#334155', muted: '#64748b', border: '#e2e8f0', accent: '#b45309', danger: '#b91c1c',
};

interface Props {
  /** Who sent the suggestion — named in the copy so the reviewer knows who reads the feedback. */
  proposerName: string;
  /** Comments already written on steps while going through them. */
  stepComments: ReviewComment[];
  sending: boolean;
  onCancel: () => void;
  onSend: (feedback: string) => void;
}

/**
 * Send a guide suggestion back to the teacher with feedback. Feedback is
 * required: "change it" with no why helps nobody. The button stays enabled —
 * pressing it with nothing typed says why it can't send yet.
 */
export default function SendBackDialog({ proposerName, stepComments, sending, onCancel, onSend }: Props) {
  const [feedback, setFeedback] = useState('');
  const [tried, setTried] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const empty = !hasFeedback(feedback, stepComments);
  const hasStepComments = stepComments.length > 0;

  useEffect(() => {
    boxRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sending) onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, sending]);

  const send = () => {
    setTried(true);
    if (!empty) onSend(feedback.trim());
  };

  return createPortal(
    <div role="presentation" onClick={() => !sending && onCancel()} style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div role="dialog" aria-modal="true" aria-labelledby="send-back-title" onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 480, background: '#fff', borderRadius: 14, padding: 24,
        boxShadow: '0 20px 50px rgba(15,23,42,0.25)', fontFamily: 'inherit',
      }}>
        <h2 id="send-back-title" style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: C.text }}>Send back for changes</h2>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: C.body, lineHeight: 1.5 }}>
          {proposerName} will see your feedback, make the changes and send it again. The current guide doesn’t change.
        </p>
        {hasStepComments && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>{commentCountLabel(stepComments.length)}</div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
              {stepComments.map((c, i) => (
                <li key={i} style={{ padding: '8px 10px', borderRadius: 8, background: '#fffbeb', fontSize: 13, lineHeight: 1.45 }}>
                  <div style={{ fontWeight: 700, color: C.text }}>{c.stepTitle}</div>
                  <div style={{ color: C.body, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{c.comment}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <label htmlFor="send-back-feedback" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>
          {hasStepComments ? 'Anything else (optional)' : 'What needs changing'}
        </label>
        <textarea
          id="send-back-feedback"
          ref={boxRef}
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
          maxLength={MAX_FEEDBACK_LENGTH}
          rows={4}
          placeholder={hasStepComments ? 'e.g. Also add a step for signing in on the tablet' : 'e.g. Add a step for signing in on the tablet'}
          aria-invalid={tried && empty}
          aria-describedby={tried && empty ? 'send-back-error' : undefined}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, fontSize: 14,
            fontFamily: 'inherit', color: C.text, resize: 'vertical', lineHeight: 1.5,
            border: `1px solid ${tried && empty ? C.danger : C.border}`,
          }}
        />
        {tried && empty && (
          <p id="send-back-error" role="alert" style={{ margin: '6px 0 0', fontSize: 13, color: C.danger }}>
            Say what needs changing — here, or as a comment on a step — so {proposerName} knows what to do.
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
          <button type="button" onClick={onCancel} disabled={sending} style={{
            minHeight: 36, padding: '8px 16px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#fff',
            color: C.body, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: sending ? 'default' : 'pointer',
          }}>Cancel</button>
          <button type="button" onClick={send} disabled={sending} style={{
            minHeight: 36, padding: '8px 16px', borderRadius: 10, border: 'none', background: C.accent,
            color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: sending ? 'default' : 'pointer',
          }}>{sending ? 'Sending…' : 'Send back'}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
