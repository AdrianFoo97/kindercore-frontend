import { MARKS_WITH_NA, markLevels, type InputGroup, type Values } from './appraisalRun.js';

// An SOP check on an appraisal: a criterion scored from SOPs, every step
// pass / fail / N/A (as in an SOP observation) or one of the form's levels / N/A. Pure helpers for its overview.

export type SopStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE';

/** How far one SOP has got: steps marked (incl. N/A), steps passed (pass / fail steps only — passFail), and its status. */
export function sopProgress(g: InputGroup, values: Values): { marked: number; passed: number; total: number; status: SopStatus; passFail: boolean } {
  const marks = g.inputs.map(i => (values[i.key] ?? '').trim());
  const marked = marks.filter(Boolean).length;
  const passed = marks.filter(m => m === '1').length;
  const status: SopStatus = marked === 0 ? 'NOT_STARTED' : marked === g.inputs.length ? 'DONE' : 'IN_PROGRESS';
  // "Passed" only means something for pass / fail steps; steps marked on levels are scored by their percentage.
  const passFail = g.inputs.every(i => i.kind === 'PASS_FAIL');
  return { marked, passed, total: g.inputs.length, status, passFail };
}

/** A criterion is an SOP check when every step is pass / fail / N/A and it has SOPs (several, or grouped in sections). */
export const isSopCheck = (groups: InputGroup[]) =>
  groups.length > 0 && (groups.length > 1 || groups.some(g => g.inSection)) && groups.every(g => g.inputs.length > 0 && g.inputs.every(i => MARKS_WITH_NA.includes(i.kind)));

/** The SOPs under their section headings, in order — one unnamed section for forms that put each SOP in its own section. */
export function sopSections<G extends InputGroup>(groups: G[]): { name: string | null; weight: number | null; sops: { g: G; index: number }[] }[] {
  const out: { key: number; name: string | null; weight: number | null; sops: { g: G; index: number }[] }[] = [];
  groups.forEach((g, index) => {
    const key = g.inSection?.index ?? -1;
    let sec = out.find(s => s.key === key);
    if (!sec) { sec = { key, name: g.inSection?.name ?? null, weight: g.inSection?.weight ?? null, sops: [] }; out.push(sec); }
    sec.sops.push({ g, index });
  });
  return out.map(({ name, weight, sops }) => ({ name, weight, sops }));
}

/** How this SOP check's steps are marked, in a line: pass / fail, or its levels — each with N/A, which isn't counted. */
export function markingLine(groups: InputGroup[]): string {
  const first = groups[0]?.inputs[0];
  if (first?.kind === 'LEVELS') {
    const levels = markLevels(first.scaleConfig);
    return `Mark each step ${levels.map(l => `${l.label} (${l.score}%)`).join(', ')} or N/A. Each SOP scores the average of its marked steps; N/A isn’t counted.`;
  }
  return 'Mark each step pass, fail or N/A. Each SOP scores steps passed ÷ (passed + failed); N/A isn’t counted.';
}
