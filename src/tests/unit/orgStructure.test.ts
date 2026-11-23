import { describe, it, expect } from 'vitest';
import { blockedHeadChoices, branchHeadcount, headsFrom, personReportsToProblem, linkedCount, orgTree, peopleTree, reportingIssue, reportsToOptions, suggestedManagers, teamSize } from '../../pages/settings/orgStructure';

// Settings → HR Planning → Organisational structure.

const pos = (positionId: string, titleWeight: number, reportsToPositionId: string | null = null) =>
  ({ positionId, name: positionId, departmentId: 'ACADEMIC', titleWeight, sortOrder: 0, reportsToPositionId });
const positions = [pos('PRIN', 6), pos('SV', 4, 'PRIN'), pos('SEI', 3, 'SV'), pos('JEI', 2, 'SV'), pos('ADMIN', 0)];
const staff = [
  { id: 'p', name: 'Pat', positionId: 'PRIN' },
  { id: 'a', name: 'Alicia', positionId: 'SV' }, { id: 'b', name: 'Ben', positionId: 'SV' },
  { id: 'n', name: 'Nabila', positionId: 'JEI' }, { id: 'h', name: 'Huda', positionId: 'JEI' },
];

describe('Organisational structure', () => {
  it('draws positions under the one they report to, highest rank first, with their staff A–Z', () => {
    const tree = orgTree(positions, staff);
    expect(tree.map(n => n.position.positionId)).toEqual(['PRIN', 'ADMIN']);
    const sv = tree[0].children[0];
    expect(sv.position.positionId).toBe('SV');
    expect(sv.children.map(n => n.position.positionId)).toEqual(['SEI', 'JEI']);
    expect(sv.children[1].staff.map(s => s.name)).toEqual(['Huda', 'Nabila']);
    expect(branchHeadcount(tree[0])).toBe(5);
    expect(linkedCount(positions)).toBe(3);
  });

  it('suggests the manager from the nearest filled position above — skipping a vacant one — and offers all when several hold it', () => {
    expect(suggestedManagers('SV', positions, staff).people.map(s => s.name)).toEqual(['Pat']);
    // Two supervisors: both offered, neither assumed.
    expect(suggestedManagers('JEI', positions, staff).people.map(s => s.name)).toEqual(['Alicia', 'Ben']);
    expect(suggestedManagers('PRIN', positions, staff)).toEqual({ position: null, people: [] });
    // Supervisor vacant: the line goes up to the Principal.
    expect(suggestedManagers('JEI', positions, staff.filter(s => s.positionId !== 'SV')).people.map(s => s.name)).toEqual(['Pat']);
  });

  it('offers only lines the rules allow: within the department and upwards, or — for its head — another department', () => {
    // Management: Principal (head) ← Shadow Principal. Academic: Supervisor (head) ← Senior EI, Junior EI. Support: no head yet.
    const p = (positionId: string, departmentId: string, titleWeight: number, reportsToPositionId: string | null = null) =>
      ({ positionId, name: positionId, departmentId, titleWeight, sortOrder: 0, reportsToPositionId });
    const all = [p('EP', 'MGMT', 6), p('SP', 'MGMT', 5, 'EP'), p('SV', 'ACAD', 4, 'SP'), p('SEI', 'ACAD', 3, 'SV'), p('EI', 'ACAD', 2, 'SV'), p('STAFF', 'SUP', 1, 'EP')];
    const heads = headsFrom([{ departmentId: 'MGMT', headPositionId: 'EP' }, { departmentId: 'ACAD', headPositionId: 'SV' }, { departmentId: 'SUP', headPositionId: null }]);
    const self = (id: string) => all.find(x => x.positionId === id)!;
    expect(reportsToOptions(all, heads, self('EI')).map(x => x.positionId)).toEqual(['SV', 'SEI']);
    // The head reports outside its department.
    expect(reportsToOptions(all, heads, self('SV')).map(x => x.positionId)).toEqual(['EP', 'SP', 'STAFF']);
    // A line set before the rules is flagged, not changed.
    expect(reportingIssue(all, heads, self('STAFF'))).toBe('It reports within its own department — only the department’s head reports outside it.');
    expect(reportingIssue(all, heads, self('EI'))).toBeNull();
  });

  it('shows a head the positions it can’t pick, and why — e.g. the Principal outside a Management department', () => {
    const p = (positionId: string, departmentId: string, titleWeight: number) => ({ positionId, name: positionId, departmentId, titleWeight, sortOrder: 0, reportsToPositionId: null });
    const all = [p('EP', 'OFFICE', 6), p('OM', 'SUP', 3), p('SV', 'ACAD', 4), p('EI', 'ACAD', 2)];
    const heads = headsFrom([{ departmentId: 'ACAD', headPositionId: 'SV' }]);
    const self = all.find(x => x.positionId === 'SV')!;
    // Only SUP is marked Management, so the Principal (in OFFICE) can’t be picked — it’s shown with the reason.
    expect(blockedHeadChoices(all, heads, self, new Set(['SUP'])).map(b => [b.position.positionId, b.why])).toEqual([['EP', 'not in a Management department']]);
    expect(blockedHeadChoices(all, heads, all.find(x => x.positionId === 'EI')!, new Set(['SUP']))).toEqual([]); // not a head
  });

  it('offers as managers only someone higher in their department or anyone in Management', () => {
    const ranked = [{ positionId: 'EI', departmentId: 'ACAD', titleWeight: 2 }, { positionId: 'SV', departmentId: 'ACAD', titleWeight: 4 }, { positionId: 'EP', departmentId: 'MGMT', titleWeight: 6 }];
    const mgmt = new Set(['MGMT']);
    expect(personReportsToProblem('EI', 'SV', true, ranked, mgmt)).toBeNull();
    expect(personReportsToProblem('EI', 'EP', true, ranked, mgmt)).toBeNull();
    expect(personReportsToProblem('SV', 'EI', true, ranked, mgmt)).not.toBeNull();
    expect(personReportsToProblem('EI', null, false, ranked, mgmt)).toMatch(/Pick who they report to/);
    expect(personReportsToProblem('EP', null, false, ranked, mgmt)).toBeNull();
  });

  it('draws people under the person they report to, A–Z, with anyone whose manager isn’t listed at the top — never leaving anyone out', () => {
    const people = [
      { id: 'p', name: 'Pat', positionId: 'PRIN', reportsToTeacherId: null },
      { id: 'b', name: 'Ben', positionId: 'SV', reportsToTeacherId: 'p' },
      { id: 'a', name: 'Alicia', positionId: 'SV', reportsToTeacherId: 'p' },
      { id: 'n', name: 'Nabila', positionId: 'JEI', reportsToTeacherId: 'a' },
      { id: 'x', name: 'Xena', positionId: 'JEI', reportsToTeacherId: 'left-already' },
    ];
    const roots = peopleTree(people);
    expect(roots.map(r => r.person.name)).toEqual(['Pat', 'Xena']);
    expect(roots[0].children.map(c => c.person.name)).toEqual(['Alicia', 'Ben']);
    expect(roots[0].children[0].children.map(c => c.person.name)).toEqual(['Nabila']);
    expect(teamSize(roots[0])).toBe(3);
    // A loop (each reports to the other) still shows both people, once each.
    const loop = peopleTree([{ id: 'a', name: 'A', positionId: null, reportsToTeacherId: 'b' }, { id: 'b', name: 'B', positionId: null, reportsToTeacherId: 'a' }]);
    expect(loop.map(r => [r.person.name, r.children.map(c => c.person.name)])).toEqual([['A', ['B']]]);
  });

  it('follows the position reporting line — a Junior EI reports to a Supervisor or above, never a Senior EI', () => {
    const line = [
      { positionId: 'EI', name: 'Junior EI', departmentId: 'ACAD', titleWeight: 2, reportsToPositionId: 'SV' },
      { positionId: 'SEI', name: 'Senior EI', departmentId: 'ACAD', titleWeight: 3, reportsToPositionId: 'SV' },
      { positionId: 'SV', name: 'Supervisor', departmentId: 'ACAD', titleWeight: 4, reportsToPositionId: 'EP' },
      { positionId: 'EP', name: 'Principal', departmentId: 'MGMT', titleWeight: 6, reportsToPositionId: null },
    ];
    const mgmt = new Set(['MGMT']);
    expect(personReportsToProblem('EI', 'SV', true, line, mgmt)).toBeNull();
    expect(personReportsToProblem('EI', 'EP', true, line, mgmt)).toBeNull();
    expect(personReportsToProblem('EI', 'SEI', true, line, mgmt)).toBe('They report to someone in a position above theirs: Supervisor, Principal.');
    expect(personReportsToProblem('SV', 'SEI', true, line, mgmt)).toMatch(/above theirs: Principal/);
  });
});
