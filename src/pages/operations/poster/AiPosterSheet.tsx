import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import { fetchPosterImage } from '../../../api/sop-templates.js';
import { usePrivateFileUrl } from '../../../components/common/PrivateAttachments.js';
import { POSTER_C, sheetStyle } from './posterSheet.js';

// The AI-drawn poster on an A4 sheet — the saved picture, fitted to the page.
// It's only downloaded (never redrawn) when the poster is opened.

/** Cache key prefix for poster pictures; a picture id never changes what it shows. */
export const POSTER_IMAGE_KEY = ['guide-poster'] as const;

export function usePosterImageUrl(templateId: string, imageId: string) {
  return usePrivateFileUrl({
    file: { id: imageId, kind: 'image', size: 0, name: 'Poster' },
    cacheKey: [...POSTER_IMAGE_KEY, templateId],
    load: id => fetchPosterImage(templateId, id),
  });
}

export default function AiPosterSheet({ templateId, imageId, title, style }: {
  templateId: string; imageId: string; title: string; style?: React.CSSProperties;
}) {
  const { url, isError, reason } = usePosterImageUrl(templateId, imageId);
  return (
    <section className="poster-sheet" aria-label={`Poster: ${title}`} style={{ ...sheetStyle, padding: '8mm', display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
      {url ? (
        <img src={url} alt={`Poster: ${title}`} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
      ) : (
        <span style={{ fontSize: '11pt', color: POSTER_C.muted, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {isError && <FontAwesomeIcon icon={faCircleExclamation} />}
          {isError ? reason : 'Loading the poster…'}
        </span>
      )}
    </section>
  );
}
