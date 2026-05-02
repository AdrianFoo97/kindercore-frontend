import {
  faRoad, faClipboardCheck, faCalendarDays, faPeopleArrows, faStar,
  faBookOpen, faGraduationCap, faChalkboardUser, faShieldHalved,
  faHeart, faTrophy, faMedal,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { useQuery } from '@tanstack/react-query';
import { fetchMissionCategories, MissionCategoryRecord } from '../api/mission-categories.js';

// Resolves the FA icon name string admin saved to the actual icon object.
// Falls back to a sensible default when the name is unknown.
const ICON_MAP: Record<string, IconDefinition> = {
  faRoad, faClipboardCheck, faCalendarDays, faPeopleArrows, faStar,
  faBookOpen, faGraduationCap, faChalkboardUser, faShieldHalved,
  faHeart, faTrophy, faMedal,
};

export function resolveCategoryIcon(name: string): IconDefinition {
  return ICON_MAP[name] ?? faStar;
}

// Runtime version of the old hardcoded CATEGORY_META — used by all pages
// that render category-coloured chrome. `bg` is derived from the main
// color so categories created via the settings UI automatically get a
// matching tinted background.
export interface CategoryMeta {
  label: string;
  achievementName: string;
  description: string | null;
  color: string;
  bg: string;
  icon: IconDefinition;
}

export function categoryMetaFromRecord(record: MissionCategoryRecord): CategoryMeta {
  return {
    label: record.name,
    achievementName: record.achievementName,
    description: record.description,
    color: record.color,
    // 14% alpha tint — gives a soft category bg without needing a second
    // colour input on the settings form.
    bg: `${record.color}24`,
    icon: resolveCategoryIcon(record.icon),
  };
}

// Look up a category by code from a list (typically fetched once and
// cached via React Query). Returns a graceful fallback so a stale code
// (e.g. category was renamed) doesn't crash the page.
export function findCategoryMeta(
  categories: MissionCategoryRecord[],
  code: string,
): CategoryMeta {
  const found = categories.find(c => c.code === code);
  if (found) return categoryMetaFromRecord(found);
  return {
    label: code,
    achievementName: code,
    description: null,
    color: '#64748b',
    bg: '#64748b24',
    icon: resolveCategoryIcon('faStar'),
  };
}

// Convenience hook — fetches the category list (cached + deduped by React
// Query) and returns a stable getMeta(code) lookup. Components anywhere
// in the tree can call this without prop-drilling the categories array.
export function useCategoryMeta() {
  const { data: categories = [] } = useQuery({
    queryKey: ['mission-categories'],
    queryFn: fetchMissionCategories,
    staleTime: 5 * 60 * 1000, // 5 minutes — categories change rarely
  });
  return {
    categories,
    getMeta: (code: string): CategoryMeta => findCategoryMeta(categories, code),
  };
}
