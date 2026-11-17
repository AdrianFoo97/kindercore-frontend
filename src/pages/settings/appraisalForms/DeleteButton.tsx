import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { C, iconBtn } from './formTheme.js';

export { IN_USE_REASON } from './ratingScales.js';

/**
 * The bin on a rating-scale / scoring-form row. When it can't be deleted it
 * stays visible but disabled, and says why on hover (and to screen readers).
 */
export function DeleteButton({ name, blockedReason, onClick }: { name: string; blockedReason: string | null; onClick: () => void }) {
  const blocked = blockedReason != null;
  return (
    <button type="button" disabled={blocked} onClick={onClick}
      style={{ ...iconBtn, ...(blocked ? { color: C.borderStrong, cursor: 'default' } : {}) }}
      aria-label={blocked ? `Can’t delete ${name}: ${blockedReason}` : `Delete ${name}`}
      title={blockedReason ?? 'Delete'}>
      <FontAwesomeIcon icon={faTrash} />
    </button>
  );
}
