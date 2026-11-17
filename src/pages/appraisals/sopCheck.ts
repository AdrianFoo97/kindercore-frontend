import type { InputGroup, Values } from './appraisalRun.js';

// An SOP check on an appraisal: a criterion scored from SOPs, every step
// pass / fail / N/A (as in an SOP observation). Pure helpers for its overview.

export type SopStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE';

/** How far one SOP has got: steps marked (pass, fail or N/A), steps passed, and its status. */
export function sopProgress(g: InputGroup, values: Values): { marked: number; passed: number; total: number; status: SopStatus } {
  const marks = g.inputs.map(i => (values[i.key] ?? '').trim());
  const marked = marks.filter(Boolean).length;
  const passed = marks.filter(m => m === '1').length;
  const status: SopStatus = marked === 0 ? 'NOT_STARTED' : marked === g.inputs.length ? 'DONE' : 'IN_PROGRESS';
  return { marked, passed, total: g.inputs.length, status };
}

/** A criterion is an SOP check when every step is pass / fail / N/A and it has SOPs (several, or grouped in sections). */
export const isSopCheck = (groups: InputGroup[]) =>
  groups.length > 0 && (groups.length > 1 || groups.some(g => g.inSection)) && groups.every(g => g.inputs.length > 0 && g.inputs.every(i => i.kind === 'PASS_FAIL'));

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
