import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCopy, faIdCard, faUserCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
import { approveStaffJoin, fetchStaffJoins, joinFormUrl, rejectStaffJoin, type StaffJoinRequest, type StaffJoinStatus } from '../api/staffJoins.js';
import { HireDetailsModal } from './candidates/HireDetailsModal.js';
import ConfirmDialog from '../components/common/ConfirmDialog.js';
import { useToast } from '../components/common/Toast.js';

// HR → New Staff: people who joined without going through Recruitment fill
// in the public /join form; HR approves them onto the staff list (same
// details as Recruitment → Hire) or rejects the request.

const C = {
  bg: '#f8fafc', card: '#ffffff', text: '#0f172a', sub: '#334155', muted: '#64748b', soft: '#94a3b8',
  border: '#e2e8f0', primary: '#5a67d8', primarySoft: '#eef2ff', success: '#16a34a', successSoft: '#f0fdf4',
  danger: '#dc2626', dangerSoft: '#fef2f2', warning: '#d97706', warningSoft: '#fffbeb',
};
const QUERY_KEY = ['staff-joins'];
const COPIED_FLASH_MS = 2000;

const TABS: { key: StaffJoinStatus; label: string }[] = [
  { key: 'PENDING', label: 'Waiting' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
];

const fmtDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
  .toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });

export default function NewStaffPage() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { data: requests = [], isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: fetchStaffJoins });
  const [tab, setTab] = useState<StaffJoinStatus>('PENDING');
  const [approving, setApproving] = useState<StaffJoinRequest | null>(null);
  const [rejecting, setRejecting] = useState<StaffJoinRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectBusy, setRejectBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const shown = requests.filter(r => r.status === tab);
  const countOf = (s: StaffJoinStatus) => requests.filter(r => r.status === s).length;
  const formLink = joinFormUrl();

  const copyLink = () => {
    navigator.clipboard.writeText(formLink);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_FLASH_MS);
  };

  const confirmReject = async () => {
    if (!rejecting) return;
    setRejectBusy(true);
    try {
      await rejectStaffJoin(rejecting.id, rejectReason.trim() || undefined);
      showToast(`${rejecting.fullName}'s request rejected`);
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setRejecting(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not reject the request.');
    } finally {
      setRejectBusy(false);
    }
  };

  return (
    <div className="m-pad" style={s.page}>
      <div className="m-wrap" style={s.header}>
        <div>
          <h1 style={s.h1}>New Staff</h1>
          <p style={s.subtitle}>People who joined without applying through Recruitment. Approve to add them to the staff list.</p>
        </div>
        <button type="button" onClick={copyLink} style={s.linkBtn(copied)} title={formLink}>
          <FontAwesomeIcon icon={copied ? faCheck : faCopy} /> {copied ? 'Link copied' : 'Copy form link'}
        </button>
      </div>

      <div style={s.tabs} role="tablist">
        {TABS.map(t => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} style={s.tab(tab === t.key)}>
            {t.label}
            <span style={s.tabCount(tab === t.key, t.key === 'PENDING' && countOf('PENDING') > 0)}>{countOf(t.key)}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <p style={s.empty}>Loading…</p>
      ) : shown.length === 0 ? (
        <div style={s.emptyCard}>
          <FontAwesomeIcon icon={faIdCard} style={{ fontSize: 22, color: C.soft, marginBottom: 8 }} />
          <div>{tab === 'PENDING' ? 'Nobody waiting. Share the form link with new staff who didn\'t apply through Recruitment.' : 'Nothing here yet.'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown.map(r => (
            <RequestCard key={r.id} request={r} onApprove={() => setApproving(r)} onReject={() => { setRejectReason(''); setRejecting(r); }} />
          ))}
        </div>
      )}

      {approving && (
        <HireDetailsModal
          person={{ name: approving.fullName, phone: approving.phone }}
          actionLabel="Approve & add to staff"
          onConfirm={details => approveStaffJoin(approving.id, details).then(() => undefined)}
          onClose={() => setApproving(null)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: QUERY_KEY });
            qc.invalidateQueries({ queryKey: ['planner-teachers'] });
            qc.invalidateQueries({ queryKey: ['salary-teachers'] });
            setApproving(null);
          }}
        />
      )}

      {rejecting && (
        <ConfirmDialog
          title={`Reject ${rejecting.fullName}?`}
          message={
            <div>
              <p style={{ margin: '0 0 10px' }}>They won't be added to the staff list. You can note why (optional):</p>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} maxLength={500}
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 64, padding: 8, borderRadius: 8, border: `1px solid ${C.border}`, fontFamily: 'inherit', fontSize: 13 }} />
            </div>
          }
          confirmLabel="Reject"
          destructive
          loading={rejectBusy}
          onConfirm={confirmReject}
          onCancel={() => setRejecting(null)}
        />
      )}
    </div>
  );
}

