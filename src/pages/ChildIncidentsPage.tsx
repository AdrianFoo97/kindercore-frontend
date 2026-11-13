import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faChevronRight, faLocationDot, faUser } from '@fortawesome/free-solid-svg-icons';
import {
  fetchIncidents, fmtIncidentDate, fmtIncidentTime, latestParentReaction, IncidentReport, ParentReaction,
} from '../api/incidents.js';
import IncidentStatusPill from '../components/incidents/IncidentStatusPill.js';
import ParentReactionPill, { PARENT_REACTION_LOOK } from '../components/incidents/ParentReactionPill.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { useGoBack } from '../hooks/useGoBack.js';

// Operation → Incidents → one child's whole incident history (managers).
// Reached from "Incident history" on an incident page. Shows how often the
// child has been involved and how the parent took each one, so a parent
// growing unhappy over repeat incidents is easy to see.

const C = {
  bg: '#f8fafc', card: '#ffffff', border: '#e2e8f0', divider: '#f1f5f9',
  text: '#0f172a', textSub: '#334155', muted: '#64748b', mutedSoft: '#64748b',
  primary: '#5a67d8', primarySoft: '#eef2ff',
};

const DAY = 24 * 60 * 60 * 1000;
const sinceDays = (days: number) => new Date(Date.now() - days * DAY).toISOString().slice(0, 10);

export default function ChildIncidentsPage() {
  const { studentId } = useParams<{ studentId: string }>();
  // Back to the report this was opened from; a cold deep link goes to the list.
  const goBack = useGoBack('/operations/incidents');
  const { isMobile } = useIsMobile();
  // Same list (and cache) as the Incidents page.
  const { data: reports = [], isLoading, error } = useQuery({ queryKey: ['incidents'], queryFn: fetchIncidents });

  const theirs = reports
    .filter(r => r.students.some(s => s.studentId === studentId))
    .sort((a, b) => `${b.incidentDate} ${b.incidentTime}`.localeCompare(`${a.incidentDate} ${a.incidentTime}`));
  // Name as on the most recent report.
  const name = theirs[0]?.students.find(s => s.studentId === studentId)?.childName ?? 'This child';
  const last30 = theirs.filter(r => r.incidentDate >= sinceDays(30)).length;
  const last90 = theirs.filter(r => r.incidentDate >= sinceDays(90)).length;
  // Parent's reactions, oldest → newest, one per incident that has one.
  const reactions = [...theirs].reverse()
    .map(r => ({ id: r.id, date: r.incidentDate, reaction: latestParentReaction(r) }))
    .filter((x): x is { id: string; date: string; reaction: ParentReaction } => !!x.reaction);

  return (
    <div style={{
      padding: isMobile ? '14px 16px 32px' : '16px 32px 40px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      background: C.bg, minHeight: '100%', color: C.text,
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <button className="back-btn" onClick={goBack} style={st.back}>
          <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 11 }} /> Back
        </button>

        {isLoading ? (
          <div style={st.empty}>Loading…</div>
        ) : error ? (
          <div style={st.empty}>Couldn’t load incidents. {(error as Error).message}</div>
        ) : theirs.length === 0 ? (
          <div style={st.empty}>No incidents on record for this child.</div>
        ) : (
          <>
            {/* ── Overview ── */}
            <section style={st.card}>
              <div style={st.eyebrow}>Incident history</div>
              <h1 style={{ margin: '0 0 14px', fontSize: 22, fontWeight: 700 }}>{name}</h1>
              <div style={st.stats}>
                <Stat value={theirs.length} label="incidents in total" />
                <Stat value={last90} label="in the last 90 days" warn={last90 >= 3} />
                <Stat value={last30} label="in the last 30 days" warn={last30 >= 2} />
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={st.label}>How the parent took each one (oldest → newest)</div>
                {reactions.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.mutedSoft }}>No reactions recorded yet.</div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {reactions.map((x, i) => {
                      const l = PARENT_REACTION_LOOK[x.reaction];
                      return (
                        <span key={x.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {i > 0 && <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />}
                          <Link to={`/operations/incidents/${x.id}`} title={`${fmtIncidentDate(x.date)} — ${x.reaction.toLowerCase()}`}
                            style={{ ...st.face, color: l.fg, background: l.bg, borderColor: l.border }}>
                            <FontAwesomeIcon icon={l.icon} style={{ fontSize: 15 }} />
                          </Link>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* ── Every incident, newest first ── */}
            <div style={{ ...st.label, margin: '20px 2px 10px' }}>All incidents ({theirs.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {theirs.map(r => <IncidentCard key={r.id} report={r} studentId={studentId!} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label, warn }: { value: number; label: string; warn?: boolean }) {
  return (
    <div style={{ ...st.stat, ...(warn ? { background: '#fffbeb', borderColor: '#fde68a' } : {}) }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: warn ? '#b45309' : C.text, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 12, color: C.muted }}>{label}</div>
    </div>
  );
}

function IncidentCard({ report: r, studentId }: { report: IncidentReport; studentId: string }) {
  const reaction = latestParentReaction(r);
  // Others involved alongside this child, if any.
  const others = [...r.students.filter(s => s.studentId !== studentId).map(s => s.childName), ...(r.otherChildren ? [r.otherChildren] : [])];
  const comments = r.log.filter(l => l.kind === 'NOTE' || (l.kind !== 'EDIT' && l.body)).length;
  return (
    <Link to={`/operations/incidents/${r.id}`} className="incident-row" style={st.incident}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{fmtIncidentDate(r.incidentDate)}, {fmtIncidentTime(r.incidentTime)}</span>
        <span style={{ fontSize: 12.5, color: C.muted }}><FontAwesomeIcon icon={faLocationDot} style={st.icon} />{r.location}</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          {reaction && <ParentReactionPill reaction={reaction} />}
          <IncidentStatusPill status={r.status} />
        </span>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 14, color: C.textSub, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.description}</p>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8, fontSize: 12, color: C.muted }}>
        <span><FontAwesomeIcon icon={faUser} style={st.icon} />Reported by {r.reportedByName}</span>
        {others.length > 0 && <span>With {others.join(', ')}</span>}
        <span>{comments === 0 ? 'No follow-up comments' : `${comments} follow-up ${comments === 1 ? 'comment' : 'comments'}`}</span>
      </div>
    </Link>
  );
}

const st = {
  back: {
    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: C.muted,
    background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10,
  } as React.CSSProperties,
  empty: { padding: 32, textAlign: 'center', color: C.muted, fontSize: 13, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12 } as React.CSSProperties,
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 22px' } as React.CSSProperties,
  eyebrow: { fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 } as React.CSSProperties,
  label: { fontSize: 11, fontWeight: 700, color: C.mutedSoft, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 } as React.CSSProperties,
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 } as React.CSSProperties,
  stat: { padding: '10px 14px', borderRadius: 10, background: '#f8fafc', border: `1px solid ${C.divider}` } as React.CSSProperties,
  face: {
    width: 32, height: 32, borderRadius: 9, border: '1px solid', display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', textDecoration: 'none',
  } as React.CSSProperties,
  incident: {
    display: 'block', padding: '14px 18px', borderRadius: 12, background: C.card, border: `1px solid ${C.border}`,
    textDecoration: 'none', color: 'inherit',
  } as React.CSSProperties,
  icon: { fontSize: 10.5, color: C.mutedSoft, marginRight: 5 },
};
