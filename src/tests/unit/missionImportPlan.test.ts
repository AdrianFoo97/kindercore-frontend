import { describe, it, expect } from 'vitest';
import type { MissionImportPreview, PreviewMission } from '../../api/missionImport';
import { applyBody, blockReason, counts, initialReview } from '../../pages/settings/missionImport/missionImportPlan';

// Career missions → Import with AI → checking it before anything is created. Made-up missions.

const mission = (key: string, extra: Partial<PreviewMission> = {}): PreviewMission => ({
  key, title: `Mission ${key}`, positionId: 'EI', positionText: null, categoryCode: 'TEACH', description: 'd', whyItMatters: null,
  evidenceRequirements: null, difficulty: 'BASIC', required: true, highPriority: false, duplicate: false, ...extra,
});

const PREVIEW: MissionImportPreview = {
  fileName: 'missions.xlsx', provider: 'fake', model: 'fake-1',
  categories: [
    { key: 'TEACH', name: 'Teaching', achievementName: 'Teacher', description: null, code: 'TEACH', icon: 'faStar', color: '#1e40af', existingCode: 'TEACH' },
    { key: 'new:PARENT_CARE', name: 'Parent Care', achievementName: 'Parent Care', description: 'x', code: 'PARENT_CARE', icon: 'faStar', color: '#0e7490', existingCode: null },
  ],
  missions: [
    mission('m0'),
    mission('m1', { categoryCode: 'PARENT_CARE' }),
    mission('m2', { duplicate: true }),
    mission('m3', { positionId: null, positionText: 'Head Chef' }),
  ],
};
const EXISTING = ['TEACH'];

describe('Career missions — reviewing an AI import', () => {
  it('starts with every new category and new mission kept, and missions that already exist left out', () => {
    const s = initialReview(PREVIEW);
    expect(counts(s)).toEqual({ missions: 3, categories: 1 });
    expect(s.missions.m2.include).toBe(false);
    expect(Object.keys(s.categories)).toEqual(['new:PARENT_CARE']);
  });

  it('waits for a position, and for a category that exists or is being created, before Create', () => {
    const s = initialReview(PREVIEW);
    expect(blockReason(PREVIEW, s, EXISTING)).toBe('Pick a position for each mission');
    const withPosition = { ...s, missions: { ...s.missions, m3: { ...s.missions.m3, positionId: 'EI' } } };
    expect(blockReason(PREVIEW, withPosition, EXISTING)).toBeNull();
    const droppedCategory = { ...withPosition, categories: { 'new:PARENT_CARE': { ...withPosition.categories['new:PARENT_CARE'], include: false } } };
    expect(blockReason(PREVIEW, droppedCategory, EXISTING)).toBe('Pick a category for each mission (or keep its new category)');
    const nothing = { categories: { 'new:PARENT_CARE': { ...s.categories['new:PARENT_CARE'], include: false } }, missions: Object.fromEntries(Object.entries(s.missions).map(([k, m]) => [k, { ...m, include: false }])) };
    expect(blockReason(PREVIEW, nothing, EXISTING)).toBe('Choose at least one mission or category');
  });

  it('sends only what was kept, as edited — with the file’s descriptions carried through', () => {
    const s = initialReview(PREVIEW);
    const edited = { ...s, missions: { ...s.missions, m0: { ...s.missions.m0, title: '  Lead circle time ', difficulty: 'ADVANCED' as const }, m3: { ...s.missions.m3, include: false } } };
    const body = applyBody(PREVIEW, edited);
    expect(body.categories).toEqual([{ code: 'PARENT_CARE', name: 'Parent Care', achievementName: 'Parent Care', description: 'x', icon: 'faStar', color: '#0e7490' }]);
    expect(body.missions.map(m => [m.title, m.category, m.difficulty, m.description])).toEqual([
      ['Lead circle time', 'TEACH', 'ADVANCED', 'd'],
      ['Mission m1', 'PARENT_CARE', 'BASIC', 'd'],
    ]);
  });
});
