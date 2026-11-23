// Settings → HR Planning → Organisational structure: positions arranged by who
// they report to (Junior EI → Supervisor → Principal), each with the staff who
// hold it. Pure logic, no React.

export interface OrgPosition {
  positionId: string;
  name: string;
  departmentId: string | null;
  titleWeight: number;
  sortOrder: number;
  reportsToPositionId?: string | null;
}
export interface OrgStaff { id: string; name: string; positionId: string | null }

export interface OrgNode<P extends OrgPosition = OrgPosition, S extends OrgStaff = OrgStaff> {
  position: P;
  staff: S[];
  children: OrgNode<P, S>[];
}

/** Higher rank first, then the saved order, then A–Z. */
const byRank = (a: OrgPosition, b: OrgPosition) => b.titleWeight - a.titleWeight || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

/**
 * The chart: the positions nobody's above (or whose "reports to" is gone) at
 * the top, each with the positions reporting to it beneath — highest rank
 * first at every level — and the staff holding each, A–Z.
 */
export function orgTree<P extends OrgPosition, S extends OrgStaff>(positions: P[], staff: S[]): OrgNode<P, S>[] {
  const ids = new Set(positions.map(p => p.positionId));
  const holders = (id: string) => staff.filter(s => s.positionId === id).sort((a, b) => a.name.localeCompare(b.name));
  const build = (p: P, seen: Set<string>): OrgNode<P, S> => {
    const next = new Set(seen).add(p.positionId);
    const kids = positions.filter(c => c.reportsToPositionId === p.positionId && !next.has(c.positionId)).sort(byRank);
    return { position: p, staff: holders(p.positionId), children: kids.map(c => build(c, next)) };
  };
  const roots = positions.filter(p => !p.reportsToPositionId || !ids.has(p.reportsToPositionId)).sort(byRank);
  return roots.map(p => build(p, new Set()));
}

/** How many positions have a reporting line set — none means the chart is just a row of unconnected positions. */
export const linkedCount = (positions: OrgPosition[]) => positions.filter(p => !!p.reportsToPositionId).length;

/** Everyone in a branch of the chart (the position's own staff and everyone below it). */
export function branchHeadcount(node: OrgNode): number {
  return node.staff.length + node.children.reduce((n, c) => n + branchHeadcount(c), 0);
}

/**
 * Who a staff member in this position would usually report to: the person in
 * the position it reports to — when exactly one person holds it. Several (or
 * nobody) → no single suggestion; the list says who could be picked.
 */
export function suggestedManagers<S extends OrgStaff>(positionId: string | null, positions: OrgPosition[], staff: S[], selfId?: string): { position: OrgPosition | null; people: S[] } {
  const parentId = positions.find(p => p.positionId === positionId)?.reportsToPositionId ?? null;
  const position = positions.find(p => p.positionId === parentId) ?? null;
  if (!position) return { position: null, people: [] };
  return { position, people: staff.filter(s => s.positionId === position.positionId && s.id !== selfId).sort((a, b) => a.name.localeCompare(b.name)) };
}

/** Each department's head position (department id → position id, or null when not set). */
export type DepartmentHeads = Map<string, string | null>;
export const headsFrom = (departments: { departmentId: string; headPositionId?: string | null }[]): DepartmentHeads =>
  new Map(departments.map(d => [d.departmentId, d.headPositionId ?? null]));
export const isDepartmentHead = (heads: DepartmentHeads, p: Pick<OrgPosition, 'positionId' | 'departmentId'>) =>
  !!p.departmentId && heads.get(p.departmentId) === p.positionId;

/**
 * Why `self` can't report to `parentId` — or null. The server's rules
 * (orgStructure.logic): a position reports to a higher-ranked one in its own
 * department; its department's head reports to another department (or nobody,
 * at the top); a department with no head lets its positions report to nobody;
 * never in a loop.
 */
export function reportingProblem(
  all: OrgPosition[], heads: DepartmentHeads, self: Pick<OrgPosition, 'positionId' | 'departmentId' | 'titleWeight'>, parentId: string | null,
  /** Departments marked as management — when any are, other departments' heads report only into them. */
  management: Set<string> = new Set(),
): string | null {
  const head = isDepartmentHead(heads, self);
  const deptHasHead = !!self.departmentId && !!heads.get(self.departmentId);
  if (parentId == null) return head || !deptHasHead ? null : 'It isn’t its department’s head, so it reports to a position in its own department.';
  if (parentId === self.positionId) return 'A position can’t report to itself.';
  const parent = all.find(p => p.positionId === parentId);
  if (!parent) return 'That position no longer exists — pick again.';
  if (head && parent.departmentId === self.departmentId) return 'A department’s head reports to a position in another department.';
  // Once departments are marked as management, heads report only into them.
  if (head && management.size > 0 && !management.has(parent.departmentId ?? '')) return 'A department’s head reports to a position in a management department.';
  if (!head && parent.departmentId !== self.departmentId) return 'It reports within its own department — only the department’s head reports outside it.';
  if (!head && parent.titleWeight <= self.titleWeight) return 'It can only report to a higher-ranked position.';
  const byId = new Map(all.map(p => [p.positionId, p.reportsToPositionId ?? null]));
  const seen = new Set<string>();
  for (let at: string | null | undefined = parentId; at; at = byId.get(at)) {
    if (at === self.positionId) return 'That would make a loop — the position it reports to already reports to it.';
    if (seen.has(at)) break;
    seen.add(at);
  }
  return null;
}

