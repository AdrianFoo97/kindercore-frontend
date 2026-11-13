import { describe, it, expect } from 'vitest';
import { compareSteps, countChanges, hasChanges, rowLabel } from '../../pages/operations/sopStepCompare';

// A guide suggestion beside the current guide, step by step — what the
// reviewer and the teacher both see.

const live = [
  { section: 'Arrival', title: 'Greet the parent', detail: null },
  { section: 'Arrival', title: 'Make a circle', detail: null },
  { section: 'Arrival', title: 'Sing hello song', detail: null },
  { section: 'Handover', title: 'Sign the paper sheet', detail: null },
];
const kinds = (rows: ReturnType<typeof compareSteps>) => rows.map(r => `${r.kind}:${r.before?.title ?? '-'}>${r.after?.title ?? '-'}`);

describe('Guide suggestions — the current guide beside the suggestion', () => {
  it('pairs a reworded step with the one it replaces, instead of showing it removed and added', () => {
    const rows = compareSteps(live, [live[0], { ...live[1], title: 'Make a rectangle' }, live[2], live[3]]);
    expect(kinds(rows)[1]).toBe('changed:Make a circle>Make a rectangle');
    expect(rows[1]).toMatchObject({ titleChanged: true, detailChanged: false, beforeNumber: 2, afterNumber: 2 });
    expect(countChanges(rows)).toEqual({ changed: 1, added: 0, removed: 0, moved: 0 });
  });

  it('marks added details as a change to that step', () => {
    const rows = compareSteps(live, [live[0], live[1], { ...live[2], detail: 'Sing bla bla bla' }, live[3]]);
    expect(rows[2]).toMatchObject({ kind: 'changed', titleChanged: false, detailChanged: true });
    expect(rowLabel(rows[2])).toBe('Changed');
  });

  it('shows removed steps where they used to be, and new steps where they were added', () => {
    const rows = compareSteps(live, [live[0], live[2], { section: 'Handover', title: 'Sign in on the tablet' }, live[3]]);
    // "Make a circle" removed (no same-section step left in its place); tablet step added in Handover.
    expect(kinds(rows)).toEqual([
      'same:Greet the parent>Greet the parent',
      'removed:Make a circle>-',
      'same:Sing hello song>Sing hello song',
      'added:->Sign in on the tablet',
      'same:Sign the paper sheet>Sign the paper sheet',
    ]);
  });

  it('notices a step moved to a new position or section, and reports nothing for an identical copy', () => {
    const moved = compareSteps(live, [live[2], live[0], live[1], live[3]]);
    expect(moved.some(r => r.moved)).toBe(true);
    expect(rowLabel(moved.find(r => r.moved)!)).toBe('Moved');
    const resectioned = compareSteps(live, [live[0], live[1], live[2], { ...live[3], section: 'Arrival' }]);
    expect(rowLabel(resectioned[3])).toBe('Moved to another section');
    expect(hasChanges(compareSteps(live, live))).toBe(false);
  });
});
