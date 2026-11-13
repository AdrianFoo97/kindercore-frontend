import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

/**
 * Something you need to know before acting on a settings page (what a tool
 * changes, a caveat). Settings pages have no description under the title —
 * only these notes, where the information really matters.
 */
export default function SettingsNote({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warning' }) {
  const warn = tone === 'warning';
  return (
    <div role="note" style={{
      display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 16px', margin: '0 0 24px', borderRadius: 10,
      fontSize: 13, lineHeight: 1.5, color: warn ? '#92400e' : '#334155',
      background: warn ? '#fffbeb' : '#f1f5f9', border: `1px solid ${warn ? '#fde68a' : '#e2e8f0'}`,
    }}>
      <FontAwesomeIcon icon={warn ? faTriangleExclamation : faCircleInfo} style={{ marginTop: 3, flexShrink: 0, color: warn ? '#b45309' : '#64748b' }} />
      <div>{children}</div>
    </div>
  );
}
