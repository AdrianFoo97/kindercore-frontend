import { describe, it, expect } from 'vitest';
import { SETTINGS_GROUPS, isSettingsArea, itemForPath, searchSettings, visibleGroups } from '../../pages/settings/settingsNav';

// The Settings area: one grouped list behind the Settings home page, the
// sidebar on every settings page and settings search.

describe('Settings navigation', () => {
  it('lists every setting once, under a group, with somewhere to go and a description', () => {
    const items = SETTINGS_GROUPS.flatMap(g => g.items);
    expect(new Set(items.map(i => i.key)).size).toBe(items.length);
    expect(new Set(items.map(i => i.to)).size).toBe(items.length);
    for (const i of items) {
      expect(i.to, i.key).toMatch(/^\//);
      expect(i.description.length, i.key).toBeGreaterThan(10);
    }
    // The former Admin menu is a group of its own.
    expect(SETTINGS_GROUPS.find(g => g.key === 'team-access')?.items.map(i => i.to)).toEqual(
      expect.arrayContaining(['/settings/users', '/settings/auth-roles', '/admin/access-log', '/admin/year-rollover']),
    );
  });

  it('highlights the right setting on its sub-pages too', () => {
    expect(itemForPath('/settings/hr')?.key).toBe('payroll');
    expect(itemForPath('/settings/employee-salary/positions/P1/edit')?.key).toBe('payroll');
    expect(itemForPath('/settings/appraisal-forms/abc')?.key).toBe('appraisal-forms');
    expect(itemForPath('/settings/auth-roles/r1/views')?.key).toBe('roles');
    expect(itemForPath('/settings/timetable/class')?.key).toBe('operation');
    expect(itemForPath('/settings/packages/age-groups')?.key).toBe('packages');
    expect(itemForPath('/admin/access-log')?.key).toBe('access-log');
    // A path that merely starts with the same letters isn't a match.
    expect(itemForPath('/settings/hr-extra')).toBeNull();
  });

  it('treats settings pages and the moved admin pages as the Settings area, but not the developer pages', () => {
    expect(isSettingsArea('/settings')).toBe(true);
    expect(isSettingsArea('/settings/finance')).toBe(true);
    expect(isSettingsArea('/admin/year-rollover')).toBe(true);
    expect(isSettingsArea('/admin/test-catalog')).toBe(false);
    expect(isSettingsArea('/teachers')).toBe(false);
  });

  it('finds a setting by any word in its name, description, group or keywords, in any order', () => {
    expect(searchSettings('reward').map(r => r.item.key)).toEqual(['payroll']);
    expect(searchSettings('WHATSAPP').map(r => r.item.key)).toEqual(['messages']);
    expect(searchSettings('people appraisal').map(r => r.item.key)).toEqual(['appraisal-forms']);
    expect(searchSettings('   ')).toEqual([]);
    expect(searchSettings('nothing like this')).toEqual([]);
  });

  it('shows test-server tools only on the test server, and drops a group left empty', () => {
    expect(visibleGroups(false).some(g => g.key === 'test-tools')).toBe(false);
    expect(visibleGroups(true).find(g => g.key === 'test-tools')?.items.map(i => i.key)).toEqual(['reset-candidates']);
  });
});
