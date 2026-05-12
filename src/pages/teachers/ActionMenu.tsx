import { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faEllipsisVertical, faRightFromBracket, faPenToSquare, faChartLine, faClipboardCheck,
  faSackDollar,
} from '@fortawesome/free-solid-svg-icons';
import { TP_C } from './tokens.js';

interface ActionMenuProps {
  onEdit: () => void;
  onCareer: () => void;
  onAppraisal: () => void;
  onCompensation: () => void;
  /** Omit to hide the Resign entry (e.g. for already-resigned teachers). */
  onResign?: () => void;
}

export function ActionMenu({ onEdit, onCareer, onAppraisal, onCompensation, onResign }: ActionMenuProps) {
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
          <button
            className="tp-menu-item"
            style={styles.menuItem}
            onClick={(e) => { e.stopPropagation(); setOpen(false); onCareer(); }}
          >
            <FontAwesomeIcon icon={faChartLine} style={{ fontSize: 11, width: 14 }} /> Career Path
          </button>
          <button
            className="tp-menu-item"
            style={styles.menuItem}
            onClick={(e) => { e.stopPropagation(); setOpen(false); onAppraisal(); }}
          >
            <FontAwesomeIcon icon={faClipboardCheck} style={{ fontSize: 11, width: 14 }} /> Appraisal
          </button>
          <button
            className="tp-menu-item"
            style={styles.menuItem}
            onClick={(e) => { e.stopPropagation(); setOpen(false); onCompensation(); }}
          >
            <FontAwesomeIcon icon={faSackDollar} style={{ fontSize: 11, width: 14 }} /> Compensation
          </button>
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
  divider: {
    height: 1,
    background: TP_C.divider,
    margin: '4px 0',
  },
};
