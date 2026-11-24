import { useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCamera } from '@fortawesome/free-solid-svg-icons';
import { uploadGuideImage } from '../../../api/guideImages.js';
import StepPhoto from './StepPhoto.js';
import { PHOTO_ACCEPT, pickedPhotoProblem } from './guidePhotoRules.js';
import { shrinkPhoto } from './shrinkPhoto.js';

// The step editors' "Photo" field: add one photo (camera or gallery), change
// or remove it. The photo is shrunk on the device and stored straight away;
// the step only uses it once the step (or the proposal) is saved.

interface Props {
  imageId: string | null;
  onChange: (imageId: string | null) => void;
  /** The step title, for the photo's description. */
  stepTitle: string;
  accent: string;
  /** Tells the editor a photo is still uploading, so it can hold Save. */
  onBusy?: (busy: boolean) => void;
}

export default function StepPhotoField({ imageId, onChange, stepTitle, accent, onBusy }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (input.current) input.current.value = ''; // so picking the same file again still fires
    if (!file) return;
    const p = pickedPhotoProblem(file);
    setProblem(p);
    if (p) return;
    setBusy(true); onBusy?.(true);
    try {
      onChange(await uploadGuideImage(await shrinkPhoto(file), file.name.replace(/\.[a-z0-9]+$/i, '') + '.jpg'));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Couldn’t add the photo.');
    } finally {
      setBusy(false); onBusy?.(false);
    }
  };

  const linkBtn: React.CSSProperties = {
    minHeight: 32, padding: '0 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff',
    fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: busy ? 'default' : 'pointer',
  };

  return (
    <div>
      {imageId ? (
        <>
          <StepPhoto imageId={imageId} alt={stepTitle || 'Step photo'} height={140} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" disabled={busy} onClick={() => input.current?.click()} style={{ ...linkBtn, color: accent }}>
              {busy ? 'Uploading…' : 'Change photo'}
            </button>
            <button type="button" disabled={busy} onClick={() => { setProblem(null); onChange(null); }} style={{ ...linkBtn, color: '#b91c1c' }}>
              Remove
            </button>
          </div>
        </>
      ) : (
        <button type="button" disabled={busy} onClick={() => input.current?.click()} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 72,
          border: '1px dashed #cbd5e1', borderRadius: 10, background: '#f8fafc', color: '#334155',
          fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: busy ? 'default' : 'pointer',
        }}>
          <FontAwesomeIcon icon={faCamera} style={{ color: accent, fontSize: 16 }} />
          {busy ? 'Uploading…' : 'Add a photo'}
        </button>
      )}
      <input ref={input} type="file" accept={PHOTO_ACCEPT} hidden onChange={e => void pick(e.target.files?.[0])} />
      <div role={problem ? 'alert' : undefined} style={{ fontSize: 12, marginTop: 6, color: problem ? '#b91c1c' : '#64748b', fontWeight: problem ? 600 : 400 }}>
        {problem ?? 'Shows on the guide and its poster.'}
      </div>
    </div>
  );
}
