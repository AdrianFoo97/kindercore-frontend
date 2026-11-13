import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft, faCalendarDays, faCheck, faChevronRight, faClockRotateLeft, faComment, faFaceSmile, faFileLines, faFlag, faKitMedical,
  faLocationDot, faPen, faTriangleExclamation, faUser,
} from '@fortawesome/free-solid-svg-icons';
import {
  addIncidentLog, fetchIncidents, fetchMyIncidents, fmtIncidentDate, fmtIncidentTime, fmtLogTime, incidentChildren,
  latestParentReaction, INCIDENT_MANAGE_VIEW, INCIDENT_STATUS_LABEL, PARENT_REACTIONS, PARENT_REACTION_LABEL,
  IncidentLogEntry, IncidentReport, IncidentStatus, ParentReaction,
} from '../api/incidents.js';
import IncidentStatusPill, { INCIDENT_STATUSES, INCIDENT_STATUS_LOOK } from '../components/incidents/IncidentStatusPill.js';
import ParentReactionPill, { PARENT_REACTION_LOOK } from '../components/incidents/ParentReactionPill.js';
import { useToast } from '../components/common/Toast.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { usePermissions } from '../hooks/usePermissions.js';
import { useGoBack } from '../hooks/useGoBack.js';

// Operation → Incidents → one report, as its own page.
//
//   Left column:
//     Summary ─ who was involved, when, where, who reported it, and a
//               progress track: Open → Parent informed → Resolved
//     Report  ─ what happened / immediate actions, as filed
//   Right column (sticky):
//     Follow-up log ─ every comment, status move and correction,
//                     newest first; managers write at the top
//
// Incident managers also get Edit details and the add-to-log box (a
// comment, a status move, or both); everyone else reads only. ?comment=1
// (the list's "Log" button) puts the cursor straight in the comment box.

