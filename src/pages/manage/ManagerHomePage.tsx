import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBriefcase, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { useSignedInUser } from '../../utils/signedInUser.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.js';
import { useManagerAreas } from './useManagerAreas.js';
import type { ManagerArea, ManagerAreaGroup } from './managerAreas.js';

// Manager view — opened from the staff app's ⋯ menu. No nav bar: a large
// title, then every area this person can manage as grouped lists (iOS
// Settings style — one card per group, full-width rows with a chevron), so
// a group of one reads as cleanly as a group of eight. On desktop the group
// cards sit side by side. Tapping a row opens that admin page; back returns here.

const C = {
  bg: '#f8fafc', card: '#ffffff', border: '#e2e8f0', divider: '#eef0f4', text: '#0f172a', muted: '#64748b',
  chevron: '#94a3b8', primary: '#5a67d8', primarySoft: '#eef2ff',
};
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
/** Left edge of a row's text — where its divider starts (icon inset + icon + gap). */
const TEXT_INSET = 16 + 32 + 12;

export default function ManagerHomePage() {
  const { isMobile } = useIsMobile();
  const { groups, loading } = useManagerAreas();
  const user = useSignedInUser();

  return (
    <div style={{ padding: isMobile ? '8px 16px 48px' : '32px 32px 48px', background: C.bg, minHeight: '100%', fontFamily: FONT, color: C.text }}>
      <style>{`.mgr-row:hover{background:${C.bg}}.mgr-row:focus-visible{outline:2px solid ${C.primary};outline-offset:-2px}`}</style>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 24px', fontSize: isMobile ? 32 : 24, fontWeight: 800, letterSpacing: '-0.02em' }}>Manager view</h1>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center' }}><LoadingSpinner /></div>
        ) : groups.length === 0 ? (
          <NothingToManage teacherId={user?.teacherId ?? null} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: isMobile ? 24 : '24px 16px', alignItems: 'start' }}>
            {groups.map(g => <AreaGroup key={g.heading} group={g} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function AreaGroup({ group }: { group: ManagerAreaGroup }) {
  const headingId = `mgr-${group.heading.replace(/\W+/g, '-')}`;
  return (
    <section aria-labelledby={group.untitled ? undefined : headingId} aria-label={group.untitled ? group.heading : undefined}>
      {!group.untitled && (
        <h2 id={headingId} style={{ margin: '0 0 8px 16px', fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {group.heading}
        </h2>
      )}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
        {group.areas.map((a, i) => <AreaRow key={a.path} area={a} first={i === 0} />)}
      </div>
    </section>
  );
}

function AreaRow({ area, first }: { area: ManagerArea; first: boolean }) {
  return (
    <Link to={area.path} className="mgr-row" style={{
      position: 'relative', display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '0 16px',
      textDecoration: 'none', color: C.text, WebkitTapHighlightColor: 'transparent', transition: 'background 120ms ease',
    }}>
      {/* Inset hairline, starting at the text — like iOS grouped lists. */}
      {!first && <span aria-hidden style={{ position: 'absolute', top: 0, left: TEXT_INSET, right: 0, height: 1, background: C.divider }} />}
      <span aria-hidden style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.primarySoft, color: C.primary, fontSize: 14 }}>
        <FontAwesomeIcon icon={area.icon} />
      </span>
      <span style={{ flex: 1, minWidth: 0, padding: '12px 0', fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>{area.label}</span>
      <FontAwesomeIcon icon={faChevronRight} aria-hidden style={{ fontSize: 12, color: C.chevron, flexShrink: 0 }} />
    </Link>
  );
}

function NothingToManage({ teacherId }: { teacherId: string | null }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
      <FontAwesomeIcon icon={faBriefcase} style={{ fontSize: 22, color: C.muted, marginBottom: 8 }} />
      <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>Nothing to manage.</p>
      <p style={{ margin: 0, fontSize: 13, color: C.muted }}>An admin can give you access to more areas.</p>
      {teacherId && (
        <Link to={`/teachers/${teacherId}/home`} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, marginTop: 16, padding: '0 16px', borderRadius: 10, background: C.primary, color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
          Back to staff app
        </Link>
      )}
    </div>
  );
}
