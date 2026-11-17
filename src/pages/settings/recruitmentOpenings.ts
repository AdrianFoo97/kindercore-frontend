// Settings → Recruitment → Positions: the roles the public apply form offers. Each is one of
// the positions (Settings → Positions) — named on the form by the position's name or a public
// name, with the pay range set in Settings → Payroll. Entries from before positions were linked
// (a name and a band of their own) are kept, marked "not linked", until someone links them.
// The server reads the same stored shape (recruitmentOpenings.logic).

export type Opening =
  | { kind: 'linked'; positionId: string; publicName: string }
  | { kind: 'unlinked'; name: string; minSalary: number | null; maxSalary: number | null };

export interface PositionLite { positionId: string; name: string; payRangeMin: number | null; payRangeMax: number | null }

/** What a brand-new install offers until positions are picked (the server falls back to the same names). */
const DEFAULT_NAMES = ['Assistant Teacher', 'Junior Teacher', 'Senior Teacher', 'Kindergarten Helper'];

const band = (v: unknown) => (typeof v === 'number' && v >= 0 ? v : null);

/** The stored setting → the list to edit. */
export function readOpenings(raw: unknown): Opening[] {
  if (!Array.isArray(raw)) return DEFAULT_NAMES.map(name => ({ kind: 'unlinked', name, minSalary: null, maxSalary: null }));
  const out: Opening[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      if (item.trim()) out.push({ kind: 'unlinked', name: item.trim(), minSalary: null, maxSalary: null });
    } else if (item && typeof item === 'object') {
      const rec = item as Record<string, unknown>;
      if (typeof rec.positionId === 'string') out.push({ kind: 'linked', positionId: rec.positionId, publicName: typeof rec.publicName === 'string' ? rec.publicName : '' });
      else if (typeof rec.name === 'string' && rec.name.trim()) out.push({ kind: 'unlinked', name: rec.name.trim(), minSalary: band(rec.minSalary), maxSalary: band(rec.maxSalary) });
    }
  }
  return out;
}

/** The list → what's stored (a blank public name is stored as none — the position's name is used). */
export function toStored(openings: Opening[]): unknown[] {
  return openings.map(o => (o.kind === 'linked'
    ? { positionId: o.positionId, publicName: o.publicName.trim() || null }
    : { name: o.name, minSalary: o.minSalary, maxSalary: o.maxSalary }));
}

/** The name candidates see on the apply form. */
export function formName(o: Opening, positions: PositionLite[]): string {
  if (o.kind === 'unlinked') return o.name;
  return o.publicName.trim() || positions.find(p => p.positionId === o.positionId)?.name || 'Position removed';
}

/** Why this pick can't be added / saved yet — or null. `at` is the row being edited (null when adding). */
export function openingProblem(draft: { positionId: string; publicName: string }, list: Opening[], positions: PositionLite[], at: number | null): string | null {
  if (!draft.positionId) return 'Pick a position.';
  const others = list.filter((_, i) => i !== at);
  if (others.some(o => o.kind === 'linked' && o.positionId === draft.positionId)) return 'That position is already on the list.';
  const name = formName({ kind: 'linked', ...draft }, positions).toLowerCase();
  if (others.some(o => formName(o, positions).toLowerCase() === name)) return 'Another role already shows with that name on the form.';
  return null;
}
