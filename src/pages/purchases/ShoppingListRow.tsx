import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowUpRightFromSquare, faBan, faCheck, faClock, faClockRotateLeft, faNoteSticky, faReceipt, faRotateLeft, faThumbsUp, faUser,
} from '@fortawesome/free-solid-svg-icons';
import type { PurchaseRequest } from '../../api/purchaseRequests.js';
import { ActionMenu, type ActionMenuItem } from '../../components/onboarding/ActionMenu.js';
import { ReceiptThumb } from './BoughtDetailsModal.js';
import { CARRIED_LOOK, carriedTag, fmtRM, laterOutcome, weekStartOf } from './purchaseDisplay.js';
import { C, btn, rowStyle } from './shoppingListTheme.js';

// One line of the supervisor's shopping list.
//  - Waiting for approval: checkbox locked; "Approve" button.
//  - Approved: checkbox ticks it bought.
//  - Bought: crossed out, with the cost / receipt; untick to undo.
// Note, record (history), not buying and "take approval back" sit in the ⋯ menu.

const CHECKBOX = 22;

export interface RowActions {
  onApprove: () => void;
  onToggle: () => void;
  onNotBuying: () => void;
  onDetails: () => void;
  onNote: () => void;
  onUndo: () => void;
}

export function ListRow({ request: r, busy, isMobile, actions: a }: { request: PurchaseRequest; busy: boolean; isMobile: boolean; actions: RowActions }) {
  const bought = r.status === 'BOUGHT';
  const waiting = r.status === 'REQUESTED';
  const canTick = !waiting && !busy;

  const menu: ActionMenuItem[][] = [
    [{ icon: faNoteSticky, label: r.supervisorNote ? 'Edit note / record' : 'Add note / record', onClick: a.onNote, iconColor: C.primary }],
    [
      ...(r.status === 'APPROVED' ? [{ icon: faRotateLeft, label: 'Take approval back', onClick: a.onUndo, iconColor: C.muted }] : []),
      ...(!bought ? [{ icon: faBan, label: 'Not buying', onClick: a.onNotBuying, iconColor: C.muted }] : []),
    ],
  ];

  const main = waiting ? (
    <button className="tap" type="button" onClick={a.onApprove} disabled={busy} style={{ ...btn(C.primary, '#fff', isMobile), flexShrink: 0 }}>
      <FontAwesomeIcon icon={faThumbsUp} style={{ fontSize: 11 }} /> Approve
    </button>
  ) : bought ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      {r.receipt && <ReceiptThumb requestId={r.id} size={isMobile ? 30 : 34} />}
      <button className="tap" type="button" onClick={a.onDetails} style={{ ...btn('#fff', r.cost != null ? C.text : C.amber, isMobile), border: `1px solid ${r.cost != null ? C.border : '#fcd34d'}`, fontVariantNumeric: 'tabular-nums' }}>
        {r.cost != null ? fmtRM(r.cost) : <><FontAwesomeIcon icon={faReceipt} style={{ fontSize: 11 }} /> Add cost</>}
      </button>
    </div>
  ) : null;
  const controls = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {main}
      <ActionMenu groups={menu} />
    </div>
  );

  return (
    <div style={{ ...rowStyle, background: bought ? '#fbfdfc' : C.card, ...(isMobile ? { padding: '10px 12px', gap: 10 } : {}) }}>
      {/* Padded hit area around a modest box. Locked (dashed) until approved. */}
      <button type="button" className="tap" role="checkbox" aria-checked={bought} disabled={!canTick} onClick={a.onToggle}
        aria-label={waiting ? `${r.item} — approve it before buying` : bought ? `Put ${r.item} back on the list` : `Bought ${r.item}`}
        title={waiting ? 'Approve first' : bought ? 'Untick — not bought after all' : 'Tick when bought'}
        style={{ padding: 6, margin: -6, marginTop: -4, border: 'none', background: 'none', flexShrink: 0, cursor: canTick ? 'pointer' : 'default', opacity: busy ? 0.5 : 1 }}>
        <span style={{
          width: CHECKBOX, height: CHECKBOX, borderRadius: 6, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `2px ${waiting ? 'dashed' : 'solid'} ${bought ? C.green : waiting ? '#e2e8f0' : '#94a3b8'}`,
          background: bought ? C.green : waiting ? '#f8fafc' : '#fff', color: '#fff', fontSize: 12,
          transition: 'background 0.12s, border-color 0.12s',
        }}>
          {bought && <FontAwesomeIcon icon={faCheck} />}
        </span>
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ opacity: bought ? 0.7 : 1 }}>
          <RequestInfo request={r} crossedOut={bought} extra={<>
            <StatusTag request={r} />
            {r.buyer === 'SELF' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 7px', borderRadius: 6, background: '#f0fdfa', color: '#0f766e', fontWeight: 700, fontSize: 11 }}>
                <FontAwesomeIcon icon={faUser} style={{ fontSize: 9 }} /> Buying it themselves
              </span>
            )}
            <CarriedTag createdAt={r.createdAt} />
          </>} />
        </div>
        <SupervisorNote request={r} />
        {isMobile && <div style={{ marginTop: 8 }}>{controls}</div>}
      </div>
      {!isMobile && controls}
    </div>
  );
}

