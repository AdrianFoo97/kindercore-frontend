import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { TEACHER_NAV_SPACE } from './TeacherMobileNav.js';

// Teacher app (phone): the round "+" button pinned to the bottom-right
// corner, just above the bottom nav — the main "add" action of a list page
// (Report an Incident, Report a Facility Issue, Request an Item). Liquid glass,
// like the top bar's round buttons — tinted violet so the main action still
// stands out on a light page: see-through, blurring what scrolls behind it.
//
// Portaled to <body>: some mobile browsers don't keep a position:fixed
// element pinned when an ancestor is itself a scroll container.

const SIZE = 54;
const GAP_ABOVE_NAV = 26;
/** The violet accent (#7c3aed) as tinted glass — opaque enough for the white + to read clearly. */
const GLASS_TINT = 'rgba(124,58,237,0.82)';

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
        width: SIZE, height: SIZE, borderRadius: '50%', boxSizing: 'border-box',
        border: '1px solid rgba(255,255,255,0.38)',
        background: `linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%), ${GLASS_TINT}`,
        backdropFilter: 'blur(22px) saturate(180%)', WebkitBackdropFilter: 'blur(22px) saturate(180%)',
        color: '#fff', fontSize: 20, cursor: 'pointer', zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        // A soft violet glow below, and a bright rim on top — the glass edge catching light.
        boxShadow: '0 8px 24px rgba(124,58,237,0.30), 0 2px 6px rgba(15,23,42,0.12), inset 0 1px 0 rgba(255,255,255,0.45)',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <FontAwesomeIcon icon={faPlus} />
    </button>,
    document.body,
  );
}
