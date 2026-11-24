import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCamera, faPlay, faXmark } from '@fortawesome/free-solid-svg-icons';
import { fileKind, fileSizeLabel } from '../../pages/facilities/facilityDisplay.js';

// A form's "Photos" field: pick from the camera or gallery, see a preview of
// each, remove one. Files are checked here (type, size, count — the caller's
// rules) so nothing doomed gets uploaded. Used by Facilities → Report and the
// purchase request form.

const TILE = 84;

/** What this field takes — the caller's own limits and wording. */
export interface AttachmentRules {
  max: number;
  /** For the file input's `accept` — phones then offer the camera and the gallery. */
  accept: string;
  /** Why these files can't be attached, or null when they're fine. */
  problem: (files: File[]) => string | null;
  /** Shown under the tiles while nothing is wrong. */
  hint: string;
}

export interface AttachmentPickerTheme {
  accent: string;
  muted: string;
  border: string;
  inputBg?: string;
}

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
  rules: AttachmentRules;
  theme: AttachmentPickerTheme;
  disabled?: boolean;
}

export default function AttachmentPicker({ files, onChange, rules, theme: t, disabled }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const add = (picked: FileList | null) => {
    if (!picked?.length) return;
    const next = [...files, ...Array.from(picked)];
    const p = rules.problem(next);
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
        {files.length < rules.max && (
          <button type="button" disabled={disabled} onClick={() => input.current?.click()} style={{
            width: TILE, height: TILE, borderRadius: 12, border: `1.5px dashed ${t.border}`, background: t.inputBg ?? '#fff',
            color: t.muted, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
            fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer', WebkitTapHighlightColor: 'transparent',
          }}>
            <FontAwesomeIcon icon={faCamera} style={{ fontSize: 18, color: t.accent }} />
            Add
          </button>
        )}
      </div>
      <input ref={input} type="file" accept={rules.accept} multiple hidden onChange={e => add(e.target.files)} />
      <div style={{ fontSize: 12, color: problem ? '#b91c1c' : t.muted, fontWeight: problem ? 700 : 500, marginTop: 6 }}>
        {problem ?? rules.hint}
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
