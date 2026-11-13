import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faCircleXmark, faArrowUpRightFromSquare, faXmark } from '@fortawesome/free-solid-svg-icons';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastData {
  message: string;
  type: 'success' | 'error';
  link?: string;
  action?: ToastAction;
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error', link?: string, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success', link?: string, action?: ToastAction) => {
    setToast({ message, type, link, action });
    setTimeout(() => setToast(null), 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        // Full-width lane with 16px gutters, the toast centred in it — a "left: 50%"
        // box only gets half the screen to grow into, so on a phone it wrapped
        // into a tall, narrow block over the content.
        <div style={{
          position: 'fixed', top: 'calc(env(safe-area-inset-top) + 16px)', left: 16, right: 16, zIndex: 9999,
          display: 'flex', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <style>{`
            @keyframes kc-toast-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
            .kc-toast { animation: kc-toast-in 180ms ease-out; }
            @media (prefers-reduced-motion: reduce) { .kc-toast { animation: none; } }
          `}</style>
          <div className="kc-toast" role={toast.type === 'error' ? 'alert' : 'status'} style={{
            pointerEvents: 'auto', maxWidth: 480,
            background: toast.type === 'success' ? '#0f172a' : '#b91c1c', color: '#fff',
            padding: '10px 8px 10px 14px', borderRadius: 12, fontSize: 14, fontWeight: 500, lineHeight: 1.4,
            boxShadow: '0 8px 24px rgba(15,23,42,0.22)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <FontAwesomeIcon icon={toast.type === 'success' ? faCircleCheck : faCircleXmark} style={{ flexShrink: 0, color: toast.type === 'success' ? '#4ade80' : '#fff' }} />
            <span style={{ minWidth: 0 }}>
              {toast.message}
              {toast.action && (
                <button type="button" onClick={() => { toast.action!.onClick(); setToast(null); }}
                  style={{ background: 'none', border: 'none', padding: 0, color: '#fff', font: 'inherit', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', marginLeft: 6 }}>
                  {toast.action.label}
                </button>
              )}
            </span>
            {toast.link && (
              <a href={toast.link} target="_blank" rel="noreferrer" style={{ color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'underline', opacity: 0.9, whiteSpace: 'nowrap' }}>
                View <FontAwesomeIcon icon={faArrowUpRightFromSquare} style={{ marginLeft: 4, fontSize: 11 }} />
              </a>
            )}
            <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" style={{
              flexShrink: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', borderRadius: 8, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 13,
            }}>
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        </div>
      )}    </ToastContext.Provider>
  );
}
