import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCamera } from '@fortawesome/free-solid-svg-icons';
import { removeMyPhoto, uploadMyPhoto } from '../../api/profilePhoto.js';
import MyAvatar, { MY_PHOTO_KEY, useMyPhotoUrl } from '../../components/common/MyAvatar.js';
import { useToast } from '../../components/common/Toast.js';
import { PHOTO_ACCEPT, pickedPhotoProblem } from '../operations/guidePhotos/guidePhotoRules.js';
import { shrinkPhoto } from '../operations/guidePhotos/shrinkPhoto.js';

// My Profile → the avatar: tap it to choose a photo (camera or gallery). It's
// shrunk on the phone (a profile photo is shown small) and saved straight away.

/** Longest side of a profile photo, px — sharp at 3× on the largest avatar. */
const PROFILE_PHOTO_SIDE = 512;
const SIZE = 56;

export default function ProfilePhotoButton({ name, accent }: { name: string; accent: string }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const hasPhoto = !!useMyPhotoUrl();

  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await work();
      await qc.invalidateQueries({ queryKey: MY_PHOTO_KEY });
      showToast(done);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Couldn’t change your photo.', 'error');
    } finally {
      setBusy(false);
    }
  };
  const pick = (file: File | undefined) => {
    if (input.current) input.current.value = ''; // so picking the same file again still fires
    if (!file) return;
    const problem = pickedPhotoProblem(file);
    if (problem) { showToast(problem, 'error'); return; }
    void run(async () => uploadMyPhoto(await shrinkPhoto(file, PROFILE_PHOTO_SIDE)), 'Photo updated');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
      <button type="button" onClick={() => input.current?.click()} disabled={busy}
        aria-label={hasPhoto ? 'Change your photo' : 'Add a photo'} title={hasPhoto ? 'Change your photo' : 'Add a photo'}
        style={{ position: 'relative', padding: 0, border: 'none', background: 'none', borderRadius: '50%', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
        <MyAvatar name={name} size={SIZE} style={{ background: accent, color: '#fff', fontWeight: 800, fontSize: 24 }} />
        <span aria-hidden style={{
          position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: '50%',
          background: '#fff', color: accent, border: '1px solid #e2e8f0', fontSize: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(15,23,42,0.15)',
        }}>
          <FontAwesomeIcon icon={faCamera} />
        </span>
      </button>
      {hasPhoto && (
        <button type="button" onClick={() => void run(removeMyPhoto, 'Photo removed')} disabled={busy}
          style={{ minHeight: 28, padding: '0 6px', border: 'none', background: 'none', color: '#64748b', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: busy ? 'default' : 'pointer' }}>
          Remove
        </button>
      )}
      <input ref={input} type="file" accept={PHOTO_ACCEPT} hidden onChange={e => pick(e.target.files?.[0])} />
    </div>
  );
}
