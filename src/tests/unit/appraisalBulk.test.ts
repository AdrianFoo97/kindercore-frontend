import { describe, it, expect } from 'vitest';
import { bulkSummary, formsForAll, runEach } from '../../pages/appraisals/appraisalBulk';
import { pickedLabel } from '../../pages/appraisals/StaffMultiSelect';

// Appraisals for several people at once — starting and cancelling.

const form = (name: string, positionIds: string[], status = 'ACTIVE') => ({ name, status, positionIds });

describe('Appraisals — several at once', () => {
  it('offers only live forms that suit every person picked', () => {
    const forms = [form('Teacher form', ['P1', 'P2']), form('Junior only', ['P1']), form('Old', ['P1', 'P2'], 'ARCHIVED')];
    expect(formsForAll(forms, [{ positionId: 'P1' }, { positionId: 'P2' }]).map(f => f.name)).toEqual(['Teacher form']);
    expect(formsForAll(forms, [{ positionId: 'P1' }]).map(f => f.name)).toEqual(['Teacher form', 'Junior only']);
    expect(formsForAll(forms, [])).toEqual([]);
  });

  it('does each one in turn and keeps going past a failure — saying which didn’t work and why', async () => {
    const out = await runEach(['a', 'b', 'c'], async x => { if (x === 'b') throw new Error('Already done'); return `id-${x}`; });
    expect(out.done.map(d => d.id)).toEqual(['id-a', 'id-c']);
    expect(out.failed).toMatchObject([{ item: 'b', message: 'Already done' }]);
    expect(bulkSummary('Cancelled', 2, 1)).toBe('Cancelled 2 appraisals — 1 couldn’t be');
    expect(bulkSummary('Started', 1, 0)).toBe('Started 1 appraisal');
  });

  it('names who is picked in a short line', () => {
    expect(pickedLabel([])).toBe('');
    expect(pickedLabel(['Amelia', 'James'])).toBe('Amelia and James');
    expect(pickedLabel(['Amelia', 'James', 'Siti', 'Lee'])).toBe('Amelia and 3 others');
  });
});
