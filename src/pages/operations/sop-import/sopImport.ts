import type { CreateRevisionPayload } from '../../../api/sop-revisions.js';

// Import a How-To Guide from a spreadsheet — the template's layout, and
// reading a filled-in one into a draft guide. Pure: sheets come in as rows of
// cells (what the xlsx library gives), so this is unit-tested without files.
//
// Nothing is guessed or quietly changed: a section, category or linked guide
// must match one that exists (any capitals), and every problem is listed with
// its sheet and row so the file can be fixed and imported again.

export const GUIDE_SHEET = 'Guide';
export const STEPS_SHEET = 'Steps';
export const LISTS_SHEET = 'Lists';
export const TEMPLATE_FILE_NAME = 'how-to-guide-import-template.xlsx';

/** Same limits as the guide editor and the server (sop-revisions.controller). */
const MAX_TITLE = 191;
const MAX_SECTION = 100;
const MAX_VIDEO_URL = 500;

type Cell = string | number | boolean | null | undefined;
export type Rows = Cell[][];

/** The Guide sheet: one field per row — its label (column A), what to fill in (B), and a note (C). */
const GUIDE_FIELDS = [
  ['Title', 'Required. The guide’s name, as staff will see it.'],
  ['Goal', 'Optional. What this guide helps staff do well.'],
  ['Video link', 'Optional. A full link, e.g. https://youtu.be/…'],
  ['Categories', 'Optional. Category names from the Lists sheet, separated by commas.'],
] as const;

export const STEP_COLUMNS = ['Section', 'Step', 'Detail', 'Linked guide'] as const;

export interface ImportRefs {
  sections: { name: string }[];
  categories: { id: string; name: string }[];
  guides: { id: string; title: string }[];
}

/** The template's three sheets, as rows. The Lists sheet carries the names that exist today. */
export function templateSheets(refs: ImportRefs): Record<string, Rows> {
  const longest = Math.max(refs.sections.length, refs.categories.length, refs.guides.length);
  return {
    [GUIDE_SHEET]: [['Field', 'Value', 'How to fill it in'], ...GUIDE_FIELDS.map(([label, note]) => [label, '', note])],
    [STEPS_SHEET]: [[...STEP_COLUMNS]],
    [LISTS_SHEET]: [
      ['Sections (pick one per step)', 'Categories', 'Guides (for Linked guide)'],
      ...Array.from({ length: longest }, (_, i) => [refs.sections[i]?.name ?? '', refs.categories[i]?.name ?? '', refs.guides[i]?.title ?? '']),
    ],
  };
}

export type ImportResult = { ok: true; draft: CreateRevisionPayload } | { ok: false; problems: string[] };

const text = (c: Cell) => (c === null || c === undefined ? '' : String(c)).trim();
const key = (s: string) => s.trim().toLowerCase();
const isLink = (s: string) => { try { return /^https?:$/.test(new URL(s).protocol); } catch { return false; } };

/** Read a filled-in template into a draft guide, or say everything that needs fixing. */
export function readSopWorkbook(sheets: Record<string, Rows | undefined>, refs: ImportRefs): ImportResult {
  const guideRows = sheets[GUIDE_SHEET];
  const stepRows = sheets[STEPS_SHEET];
  if (!guideRows || !stepRows) {
    return { ok: false, problems: [`This isn’t the import template — it needs a “${GUIDE_SHEET}” and a “${STEPS_SHEET}” sheet. Download the template and fill that in.`] };
  }
  const problems: string[] = [];

  // Guide sheet: find each field by its label in column A (rows may be moved).
  const field = (label: string) => text(guideRows.find(r => key(text(r?.[0])) === key(label))?.[1]);
  const title = field('Title');
  const goal = field('Goal');
  const videoUrl = field('Video link');
  if (!title) problems.push(`${GUIDE_SHEET} sheet: fill in the Title.`);
  else if (title.length > MAX_TITLE) problems.push(`${GUIDE_SHEET} sheet: the Title is longer than ${MAX_TITLE} characters.`);
  if (videoUrl && (!isLink(videoUrl) || videoUrl.length > MAX_VIDEO_URL)) problems.push(`${GUIDE_SHEET} sheet: the Video link must be a full web link starting with https://.`);

  const categoryByName = new Map(refs.categories.map(c => [key(c.name), c.id]));
  const categoryIds: string[] = [];
  for (const name of field('Categories').split(',').map(s => s.trim()).filter(Boolean)) {
    const id = categoryByName.get(key(name));
    if (!id) problems.push(`${GUIDE_SHEET} sheet: there’s no category called “${name}” — use a name from the Lists sheet.`);
    else if (!categoryIds.includes(id)) categoryIds.push(id);
  }

  // Steps sheet: row 1 is the header; blank rows are skipped.
  const sectionByName = new Map(refs.sections.map(s => [key(s.name), s.name]));
  const guideByTitle = new Map(refs.guides.map(g => [key(g.title), g.id]));
  const steps: CreateRevisionPayload['steps'] = [];
  stepRows.slice(1).forEach((row, i) => {
    const [section, stepTitle, detail, linked] = [0, 1, 2, 3].map(c => text(row?.[c]));
    if (!section && !stepTitle && !detail && !linked) return;
    const where = `${STEPS_SHEET} sheet, row ${i + 2}`;
    const sectionName = sectionByName.get(key(section));
    if (!section) problems.push(`${where}: choose a Section.`);
    else if (!sectionName) problems.push(`${where}: there’s no section called “${section}” — use a name from the Lists sheet.`);
    else if (sectionName.length > MAX_SECTION) problems.push(`${where}: the Section name is too long.`);
    if (!stepTitle) problems.push(`${where}: fill in the Step.`);
    else if (stepTitle.length > MAX_TITLE) problems.push(`${where}: the Step is longer than ${MAX_TITLE} characters.`);
    const linkedId = linked ? guideByTitle.get(key(linked)) : undefined;
    if (linked && !linkedId) problems.push(`${where}: there’s no guide called “${linked}” — use a title from the Lists sheet, or leave Linked guide empty.`);
    steps.push({ section: sectionName ?? section, title: stepTitle, detail: detail || null, linkedTemplateId: linkedId ?? null });
  });
  if (steps.length === 0) problems.push(`${STEPS_SHEET} sheet: add at least one step.`);

  if (problems.length) return { ok: false, problems };
  return {
    ok: true,
    draft: { sopTemplateId: null, title, goal: goal || null, videoUrl: videoUrl || null, steps, categoryIds, asDraft: true },
  };
}
