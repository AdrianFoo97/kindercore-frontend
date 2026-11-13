import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setPurchaseNote, type PurchaseRequest, refreshPurchaseLists } from '../../api/purchaseRequests.js';
import FormModal from '../../components/common/FormModal.js';
import { useToast } from '../../components/common/Toast.js';
import PurchaseHistory from './PurchaseHistory.js';

// Shopping List → an item's note and record. The supervisor's note ("Out of
// stock at MR DIY, trying again next week") is shown to the requester too;
// clearing the box removes it. Below it, the item's full history.

const NOTE_MAX = 500;

export default function ItemNoteModal({ request: r, onClose }: { request: PurchaseRequest; onClose: () => void }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [note, setNote] = useState(r.supervisorNote ?? '');
  const [busy, setBusy] = useState(false);
  const unchanged = note.trim() === (r.supervisorNote ?? '');

  const save = async () => {
    if (busy || unchanged) { onClose(); return; }
    setBusy(true);
    try {
      await setPurchaseNote(r.id, note.trim());
      refreshPurchaseLists(qc);
      onClose();
    } catch (e: any) {
      showToast(e?.message ?? 'Could not save the note', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormModal title={`${r.item} × ${r.quantity}`} subtitle={`Asked by ${r.requestedByName} · ${r.purpose}`} onClose={onClose} width={480}
      cancelLabel={unchanged ? 'Close' : 'Cancel'} dirty={!unchanged}
      primary={{ label: busy ? 'Saving…' : 'Save', onClick: save, busy, disabled: unchanged }}>
      <label htmlFor="pr-sup-note" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
        Your note <span style={{ fontWeight: 500, color: '#64748b' }}>— {r.requestedByName} sees it too</span>
      </label>
      <textarea id="pr-sup-note" value={note} maxLength={NOTE_MAX} onChange={e => setNote(e.target.value)}
        placeholder="e.g. Out of stock at MR DIY — trying again next week" style={{
          width: '100%', boxSizing: 'border-box', minHeight: 80, padding: '10px 12px', borderRadius: 8, resize: 'vertical',
          border: '1px solid #e2e8f0', fontSize: 14, fontFamily: 'inherit', color: '#0f172a', outline: 'none',
        }} />

      <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '18px 0 10px' }}>Record</div>
      <PurchaseHistory entries={r.history} />
    </FormModal>
  );
}
