import { describe, it, expect } from 'vitest';
import { resolveLibraryView, toggleFavorite, viewParam } from '../../pages/operations/sopFavorites';

// Guides → favourites: teachers star the guides they use; the library opens on them.

describe('Favourite guides', () => {
  it('always opens on Favourites, so the tab never jumps after loading', () => {
    expect(resolveLibraryView(null)).toBe('favorites');
    expect(resolveLibraryView('anything-else')).toBe('favorites');
  });

  it('keeps the tab someone chose (All guides or Labels)', () => {
    expect(resolveLibraryView('all')).toBe('guides');
    expect(resolveLibraryView('labels')).toBe('labels');
    expect(viewParam('guides')).toBe('all');
  });

  it('stars and unstars a guide without duplicates', () => {
    expect(toggleFavorite(['a'], 'b', true)).toEqual(['a', 'b']);
    expect(toggleFavorite(['a', 'b'], 'b', true)).toEqual(['a', 'b']);
    expect(toggleFavorite(['a', 'b'], 'a', false)).toEqual(['b']);
  });
});