/** A past week's record: an item that was on that week's list but wasn't bought then — and what happened since. */
export function CarriedRow({ request: r, onRecord }: { request: PurchaseRequest; onRecord: () => void }) {
  return (
    <div style={{ ...rowStyle, alignItems: 'center' }}>
      <span style={{ width: CHECKBOX, height: CHECKBOX, borderRadius: 6, border: '2px dashed #cbd5e1', flexShrink: 0 }} />
      <RequestInfo request={r} extra={<span style={{ color: C.sub, fontWeight: 600 }}>{laterOutcome(r)}</span>} />
      <button className="tap" type="button" aria-label={`Record for ${r.item}`} title="Record" onClick={onRecord} style={{ ...btn('#fff', C.sub, true), border: `1px solid ${C.border}` }}>
        <FontAwesomeIcon icon={faClockRotateLeft} style={{ fontSize: 11 }} /> Record
      </button>
    </div>
  );
}

export function NotBuyingRow({ request: r, busy, onUndo, onRecord }: { request: PurchaseRequest; busy: boolean; onUndo: () => void; onRecord: () => void }) {
  return (
    <div style={{ ...rowStyle, alignItems: 'center', opacity: 0.85 }}>
      <span style={{ width: CHECKBOX, height: CHECKBOX, borderRadius: 6, flexShrink: 0, background: '#f1f5f9', color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FontAwesomeIcon icon={faBan} style={{ fontSize: 11 }} />
      </span>
      <RequestInfo request={r} extra={r.declineReason ? <span style={{ color: C.sub }}>“{r.declineReason}”</span> : null} />
      <ActionMenu groups={[[
        { icon: faClockRotateLeft, label: 'Note / record', onClick: onRecord, iconColor: C.primary },
        ...(busy ? [] : [{ icon: faRotateLeft, label: 'Put back on the list', onClick: onUndo, iconColor: C.muted }]),
      ]]} />
    </div>
  );
}

/** Item × quantity first; what for, who asked, tags, notes and shop link small underneath. */
function RequestInfo({ request: r, extra, crossedOut }: { request: PurchaseRequest; extra?: React.ReactNode; crossedOut?: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, textDecoration: crossedOut ? 'line-through' : 'none' }}>
        {r.item} <span style={{ fontWeight: 600, color: C.muted }}>× {r.quantity}</span>
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: '3px 8px', alignItems: 'center', lineHeight: 1.4 }}>
        <span>{r.purpose}</span>
        <span style={{ color: C.mutedSoft }}>· {r.requestedByName}</span>
        {extra}
      </div>
      {(r.note || r.link) && (
        <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4, lineHeight: 1.4, display: 'flex', flexWrap: 'wrap', gap: '2px 10px', alignItems: 'baseline' }}>
          {r.note && <span style={{ whiteSpace: 'pre-wrap' }}>{r.note}</span>}
          {r.link && (
            <a href={r.link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, color: C.primary, textDecoration: 'none' }}>
              <FontAwesomeIcon icon={faArrowUpRightFromSquare} style={{ fontSize: 10 }} /> Shop link
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/** "Waiting for approval" / "Approved" — only while still on the list. */
function StatusTag({ request: r }: { request: PurchaseRequest }) {
  if (r.status !== 'REQUESTED' && r.status !== 'APPROVED') return null;
  const waiting = r.status === 'REQUESTED';
  return (
    <span style={{ padding: '1px 7px', borderRadius: 6, fontWeight: 700, fontSize: 11, background: waiting ? C.amberSoft : C.primarySoft, color: waiting ? C.amber : '#4338ca' }}>
      {waiting ? 'Waiting for approval' : 'Approved'}
    </span>
  );
}

/** "Carried over · 2 weeks" — amber for 1 week, red from 2. Nothing for this week's requests. */
function CarriedTag({ createdAt }: { createdAt: string }) {
  const t = carriedTag(createdAt, weekStartOf(new Date()));
  if (t.level === 'none') return null;
  const look = CARRIED_LOOK[t.level];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 7px', borderRadius: 6, background: look.bg, color: look.fg, fontWeight: 700, fontSize: 11 }}>
      <FontAwesomeIcon icon={faClock} style={{ fontSize: 9.5 }} /> {t.label}
    </span>
  );
}

function SupervisorNote({ request: r }: { request: PurchaseRequest }) {
  if (!r.supervisorNote) return null;
  return (
    <div style={{ marginTop: 6, padding: '6px 9px', borderRadius: 8, background: '#fefce8', border: '1px solid #fef08a', fontSize: 12.5, color: '#713f12', lineHeight: 1.4 }}>
      <FontAwesomeIcon icon={faNoteSticky} style={{ fontSize: 10.5, marginRight: 6, color: '#ca8a04' }} />
      {r.supervisorNote}
      {r.supervisorNoteByName && <span style={{ color: '#a16207' }}> — {r.supervisorNoteByName}</span>}
    </div>
  );
}
