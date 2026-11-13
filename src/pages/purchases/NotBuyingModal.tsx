import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { markNotBuying, type PurchaseRequest, refreshPurchaseLists } from '../../api/purchaseRequests.js';
import FormModal from '../../components/common/FormModal.js';
import { useToast } from '../../components/common/Toast.js';

// Shopping List → "Not buying": turn a request down. The reason is required —
// the requester sees it in their app, so they aren't left wondering.

const REASON_MAX = 500;

export default function NotBuyingModal({ request: r, onClose }: { request: PurchaseRequest; onClose: () => void }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const empty = !reason.trim();

  const save = async () => {
    if (busy || empty) return;
    setBusy(true);
    try {
      await markNotBuying(r.id, reason.trim());
      refreshPurchaseLists(qc);
      showToast(`${r.item} — not buying`);
      onClose();
    } catch (e: any) {
      showToast(e?.message ?? 'Could not save', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormModal title="Not buying this" subtitle={`${r.item} × ${r.quantity} · asked by ${r.requestedByName}`} onClose={onClose} width={460} dirty={!empty}
      primary={{ label: busy ? 'Saving…' : 'Not buying', onClick: save, busy, disabled: empty, tone: '#475569' }}>
      <label htmlFor="pr-reason" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
        Why not? {r.requestedByName} will see this.
      </label>
      <textarea id="pr-reason" autoFocus value={reason} maxLength={REASON_MAX} onChange={e => setReason(e.target.value)}
        placeholder="e.g. We still have 3 boxes in the store room" style={{
          width: '100%', boxSizing: 'border-box', minHeight: 90, padding: '10px 12px', borderRadius: 8, resize: 'vertical',
          border: '1px solid #e2e8f0', fontSize: 14, fontFamily: 'inherit', color: '#0f172a', outline: 'none',
        }} />
    </FormModal>
  );
}
