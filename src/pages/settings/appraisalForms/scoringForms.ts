import type { ScoringForm } from '../../../api/appraisal-scoring-forms.js';

// Scoring forms (Settings → Scoring forms): a criterion "from a scoring form"
// keeps a COPY of the form's sections, so an appraisal form never changes
// when a scoring form does.

export const SCORING_FORM_NEEDED = 'Pick a scoring form.';
export const SCORING_FORM_NAME_NEEDED = 'Give the scoring form a name.';

/** What a criterion keeps when scored from a scoring form. */
export interface ScoringFormCopy { scoringFormId: string; name: string; sections: ScoringForm['sections'] }

/** "2 sections · 5 criteria". */
export function scoringFormSummary(f: Pick<ScoringForm, 'sections'>): string {
  const sections = f.sections.length;
  const criteria = f.sections.reduce((n, s) => n + s.criteria.length, 0);
  if (!sections) return 'Nothing to score yet';
  return `${sections} ${sections === 1 ? 'section' : 'sections'} · ${criteria} ${criteria === 1 ? 'criterion' : 'criteria'}`;
}

/** "For Principal, Supervisor" — or nothing when it isn't meant for anyone in particular. */
export function scoringFormFor(f: Pick<ScoringForm, 'positionIds'>, positions: { positionId: string; name: string }[]): string {
  const names = positions.filter(p => f.positionIds.includes(p.positionId)).map(p => p.name);
  return names.length ? `For ${names.join(', ')}` : '';
}

/**
 * The scoring forms to offer on an appraisal form for these positions:
 * first those meant for any of them, then those not meant for anyone in
 * particular — each group A–Z. Ones meant only for other positions are left
 * out. With no positions picked yet, every form is offered (assigned first).
 */
export function scoringFormsForPositions<F extends Pick<ScoringForm, 'name' | 'positionIds'>>(forms: F[], positionIds: string[]): { forThese: F[]; forAnyone: F[] } {
  const byName = (a: F, b: F) => a.name.localeCompare(b.name);
  const forAnyone = forms.filter(f => f.positionIds.length === 0).sort(byName);
  const assigned = forms.filter(f => f.positionIds.length > 0);
  const forThese = (positionIds.length ? assigned.filter(f => f.positionIds.some(id => positionIds.includes(id))) : assigned).sort(byName);
  return { forThese, forAnyone };
}

/** Why "From a scoring form" can't be chosen here — or null when at least one complete form is on offer. */
export function scoringFormUnavailableReason(forms: Pick<ScoringForm, 'name' | 'positionIds' | 'problems'>[], positionIds: string[]): string | null {
  if (!forms.length) return 'No scoring forms yet — set one up in Settings → Scoring forms.';
  const { forThese, forAnyone } = scoringFormsForPositions(forms, positionIds);
  const offered = [...forThese, ...forAnyone];
  if (!offered.length) return 'No scoring forms for this form’s positions — add one in Settings → Scoring forms.';
  if (!offered.some(f => f.problems.length === 0)) return 'No scoring form is complete yet — finish one in Settings → Scoring forms.';
  return null;
}

/** Can be picked for a criterion: complete (weights make 100%, everything has what it needs). */
export const isUsable = (f: Pick<ScoringForm, 'problems'>) => f.problems.length === 0;

/** The copy a criterion keeps. */
export const copyOfScoringForm = (f: Pick<ScoringForm, 'id' | 'name' | 'sections'>): ScoringFormCopy =>
  ({ scoringFormId: f.id, name: f.name, sections: f.sections });

// ── From SOPs ───────────────────────────────────────────────────────────────
// A scoring form that checks SOPs the way an SOP observation does. Sections
// (e.g. "Morning routines") each take a share of the total; in each, SOPs take
// a share of the section; each SOP is scored on its steps — pass / fail / N/A —
// as passed ÷ (passed + failed), N/A left out. To start with every SOP is in
// one section, sharing it evenly; step 2 lets you group them and set shares.
// It's a copy — editing an SOP later doesn't change it.

