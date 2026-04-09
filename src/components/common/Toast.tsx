import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faCircleXmark, faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';

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
        <div style={{
          position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          background: toast.type === 'success' ? '#0f172a' : '#dc2626', color: '#fff',
          padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 500,
          boxShadow: '0 6px 32px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', gap: 8, maxWidth: 'calc(100vw - 32px)',
        }}>
          <FontAwesomeIcon icon={toast.type === 'success' ? faCircleCheck : faCircleXmark} style={{ flexShrink: 0 }} />
          <span>
            {toast.message}
            {toast.action && (
              <span onClick={() => { toast.action!.onClick(); setToast(null); }}
                style={{ color: '#fff', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', marginLeft: 4 }}>
                {toast.action.label}
              </span>
            )}
          </span>
          {toast.link && (
            <a href={toast.link} target="_blank" rel="noreferrer" style={{ color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'underline', opacity: 0.9, whiteSpace: 'nowrap' }}>
              View <FontAwesomeIcon icon={faArrowUpRightFromSquare} style={{ marginLeft: 4, fontSize: 11 }} />
            </a>
          )}
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 14, padding: '0 0 0 8px', lineHeight: 1 }}>✕</button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
