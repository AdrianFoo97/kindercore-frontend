import { useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faMobileScreen } from '@fortawesome/free-solid-svg-icons';
import { useGoBack } from '../../hooks/useGoBack.js';
import NotificationBell from '../../components/common/NotificationBell.js';
import StaffMoreMenu from '../../components/common/StaffMoreMenu.js';
import { MANAGER_HOME } from './useManagerAreas.js';

// The phone header in manager view — instead of the admin nav bar, which the
// manager view's list replaces. Back (to the list, or wherever they came
// from), then the same bell and "⋯" as the staff app; the ⋯ menu's first
// item switches back to the staff view.

export const MANAGER_TOPBAR_HEIGHT = 52;

const C = { border: '#e2e8f0', text: '#0f172a' };

export default function ManagerTopBar({ teacherId }: { teacherId: string }) {
  const { pathname } = useLocation();
  const goBack = useGoBack(MANAGER_HOME);
  const onHome = pathname === MANAGER_HOME;

  return (
    <header style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, boxSizing: 'content-box',
      height: MANAGER_TOPBAR_HEIGHT, padding: '0 8px', paddingTop: 'env(safe-area-inset-top)',
      // On the list page the bar blends into the page under its large title; elsewhere it's a plain white header.
      background: onHome ? '#f8fafc' : '#ffffff', borderBottom: onHome ? '1px solid transparent' : `1px solid ${C.border}`,
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    }}>
      {!onHome && (
        <button type="button" onClick={goBack} aria-label="Back" title="Back" style={{
          width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none',
          background: 'none', color: C.text, fontSize: 17, cursor: 'pointer', borderRadius: 10,
        }}>
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>
      )}
      {/* On the list page the large title below says it — the bar doesn't repeat it. */}
      <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {!onHome && 'Manager view'}
      </span>
      <NotificationBell variant="teacher" />
      <StaffMoreMenu teacherId={teacherId}
        viewSwitch={{ to: `/teachers/${teacherId}/home`, label: 'Staff view', icon: faMobileScreen }} />
    </header>
  );
}
