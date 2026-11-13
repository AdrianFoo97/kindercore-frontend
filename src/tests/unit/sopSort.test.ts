import { describe, it, expect } from 'vitest';
import { parseSopSort, sortGuides } from '../../pages/operations/sopSort';

// How-To Guides → sort the list by name, last updated, newest or most steps.

const g = (id: string, title: string, createdAt: string, updatedAt: string) => ({ id, title, createdAt, updatedAt });
const guides = [
  g('a', 'Open the centre', '2026-01-10T00:00:00Z', '2026-11-01T00:00:00Z'),
  g('b', 'Fire drill', '2026-06-01T00:00:00Z', '2026-06-01T00:00:00Z'),
  g('c', 'Greet parents', '2026-03-05T00:00:00Z', '2026-11-08T00:00:00Z'),
];
const titles = (list: typeof guides) => list.map(x => x.title);

describe('How-To Guides — sort order', () => {
  it('sorts by name, last updated, or newest', () => {
    expect(titles(sortGuides(guides, 'name'))).toEqual(['Fire drill', 'Greet parents', 'Open the centre']);
    expect(titles(sortGuides(guides, 'updated'))).toEqual(['Greet parents', 'Open the centre', 'Fire drill']);
    expect(titles(sortGuides(guides, 'newest'))).toEqual(['Fire drill', 'Greet parents', 'Open the centre']);
  });

  it('sorts by most steps, falling back to name for ties or while counts load', () => {
    expect(titles(sortGuides(guides, 'steps', { a: 12, b: 4, c: 12 }))).toEqual(['Greet parents', 'Open the centre', 'Fire drill']);
    expect(titles(sortGuides(guides, 'steps'))).toEqual(['Fire drill', 'Greet parents', 'Open the centre']);
  });

  it('reads the sort from the link, defaulting to name for anything unknown', () => {
    expect(parseSopSort('updated')).toBe('updated');
    expect(parseSopSort(null)).toBe('name');
    expect(parseSopSort('random')).toBe('name');
  });
});
