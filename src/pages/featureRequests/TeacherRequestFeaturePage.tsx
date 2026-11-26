import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faLightbulb } from '@fortawesome/free-solid-svg-icons';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { createFeatureRequest } from '../../api/feature-requests.js';
import { TEACHER_CONTENT_TOP } from '../../components/common/TeacherTopBar.js';
import { APP_VERSION } from '../../version.js';

// Request a feature — from the ⋯ menu, next to Report a Bug. A title and what
// it should do; once sent, the page says so plainly. There's no status to
// follow afterwards — admins review the ideas in Tools → Feature requests.

/** Matches the server's limits. */
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eceef2',
  text: '#475569',
  textStrong: '#334155',
  muted: '#64748b',
  pAccent: '#7c3aed',
  pSoft: '#f5f3ff',
  pBorder: '#ddd6fe',
  success: '#059669',
  successSoft: '#ecfdf5',
};

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', fontSize: 16, border: `1.5px solid ${C.cardBorder}`, borderRadius: 14,
  color: C.textStrong, fontFamily: 'inherit', boxSizing: 'border-box', background: C.card,
};
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: C.textStrong, marginBottom: 8 };
const primaryButton: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 48, marginTop: 24, padding: 14,
  border: 'none', borderRadius: 12, background: C.pAccent, color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
};

export default function TeacherRequestFeaturePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useIsMobile();

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = !!title.trim() && !!message.trim() && !sending;

  const send = async () => {
    if (!ready) return;
    setSending(true);
    setError(null);
    try {
      await createFeatureRequest({ title: title.trim(), message: message.trim(), pageUrl: `${location.pathname}${location.search}`, appVersion: APP_VERSION });
      setSent(true);
    } catch {
      setError('Couldn’t send that. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  // Back to wherever they opened it from; on a cold deep link, My Profile.
  const done = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(`/teachers/${id}/settings`, { replace: true });
  };

  return (
    <div style={{
      paddingTop: isMobile ? TEACHER_CONTENT_TOP : 32, paddingRight: 16, paddingBottom: 48, paddingLeft: 16,
      minHeight: '100vh', fontFamily: 'Nunito, "Segoe UI", Roboto, Arial, sans-serif', color: C.text, background: C.bg,
    }}>
      <div style={{ maxWidth: isMobile ? 640 : 480, margin: '0 auto' }}>
        {sent ? <SentConfirmation onDone={done} /> : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div aria-hidden style={{
                width: 44, height: 44, borderRadius: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: C.pSoft, color: C.pAccent, fontSize: 18, border: `1px solid ${C.pBorder}`,
              }}>
                <FontAwesomeIcon icon={faLightbulb} />
              </div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.textStrong, letterSpacing: '-0.01em' }}>Request a feature</h1>
            </div>

            <label htmlFor="feature-title" style={labelStyle}>Title</label>
            <input id="feature-title" autoFocus value={title} onChange={e => setTitle(e.target.value)} disabled={sending}
              maxLength={MAX_TITLE_LENGTH} placeholder="e.g. Remind me before a child's birthday"
              style={{ ...fieldStyle, minHeight: 48 }} />

            <label htmlFor="feature-description" style={{ ...labelStyle, marginTop: 24 }}>What should it do?</label>
            <textarea id="feature-description" value={message} onChange={e => setMessage(e.target.value)} disabled={sending}
              maxLength={MAX_DESCRIPTION_LENGTH}
              placeholder="What you'd like the app to do, and how it would help you."
              style={{ ...fieldStyle, minHeight: 160, lineHeight: 1.5, resize: 'vertical' }} />

            {error && <p role="alert" style={{ margin: '16px 0 0', fontSize: 13, fontWeight: 600, color: '#b91c1c' }}>{error}</p>}

            <button type="button" onClick={send} disabled={!ready}
              style={{ ...primaryButton, cursor: ready ? 'pointer' : 'default', opacity: ready ? 1 : 0.55 }}>
              {sending ? 'Sending…' : 'Send request'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Shown once it's sent — the whole answer the sender gets. */
function SentConfirmation({ onDone }: { onDone: () => void }) {
  return (
    <div role="status" style={{ textAlign: 'center', paddingTop: 48 }}>
      <div aria-hidden style={{
        width: 64, height: 64, margin: '0 auto 16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: C.successSoft, color: C.success, fontSize: 30,
      }}>
        <FontAwesomeIcon icon={faCircleCheck} />
      </div>
      <h1 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: C.textStrong }}>Request sent.</h1>
      <p style={{ margin: 0, fontSize: 15, color: C.muted, lineHeight: 1.5 }}>Thanks for the idea. The team will review it.</p>
      <button type="button" onClick={onDone} style={{ ...primaryButton, cursor: 'pointer' }}>Done</button>
    </div>
  );
}
