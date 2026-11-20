import { describe, it, expect } from 'vitest';
import type { ImportPreview, PreviewLine } from '../../api/pnlImport.js';
import { blockReason, buildApplyBody, initialState, needsCheck, summarise, type PlanState } from '../../pages/operations/pnl-import/importPlan.js';

// A made-up preview (never the real P&Ls in `test data/`).
const line = (key: string, name: string, amount: number, status: PreviewLine['status'], categoryId: string | null = null, found = true): PreviewLine =>
  ({ key, section: 'Administrative Expenses', sectionKind: 'EXPENSE', name, amount, found, status, categoryId });

const PREVIEW: ImportPreview = {
  fileName: 'pnl.pdf', period: { year: 2026, month: 9 }, provider: 'fake', model: 'fake-1', instructionsVersion: 1, backupReason: null, hasText: true,
  sections: [{ title: 'Administrative Expenses', kind: 'EXPENSE', sum: 0, printedSubtotal: 0, addsUp: true }],
  lines: [
    { ...line('0-0', 'Sales', 5000, 'NOT_A_COST'), sectionKind: 'REVENUE' },
    line('1-0', 'Rental', 4200, 'MATCHED', 'c-rent'),
    line('1-1', 'Water & Electricity', 1116.56, 'SUGGESTED', 'c-water'),
    line('1-2', 'Fire Extinguisher', 1570, 'NEW'),
    line('1-3', 'Salaries', 2500, 'SKIP_RULE'),
    line('1-4', 'Toll & Parking', 0, 'ZERO'),
  ],
  existing: { 'c-rent': 4000 },
  categories: [], groups: [{ id: 'g-admin', name: 'Administrative' }],
};

const decided = (extra: Partial<PlanState['decisions']> = {}): PlanState => {
  const s = initialState(PREVIEW);
  return { ...s, decisions: { ...s.decisions, '1-1': { kind: 'RECORD', categoryId: 'c-water' }, '1-2': { kind: 'SKIP' }, ...extra } };
};

describe('Import P&L — deciding each line', () => {
  it('starts matches as recorded and rule lines as skipped, and leaves close or unknown names for a person', () => {
    const s = initialState(PREVIEW);
    expect(s.decisions).toEqual({
      '1-0': { kind: 'RECORD', categoryId: 'c-rent' }, '1-1': null, '1-2': null, '1-3': { kind: 'SKIP' },
    });
    expect(blockReason(PREVIEW, s)).toBe('Choose what to do with 2 lines');
  });

  it('counts an amount kept because one was already entered as not imported, until “replace” is ticked', () => {
    const s = decided();
    expect(summarise(PREVIEW, s)).toEqual({ record: { count: 1, total: 1116.56 }, undecided: 0, notImported: { count: 3, total: 8270 } });
    expect(summarise(PREVIEW, { ...s, replace: { '1-0': true } }).record).toEqual({ count: 2, total: 5316.56 });
    expect(blockReason(PREVIEW, s)).toBeNull();
  });

  it('asks for a check when an amount isn’t found in the file, or the PDF has no text', () => {
    const missing = { ...PREVIEW, lines: PREVIEW.lines.map(l => (l.key === '1-0' ? { ...l, found: false } : l)) };
    expect(needsCheck(missing, decided())).toBe(true);
    expect(blockReason(missing, decided())).toBe('Tick that you’ve checked the flagged amounts');
    expect(blockReason(missing, { ...decided(), checked: true })).toBeNull();
    expect(needsCheck({ ...PREVIEW, hasText: false }, decided())).toBe(true);
    expect(needsCheck(PREVIEW, decided())).toBe(false);
  });

  it('sends each decision, new categories with a temporary id, and remembers only the choices a person made', () => {
    const body = buildApplyBody(PREVIEW, decided({ '1-2': { kind: 'NEW', name: ' Fire Safety ', groupId: 'g-admin' } }));
    expect(body).toMatchObject({ year: 2026, month: 9, fileName: 'pnl.pdf', newCategories: [{ tempId: 'new:1-2', name: 'Fire Safety', groupId: 'g-admin' }] });
    expect(body.lines).toEqual([
      { name: 'Rental', section: 'Administrative Expenses', amount: 4200, action: 'RECORD', categoryId: 'c-rent' },
      { name: 'Water & Electricity', section: 'Administrative Expenses', amount: 1116.56, action: 'RECORD', categoryId: 'c-water', remember: true },
      { name: 'Fire Extinguisher', section: 'Administrative Expenses', amount: 1570, action: 'RECORD', categoryId: 'new:1-2', remember: true },
      { name: 'Salaries', section: 'Administrative Expenses', amount: 2500, action: 'SKIP', categoryId: null, byRule: true },
    ]);
  });

  it('needs a name and group for a new category', () => {
    expect(blockReason(PREVIEW, decided({ '1-2': { kind: 'NEW', name: '  ', groupId: 'g-admin' } }))).toBe('Name each new category and pick its group');
  });
});
