import { describe, it, expect } from 'vitest';
import { branchesFrom, inBranch } from '../../pages/branches/useBranch';

// Branches on screen: which branches can be picked, and which classes / subjects show for one.

describe('Branches — on screen', () => {
  it('offers the saved branches that have an id, by name', () => {
    expect(branchesFrom({ company_branches: [{ id: 'b1', name: 'Bukit Indah', address: 'x' }, { name: 'No id yet' }, { id: 'b2', name: 'Skudai' }] }))
      .toEqual([{ id: 'b1', name: 'Bukit Indah' }, { id: 'b2', name: 'Skudai' }]);
    expect(branchesFrom({})).toEqual([]);
    expect(branchesFrom(undefined)).toEqual([]);
  });

  it('shows only the picked branch’s classes and subjects — or everything when no branches are set up', () => {
    expect(inBranch({ branchId: 'b1' }, 'b1')).toBe(true);
    expect(inBranch({ branchId: 'b2' }, 'b1')).toBe(false);
    expect(inBranch({ branchId: null }, 'b1')).toBe(false);
    expect(inBranch({ branchId: 'b2' }, null)).toBe(true);
  });
});
