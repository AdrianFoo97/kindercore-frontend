import type { CSSProperties } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar } from '@fortawesome/free-solid-svg-icons';

const ON = '#d97706';
const OFF = '#94a3b8';

/** Star / unstar a guide. Filled amber when it's a favourite; the label says which. */
export default function FavoriteStarButton({ title, on, onToggle, style }: { title: string; on: boolean; onToggle: (on: boolean) => void; style?: CSSProperties }) {
  const label = on ? `Remove ${title} from favourites` : `Add ${title} to favourites`;
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onToggle(!on); }}
      aria-pressed={on}
      aria-label={label}
      title={on ? 'Remove from favourites' : 'Add to favourites'}
      style={{ ...style, color: on ? ON : OFF }}
    >
      <FontAwesomeIcon icon={faStar} />
    </button>
  );
}