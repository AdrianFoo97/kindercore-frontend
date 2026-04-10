import React, {
  createContext, useCallback, useContext, useEffect, useState, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation, faCircleInfo } from '@fortawesome/free-solid-svg-icons';

// ─── Public types ────────────────────────────────────────────────────────────

/**
 * A single dependency that prevents deletion.
 * `count` of 0 is silently ignored — only positive counts contribute to the
 * blocked state.
 *
 * Examples:
 *   { label: 'package',  count: 4 }   → "4 packages"
 *   { label: 'student',  count: 1 }   → "1 student"
 *   { label: 'enrolment', count: 12 } → "12 enrolments"
 */
export interface Dependency {
  /** Singular noun. The component pluralises automatically when count !== 1. */
  label: string;
  count: number;
}

/**
 * The full configuration accepted by both the controlled component and the
 * imperative hook (`useDeleteDialog().confirm(...)`).
 */
export interface DeleteDialogOptions {
  /** Entity category, e.g. "Age Group", "Programme", "Student". */
  entityType: string;
  /** Display name of the specific entity, e.g. "Age 3", "Half Day". */
  entityName: string;
  /** If any has count > 0, the dialog enters the blocked state and prevents deletion. */
  dependencies?: Dependency[];
  /** Override the auto-generated title (rare — most callers should let the dialog format it). */
  title?: ReactNode;
  /** Override the irreversible-action sentence in the deletable state. */
  consequence?: ReactNode;
  /** Override the help line in the blocked state. */
  blockedHint?: ReactNode;
  /** Custom label for the confirm button. Defaults to "Delete". */
  actionLabel?: string;
  /** Optional rich content rendered above the buttons (e.g. a list of items being deleted). */
  extra?: ReactNode;
  /** When true, the user must type the entity name (case-insensitive) before Delete enables.
   *  Use for high-risk destructive actions like deleting tenants or accounts. */
  requireTypedConfirmation?: boolean;
}

/**
 * Props for the controlled component. Use this when you want to manage open
 * state yourself (e.g. inline JSX). For most call sites the imperative hook
 * is cleaner — see `useDeleteDialog`.
 */
