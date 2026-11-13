import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation, faPlay, faXmark } from '@fortawesome/free-solid-svg-icons';
import { fetchFacilityAttachment, type FacilityAttachment } from '../../api/facilityIssues.js';
import { fileSizeLabel } from './facilityDisplay.js';

// A report's photos / videos: a row of thumbnails, tap one to see it full
// screen. The files are private, so each is fetched with the login and
// shown from a blob URL. Photos load straight away; a video only when opened.

const THUMB = 64;

interface Props {
  issueId: string;
  attachments: FacilityAttachment[];
}

export default function FacilityAttachments({ issueId, attachments }: Props) {
  const [open, setOpen] = useState<FacilityAttachment | null>(null);
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {attachments.map(a => (
          <button key={a.id} type="button" onClick={() => setOpen(a)} aria-label={`Open ${a.kind} ${a.name}`} title={a.name} style={{
            position: 'relative', width: THUMB, height: THUMB, padding: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0',
            background: '#0f172a', cursor: 'pointer', flexShrink: 0,
          }}>
            {a.kind === 'image' ? <ImageThumb issueId={issueId} file={a} /> : (
              <span style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: '#fff' }}>
                <FontAwesomeIcon icon={faPlay} style={{ fontSize: 16 }} />
                <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.85 }}>{fileSizeLabel(a.size)}</span>
              </span>
            )}
          </button>
        ))}
      </div>
      {open && <AttachmentViewer issueId={issueId} file={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/** The blob for one attachment — cached, so a thumbnail and the full view share one download. */
function useAttachmentUrl(issueId: string, file: FacilityAttachment) {
  const { data: blob, isError } = useQuery({
    queryKey: ['facility-attachment', issueId, file.id],
    queryFn: () => fetchFacilityAttachment(issueId, file.id),
    staleTime: Infinity,
  });
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return { url, isError };
}

function ImageThumb({ issueId, file }: { issueId: string; file: FacilityAttachment }) {
  const { url, isError } = useAttachmentUrl(issueId, file);
  if (isError) return <FontAwesomeIcon icon={faCircleExclamation} style={{ color: '#64748b' }} />;
  return url ? <img src={url} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null;
}

function AttachmentViewer({ issueId, file, onClose }: { issueId: string; file: FacilityAttachment; onClose: () => void }) {
  const { url, isError } = useAttachmentUrl(issueId, file);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={file.name} onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(2,6,23,0.9)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <button type="button" aria-label="Close" title="Close" onClick={onClose} style={{
        position: 'absolute', top: 14, right: 14, width: 40, height: 40, borderRadius: '50%', border: 'none',
        background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 18, cursor: 'pointer',
      }}>
        <FontAwesomeIcon icon={faXmark} />
      </button>
      {isError ? (
        <div style={{ color: '#e2e8f0', fontSize: 14 }}>Couldn’t load this {file.kind}.</div>
      ) : !url ? (
        <div style={{ color: '#e2e8f0', fontSize: 14 }}>Loading {file.kind === 'video' ? `video (${fileSizeLabel(file.size)})` : 'photo'}…</div>
      ) : file.kind === 'video' ? (
        <video src={url} controls autoPlay playsInline style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} />
      ) : (
        <img src={url} alt={file.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />
      )}
    </div>
  );
}
