import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faLocationDot } from '@fortawesome/free-solid-svg-icons';
import { useIsMobile } from '../hooks/useIsMobile.js';
import {
  fetchMyIncidents, fmtIncidentDate, fmtIncidentTime, fmtLogTime, INCIDENT_STATUS_LABEL, PARENT_REACTION_LABEL, IncidentStatus,
} from '../api/incidents.js';
import { PARENT_REACTION_LOOK } from '../components/incidents/ParentReactionPill.js';
import { TEACHER_CONTENT_TOP } from '../components/common/TeacherTopBar.js';

// Teacher app → My Incident Reports: what this teacher has filed and how
// the office is following each one up. Reached from Home.

const C = {
  bg: '#f8fafc', card: '#ffffff', cardBorder: '#eceef2', textStrong: '#334155', text: '#475569',
  muted: '#64748b', mutedSoft: '#94a3b8', pAccent: '#7c3aed',
};

const STATUS_LOOK: Record<IncidentStatus, { fg: string; bg: string }> = {
  OPEN: { fg: '#b91c1c', bg: '#fef2f2' },
  PARENT_INFORMED: { fg: '#b45309', bg: '#fffbeb' },
  RESOLVED: { fg: '#047857', bg: '#ecfdf5' },
};

export default function TeacherIncidentsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isMobile } = useIsMobile();
  const { data: reports = [], isLoading } = useQuery({ queryKey: ['my-incidents'], queryFn: fetchMyIncidents });

  return (
    <div style={{
      paddingTop: isMobile ? TEACHER_CONTENT_TOP : 28, paddingRight: isMobile ? 16 : 32,
      paddingBottom: 40, paddingLeft: isMobile ? 16 : 32, minHeight: '100vh',
      fontFamily: '"Nunito", "Segoe UI", Roboto, Arial, sans-serif', color: C.text, background: C.bg,
    }}>
      <div style={{ maxWidth: isMobile ? 640 : 560, margin: '0 auto' }}>
        {/* In-page title — the teacher top bar only shows its small
            title once scrolled (same pattern as Home). */}
        <h1 style={{
          margin: '0 0 16px', paddingLeft: 4, fontSize: isMobile ? 30 : 24, fontWeight: 800,
          color: C.textStrong, letterSpacing: '-0.02em',
        }}>
          Incidents
        </h1>
        <button type="button" onClick={() => navigate(`/teachers/${id}/incidents/new`)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 14,
          border: 'none', borderRadius: 12, background: C.pAccent, color: '#fff', fontSize: 15, fontWeight: 700,
          fontFamily: 'inherit', cursor: 'pointer', marginBottom: 22,
        }}>
          <FontAwesomeIcon icon={faPlus} style={{ fontSize: 13 }} /> Report an Incident
        </button>

        <div style={{
          fontSize: 10.5, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.09em', margin: '0 2px 8px',
        }}>
          My reports
        </div>

        {isLoading ? (
          <div style={{ fontSize: 13.5, color: C.muted, padding: '12px 2px' }}>Loading…</div>
        ) : reports.length === 0 ? (
          <div style={{
            background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: 18,
            fontSize: 13.5, color: C.muted, lineHeight: 1.55,
          }}>
            You haven’t reported any incidents. If a child gets hurt or something goes wrong, report it here.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reports.map(r => (
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
                <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.description}</p>
                {/* How the office is handling it — comments and status
                    moves from the follow-up log, newest first. */}
                {r.log.some(l => l.kind !== 'EDIT') && (
                  <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[...r.log].reverse().filter(l => l.kind !== 'EDIT').map(l => (
                      <div key={l.id} style={{ fontSize: 13, lineHeight: 1.5 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: C.muted }}>
                          {l.authorName} · {fmtLogTime(l.createdAt)}
                          {l.kind === 'STATUS' && l.statusTo && (
                            <span style={{ color: STATUS_LOOK[l.statusTo].fg }}> · {INCIDENT_STATUS_LABEL[l.statusTo]}</span>
                          )}
                          {l.parentReaction && (
                            <span style={{ color: PARENT_REACTION_LOOK[l.parentReaction].fg }}> · Parent {PARENT_REACTION_LABEL[l.parentReaction].toLowerCase()}</span>
                          )}
                        </div>
                        {l.body && <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{l.body}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
