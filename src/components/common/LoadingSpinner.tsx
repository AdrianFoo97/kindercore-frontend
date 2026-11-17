import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons';

const SPINNER_SIZE = 20;
const INLINE_SIZE = 16;
const SPINNER_COLOR = '#64748b';
/** A page / section loading fills the visible content area so the spinner sits in its middle. */
const AREA_MIN_HEIGHT = 'max(160px, calc(100vh - 320px))';

/**
 * The app's loading indicator: a spinning circle instead of "Loading…" text.
 * By default it fills the content area and sits in the middle of it (a page
 * or section loading); `inline` keeps it small, where it is (inside a field,
 * a dropdown, a card or a pop-up). Screen readers still hear what's loading
 * (`label`). Font Awesome's own CSS stops the spin for reduced motion.
 * Rendered as a <span> so it's valid inside the <p>/<div> it replaced.
 */
export default function LoadingSpinner({ label = 'Loading', size, inline = false }: { label?: string; size?: number; inline?: boolean }) {
  return (
    <span role="status" aria-label={label} style={{
      display: inline ? 'inline-flex' : 'flex', alignItems: 'center', justifyContent: 'center',
      color: SPINNER_COLOR, fontSize: size ?? (inline ? INLINE_SIZE : SPINNER_SIZE), lineHeight: 1,
      ...(inline ? null : { width: '100%', minHeight: AREA_MIN_HEIGHT }),
    }}>
      <FontAwesomeIcon icon={faCircleNotch} spin aria-hidden />
    </span>
  );
}