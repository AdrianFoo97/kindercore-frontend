import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faClipboardList, faUserPen, faClock } from '@fortawesome/free-solid-svg-icons';
import { fetchRevisions, SopRevisionStatus } from '../api/sop-revisions.js';
import { fetchTemplates } from '../api/sop-templates.js';

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eef0f4',
  text: '#0f172a',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
};
const RADIUS = 14;
const SHADOW = '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)';

const TABS: { key: SopRevisionStatus; label: string }[] = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// A plain, click-through list — no Approve/Reject here, and no expand-to-
// preview either. Every row's only action is "open the review page"
// (HrSopRevisionReviewPage.tsx, /hr/sop-revisions/:id), which is the only
// place those decisions can be made. A supervisor could previously approve
// or reject straight from this list without ever reading what changed;
// now they have to actually see the guide first, and can fix small things
// in the proposal there before approving instead of rejecting-and-asking-
// for-a-resubmit over something trivial.
// ─────────────────────────────────────────────────────────────────────────────
export default function HrSopRevisionsPage() {
  const navigate = useNavigate();

  const [tab, setTab] = useState<SopRevisionStatus>('PENDING');
  const { data: revisions = [], isLoading } = useQuery({
    queryKey: ['sop-revisions', tab],
    queryFn: () => fetchRevisions({ status: tab }),
  });
  const { data: templates = [] } = useQuery({ queryKey: ['sop-templates'], queryFn: () => fetchTemplates() });
  const templateById = useMemo(() => new Map(templates.map(t => [t.id, t])), [templates]);

  return (
    <div style={s.page}>
      <style>{`
        .hr-rev-tab:hover { color: ${C.text} !important; background: #f1f5f9 !important; }
        .hr-rev-row:hover { border-color: ${C.primary}55 !important; box-shadow: 0 1px 2px rgba(15,23,42,0.04), 0 4px 16px rgba(90,103,216,0.08) !important; }
      `}</style>
      <div style={s.inner}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={s.heading}>Improvement Inbox</h1>
          <p style={s.subheading}>
            Challenge before we decide, align after we decide. How-To Guide changes and new suggestions from the team, waiting for review before they become the current way.
          </p>
        </div>

        <div style={s.tabStrip}>
          {TABS.map(t => (
            <button
              key={t.key}
              className="hr-rev-tab"
              onClick={() => setTab(t.key)}
              style={{ ...s.tabBtn, ...(tab === t.key ? s.tabBtnActive : {}) }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p style={{ padding: 32, textAlign: 'center', color: C.mutedSoft }}>Loading…</p>
        ) : revisions.length === 0 ? (
          <div style={{ ...s.card, textAlign: 'center', padding: '48px 20px' }}>
            <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: 22, color: C.mutedSoft, marginBottom: 10 }} />
            <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
              {tab === 'PENDING' ? 'Nothing waiting on review.' : `No ${tab.toLowerCase()} suggestions.`}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {revisions.map(rev => {
              const target = rev.sopTemplateId ? templateById.get(rev.sopTemplateId) : null;
              const sections = [...new Set(rev.stepsJson.map(st => st.section))];

              return (
                <div
                  key={rev.id}
                  className="hr-rev-row"
                  onClick={() => navigate(`/hr/sop-revisions/${rev.id}`)}
                  style={{ ...s.card, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, cursor: 'pointer', transition: 'box-shadow 120ms ease, border-color 120ms ease' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const, marginBottom: 4 }}>
                      <span style={rev.sopTemplateId ? s.badgeEdit : s.badgeNew}>
                        {rev.sopTemplateId ? `Edit${target ? ` · v${target.currentVersion} → v${target.currentVersion + 1}` : ''}` : 'New How-To Guide'}
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{rev.title}</span>
                    </div>
                    {rev.sopTemplateId && target && rev.title !== target.title && (
                      <div style={{ fontSize: 12, color: C.mutedSoft, marginBottom: 4 }}>Currently: "{target.title}"</div>
                    )}
                    <div style={s.metaRow}>
                      <span style={s.metaItem}><FontAwesomeIcon icon={faUserPen} style={{ fontSize: 10.5 }} />{rev.proposedByName}</span>
                      <span style={s.metaDot} />
                      <span style={s.metaItem}><FontAwesomeIcon icon={faClock} style={{ fontSize: 10.5 }} />{fmtDate(rev.createdAt)}</span>
                      <span style={s.metaDot} />
                      <span style={s.metaItem}>{rev.stepsJson.length} step{rev.stepsJson.length === 1 ? '' : 's'} · {sections.length} section{sections.length === 1 ? '' : 's'}</span>
                    </div>
                    {rev.status !== 'PENDING' && rev.reviewedByName && (
                      <div style={{ fontSize: 11.5, color: C.mutedSoft, marginTop: 6 }}>
                        {rev.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {rev.reviewedByName}
                        {rev.reviewedAt ? ` on ${fmtDate(rev.reviewedAt)}` : ''}
                        {rev.reviewNote ? ` — "${rev.reviewNote}"` : ''}
                      </div>
                    )}
                  </div>
                  <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 13, color: C.mutedSoft, flexShrink: 0, marginTop: 4 }} />
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
    padding: '9px 16px', fontSize: 13, fontWeight: 600, color: C.muted, background: 'none',
    border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', marginBottom: -1,
  },
  tabBtnActive: { color: C.primary, borderBottom: `2px solid ${C.primary}` },
  card: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS,
    padding: '18px 22px', boxShadow: SHADOW,
  },
  badgeNew: {
    display: 'inline-flex', padding: '2px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 700,
    background: C.primarySoft, color: C.primary, textTransform: 'uppercase' as const, letterSpacing: '0.03em',
  },
  badgeEdit: {
    display: 'inline-flex', padding: '2px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 700,
    background: '#fff7ed', color: '#b45309', textTransform: 'uppercase' as const, letterSpacing: '0.03em',
  },
  metaRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' as const },
  metaItem: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: C.mutedSoft, fontWeight: 500 },
  metaDot: { width: 3, height: 3, borderRadius: '50%', background: C.mutedSoft, flexShrink: 0 },
};
