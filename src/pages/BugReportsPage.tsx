import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBug, faCheck, faUser, faClock, faLocationDot, faCodeBranch,
} from '@fortawesome/free-solid-svg-icons';
import { fetchBugReports, resolveBugReport, BugReport, BugReportStatus } from '../api/bug-reports.js';
import { uploadUrl } from '../api/upload.js';
import { useToast } from '../components/common/Toast.js';

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eef0f4',
  divider: '#f1f5f9',
  text: '#0f172a',
  textSub: '#475569',
  textBody: '#52525b',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
  success: '#059669',
};
const RADIUS = 14;
const SHADOW = '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)';

const TABS: { key: BugReportStatus; label: string }[] = [
  { key: 'OPEN', label: 'Open' },
  { key: 'RESOLVED', label: 'Resolved' },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function BugReportsPage() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [tab, setTab] = useState<BugReportStatus>('OPEN');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['bug-reports'],
    queryFn: fetchBugReports,
  });
  const filtered = reports.filter(r => r.status === tab);
  const openCount = reports.filter(r => r.status === 'OPEN').length;

  const onResolve = async (report: BugReport) => {
    setResolvingId(report.id);
    try {
      await resolveBugReport(report.id);
      qc.invalidateQueries({ queryKey: ['bug-reports'] });
      showToast('Marked as resolved');
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to resolve', 'error');
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={s.heading}>Bug Reports</h1>
          <p style={s.subheading}>
            Issues submitted from the teacher app's Settings page — what happened, where, and who to ask if it needs more detail.
          </p>
        </div>

        <div style={s.tabStrip}>
          {TABS.map(t => (
            <button
              key={t.key}
              className="bug-report-tab"
              onClick={() => setTab(t.key)}
              style={{ ...s.tabBtn, ...(tab === t.key ? s.tabBtnActive : {}) }}
            >
              {t.label}
              {t.key === 'OPEN' && openCount > 0 && (
                <span style={s.tabCount}>{openCount}</span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p style={{ padding: 32, textAlign: 'center', color: C.mutedSoft }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <div style={{ ...s.card, textAlign: 'center', padding: '48px 20px' }}>
            <FontAwesomeIcon icon={faBug} style={{ fontSize: 22, color: C.mutedSoft, marginBottom: 10 }} />
            <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
              {tab === 'OPEN' ? 'Nothing open — all caught up.' : 'No resolved reports yet.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(report => {
              const isResolving = resolvingId === report.id;
              return (
                <div key={report.id} style={s.card}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const }}>
                    <p style={{ margin: 0, flex: 1, minWidth: 240, fontSize: 13.5, color: C.text, lineHeight: 1.6, whiteSpace: 'pre-line' as const }}>
                      {report.message}
                    </p>
                    {report.status === 'OPEN' && (
                      <button onClick={() => onResolve(report)} disabled={isResolving} style={s.resolveBtn}>
                        <FontAwesomeIcon icon={faCheck} style={{ marginRight: 5 }} />
                        {isResolving ? 'Resolving…' : 'Mark Resolved'}
                      </button>
                    )}
                  </div>
                  {report.photoUrls && report.photoUrls.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginTop: 12 }}>
                      {report.photoUrls.map(url => (
                        <a key={url} href={uploadUrl(url)} target="_blank" rel="noopener noreferrer">
                          <img
                            src={uploadUrl(url)}
                            alt="Attached screenshot"
                            style={{
                              width: 64, height: 64, borderRadius: 10, objectFit: 'cover',
                              border: `1px solid ${C.cardBorder}`,
                            }}
                          />
                        </a>
                      ))}
                    </div>
                  )}
                  <div style={s.metaRow}>
                    <span style={s.metaItem}>
                      <FontAwesomeIcon icon={faUser} style={{ fontSize: 10.5 }} />
                      {report.reportedByName}
                    </span>
                    <span style={s.metaDot} />
                    <span style={s.metaItem}>
                      <FontAwesomeIcon icon={faClock} style={{ fontSize: 10.5 }} />
                      {fmtDate(report.createdAt)}
                    </span>
                    {report.pageUrl && (
                      <>
                        <span style={s.metaDot} />
                        <span style={s.metaItem}>
                          <FontAwesomeIcon icon={faLocationDot} style={{ fontSize: 10.5 }} />
                          {report.pageUrl}
                        </span>
                      </>
                    )}
                    {report.appVersion && (
                      <>
                        <span style={s.metaDot} />
                        <span style={s.metaItem}>
                          <FontAwesomeIcon icon={faCodeBranch} style={{ fontSize: 10.5 }} />
                          v{report.appVersion}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', background: C.bg, minHeight: '100vh', color: C.text },
  inner: { maxWidth: 900, margin: '0 auto' },
  heading: { margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' },
  subheading: { margin: 0, fontSize: 13, color: C.muted, maxWidth: 640, lineHeight: 1.5 },
  tabStrip: { display: 'flex', gap: 2, borderBottom: `1px solid ${C.cardBorder}`, marginBottom: 20 },
  tabBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 16px', fontSize: 13, fontWeight: 600, color: C.muted, background: 'none',
    border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', marginBottom: -1,
  },
  tabBtnActive: { color: C.primary, borderBottom: `2px solid ${C.primary}` },
  tabCount: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999,
    background: C.primarySoft, color: C.primary, fontSize: 10.5, fontWeight: 700,
  },
  card: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS,
    padding: '18px 22px', boxShadow: SHADOW,
  },
  metaRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.divider}`, flexWrap: 'wrap' as const },
  metaItem: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: C.mutedSoft, fontWeight: 500 },
  metaDot: { width: 3, height: 3, borderRadius: '50%', background: C.mutedSoft, flexShrink: 0 },
  resolveBtn: {
    padding: '7px 14px', borderRadius: 8, border: 'none', background: C.success,
    color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
  },
};
