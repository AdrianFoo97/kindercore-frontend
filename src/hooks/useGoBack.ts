import { useLocation, useNavigate } from 'react-router-dom';

/** React Router gives the first entry of a tab's history this key (fresh load, deep link, refresh). */
export const FIRST_ENTRY_KEY = 'default';

/** True when there is an in-app screen behind this one to go back to. */
export function hasInAppHistory(locationKey: string): boolean {
  return locationKey !== FIRST_ENTRY_KEY;
}

/**
 * A back button that returns to wherever the person actually came from
 * (real history), not a fixed screen — most pages are reachable from more
 * than one place. `fallback` is only used when the page was opened directly
 * and there is nothing in-app to go back to.
 */
export function useGoBack(fallback: string): () => void {
  const navigate = useNavigate();
  const { key } = useLocation();
  return () => {
    if (hasInAppHistory(key)) navigate(-1);
    else navigate(fallback, { replace: true });
  };
}
