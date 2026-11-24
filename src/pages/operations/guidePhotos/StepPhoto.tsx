import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation, faImage } from '@fortawesome/free-solid-svg-icons';
import { fetchGuideImage } from '../../../api/guideImages.js';
import { PrivateFileViewer, usePrivateFileUrl, type FileProps } from '../../../components/common/PrivateAttachments.js';

// A How-To Guide step's photo: shown under the step, tap to see it full
// screen. Private (signed-in staff only), so it's fetched with the login and
// shown from a blob URL — one download shared by every place that shows it.

/** Shared cache key for step photos (the poster reads the same downloads). */
export const GUIDE_IMAGE_KEY = ['guide-image'] as const;

export function guideImageFile(imageId: string, name: string): FileProps {
  return { file: { id: imageId, kind: 'image', size: 0, name }, cacheKey: GUIDE_IMAGE_KEY, load: fetchGuideImage };
}

/** The photo's blob URL (null while loading), for anything drawing it itself — e.g. the poster. */
export function useGuideImageUrl(imageId: string, name = 'Step photo') {
  return usePrivateFileUrl(guideImageFile(imageId, name));
}

interface Props {
  imageId: string;
  /** The step title — used as the photo's description. */
  alt: string;
  /** Height of the shown photo, px. */
  height?: number;
}

export default function StepPhoto({ imageId, alt, height = 160 }: Props) {
  const [open, setOpen] = useState(false);
  const { url, isError, reason } = useGuideImageUrl(imageId, alt);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Open photo: ${alt}`} title="Open photo" style={{
        display: 'block', height, maxWidth: '100%', minWidth: Math.round(height * 1.2), padding: 0, marginTop: 10,
        border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', background: '#f1f5f9', cursor: 'pointer',
      }}>
        {url ? (
          <img src={url} alt={alt} style={{ display: 'block', height: '100%', width: 'auto', maxWidth: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 12px', color: '#64748b', fontSize: 12 }}>
            <FontAwesomeIcon icon={isError ? faCircleExclamation : faImage} />
            {isError ? reason : 'Loading photo…'}
          </span>
        )}
      </button>
      {open && <PrivateFileViewer {...guideImageFile(imageId, alt)} onClose={() => setOpen(false)} />}
    </>
  );
}
