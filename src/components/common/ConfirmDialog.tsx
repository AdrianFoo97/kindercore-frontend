import React from 'react';

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 12, padding: '22px 26px',
          minWidth: widths.min, maxWidth: widths.max,
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700, color: '#1a202c' }}>
          {title}
        </h3>
        <div style={{ margin: '0 0 18px', fontSize: 13, color: '#4a5568' }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {!hideCancel && (
            <button
              onClick={onCancel}
              disabled={loading}
              style={{
                padding: '8px 18px', background: '#edf2f7', color: '#4a5568',
                border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            disabled={loading || disabled}
            style={{
              padding: '8px 18px',
              background: destructive ? '#dc2626' : '#3182ce',
              color: '#fff', border: 'none', borderRadius: 8,
              fontWeight: 600, fontSize: 13,
              cursor: (loading || disabled) ? 'not-allowed' : 'pointer',
              opacity: (loading || disabled) ? 0.5 : 1,
            }}
          >
            {loading ? '…' : finalConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
