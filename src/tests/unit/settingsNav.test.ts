import { describe, it, expect } from 'vitest';
import { HRMS, SETTINGS_ACCESS, SETTINGS_GROUPS, groupSections, isSettingsArea, itemForPath, searchSettings, visibleGroups } from '../../pages/settings/settingsNav';

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
    // HR settings follow the HR modules, in order — the same sections as the HRMS menu.
    expect(SETTINGS_GROUPS.map(g => g.label)).toEqual(expect.arrayContaining(['Recruitment & Hiring', 'Training & Development', 'Performance Management', 'Compensation & Benefits']));
    const order = ['hr-planning', 'compensation', 'recruitment', 'training', 'performance'].map(k => SETTINGS_GROUPS.findIndex(g => g.key === k));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // …and sit together under one HRMS heading, easy to read by module.
    const hrms = groupSections(SETTINGS_GROUPS).filter(s => s.section === HRMS);
    expect(hrms).toHaveLength(1);
    expect(hrms[0].groups.map(g => g.key)).toEqual(['hr-planning', 'compensation', 'recruitment', 'training', 'performance']);
    expect(searchSettings('hrms').map(r => r.item.key)).toEqual(expect.arrayContaining(['recruitment', 'career-missions', 'appraisal-forms', 'payroll']));
    // The former Admin menu is a group of its own.
    expect(SETTINGS_GROUPS.find(g => g.key === 'team-access')?.items.map(i => i.to)).toEqual(
      expect.arrayContaining(['/settings/users', '/settings/auth-roles', '/admin/access-log', '/admin/year-rollover']),
    );
  });

  it('highlights the right setting on its sub-pages too', () => {
    expect(itemForPath('/settings/hr')?.key).toBe('payroll');
    expect(itemForPath('/settings/employee-salary/positions/P1/edit')?.key).toBe('positions');
    expect(itemForPath('/settings/appraisal-forms/abc')?.key).toBe('appraisal-forms');
    expect(itemForPath('/settings/points-rewards/edit/rule/r1')?.key).toBe('points-rewards');
    expect(itemForPath('/settings/mission-categories')?.key).toBe('mission-categories');
    expect(itemForPath('/settings/auth-roles/r1/views')?.key).toBe('roles');
    expect(itemForPath('/settings/timetable/classes')?.key).toBe('classes');
    expect(itemForPath('/settings/sop-sections')?.key).toBe('how-to-guides');
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
    expect(searchSettings('reward').map(r => r.item.key)).toEqual(['points-rewards']);
    expect(searchSettings('WHATSAPP').map(r => r.item.key)).toEqual(['messages']);
    // Appraisals have their own group, Performance Management; "appraisals" or "performance" finds all three parts.
    expect(searchSettings('people appraisal').map(r => r.item.key)).toEqual(['appraisal-forms']);
    expect(searchSettings('appraisals').map(r => r.item.key)).toEqual(['appraisal-forms', 'scoring-forms', 'rating-scales', 'score-bands']);
    expect(searchSettings('performance').map(r => r.item.key)).toEqual(['appraisal-forms', 'scoring-forms', 'rating-scales', 'score-bands', 'practice-observations']);
    expect(searchSettings('rubric').map(r => r.item.key)).toEqual(['rating-scales']);
    expect(searchSettings('   ')).toEqual([]);
    expect(searchSettings('nothing like this')).toEqual([]);
  });

  it('shows test-server tools only on the test server, and drops a group left empty', () => {
    expect(visibleGroups(false).some(g => g.key === 'test-tools')).toBe(false);
    expect(visibleGroups(true).find(g => g.key === 'test-tools')?.items.map(i => i.key)).toEqual(['reset-candidates']);
  });

  it('shows each person only the settings their access roles cover, and nothing without a role — Admins see everything', () => {
    const viewer = (modules: string[], views: string[] = []) => ({ isAdmin: false, hasAnyModule: modules.length > 0, hasModule: (m: string) => modules.includes(m), hasView: (v: string) => views.includes(v) });
    const keys = (v: ReturnType<typeof viewer>) => visibleGroups(false, SETTINGS_GROUPS, v).flatMap(g => g.items.map(i => i.key));
    // No access role → nothing at all, not even Notifications.
    expect(keys(viewer([]))).toEqual([]);
    expect(keys(viewer(['OPERATION']))).toEqual(['notifications']);
    expect(keys(viewer(['MARKETING']))).toEqual(expect.arrayContaining(['notifications', 'messages', 'crm', 'packages']));
    expect(keys(viewer(['MARKETING']))).not.toContain('finance');
    // Finance targets follow the reports they drive (Analysis); recording costs (Finance) gets just Operating cost.
    expect(keys(viewer(['FINANCE']))).toEqual(['notifications', 'operating-cost']);
    expect(keys(viewer(['ANALYSIS']))).toEqual(['notifications', 'finance']);
    // A Team Lead (HR alone) gets no HR set-up page — their work is in HRMS.
    expect(keys(viewer(['HR']))).toEqual(['notifications']);
    expect(keys(viewer(['HR'], ['HR_SEE_ALL_STAFF', 'HR_SEE_PAY']))).toEqual(expect.arrayContaining(['org-chart', 'points-rewards', 'recruitment', 'appraisal-forms', 'career-missions', 'positions', 'payroll']));
    // Company-wide and Team & access pages stay Admin-only.
    for (const k of ['company', 'integrations', 'ai', 'users', 'roles']) expect(SETTINGS_ACCESS[k], k).toBeUndefined();
    expect(visibleGroups(false).flatMap(g => g.items).length).toBe(SETTINGS_GROUPS.flatMap(g => g.items.filter(i => !i.testServerOnly)).length);
  });
});
