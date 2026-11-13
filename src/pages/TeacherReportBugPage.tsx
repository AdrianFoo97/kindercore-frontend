import { useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBug, faCamera, faSpinner, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { createBugReport } from '../api/bug-reports.js';
import { uploadBugReportPhotos, uploadUrl } from '../api/upload.js';
import { TEACHER_CONTENT_TOP } from '../components/common/TeacherTopBar.js';
import { useToast } from '../components/common/Toast.js';
import { APP_VERSION } from '../version.js';

const MAX_PHOTOS = 4;
/** Matches the server's limit on a bug report title. */
const MAX_TITLE_LENGTH = 120;

// ─────────────────────────────────────────────────────────────────────────────
// Report a Bug — a real page, not a bottom sheet. The sheet version
// stacked a dimmed backdrop, a pull handle, a header row, and the form
// all competing for a small strip of screen; a plain page just reads
// top to bottom like everything else in this app.
// ─────────────────────────────────────────────────────────────────────────────

const FONT =
  '"Segoe UI", Roboto, Arial, sans-serif';

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
};

export default function TeacherReportBugPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useIsMobile();
  const { showToast } = useToast();

  // A short title (what to scan for in the list) and a description (the details).
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const photoFileRef = useRef<HTMLInputElement | null>(null);

  const handlePhotoSelect = async (files: FileList) => {
    const room = MAX_PHOTOS - photoUrls.length;
    if (room <= 0) return;
    const picked = Array.from(files).slice(0, room);
    setUploadingPhotos(true);
    try {
      const { urls } = await uploadBugReportPhotos(picked);
      setPhotoUrls(prev => [...prev, ...urls]);
    } catch (e: any) {
      showToast(e?.message ?? 'Could not attach that photo', 'error');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleSubmit = async () => {
    const trimmed = message.trim();
    const trimmedTitle = title.trim();
    if (!trimmed || !trimmedTitle || submitting) return;
    setSubmitting(true);
    try {
      await createBugReport({
        title: trimmedTitle,
        message: trimmed,
        pageUrl: `${location.pathname}${location.search}`,
        appVersion: APP_VERSION,
        photoUrls: photoUrls.length ? photoUrls : undefined,
      });
      showToast("Thanks — we've got it.", 'success');
      // Back to wherever they opened it from (the ⋯ menu on any tab) — real history.
      // `key` is 'default' only on a cold deep link, where this falls back to My Profile.
      if (location.key !== 'default') navigate(-1);
      else navigate(`/teachers/${id}/settings`, { replace: true });
    } catch {
      showToast('Could not send that — please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12.5, fontWeight: 700, color: C.textStrong, marginBottom: 8,
  };

  const pageStyle: React.CSSProperties = {
    paddingTop: isMobile ? TEACHER_CONTENT_TOP : 28,
    paddingRight: isMobile ? 16 : 32,
    paddingBottom: 40,
    paddingLeft: isMobile ? 16 : 32,
    minHeight: '100vh',
    fontFamily: FONT,
    color: C.text,
    background: C.bg,
  };

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: isMobile ? 640 : 480, margin: '0 auto' }}>

        {/* ── Intro ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 13, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: C.pSoft, color: C.pAccent, fontSize: 17,
            border: `1px solid ${C.pBorder}`,
          }}>
            <FontAwesomeIcon icon={faBug} />
          </div>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: C.textStrong, letterSpacing: '-0.01em' }}>
            Report a Bug
          </h1>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 13.5, color: C.muted, lineHeight: 1.55 }}>
          Give it a short title, then describe what went wrong and what you were doing. We'll take it from here.
        </p>

        {/* ── Form ─────────────────────────────────────────────── */}
        <label htmlFor="bug-title" style={labelStyle}>Title</label>
        <input
          id="bug-title"
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          disabled={submitting}
          maxLength={MAX_TITLE_LENGTH}
          placeholder="e.g. Save button on Steps does nothing"
          style={{
            width: '100%', minHeight: 48, padding: '12px 14px', fontSize: 16,
            border: `1.5px solid ${C.cardBorder}`, borderRadius: 14, outline: 'none',
            color: C.textStrong, fontFamily: 'inherit', boxSizing: 'border-box' as const, background: C.card,
          }}
        />

        <label htmlFor="bug-description" style={{ ...labelStyle, marginTop: 20 }}>Description</label>
        <textarea
          id="bug-description"
          value={message}
          onChange={e => setMessage(e.target.value)}
          disabled={submitting}
          placeholder="What happened, what you expected, and what you were doing — e.g. I edited step 2, tapped Save, and nothing changed."
          style={{
            width: '100%', minHeight: 160, padding: '13px 14px', fontSize: 16,
            border: `1.5px solid ${C.cardBorder}`, borderRadius: 14, outline: 'none',
            color: C.textStrong, fontFamily: 'inherit', lineHeight: 1.5,
            resize: 'vertical' as const, boxSizing: 'border-box' as const,
            background: C.card,
          }}
        />

        {/* ── Photos ───────────────────────────────────────────── */}
        <label style={{
          display: 'block', fontSize: 12.5, fontWeight: 700, color: C.textStrong, marginTop: 20, marginBottom: 8,
        }}>
          Photos (optional)
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 10 }}>
          {photoUrls.map(url => (
            <div key={url} style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
              <img
                src={uploadUrl(url)}
                alt="Attached screenshot"
                style={{
                  width: 72, height: 72, borderRadius: 12, objectFit: 'cover',
                  border: `1.5px solid ${C.cardBorder}`,
                }}
              />
              <button
                type="button"
                onClick={() => setPhotoUrls(prev => prev.filter(u => u !== url))}
                disabled={submitting}
                aria-label="Remove photo" title="Remove photo"
                style={{
                  position: 'absolute', top: -6, right: -6, width: 20, height: 20,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '50%', border: `1.5px solid ${C.cardBorder}`,
                  background: '#fff', color: C.muted, cursor: 'pointer', padding: 0,
                }}
              >
                <FontAwesomeIcon icon={faXmark} style={{ fontSize: 10 }} />
              </button>
            </div>
          ))}
          {photoUrls.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => photoFileRef.current?.click()}
              disabled={uploadingPhotos || submitting}
              style={{
                width: 72, height: 72, flexShrink: 0,
                display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: 4,
                borderRadius: 12, border: `1.5px dashed ${C.pBorder}`, background: C.pSoft,
                color: C.pAccent, fontSize: 11, fontWeight: 700,
                cursor: uploadingPhotos || submitting ? 'default' : 'pointer',
                opacity: uploadingPhotos ? 0.6 : 1,
              }}
            >
              <FontAwesomeIcon icon={uploadingPhotos ? faSpinner : faCamera} spin={uploadingPhotos} style={{ fontSize: 15 }} />
              Add
            </button>
          )}
        </div>
        <input
          ref={photoFileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          style={{ display: 'none' }}
          onChange={e => {
            const files = e.target.files;
            if (files && files.length > 0) handlePhotoSelect(files);
            e.target.value = '';
          }}
        />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!title.trim() || !message.trim() || submitting}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', marginTop: 20, padding: '14px', border: 'none',
            borderRadius: 12, background: C.pAccent, cursor: 'pointer',
            color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
            opacity: !title.trim() || !message.trim() || submitting ? 0.55 : 1,
          }}
        >
          {submitting ? 'Sending…' : 'Send Report'}
        </button>
      </div>
    </div>
  );
}
