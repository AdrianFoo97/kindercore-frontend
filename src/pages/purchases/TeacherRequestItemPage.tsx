import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCartShopping } from '@fortawesome/free-solid-svg-icons';
import { fetchMyPurchaseRequests, requestPurchase, updatePurchaseRequest, refreshPurchaseLists } from '../../api/purchaseRequests.js';
import { TEACHER_CONTENT_TOP } from '../../components/common/TeacherTopBar.js';
import { useToast } from '../../components/common/Toast.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import PurchaseRequestFields, { TEACHER_PURCHASE_THEME } from './PurchaseRequestFields.js';
import { emptyPurchaseDraft, purchaseDraftProblem, purchaseDraftToInput, type PurchaseDraft } from './purchaseDisplay.js';

// Teacher app → Request an Item (/teachers/:id/purchases/new), or edit one
// still waiting for approval (/teachers/:id/purchases/:requestId/edit). New
// requests go onto the supervisor's shopping list; "Requested by" and the
// submit time are recorded by the server.

const C = { bg: '#f8fafc', textStrong: '#334155', muted: '#64748b', pAccent: '#7c3aed', pSoft: '#f5f3ff', pBorder: '#ddd6fe' };

export default function TeacherRequestItemPage() {
  const { id, requestId } = useParams<{ id: string; requestId?: string }>();
  const editing = !!requestId;
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { isMobile } = useIsMobile();
  const { showToast } = useToast();
  const [draft, setDraft] = useState<PurchaseDraft>(emptyPurchaseDraft);
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Editing: start from the request as it stands (same query as the Requests list, so usually already cached).
  const { data: mine } = useQuery({ queryKey: ['my-purchase-requests'], queryFn: fetchMyPurchaseRequests, enabled: editing });
  const original = mine?.find(r => r.id === requestId);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!original || loaded) return;
    setDraft({ buyer: original.buyer, item: original.item, quantity: original.quantity, purpose: original.purpose, note: original.note ?? '', link: original.link ?? '' });
    setLoaded(true);
  }, [original, loaded]);
  const locked = editing && !!original && original.status !== 'REQUESTED';

  const goBack = () => {
    // Opened from the Requests list — go back to it; a cold deep link lands on the list.
    if (location.key !== 'default') navigate(-1);
    else navigate(`/teachers/${id}/purchases`, { replace: true });
  };

  const submit = async () => {
    const p = purchaseDraftProblem(draft);
    setProblem(p);
    if (p || submitting || locked) return;
    setSubmitting(true);
    try {
      if (editing) await updatePurchaseRequest(requestId!, purchaseDraftToInput(draft));
      else await requestPurchase(purchaseDraftToInput(draft));
      refreshPurchaseLists(qc);
      showToast(editing ? 'Request updated' : 'Request sent', 'success');
      goBack();
    } catch (e: any) {
      showToast(e?.message ?? 'Could not send that — please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      paddingTop: isMobile ? TEACHER_CONTENT_TOP : 28, paddingRight: isMobile ? 16 : 32,
      paddingBottom: 40, paddingLeft: isMobile ? 16 : 32, minHeight: '100vh',
      fontFamily: '"Nunito", "Segoe UI", Roboto, Arial, sans-serif', color: C.textStrong, background: C.bg,
    }}>
      <div style={{ maxWidth: isMobile ? 640 : 520, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 13, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: C.pSoft, color: C.pAccent, fontSize: 17, border: `1px solid ${C.pBorder}`,
          }}>
            <FontAwesomeIcon icon={faCartShopping} />
          </div>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em' }}>{editing ? 'Edit Request' : 'Request an Item'}</h1>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 13.5, color: C.muted, lineHeight: 1.55 }}>
          {editing
            ? 'You can change it until your supervisor approves it.'
            : 'It goes on the shopping list for your supervisor to approve. You can still edit or withdraw it until it’s approved.'}
        </p>

        {editing && !original ? (
          <div style={{ fontSize: 13.5, color: C.muted }}>{mine ? 'This request isn’t available any more.' : 'Loading…'}</div>
        ) : locked ? (
          <div role="alert" style={{ padding: 14, borderRadius: 12, background: '#eef2ff', color: '#4338ca', fontSize: 13.5, fontWeight: 600, lineHeight: 1.5 }}>
            It’s already been approved, so it can’t be changed. Ask your supervisor if something needs to change.
          </div>
        ) : (
          <>
            <PurchaseRequestFields value={draft} onChange={d => { setDraft(d); if (problem) setProblem(null); }}
              theme={TEACHER_PURCHASE_THEME} disabled={submitting} />

            {problem && <div role="alert" style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: '#b91c1c' }}>{problem}</div>}

            <button type="button" onClick={submit} disabled={submitting} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: 20, padding: 14,
              border: 'none', borderRadius: 12, background: C.pAccent, color: '#fff', fontSize: 15, fontWeight: 700,
              fontFamily: 'inherit', cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1,
            }}>
              {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Send Request'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
