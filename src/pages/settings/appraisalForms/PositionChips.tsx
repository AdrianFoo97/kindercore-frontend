import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import type { Position } from '../../../types/index.js';
import { C } from './formTheme.js';

interface Props {
  positions: Position[];
  selected: string[];
  /** Omit for a read-only list of the selected positions. */
  onChange?: (ids: string[]) => void;
  ariaLabel: string;
  emptyText?: string;
}

/** Positions as toggle chips — chosen ones carry a tick, not just a colour. */
export default function PositionChips({ positions, selected, onChange, ariaLabel, emptyText = 'No positions yet' }: Props) {
  if (!onChange) {
    const names = positions.filter(p => selected.includes(p.positionId)).map(p => p.name);
    return <div style={{ fontSize: 14, color: names.length ? C.text : C.muted }}>{names.length ? names.join(', ') : emptyText}</div>;
  }
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  return (
    <div role="group" aria-label={ariaLabel} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {positions.map(p => {
        const on = selected.includes(p.positionId);
        return (
          <button
            key={p.positionId}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(p.positionId)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, padding: '4px 12px', borderRadius: 999,
              fontSize: 13, fontWeight: on ? 600 : 500, fontFamily: 'inherit', cursor: 'pointer',
              border: `1px solid ${on ? C.primary : C.borderStrong}`, background: on ? C.primarySoft : '#fff', color: on ? C.primary : C.sub,
            }}
          >
            {on && <FontAwesomeIcon icon={faCheck} style={{ fontSize: 11 }} />}
            {p.name}
          </button>
        );
      })}
      {positions.length === 0 && <span style={{ fontSize: 13, color: C.muted }}>{emptyText}</span>}
    </div>
  );
}
