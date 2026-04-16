import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import { TP_C } from './tokens.js';

interface ResignDialogProps {
  name: string;
  onConfirm: (date: string) => Promise<void> | void;
  onCancel: () => void;
}

export function ResignDialog({ name, onConfirm, onCancel }: ResignDialogProps) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  const handleSubmit = async () => {
    if (!date) return;
    setSaving(true);
    await onConfirm(date);
    setSaving(false);
  };

  return ReactDOM.createPortal(
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.dialog} onClick={e => e.stopPropagation()}>
        <div style={styles.iconWrap}>
          <FontAwesomeIcon icon={faRightFromBracket} style={{ fontSize: 18, color: TP_C.red }} />
        </div>

        <div style={styles.title}>Resign {name}</div>
        <p style={styles.desc}>
          This will mark <strong style={{ color: TP_C.text }}>{name}</strong> as resigned and remove
          them from the active teacher list. This action can be reversed later.
        </p>

        <div style={styles.field}>
          <label style={styles.fieldLabel}>Last Working Day</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={styles.dateInput}
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ ...styles.cancelBtn, flex: 1 }}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!date || saving}
            style={{ ...styles.resignBtn, flex: 1, opacity: !date || saving ? 0.5 : 1 }}
          >
            {saving ? 'Processing...' : 'Confirm Resign'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 1000,
    background: 'rgba(15, 23, 42, 0.32)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    background: TP_C.card,
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 380,
    boxShadow: '0 24px 60px rgba(15, 23, 42, 0.22)',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: TP_C.redBg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 17, fontWeight: 700, color: TP_C.text, marginBottom: 6 },
  desc: { fontSize: 13, color: TP_C.muted, margin: '0 0 20px', lineHeight: 1.6 },
  field: { background: '#f8fafc', borderRadius: 10, padding: '14px 16px', marginBottom: 20 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: TP_C.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    display: 'block',
    marginBottom: 6,
  },
  dateInput: {
    padding: '9px 12px',
    fontSize: 14,
    border: `1.5px solid ${TP_C.border}`,
    borderRadius: 8,
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box' as const,
    background: TP_C.card,
  },
  cancelBtn: {
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 8,
    border: `1px solid ${TP_C.border}`,
    background: TP_C.card,
    color: TP_C.text,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 120ms ease',
  },
  resignBtn: {
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 8,
    border: 'none',
    background: TP_C.red,
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 120ms ease',
  },
};
