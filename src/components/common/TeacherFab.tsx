import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { TEACHER_NAV_SPACE } from './TeacherMobileNav.js';

// Teacher app (phone): the round "+" button pinned to the bottom-right
// corner, just above the bottom nav — the main "add" action of a list page
// (Report an Incident, Report a Facility Issue, Request an Item). Same look and
// position as the guide editor's "Add step" button.
//
// Portaled to <body>: some mobile browsers don't keep a position:fixed
// element pinned when an ancestor is itself a scroll container.

const SIZE = 54;
const GAP_ABOVE_NAV = 26;
const ACCENT = '#7c3aed';

/** Space to leave under a list so its last card can scroll clear of the button. */
export const TEACHER_FAB_CLEARANCE = SIZE + GAP_ABOVE_NAV;

export default function TeacherFab({ label, onClick }: { label: string; onClick: () => void }) {
  return createPortal(
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        position: 'fixed', right: 20, bottom: `calc(${TEACHER_NAV_SPACE} + ${GAP_ABOVE_NAV}px)`,
        width: SIZE, height: SIZE, borderRadius: '50%', border: 'none',
        background: ACCENT, color: '#fff', fontSize: 20, cursor: 'pointer', zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(15,23,42,0.20), 0 1px 4px rgba(15,23,42,0.12)',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <FontAwesomeIcon icon={faPlus} />
    </button>,
    document.body,
  );
}
