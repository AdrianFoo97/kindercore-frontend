import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTriangleExclamation, faPlus, faSearch, faXmark, faLocationDot, faUser, faPen, faListUl, faRotate,
} from '@fortawesome/free-solid-svg-icons';
import {
  addIncidentLog, fetchIncidents, fetchMyIncidents, fmtIncidentDate, fmtIncidentTime, incidentChildren, latestParentReaction,
  INCIDENT_MANAGE_VIEW, INCIDENT_STATUS_LABEL, IncidentReport, IncidentStatus,
} from '../api/incidents.js';
import IncidentStatusPill, { INCIDENT_STATUSES, INCIDENT_STATUS_LOOK } from '../components/incidents/IncidentStatusPill.js';
import ParentReactionPill from '../components/incidents/ParentReactionPill.js';
import { useToast } from '../components/common/Toast.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { usePermissions } from '../hooks/usePermissions.js';

// Operation → Incidents. Two levels: incident managers ("Manage incident
// reports" view; Admins always) see every report and act on it from the
// list — status, Log, Edit; everyone else sees only what they filed.
// Reports come from teachers (mobile app) and office staff (here) —
// replaces the Google Form. Follow-up runs Open → Parent informed → Resolved.
// A report opens as its own page (IncidentDetailPage); editing and filing
// use IncidentFormPage.

const C = {
  bg: '#f8fafc', card: '#ffffff', border: '#e2e8f0', divider: '#f1f5f9',
  text: '#0f172a', textSub: '#334155', muted: '#64748b', mutedSoft: '#94a3b8',
  primary: '#5a67d8', primarySoft: '#eef2ff',
};

type Tab = IncidentStatus | 'ALL';

// "Repeat" tag: a child with REPEAT_MIN+ incidents in the last REPEAT_DAYS days.
const REPEAT_DAYS = 90;
const REPEAT_MIN = 3;

