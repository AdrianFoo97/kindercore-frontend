import { describe, it, expect } from 'vitest';
import { GUIDE_SHEET, LISTS_SHEET, STEPS_SHEET, readSopWorkbook, templateSheets, type ImportRefs, type Rows } from '../../pages/operations/sop-import/sopImport';

// How-To Guides → Import guide. Made-up guide content only.

const REFS: ImportRefs = {
  sections: [{ name: 'Before Class' }, { name: 'During Class' }],
  categories: [{ id: 'cat-safety', name: 'Safety' }, { id: 'cat-hygiene', name: 'Hygiene' }],
  guides: [{ id: 'g-first-aid', title: 'First Aid' }],
};

const guide = (fields: Record<string, string>): Rows =>
  [['Field', 'Value', 'How to fill it in'], ...Object.entries(fields).map(([k, v]) => [k, v, ''])];
const steps = (...rows: Rows): Rows => [['Section', 'Step', 'Detail', 'Linked guide'], ...rows];

describe('How-To Guides — importing a guide from a spreadsheet', () => {
  it('builds the template with the guide fields, the step columns and today’s sections, categories and guides', () => {
    const t = templateSheets(REFS);
    expect(t[GUIDE_SHEET].map(r => r[0])).toEqual(['Field', 'Title', 'Goal', 'Video link', 'Categories']);
    expect(t[STEPS_SHEET]).toEqual([['Section', 'Step', 'Detail', 'Linked guide']]);
    expect(t[LISTS_SHEET].slice(1)).toEqual([['Before Class', 'Safety', 'First Aid'], ['During Class', 'Hygiene', '']]);
  });

  it('reads a filled-in template into a draft — matching names whatever their capitals, skipping blank rows', () => {
    const result = readSopWorkbook({
      [GUIDE_SHEET]: guide({ Title: ' Hand washing ', Goal: 'Clean hands every time', 'Video link': 'https://youtu.be/abc', Categories: 'hygiene, Safety' }),
      [STEPS_SHEET]: steps(
        ['before class', 'Wet hands', 'Warm water', ''],
        ['', '', '', ''],
        ['During Class', 'If someone is hurt', '', 'first aid'],
      ),
    }, REFS);
    expect(result).toEqual({
      ok: true,
      draft: {
        sopTemplateId: null, title: 'Hand washing', goal: 'Clean hands every time', videoUrl: 'https://youtu.be/abc',
        categoryIds: ['cat-hygiene', 'cat-safety'], asDraft: true,
        steps: [
          { section: 'Before Class', title: 'Wet hands', detail: 'Warm water', linkedTemplateId: null },
          { section: 'During Class', title: 'If someone is hurt', detail: null, linkedTemplateId: 'g-first-aid' },
        ],
      },
    });
  });

  it('lists every problem with its sheet and row, and creates nothing — never guessing a section, category or guide', () => {
    const result = readSopWorkbook({
      [GUIDE_SHEET]: guide({ Title: '', 'Video link': 'youtube', Categories: 'Fire drills' }),
      [STEPS_SHEET]: steps(['After School', 'Lock up', '', ''], ['Before Class', '', '', 'Nonexistent guide']),
    }, REFS);
    expect(result.ok).toBe(false);
    expect('problems' in result && result.problems).toEqual([
      'Guide sheet: fill in the Title.',
      'Guide sheet: the Video link must be a full web link starting with https://.',
      'Guide sheet: there’s no category called “Fire drills” — use a name from the Lists sheet.',
      'Steps sheet, row 2: there’s no section called “After School” — use a name from the Lists sheet.',
      'Steps sheet, row 3: fill in the Step.',
      'Steps sheet, row 3: there’s no guide called “Nonexistent guide” — use a title from the Lists sheet, or leave Linked guide empty.',
    ]);
  });

  it('refuses a file that isn’t the template, or one with no steps', () => {
    expect(readSopWorkbook({ Sheet1: [['a']] }, REFS)).toMatchObject({ ok: false, problems: [expect.stringMatching(/isn’t the import template/)] });
    expect(readSopWorkbook({ [GUIDE_SHEET]: guide({ Title: 'X' }), [STEPS_SHEET]: steps() }, REFS))
      .toEqual({ ok: false, problems: ['Steps sheet: add at least one step.'] });
  });
});