/**
 * For a department's head: the positions in other departments it can't report to, and
 * why in a few words — shown greyed out, so a missing choice (e.g. the Principal) explains itself.
 */
export function blockedHeadChoices<P extends OrgPosition>(all: P[], heads: DepartmentHeads, self: Pick<OrgPosition, 'positionId' | 'departmentId' | 'titleWeight'>, management: Set<string> = new Set()): { position: P; why: string }[] {
  if (!isDepartmentHead(heads, self)) return [];
  return all
    .filter(p => p.positionId !== self.positionId && p.departmentId !== self.departmentId)
    .map(p => ({ position: p, problem: reportingProblem(all, heads, self, p.positionId, management) }))
    .filter((x): x is { position: P; problem: string } => !!x.problem)
    .map(x => ({ position: x.position, why: x.problem.includes('management') ? 'not in a Management department' : x.problem.includes('loop') ? 'it already reports to this line' : 'not allowed' }))
    .sort((a, b) => byRank(a.position, b.position));
}

/** The positions `self` may report to under the rules — highest rank first. */
export function reportsToOptions<P extends OrgPosition>(all: P[], heads: DepartmentHeads, self: Pick<OrgPosition, 'positionId' | 'departmentId' | 'titleWeight'>, management: Set<string> = new Set()): P[] {
  return all.filter(p => p.positionId !== self.positionId && !reportingProblem(all, heads, self, p.positionId, management)).sort(byRank);
}

/** What's wrong with a position's saved reporting line under the rules (e.g. set before them), or null. */
export const reportingIssue = (all: OrgPosition[], heads: DepartmentHeads, p: OrgPosition, management: Set<string> = new Set()) => reportingProblem(all, heads, p, p.reportsToPositionId ?? null, management);
/** The departments marked as management. */
export const managementFrom = (departments: { departmentId: string; isManagement?: boolean }[]) => new Set(departments.filter(d => d.isManagement).map(d => d.departmentId));

// ── A person's "Reports to" (staff records) ─────────────────────────────────
// Everyone reports to someone higher-ranked in their own department, or to
// anyone in a Management department. Only Management staff may report to
// nobody (the top of the organisation). The server checks the same (orgStructure.logic).

export interface RankedPosition { positionId: string; departmentId: string | null; titleWeight: number }

/** Why this person can't report to that manager (null = nobody) — or null when they can. */
export function personReportsToProblem(
  selfPositionId: string | null, managerPositionId: string | null | undefined, managerChosen: boolean,
  positions: RankedPosition[], management: Set<string>,
): string | null {
  const self = positions.find(p => p.positionId === selfPositionId) ?? null;
  const selfInManagement = !!self?.departmentId && management.has(self.departmentId);
  if (!managerChosen) return selfInManagement ? null : 'Pick who they report to — only Management staff can report to nobody.';
  const mgr = positions.find(p => p.positionId === managerPositionId) ?? null;
  if (mgr?.departmentId && management.has(mgr.departmentId)) return null;
  if (self && mgr && self.departmentId && mgr.departmentId === self.departmentId && mgr.titleWeight > self.titleWeight) return null;
  return 'They can report to someone higher-ranked in their own department, or anyone in Management.';
}

// ── By person: who each staff member reports to (Teacher.reportsToTeacherId,
// set on their staff record). This is what decides someone's team in HRMS.

export interface OrgPerson { id: string; name: string; positionId: string | null; reportsToTeacherId?: string | null }
export interface PersonNode<S extends OrgPerson = OrgPerson> { person: S; children: PersonNode<S>[] }

/**
 * People under the person they report to, A–Z at every level. Anyone whose
 * manager isn't in the list (left, or not set) sits at the top. A loop can't
 * hang the chart or hide anyone: each branch stops at someone already above
 * it, and anyone only reachable through a loop starts their own branch.
 */
export function peopleTree<S extends OrgPerson>(people: S[]): PersonNode<S>[] {
  const ids = new Set(people.map(p => p.id));
  const byName = (a: S, b: S) => a.name.localeCompare(b.name);
  const build = (p: S, seen: Set<string>): PersonNode<S> => {
    const next = new Set(seen).add(p.id);
    const kids = people.filter(c => c.reportsToTeacherId === p.id && !next.has(c.id)).sort(byName);
    return { person: p, children: kids.map(c => build(c, next)) };
  };
  const tops = people.filter(p => !p.reportsToTeacherId || !ids.has(p.reportsToTeacherId)).sort(byName);
  const roots = tops.map(p => build(p, new Set()));
  // Nobody is left off: someone only reachable through a loop starts their own branch.
  const shown = new Set<string>();
  const mark = (n: PersonNode<S>) => { shown.add(n.person.id); n.children.forEach(mark); };
  roots.forEach(mark);
  for (const p of [...people].sort(byName)) {
    if (shown.has(p.id)) continue;
    const branch = build(p, new Set());
    mark(branch);
    roots.push(branch);
  }
  return roots;
}

/** Everyone below this person (directly or further down) — their team in HRMS. */
export function teamSize(node: PersonNode): number {
  return node.children.reduce((n, c) => n + 1 + teamSize(c), 0);
}
