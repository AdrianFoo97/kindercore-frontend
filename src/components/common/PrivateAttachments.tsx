import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation, faPlay, faXmark } from '@fortawesome/free-solid-svg-icons';
import { fileSizeLabel } from '../../pages/facilities/facilityDisplay.js';

// A record's photos / videos: a row of thumbnails, tap one to see it full
// screen. The files are private, so each is fetched with the login (by the
// caller's `load`) and shown from a blob URL. Photos load straight away; a
// video only when opened. Used by facility reports and purchase requests.

const THUMB = 64;

export interface PrivateFile {
  id: string;
  kind: 'image' | 'video';
  size: number;
  name: string;
}

interface Props {
  files: PrivateFile[];
  /** Cache key prefix for the downloads, e.g. ['facility-attachment', issueId]. */
  cacheKey: readonly unknown[];
  load: (fileId: string) => Promise<Blob>;
}

export default function PrivateAttachments({ files, cacheKey, load }: Props) {
  const [open, setOpen] = useState<PrivateFile | null>(null);
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {files.map(a => (
          <button key={a.id} type="button" onClick={() => setOpen(a)} aria-label={`Open ${a.kind} ${a.name}`} title={a.name} style={{
            position: 'relative', width: THUMB, height: THUMB, padding: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0',
            background: '#0f172a', cursor: 'pointer', flexShrink: 0,
          }}>
            {a.kind === 'image' ? <ImageThumb file={a} cacheKey={cacheKey} load={load} /> : (
              <span style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: '#fff' }}>
                <FontAwesomeIcon icon={faPlay} style={{ fontSize: 16 }} />
                <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.85 }}>{fileSizeLabel(a.size)}</span>
              </span>
            )}
          </button>
        ))}
      </div>
      {open && <PrivateFileViewer file={open} cacheKey={cacheKey} load={load} onClose={() => setOpen(null)} />}
    </>
  );
}

export interface FileProps { file: PrivateFile; cacheKey: readonly unknown[]; load: (fileId: string) => Promise<Blob> }

/** The blob for one file — cached, so a thumbnail and the full view share one download. */
export function usePrivateFileUrl({ file, cacheKey, load }: FileProps) {
  const { data: blob, isError, error } = useQuery({
    queryKey: [...cacheKey, file.id],
    queryFn: () => load(file.id),
    staleTime: Infinity,
    retry: false,
  });
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return { url, isError, reason: error instanceof Error ? error.message : 'Couldn’t load this file.' };
}

function ImageThumb(props: FileProps) {
  const { url, isError, reason } = usePrivateFileUrl(props);
  if (isError) return <FontAwesomeIcon icon={faCircleExclamation} title={reason} style={{ color: '#94a3b8' }} />;
  return url ? <img src={url} alt={props.file.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null;
}

export function PrivateFileViewer({ onClose, ...props }: FileProps & { onClose: () => void }) {
  const { file } = props;
  const { url, isError, reason } = usePrivateFileUrl(props);
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
        position: 'absolute', top: 14, right: 14, width: 44, height: 44, borderRadius: '50%', border: 'none',
        background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 18, cursor: 'pointer',
      }}>
        <FontAwesomeIcon icon={faXmark} />
      </button>
      {isError ? (
        <div style={{ color: '#e2e8f0', fontSize: 14, textAlign: 'center' }}>{reason}</div>
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
