import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCartShopping, faChevronLeft, faChevronRight, faPlus, faThumbsUp } from '@fortawesome/free-solid-svg-icons';
import {
  approveAllPurchases, approvePurchase, backToList, fetchShoppingList, markBought, refreshPurchaseLists, type PurchaseRequest,
} from '../../api/purchaseRequests.js';
import { useToast } from '../../components/common/Toast.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import AddItemModal from './AddItemModal.js';
import BoughtDetailsModal from './BoughtDetailsModal.js';
import ItemNoteModal from './ItemNoteModal.js';
import NotBuyingModal from './NotBuyingModal.js';
import { fmtRM, shiftWeek, weekLabel, weekStartOf } from './purchaseDisplay.js';
import { CarriedRow, ListRow, NotBuyingRow } from './ShoppingListRow.js';
import { C, btn, iconBtn } from './shoppingListTheme.js';

// Operation → Shopping List: the supervisor's shopping list — everything
// staff have asked to be bought, as one checklist to tick off at the shop.
//  - New requests wait for approval; "Approve" (or "Approve all") confirms
//    them, and only then can they be ticked. Approved requests are locked
//    for the teacher who asked.
//  - Anything not bought stays on the list into the next week, tagged
//    "Carried over · N weeks" (amber, red from two weeks).
//  - A past week keeps its record: what was bought that week, and what was
//    on its list but carried over (and how it turned out since).

export default function ShoppingListPage() {
  const { isMobile } = useIsMobile();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const thisWeek = weekStartOf(new Date());
  const [week, setWeek] = useState(thisWeek);
  const [adding, setAdding] = useState(false);
  const [declining, setDeclining] = useState<PurchaseRequest | null>(null);
  const [detailing, setDetailing] = useState<PurchaseRequest | null>(null);
  const [noting, setNoting] = useState<PurchaseRequest | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const isThisWeek = week === thisWeek;

  const { data, isLoading, error } = useQuery({ queryKey: ['shopping-list', week], queryFn: () => fetchShoppingList(week) });

  // Quiet — the checkbox / tag itself is the feedback. Only a failure gets a toast.
  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await action();
      refreshPurchaseLists(qc);
    } catch (e: any) {
      showToast(e?.message ?? 'Could not save', 'error');
    } finally {
      setBusyId(null);
    }
  };
  const approveAll = () => run('all', async () => {
    const { approved } = await approveAllPurchases();
    showToast(`${approved} item${approved === 1 ? '' : 's'} approved`);
  });

  const rowActions = (r: PurchaseRequest) => ({
    onApprove: () => run(r.id, () => approvePurchase(r.id)),
    onToggle: () => run(r.id, () => (r.status === 'BOUGHT' ? backToList(r.id) : markBought(r.id))),
    onUndo: () => run(r.id, () => backToList(r.id)),
    onNotBuying: () => setDeclining(r),
    onDetails: () => setDetailing(r),
    onNote: () => setNoting(r),
  });
  const renderRow = (r: PurchaseRequest) => (
    <ListRow key={r.id} request={r} busy={busyId === r.id || busyId === 'all'} isMobile={isMobile} actions={rowActions(r)} />
  );

  // This week's list: everything still open (whenever it was asked for) plus what was bought this week.
  const current = data ? oldestFirst([...data.toBuy, ...data.bought]) : [];
  const waitingApproval = data?.toBuy.filter(r => r.status === 'REQUESTED').length ?? 0;

  return (
    <div className="m-pad" style={{ padding: isMobile ? '16px 12px' : '28px 32px', background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isMobile ? 12 : 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: isMobile ? 19 : 22, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 9 }}>
              <FontAwesomeIcon icon={faCartShopping} style={{ color: C.primary, fontSize: 17 }} /> Shopping List
            </h1>
            {!isMobile && <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Approve what staff asked for, then tick things off as you buy them.</div>}
          </div>
          <button type="button" onClick={() => setAdding(true)} style={{ ...btn(C.primary, '#fff'), flexShrink: 0 }}>
            <FontAwesomeIcon icon={faPlus} style={{ fontSize: 11 }} /> {isMobile ? 'Add' : 'Add item'}
          </button>
        </div>

        <WeekBar isMobile={isMobile} week={week} isThisWeek={isThisWeek} spend={data?.spend}
          onPrev={() => setWeek(w => shiftWeek(w, -1))} onNext={() => setWeek(w => shiftWeek(w, 1))} onThisWeek={() => setWeek(thisWeek)} />

        {isLoading ? <div style={empty}>Loading…</div>
          : error ? <div style={empty}>Couldn’t load the shopping list. {(error as Error).message}</div>
          : data && (isThisWeek ? (
            <>
              {waitingApproval > 0 && (
                <div role="status" style={{
                  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', marginBottom: 14, borderRadius: 10,
                  background: C.amberSoft, border: '1px solid #fde68a', color: '#92400e', fontSize: 13, fontWeight: 600,
                }}>
                  <span style={{ flex: 1, minWidth: 180 }}>
                    {waitingApproval === 1 ? '1 item is' : `${waitingApproval} items are`} waiting for your approval — approve before buying.
                  </span>
                  <button className="tap" type="button" onClick={approveAll} disabled={busyId === 'all'} style={btn(C.primary, '#fff', isMobile)}>
                    <FontAwesomeIcon icon={faThumbsUp} style={{ fontSize: 11 }} /> {busyId === 'all' ? 'Approving…' : 'Approve all'}
                  </button>
                </div>
              )}
              {/* One list for this week — items carried over from earlier weeks carry a "Carried over · N weeks" tag. */}
              <Section title="This week" count={`${current.filter(r => r.status === 'BOUGHT').length} of ${current.length} bought`} color={C.green}>
                {current.length === 0 ? <div style={note}>Nothing on the list — all caught up.</div> : current.map(renderRow)}
              </Section>
              {data.notBuying.length > 0 && (
                <Section title="Not buying" count={data.notBuying.length} color={C.muted}>
                  {data.notBuying.map(r => <NotBuyingRow key={r.id} request={r} busy={busyId === r.id} onUndo={() => run(r.id, () => backToList(r.id))} onRecord={() => setNoting(r)} />)}
                </Section>
              )}
            </>
          ) : (
            // A past week's record.
            <>
              <Section title="Bought that week" count={data.bought.length} color={C.green}>
                {data.bought.length === 0 ? <div style={note}>Nothing bought that week.</div> : data.bought.map(renderRow)}
              </Section>
              {data.carriedOver.length > 0 && (
                <Section title="Not bought that week — carried over" count={data.carriedOver.length} color={C.amber}>
                  {data.carriedOver.map(r => <CarriedRow key={r.id} request={r} onRecord={() => setNoting(r)} />)}
                </Section>
              )}
              {data.notBuying.length > 0 && (
                <Section title="Not buying" count={data.notBuying.length} color={C.muted}>
                  {data.notBuying.map(r => <NotBuyingRow key={r.id} request={r} busy={busyId === r.id} onUndo={() => run(r.id, () => backToList(r.id))} onRecord={() => setNoting(r)} />)}
                </Section>
              )}
            </>
          ))}
      </div>

      {adding && <AddItemModal onClose={() => setAdding(false)} />}
      {declining && <NotBuyingModal request={declining} onClose={() => setDeclining(null)} />}
      {detailing && <BoughtDetailsModal request={detailing} onClose={() => setDetailing(null)} />}
      {noting && <ItemNoteModal request={noting} onClose={() => setNoting(null)} />}
    </div>
  );
}

