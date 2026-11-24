import { describe, it, expect } from 'vitest';
import { fitWithin, pickedPhotoProblem } from '../../pages/operations/guidePhotos/guidePhotoRules';
import { fitsOnePage, posterColumns, posterPages, type PosterStepInput } from '../../pages/operations/poster/posterLayout';
import { posterOutdated, posterView } from '../../pages/operations/poster/posterView';

// How-To Guides → step photos (shrunk on the device before upload) and the
// printable poster (every step, numbered, grouped by section, on A4 sheets).

const steps = (n: number, section = (i: number) => 'Main'): PosterStepInput[] =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, section: section(i), title: `Step ${i + 1}`, imageId: i % 2 ? 'img' : null }));

describe('Guide step photos', () => {
  it('shrinks a phone photo to 1600 px on its longest side, keeping its shape — and never enlarges a small one', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('takes JPG, PNG and WebP photos under 25 MB — and says which file is wrong otherwise', () => {
    expect(pickedPhotoProblem({ name: 'sink.jpg', type: 'image/jpeg', size: 4_000_000 })).toBeNull();
    expect(pickedPhotoProblem({ name: 'clip.mp4', type: 'video/mp4', size: 1000 })).toMatch(/clip\.mp4.*isn’t a photo/);
    expect(pickedPhotoProblem({ name: 'huge.png', type: 'image/png', size: 30 * 1024 * 1024 })).toMatch(/huge\.png.*under 25 MB/);
  });
});

describe('Guide poster layout', () => {
  it('puts every step on the poster, numbered in order — bigger tiles when there are fewer steps', () => {
    const pages = posterPages(steps(6));
    expect(pages).toHaveLength(1);
    expect(pages[0].groups.flatMap(g => g.steps.map(s => s.number))).toEqual([1, 2, 3, 4, 5, 6]);
    expect([posterColumns(3), posterColumns(6), posterColumns(12)]).toEqual([2, 3, 4]);
  });

  it('shows section headings only when the guide has more than one section', () => {
    expect(posterPages(steps(4))[0].groups.map(g => g.section)).toEqual([null]);
    const two = posterPages(steps(6, i => (i < 3 ? 'Before class' : 'After class')));
    expect(two[0].groups.map(g => [g.section, g.steps.length])).toEqual([['Before class', 3], ['After class', 3]]);
  });

  it('carries a long guide onto more pages — no step dropped, a split section marked “continued”', () => {
    const pages = posterPages(steps(20, i => (i < 14 ? 'Main' : 'Close')));
    const all = pages.flatMap(p => p.groups.flatMap(g => g.steps.map(s => s.number)));
    expect(all).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.every(p => p.stepCount <= 12)).toBe(true);
    expect(pages[1].groups[0]).toMatchObject({ section: 'Main', continued: true });
  });

  it('starts a new page before the steps would run off the sheet — e.g. many short sections', () => {
    expect(fitsOnePage(Array(12).fill(null))).toBe(true);
    expect(fitsOnePage(['a', 'b', 'c', 'd'])).toBe(false); // four headed rows of big tiles don't fit
    const pages = posterPages(steps(6, i => `Section ${i}`));
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.every(p => fitsOnePage(p.groups.flatMap(g => g.steps.map(() => g.section))))).toBe(true);
  });
});

describe('Guide poster — which one shows', () => {
  const base = { currentVersion: 4, posterImageId: null, posterVersion: null, posterDraftImageId: null };
  it('shows the saved AI poster once there is one — and the simple poster until then', () => {
    expect(posterView(base, true)).toBe('simple');
    expect(posterView({ ...base, posterImageId: 'p1', posterVersion: 4 }, false)).toBe('ai');
  });

  it('shows a new AI poster to check only to guide authors — everyone else keeps seeing the saved one', () => {
    const t = { ...base, posterImageId: 'p1', posterVersion: 4, posterDraftImageId: 'd1' };
    expect(posterView(t, true)).toBe('draft');
    expect(posterView(t, false)).toBe('ai');
  });

  it('flags a saved poster drawn from an older version of the guide', () => {
    expect(posterOutdated({ ...base, posterImageId: 'p1', posterVersion: 3 })).toBe(true);
    expect(posterOutdated({ ...base, posterImageId: 'p1', posterVersion: 4 })).toBe(false);
    expect(posterOutdated(base)).toBe(false);
  });
});
