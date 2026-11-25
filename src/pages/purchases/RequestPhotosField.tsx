import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { fetchPurchasePhoto, type PurchasePhoto } from '../../api/purchaseRequests.js';
import AttachmentPicker from '../../components/common/AttachmentPicker.js';
import { usePrivateFileUrl } from '../../components/common/PrivateAttachments.js';
import { MAX_PURCHASE_PHOTOS, PURCHASE_PHOTO_RULES, purchasePhotoProblem } from './purchaseDisplay.js';

// Request an Item → "Photos": on a new request, just the picker; while editing,
// the photos already sent (each can be removed) and room to add more — up to
// MAX_PURCHASE_PHOTOS in all. Nothing changes until the request is saved.

const TILE = 84;

interface Props {
  /** Editing: the request, and the photos it has that are still kept. */
  requestId?: string;
  kept: PurchasePhoto[];
  onRemoveKept: (id: string) => void;
  added: File[];
  onAdded: (files: File[]) => void;
  theme: { accent: string; muted: string; border: string };
  disabled?: boolean;
}

export default function RequestPhotosField({ requestId, kept, onRemoveKept, added, onAdded, theme, disabled }: Props) {
  const room = MAX_PURCHASE_PHOTOS - kept.length;
  const rules = {
    ...PURCHASE_PHOTO_RULES,
    max: room,
    problem: (files: File[]) => (files.length > room ? `You can add up to ${MAX_PURCHASE_PHOTOS} photos in all.` : purchasePhotoProblem(files)),
  };
  return (
    <div>
      {requestId && kept.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          {kept.map(p => <KeptPhoto key={p.id} requestId={requestId} photo={p} disabled={disabled} onRemove={() => onRemoveKept(p.id)} />)}
        </div>
      )}
      {room > 0 || added.length > 0
        ? <AttachmentPicker files={added} onChange={onAdded} rules={rules} theme={theme} disabled={disabled} />
        : <div style={{ fontSize: 12, color: theme.muted }}>{MAX_PURCHASE_PHOTOS} photos is the most — remove one to add another.</div>}
    </div>
  );
}

function KeptPhoto({ requestId, photo, onRemove, disabled }: { requestId: string; photo: PurchasePhoto; onRemove: () => void; disabled?: boolean }) {
  const { url } = usePrivateFileUrl({
    file: { id: photo.id, kind: 'image', size: photo.size, name: photo.name },
    cacheKey: ['purchase-photo', requestId],
    load: fileId => fetchPurchasePhoto(requestId, fileId),
  });
  return (
    <div title={photo.name} style={{ position: 'relative', width: TILE, height: TILE, borderRadius: 12, overflow: 'hidden', background: '#0f172a', flexShrink: 0 }}>
      {url && <img src={url} alt={photo.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      {!disabled && (
        <button type="button" aria-label={`Remove ${photo.name}`} onClick={onRemove} style={{
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