export default function IncidentsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isMobile } = useIsMobile();
  const { showToast } = useToast();
  const { hasView, loading: permsLoading } = usePermissions();
  const canManage = hasView(INCIDENT_MANAGE_VIEW);
  // Tab + search live in the URL (replace, not push), so going Back from a
  // report returns to the same tab and search instead of resetting to Open.
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const tab: Tab = tabParam === 'PARENT_INFORMED' || tabParam === 'RESOLVED' || tabParam === 'ALL' ? tabParam : 'OPEN';
  const query = params.get('q') ?? '';
  const setParam = (key: string, value: string | null) => setParams(prev => {
    const next = new URLSearchParams(prev);
    if (value) next.set(key, value); else next.delete(key);
    return next;
  }, { replace: true });
  const setTab = (t: Tab) => setParam('tab', t === 'OPEN' ? null : t);
  const setQuery = (q: string) => setParam('q', q || null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: reports = [], isLoading, error } = useQuery({
    queryKey: canManage ? ['incidents'] : ['my-incidents'],
    queryFn: canManage ? fetchIncidents : fetchMyIncidents,
    enabled: !permsLoading,
  });

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { OPEN: 0, PARENT_INFORMED: 0, RESOLVED: 0, ALL: reports.length };
    reports.forEach(r => { c[r.status] += 1; });
    return c;
  }, [reports]);

  const q = query.trim().toLowerCase();
  const shown = reports.filter(r => (tab === 'ALL' || r.status === tab) && (!q || [
    ...incidentChildren(r), r.location, r.description, r.reportedByName,
  ].some(s => s.toLowerCase().includes(q))));

  // Children with REPEAT_MIN+ incidents in the last REPEAT_DAYS days — a
  // report involving any of them is tagged "Repeat" (managers see all
  // reports, so the count is across everyone's).
  const repeatKids = useMemo(() => {
    const since = new Date(Date.now() - REPEAT_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const counts = new Map<string, number>();
    reports.filter(r => r.incidentDate >= since)
      .forEach(r => r.students.forEach(s => counts.set(s.studentId, (counts.get(s.studentId) ?? 0) + 1)));
    return new Set([...counts].filter(([, n]) => n >= REPEAT_MIN).map(([id]) => id));
  }, [reports]);

  // Status straight from the list — logged like any other status move.
  const changeStatus = async (r: IncidentReport, status: IncidentStatus) => {
    setBusyId(r.id);
    try {
      await addIncidentLog(r.id, { status });
      qc.invalidateQueries({ queryKey: ['incidents'] });
      qc.invalidateQueries({ queryKey: ['my-incidents'] });
      showToast(`Moved to ${INCIDENT_STATUS_LABEL[status]}`);
    } catch (e: any) {
      showToast(e?.message ?? 'Could not change the status', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={st.page(isMobile)}>
      <div style={st.inner}>
        <div style={st.header}>
          <h1 style={st.h1}>
            <FontAwesomeIcon icon={faTriangleExclamation} style={{ color: C.primary, fontSize: 16, marginRight: 8 }} />
            {canManage ? 'Incidents' : 'My incident reports'}
          </h1>
          <span style={{ fontSize: 12.5, color: C.muted, flex: 1, minWidth: 0 }}>
            {canManage
              ? 'Every report filed by staff — follow each one up until it’s resolved.'
              : 'Reports you’ve filed. A supervisor follows them up; their notes show in each report’s log.'}
          </span>
          <Link to="/operations/incidents/new" style={{ ...st.primaryBtn, textDecoration: 'none' }}>
            <FontAwesomeIcon icon={faPlus} style={{ fontSize: 11 }} /> Report incident
          </Link>
        </div>

        <div style={st.toolbar}>
          <div style={st.tabs} role="tablist">
            {(['OPEN', 'PARENT_INFORMED', 'RESOLVED', 'ALL'] as Tab[]).map(t => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} style={st.tab(tab === t)}>
                {t === 'ALL' ? 'All' : INCIDENT_STATUS_LABEL[t]}
                <span style={st.tabCount(tab === t)}>{counts[t]}</span>
              </button>
            ))}
          </div>
          <div style={st.searchWrap}>
            <FontAwesomeIcon icon={faSearch} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.mutedSoft }} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search child, location, reporter…" style={st.search} />
            {query && <button onClick={() => setQuery('')} aria-label="Clear search" style={st.clearBtn}><FontAwesomeIcon icon={faXmark} /></button>}
          </div>
        </div>

        {permsLoading || isLoading ? (
          <div style={st.empty}>Loading incident reports…</div>
        ) : error ? (
          <div style={st.empty}>Couldn’t load incident reports. {(error as Error).message}</div>
        ) : shown.length === 0 ? (
          <div style={st.empty}>
            {q ? `Nothing matches “${query}”.`
              : !canManage && reports.length === 0 ? 'You haven’t reported any incidents.'
              : tab === 'OPEN' ? 'No open incidents — all followed up.' : 'No incidents here.'}
          </div>
        ) : (
          <div style={st.list}>
            {shown.map(r => (
              <IncidentRow
                key={r.id} report={r} canManage={canManage} busy={busyId === r.id}
                repeat={canManage && r.students.some(s => repeatKids.has(s.studentId))}
                onOpen={() => navigate(`/operations/incidents/${r.id}`)}
                onLog={() => navigate(`/operations/incidents/${r.id}?comment=1`)}
                onEdit={() => navigate(`/operations/incidents/${r.id}/edit`)}
                onStatus={s => changeStatus(r, s)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function IncidentRow({ report: r, canManage, busy, repeat, onOpen, onLog, onEdit, onStatus }: {
  report: IncidentReport; canManage: boolean; busy: boolean; repeat: boolean;
  onOpen: () => void; onLog: () => void; onEdit: () => void; onStatus: (s: IncidentStatus) => void;
}) {
  const entries = r.log.length;
  const reaction = latestParentReaction(r);
  return (
    <div className="incident-row" style={st.row}>
      <button onClick={onOpen} style={st.rowMain} aria-label={`Open report: ${incidentChildren(r).join(', ')}`}>
        <div style={st.rowWhen}>
          <div style={{ fontWeight: 700, color: C.text }}>{fmtIncidentDate(r.incidentDate)}</div>
          <div style={{ color: C.muted, fontSize: 12 }}>{fmtIncidentTime(r.incidentTime)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: C.text, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {incidentChildren(r).join(', ')}
          </div>
          <div style={{ fontSize: 13, color: C.textSub, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.description}
          </div>
          <div style={st.rowMeta}>
            <span><FontAwesomeIcon icon={faLocationDot} style={st.metaIcon} />{r.location}</span>
            <span><FontAwesomeIcon icon={faUser} style={st.metaIcon} />{r.reportedByName}</span>
            <span><FontAwesomeIcon icon={faListUl} style={st.metaIcon} />{entries === 0 ? 'No follow-up yet' : `${entries} log ${entries === 1 ? 'entry' : 'entries'}`}</span>
            {reaction && <ParentReactionPill reaction={reaction} />}
            {repeat && (
              <span style={st.repeat} title={`A child here has had ${REPEAT_MIN}+ incidents in the last ${REPEAT_DAYS} days`}>
                <FontAwesomeIcon icon={faRotate} style={{ fontSize: 10 }} /> Repeat
              </span>
            )}
          </div>
        </div>
      </button>

      {canManage ? (
        <div style={st.rowActions}>
          <select
            aria-label="Status" value={r.status} disabled={busy}
            onChange={e => onStatus(e.target.value as IncidentStatus)}
            style={st.statusSelect(r.status, busy)}
          >
            {INCIDENT_STATUSES.map(s => <option key={s} value={s}>{INCIDENT_STATUS_LABEL[s]}</option>)}
          </select>
          <button onClick={onLog} style={st.rowBtn} title="View the log and add to it">
            <FontAwesomeIcon icon={faListUl} style={{ fontSize: 11 }} /> Log
          </button>
          <button onClick={onEdit} style={st.rowBtn} title="Edit the incident details">
            <FontAwesomeIcon icon={faPen} style={{ fontSize: 10.5 }} /> Edit
          </button>
        </div>
      ) : (
        <div style={{ ...st.rowActions, paddingRight: 16 }}><IncidentStatusPill status={r.status} /></div>
      )}
    </div>
  );
}

const st = {
  page: (mobile: boolean): React.CSSProperties => ({
    padding: mobile ? '14px 16px 32px' : '16px 32px 40px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    background: C.bg, minHeight: '100%', color: C.text,
  }),
  inner: { maxWidth: 1000, margin: '0 auto' } as React.CSSProperties,
  header: { display: 'flex', alignItems: 'center', gap: '8px 14px', marginBottom: 12, flexWrap: 'wrap' } as React.CSSProperties,
  h1: { margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center' } as React.CSSProperties,
  primaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 14px', borderRadius: 8, border: 'none',
    background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
  } as React.CSSProperties,
  toolbar: { display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' } as React.CSSProperties,
  tabs: { display: 'inline-flex', gap: 2, padding: 3, background: '#eef0f4', borderRadius: 9, flexWrap: 'wrap' } as React.CSSProperties,
  tab: (on: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, border: 'none',
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
    background: on ? '#fff' : 'transparent', color: on ? C.text : C.muted,
    boxShadow: on ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
  }),
  tabCount: (on: boolean): React.CSSProperties => ({
    minWidth: 18, padding: '0 5px', borderRadius: 999, fontSize: 11, lineHeight: '18px', textAlign: 'center',
    background: on ? C.primarySoft : '#e2e8f0', color: on ? C.primary : C.muted,
  }),
  searchWrap: { position: 'relative', flex: 1, minWidth: 200 } as React.CSSProperties,
  search: {
    width: '100%', boxSizing: 'border-box', height: 38, padding: '0 34px', fontSize: 13,
    border: `1px solid ${C.border}`, borderRadius: 9, outline: 'none', background: '#fff', color: C.text, fontFamily: 'inherit',
  } as React.CSSProperties,
  clearBtn: {
    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 26, height: 26,
    border: 'none', background: 'none', color: C.mutedSoft, cursor: 'pointer', borderRadius: 6,
  } as React.CSSProperties,
  empty: { padding: 32, textAlign: 'center', color: C.muted, fontSize: 13, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12 } as React.CSSProperties,
  list: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' } as React.CSSProperties,
  // Row = clickable summary (opens the report) + an actions cluster; wraps
  // the actions under the summary on narrow screens.
  row: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap', width: '100%', borderBottom: `1px solid ${C.divider}`,
  } as React.CSSProperties,
  rowMain: {
    display: 'flex', alignItems: 'center', gap: 14, flex: '1 1 380px', minWidth: 0, padding: '12px 16px', border: 'none',
    background: 'transparent', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', color: 'inherit',
  } as React.CSSProperties,
  rowActions: { display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px 0 0', marginLeft: 'auto', flexShrink: 0 } as React.CSSProperties,
  rowBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px', borderRadius: 7,
    border: `1px solid ${C.border}`, background: '#fff', color: C.textSub, fontSize: 12.5, fontWeight: 600,
    fontFamily: 'inherit', cursor: 'pointer',
  } as React.CSSProperties,
  statusSelect: (s: IncidentStatus, busy: boolean): React.CSSProperties => ({
    height: 30, padding: '0 8px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
    border: `1px solid ${INCIDENT_STATUS_LOOK[s].border}`, background: INCIDENT_STATUS_LOOK[s].bg, color: INCIDENT_STATUS_LOOK[s].fg,
    cursor: busy ? 'default' : 'pointer', outline: 'none',
  }),
  rowWhen: { width: 92, flexShrink: 0, fontSize: 12.5 } as React.CSSProperties,
  rowMeta: { display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 4, fontSize: 12, color: C.muted } as React.CSSProperties,
  metaIcon: { fontSize: 10.5, color: C.mutedSoft, marginRight: 5 },
  repeat: {
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '1px 8px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
    color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a',
  } as React.CSSProperties,
};
