/**
 * Opens a link someone outside the school gave us (e.g. an applicant's resume
 * link) — but only an https:// one. A stored `javascript:` or `data:` link
 * would otherwise run inside the app when HR clicks it.
 */
export function isSafeExternalUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Opens the link in a new tab; returns false (and opens nothing) when it isn't a safe https link. */
export function openExternalUrl(url: string): boolean {
  if (!isSafeExternalUrl(url)) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
