import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck, faClockRotateLeft, faNoteSticky, faPen, faPlus, faReceipt, faTrash, faUser,
} from '@fortawesome/free-solid-svg-icons';
import {
  MY_REQUESTS_FRESHNESS, fetchMyPurchaseRequests, markBoughtMyself, refreshPurchaseLists, withdrawPurchaseRequest, type PurchaseBuyer, type PurchaseRequest,
} from '../../api/purchaseRequests.js';
import ConfirmDialog from '../../components/common/ConfirmDialog.js';
import FormModal from '../../components/common/FormModal.js';
import SegmentedControl from '../../components/common/SegmentedControl.js';
import { TEACHER_CONTENT_TOP } from '../../components/common/TeacherTopBar.js';
import TeacherFab, { TEACHER_FAB_CLEARANCE } from '../../components/common/TeacherFab.js';
import { useToast } from '../../components/common/Toast.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import BoughtDetailsModal from './BoughtDetailsModal.js';
import PurchaseHistory from './PurchaseHistory.js';
import { PURCHASE_STATUS_LABEL, PURCHASE_STATUS_LOOK, fmtMoment, fmtRM, isOpen } from './purchaseDisplay.js';

// Teacher app → Requests: ask for something to be bought, and see where each
// request stands — waiting for approval, approved, bought, or not buying
// (with the reason). While a request is still waiting for approval it can be
// edited or withdrawn; once approved it's locked. Each request keeps a
// record (submitted, edited, carried over, approved, bought…) with exact
// times. Reached from Home's quick actions.

const C = {
  bg: '#f8fafc', card: '#ffffff', cardBorder: '#eceef2', textStrong: '#334155', text: '#475569',
  muted: '#64748b', mutedSoft: '#64748b', pAccent: '#7c3aed', pSoft: '#f5f3ff',
};

type Filter = 'REQUESTED' | 'APPROVED' | 'DONE';
/** Segment labels stay short so three fit across a phone. */
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'REQUESTED', label: 'Waiting' },
  { key: 'APPROVED', label: PURCHASE_STATUS_LABEL.APPROVED },
  { key: 'DONE', label: 'Done' },
];
/** "Filtered to nothing" — different from having no requests at all. */
const EMPTY_FILTER_TITLE: Record<Filter, string> = {
  REQUESTED: 'Nothing waiting for approval.',
  APPROVED: 'Nothing approved yet.',
  DONE: 'Nothing bought or turned down yet.',
};
/** How the Approved list is split — what the teacher still has to buy first, then what's being bought for them. */
const APPROVED_GROUPS: { label: string | null; buyer: PurchaseBuyer | null }[] = [
  { label: 'You’re buying it yourself', buyer: 'SELF' },
  { label: 'Being bought for you', buyer: 'SUPERVISOR' },
];
/** Done = bought or not buying. */
const matches = (r: PurchaseRequest, f: Filter) => (f === 'DONE' ? !isOpen(r.status) : r.status === f);

