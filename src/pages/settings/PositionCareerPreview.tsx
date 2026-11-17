import { uploadUrl } from '../../api/upload.js';

const C = { text: '#0f172a', sub: '#334155', muted: '#64748b', border: '#e2e8f0', bg: '#f8fafc' };

/**
 * How the position appears on a teacher's Career Journey — its badge, name,
 * role focus (bold) and description, and its star colour — so they're edited
 * with the result in view.
 */
export default function PositionCareerPreview({ name, roleFocus, description, badgeUrl, starColor, onPath }: {
  name: string; roleFocus: string; description: string; badgeUrl: string; starColor: string; onPath: boolean;
}) {
  return (
    <section aria-label="Career Journey preview" style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>Career Journey preview</div>
      {!onPath ? (
        <p style={{ margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Not on the career path, so it isn’t shown on the Career Journey.</p>
      ) : (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 48, height: 48, borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {badgeUrl ? <img src={uploadUrl(badgeUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 11, color: C.muted }}>No badge</span>}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{name.trim() || 'Position name'}</span>
              {starColor && <span title="Star colour" aria-label="Star colour" style={{ width: 10, height: 10, borderRadius: 999, background: starColor, border: `1px solid ${C.border}` }} />}
            </div>
            {roleFocus.trim() && <div style={{ fontSize: 13, fontWeight: 700, color: C.sub, marginTop: 4 }}>{roleFocus.trim()}</div>}
            <p style={{ margin: '4px 0 0', fontSize: 13, color: description.trim() ? C.sub : C.muted, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {description.trim() || 'No description yet.'}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
