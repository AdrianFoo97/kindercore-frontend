import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faEllipsisVertical, faRightFromBracket, faPenToSquare, faChartLine, faClipboardCheck,
  faSackDollar, faMobileScreen, faListCheck,
} from '@fortawesome/free-solid-svg-icons';
import { TP_C } from './tokens.js';

interface ActionMenuProps {
  onEdit: () => void;
  onCareer: () => void;
  onAppraisal: () => void;
  onCompensation: () => void;
  /** Omit to hide the Resign entry (e.g. for already-resigned teachers). */
  onResign?: () => void;
  /** When set, Career Path / Appraisal / Compensation are rendered as
   *  disabled (greyed out, non-clickable) with this string as a native
   *  tooltip on each item. Used for non-career-progression positions
   *  (Staff etc.) where those flows don't apply. */
  careerDisabledReason?: string;
  /** Dev-only experimental link to the teacher-facing mobile
   *  compensation page. Omit to hide the entry. The caller is
   *  responsible for gating this (e.g. `import.meta.env.DEV`) so the
   *  menu only sees the prop when the entry should render. */
  onMyCompensationDev?: () => void;
  /** Dev-only experimental link to the teacher-facing mobile career
   *  hub. Same gating contract as `onMyCompensationDev`. */
  onMyCareerDev?: () => void;
  /** "Create Onboarding Tasks" — omit to hide (e.g. resigned staff). */
  onStartOnboarding?: () => void;
  /** Shown greyed out while they're already on HR → Onboarding. */
  onboardingInProgress?: boolean;
}

const MENU_WIDTH = 180;
const MENU_GAP = 4;
const VIEWPORT_MARGIN = 8;

export function ActionMenu({
  onEdit, onCareer, onAppraisal, onCompensation, onResign, careerDisabledReason, onMyCompensationDev, onMyCareerDev,
  onStartOnboarding, onboardingInProgress,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // Opens below the ⋯ button, or above it when the row is near the bottom of
  // the screen — measured after render so the flip uses the real menu height.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    const fitsBelow = rect.bottom + MENU_GAP + menuHeight <= window.innerHeight - VIEWPORT_MARGIN;
    const top = fitsBelow ? rect.bottom + MENU_GAP : Math.max(VIEWPORT_MARGIN, rect.top - MENU_GAP - menuHeight);
    const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN));
    setPos({ top, left });
  }, [open]);

  // The menu is fixed-position; close it rather than leave it floating when the page scrolls.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className="tp-more"
        style={styles.moreBtn}
        aria-label="More actions"
      >
        <FontAwesomeIcon icon={faEllipsisVertical} style={{ fontSize: 14 }} />
      </button>
      {open && ReactDOM.createPortal(
        <div ref={menuRef} style={{ ...styles.menu, top: pos.top, left: pos.left, visibility: pos.top ? 'visible' : 'hidden' }}>
          <button
            className="tp-menu-item"
            style={styles.menuItem}
            onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit(); }}
          >
            <FontAwesomeIcon icon={faPenToSquare} style={{ fontSize: 11, width: 14 }} /> Edit
          </button>
          <MenuItem
            icon={faChartLine}
            label="Career Path"
            disabledReason={careerDisabledReason}
            onClick={() => { setOpen(false); onCareer(); }}
          />
          <MenuItem
            icon={faClipboardCheck}
            label="Appraisal"
            disabledReason={careerDisabledReason}
            onClick={() => { setOpen(false); onAppraisal(); }}
          />
          <MenuItem
            icon={faSackDollar}
            label="Compensation"
            disabledReason={careerDisabledReason}
            onClick={() => { setOpen(false); onCompensation(); }}
          />
          {onStartOnboarding && (
            <>
              <div style={styles.divider} />
              <MenuItem
                icon={faListCheck}
                label="Create Onboarding Tasks"
                disabledReason={onboardingInProgress ? 'Onboarding already in progress — see HR → Onboarding' : undefined}
                onClick={() => { setOpen(false); onStartOnboarding(); }}
              />
            </>
          )}
          {(onMyCompensationDev || onMyCareerDev) && (
            <div style={styles.divider} />
          )}
          {onMyCareerDev && (
            <button
              type="button"
              className="tp-menu-item"
              style={styles.menuItem}
              onClick={(e) => { e.stopPropagation(); setOpen(false); onMyCareerDev(); }}
            >
              <FontAwesomeIcon icon={faMobileScreen} style={{ fontSize: 11, width: 14 }} />
              <span style={{ flex: 1 }}>My Career</span>
              <span style={styles.devTag}>Dev</span>
            </button>
          )}
          {onMyCompensationDev && (
            <button
              type="button"
              className="tp-menu-item"
              style={styles.menuItem}
              onClick={(e) => { e.stopPropagation(); setOpen(false); onMyCompensationDev(); }}
            >
              <FontAwesomeIcon icon={faMobileScreen} style={{ fontSize: 11, width: 14 }} />
              <span style={{ flex: 1 }}>My Compensation</span>
              {/* Dev tag — small slate pill that calls out this entry as an
                  in-development surface so admins don't mistake it for a
                  production feature. The whole entry is hidden in
                  production builds via the parent's env gate. */}
              <span style={styles.devTag}>Dev</span>
            </button>
          )}
          {onResign && (
            <>
              <div style={styles.divider} />
              <button
                className="tp-menu-item tp-menu-danger"
                style={{ ...styles.menuItem, color: TP_C.red }}
                onClick={(e) => { e.stopPropagation(); setOpen(false); onResign(); }}
              >
                <FontAwesomeIcon icon={faRightFromBracket} style={{ fontSize: 11, width: 14 }} /> Resign
              </button>
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

// Shared row renderer for the Career / Appraisal / Compensation items.
// Renders disabled (greyed, non-clickable) when `disabledReason` is set
// and exposes the reason as a native title tooltip on hover.
function MenuItem({
  icon, label, disabledReason, onClick,
}: {
  icon: any;
  label: string;
  disabledReason?: string;
  onClick: () => void;
}) {
  const disabled = !!disabledReason;
  return (
    <button
      type="button"
      className="tp-menu-item"
      style={{
        ...styles.menuItem,
        ...(disabled ? styles.menuItemDisabled : null),
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onClick();
      }}
      disabled={disabled}
      aria-disabled={disabled}
      title={disabledReason}
    >
      <FontAwesomeIcon icon={icon} style={{ fontSize: 11, width: 14 }} /> {label}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  moreBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: TP_C.muted,
    padding: '6px 8px',
    borderRadius: 6,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 120ms ease, color 120ms ease',
  },
  menu: {
    position: 'fixed' as const,
    zIndex: 9999,
    background: TP_C.card,
    border: `1px solid ${TP_C.border}`,
    borderRadius: 10,
    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14), 0 2px 6px rgba(15, 23, 42, 0.06)',
    width: 180,
    overflow: 'hidden',
    padding: '4px 0',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 500,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left' as const,
    fontFamily: 'inherit',
  },
  menuItemDisabled: {
    color: TP_C.mutedMore,
    cursor: 'default',
    opacity: 0.55,
  },
  devTag: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 6px',
    borderRadius: 999,
    background: TP_C.subtle,
    color: TP_C.muted,
    border: `1px solid ${TP_C.borderSoft}`,
    fontSize: 9,
    fontWeight: 800,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
  divider: {
    height: 1,
    background: TP_C.divider,
    margin: '4px 0',
  },
};
