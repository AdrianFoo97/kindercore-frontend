import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBullseye, faChevronRight } from '@fortawesome/free-solid-svg-icons';

export interface FocusPalette { card: string; cardBorder: string; pSoft: string; pAccent: string; pBorder: string; textStrong: string; muted: string; mutedSoft: string }

interface FocusMission { id: string; title: string; required?: boolean | null }

/**
 * Home → Current Focus: one card per pinned quest (up to three), each opening
 * that quest. With none pinned, a single card leads to the board to pick one.
 */
export default function CurrentFocus({ missions, nextRole, hasOpenMissions, palette, onOpen }: {
  missions: FocusMission[];
  nextRole: string | null;
  hasOpenMissions: boolean;
  palette: FocusPalette;
  /** A quest's id, or null for the board. */
  onOpen: (missionId: string | null) => void;
}) {
  if (missions.length === 0) {
    return (
      <FocusCard palette={palette} onClick={() => onOpen(null)}
        title={hasOpenMissions ? 'Pick your next focus' : "You're all caught up"}
        subtitle={hasOpenMissions ? 'Pin up to three quests from the board to focus on.' : 'Nice work — explore what\'s next below.'} />
    );
  }
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {missions.map(m => (
        <FocusCard key={m.id} palette={palette} onClick={() => onOpen(m.id)} title={m.title}
          subtitle={m.required
            ? (nextRole ? `Required for promotion to ${nextRole}` : 'A required step')
            : (nextRole ? `A step toward ${nextRole}` : 'A growth step')} />
      ))}
    </div>
  );
}

function FocusCard({ title, subtitle, palette: C, onClick }: { title: string; subtitle: string; palette: FocusPalette; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={`Open ${title}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, width: '100%',
        textAlign: 'left', font: 'inherit', cursor: 'pointer', color: 'inherit',
        background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: 16,
        boxShadow: '0 1px 3px rgba(15,23,42,0.05)', WebkitTapHighlightColor: 'transparent',
      }}>
      <div style={{
        width: 42, height: 42, borderRadius: 13, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: C.pSoft, color: C.pAccent, fontSize: 17, border: `1px solid ${C.pBorder}`,
      }}>
        <FontAwesomeIcon icon={faBullseye} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.textStrong, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: 600, color: C.muted }}>{subtitle}</div>
      </div>
      <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 13, color: C.mutedSoft, flexShrink: 0 }} />
    </button>
  );
}