function RequestCard({ request: r, onApprove, onReject }: { request: StaffJoinRequest; onApprove: () => void; onReject: () => void }) {
  return (
    <div style={s.card}>
      <div className="m-wrap" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{r.fullName}</div>
          <div style={{ fontSize: 12, color: C.soft, marginTop: 2 }}>Sent {fmtDate(r.createdAt)}</div>
        </div>
        {r.status === 'PENDING' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={onReject} style={s.rejectBtn}><FontAwesomeIcon icon={faXmark} /> Reject</button>
            <button type="button" onClick={onApprove} style={s.approveBtn}><FontAwesomeIcon icon={faUserCheck} /> Approve</button>
          </div>
        )}
      </div>

      <dl style={s.facts}>
        <Fact label="Phone" value={r.phone} />
        <Fact label="Date of birth" value={fmtDate(r.dob)} />
        <Fact label="Email" value={r.email} />
      </dl>
      {r.note && <p style={s.note}>{r.note}</p>}

      {r.status === 'APPROVED' && (
        <div style={s.outcome(C.success, C.successSoft)}>
          Added to staff{r.reviewedByName ? ` by ${r.reviewedByName}` : ''}{r.reviewedAt ? ` on ${fmtDate(r.reviewedAt)}` : ''}.
          {r.teacherId && <> <Link to={`/teachers/${r.teacherId}`} style={{ color: C.success, fontWeight: 700 }}>Open staff record</Link></>}
        </div>
      )}
      {r.status === 'REJECTED' && (
        <div style={s.outcome(C.danger, C.dangerSoft)}>
          Rejected{r.reviewedByName ? ` by ${r.reviewedByName}` : ''}{r.reviewedAt ? ` on ${fmtDate(r.reviewedAt)}` : ''}{r.rejectionReason ? ` — ${r.rejectionReason}` : '.'}
        </div>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <dt style={{ fontSize: 11, fontWeight: 600, color: C.soft, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</dt>
      <dd style={{ margin: '2px 0 0', fontSize: 13, color: C.sub, overflowWrap: 'anywhere' }}>{value}</dd>
    </div>
  );
}

const s = {
  page: { padding: '28px 32px', background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: C.text, maxWidth: 960, margin: '0 auto' } as React.CSSProperties,
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18 } as React.CSSProperties,
  h1: { fontSize: 22, fontWeight: 800, margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 13, color: C.muted, margin: '4px 0 0' } as React.CSSProperties,
  linkBtn: (done: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
    border: `1px solid ${done ? C.success : C.border}`, background: done ? C.successSoft : C.card, color: done ? C.success : C.sub, flexShrink: 0,
  }),
  tabs: { display: 'flex', gap: 4, padding: 4, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 14, width: 'fit-content', maxWidth: '100%', flexWrap: 'wrap' } as React.CSSProperties,
  tab: (on: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 13, fontWeight: on ? 700 : 500, borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    background: on ? C.primarySoft : 'transparent', color: on ? C.primary : C.muted,
  }),
  tabCount: (on: boolean, alert: boolean): React.CSSProperties => ({
    fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
    background: alert ? C.warning : on ? C.primary : '#f1f5f9', color: alert || on ? '#fff' : C.soft,
  }),
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px' } as React.CSSProperties,
  facts: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(150px, 100%), 1fr))', gap: '10px 16px', margin: '12px 0 0' } as React.CSSProperties,
  note: { margin: '10px 0 0', fontSize: 13, color: C.sub, background: C.bg, borderRadius: 8, padding: '8px 10px', whiteSpace: 'pre-wrap' } as React.CSSProperties,
  outcome: (fg: string, bg: string): React.CSSProperties => ({ marginTop: 12, fontSize: 13, color: fg, background: bg, borderRadius: 8, padding: '8px 10px' }),
  approveBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: 'none', background: C.success, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  rejectBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.muted, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  empty: { color: C.soft, fontSize: 14, padding: 24, textAlign: 'center' } as React.CSSProperties,
  emptyCard: { background: C.card, border: `1px dashed ${C.border}`, borderRadius: 12, padding: '32px 20px', textAlign: 'center', color: C.muted, fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center' } as React.CSSProperties,
};
