import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faLocationDot } from '@fortawesome/free-solid-svg-icons';
import { useIsMobile } from '../hooks/useIsMobile.js';
import {
  fetchMyIncidents, fmtIncidentDate, fmtIncidentTime, INCIDENT_STATUS_LABEL, IncidentStatus,
} from '../api/incidents.js';
import { TEACHER_CONTENT_TOP } from '../components/common/TeacherTopBar.js';
import TeacherFab, { TEACHER_FAB_CLEARANCE } from '../components/common/TeacherFab.js';
import SegmentedControl from '../components/common/SegmentedControl.js';

// Teacher app → My Incident Reports: what this teacher has filed and where
// each one stands (status only — the office's follow-up notes, comments and
// parent reactions stay with the office). Reached from Home.

const C = {
  bg: '#f8fafc', card: '#ffffff', cardBorder: '#eceef2', textStrong: '#334155', text: '#475569',
  muted: '#64748b', mutedSoft: '#64748b', pAccent: '#7c3aed',
};

const STATUS_LOOK: Record<IncidentStatus, { fg: string; bg: string }> = {
  OPEN: { fg: '#b91c1c', bg: '#fef2f2' },
  PARENT_INFORMED: { fg: '#b45309', bg: '#fffbeb' },
  RESOLVED: { fg: '#047857', bg: '#ecfdf5' },
};

/** Everything not yet resolved — Open and Parent informed. */
const ONGOING = 'ONGOING';
type StatusFilter = typeof ONGOING | 'RESOLVED';
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: ONGOING, label: 'Ongoing' },
  { key: 'RESOLVED', label: INCIDENT_STATUS_LABEL.RESOLVED },
];

const emptyCard: React.CSSProperties = { background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: 16 };
const emptyTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: C.textStrong };
const emptyBody: React.CSSProperties = { fontSize: 14, color: C.muted, marginTop: 4, lineHeight: 1.5 };
const retryBtn: React.CSSProperties = {
  marginTop: 12, minHeight: 34, padding: '0 14px', borderRadius: 999, border: 'none', background: '#f5f3ff',
  color: C.pAccent, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
};

export default function TeacherIncidentsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isMobile } = useIsMobile();
  const { data: reports = [], isLoading, isError, refetch } = useQuery({ queryKey: ['my-incidents'], queryFn: fetchMyIncidents });
  // Ongoing first — the reports not yet resolved, which the teacher is still waiting on.
  const [filter, setFilter] = useState<StatusFilter>(ONGOING);
  const matches = (status: IncidentStatus, f: StatusFilter) =>
    f === ONGOING ? status !== 'RESOLVED' : status === 'RESOLVED';
  const shown = reports.filter(r => matches(r.status, filter));

  return (
    <div style={{
      paddingTop: isMobile ? TEACHER_CONTENT_TOP : 28, paddingRight: isMobile ? 16 : 32,
      paddingBottom: isMobile ? 40 + TEACHER_FAB_CLEARANCE : 40, paddingLeft: isMobile ? 16 : 32, minHeight: '100vh',
      fontFamily: '"Nunito", "Segoe UI", Roboto, Arial, sans-serif', color: C.text, background: C.bg,
    }}>
      <div style={{ maxWidth: isMobile ? 640 : 560, margin: '0 auto' }}>
        {/* In-page title — the teacher top bar only shows its small
            title once scrolled (same pattern as Home). */}
        <h1 style={{
          margin: '0 0 16px', paddingLeft: 4, fontSize: isMobile ? 30 : 24, fontWeight: 800,
          color: C.textStrong, letterSpacing: '-0.02em',
        }}>
          Incident Log
        </h1>
        {/* Phone: the floating "+" above the nav. Wider screens: a full-width button here. */}
        {isMobile ? (
          <TeacherFab label="Report an Incident" onClick={() => navigate(`/teachers/${id}/incidents/new`)} />
        ) : (
          <button type="button" onClick={() => navigate(`/teachers/${id}/incidents/new`)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 14,
            border: 'none', borderRadius: 12, background: C.pAccent, color: '#fff', fontSize: 15, fontWeight: 700,
            fontFamily: 'inherit', cursor: 'pointer', marginBottom: 22,
          }}>
            <FontAwesomeIcon icon={faPlus} style={{ fontSize: 13 }} /> Report an Incident
          </button>
        )}

        <div style={{
          fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.09em', margin: '0 2px 8px',
        }}>
          My reports
        </div>

        {reports.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SegmentedControl<StatusFilter> ariaLabel="Show reports" accent={C.pAccent} value={filter} onChange={setFilter}
              segments={STATUS_FILTERS.map(f => ({ ...f, count: reports.filter(r => matches(r.status, f.key)).length }))} />
          </div>
        )}

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
            <div style={emptyTitle}>No incidents reported.</div>
            <div style={emptyBody}>If a child gets hurt, report it here straight away.</div>
          </div>
        ) : shown.length === 0 ? (
          <div style={emptyCard}>
            <div style={emptyTitle}>{filter === ONGOING ? 'Nothing ongoing — all resolved.' : 'Nothing resolved yet.'}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {shown.map(r => (
              <div key={r.id} style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.textStrong }}>
                      {[...r.students.map(s => s.childName), ...(r.otherChildren ? [r.otherChildren] : [])].join(', ')}
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: C.muted, marginTop: 2 }}>
                      {fmtIncidentDate(r.incidentDate)}, {fmtIncidentTime(r.incidentTime)}
                      <span style={{ margin: '0 6px' }}>·</span>
                      <FontAwesomeIcon icon={faLocationDot} style={{ fontSize: 10.5, marginRight: 4, color: C.mutedSoft }} />{r.location}
                    </div>
                  </div>
                  <span style={{
                    flexShrink: 0, padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 800,
                    color: STATUS_LOOK[r.status].fg, background: STATUS_LOOK[r.status].bg,
                  }}>{INCIDENT_STATUS_LABEL[r.status]}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
