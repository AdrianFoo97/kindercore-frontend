import type { MissionDifficulty } from '../../../api/career-missions.js';
import type { MissionImportBody, MissionImportPreview } from '../../../api/missionImport.js';

// Career missions → Import with AI → the review: what the person keeps and
// changes before anything is created. Pure, unit-tested.

export interface CategoryChoice { include: boolean; name: string; achievementName: string }
export interface MissionChoice {
  include: boolean;
  title: string;
  positionId: string;
  categoryCode: string;
  difficulty: MissionDifficulty;
  required: boolean;
}
export interface ReviewState {
  categories: Record<string, CategoryChoice>;
  missions: Record<string, MissionChoice>;
}

/** New categories only (existing ones are just used). */
export const newCategories = (p: MissionImportPreview) => p.categories.filter(c => !c.existingCode);

/** Start: everything new kept; missions that already exist left out. */
export function initialReview(p: MissionImportPreview): ReviewState {
  return {
    categories: Object.fromEntries(newCategories(p).map(c => [c.key, { include: true, name: c.name, achievementName: c.achievementName }])),
    missions: Object.fromEntries(p.missions.map(m => [m.key, {
      include: !m.duplicate, title: m.title, positionId: m.positionId ?? '', categoryCode: m.categoryCode ?? '',
      difficulty: m.difficulty, required: m.required,
    }])),
  };
}

/** Category codes a kept mission may use: existing ones, plus the new ones being kept. */
export function usableCategoryCodes(p: MissionImportPreview, s: ReviewState, existingCodes: string[]): Set<string> {
  return new Set([...existingCodes, ...newCategories(p).filter(c => s.categories[c.key]?.include).map(c => c.code)]);
}

export interface ReviewCounts { missions: number; categories: number }
export const counts = (s: ReviewState): ReviewCounts => ({
  missions: Object.values(s.missions).filter(m => m.include).length,
  categories: Object.values(s.categories).filter(c => c.include).length,
});

/** Why Create is greyed out, or null when it can go ahead. */
export function blockReason(p: MissionImportPreview, s: ReviewState, existingCodes: string[]): string | null {
  const c = counts(s);
  if (c.missions + c.categories === 0) return 'Choose at least one mission or category';
  if (Object.values(s.categories).some(cat => cat.include && (!cat.name.trim() || !cat.achievementName.trim()))) {
    return 'Give each new category a name and an achievement name';
  }
  const usable = usableCategoryCodes(p, s, existingCodes);
  const kept = Object.values(s.missions).filter(m => m.include);
  if (kept.some(m => !m.title.trim())) return 'Give each mission a title';
  if (kept.some(m => !m.positionId)) return 'Pick a position for each mission';
  if (kept.some(m => !usable.has(m.categoryCode))) return 'Pick a category for each mission (or keep its new category)';
  return null;
}

/** What Create sends: the kept new categories and the kept missions, as edited. */
export function applyBody(p: MissionImportPreview, s: ReviewState): MissionImportBody {
  return {
    categories: newCategories(p).filter(c => s.categories[c.key]?.include).map(c => ({
      code: c.code, name: s.categories[c.key].name.trim(), achievementName: s.categories[c.key].achievementName.trim(),
      description: c.description, icon: c.icon, color: c.color,
    })),
    missions: p.missions.filter(m => s.missions[m.key]?.include).map(m => {
      const choice = s.missions[m.key];
      return {
        positionId: choice.positionId, title: choice.title.trim(), category: choice.categoryCode,
        description: m.description, whyItMatters: m.whyItMatters, evidenceRequirements: m.evidenceRequirements,
        difficulty: choice.difficulty, required: choice.required, highPriority: m.highPriority,
      };
    }),
  };
}
