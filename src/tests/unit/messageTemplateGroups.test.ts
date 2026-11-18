import { describe, it, expect } from 'vitest';
import { BUILT_IN_TEMPLATES, templateGroupOf, visibleTemplateGroups } from '../../pages/messageTemplateGroups.js';

describe('Message template groups', () => {
  it('lists Common for everyone, then each group only with its module', () => {
    expect(visibleTemplateGroups(() => false)).toEqual(['COMMON']);
    expect(visibleTemplateGroups(m => m === 'HR')).toEqual(['COMMON', 'HR']);
    expect(visibleTemplateGroups(() => true)).toEqual(['COMMON', 'MARKETING', 'HR']);
  });

  it('treats a template saved without a group as Common', () => {
    expect(templateGroupOf({})).toBe('COMMON');
    expect(templateGroupOf({ group: 'MARKETING' })).toBe('MARKETING');
  });

  it('puts the lead templates in Marketing and the recruitment ones in HR', () => {
    const group = (id: string) => BUILT_IN_TEMPLATES.find(t => t.id === id)?.group;
    expect(group('enquiry')).toBe('MARKETING');
    expect(group('offer_letter')).toBe('HR');
  });
});
