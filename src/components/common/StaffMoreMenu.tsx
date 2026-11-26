import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faBug, faCircleUser, faEllipsisVertical, faLightbulb, faMobileScreenButton } from '@fortawesome/free-solid-svg-icons';
import { useInstallApp } from '../../hooks/useInstallApp.js';

// The staff "⋯" — the same liquid-glass button and menu in the staff app
// (TeacherTopBar) and the manager view (ManagerTopBar). First, when there is
// one, the switch between the two views; then My Profile, Report a Bug,
// Request a Feature, and Install app (Android). The caller places the button.

export interface ViewSwitch { to: string; label: string; icon: IconDefinition }

const BUTTON_SIZE = 32;
const MENU_GAP = 6;
const ACCENT = '#7c3aed';

const itemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', width: '100%', padding: '8px 10px', minHeight: 36, boxSizing: 'border-box',
  borderRadius: 7, color: '#334155', textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit', textAlign: 'left',
};

export default function StaffMoreMenu({ teacherId, viewSwitch, font }: {
  /** The signed-in staff member — their My Profile and its spokes. */
  teacherId: string | null;
  /** Switch to the other view (Manager view ⇄ Staff view), shown first. */
  viewSwitch?: ViewSwitch | null;
  font?: string;
}) {
  const { pathname } = useLocation();
  const installApp = useInstallApp();
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = anchor !== null;
  const close = () => setAnchor(null);

  useEffect(() => { setAnchor(null); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setAnchor(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAnchor(null); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const profile = teacherId ? `/teachers/${teacherId}/settings` : null;
  const links = profile ? [
    { to: profile, icon: faCircleUser, label: 'My Profile' },
    { to: `${profile}/report-bug`, icon: faBug, label: 'Report a Bug' },
    { to: `${profile}/request-feature`, icon: faLightbulb, label: 'Request a Feature' },
  ] : [];

  return (
    <>
      <button className="tap" ref={buttonRef} type="button"
        onClick={() => setAnchor(open ? null : buttonRef.current?.getBoundingClientRect() ?? null)}
        aria-label={open ? 'Close menu' : 'Open menu'} title={open ? 'Close menu' : 'Open menu'} aria-expanded={open}
        style={{
          width: BUTTON_SIZE, height: BUTTON_SIZE, borderRadius: '50%', boxSizing: 'border-box', padding: 0,
          // Liquid glass, as on every staff-app page.
          border: '1px solid rgba(255,255,255,0.32)', background: 'rgba(255,255,255,0.22)',
          backdropFilter: 'blur(22px) saturate(180%)', WebkitBackdropFilter: 'blur(22px) saturate(180%)',
          boxShadow: '0 2px 10px rgba(15,23,42,0.12)', transition: 'background 180ms ease, box-shadow 180ms ease',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, cursor: 'pointer', outline: 'none',
          color: '#334155', WebkitAppearance: 'none', WebkitTapHighlightColor: 'transparent',
        }}>
        <FontAwesomeIcon icon={faEllipsisVertical} />
      </button>
      {anchor && createPortal(
        <div ref={menuRef} role="menu" style={{
          position: 'fixed', top: anchor.bottom + MENU_GAP, right: Math.max(8, window.innerWidth - anchor.right),
          width: 200, background: '#fff', border: '1px solid #eceef2', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(15,23,42,0.14)', zIndex: 91, overflow: 'hidden', padding: 4, fontFamily: font,
        }}>
          {viewSwitch && (
            <>
              <NavLink to={viewSwitch.to} onClick={close} role="menuitem" style={itemStyle}>
                <FontAwesomeIcon icon={viewSwitch.icon} style={{ width: 14, marginRight: 8, color: ACCENT }} />
                {viewSwitch.label}
              </NavLink>
              {(links.length > 0 || installApp.canInstall) && <div style={{ height: 1, background: '#eceef2', margin: '4px 0' }} />}
            </>
          )}
          {links.map(item => (
            <NavLink key={item.label} to={item.to} onClick={close} role="menuitem" style={itemStyle}>
              <FontAwesomeIcon icon={item.icon} style={{ width: 14, marginRight: 8, color: ACCENT }} />
              {item.label}
            </NavLink>
          ))}
          {/* Android only, while Chrome says the app can be installed. */}
          {installApp.canInstall && (
            <button type="button" role="menuitem" onClick={() => { close(); void installApp.install(); }} style={itemStyle}>
              <FontAwesomeIcon icon={faMobileScreenButton} style={{ width: 14, marginRight: 8, color: ACCENT }} />
              Install app
            </button>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
