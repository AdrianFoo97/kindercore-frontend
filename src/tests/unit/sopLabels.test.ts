import { describe, it, expect } from 'vitest';
import { NO_LABEL, findLabels, guideHasLabel, labelSummaries, parseLabelSort } from '../../pages/operations/sopLabels';

// How-To Guides → Labels view: counts per label and which guides a label shows.

const MORNING = { id: 'l-morning', name: 'Morning routine', color: '#f59e0b' };
const SAFETY = { id: 'l-safety', name: 'Safety', color: '#ef4444' };
const guides = [
  { title: 'Open the centre', categories: [{ id: 'l-morning' }] },
  { title: 'Greet parents', categories: [{ id: 'l-morning' }, { id: 'l-safety' }] },
  { title: 'Fire drill', categories: [{ id: 'l-safety' }] },
  { title: 'Order supplies', categories: [] },
  { title: 'Old guide', categories: null },
];

describe('How-To Guides — label view', () => {
  it('counts the guides under each label, in the labels\' own order, and the ones with no label', () => {
    expect(labelSummaries([MORNING, SAFETY], guides)).toEqual({
      labels: [
        { id: 'l-morning', name: 'Morning routine', color: '#f59e0b', count: 2 },
        { id: 'l-safety', name: 'Safety', color: '#ef4444', count: 2 },
      ],
      unlabelled: 2,
    });
  });

  it('shows a label with no guides yet as zero, not missing', () => {
    const empty = { id: 'l-empty', name: 'Closing', color: '#64748b' };
    expect(labelSummaries([empty], guides).labels[0].count).toBe(0);
  });

  it('finds labels by any part of the name, whatever the capitals', () => {
    const { labels } = labelSummaries([MORNING, SAFETY], guides);
    expect(findLabels(labels, 'ROUT', 'order').map(l => l.name)).toEqual(['Morning routine']);
    expect(findLabels(labels, '  ', 'order')).toHaveLength(2);
    expect(findLabels(labels, 'lunch', 'order')).toEqual([]);
  });

  it('sorts labels by your order, name, or most / fewest guides', () => {
    const labels = [
      { id: 'z', name: 'Zoo trip', color: '#000', count: 1 },
      { id: 'a', name: 'Arrival', color: '#000', count: 5 },
      { id: 'm', name: 'Meals', color: '#000', count: 1 },
    ];
    const names = (sort: Parameters<typeof findLabels>[2]) => findLabels(labels, '', sort).map(l => l.name);
    expect(names('order')).toEqual(['Zoo trip', 'Arrival', 'Meals']);
    expect(names('name')).toEqual(['Arrival', 'Meals', 'Zoo trip']);
    expect(names('most')).toEqual(['Arrival', 'Meals', 'Zoo trip']);
    expect(names('fewest')).toEqual(['Meals', 'Zoo trip', 'Arrival']);
    expect(parseLabelSort('bogus')).toBe('order');
  });

  it('opens a label to just its guides — a guide with two labels shows under both', () => {
    expect(guides.filter(g => guideHasLabel(g, 'l-morning')).map(g => g.title)).toEqual(['Open the centre', 'Greet parents']);
    expect(guides.filter(g => guideHasLabel(g, 'l-safety')).map(g => g.title)).toEqual(['Greet parents', 'Fire drill']);
    expect(guides.filter(g => guideHasLabel(g, NO_LABEL)).map(g => g.title)).toEqual(['Order supplies', 'Old guide']);
    expect(guides.filter(g => guideHasLabel(g, 'ALL'))).toHaveLength(5);
  });
});
