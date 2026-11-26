import { describe, it, expect } from 'vitest';
import { copyChoices } from '../../pages/branches/copyChoices';

// "Copy to branch…" — what can be copied to the other branch, and when Copy is allowed.

const BUKIT = 'b1';
const SKUDAI = 'b2';
const mine = [{ id: 'n1', name: 'N1', branchId: BUKIT }, { id: 'n2', name: 'N2', branchId: BUKIT }, { id: 'p1', name: 'P1', branchId: BUKIT }];
const all = [...mine, { id: 's-n1', name: ' n1 ', branchId: SKUDAI }];

describe('Copy to branch — choices', () => {
  it('starts with nothing ticked, so Copy is off until at least one is picked', () => {
    expect(copyChoices(mine, all, SKUDAI, new Set())).toMatchObject({ picked: [], canCopy: false });
    expect(copyChoices(mine, all, SKUDAI, new Set(['n2'])).canCopy).toBe(true);
    expect(copyChoices(mine, all, '', new Set(['n2'])).canCopy).toBe(false);
  });

  it('marks what the other branch already has (same name, any case or spacing) — it can’t be ticked or copied', () => {
    const c = copyChoices(mine, all, SKUDAI, new Set(['n1', 'n2']));
    expect(c.isThere(mine[0])).toBe(true);
    expect(c.copyable.map(i => i.name)).toEqual(['N2', 'P1']);
    expect(c.picked.map(i => i.name)).toEqual(['N2']);
  });

  it('knows when everything that can be copied is ticked (for Select all / none)', () => {
    expect(copyChoices(mine, all, SKUDAI, new Set(['n2', 'p1'])).allOn).toBe(true);
    expect(copyChoices(mine, all, SKUDAI, new Set(['n2'])).allOn).toBe(false);
    expect(copyChoices([mine[0]], all, SKUDAI, new Set()).allOn).toBe(false); // nothing copyable
  });
});
