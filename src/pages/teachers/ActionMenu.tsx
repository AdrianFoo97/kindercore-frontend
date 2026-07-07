import { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faEllipsisVertical, faRightFromBracket, faPenToSquare, faChartLine, faClipboardCheck,
  faSackDollar, faMobileScreen,
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
}

export function ActionMenu({ onEdit, onCareer, onAppraisal, onCompensation, onResign, careerDisabledReason, onMyCompensationDev, onMyCareerDev }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.right - 180 });
    }
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
        <div ref={menuRef} style={{ ...styles.menu, top: pos.top, left: pos.left }}>
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
