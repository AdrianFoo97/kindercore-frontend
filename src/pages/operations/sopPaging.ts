// The Guides list, 10 at a time: page buttons on a computer, and on a phone
// the next 10 appear as you scroll to the end (no buttons to aim for).

export type PagingMode = 'pages' | 'scroll';

/** The guides to show: one page's worth (pages), or every batch revealed so far (scroll). */
export function visibleGuides<T>(list: T[], page: number, pageSize: number, mode: PagingMode): T[] {
  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  const p = Math.min(Math.max(1, page), pageCount);
  return mode === 'scroll' ? list.slice(0, p * pageSize) : list.slice((p - 1) * pageSize, p * pageSize);
}

/** Is there more to load when scrolling? */
export const hasMoreToScroll = (shown: number, total: number) => shown < total;