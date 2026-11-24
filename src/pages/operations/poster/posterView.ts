import type { SopTemplate } from '../../../api/sop-templates.js';

// Which poster the Poster page shows. Pure — unit-tested.
//  - draft:  a guide author has a newly drawn AI poster to check (Use this / Try again / Discard)
//  - ai:     the saved AI poster (drawn once, reused every time)
//  - simple: no AI poster yet — the steps laid out by the app

export type PosterView = 'draft' | 'ai' | 'simple';

type PosterFields = Pick<SopTemplate, 'currentVersion' | 'posterImageId' | 'posterVersion' | 'posterDraftImageId'>;

export function posterView(t: PosterFields, isAuthor: boolean): PosterView {
  if (isAuthor && t.posterDraftImageId) return 'draft';
  if (t.posterImageId) return 'ai';
  return 'simple';
}

/** The saved AI poster was drawn from an older version of the guide (its steps may have changed since). */
export function posterOutdated(t: PosterFields): boolean {
  return !!t.posterImageId && t.posterVersion !== null && t.posterVersion < t.currentVersion;
}