/** The most a scoring form takes (the server's limits). */
export const MAX_FORM_SECTIONS = 20;
export const MAX_CRITERIA_PER_SECTION = 100;
const MAX_STEP_NAME = 191;
const MAX_DESCRIPTION = 1000;
const CENTS = 100;
/** Most SOPs one scoring form can check. */
export const MAX_SOPS = MAX_CRITERIA_PER_SECTION;
/** The section every SOP starts in. */
export const DEFAULT_SOP_SECTION = 'SOPs';

interface SopStepLike { section: string; title: string; detail: string | null; displayOrder: number; deletedAt?: string | null }

/** `total` split into shares (by `sizes`) to two decimals that add up exactly. */
export function splitWeights(total: number, sizes: number[]): number[] {
  const whole = sizes.reduce((a, b) => a + b, 0);
  if (!whole) return sizes.map(() => 0);
  const raw = sizes.map(s => (s / whole) * total * CENTS);
  const floors = raw.map(Math.floor);
  let left = Math.round(total * CENTS) - floors.reduce((a, b) => a + b, 0);
  // Hand the left-over cents to the largest remainders first.
  const order = raw.map((r, i) => ({ i, rem: r - floors[i] })).sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const { i } of order) { if (left <= 0) break; floors[i] += 1; left -= 1; }
  return floors.map(f => f / CENTS);
}

/**
 * The sections of a scoring form that checks these SOPs: one section holding
 * every SOP (sharing it evenly); each SOP scored on its steps, in order — named
 * with their SOP section ("Bags · Hang bag") when the SOP has several — each
 * pass / fail / N/A with its detail. Or why it can't be made.
 */
export function sectionsFromSops(sops: { id?: string; title: string; steps: SopStepLike[] }[]): { sections: ScoringForm['sections'] } | { problem: string } {
  if (sops.length === 0) return { problem: 'Pick at least one SOP.' };
  if (sops.length > MAX_SOPS) return { problem: `Pick at most ${MAX_SOPS} SOPs for one scoring form.` };
  const perSop = sops.map(sop => {
    const live = sop.steps.filter(s => !s.deletedAt).sort((a, b) => a.displayOrder - b.displayOrder);
    const severalSections = new Set(live.map(s => s.section.trim())).size > 1;
    return {
      id: sop.id,
      title: sop.title,
      steps: live.map(s => ({ ...s, title: severalSections && s.section.trim() ? `${s.section.trim()} · ${s.title.trim()}` : s.title.trim() })),
    };
  });
  const empty = perSop.find(s => s.steps.length === 0);
  if (empty) return { problem: `“${empty.title}” has no steps yet — add some, or leave it out.` };
  const long = perSop.find(s => s.steps.length > MAX_CRITERIA_PER_SECTION);
  if (long) return { problem: `“${long.title}” has more than ${MAX_CRITERIA_PER_SECTION} steps — too many for one scoring form.` };
  const shares = splitWeights(100, sops.map(() => 1));
  return {
    sections: [{
      name: DEFAULT_SOP_SECTION, weight: 100,
      criteria: perSop.map((s, i) => ({
        name: s.title.slice(0, MAX_STEP_NAME), description: null, weight: shares[i], inputType: 'POINTS' as const, scaleConfig: null,
        // Remembers its SOP, so a later edit to the SOP reaches new appraisals (the server keeps it current).
        ...(s.id ? { sopTemplateId: s.id } : {}),
        points: s.steps.map(st => ({
          name: st.title.slice(0, MAX_STEP_NAME), description: st.detail?.trim().slice(0, MAX_DESCRIPTION) || null, inputType: 'PASS_FAIL' as const, scaleConfig: null,
        })),
      })),
    }],
  };
}

/** Shares as typed in step 2: each section's share of the total, and each SOP's share of its section. */
export interface SopGroupingDraft { name: string; share: string; sops: { name: string; share: string }[] }

const shareOk = (s: string) => s.trim() !== '' && Number.isFinite(Number(s)) && Number(s) >= 0 && Number(s) <= 100;
const addsTo100 = (shares: string[]) => Math.round(shares.reduce((a, s) => a + Number(s), 0) * CENTS) / CENTS === 100;

