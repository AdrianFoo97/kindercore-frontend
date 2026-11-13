import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCamera, faPlay, faXmark } from '@fortawesome/free-solid-svg-icons';
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENTS, attachmentProblem, fileKind, fileSizeLabel } from './facilityDisplay.js';
import type { FacilityFieldsTheme } from './FacilityIssueFields.js';

// Report form → "Photos or videos": pick from the camera or gallery, see a
// preview of each, remove one. Files are checked here (type, size, count)
// so nothing doomed gets uploaded.

const TILE = 84;

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
  theme: FacilityFieldsTheme;
  disabled?: boolean;
}

export default function AttachmentPicker({ files, onChange, theme: t, disabled }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const add = (picked: FileList | null) => {
    if (!picked?.length) return;
    const next = [...files, ...Array.from(picked)];
    const p = attachmentProblem(next);
    setProblem(p);
    if (!p) onChange(next);
    if (input.current) input.current.value = ''; // so picking the same file again still fires
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {files.map((f, i) => (
          <PickedFileTile key={`${f.name}-${f.size}-${i}`} file={f} disabled={disabled}
            onRemove={() => { setProblem(null); onChange(files.filter((_, j) => j !== i)); }} />
        ))}
        {files.length < MAX_ATTACHMENTS && (
          <button type="button" disabled={disabled} onClick={() => input.current?.click()} style={{
            width: TILE, height: TILE, borderRadius: 12, border: `1.5px dashed ${t.border}`, background: t.inputBg,
            color: t.muted, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
            fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer', WebkitTapHighlightColor: 'transparent',
          }}>
            <FontAwesomeIcon icon={faCamera} style={{ fontSize: 18, color: t.accent }} />
            Add
          </button>
        )}
      </div>
      <input ref={input} type="file" accept={ATTACHMENT_ACCEPT} multiple hidden onChange={e => add(e.target.files)} />
      <div style={{ fontSize: 12, color: problem ? '#b91c1c' : t.muted, fontWeight: problem ? 700 : 500, marginTop: 6 }}>
        {problem ?? `At least one, up to ${MAX_ATTACHMENTS} — photos under 10 MB, videos under 50 MB.`}
      </div>
    </div>
  );
}

function PickedFileTile({ file, onRemove, disabled }: { file: File; onRemove: () => void; disabled?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  const video = fileKind(file.type) === 'video';

  return (
    <div title={`${file.name} · ${fileSizeLabel(file.size)}`} style={{
      position: 'relative', width: TILE, height: TILE, borderRadius: 12, overflow: 'hidden', background: '#0f172a', flexShrink: 0,
    }}>
      {url && (video
        ? <video src={url} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <img src={url} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)}
      {video && (
        <span style={{ position: 'absolute', left: 6, bottom: 6, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 6, background: 'rgba(15,23,42,0.7)', color: '#fff', fontSize: 10, fontWeight: 700 }}>
          <FontAwesomeIcon icon={faPlay} style={{ fontSize: 8 }} /> {fileSizeLabel(file.size)}
        </span>
      )}
      {!disabled && (
        <button type="button" aria-label={`Remove ${file.name}`} onClick={onRemove} style={{
          position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: '50%', border: 'none',
          background: 'rgba(15,23,42,0.7)', color: '#fff', fontSize: 11, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <FontAwesomeIcon icon={faXmark} />
        </button>
      )}
    </div>
  );
}
