import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCamera, faReceipt } from '@fortawesome/free-solid-svg-icons';
import { fetchReceipt, markBought, refreshPurchaseLists, type PurchaseRequest, type SaveBought } from '../../api/purchaseRequests.js';
import FormModal from '../../components/common/FormModal.js';
import { useToast } from '../../components/common/Toast.js';

// Shopping List → a bought item's "Cost & receipt": what it cost (RM) and a
// photo of the receipt. Both optional — fill in now at the till, or later.

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

interface Props {
  request: PurchaseRequest;
  onClose: () => void;
  /** Where to save — the supervisor's tick by default; the requester's own self-buy from the teacher app. */
  save?: SaveBought;
  /** The saved receipt photo is office-only; the requester just sees that one was added. */
  canViewReceipt?: boolean;
  title?: string;
}

export default function BoughtDetailsModal({ request: r, onClose, save: saveTo = markBought, canViewReceipt = true, title = 'Cost & receipt' }: Props) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [cost, setCost] = useState(r.cost ?? '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setProblem('The receipt must be a photo.'); return; }
    if (f.size > MAX_RECEIPT_BYTES) { setProblem('That photo is over 10 MB.'); return; }
    setProblem(null);
    setPhoto(f);
  };

  const save = async () => {
    if (busy) return;
    const trimmed = cost.trim();
    if (trimmed && (!Number.isFinite(Number(trimmed)) || Number(trimmed) < 0)) { setProblem('Enter the cost in RM, e.g. 12.50'); return; }
    setBusy(true);
    try {
      await saveTo(r.id, { cost: trimmed, receipt: photo ?? undefined });
      refreshPurchaseLists(qc);
      qc.invalidateQueries({ queryKey: ['purchase-receipt', r.id] });
      showToast('Saved');
      onClose();
    } catch (e: any) {
      showToast(e?.message ?? 'Could not save', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormModal title={title} subtitle={`${r.item} × ${r.quantity}`} onClose={onClose} width={440} dirty={!!photo || cost !== (r.cost ?? '')}
      primary={{ label: busy ? 'Saving…' : 'Save', onClick: save, busy, tone: '#047857' }}>
      <label htmlFor="pr-cost" style={labelStyle}>What did it cost?</label>
      <div style={{ position: 'relative', marginBottom: 18 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, fontWeight: 600, color: '#64748b' }}>RM</span>
        <input id="pr-cost" autoFocus inputMode="decimal" value={cost} onChange={e => { setCost(e.target.value); setProblem(null); }} placeholder="0.00" style={{
          width: '100%', boxSizing: 'border-box', padding: '11px 12px 11px 44px', borderRadius: 8, border: '1px solid #e2e8f0',
          fontSize: 16, fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums', outline: 'none',
        }} />
      </div>

      <span style={labelStyle}>Receipt photo</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {photo ? <LocalThumb file={photo} /> : r.receipt && canViewReceipt ? <ReceiptThumb requestId={r.id} /> : r.hasReceipt ? <span style={{ fontSize: 12.5, color: '#047857', fontWeight: 600 }}>Receipt added</span> : null}
        <button type="button" onClick={() => picker.current?.click()} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, border: '1px dashed #cbd5e1',
          background: '#fff', color: '#334155', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
        }}>
          <FontAwesomeIcon icon={faCamera} style={{ color: '#047857' }} /> {photo || r.receipt || r.hasReceipt ? 'Replace photo' : 'Add photo'}
        </button>
      </div>
      <input ref={picker} type="file" accept="image/*" hidden onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      {problem && <div role="alert" style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: '#b91c1c' }}>{problem}</div>}
    </FormModal>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 };
const THUMB = 72;
const thumbStyle: React.CSSProperties = { width: THUMB, height: THUMB, borderRadius: 10, objectFit: 'cover', border: '1px solid #e2e8f0', display: 'block' };

/** The photo just picked, before it's uploaded. */
function LocalThumb({ file }: { file: File }) {
  const url = useObjectUrl(file);
  return url ? <img src={url} alt="New receipt" style={thumbStyle} /> : null;
}

/** The receipt already saved — private, so fetched with the login. Click to open full size. */
export function ReceiptThumb({ requestId, size = THUMB }: { requestId: string; size?: number }) {
  const { data: blob, isError } = useQuery({ queryKey: ['purchase-receipt', requestId], queryFn: () => fetchReceipt(requestId), staleTime: Infinity });
  const url = useObjectUrl(blob ?? null);
  const [open, setOpen] = useState(false);
  if (isError) return <FontAwesomeIcon icon={faReceipt} style={{ color: '#64748b', fontSize: size / 3 }} title="Couldn’t load the receipt" />;
  if (!url) return <div style={{ ...thumbStyle, width: size, height: size, background: '#f1f5f9' }} />;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Open receipt" title="Open receipt" style={{ padding: 0, border: 'none', background: 'none', cursor: 'zoom-in' }}>
        <img src={url} alt="Receipt" style={{ ...thumbStyle, width: size, height: size }} />
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Receipt" onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(2,6,23,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, cursor: 'zoom-out',
        }}>
          <img src={url} alt="Receipt" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />
        </div>
      )}
    </>
  );
}

function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) { setUrl(null); return; }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}
