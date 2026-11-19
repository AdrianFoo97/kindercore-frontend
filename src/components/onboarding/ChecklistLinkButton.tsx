import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { isExternalLink } from '../../pages/checklistItems.js';

// The button on a checklist item that has a link — a web address opens in a
// new tab, a page in the app opens in place. Clicking it never ticks the item.

export default function ChecklistLinkButton({ label, url, accent = '#4f5bd5', size = 'md' }: {
  label: string; url: string; accent?: string;
  /** 'lg' for the phone app (44px tap target). */
  size?: 'md' | 'lg';
}) {
  const style: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap',
    minHeight: size === 'lg' ? 44 : 30, padding: size === 'lg' ? '0 14px' : '0 10px', borderRadius: size === 'lg' ? 12 : 8,
    border: `1px solid ${accent}`, background: '#fff', color: accent,
    fontSize: size === 'lg' ? 13 : 12, fontWeight: 700, textDecoration: 'none',
  };
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  if (isExternalLink(url)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" onClick={stop} style={style} title={`${label} (opens in a new tab)`}>
        {label} <FontAwesomeIcon icon={faArrowUpRightFromSquare} style={{ fontSize: 10 }} />
      </a>
    );
  }
  return (
    <Link to={url} onClick={stop} style={style}>
      {label} <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 10 }} />
    </Link>
  );
}
