import { describe, it, expect } from 'vitest';
import { groupByArea, toggleFunction, toggleModule, usageLine, type AccessFunction } from '../../pages/settings/accessRoleForm.js';

const CATALOG: AccessFunction[] = [
  { key: 'OPERATION_SOP_APPROVE', module: 'OPERATION', label: 'Approve guides', description: '' },
  { key: 'HR_SEE_ALL_STAFF', module: 'HR', label: 'See all staff', description: '' },
];

describe('Access role editor', () => {
  it('only lets you tick a function once its module is ticked', () => {
    const none = { modules: [], functions: [] };
    expect(toggleFunction(none, CATALOG[0])).toEqual(none);
    const withOps = toggleModule(none, 'OPERATION', CATALOG);
    expect(toggleFunction(withOps, CATALOG[0]).functions).toEqual(['OPERATION_SOP_APPROVE']);
  });

  it('drops a module’s functions when the module is unticked, keeping the others', () => {
    const g = { modules: ['OPERATION', 'HR'] as const, functions: ['OPERATION_SOP_APPROVE', 'HR_SEE_ALL_STAFF'] };
    expect(toggleModule({ ...g, modules: [...g.modules] }, 'OPERATION', CATALOG)).toEqual({ modules: ['HR'], functions: ['HR_SEE_ALL_STAFF'] });
  });

  it('groups built-in roles by area and says who uses a role', () => {
    const groups = groupByArea([{ area: 'Marketing', n: 1 }, { area: 'HRMS', n: 2 }, { area: 'HRMS', n: 3 }]);
    expect(groups.map(g => [g.area, g.roles.length])).toEqual([['Marketing', 1], ['HRMS', 2]]);
    expect(usageLine(1, 2)).toBe('Used by 1 person · 2 positions');
    expect(usageLine(0, 0)).toBe('Not given to anyone yet');
  });
});
