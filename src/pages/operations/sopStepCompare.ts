// A suggested change to a How-To Guide, step by step beside the current
// guide — the one copy, shown to the reviewer (Improvement Inbox) and to the
// teacher who suggested it (My guide ideas).
//
// Steps are paired in two passes:
//   1. same title (case and spacing ignored) — the same step, maybe edited or moved;
//   2. what's left, in the same section and the same place (between the same
//      matched neighbours), in order — a reworded step, not one removed + one added.

export interface CompareStep { section: string; title: string; detail?: string | null }

export type RowKind = 'same' | 'changed' | 'added' | 'removed';

export interface CompareRow<A extends CompareStep = CompareStep> {
  kind: RowKind;
  /** The step in the current guide (null when added). */
  before: CompareStep | null;
  /** The step in the suggestion (null when removed). */
  after: A | null;
  /** 1-based position in each version. */
  beforeNumber: number | null;
  afterNumber: number | null;
  titleChanged: boolean;
  detailChanged: boolean;
  sectionChanged: boolean;
  /** Kept as is, but in a different order relative to the other kept steps. */
  moved: boolean;
}

const norm = (v: string | null | undefined) => (v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const sameText = (a: string | null | undefined, b: string | null | undefined) => (a ?? '').trim() === (b ?? '').trim();

/** For each suggested step, the index of the current step it is (or null when it's new). */
function pairSteps(before: CompareStep[], after: CompareStep[]): (number | null)[] {
  const pairOf: (number | null)[] = after.map(() => null);
  const used = new Set<number>();
  // Pass 1 — same title.
  after.forEach((a, j) => {
    const i = before.findIndex((b, idx) => !used.has(idx) && norm(b.title) === norm(a.title));
    if (i >= 0) { pairOf[j] = i; used.add(i); }
  });
  // Pass 2 — reworded in place: between the same matched neighbours, same section, in order.
  let prevBefore = -1;
  let pending: number[] = [];
  const closeGap = (nextBefore: number) => {
    const candidates = nextBefore > prevBefore
      ? before.map((_, i) => i).filter(i => i > prevBefore && i < nextBefore && !used.has(i))
      : [];
    for (const j of pending) {
      const i = candidates.find(c => !used.has(c) && norm(before[c].section) === norm(after[j].section));
      if (i !== undefined) { pairOf[j] = i; used.add(i); }
    }
    pending = [];
  };
  after.forEach((_, j) => {
    const i = pairOf[j];
    if (i === null) { pending.push(j); return; }
    closeGap(i);
    prevBefore = Math.max(prevBefore, i);
  });
  closeGap(before.length);
  return pairOf;
}

export function compareSteps<A extends CompareStep>(before: CompareStep[], after: A[]): CompareRow<A>[] {
  const pairOf = pairSteps(before, after);
  const rows: (CompareRow<A> & { beforeIndex: number | null })[] = [];
  let lastKept = -1;
  after.forEach((a, j) => {
    const i = pairOf[j];
    if (i === null) {
      rows.push({ kind: 'added', before: null, after: a, beforeNumber: null, afterNumber: j + 1, titleChanged: false, detailChanged: false, sectionChanged: false, moved: false, beforeIndex: null });
      return;
    }
    const b = before[i];
    const titleChanged = !sameText(b.title, a.title);
    const detailChanged = !sameText(b.detail, a.detail);
    const sectionChanged = norm(b.section) !== norm(a.section);
    const moved = i < lastKept;
    lastKept = Math.max(lastKept, i);
    rows.push({
      kind: titleChanged || detailChanged || sectionChanged ? 'changed' : 'same',
      before: b, after: a, beforeNumber: i + 1, afterNumber: j + 1,
      titleChanged, detailChanged, sectionChanged, moved, beforeIndex: i,
    });
  });
  // Removed steps go back where they were: before the first row that came after them.
  const paired = new Set(pairOf.filter((i): i is number => i !== null));
  before.forEach((b, i) => {
    if (paired.has(i)) return;
    const at = rows.findIndex(r => r.beforeIndex !== null && r.beforeIndex > i);
    const row = { kind: 'removed' as const, before: b, after: null, beforeNumber: i + 1, afterNumber: null, titleChanged: false, detailChanged: false, sectionChanged: false, moved: false, beforeIndex: i };
    if (at === -1) rows.push(row); else rows.splice(at, 0, row);
  });
  return rows.map(({ beforeIndex: _drop, ...row }) => row);
}

/** Does the suggestion change anything at all? */
export const hasChanges = (rows: CompareRow[]) => rows.some(r => r.kind !== 'same' || r.moved);

/** How many steps changed / were added / removed — for a one-line summary. */
export function countChanges(rows: CompareRow[]): { changed: number; added: number; removed: number; moved: number } {
  const n = (k: RowKind) => rows.filter(r => r.kind === k).length;
  return { changed: n('changed'), added: n('added'), removed: n('removed'), moved: rows.filter(r => r.moved).length };
}

/** Plain words for a row's label (always shown alongside its colour). */
export function rowLabel(r: CompareRow): string | null {
  if (r.kind === 'added') return 'Added';
  if (r.kind === 'removed') return 'Removed';
  if (r.kind === 'changed') return r.sectionChanged && !r.titleChanged && !r.detailChanged ? 'Moved to another section' : 'Changed';
  return r.moved ? 'Moved' : null;
}