export default function TeacherPurchasesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isMobile } = useIsMobile();
  const { data: requests = [], isLoading, isError, refetch } = useQuery({ queryKey: ['my-purchase-requests'], queryFn: fetchMyPurchaseRequests, ...MY_REQUESTS_FRESHNESS });
  const [filter, setFilter] = useState<Filter>('REQUESTED');
  const shown = requests.filter(r => matches(r, filter));
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [withdrawing, setWithdrawing] = useState<PurchaseRequest | null>(null);
  const [recordOf, setRecordOf] = useState<PurchaseRequest | null>(null);
  const [buyingSelf, setBuyingSelf] = useState<PurchaseRequest | null>(null);
  const [busy, setBusy] = useState(false);

  const withdraw = async () => {
    if (!withdrawing || busy) return;
    setBusy(true);
    try {
      await withdrawPurchaseRequest(withdrawing.id);
      refreshPurchaseLists(qc);
      showToast('Request withdrawn');
      setWithdrawing(null);
    } catch (e: any) {
      showToast(e?.message ?? 'Could not withdraw it', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      paddingTop: isMobile ? TEACHER_CONTENT_TOP : 28, paddingRight: isMobile ? 16 : 32,
      paddingBottom: isMobile ? 40 + TEACHER_FAB_CLEARANCE : 40, paddingLeft: isMobile ? 16 : 32, minHeight: '100vh',
      fontFamily: '"Nunito", "Segoe UI", Roboto, Arial, sans-serif', color: C.text, background: C.bg,
    }}>
      <div style={{ maxWidth: isMobile ? 640 : 560, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 16px', paddingLeft: 4, fontSize: isMobile ? 30 : 24, fontWeight: 800, color: C.textStrong, letterSpacing: '-0.02em' }}>
          Requests
        </h1>
        {/* Phone: the floating "+" above the nav. Wider screens: a full-width button here. */}
        {isMobile ? (
          <TeacherFab label="Request an Item" onClick={() => navigate(`/teachers/${id}/purchases/new`)} />
        ) : (
          <button type="button" onClick={() => navigate(`/teachers/${id}/purchases/new`)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 14,
            border: 'none', borderRadius: 12, background: C.pAccent, color: '#fff', fontSize: 15, fontWeight: 700,
            fontFamily: 'inherit', cursor: 'pointer', marginBottom: 22,
          }}>
            <FontAwesomeIcon icon={faPlus} style={{ fontSize: 13 }} /> Request an Item
          </button>
        )}

        <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.09em', margin: '0 2px 8px' }}>
          My requests
        </div>

        {requests.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SegmentedControl<Filter> ariaLabel="Show requests" accent={C.pAccent} value={filter} onChange={setFilter}
              segments={FILTERS.map(f => ({ ...f, count: requests.filter(r => matches(r, f.key)).length }))} />
          </div>
        )}

        {/* States in order: loading → error (retry) → empty → content. */}
        {isLoading ? (
          <div style={{ fontSize: 14, color: C.muted, padding: '12px 2px' }}>Loading…</div>
        ) : isError ? (
          <div style={emptyCard}>
            <div style={emptyTitle}>Couldn’t load your requests.</div>
            <button type="button" onClick={() => refetch()} className="tap" style={{ ...pillBtn(C.pAccent, C.pSoft), marginTop: 12 }}>Try again</button>
          </div>
        ) : requests.length === 0 ? (
          <div style={emptyCard}>
            <div style={emptyTitle}>No requests yet.</div>
            <div style={emptyBody}>Ask for class supplies and they go on the shopping list.</div>
          </div>
        ) : shown.length === 0 ? (
          <div style={emptyCard}>
            <div style={emptyTitle}>{EMPTY_FILTER_TITLE[filter]}</div>
          </div>
        ) : (
          // Approved: split by who's buying — the teacher's own to-do first.
          (filter === 'APPROVED' ? APPROVED_GROUPS : [{ label: null, buyer: null }]).map(g => {
            const items = g.buyer ? shown.filter(r => r.buyer === g.buyer) : shown;
            if (items.length === 0) return null;
            return (
              <section key={g.label ?? 'all'} style={{ marginBottom: g.label ? 16 : 0 }}>
                {g.label && (
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: C.textStrong, margin: '0 2px 8px' }}>
                    {g.label} <span style={{ color: C.mutedSoft, fontWeight: 700 }}>· {items.length}</span>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {items.map(r => (
                    <RequestCard key={r.id} request={r}
                      onEdit={() => navigate(`/teachers/${id}/purchases/${r.id}/edit`)}
                      onWithdraw={() => setWithdrawing(r)}
                      onRecord={() => setRecordOf(r)}
                      onBoughtMyself={() => setBuyingSelf(r)} />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>

      {recordOf && (
        <FormModal title={`${recordOf.item} × ${recordOf.quantity}`} subtitle="Record of your request" onClose={() => setRecordOf(null)} width={460}
>
          <PurchaseHistory entries={recordOf.history} />
        </FormModal>
      )}
      {buyingSelf && (
        <BoughtDetailsModal request={buyingSelf} onClose={() => setBuyingSelf(null)} save={markBoughtMyself} canViewReceipt={false}
          title={buyingSelf.status === 'BOUGHT' ? 'Cost & receipt' : 'Mark as bought'} />
      )}
      {withdrawing && (
        <ConfirmDialog
          title="Withdraw this request?"
          message={`${withdrawing.item} × ${withdrawing.quantity} comes off the shopping list. Its record is kept.`}
          confirmLabel="Withdraw"
          destructive
          loading={busy}
          onConfirm={withdraw}
          onCancel={() => setWithdrawing(null)}
        />
      )}
    </div>
  );
}

function RequestCard({ request: r, onEdit, onWithdraw, onRecord, onBoughtMyself }: {
  request: PurchaseRequest; onEdit: () => void; onWithdraw: () => void; onRecord: () => void; onBoughtMyself: () => void;
}) {
  const look = PURCHASE_STATUS_LOOK[r.status];
  // Only while it's waiting for approval — once approved it's locked.
  const editable = r.status === 'REQUESTED';
  const selfBuy = r.buyer === 'SELF';
  return (
    <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.textStrong }}>{r.item} <span style={{ fontWeight: 600, color: C.muted }}>× {r.quantity}</span></div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: C.muted, marginTop: 2 }}>{r.purpose}</div>
          {/* The exact submit time — the record that it was asked for. */}
          <div style={{ fontSize: 12, color: C.mutedSoft, marginTop: 2 }}>Submitted {fmtMoment(r.createdAt)}</div>
          {selfBuy && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '2px 8px', borderRadius: 6, background: '#f0fdfa', color: '#0f766e', fontSize: 11.5, fontWeight: 700 }}>
              <FontAwesomeIcon icon={faUser} style={{ fontSize: 9.5 }} /> You’re buying it
              {r.status === 'BOUGHT' && r.cost != null && <span style={{ fontVariantNumeric: 'tabular-nums' }}> · {fmtRM(r.cost)}</span>}
            </div>
          )}
        </div>
        <span style={{ flexShrink: 0, padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 800, color: look.fg, background: look.bg }}>
          {PURCHASE_STATUS_LABEL[r.status]}
        </span>
      </div>
      {r.status === 'NOT_BUYING' && r.declineReason && (
        <div style={{ marginTop: 10, padding: '8px 11px', borderRadius: 10, background: '#f8fafc', fontSize: 13, color: C.textStrong, lineHeight: 1.45 }}>
          {r.declineReason}
        </div>
      )}
      {r.supervisorNote && (
        <div style={{ marginTop: 10, padding: '8px 11px', borderRadius: 10, background: '#fefce8', border: '1px solid #fef08a', fontSize: 13, color: '#713f12', lineHeight: 1.45 }}>
          <FontAwesomeIcon icon={faNoteSticky} style={{ fontSize: 11, marginRight: 6, color: '#ca8a04' }} />
          {r.supervisorNote}{r.supervisorNoteByName && <span style={{ color: '#a16207' }}> — {r.supervisorNoteByName}</span>}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={onRecord} className="tap" style={linkBtn(C.muted)}>
          <FontAwesomeIcon icon={faClockRotateLeft} style={{ fontSize: 11 }} /> Show record
        </button>
        <div style={{ flex: 1 }} />
        {/* Their own self-buy, once approved: mark it bought (cost + receipt), or update those after. */}
        {selfBuy && (r.status === 'APPROVED' || r.status === 'BOUGHT') && (
          <button type="button" onClick={onBoughtMyself} className="tap" style={pillBtn(r.status === 'BOUGHT' ? '#0f766e' : '#fff', r.status === 'BOUGHT' ? '#f0fdfa' : '#0f766e')}>
            <FontAwesomeIcon icon={r.status === 'BOUGHT' ? faReceipt : faCheck} style={{ fontSize: 10.5 }} />
            {r.status === 'BOUGHT' ? (r.cost != null ? 'Cost & receipt' : 'Add cost & receipt') : 'Mark as bought'}
          </button>
        )}
        {editable && (
          <>
            <button type="button" onClick={onEdit} className="tap" style={pillBtn(C.pAccent, C.pSoft)}>
              <FontAwesomeIcon icon={faPen} style={{ fontSize: 10.5 }} /> Edit
            </button>
            <button type="button" onClick={onWithdraw} className="tap" style={pillBtn('#b91c1c', '#fef2f2')}>
              <FontAwesomeIcon icon={faTrash} style={{ fontSize: 10.5 }} /> Withdraw
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const emptyCard: React.CSSProperties = { background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: 16 };
const emptyTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: C.textStrong };
const emptyBody: React.CSSProperties = { fontSize: 14, color: C.muted, marginTop: 4, lineHeight: 1.5 };

function pillBtn(fg: string, bg: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 34, padding: '0 14px', borderRadius: 999, border: 'none',
    background: bg, color: fg, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
  };
}
function linkBtn(fg: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 34, padding: 0, border: 'none', background: 'none',
    color: fg, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
  };
}
