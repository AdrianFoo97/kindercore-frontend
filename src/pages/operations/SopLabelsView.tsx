import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faTag } from '@fortawesome/free-solid-svg-icons';
import { NO_LABEL, type LabelSummary } from './sopLabels.js';

// How-To Guides → Labels: every label as a row ("Morning routine · 4 guides ›"),
// plus the guides with no label. It reuses the guide list's own row, icon,
// count and empty styles (passed in by the page), so both views look the same —
// the page owns the toolbar (search + sort) for both.

export interface ListLook {
  row: React.CSSProperties;
  icon: React.CSSProperties;
  title: React.CSSProperties;
  meta: React.CSSProperties;
  /** The "N items" line above the list; omit to hide it (teacher app). */
  count?: React.CSSProperties;
  empty: React.CSSProperties;
  chevronColor: string;
}

export function SopLabelsList({ labels, unlabelled, query, look, onOpen }: {
  /** Already searched + sorted. */
  labels: LabelSummary[];
  unlabelled: number;
  query: string;
  look: ListLook;
  onOpen: (labelId: string) => void;
}) {
  const searching = query.trim() !== '';
  // "No label" isn't a name you'd search for — only in the full list.
  const showUnlabelled = !searching && unlabelled > 0;
  const total = labels.length + (showUnlabelled ? 1 : 0);

  if (total === 0) {
    return (
      <div style={look.empty}>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
          {searching ? `No labels match "${query.trim()}".` : 'No labels yet — give guides a label to group them here.'}
        </p>
      </div>
    );
  }
  return (
    <>
      {look.count && <div style={look.count}>{labels.length} label{labels.length === 1 ? '' : 's'}</div>}
      <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: look.count ? 12 : 0 }}>
        {labels.map(l => <LabelRow key={l.id} label={l} look={look} onOpen={() => onOpen(l.id)} />)}
        {showUnlabelled && (
          <LabelRow label={{ id: NO_LABEL, name: 'No label', color: '#94a3b8', count: unlabelled }} look={look} muted onOpen={() => onOpen(NO_LABEL)} />
        )}
      </div>
    </>
  );
}

function LabelRow({ label: l, look, muted, onOpen }: { label: LabelSummary; look: ListLook; muted?: boolean; onOpen: () => void }) {
  return (
    <div role="listitem" className="sop-tpl-row" tabIndex={0} onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      style={look.row}>
      {/* Same tile as a guide's icon, tinted with the label's own colour. */}
      <div style={{ ...look.icon, background: `${l.color}22`, color: muted ? '#64748b' : l.color }}>
        <FontAwesomeIcon icon={faTag} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ ...look.title, color: muted ? '#64748b' : look.title.color }}>{l.name}</span>
        <div style={{ marginTop: 4 }}>
          <span style={look.meta}>{l.count} guide{l.count === 1 ? '' : 's'}</span>
        </div>
      </div>
      <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 12, color: look.chevronColor, marginLeft: 4, flexShrink: 0 }} />
    </div>
  );
}

/** Above a label's guides: "‹ All labels", then the label's name (the list's own count line follows). */
export function SopLabelHeader({ name, color, onAllLabels }: { name: string; color: string; onAllLabels: () => void }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <button type="button" onClick={onAllLabels} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, padding: 0, border: 'none', background: 'none',
        color: 'var(--sop-accent)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
      }}>
        <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 11 }} /> All labels
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{name}</h2>
      </div>
    </div>
  );
}