export interface DeleteDialogProps extends DeleteDialogOptions {
  /**
   * Confirm handler. May be sync or async; when it returns a Promise the
   * dialog automatically shows a loading state and stays open until it
   * settles. If the promise resolves, `onCancel` is called to close the
   * dialog. If it rejects, the dialog stays open and the error must be
   * handled by the caller (typically via toast).
   */
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Top-tier destructive-action dialog. Two states:
 *
 *   1. **Deletable** — no dependencies. Shows the consequence and a red
 *      Delete button. Optionally requires typing the entity name to confirm.
 *
 *   2. **Blocked** — dependencies exist. Lists them, explains the user must
 *      remove them first, and shows only a Close button. There is no path
 *      from this state to deletion.
 *
 * The page never has to know which state it is — pass the dependencies and
 * let the dialog decide. This guarantees the user can never trigger a delete
 * that the backend would reject.
 *
 * Renders into a portal so the dialog escapes any local stacking context.
 */
export default function DeleteDialog({
  entityType,
  entityName,
  dependencies = [],
  title,
  consequence,
  blockedHint,
  actionLabel = 'Delete',
  extra,
  requireTypedConfirmation = false,
  onConfirm,
  onCancel,
}: DeleteDialogProps) {
  const blockingDeps = dependencies.filter(d => d.count > 0);
  const isBlocked = blockingDeps.length > 0;

  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  // Reset typed confirmation when the entity changes (defensive)
  useEffect(() => { setConfirmText(''); }, [entityName]);

  // ESC key closes the dialog (unless a save is in flight)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, loading]);

  const typedOk =
    !requireTypedConfirmation ||
    confirmText.trim().toLowerCase() === entityName.trim().toLowerCase();
  const canDelete = !isBlocked && typedOk && !loading;

  const handleConfirm = async () => {
    if (!canDelete) return;
    try {
      const result = onConfirm();
      if (result instanceof Promise) {
        setLoading(true);
        await result;
        onCancel();
      } else {
        // sync handler — caller is responsible for closing
      }
    } catch {
      // Caller handles errors (e.g. toast). Keep the dialog open.
    } finally {
      setLoading(false);
    }
  };

  const dialog = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      style={s.backdrop}
      onClick={() => { if (!loading) onCancel(); }}
    >
      <div style={s.card} onClick={e => e.stopPropagation()}>
        {/* Icon header */}
        <div style={isBlocked ? s.iconWrapBlocked : s.iconWrapDanger}>
          <FontAwesomeIcon icon={isBlocked ? faCircleInfo : faTriangleExclamation} />
        </div>

        {isBlocked ? (
          // ─── Blocked state ────────────────────────────────────────────────
          <>
            <h3 id="delete-dialog-title" style={s.title}>
              {title ?? (
                <>
                  Can't delete {entityType.toLowerCase()}{' '}
                  <span style={s.entityName}>{entityName}</span>
                </>
              )}
            </h3>
            <p style={s.body}>
              This {entityType.toLowerCase()} is currently used by:
            </p>
            <ul style={s.depList}>
              {blockingDeps.map(d => (
                <li key={d.label} style={s.depItem}>
                  <span style={s.depCount}>{d.count}</span>
                  <span style={s.depLabel}>{pluralise(d.label, d.count)}</span>
                </li>
              ))}
            </ul>
            <p style={s.hint}>
              {blockedHint ?? `Please remove these dependencies before you can delete this ${entityType.toLowerCase()}.`}
            </p>
            {extra && <div style={{ marginBottom: 14 }}>{extra}</div>}
            <div style={s.footer}>
              <button type="button" onClick={onCancel} style={s.btnPrimary} autoFocus>
                Close
              </button>
            </div>
          </>
        ) : (
          // ─── Deletable state ──────────────────────────────────────────────
          <>
            <h3 id="delete-dialog-title" style={s.title}>
              {title ?? (
                <>
                  {actionLabel} {entityType.toLowerCase()}{' '}
                  <span style={s.entityName}>{entityName}</span>?
                </>
              )}
            </h3>
            <p style={s.body}>
              {consequence ?? (
                <>This will permanently delete <strong>{entityName}</strong>. This action cannot be undone.</>
              )}
            </p>

            {extra && <div style={{ marginBottom: 14 }}>{extra}</div>}

            {requireTypedConfirmation && (
              <div style={s.confirmInputWrap}>
                <label htmlFor="delete-dialog-confirm" style={s.confirmLabel}>
                  Type <strong style={{ color: '#dc2626' }}>{entityName}</strong> to confirm
                </label>
                <input
                  id="delete-dialog-confirm"
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                  disabled={loading}
                  style={{
                    ...s.confirmInput,
                    borderColor: typedOk && confirmText ? '#22c55e' : '#cbd5e1',
                  }}
                />
              </div>
            )}

            <div style={s.footer}>
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                style={s.btnGhost}
                autoFocus={!requireTypedConfirmation}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canDelete}
                style={{ ...s.btnDanger, ...(canDelete ? {} : s.btnDisabled) }}
              >
                {loading ? '…' : actionLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}

// ─── Imperative API: useDeleteDialog() + DeleteDialogProvider ────────────────

/**
 * Internal: open-state owned by the provider.
 *
 * `pendingClose` is a one-shot resolver — when the user dismisses (Cancel,
 * Close, ESC, backdrop), we resolve the caller's promise so awaiters can
 * tell the difference between "confirmed" and "cancelled".
 */
interface OpenState {
  options: DeleteDialogOptions;
  resolve: (confirmed: boolean) => void;
  onConfirm: () => void | Promise<void>;
}

interface DeleteDialogContextValue {
  /**
   * Open the delete dialog imperatively. Returns a promise that resolves to
   * `true` if the user confirmed and the action succeeded, or `false` if
   * they cancelled. If `onConfirm` throws, the dialog stays open and the
   * error propagates to the caller.
   *
   * Example:
   *   const { confirm } = useDeleteDialog();
   *   const ok = await confirm({
   *     entityType: 'Student',
   *     entityName: 'John Doe',
   *     dependencies: [],
   *     onConfirm: async () => { await api.deleteStudent(id); },
   *   });
   *   if (ok) showToast('Student deleted');
   */
  confirm: (options: DeleteDialogOptions & { onConfirm: () => void | Promise<void> }) => Promise<boolean>;
}

const DeleteDialogContext = createContext<DeleteDialogContextValue>({
  confirm: () => Promise.resolve(false),
});

/**
 * Hook to imperatively open a delete dialog from anywhere in the tree.
 * Requires the app to be wrapped in `<DeleteDialogProvider>`.
 */
export function useDeleteDialog() {
  return useContext(DeleteDialogContext);
}

/**
 * Provider that owns a single delete-dialog slot for the entire app.
 * Mount once near the top of your tree (alongside ToastProvider).
 *
 *   <ToastProvider>
 *     <DeleteDialogProvider>
 *       <App />
 *     </DeleteDialogProvider>
 *   </ToastProvider>
 */
export function DeleteDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<OpenState | null>(null);

  const confirm = useCallback<DeleteDialogContextValue['confirm']>((opts) => {
    return new Promise<boolean>((resolve) => {
      const { onConfirm, ...options } = opts;
      setOpen({ options, resolve, onConfirm });
    });
  }, []);

  const close = useCallback((confirmed: boolean) => {
    setOpen(curr => {
      curr?.resolve(confirmed);
      return null;
    });
  }, []);

  return (
    <DeleteDialogContext.Provider value={{ confirm }}>
      {children}
      {open && (
        <DeleteDialog
          {...open.options}
          onCancel={() => close(false)}
          onConfirm={async () => {
            await open.onConfirm();
            close(true);
          }}
        />
      )}
    </DeleteDialogContext.Provider>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Naive pluraliser — adds 's' when count !== 1 unless the word already ends
 * in 's'. For irregulars, pass the singular form and the dialog handles the
 * count. Override by passing the already-pluralised label if needed.
 */
function pluralise(word: string, count: number): string {
  if (count === 1) return word;
  if (word.endsWith('s')) return word;
  if (word.endsWith('y') && !/[aeiou]y$/i.test(word)) return word.slice(0, -1) + 'ies';
  return word + 's';
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.45)',
    zIndex: 1100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backdropFilter: 'blur(2px)',
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: '24px 26px 20px',
    width: '100%',
    maxWidth: 440,
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 16px 48px rgba(15, 23, 42, 0.18)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#0f172a',
  },

  iconWrapDanger: {
    width: 44,
    height: 44,
    borderRadius: 22,
    background: '#fef2f2',
    color: '#dc2626',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    marginBottom: 14,
  },
  iconWrapBlocked: {
    width: 44,
    height: 44,
    borderRadius: 22,
    background: '#eff6ff',
    color: '#2563eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    marginBottom: 14,
  },

  title: {
    margin: '0 0 8px',
    fontSize: 16,
    fontWeight: 700,
    color: '#0f172a',
    lineHeight: 1.4,
    letterSpacing: '-0.01em',
  },
  entityName: {
    color: '#dc2626',
    fontWeight: 700,
  },
  body: {
    margin: '0 0 14px',
    fontSize: 13,
    color: '#475569',
    lineHeight: 1.55,
  },

  depList: {
    margin: '0 0 14px',
    padding: '10px 14px',
    listStyle: 'none',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  depItem: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    fontSize: 13,
    color: '#0f172a',
  },
  depCount: {
    display: 'inline-block',
    minWidth: 20,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums' as any,
    color: '#0f172a',
  },
  depLabel: { color: '#475569' },

  hint: {
    margin: '0 0 16px',
    fontSize: 12,
    color: '#64748b',
    lineHeight: 1.55,
  },

  confirmInputWrap: { marginBottom: 16 },
  confirmLabel: {
    display: 'block',
    fontSize: 12,
    color: '#475569',
    marginBottom: 6,
  },
  confirmInput: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: 6,
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.12s',
  },

  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  btnGhost: {
    padding: '8px 16px',
    background: '#fff',
    color: '#475569',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnDanger: {
    padding: '8px 16px',
    background: '#dc2626',
    color: '#fff',
    border: '1px solid #dc2626',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnPrimary: {
    padding: '8px 18px',
    background: '#0f172a',
    color: '#fff',
    border: '1px solid #0f172a',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnDisabled: {
    background: '#fca5a5',
    borderColor: '#fca5a5',
    cursor: 'not-allowed',
    opacity: 0.7,
  },
};
