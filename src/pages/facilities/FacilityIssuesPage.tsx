import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck, faClock, faLocationDot, faPlus, faRotateLeft, faScrewdriverWrench, faSearch, faUser, faXmark,
} from '@fortawesome/free-solid-svg-icons';
import {
  fetchFacilityIssues, fetchMyFacilityIssues, FACILITY_MANAGE_VIEW, type FacilityIssue, type FacilityStatus,
} from '../../api/facilityIssues.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import {
  ACTIVE, FACILITY_STATUS_LABEL, ageLabel, categoryLabel, matchesFilter, matchesSearch, sortForQueue, type FacilityFilter,
} from './facilityDisplay.js';
import { CATEGORY_ICON, STATUS_LOOK, URGENT_LOOK } from './facilityLook.js';
import ReportFacilityModal from './ReportFacilityModal.js';
import FacilityAttachments from './FacilityAttachments.js';
import UpdateFacilityStatusModal from './UpdateFacilityStatusModal.js';

// Operation → Facilities: things broken or unsafe in the building (door,
// leaking pipe, aircon…). Facility managers ("Manage facility issues" view;
// Admins always) see every report as a work queue — urgent first, then
// longest waiting — and move each one Open → In progress → Resolved.
// Everyone else sees only what they reported. Teachers report from their app.

const C = {
  bg: '#f8fafc', card: '#ffffff', border: '#e2e8f0', text: '#0f172a', sub: '#334155',
  muted: '#64748b', mutedSoft: '#64748b', primary: '#5a67d8', primarySoft: '#eef2ff',
};

const FILTERS: { key: FacilityFilter; label: string }[] = [
  { key: ACTIVE, label: 'Active' },
  { key: 'OPEN', label: FACILITY_STATUS_LABEL.OPEN },
  { key: 'IN_PROGRESS', label: FACILITY_STATUS_LABEL.IN_PROGRESS },
  { key: 'RESOLVED', label: FACILITY_STATUS_LABEL.RESOLVED },
];

export default function FacilityIssuesPage() {
  const { isMobile } = useIsMobile();
  const { hasView, loading: permsLoading } = usePermissions();
  const canManage = hasView(FACILITY_MANAGE_VIEW);
  const [filter, setFilter] = useState<FacilityFilter>(ACTIVE);
  const [search, setSearch] = useState('');
  const [reporting, setReporting] = useState(false);
  const [moving, setMoving] = useState<{ issue: FacilityIssue; to: FacilityStatus } | null>(null);

  const { data: issues = [], isLoading, error } = useQuery({
    queryKey: canManage ? ['facility-issues'] : ['my-facility-issues'],
    queryFn: canManage ? fetchFacilityIssues : fetchMyFacilityIssues,
    enabled: !permsLoading,
  });

  const shown = sortForQueue(issues.filter(i => matchesFilter(i, filter) && matchesSearch(i, search)));
  const urgentWaiting = issues.filter(i => i.urgency === 'URGENT' && i.status === 'OPEN').length;

  return (
    <div className="m-pad" style={{ padding: isMobile ? '16px 12px' : '28px 32px', background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h1 style={{ margin: 0, fontSize: isMobile ? 19 : 22, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 9 }}>
              <FontAwesomeIcon icon={faScrewdriverWrench} style={{ color: C.primary, fontSize: 17 }} />
              {canManage ? 'Facilities' : 'My facility reports'}
            </h1>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
              {canManage
                ? 'Broken or unsafe things staff have reported — work through them until each one is resolved.'
                : 'Things you’ve reported. Whoever looks after the building updates the status here.'}
            </div>
          </div>
          <button type="button" onClick={() => setReporting(true)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, border: 'none',
            background: C.primary, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <FontAwesomeIcon icon={faPlus} style={{ fontSize: 11 }} /> Report issue
          </button>
        </div>

        {canManage && urgentWaiting > 0 && (
          <div role="status" style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 14, borderRadius: 10,
            background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13, fontWeight: 600,
          }}>
            <span style={{ ...pill, background: URGENT_LOOK.bg, color: URGENT_LOOK.fg }}>Urgent</span>
            {urgentWaiting === 1 ? '1 urgent issue hasn’t been picked up yet.' : `${urgentWaiting} urgent issues haven’t been picked up yet.`}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <div role="tablist" style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', maxWidth: '100%' }}>
            {FILTERS.map(f => {
              const on = filter === f.key;
              const count = issues.filter(i => matchesFilter(i, f.key)).length;
              return (
                <button key={f.key} type="button" role="tab" aria-selected={on} onClick={() => setFilter(f.key)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, padding: '7px 12px', borderRadius: 999,
                  border: `1px solid ${on ? C.primary : C.border}`, background: on ? C.primarySoft : C.card,
                  color: on ? C.primary : C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {f.label}
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '0 7px', borderRadius: 999, background: on ? '#e0e7ff' : '#f1f5f9' }}>{count}</span>
                </button>
              );
            })}
          </div>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <FontAwesomeIcon icon={faSearch} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.mutedSoft }} />
            <input type="search" aria-label="Search issues" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={canManage ? 'Search issue, place, reporter…' : 'Search issue or place…'} style={{
                width: '100%', boxSizing: 'border-box', padding: '8px 32px', borderRadius: 8, border: `1px solid ${C.border}`,
                fontSize: 13, fontFamily: 'inherit', outline: 'none', background: C.card,
              }} />
            {search && (
              <button type="button" aria-label="Clear search" title="Clear search" onClick={() => setSearch('')} style={{
                position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: C.mutedSoft, cursor: 'pointer',
              }}>
                <FontAwesomeIcon icon={faXmark} />
              </button>
            )}
          </div>
        </div>

        {permsLoading || isLoading ? (
          <div style={empty}>Loading…</div>
        ) : error ? (
          <div style={empty}>Couldn’t load facility issues. {(error as Error).message}</div>
        ) : shown.length === 0 ? (
          <div style={empty}>
            {search.trim() ? `Nothing matches “${search.trim()}”.`
              : issues.length === 0 ? (canManage ? 'No facility issues reported yet.' : 'You haven’t reported any facility issues.')
              : filter === ACTIVE ? 'Nothing waiting — every issue is resolved.' : `No ${FACILITY_STATUS_LABEL[filter as FacilityStatus].toLowerCase()} issues.`}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {shown.map(i => (
              <FacilityIssueCard key={i.id} issue={i} canManage={canManage} onMove={to => setMoving({ issue: i, to })} />
            ))}
          </div>
        )}
      </div>

      {reporting && <ReportFacilityModal onClose={() => setReporting(false)} />}
      {moving && <UpdateFacilityStatusModal issue={moving.issue} to={moving.to} onClose={() => setMoving(null)} />}
    </div>
  );
}

