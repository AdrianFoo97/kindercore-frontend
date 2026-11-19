import { describe, it, expect } from 'vitest';
import { combinedFunctions, combinedModules, groupByArea, sameIds, positionRoleFor, searchRoles, toggleFunction, toggleModule, usageLine, type AccessFunction } from '../../pages/settings/accessRoleForm.js';

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

  it('lists every module a person’s roles open between them, once each', () => {
    const roles = [{ id: 'a', modules: ['HR'] }, { id: 'b', modules: ['FINANCE', 'HR'] }, { id: 'c', modules: ['MARKETING'] }];
    expect(combinedModules(roles, ['a', 'b'], ['MARKETING', 'HR', 'FINANCE'])).toEqual(['HR', 'FINANCE']);
    expect(combinedModules(roles, [], ['HR'])).toEqual([]);
  });

  it('shows the role a person gets from their staff record’s position, if any', () => {
    const teachers = [{ id: 't1', positionId: 'SV' }, { id: 't2', positionId: 'EI' }, { id: 't3', positionId: null }];
    const positions = [{ positionId: 'SV', name: 'Supervisor', authRoleId: 'builtin:SUPERVISOR' }, { positionId: 'EI', name: 'Junior EI', authRoleId: null }];
    const roles = [{ id: 'builtin:SUPERVISOR', name: 'Supervisor' }];
    expect(positionRoleFor('t1', teachers, positions, roles)).toEqual({ role: roles[0], positionName: 'Supervisor' });
    expect(positionRoleFor('t2', teachers, positions, roles)).toBeNull();
    expect(positionRoleFor('t3', teachers, positions, roles)).toBeNull();
    expect(positionRoleFor(null, teachers, positions, roles)).toBeNull();
  });

  it('finds roles by name or area', () => {
    const roles = [{ name: 'HR Director', area: 'HRMS' }, { name: 'Supervisor', area: 'Operation' }, { name: 'Office Admin', area: null }];
    expect(searchRoles(roles, 'oper').map(r => r.name)).toEqual(['Supervisor']);
    expect(searchRoles(roles, '  ')).toHaveLength(3);
  });

  it('lists the extra functions a person’s roles grant, and spots when their roles really changed', () => {
    const roles = [{ id: 'a', views: ['X'] }, { id: 'b', views: ['X', 'Y'] }, { id: 'c', views: ['Z'] }];
    expect(combinedFunctions(roles, ['a', 'b'])).toEqual(['X', 'Y']);
    expect(sameIds(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameIds(['a'], ['a', 'b'])).toBe(false);
  });
});
