import React, { useEffect, useRef } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile.js';

export interface ConfirmDialogProps {
  /** Modal title (rendered as <h3>) */
  title: React.ReactNode;
  /** Body content — can be plain text or JSX */
  message: React.ReactNode;
  /** Label for the confirm button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Label for the cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Hide the cancel button entirely (e.g. for info-only confirmations). */
  hideCancel?: boolean;
  /** Renders the confirm button in red and uses "Delete" as default label. */
  destructive?: boolean;
  /** Shows "…" on the confirm button and disables both buttons (request in flight). */
  loading?: boolean;
  /** Disables the confirm button without changing its label (e.g. invalid form). */
  disabled?: boolean;
  /** Wider modal for richer content (e.g. tables, forms). */
  size?: 'sm' | 'md' | 'lg';
  onConfirm: () => void;
  onCancel: () => void;
}

const SIZE_WIDTHS: Record<NonNullable<ConfirmDialogProps['size']>, { min: number; max: number }> = {
  sm: { min: 320, max: 400 },
  md: { min: 380, max: 480 },
  lg: { min: 460, max: 560 },
};

/**
 * Generic confirmation dialog. Handles backdrop, layout, and the standard
 * Cancel + Confirm button row. Use `destructive` for delete-style actions.
 *
 * Example:
 *   <ConfirmDialog
 *     title="Delete Half Day?"
 *     message="No packages depend on it. It will be removed on Save."
 *     destructive
 *     onConfirm={() => doDelete()}
 *     onCancel={() => setOpen(false)}
 *   />
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  hideCancel = false,
  destructive = false,
  loading = false,
  disabled = false,
  size = 'md',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const widths = SIZE_WIDTHS[size];
  const finalConfirmLabel = confirmLabel ?? (destructive ? 'Delete' : 'Confirm');
  const { isMobile } = useIsMobile();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const confirmDisabled = loading || disabled;

  // Keyboard (design guide): Escape = Cancel; Return = confirm — but never for a
  // destructive action (a destructive button is never the Return-key default).
  // Focus starts on the safe choice for destructive actions.
  useEffect(() => {
    (destructive || hideCancel ? (hideCancel ? confirmRef : cancelRef) : confirmRef).current?.focus();
  }, [destructive, hideCancel]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !hideCancel && !loading) { e.preventDefault(); onCancel(); }
      const onButton = (e.target as HTMLElement | null)?.tagName === 'BUTTON';
      if (e.key === 'Enter' && !destructive && !confirmDisabled && !onButton) { e.preventDefault(); onConfirm(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Phone: iPhone-alert proportions — full-width 44px buttons, centred text.
  const button = (primary: boolean): React.CSSProperties => ({
    minHeight: isMobile ? 44 : 32, padding: '0 18px', flex: isMobile ? 1 : undefined,
    border: 'none', borderRadius: 8, fontWeight: primary ? 700 : 600, fontSize: isMobile ? 15 : 13, fontFamily: 'inherit',
  });

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, padding: isMobile ? '20px 16px 16px' : '24px',
          width: isMobile ? 'min(320px, 100%)' : `min(${widths.max}px, 100%)`,
          minWidth: isMobile ? 0 : `min(${widths.min}px, 100%)`,
          maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box',
          boxShadow: '0 16px 48px rgba(15,23,42,0.25)', textAlign: isMobile ? 'center' : 'left',
        }}
      >
        <h3 id="confirm-dialog-title" style={{ margin: '0 0 8px', fontSize: isMobile ? 17 : 16, fontWeight: 700, color: '#0f172a' }}>
          {title}
        </h3>
        <div style={{ margin: '0 0 16px', fontSize: isMobile ? 14 : 13, color: '#475569', lineHeight: 1.5 }}>
          {message}
        </div>
        {/* Cancel leading, the action trailing. */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {!hideCancel && (
            <button
              ref={cancelRef}
              onClick={onCancel}
              disabled={loading}
              style={{ ...button(false), background: '#f1f5f9', color: '#334155', cursor: loading ? 'default' : 'pointer' }}
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={confirmDisabled}
            style={{
              ...button(true),
              background: destructive ? '#dc2626' : '#5a67d8', color: '#fff',
              cursor: confirmDisabled ? 'default' : 'pointer', opacity: confirmDisabled ? 0.5 : 1,
            }}
          >
            {loading ? 'Working…' : finalConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