/** Oldest request first, so the list keeps its order as items are ticked. */
function oldestFirst(items: PurchaseRequest[]): PurchaseRequest[] {
  return [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** ‹ week › and what the week cost — one row on desktop; on a phone the week centred, the spend on its own line underneath. */
function WeekBar({ isMobile, week, isThisWeek, spend, onPrev, onNext, onThisWeek }: {
  isMobile: boolean; week: string; isThisWeek: boolean; spend?: { total: number; uncosted: number };
  onPrev: () => void; onNext: () => void; onThisWeek: () => void;
}) {
  const picker = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...(isMobile ? { justifyContent: 'space-between' } : {}) }}>
      <button type="button" aria-label="Previous week" title="Previous week" onClick={onPrev} style={iconBtn(false)}>
        <FontAwesomeIcon icon={faChevronLeft} />
      </button>
      <div style={{ minWidth: 150, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{weekLabel(week)}</div>
        {isThisWeek
          ? <div style={{ fontSize: 11.5, color: C.mutedSoft }}>This week</div>
          : <button type="button" onClick={onThisWeek} style={{ border: 'none', background: 'none', padding: 0, fontSize: 12, fontWeight: 600, color: C.primary, cursor: 'pointer', fontFamily: 'inherit' }}>Back to this week</button>}
      </div>
      <button type="button" aria-label="Next week" title="Next week" disabled={isThisWeek} onClick={onNext} style={iconBtn(isThisWeek)}>
        <FontAwesomeIcon icon={faChevronRight} />
      </button>
    </div>
  );
  const spent = spend && (
    isMobile ? (
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Spent</span>
        <span style={{ fontSize: 17, fontWeight: 800, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{fmtRM(spend.total)}</span>
        {spend.uncosted > 0 && <span style={{ marginLeft: 'auto', fontSize: 11.5, color: C.amber }}>{spend.uncosted} without a cost</span>}
      </div>
    ) : (
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Spent</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{fmtRM(spend.total)}</div>
        {spend.uncosted > 0 && <div style={{ fontSize: 11.5, color: C.amber }}>{spend.uncosted} without a cost yet</div>}
      </div>
    )
  );
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px', marginBottom: 16,
      ...(isMobile ? {} : { display: 'flex', alignItems: 'center', gap: 10 }),
    }}>
      {picker}
      {!isMobile && <div style={{ flex: 1 }} />}
      {spent}
    </div>
  );
}

function Section({ title, count, color, children }: { title: string; count: number | string; color: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 2px 8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{title}</span>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 10, background: `${color}14`, color }}>{count}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </section>
  );
}

const empty: React.CSSProperties = {
  padding: '40px 20px', textAlign: 'center', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, color: C.muted, fontSize: 14,
};
const note: React.CSSProperties = {
  padding: '12px 14px', borderRadius: 12, background: C.card, border: `1px dashed ${C.border}`, color: C.mutedSoft, fontSize: 13, marginBottom: 16,
};
