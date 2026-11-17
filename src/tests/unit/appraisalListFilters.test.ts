import { describe, it, expect } from 'vitest';
import { applyFilter, copyName, formFilterOf, scaleFilterOf, scoringFormFilterOf } from '../../pages/settings/appraisalForms/listFilters';

// The filters on Settings → Appraisals lists (appraisal forms, scoring forms,
// rating scales) and the name a duplicate starts with.

describe('Appraisals lists — filters and copies', () => {
  it('sorts each item into live / draft / retired, active / incomplete / inactive, or active / inactive', () => {
    expect(['ACTIVE', 'DRAFT', 'RETIRED'].map(status => formFilterOf({ status: status as 'ACTIVE' }))).toEqual(['live', 'draft', 'retired']);
    expect(scoringFormFilterOf({ isActive: true, problems: [] })).toBe('active');
    expect(scoringFormFilterOf({ isActive: true, problems: ['Add at least one section.'] })).toBe('incomplete');
    // Switched off wins, even when it also has something to fix.
    expect(scoringFormFilterOf({ isActive: false, problems: ['x'] })).toBe('inactive');
    expect(scaleFilterOf({ isActive: false })).toBe('inactive');
  });

  it('shows only the chosen filter, and counts every filter for its label', () => {
    const items = [{ isActive: true }, { isActive: false }, { isActive: true }];
    const active = applyFilter(items, 'active', scaleFilterOf);
    expect(active.shown).toHaveLength(2);
    expect(active.counts).toEqual({ all: 3, active: 2, inactive: 1 });
    expect(applyFilter(items, 'all', scaleFilterOf).shown).toHaveLength(3);
  });

  it('names a copy "… (copy)", kept within the name limit', () => {
    expect(copyName('Classroom care', 100)).toBe('Classroom care (copy)');
    expect(copyName('x'.repeat(100), 100)).toHaveLength(100);
    expect(copyName('x'.repeat(100), 100).endsWith(' (copy)')).toBe(true);
  });
});