// How-To Guide → Poster: every step of the guide on printable A4 pages,
// numbered in order and grouped under their section. Pure layout maths —
// the page (GuidePosterPage) only draws what this returns.

/** Beyond this a page gets too small to read from a wall — the rest go on the next page. */
export const POSTER_STEPS_PER_PAGE = 12;
/** Height on an A4 sheet left for the steps once the header and footer are in, mm. */
export const POSTER_BODY_MM = 212;
/** A section heading's height, mm. */
export const POSTER_HEADING_MM = 10;
/** One row of tiles (photo + title) at each column count, mm — sized for tiles with a photo. */
export const POSTER_ROW_MM: Record<number, number> = { 2: 86, 3: 62, 4: 48 };

export interface PosterStepInput { id: string; section: string; title: string; imageId: string | null }
export interface PosterStep extends PosterStepInput { number: number }
export interface PosterGroup {
  /** Null when the guide has only one section (no heading needed). */
  section: string | null;
  /** The section started on an earlier page. */
  continued: boolean;
  steps: PosterStep[];
}
export interface PosterPage { groups: PosterGroup[]; columns: number; stepCount: number }

/** Columns for a page with this many steps — fewer steps, bigger tiles. */
export function posterColumns(stepCount: number): number {
  if (stepCount <= 4) return 2;
  if (stepCount <= 9) return 3;
  return 4;
}

/** Sizes of the runs of consecutive steps that share a section. */
function runLengths(sections: (string | null)[]): number[] {
  const runs: number[] = [];
  sections.forEach((sec, i) => { if (i > 0 && sec === sections[i - 1]) runs[runs.length - 1]++; else runs.push(1); });
  return runs;
}

/** Whether these steps fit one sheet: a step limit, and their rows + headings within the sheet's height. */
export function fitsOnePage(sections: (string | null)[], perPage = POSTER_STEPS_PER_PAGE): boolean {
  if (sections.length > perPage) return false;
  const columns = posterColumns(sections.length);
  const runs = runLengths(sections);
  const rows = runs.reduce((n, size) => n + Math.ceil(size / columns), 0);
  const headings = sections[0] === null ? 0 : runs.length;
  return rows * POSTER_ROW_MM[columns] + headings * POSTER_HEADING_MM <= POSTER_BODY_MM;
}

/** Split the steps (already in guide order) into pages, sections kept as headed groups. */
export function posterPages(steps: PosterStepInput[], perPage = POSTER_STEPS_PER_PAGE): PosterPage[] {
  const showSections = new Set(steps.map(s => s.section)).size > 1;
  const sectionOf = (s: PosterStepInput) => (showSections ? s.section : null);
  const numbered: PosterStep[] = steps.map((s, i) => ({ ...s, number: i + 1 }));

  // Each page takes the longest run of the next steps that fits — tried from
  // the longest down, since more steps can mean more columns and so fewer rows
  // (always at least one step a page).
  const slices: PosterStep[][] = [];
  for (let start = 0; start < numbered.length;) {
    let take = Math.min(perPage, numbered.length - start);
    while (take > 1 && !fitsOnePage(numbered.slice(start, start + take).map(sectionOf), perPage)) take--;
    slices.push(numbered.slice(start, start + take));
    start += take;
  }

  return slices.map(slice => {
    const groups: PosterGroup[] = [];
    for (const step of slice) {
      const section = sectionOf(step);
      const last = groups[groups.length - 1];
      if (last && last.section === section) { last.steps.push(step); continue; }
      const before = numbered[step.number - 2];
      const continued = !!section && groups.length === 0 && !!before && sectionOf(before) === section;
      groups.push({ section, continued, steps: [step] });
    }
    return { groups, columns: posterColumns(slice.length), stepCount: slice.length };
  });
}
