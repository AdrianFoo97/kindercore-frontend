import { useLayoutEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faSliders } from '@fortawesome/free-solid-svg-icons';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { useIsTestServer } from '../../hooks/useIsTestServer.js';
import { SETTINGS_HOME, itemForPath, visibleGroups, type SettingsGroup, type SettingsItem } from './settingsNav.js';
import { C, isAdminRole, storedRole } from './settingsTheme.js';

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
  const groups = visibleGroups(useIsTestServer(isAdminRole(storedRole())));
  const current = itemForPath(pathname, groups);

  if (pathname === SETTINGS_HOME) return <Outlet />;
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
      {groups.map(g => (
        <div key={g.key} style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0 12px 4px' }}>{g.label}</div>
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
      ))}
    </nav>
    </div>
  );
}

const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, minHeight: 32, padding: '6px 12px', borderRadius: 8,
  fontSize: 13.5, textDecoration: 'none',
};