/** Why step 2 can't be saved — or null. Every section named, holding an SOP, shares 0–100% adding up to 100% at each level. */
export function sopGroupingProblem(sections: SopGroupingDraft[]): string | null {
  if (sections.length === 0) return 'Add a section.';
  const unnamed = sections.findIndex(s => !s.name.trim());
  if (unnamed >= 0) return `Give section ${unnamed + 1} a name.`;
  const emptySec = sections.find(s => s.sops.length === 0);
  if (emptySec) return `“${emptySec.name.trim()}” has no SOPs — move some in, or remove it.`;
  if (!sections.every(s => shareOk(s.share))) return 'Give each section a share from 0 to 100%.';
  if (!addsTo100(sections.map(s => s.share))) return `The sections add up to ${Math.round(sections.reduce((a, s) => a + Number(s.share), 0) * CENTS) / CENTS}% — make them 100%.`;
  for (const s of sections) {
    if (!s.sops.every(x => shareOk(x.share))) return `Give each SOP in “${s.name.trim()}” a share from 0 to 100%.`;
    if (!addsTo100(s.sops.map(x => x.share))) return `The SOPs in “${s.name.trim()}” add up to ${Math.round(s.sops.reduce((a, x) => a + Number(x.share), 0) * CENTS) / CENTS}% — make them 100%.`;
  }
  return null;
}

/** "Morning arrival — SOP check", or "SOP check — Arrival, Hygiene" for several. */
export function sopFormName(titles: string[], max: number): string {
  const name = titles.length === 1 ? `${titles[0]} — SOP check` : `SOP check — ${titles.join(', ')}`;
  return name.length <= max ? name : `${name.slice(0, max - 1)}…`;
}

/** The SOPs to list when picking: matching every word typed (in the title or a tag), and having the tag chosen ('' = any). */
export function filterSops<S extends { title: string; categories?: { id: string; name: string }[] }>(sops: S[], query: string, tagId: string): S[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return sops.filter(s => {
    const tags = s.categories ?? [];
    if (tagId && !tags.some(c => c.id === tagId)) return false;
    const text = [s.title, ...tags.map(c => c.name)].join(' ').toLowerCase();
    return words.every(w => text.includes(w));
  });
}

/** Every tag used by these SOPs, once each, A–Z. */
export function sopTags<S extends { categories?: { id: string; name: string; color: string }[] }>(sops: S[]): { id: string; name: string; color: string }[] {
  const byId = new Map<string, { id: string; name: string; color: string }>();
  for (const s of sops) for (const c of s.categories ?? []) byId.set(c.id, c);
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * SOP forms made before sections could group SOPs had each SOP as a section and
 * its steps as pass / fail / N/A criteria. True for that old shape.
 */
export const isOldSopShape = (sections: ScoringForm['sections']) =>
  sections.length > 0 && sections.every(s => s.criteria.length > 0 && s.criteria.every(c => c.inputType === 'PASS_FAIL' && !c.points?.length));

/** The old shape as sections → SOPs → steps: every SOP (keeping its share) in one section, to be grouped in step 2. */
export const fromOldSopShape = (sections: ScoringForm['sections']): ScoringForm['sections'] => [{
  name: DEFAULT_SOP_SECTION, weight: 100,
  criteria: sections.map(s => ({
    name: s.name, description: null, weight: s.weight, inputType: 'POINTS' as const, scaleConfig: null,
    points: s.criteria.map(c => ({ name: c.name, description: c.description ?? null, inputType: 'PASS_FAIL' as const, scaleConfig: null })),
  })),
}];

/** Which SOPs an SOP form checks: the SOP with each SOP name in it (the first, if titles repeat), in order. */
export function sopIdsFor(names: string[], sops: { id: string; title: string; deletedAt?: string | null }[]): string[] {
  const live = sops.filter(s => !s.deletedAt);
  return names.map(n => live.find(s => s.title === n)?.id).filter((id): id is string => !!id);
}
