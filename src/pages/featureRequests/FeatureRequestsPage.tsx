import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faClock, faCodeBranch, faLightbulb, faLocationDot, faUser } from '@fortawesome/free-solid-svg-icons';
import { fetchFeatureRequests, reviewFeatureRequest, type FeatureRequest, type FeatureRequestStatus } from '../../api/feature-requests.js';
import { useToast } from '../../components/common/Toast.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.js';

// Tools → Feature requests: the ideas staff send from the ⋯ menu. Read them,
// mark each one reviewed. The sender isn't told — they only got "sent".

const C = {
  bg: '#f8fafc', card: '#ffffff', cardBorder: '#eef0f4', divider: '#f1f5f9',
  text: '#0f172a', muted: '#64748b', primary: '#5a67d8', primarySoft: '#eef2ff',
};

const TABS: { key: FeatureRequestStatus; label: string }[] = [
  { key: 'NEW', label: 'New' },
  { key: 'REVIEWED', label: 'Reviewed' },
];

const QUERY_KEY = ['feature-requests'];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function FeatureRequestsPage() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [tab, setTab] = useState<FeatureRequestStatus>('NEW');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const { data: requests = [], isLoading, isError, refetch } = useQuery({ queryKey: QUERY_KEY, queryFn: fetchFeatureRequests });
  const shown = requests.filter(r => r.status === tab);
  const newCount = requests.filter(r => r.status === 'NEW').length;

  const markReviewed = async (r: FeatureRequest) => {
    setReviewingId(r.id);
    try {
      await reviewFeatureRequest(r.id);
      await qc.invalidateQueries({ queryKey: QUERY_KEY });
      showToast('Marked reviewed');
    } catch (e: any) {
      showToast(e?.message ?? 'Couldn’t mark it reviewed', 'error');
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="m-pad" style={s.page}>
      <div style={s.inner}>
        <h1 style={s.heading}>Feature Requests</h1>

        <div role="tablist" style={s.tabStrip}>
          {TABS.map(t => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              style={{ ...s.tabBtn, ...(tab === t.key ? s.tabBtnActive : {}) }}>
              {t.label}
              {t.key === 'NEW' && newCount > 0 && <span style={s.tabCount}>{newCount}</span>}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div style={{ padding: 32, textAlign: 'center' }}><LoadingSpinner /></div>
        ) : isError ? (
          <div style={{ ...s.card, ...s.empty }}>
            <p style={s.emptyText}>Couldn’t load feature requests.</p>
            <button onClick={() => refetch()} style={{ ...s.actionBtn, marginTop: 12 }}>Retry</button>
          </div>
        ) : shown.length === 0 ? (
          <div style={{ ...s.card, ...s.empty }}>
            <FontAwesomeIcon icon={faLightbulb} style={{ fontSize: 22, color: C.muted, marginBottom: 8 }} />
            <p style={s.emptyText}>{tab === 'NEW' ? 'No new requests.' : 'Nothing reviewed yet.'}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {shown.map(r => (
              <RequestCard key={r.id} request={r} reviewing={reviewingId === r.id} onReview={() => markReviewed(r)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RequestCard({ request: r, reviewing, onReview }: { request: FeatureRequest; reviewing: boolean; onReview: () => void }) {
  return (
    <div style={s.card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 14.5, fontWeight: 700, color: C.text, overflowWrap: 'anywhere' }}>{r.title}</h3>
          <p style={{ margin: 0, fontSize: 13.5, color: C.text, lineHeight: 1.6, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{r.message}</p>
        </div>
        {r.status === 'NEW' && (
          <button onClick={onReview} disabled={reviewing} style={{ ...s.actionBtn, cursor: reviewing ? 'default' : 'pointer', opacity: reviewing ? 0.6 : 1 }}>
            <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />
            {reviewing ? 'Saving…' : 'Mark Reviewed'}
          </button>
        )}
      </div>
      <div style={s.metaRow}>
        <Meta icon={faUser}>{r.requestedByName}</Meta>
        <Meta icon={faClock}>{fmtDate(r.createdAt)}</Meta>
        {r.pageUrl && <Meta icon={faLocationDot}>{r.pageUrl}</Meta>}
        {r.appVersion && <Meta icon={faCodeBranch}>v{r.appVersion}</Meta>}
      </div>
    </div>
  );
}

function Meta({ icon, children }: { icon: typeof faUser; children: React.ReactNode }) {
  return (
    <span style={s.metaItem}>
      <FontAwesomeIcon icon={icon} style={{ fontSize: 10.5 }} />
      {children}
    </span>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '24px 32px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', background: C.bg, minHeight: '100vh', color: C.text },
  inner: { maxWidth: 900, margin: '0 auto' },
  heading: { margin: '0 0 24px', fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' },
  tabStrip: { display: 'flex', gap: 2, borderBottom: `1px solid ${C.cardBorder}`, marginBottom: 16 },
  tabBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '8px 16px', fontSize: 13, fontWeight: 600,
    color: C.muted, background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', marginBottom: -1,
  },
  tabBtnActive: { color: C.primary, borderBottom: `2px solid ${C.primary}` },
  tabCount: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, padding: '0 6px',
    borderRadius: 999, background: C.primarySoft, color: C.primary, fontSize: 11, fontWeight: 700,
  },
  card: { background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 14, padding: '16px 24px' },
  empty: { textAlign: 'center', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  emptyText: { margin: 0, fontSize: 13, color: C.muted },
  metaRow: { display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.divider}`, flexWrap: 'wrap' },
  metaItem: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: C.muted, fontWeight: 500, overflowWrap: 'anywhere' },
  actionBtn: {
    display: 'inline-flex', alignItems: 'center', minHeight: 32, padding: '8px 16px', borderRadius: 8, border: 'none',
    background: C.primary, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit',
  },
};
