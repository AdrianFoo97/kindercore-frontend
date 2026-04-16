import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';

interface SettingsBreadcrumbProps {
  /** Single label ("Categories") or full sub-path ("Operating Cost > Categories") under Settings. */
  label: string | string[];
  /** Explicit parent page. When provided, a back button appears. */
  backTo?: string;
  /** Drop the default bottom margin when the parent row handles spacing. */
  inline?: boolean;
}

export function SettingsBreadcrumb({ label, backTo, inline }: SettingsBreadcrumbProps) {
  const navigate = useNavigate();
  // The back button only appears when a semantic parent page is defined —
  // most settings pages have no such parent (there's no /settings hub).
  const hasPrevious = backTo != null;
  const goBack = () => {
    if (backTo) navigate(backTo);
  };
  const crumbs = ['Settings', ...(Array.isArray(label) ? label : [label])];
  const lastIdx = crumbs.length - 1;
  return (
    <>
      <style>{`.sb-back-btn:hover { background: #f1f5f9 !important; color: #1e293b !important; border-color: #cbd5e1 !important; }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: inline ? 0 : 24 }}>
        {hasPrevious && (
          <button onClick={goBack} className="sb-back-btn" style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 7,
            border: '1px solid #e2e8f0',
            background: '#fff',
            color: '#64748b',
            cursor: 'pointer',
            transition: 'all 0.1s',
          }} title="Back">
            <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 11 }} />
          </button>
        )}
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 15,
              fontWeight: i === lastIdx ? 700 : 600,
              color: i === lastIdx ? '#334155' : '#64748b',
            }}>{c}</span>
            {i < lastIdx && <span style={{ color: '#94a3b8', fontSize: 14 }}>&gt;</span>}
          </span>
        ))}
      </div>
    </>
  );
}
