import { describe, it, expect } from 'vitest';
import { checklistItemProblem, checklistLinkProblem, isExternalLink, matchesTemplate, parseChecklistTemplate, updateToTemplate } from '../../pages/checklistItems.js';

describe('Checklist items with a link button', () => {
  it('accepts web addresses and app pages, and explains anything else', () => {
    expect(checklistLinkProblem('https://forms.gle/abc')).toBeNull();
    expect(checklistLinkProblem('/teachers/t1/home')).toBeNull();
    expect(checklistLinkProblem('javascript:alert(1)')).toMatch(/https:\/\//);
    expect(checklistItemProblem({ task: 'EPF form', linkUrl: 'https://kwsp.gov.my' })).toMatch(/label/);
    expect(checklistItemProblem({ task: 'EPF form', linkLabel: 'Open form', linkUrl: 'https://kwsp.gov.my' })).toBeNull();
    expect(checklistItemProblem({ task: '  ' })).toMatch(/needs some text/);
    expect(checklistItemProblem({ task: 'EPF form', description: 'x'.repeat(501) })).toMatch(/description/);
  });

  it('reads old plain-text lists and new ones, and opens web links in a new tab', () => {
    expect(parseChecklistTemplate(['Sign contract', { task: 'App', description: ' Ask the office. ', linkLabel: 'Get it', linkUrl: 'https://x.example' }, '  ']))
      .toEqual([{ task: 'Sign contract' }, { task: 'App', description: 'Ask the office.', linkLabel: 'Get it', linkUrl: 'https://x.example' }]);
    expect(isExternalLink('https://x.example')).toBe(true);
    expect(isExternalLink('/settings')).toBe(false);
  });

  it('spots a checklist made from an older version of the steps, ticks aside', () => {
    const template = [{ task: 'Sign contract' }, { task: 'EPF form', linkLabel: 'Open', linkUrl: 'https://kwsp.gov.my' }];
    expect(matchesTemplate([{ task: 'Sign contract', done: true }, { task: 'EPF form', linkLabel: 'Open', linkUrl: 'https://kwsp.gov.my', done: false }], template)).toBe(true);
    expect(matchesTemplate([{ task: 'Sign contract', done: true }, { task: 'EPF form', done: false }], template)).toBe(false);
    expect(matchesTemplate([{ task: 'Sign contract', done: true }], template)).toBe(false);
  });

  it('brings a checklist up to the latest steps, keeping ticks on steps that still match', () => {
    const old = [{ task: 'Sign contract', done: true }, { task: 'Old step', done: true }, { task: 'EPF  form', done: true }];
    const latest = [{ task: 'EPF form', description: 'KWSP 6' }, { task: 'Sign contract' }, { task: 'Meet buddy' }];
    expect(updateToTemplate(old, latest)).toEqual({
      steps: [{ task: 'EPF form', description: 'KWSP 6', done: true }, { task: 'Sign contract', done: true }, { task: 'Meet buddy', done: false }],
      added: 1, removed: 1,
    });
  });
});
