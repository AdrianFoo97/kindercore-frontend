import type { ApplyBody, ApplyLine, ImportPreview, PreviewLine } from '../../../api/pnlImport.js';

// Import P&L — the screen's decisions, as plain functions (unit-tested):
// what each line starts as, what's still undecided, the live summary, and
// the request sent on Import.

/** Differences under half a sen are rounding, not a different amount. */
const AMOUNT_TOLERANCE = 0.005;

/** What someone chose for one line. null = still undecided. */
export type Decision =
  | { kind: 'RECORD'; categoryId: string }
  | { kind: 'NEW'; name: string; groupId: string }
  | { kind: 'SKIP' }
  | null;

export interface PlanState {
  decisions: Record<string, Decision>;
  /** Lines allowed to overwrite a different amount already entered. */
  replace: Record<string, boolean>;
  /** Save these choices as rules for next time. */
  remember: boolean;
  /** "I've checked the flagged amounts against the PDF." */
  checked: boolean;
}

/** Lines that need a decision: cost lines with something spent (revenue and RM 0 lines don't). */
export const decisionLines = (p: ImportPreview) => p.lines.filter(l => l.status !== 'NOT_A_COST' && l.status !== 'ZERO');

/** Where each line starts: matches recorded, rules followed, close or unknown names left for a person to decide. */
export function defaultDecision(line: PreviewLine): Decision {
  if (line.status === 'MATCHED' && line.categoryId) return { kind: 'RECORD', categoryId: line.categoryId };
  if (line.status === 'SKIP_RULE' || line.status === 'NEGATIVE') return { kind: 'SKIP' };
  return null;
}

export function initialState(p: ImportPreview): PlanState {
  return {
    decisions: Object.fromEntries(decisionLines(p).map(l => [l.key, defaultDecision(l)])),
    replace: {},
    remember: true,
    checked: false,
  };
}

/** The amount already entered for the chosen category, when it differs from this line's. */
export function existingConflict(p: ImportPreview, line: PreviewLine, d: Decision): number | null {
  if (d?.kind !== 'RECORD') return null;
  const before = p.existing[d.categoryId];
  return before !== undefined && Math.abs(before - line.amount) >= AMOUNT_TOLERANCE ? before : null;
}

/**
 * Something a person must look at before importing: no text to check against,
 * wording aimed at an AI, a section that doesn't add up, an amount not found in
 * the file, or an amount the PDF's own text gives differently.
 */
export function needsCheck(p: ImportPreview, s: PlanState): boolean {
  if (!p.hasText || p.injectionSuspected) return true;
  if (decisionLines(p).some(l => l.textAmount !== null && s.decisions[l.key]?.kind !== 'SKIP')) return true;
  if (p.sections.some(sec => (sec.kind === 'EXPENSE' || sec.kind === 'COST_OF_SALES') && sec.addsUp === false)) return true;
  return decisionLines(p).some(l => !l.found && s.decisions[l.key]?.kind !== 'SKIP');
}

const add = (a: number, b: number) => Math.round((a + b) * 100) / 100;

export interface PlanSummary {
  record: { count: number; total: number };
  undecided: number;
  notImported: { count: number; total: number };
}

/** The live numbers at the top of the screen. */
export function summarise(p: ImportPreview, s: PlanState): PlanSummary {
  const out: PlanSummary = { record: { count: 0, total: 0 }, undecided: 0, notImported: { count: 0, total: 0 } };
  for (const l of decisionLines(p)) {
    const d = s.decisions[l.key];
    if (d === null || d === undefined) { out.undecided++; continue; }
    const kept = existingConflict(p, l, d) !== null && !s.replace[l.key];
    if (d.kind === 'SKIP' || kept) {
      out.notImported = { count: out.notImported.count + 1, total: add(out.notImported.total, l.amount) };
    } else {
      out.record = { count: out.record.count + 1, total: add(out.record.total, l.amount) };
    }
  }
  return out;
}

/** Why Import is greyed out, or null when it can go ahead. */
export function blockReason(p: ImportPreview, s: PlanState): string | null {
  const sum = summarise(p, s);
  if (sum.undecided) return `Choose what to do with ${sum.undecided} line${sum.undecided === 1 ? '' : 's'}`;
  const unnamed = decisionLines(p).some(l => { const d = s.decisions[l.key]; return d?.kind === 'NEW' && (!d.name.trim() || !d.groupId); });
  if (unnamed) return 'Name each new category and pick its group';
  if (needsCheck(p, s) && !s.checked) return 'Tick that you’ve checked the flagged amounts';
  if (sum.record.count === 0 && sum.notImported.count === 0) return 'Nothing to import';
  return null;
}

/** The request sent on Import. New categories get a temporary id the server swaps for a real one. */
export function buildApplyBody(p: ImportPreview, s: PlanState): ApplyBody {
  const newCategories: ApplyBody['newCategories'] = [];
  const lines: ApplyLine[] = decisionLines(p).map(l => {
    const d = s.decisions[l.key];
    const changed = JSON.stringify(d) !== JSON.stringify(defaultDecision(l));
    const remember = s.remember && (l.status === 'SUGGESTED' || l.status === 'NEW' || changed) && l.status !== 'NEGATIVE';
    const base = { name: l.name, section: l.section, amount: l.amount, ...(remember ? { remember: true } : {}) };
    if (d?.kind === 'RECORD') return { ...base, action: 'RECORD', categoryId: d.categoryId, ...(s.replace[l.key] ? { replace: true } : {}) };
    if (d?.kind === 'NEW') {
      const tempId = `new:${l.key}`;
      newCategories.push({ tempId, name: d.name.trim(), groupId: d.groupId });
      return { ...base, action: 'RECORD', categoryId: tempId };
    }
    return { ...base, action: 'SKIP', categoryId: null, ...(l.status === 'SKIP_RULE' && !changed ? { byRule: true } : {}) };
  });
  return {
    year: p.period.year, month: p.period.month, fileName: p.fileName, provider: p.provider, model: p.model,
    instructionsVersion: p.instructionsVersion, lines, newCategories,
  };
}
