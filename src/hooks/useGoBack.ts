import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * A "Back" that really goes back: pops browser history when there's an
 * in-app page behind this one, so the previous page comes back as it was
 * (tab, search, scroll) and pressing Back again doesn't bounce forward.
 * On a cold deep link (`location.key === 'default'` — nothing to pop), it
 * goes to `fallback` instead, replacing this entry.
 *
 * Use it instead of a forward <Link to="previous page">, which pushes a new
 * entry and leaves the page you were on sitting behind the one you "went
 * back" to.
 */
export function useGoBack(fallback: string): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    if (location.key !== 'default') navigate(-1);
    else navigate(fallback, { replace: true });
  }, [location.key, navigate, fallback]);
}