const C = {
  bg: '#f8fafc', card: '#ffffff', border: '#e2e8f0', divider: '#f1f5f9',
  text: '#0f172a', textSub: '#334155', muted: '#64748b', mutedSoft: '#64748b',
  primary: '#5a67d8', primarySoft: '#eef2ff',
};

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const { isMobile } = useIsMobile();
  const { hasView, loading: permsLoading } = usePermissions();
  const canManage = hasView(INCIDENT_MANAGE_VIEW);

  // Same lists (and cache keys) as the Incidents page, so opening a report
  // from there is instant and an update here refreshes the list too.
  const { data: reports, isLoading, error } = useQuery({
    queryKey: canManage ? ['incidents'] : ['my-incidents'],
    queryFn: canManage ? fetchIncidents : fetchMyIncidents,
    enabled: !permsLoading,
  });
  const report = reports?.find(r => r.id === id) ?? null;
  // Real back — to the list (tab and search intact) or a child's history,
  // wherever this was opened from.
  const goBack = useGoBack('/operations/incidents');

  return (
    <div style={st.page(isMobile)}>
      <div style={st.inner}>
        <button className="back-btn" type="button" onClick={goBack} style={st.back}>
          <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 11 }} /> Back
        </button>

        {permsLoading || isLoading ? (
          <div style={st.empty}>Loading the report…</div>
        ) : error ? (
          <div style={st.empty}>Couldn’t load the report. {(error as Error).message}</div>
        ) : !report ? (
          <div style={st.empty}>This report doesn’t exist, or isn’t one you can see.</div>
        ) : (
          <>
            <div style={st.grid(!isMobile)}>
              {/* Left: summary + the report, one column; right: the log. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
                <Summary report={report} canManage={canManage} />
                <ReportCard report={report} />
                {/* Managers see every report, so they can see each child's history. */}
                {canManage && reports && report.students.length > 0 && <ChildHistory report={report} all={reports} />}
              </div>
              <section style={st.logCard(!isMobile)} aria-label="Follow-up log">
                <div style={st.cardHead}>
                  <span>Follow-up log</span>
                  <span style={st.count}>{report.log.length}</span>
                </div>
                {/* Write at the top, newest entry right under it. */}
                {canManage
                  ? <Composer report={report} autoFocus={params.get('comment') === '1'} />
                  : <div style={st.readOnlyNote}>A supervisor follows this up — their notes appear here.</div>}
                <LogList report={report} scrolls={!isMobile} />
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** '3 h ago' / '2 days ago' — how long a report has been around. */
function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** Who, when, where, who reported it — and how far along the follow-up is. */
function Summary({ report: r, canManage }: { report: IncidentReport; canManage: boolean }) {
  return (
    <section style={st.summary} aria-label="Summary">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ ...st.eyebrow, flex: 1, minWidth: 0 }}>
          Incident report <span style={{ color: C.mutedSoft, fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>· reported {ago(r.createdAt)}</span>
        </div>
        {/* fromReport: saving then goes back here instead of stacking a second copy. */}
        {canManage && (
          <Link to={`/operations/incidents/${r.id}/edit`} state={{ fromReport: true }} style={st.editLink}>
            <FontAwesomeIcon icon={faPen} style={{ fontSize: 10 }} /> Edit
          </Link>
        )}
      </div>
      <h1 style={st.h1}>{incidentChildren(r).join(', ')}</h1>

      <dl style={st.factGrid}>
        <Fact icon={faCalendarDays} label="When" value={`${fmtIncidentDate(r.incidentDate)}, ${fmtIncidentTime(r.incidentTime)}`} />
        <Fact icon={faLocationDot} label="Where" value={r.location} />
        <Fact icon={faUser} label="Reported by" value={r.reportedByName} sub={fmtLogTime(r.createdAt)} />
        {/* Latest reaction recorded — the satisfaction signal at a glance. */}
        <div style={{ minWidth: 0 }}>
          <dt style={st.factLabel}><FontAwesomeIcon icon={faFaceSmile} style={{ fontSize: 10, marginRight: 5 }} />Parent</dt>
          <dd style={st.factValue}>
            {latestParentReaction(r)
              ? <ParentReactionPill reaction={latestParentReaction(r)!} />
              : <span style={{ color: C.mutedSoft, fontWeight: 500 }}>Not recorded yet</span>}
          </dd>
        </div>
      </dl>

      <ProgressTrack report={r} />
    </section>
  );
}

function Fact({ icon, label, value, sub }: { icon: typeof faUser; label: string; value: string; sub?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <dt style={st.factLabel}><FontAwesomeIcon icon={icon} style={{ fontSize: 10, marginRight: 5 }} />{label}</dt>
      <dd style={st.factValue}>
        {value}
        {sub && <span style={{ display: 'block', fontSize: 12, color: C.muted, fontWeight: 400 }}>{sub}</span>}
      </dd>
    </div>
  );
}

/**
 * Open → Parent informed → Resolved, with when (and by whom) each step was
 * reached. Finished steps are a green tick; the current one is ringed in its
 * status colour; steps after it are still to come — so a report moved back
 * to Open shows the later steps as not done again.
 */
function ProgressTrack({ report: r }: { report: IncidentReport }) {
  const current = INCIDENT_STATUSES.indexOf(r.status);
  const last = INCIDENT_STATUSES.length - 1;
  const reachedBy = (s: IncidentStatus): { who: string; at: string } | null => {
    if (s === 'OPEN') return { who: r.reportedByName, at: r.createdAt };
    const entry = [...r.log].reverse().find(l => l.kind === 'STATUS' && l.statusTo === s);
    return entry ? { who: entry.authorName, at: entry.createdAt } : null;
  };
  return (
    <ol style={st.track} aria-label="Progress">
      {INCIDENT_STATUSES.map((s, i) => {
        // Resolved is the end — reaching it means done, not "in progress".
        const state: 'done' | 'current' | 'todo' =
          i < current || (i === current && i === last) ? 'done' : i === current ? 'current' : 'todo';
        const color = INCIDENT_STATUS_LOOK[s].fg;
        const by = state !== 'todo' ? reachedBy(s) : null;
        return (
          <li key={s} style={{ ...st.step, ...(i === last ? { paddingRight: 0 } : {}) }} aria-current={i === current ? 'step' : undefined}>
            {/* Dot, then the line to the next step — on their own row, so
                the line never runs through the labels underneath. */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={st.stepDot(state, color)}>
                {state === 'done' && <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10 }} />}
                {state === 'current' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />}
              </span>
              {i < last && <span style={st.connector(i < current)} />}
            </div>
            <div style={{
              fontSize: 13, fontWeight: 700, marginTop: 8,
              color: state === 'current' ? color : state === 'done' ? C.text : C.mutedSoft,
            }}>
              {INCIDENT_STATUS_LABEL[s]}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>
              {by ? `${fmtLogTime(by.at)} · ${by.who}` : state === 'todo' ? 'Not yet' : '—'}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** The report as filed. */
function ReportCard({ report: r }: { report: IncidentReport }) {
  return (
    <section style={st.card} aria-label="Report">
      <Section icon={faFileLines} title="What happened" text={r.description} />
      <Section icon={faKitMedical} title="Immediate actions taken" text={r.actionsTaken} />
      <div style={{ ...st.sectionTitle, marginTop: 20 }}>Students involved</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {r.students.map(s => <span key={s.studentId} style={st.childChip}>{s.childName}</span>)}
        {r.otherChildren && <span style={{ ...st.childChip, background: '#f1f5f9', color: C.textSub }} title="Not an enrolled student">{r.otherChildren}</span>}
      </div>
    </section>
  );
}

function Section({ icon, title, text }: { icon: typeof faFileLines; title: string; text: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={st.sectionTitle}><FontAwesomeIcon icon={icon} style={{ fontSize: 12, color: C.primary, marginRight: 7 }} />{title}</div>
      <p style={st.prose}>{text}</p>
    </div>
  );
}

const HISTORY_DAYS = 90;

/**
 * For each enrolled child involved: how often they've had incidents lately,
 * and how their parent took each one — repeat incidents are a likely cause
 * of a parent growing unhappy, so the two are shown side by side.
 */
function ChildHistory({ report: r, all }: { report: IncidentReport; all: IncidentReport[] }) {
  const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return (
    <section style={st.card} aria-label="Children's incident history">
      <div style={{ ...st.sectionTitle, marginBottom: 4 }}>
        <FontAwesomeIcon icon={faClockRotateLeft} style={{ fontSize: 12, color: C.primary, marginRight: 7 }} />Incident history
      </div>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: C.muted }}>
        How often each child has been involved, and how their parent took it.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {r.students.map(s => {
          const theirs = all
            .filter(x => x.students.some(y => y.studentId === s.studentId))
            .sort((a, b) => `${b.incidentDate} ${b.incidentTime}`.localeCompare(`${a.incidentDate} ${a.incidentTime}`));
          const recent = theirs.filter(x => x.incidentDate >= since).length;
          // Just the latest few here — "View all" has the full history.
          const others = theirs.filter(x => x.id !== r.id).slice(0, 3);
          return (
            <div key={s.studentId}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <Link to={`/operations/incidents/child/${s.studentId}`} style={{ fontSize: 14, fontWeight: 700, color: C.text, textDecoration: 'none' }}>
                  {s.childName}
                </Link>
                <span style={st.freq(recent >= 3)}>
                  {recent} in the last {HISTORY_DAYS} days
                </span>
                <span style={{ fontSize: 12, color: C.mutedSoft }}>· {theirs.length} in total</span>
                <Link to={`/operations/incidents/child/${s.studentId}`} style={st.viewAll}>
                  View all <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9 }} />
                </Link>
              </div>
              {others.length === 0 ? (
                <div style={{ fontSize: 13, color: C.muted }}>No other incidents on record — this is the first.</div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, border: `1px solid ${C.divider}`, borderRadius: 10, overflow: 'hidden' }}>
                  {others.map(x => {
                    const reaction = latestParentReaction(x);
                    return (
                      <li key={x.id} style={{ borderTop: x === others[0] ? 'none' : `1px solid ${C.divider}` }}>
                        <Link to={`/operations/incidents/${x.id}`} className="incident-row" style={st.historyRow}>
                          <span style={{ width: 92, flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: C.textSub }}>{fmtIncidentDate(x.incidentDate)}</span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {x.description}
                          </span>
                          {reaction
                            ? <ParentReactionPill reaction={reaction} />
                            : <span style={{ fontSize: 11.5, color: C.mutedSoft, whiteSpace: 'nowrap' }}>No reaction</span>}
                          <IncidentStatusPill status={x.status} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** One point on the timeline — a log entry, or the report being filed (the very first point). */
interface TimelinePoint {
  id: string;
  at: string;
  who: string;
  kind: IncidentLogEntry['kind'] | 'FILED';
  statusTo: IncidentStatus | null;
  parentReaction: ParentReaction | null;
  body: string | null;
}

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' });

/**
 * The follow-up as a vertical timeline, newest first, grouped by day, ending
 * with the report being filed. Back to the top when an entry is added.
 */
function LogList({ report: r, scrolls }: { report: IncidentReport; scrolls: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [r.log.length]);

  const points: TimelinePoint[] = [
    ...[...r.log].reverse().map(l => ({ id: l.id, at: l.createdAt, who: l.authorName, kind: l.kind, statusTo: l.statusTo, parentReaction: l.parentReaction, body: l.body })),
    { id: 'filed', at: r.createdAt, who: r.reportedByName, kind: 'FILED' as const, statusTo: null, parentReaction: null, body: null },
  ];
  // Group consecutive points by calendar day (already newest first).
  const days: { label: string; points: TimelinePoint[] }[] = [];
  for (const p of points) {
    const label = dayLabel(p.at);
    const last = days[days.length - 1];
    if (last?.label === label) last.points.push(p);
    else days.push({ label, points: [p] });
  }

  return (
    <div ref={ref} style={st.logScroll(scrolls)}>
      {days.map(d => (
        <div key={d.label} style={{ marginBottom: 6 }}>
          <div style={st.dayLabel}>{d.label}</div>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {d.points.map((p, i) => (
              <TimelineItem key={p.id} point={p} last={i === d.points.length - 1 && d === days[days.length - 1]} />
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

/**
 * Icon on the rail says what happened (comment / status change / correction /
 * filed); the text beside it says who and when, with any comment underneath —
 * and, on a comment, how satisfied the parent was at that point.
 */
function TimelineItem({ point: p, last }: { point: TimelinePoint; last: boolean }) {
  const icon = p.kind === 'NOTE' ? faComment : p.kind === 'STATUS' ? faFlag : p.kind === 'EDIT' ? faPen : faTriangleExclamation;
  const tone = p.kind === 'STATUS' && p.statusTo ? INCIDENT_STATUS_LOOK[p.statusTo]
    : p.kind === 'NOTE' ? { fg: C.primary, bg: C.primarySoft, border: '#e0e7ff' }
    : { fg: C.muted, bg: '#f1f5f9', border: C.border };
  return (
    <li style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: last ? 4 : 18 }}>
      {/* The rail: a line from this icon down to the next one. */}
      {!last && <span style={st.rail} />}
      <span style={{ ...st.railIcon, color: tone.fg, background: tone.bg, borderColor: tone.border }} aria-hidden>
        <FontAwesomeIcon icon={icon} style={{ fontSize: 11 }} />
      </span>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', fontSize: 13.5, color: C.textSub }}>
          <b style={{ color: C.text }}>{p.who}</b>
          {p.kind === 'NOTE' && 'commented'}
          {p.kind === 'STATUS' && p.statusTo && <>changed the status to <IncidentStatusPill status={p.statusTo} /></>}
          {p.kind === 'EDIT' && 'edited the details'}
          {p.kind === 'FILED' && 'reported the incident'}
          {/* Right after what happened, so the eye doesn't travel across the card for it. */}
          <span style={{ fontSize: 12.5, color: C.mutedSoft, whiteSpace: 'nowrap' }}>· {timeLabel(p.at)}</span>
        </div>
        {p.body && <div style={p.kind === 'EDIT' ? st.editNote : st.comment}>{p.body}</div>}
        {p.parentReaction && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: C.muted }}>
            Parent: <ParentReactionPill reaction={p.parentReaction} />
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * Managers' controls at the top of the log:
 *  - Status: a dropdown that always shows the report's real status; picking
 *    a different one changes it straight away (and logs the move).
 *  - Comment: write it, optionally tag how satisfied the parent was (a face
 *    — tap again to untag), then "Add comment" (or Ctrl/⌘+Enter). The face
 *    is saved with that comment.
 */
function Composer({ report: r, autoFocus }: { report: IncidentReport; autoFocus: boolean }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [note, setNote] = useState('');
  const [reaction, setReaction] = useState<ParentReaction | null>(null);
  const [busy, setBusy] = useState<'status' | 'comment' | null>(null);

  const post = async (entry: Parameters<typeof addIncidentLog>[1], kind: 'status' | 'comment', done: string) => {
    setBusy(kind);
    try {
      await addIncidentLog(r.id, entry);
      qc.invalidateQueries({ queryKey: ['incidents'] });
      qc.invalidateQueries({ queryKey: ['my-incidents'] });
      showToast(done);
      return true;
    } catch (e: any) {
      showToast(e?.message ?? 'Could not save', 'error');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const changeStatus = (s: IncidentStatus) => {
    if (s !== r.status) post({ status: s }, 'status', `Status changed to ${INCIDENT_STATUS_LABEL[s]}`);
  };
  const addComment = async () => {
    if (!note.trim() || busy) return;
    if (await post({ note: note.trim(), ...(reaction ? { parentReaction: reaction } : {}) }, 'comment', 'Comment added')) {
      setNote('');
      setReaction(null);
    }
  };

  const look = INCIDENT_STATUS_LOOK[r.status];
  return (
    <div style={st.composer}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={st.controlLabel}>Status</span>
        <select value={r.status} disabled={!!busy} onChange={e => changeStatus(e.target.value as IncidentStatus)}
          style={{ ...st.statusSelect, color: look.fg, background: look.bg, borderColor: look.border, cursor: busy ? 'default' : 'pointer' }}>
          {INCIDENT_STATUSES.map(s => <option key={s} value={s}>{INCIDENT_STATUS_LABEL[s]}</option>)}
        </select>
        {busy === 'status' && <span style={{ fontSize: 12, color: C.muted }}>Saving…</span>}
      </label>

      <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={5000} aria-label="Add a comment"
        autoFocus={autoFocus}
        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addComment(); } }}
        placeholder="Add a comment — e.g. called the parent at 12:15, they'll watch for swelling tonight."
        style={st.note} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        {/* Optional — tag this comment with how the parent felt. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} role="group" aria-label="Parent's satisfaction (optional)">
          <span style={{ fontSize: 12.5, color: C.muted }}>Parent:</span>
          {PARENT_REACTIONS.map(p => {
            const l = PARENT_REACTION_LOOK[p];
            const on = reaction === p;
            return (
              <button key={p} type="button" disabled={!!busy} onClick={() => setReaction(on ? null : p)}
                title={PARENT_REACTION_LABEL[p]} aria-label={`Parent ${PARENT_REACTION_LABEL[p].toLowerCase()}`} aria-pressed={on}
                style={{
                  ...st.faceBtn, cursor: busy ? 'default' : 'pointer',
                  color: on ? l.fg : C.mutedSoft, background: on ? l.bg : '#fff', borderColor: on ? l.border : C.border,
                }}>
                <FontAwesomeIcon icon={l.icon} style={{ fontSize: 15 }} />
              </button>
            );
          })}
          {reaction && <span style={{ fontSize: 12.5, fontWeight: 600, color: PARENT_REACTION_LOOK[reaction].fg }}>{PARENT_REACTION_LABEL[reaction]}</span>}
        </div>
        <button onClick={addComment} disabled={!note.trim() || !!busy} style={{ ...st.primaryBtn(!note.trim() || !!busy), marginLeft: 'auto' }}>
          {busy === 'comment' ? 'Adding…' : 'Add comment'}
        </button>
      </div>
    </div>
  );
}

const st = {
  page: (mobile: boolean): React.CSSProperties => ({
    padding: mobile ? '14px 16px 32px' : '16px 32px 40px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    background: C.bg, minHeight: '100%', color: C.text,
  }),
  inner: { maxWidth: 1180, margin: '0 auto' } as React.CSSProperties,
  back: {
    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: C.muted,
    textDecoration: 'none', marginBottom: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
  } as React.CSSProperties,
  empty: { padding: 32, textAlign: 'center', color: C.muted, fontSize: 13, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12 } as React.CSSProperties,

  // Summary
  summary: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 22px' } as React.CSSProperties,
  eyebrow: {
    display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: C.muted,
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
  } as React.CSSProperties,
  h1: { margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.3, color: C.text, wordBreak: 'break-word' } as React.CSSProperties,
  // Quiet text-button — the title is the focus, not the edit action.
  editLink: {
    display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', borderRadius: 7,
    color: C.primary, fontSize: 13, fontWeight: 600, textDecoration: 'none', flexShrink: 0, background: C.primarySoft,
  } as React.CSSProperties,
  factGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px 20px', margin: '14px 0 0',
  } as React.CSSProperties,
  factLabel: {
    fontSize: 11, fontWeight: 700, color: C.mutedSoft, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3,
  } as React.CSSProperties,
  factValue: { margin: 0, fontSize: 14, fontWeight: 600, color: C.text, lineHeight: 1.4, wordBreak: 'break-word' } as React.CSSProperties,
  track: {
    // Last step only as wide as its label, so the lines stretch to the card's right edge.
    display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto', listStyle: 'none',
    margin: '18px 0 0', padding: '16px 0 0', borderTop: `1px solid ${C.divider}`,
  } as React.CSSProperties,
  step: { minWidth: 0, paddingRight: 8 } as React.CSSProperties,
  connector: (filled: boolean): React.CSSProperties => ({
    flex: 1, height: 2, margin: '0 0 0 8px', borderRadius: 1, background: filled ? '#6ee7b7' : C.border,
  }),
  // done = green tick · current = ringed in its status colour · todo = grey ring
  stepDot: (state: 'done' | 'current' | 'todo', color: string): React.CSSProperties => ({
    width: 24, height: 24, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
    background: state === 'done' ? '#10b981' : '#fff',
    border: state === 'done' ? 'none' : `2px solid ${state === 'current' ? color : C.border}`,
    boxShadow: state === 'current' ? `0 0 0 4px ${color}1f` : 'none',
  }),

  // Body
  grid: (twoCol: boolean): React.CSSProperties => (twoCol
    ? { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }
    : { display: 'flex', flexDirection: 'column', gap: 14 }),
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 22px' } as React.CSSProperties,
  sectionTitle: { display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 } as React.CSSProperties,
  prose: { margin: 0, fontSize: 14.5, color: C.textSub, lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' } as React.CSSProperties,
  childChip: { padding: '4px 12px', borderRadius: 999, background: C.primarySoft, color: '#3c366b', fontSize: 13, fontWeight: 600 } as React.CSSProperties,

  // Log
  logCard: (sticky: boolean): React.CSSProperties => ({
    background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    ...(sticky ? { position: 'sticky', top: 16, maxHeight: 'calc(100vh - 110px)' } : {}),
  }),
  cardHead: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', fontSize: 14, fontWeight: 700, color: C.text,
    borderBottom: `1px solid ${C.divider}`, flexShrink: 0,
  } as React.CSSProperties,
  count: {
    minWidth: 20, padding: '0 6px', borderRadius: 999, fontSize: 11.5, lineHeight: '20px', textAlign: 'center',
    background: C.primarySoft, color: C.primary, fontWeight: 700,
  } as React.CSSProperties,
  logScroll: (scrolls: boolean): React.CSSProperties => ({
    flex: 1, minHeight: 120, overflowY: scrolls ? 'auto' : 'visible', padding: '18px 20px',
  }),
  // Timeline
  dayLabel: {
    fontSize: 11, fontWeight: 700, color: C.mutedSoft, textTransform: 'uppercase', letterSpacing: '0.06em',
    margin: '4px 0 12px',
  } as React.CSSProperties,
  // Line from an icon (30px, centred at 15px) down to the next one.
  rail: { position: 'absolute', left: 14, top: 30, bottom: 0, width: 2, background: C.border } as React.CSSProperties,
  railIcon: {
    width: 30, height: 30, borderRadius: '50%', flexShrink: 0, border: '1px solid', boxSizing: 'border-box',
    display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1,
  } as React.CSSProperties,
  comment: {
    marginTop: 6, padding: '8px 12px', borderRadius: 8, background: '#f8fafc', border: `1px solid ${C.divider}`,
    fontSize: 14, color: C.text, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  } as React.CSSProperties,
  editNote: { marginTop: 3, fontSize: 12.5, color: C.muted, fontStyle: 'italic' } as React.CSSProperties,
  readOnlyNote: { padding: '12px 20px', fontSize: 12.5, color: C.muted, borderBottom: `1px solid ${C.divider}`, background: '#fbfcfd' } as React.CSSProperties,
  composer: { flexShrink: 0, padding: '14px 16px', borderBottom: `1px solid ${C.divider}`, background: '#fbfcfd' } as React.CSSProperties,
  note: {
    width: '100%', boxSizing: 'border-box', minHeight: 76, padding: '10px 12px', fontSize: 14, lineHeight: 1.5,
    border: `1px solid ${C.border}`, borderRadius: 10, fontFamily: 'inherit', resize: 'vertical', outline: 'none', background: '#fff',
  } as React.CSSProperties,
  controlLabel: { fontSize: 13, fontWeight: 600, color: C.textSub } as React.CSSProperties,
  faceBtn: {
    width: 34, height: 34, borderRadius: 9, border: '1px solid', display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', padding: 0, fontFamily: 'inherit',
  } as React.CSSProperties,
  // Child history: "3 in the last 90 days" — amber from 3 up, as a nudge.
  freq: (high: boolean): React.CSSProperties => ({
    padding: '1px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700,
    color: high ? '#b45309' : C.primary, background: high ? '#fffbeb' : C.primarySoft,
    border: `1px solid ${high ? '#fde68a' : '#e0e7ff'}`,
  }),
  viewAll: {
    marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600,
    color: C.primary, textDecoration: 'none',
  } as React.CSSProperties,
  historyRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', textDecoration: 'none', color: 'inherit',
  } as React.CSSProperties,
  // Coloured like the status pill; colours are set per status inline.
  statusSelect: {
    height: 32, padding: '0 10px', borderRadius: 8, border: '1px solid', fontSize: 13, fontWeight: 700,
    fontFamily: 'inherit', outline: 'none',
  } as React.CSSProperties,
  primaryBtn: (off: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 14px', borderRadius: 8, border: 'none',
    background: off ? '#a5b4fc' : C.primary, color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
    cursor: off ? 'default' : 'pointer', flexShrink: 0,
  }),
};
