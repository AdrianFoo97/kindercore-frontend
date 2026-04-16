import { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsisVertical, faRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import { TP_C } from './tokens.js';

interface ActionMenuProps {
  onResign: () => void;
}

export function ActionMenu({ onResign }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.right - 160 });
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
            className="tp-menu-item tp-menu-danger"
            style={{ ...styles.menuItem, color: TP_C.red }}
            onClick={(e) => { e.stopPropagation(); setOpen(false); onResign(); }}
          >
            <FontAwesomeIcon icon={faRightFromBracket} style={{ fontSize: 11, width: 14 }} /> Resign
          </button>
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
    width: 160,
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
};