function FacilityIssueCard({ issue: i, canManage, onMove }: { issue: FacilityIssue; canManage: boolean; onMove: (to: FacilityStatus) => void }) {
  const look = STATUS_LOOK[i.status];
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', opacity: i.status === 'RESOLVED' ? 0.85 : 1 }}>
      <div className="m-wrap" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#f1f5f9', color: C.muted, fontSize: 15,
        }} title={categoryLabel(i.category)}>
          <FontAwesomeIcon icon={CATEGORY_ICON[i.category]} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{i.title}</span>
            {i.urgency === 'URGENT' && i.status !== 'RESOLVED' && <span style={{ ...pill, background: URGENT_LOOK.bg, color: URGENT_LOOK.fg }}>Urgent</span>}
            <span style={{ ...pill, background: look.bg, color: look.fg }}>{FACILITY_STATUS_LABEL[i.status]}</span>
          </div>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
            <span><FontAwesomeIcon icon={faLocationDot} style={{ fontSize: 11, marginRight: 4, color: C.mutedSoft }} />{i.location}</span>
            <span>{categoryLabel(i.category)}</span>
            <span><FontAwesomeIcon icon={faUser} style={{ fontSize: 10.5, marginRight: 4, color: C.mutedSoft }} />{i.reportedByName}, {ageLabel(i.createdAt)}</span>
          </div>
          {i.description && <div style={{ fontSize: 13, color: C.sub, marginTop: 8, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{i.description}</div>}
          {!!i.attachments?.length && <FacilityAttachments issueId={i.id} attachments={i.attachments} />}
          {i.statusNote && (
            <div style={{ fontSize: 12.5, color: C.sub, marginTop: 8, padding: '7px 10px', borderRadius: 8, background: '#f8fafc', borderLeft: `3px solid ${look.fg}` }}>
              {i.statusNote}
              {i.statusUpdatedByName && <span style={{ color: C.mutedSoft }}> — {i.statusUpdatedByName}</span>}
            </div>
          )}
        </div>
        {canManage && <IssueActions status={i.status} onMove={onMove} />}
      </div>
    </div>
  );
}

/** The next step(s) for an issue: Mark in progress / Resolve while open, Resolve while in progress, Reopen once resolved. */
function IssueActions({ status, onMove }: { status: FacilityStatus; onMove: (to: FacilityStatus) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
      {/* "In progress" = being handled, whoever does the fixing — often a contractor the principal calls. */}
      {status === 'OPEN' && <ActionBtn icon={faClock} label="Mark in progress" onClick={() => onMove('IN_PROGRESS')} />}
      {status !== 'RESOLVED' && <ActionBtn icon={faCheck} label="Resolve" primary onClick={() => onMove('RESOLVED')} />}
      {status === 'RESOLVED' && <ActionBtn icon={faRotateLeft} label="Reopen" onClick={() => onMove('OPEN')} />}
    </div>
  );
}

function ActionBtn({ icon, label, onClick, primary }: { icon: typeof faClock; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button type="button" className={primary ? 'fac-btn-primary' : 'fac-btn'} onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
      fontFamily: 'inherit', cursor: 'pointer',
      border: primary ? 'none' : `1px solid ${C.border}`, background: primary ? '#047857' : C.card, color: primary ? '#fff' : C.sub,
    }}>
      <FontAwesomeIcon icon={icon} style={{ fontSize: 10.5 }} /> {label}
    </button>
  );
}

const pill: React.CSSProperties = { display: 'inline-block', padding: '2px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 700 };
const empty: React.CSSProperties = {
  padding: '40px 20px', textAlign: 'center', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, color: C.muted, fontSize: 14,
};
