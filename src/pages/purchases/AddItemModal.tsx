import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { requestPurchase, refreshPurchaseLists } from '../../api/purchaseRequests.js';
import FormModal from '../../components/common/FormModal.js';
import { useToast } from '../../components/common/Toast.js';
import PurchaseRequestFields, { ADMIN_PURCHASE_THEME } from './PurchaseRequestFields.js';
import { emptyPurchaseDraft, purchaseDraftProblem, purchaseDraftToInput, type PurchaseDraft } from './purchaseDisplay.js';

// Shopping List → "Add item": the supervisor (or office) putting something on
// the list themselves. Same request as a teacher's, in their own name.

export default function AddItemModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [draft, setDraft] = useState<PurchaseDraft>(emptyPurchaseDraft);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const p = purchaseDraftProblem(draft);
    setProblem(p);
    if (p || busy) return;
    setBusy(true);
    try {
      await requestPurchase(purchaseDraftToInput(draft));
      refreshPurchaseLists(qc);
      showToast('Added to the list');
      onClose();
    } catch (e: any) {
      showToast(e?.message ?? 'Could not add that', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormModal title="Add to the shopping list" onClose={onClose}
      dirty={!!(draft.item || draft.quantity || draft.purpose || draft.note || draft.link)}
      primary={{ label: busy ? 'Adding…' : 'Add', onClick: save, busy }}>
      <PurchaseRequestFields value={draft} onChange={d => { setDraft(d); if (problem) setProblem(null); }} theme={ADMIN_PURCHASE_THEME} disabled={busy} />
      {problem && <div role="alert" style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: '#b91c1c' }}>{problem}</div>}
    </FormModal>
  );
}
