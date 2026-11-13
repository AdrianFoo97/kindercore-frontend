import { describe, it, expect } from 'vitest';
import { MAX_FOCUS_MISSIONS, canPinAnother, focusMissions } from '../../utils/focusMissions';

// Home → Current Focus: every quest the teacher pinned (unfinished), at most three at a time.

const m = (id: string, isTargeted: boolean, status = 'IN_PROGRESS') => ({ id, progress: { isTargeted, status } });

describe('Current Focus', () => {
  it('shows every pinned quest that is not finished yet, in board order', () => {
    const list = [m('a', true), m('b', false), m('c', true, 'COMPLETED'), m('d', true, 'PENDING'), { id: 'e', progress: null }];
    expect(focusMissions(list).map(x => x.id)).toEqual(['a', 'd']);
  });

  it('allows three quests in focus at once — finished ones do not count', () => {
    expect(MAX_FOCUS_MISSIONS).toBe(3);
    expect(canPinAnother([m('a', true), m('b', true)])).toBe(true);
    expect(canPinAnother([m('a', true), m('b', true), m('c', true)])).toBe(false);
    expect(canPinAnother([m('a', true), m('b', true), m('c', true, 'COMPLETED')])).toBe(true);
  });
});