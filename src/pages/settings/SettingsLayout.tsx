import { useLayoutEffect, useRef, useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faSliders, faUsers } from '@fortawesome/free-solid-svg-icons';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { SETTINGS_HOME, groupSections, itemForPath, type SettingsGroup, type SettingsItem } from './settingsNav.js';
import { C } from './settingsTheme.js';
import { useCanOpenSettingsPath, useSettingsGroups } from './useSettingsAccess.js';

const SIDEBAR_WIDTH = 240;

/**
 * Wraps every settings page. Desktop: a sidebar of all settings, grouped,
 * with the current one highlighted (like macOS System Settings). Narrower
 * screens: a slim "‹ Settings" bar back to the list, like iOS Settings.
 * The Settings home page itself has neither — it IS the list.
 */
export default function SettingsLayout() {
  const { pathname } = useLocation();
  const { isTablet } = useIsMobile();
  const { groups } = useSettingsGroups();
  const current = itemForPath(pathname, groups);
  const { allowed, loading } = useCanOpenSettingsPath(pathname);

  if (pathname === SETTINGS_HOME) return <Outlet />;
  // A page outside this person's access roles (the server refuses its data anyway).
  if (loading) return null;
  if (!allowed) return <Navigate to="/no-access" replace />;
  if (isTablet) {
    return (
      <>
        <nav aria-label="Settings" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: '#fff', borderBottom: `1px solid ${C.border}` }}>
          <Link to={SETTINGS_HOME} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 8px', color: C.primary, fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>
            <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 13 }} /> Settings
          </Link>
          {current && <span style={{ fontSize: 15, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {current.label}</span>}
        </nav>
        <div className="settings-frame"><Outlet /></div>
      </>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', minHeight: '100%' }}>
      <SettingsSidebar groups={groups} current={current} />
      {/* .settings-frame (main.tsx) gives every settings page the same padding and content width. */}
      <div className="settings-frame" style={{ flex: 1, minWidth: 0 }}><Outlet /></div>
    </div>
  );
}

/** The nearest ancestor that scrolls (the app's content area under the navbar). */
function scrollParentOf(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if (overflowY === 'auto' || overflowY === 'scroll') return p;
  }
  return null;
}

interface Area { top: number; left: number; height: number }

/**
 * Where the scrolling content area sits on screen (just under the navbar) —
 * re-measured when it resizes. The sidebar is pinned to exactly this box.
 */
function useContentArea(ref: React.RefObject<HTMLElement>): Area | null {
  const [area, setArea] = useState<Area | null>(null);
  useLayoutEffect(() => {
    const scroller = scrollParentOf(ref.current);
    if (!scroller) return;
    const measure = () => {
      const r = scroller.getBoundingClientRect();
      setArea({ top: Math.round(r.top), left: Math.round(r.left), height: scroller.clientHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [ref]);
  return area;
}

function SettingsSidebar({ groups, current }: { groups: SettingsGroup[]; current: SettingsItem | null }) {
  // The placeholder keeps the sidebar's width in the layout; the sidebar itself
  // is pinned to the window (position: fixed) at the content area's top-left,
  // so neither page scrolling nor the footer below can move it. ("sticky"
  // can't: the footer sits outside the settings section and pushed it up.)
  const placeholder = useRef<HTMLDivElement>(null);
  const area = useContentArea(placeholder);
  return (
    <div ref={placeholder} style={{ width: SIDEBAR_WIDTH, flexShrink: 0, alignSelf: 'stretch' }}>
    <nav aria-label="Settings" style={{
      width: SIDEBAR_WIDTH, position: 'fixed', top: area?.top ?? 0, left: area?.left ?? 0, height: area?.height ?? '100vh',
      visibility: area ? 'visible' : 'hidden', zIndex: 1,
      // Scrolls on its own only if the list is longer than the screen — and that never scrolls the page behind.
      overflowY: 'auto', overscrollBehavior: 'contain',
      boxSizing: 'border-box', padding: '16px 12px 24px', background: '#fff', borderRight: `1px solid ${C.border}`,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <style>{`.st-side:hover { background: ${C.hover}; }`}</style>
      <Link to={SETTINGS_HOME} className="st-side" style={{ ...row, fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8 }}>
        <FontAwesomeIcon icon={faSliders} style={{ width: 16, color: C.muted }} /> Settings
      </Link>
      {groupSections(groups).map(sec => sec.section ? (
        // A section (HRMS): one tinted, bordered panel with its own header, so everything in it plainly belongs
        // to HRMS and its edge shows where HRMS ends. Its modules are sub-labels inside.
        <div key={sec.section} role="group" aria-labelledby={`side-sec-${sec.section}`} style={sectionPanel}>
          <div id={`side-sec-${sec.section}`} style={sectionHeader}>
            <FontAwesomeIcon icon={faUsers} style={{ width: 16, fontSize: 13, color: C.primary }} /> {sec.section}
          </div>
          {sec.groups.map(g => <SidebarGroup key={g.key} group={g} current={current} nested />)}
        </div>
      ) : sec.groups.map(g => <SidebarGroup key={g.key} group={g} current={current} />))}
    </nav>
    </div>
  );
}

/** One group's heading and its settings. Nested = a module under a section: a smaller, normal-case sub-label. */
function SidebarGroup({ group: g, current, nested = false }: { group: SettingsGroup; current: SettingsItem | null; nested?: boolean }) {
  return (
    <div style={{ marginTop: nested ? GROUP_GAP.nested : GROUP_GAP.top }}>
      <div style={nested ? moduleHeading : groupHeading}>{g.label}</div>
      {g.items.map(item => {
        const active = current?.key === item.key;
        return (
          <Link key={item.key} to={item.to} className={active ? undefined : 'st-side'} aria-current={active ? 'page' : undefined}
            style={{
              ...row, fontWeight: active ? 600 : 500,
              color: item.danger ? C.danger : active ? C.primaryDeep : C.sub,
              background: active ? C.primarySoft : undefined,
            }}>
            <FontAwesomeIcon icon={item.icon} style={{ width: 16, fontSize: 13, color: item.danger ? C.danger : active ? C.primary : C.muted }} />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

/** Space above each group (Money, Operations…) and each HRMS module inside a group — enough to read them as separate blocks. */
const GROUP_GAP = { top: 32, nested: 16 };
const groupHeading: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0 12px 8px' };
const moduleHeading: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: C.muted, padding: '4px 12px 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
};
const sectionPanel: React.CSSProperties = {
  marginTop: 16, padding: '8px 4px 8px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10,
};
const sectionHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 4px 8px', fontSize: 13.5, fontWeight: 700, color: C.text,
  borderBottom: `1px solid ${C.border}`, margin: '0 4px 4px', paddingBottom: 8,
};

const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, minHeight: 32, padding: '6px 12px', borderRadius: 8,
  fontSize: 13.5, textDecoration: 'none',
};
