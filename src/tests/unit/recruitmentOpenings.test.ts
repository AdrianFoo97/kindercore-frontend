import { describe, it, expect } from 'vitest';
import { formName, openingProblem, readOpenings, toStored } from '../../pages/settings/recruitmentOpenings';

// Settings → Recruitment → Positions: each role on the apply form is one of the positions.

const positions = [
  { positionId: 'EI', name: 'Junior EI', payRangeMin: 2000, payRangeMax: 2600 },
  { positionId: 'AEI', name: 'Assistant EI', payRangeMin: null, payRangeMax: null },
];

describe('Recruitment positions', () => {
  it('reads linked roles and old unlinked ones, and stores them back the same way', () => {
    const list = readOpenings([{ positionId: 'EI', publicName: 'Junior Teacher' }, { name: 'Helper', minSalary: 1700, maxSalary: 2000 }]);
    expect(list).toEqual([
      { kind: 'linked', positionId: 'EI', publicName: 'Junior Teacher' },
      { kind: 'unlinked', name: 'Helper', minSalary: 1700, maxSalary: 2000 },
    ]);
    expect(toStored([{ kind: 'linked', positionId: 'AEI', publicName: '  ' }])).toEqual([{ positionId: 'AEI', publicName: null }]);
  });

  it('shows the public name on the form, or the position’s own name', () => {
    expect(formName({ kind: 'linked', positionId: 'EI', publicName: 'Junior Teacher' }, positions)).toBe('Junior Teacher');
    expect(formName({ kind: 'linked', positionId: 'AEI', publicName: '' }, positions)).toBe('Assistant EI');
  });

  it('needs a position, once each, and no two roles with the same name on the form', () => {
    const list = readOpenings([{ positionId: 'EI', publicName: 'Teacher' }]);
    expect(openingProblem({ positionId: '', publicName: '' }, list, positions, null)).toBe('Pick a position.');
    expect(openingProblem({ positionId: 'EI', publicName: '' }, list, positions, null)).toBe('That position is already on the list.');
    expect(openingProblem({ positionId: 'AEI', publicName: 'teacher' }, list, positions, null)).toBe('Another role already shows with that name on the form.');
    expect(openingProblem({ positionId: 'AEI', publicName: '' }, list, positions, null)).toBeNull();
    expect(openingProblem({ positionId: 'EI', publicName: 'Teacher' }, list, positions, 0)).toBeNull(); // editing itself
  });
});
