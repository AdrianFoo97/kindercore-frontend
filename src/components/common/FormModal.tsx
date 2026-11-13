import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import ConfirmDialog from './ConfirmDialog.js';

// A small form pop-up, laid out per the design guide:
//  - Phone (iOS): a bottom sheet — grabber, Cancel top-leading, the main
//    action top-trailing, swipe down / tap outside to dismiss, safe-area aware.
//  - Desktop (macOS): a centred dialog — Cancel leading, main action trailing
//    in the footer; Return = main action, Escape = Cancel.
// With unsaved changes (`dirty`), dismissing asks before discarding.

export interface FormModalPrimary {
  label: string;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  /** Button colour — defaults to the admin indigo. */
  tone?: string;
}

interface Props {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** The main action. Omit for a read-only sheet (then only "Close"). */
  primary?: FormModalPrimary;
  /** Defaults to "Cancel" (or "Close" when there's no main action). */
  cancelLabel?: string;
  /** True while there are unsaved changes — dismissing then asks first. */
  dirty?: boolean;
  width?: number;
}

const SWIPE_CLOSE_PX = 90;
const INDIGO = '#5a67d8';

export default function FormModal({ title, subtitle, onClose, children, primary, cancelLabel, dirty, width = 520 }: Props) {
  const { isMobile } = useIsMobile();
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);
  const cancelText = cancelLabel ?? (primary ? 'Cancel' : 'Close');
  const canSubmit = !!primary && !primary.busy && !primary.disabled;

  const requestClose = () => { if (dirty) setConfirmingDiscard(true); else onClose(); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirmingDiscard) return;
      if (e.key === 'Escape') { e.preventDefault(); requestClose(); }
      // Return = the main action, except inside a multi-line field or on a focused button.
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key === 'Enter' && !e.shiftKey && tag !== 'TEXTAREA' && tag !== 'BUTTON' && canSubmit) { e.preventDefault(); primary!.onClick(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const primaryButton = primary && (
    <button type="button" onClick={primary.onClick} disabled={!canSubmit} style={isMobile
      ? { ...sheetTextBtn, fontWeight: 700, color: canSubmit ? (primary.tone ?? INDIGO) : '#94a3b8', cursor: canSubmit ? 'pointer' : 'default' }
      : modalBtn.primary(!canSubmit, primary.tone)}>
      {primary.label}
    </button>
  );

  const discardDialog = confirmingDiscard && (
    <ConfirmDialog title="Discard changes?" message="What you’ve entered here will be lost." confirmLabel="Discard" destructive
      onConfirm={() => { setConfirmingDiscard(false); onClose(); }} onCancel={() => setConfirmingDiscard(false)} />
  );

  if (isMobile) {
    // Swipe down on the grabber / header to dismiss.
    const onTouchStart = (e: React.TouchEvent) => { dragStart.current = e.touches[0].clientY; };
    const onTouchMove = (e: React.TouchEvent) => {
      if (dragStart.current == null) return;
      setDragY(Math.max(0, e.touches[0].clientY - dragStart.current));
    };
    const onTouchEnd = () => {
      if (dragY > SWIPE_CLOSE_PX) requestClose();
      setDragY(0);
      dragStart.current = null;
    };
    return createPortal(
      <>
        <div role="presentation" onClick={requestClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 1000, animation: 'kcFade 180ms ease-out' }} />
        <div role="dialog" aria-modal="true" aria-label={title} style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1001, background: '#fff',
          borderRadius: '16px 16px 0 0', maxHeight: 'calc(100dvh - 40px)', display: 'flex', flexDirection: 'column',
          boxShadow: '0 -8px 30px rgba(15,23,42,0.18)', paddingBottom: 'env(safe-area-inset-bottom)',
          transform: `translateY(${dragY}px)`, transition: dragY ? 'none' : 'transform 200ms ease-out',
          animation: 'kcSheetUp 240ms cubic-bezier(0.2,0.8,0.2,1)',
        }}>
          <style>{'@keyframes kcSheetUp{from{transform:translateY(100%)}to{transform:none}}@keyframes kcFade{from{opacity:0}to{opacity:1}}'}</style>
          <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} style={{ touchAction: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 2px' }}>
              <span aria-hidden style={{ width: 36, height: 5, borderRadius: 999, background: '#cbd5e1' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, padding: '2px 8px 8px', borderBottom: '1px solid #f1f5f9' }}>
              <div><button type="button" onClick={requestClose} style={sheetTextBtn}>{cancelText}</button></div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55vw' }}>{title}</h2>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{primaryButton}</div>
            </div>
          </div>
          <div style={{ padding: '16px 16px 24px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {subtitle && <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>{subtitle}</div>}
            {children}
          </div>
        </div>
        {discardDialog}
      </>,
      document.body,
    );
  }

  return (
    <div role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) requestClose(); }} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div role="dialog" aria-modal="true" aria-label={title} style={{
        background: '#fff', borderRadius: 14, width: `min(${width}px, 100%)`, maxHeight: 'calc(100vh - 32px)',
        display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(15,23,42,0.25)', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{title}</h2>
          {subtitle && <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>{subtitle}</div>}
        </div>
        <div style={{ padding: 24, overflowY: 'auto' }}>{children}</div>
        {/* macOS: Cancel leading, main action trailing (the Return-key default). */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#fafbfc' }}>
          <button type="button" onClick={requestClose} style={modalBtn.cancel}>{cancelText}</button>
          {primaryButton}
        </div>
      </div>
      {discardDialog}
    </div>
  );
}

const sheetTextBtn: React.CSSProperties = {
  minHeight: 44, minWidth: 44, padding: '0 8px', border: 'none', background: 'none', color: INDIGO,
  fontSize: 16, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
};

export const modalBtn = {
  cancel: {
    minHeight: 32, padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#334155',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  } as React.CSSProperties,
  primary: (busy: boolean, color = INDIGO): React.CSSProperties => ({
    minHeight: 32, padding: '8px 20px', borderRadius: 8, border: 'none', background: color, color: '#fff',
    fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
  }),
};
