// Guides → favourites: which tab the library opens on, and starring.

export type LibraryView = 'favorites' | 'guides' | 'labels';

/** The tab to show: the one chosen (kept in the URL as ?view=…), else Favourites — always, so it never jumps. */
export function resolveLibraryView(param: string | null): LibraryView {
  if (param === 'labels') return 'labels';
  if (param === 'all') return 'guides';
  return 'favorites';
}

/** The ?view= value for a tab ("all" for All guides, since no param can mean Favourites). */
export function viewParam(view: LibraryView): string {
  return view === 'guides' ? 'all' : view;
}

/** The list after starring or unstarring one guide. */
export function toggleFavorite(ids: string[], id: string, on: boolean): string[] {
  const rest = ids.filter(x => x !== id);
  return on ? [...rest, id] : rest;
}