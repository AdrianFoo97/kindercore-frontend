import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faLocationDot, faPlus } from '@fortawesome/free-solid-svg-icons';
import { fetchMyFacilityIssues, type FacilityIssue, type FacilityStatus } from '../../api/facilityIssues.js';
import { TEACHER_CONTENT_TOP } from '../../components/common/TeacherTopBar.js';
import TeacherFab, { TEACHER_FAB_CLEARANCE } from '../../components/common/TeacherFab.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { FACILITY_STATUS_LABEL, ageLabel, sortForQueue } from './facilityDisplay.js';
import { CATEGORY_ICON, STATUS_LOOK } from './facilityLook.js';
import FacilityAttachments from './FacilityAttachments.js';

// Teacher app → Facilities: report something broken (door, leaking pipe…)
// and see where each of your reports stands, with the office's latest note.
// Reached from Home's quick actions.

const C = {
  bg: '#f8fafc', card: '#ffffff', cardBorder: '#eceef2', textStrong: '#334155', text: '#475569',
  muted: '#64748b', mutedSoft: '#64748b', pAccent: '#7c3aed', pSoft: '#f5f3ff',
};

const STATUSES: FacilityStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];
/** Shown on arrival — what's still being dealt with. */
const DEFAULT_STATUSES: FacilityStatus[] = ['OPEN', 'IN_PROGRESS'];

export default function TeacherFacilitiesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isMobile } = useIsMobile();
  const { data: reports = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['my-facility-issues'], queryFn: fetchMyFacilityIssues,
    // The office moves these from another device — always reload when opened or when the app comes back to the front.
    refetchOnMount: 'always', refetchOnWindowFocus: 'always',
  });
  const [shownStatuses, setShownStatuses] = useState<FacilityStatus[]>(DEFAULT_STATUSES);
  const toggle = (s: FacilityStatus) => setShownStatuses(cur => (cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s]));
  const shown = sortForQueue(reports.filter(r => shownStatuses.includes(r.status)));

  return (
    <div style={{
      paddingTop: isMobile ? TEACHER_CONTENT_TOP : 28, paddingRight: isMobile ? 16 : 32,
      paddingBottom: isMobile ? 40 + TEACHER_FAB_CLEARANCE : 40, paddingLeft: isMobile ? 16 : 32, minHeight: '100vh',
      fontFamily: '"Nunito", "Segoe UI", Roboto, Arial, sans-serif', color: C.text, background: C.bg,
    }}>
      <div style={{ maxWidth: isMobile ? 640 : 560, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 16px', paddingLeft: 4, fontSize: isMobile ? 30 : 24, fontWeight: 800, color: C.textStrong, letterSpacing: '-0.02em' }}>
          Facilities
        </h1>
        {/* Phone: the floating "+" above the nav. Wider screens: a full-width button here. */}
        {isMobile ? (
          <TeacherFab label="Report a Facility Issue" onClick={() => navigate(`/teachers/${id}/facilities/new`)} />
        ) : (
          <button type="button" onClick={() => navigate(`/teachers/${id}/facilities/new`)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 14,
            border: 'none', borderRadius: 12, background: C.pAccent, color: '#fff', fontSize: 15, fontWeight: 700,
            fontFamily: 'inherit', cursor: 'pointer', marginBottom: 22,
          }}>
            <FontAwesomeIcon icon={faPlus} style={{ fontSize: 13 }} /> Report a Facility Issue
          </button>
        )}

        <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.09em', margin: '0 2px 8px' }}>
          My reports
        </div>

        {/* States in order: loading → error (retry) → empty → content. */}
        {isLoading ? (
          <div style={{ fontSize: 14, color: C.muted, padding: '12px 2px' }}>Loading…</div>
        ) : isError ? (
          <div style={emptyCard}>
            <div style={emptyTitle}>Couldn’t load your reports.</div>
            <button type="button" className="tap" onClick={() => refetch()} style={retryBtn}>Try again</button>
          </div>
        ) : reports.length === 0 ? (
          <div style={emptyCard}>
            <div style={emptyTitle}>Nothing reported yet.</div>
            <div style={emptyBody}>Report anything broken or unsafe — a door, a leak, the aircon.</div>
          </div>
        ) : (
          <>
            {/* Status filter — several can be on at once (toggle chips, each with a ✓ when on — not colour alone). */}
            <div role="group" aria-label="Show statuses" style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', scrollbarWidth: 'none', padding: '4px 0' }}>
              {STATUSES.map(status => {
                const on = shownStatuses.includes(status);
                const look = STATUS_LOOK[status];
                return (
                  <button key={status} type="button" aria-pressed={on} onClick={() => toggle(status)} className="tap" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, minHeight: 36, padding: '0 12px', borderRadius: 999,
                    fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                    border: `1.5px solid ${on ? look.fg : C.cardBorder}`, background: on ? look.bg : C.card, color: on ? look.fg : C.muted,
                    WebkitTapHighlightColor: 'transparent',
                  }}>
                    {on && <FontAwesomeIcon icon={faCheck} style={{ fontSize: 11 }} />}
                    {FACILITY_STATUS_LABEL[status]}
                    <span style={{ fontSize: 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{reports.filter(r => r.status === status).length}</span>
                  </button>
                );
              })}
            </div>
            {shown.length === 0 ? (
              <div style={emptyCard}>
                <div style={emptyTitle}>{shownStatuses.length === 0 ? 'No statuses selected.' : 'No reports match these filters.'}</div>
                <div style={emptyBody}>{shownStatuses.length === 0 ? 'Pick a status above to see your reports.' : 'Tap another status above to see the rest.'}</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {shown.map(r => <ReportCard key={r.id} report={r} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const emptyCard: React.CSSProperties = { background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: 16 };
const emptyTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: C.textStrong };
const emptyBody: React.CSSProperties = { fontSize: 14, color: C.muted, marginTop: 4, lineHeight: 1.5 };
const retryBtn: React.CSSProperties = {
  marginTop: 12, minHeight: 34, padding: '0 14px', borderRadius: 999, border: 'none', background: C.pSoft,
  color: C.pAccent, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
};

function ReportCard({ report: r }: { report: FacilityIssue }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: '14px 16px', opacity: r.status === 'RESOLVED' ? 0.85 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.pSoft, color: C.pAccent, fontSize: 14 }}>
          <FontAwesomeIcon icon={CATEGORY_ICON[r.category]} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.textStrong }}>{r.title}</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: C.muted, marginTop: 2 }}>
            <FontAwesomeIcon icon={faLocationDot} style={{ fontSize: 10.5, marginRight: 4, color: C.mutedSoft }} />{r.location}
            <span style={{ margin: '0 6px' }}>·</span>{ageLabel(r.createdAt)}
          </div>
        </div>
      </div>
      {!!r.attachments?.length && <FacilityAttachments issueId={r.id} attachments={r.attachments} />}
      {r.statusNote && (
        <div style={{ marginTop: 10, padding: '8px 11px', borderRadius: 10, background: '#f8fafc', fontSize: 13, color: C.textStrong, lineHeight: 1.45 }}>
          {r.statusNote}
        </div>
      )}
    </div>
  );
}
