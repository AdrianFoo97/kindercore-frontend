import type { AppraisalRun, Period, PeriodType, RunLogEntry, RunScore, RunStatus, ScoreEntry } from '../../api/appraisal-runs.js';
import type { MissingPolicy, RatingLevel, StageKind, TemplateCriterion, TemplateSection, TemplateStage } from '../../api/appraisal-templates.js';
import { MONTH_LABELS } from './appraisalDisplay.js';

// Scoring one appraisal on screen: what can be entered for each criterion,
// whether what's typed fits, whether it can be submitted, and how its status,
// period and steps read. The server checks all of it again — this is so the
// page can say so up front and keep Submit disabled until it's ready.

/** The kinds a person enters by hand. */
export type ManualKind = 'RATING' | 'PERCENT' | 'YES_NO' | 'PASS_FAIL' | 'LEVELS' | 'NUMBER';
const MANUAL_KINDS: readonly string[] = ['RATING', 'PERCENT', 'YES_NO', 'PASS_FAIL', 'LEVELS', 'NUMBER'];
/** Kinds that can be marked N/A (how SOP steps are marked) — N/A isn't counted. */
export const MARKS_WITH_NA: readonly string[] = ['PASS_FAIL', 'LEVELS'];
/** Named levels, each worth a percentage (e.g. Fail 0, Satisfactory 60, Excellent 100); a mark is a level's position. */
export interface MarkLevel { label: string; score: number }
export const markLevels = (scaleConfig: unknown): MarkLevel[] => ((scaleConfig as { levels?: MarkLevel[] } | null)?.levels ?? []);
/** Pass / Fail / N/A: the value stored for N/A — it isn't counted (the rest share its weight). */
export const NOT_APPLICABLE = '-1';
export const PASS_FAIL_LABEL: Record<string, string> = { '1': 'Pass', '0': 'Fail', [NOT_APPLICABLE]: 'N/A' };
const DEFAULT_RATING_MAX = 5;
const PERCENT_MAX = 100;

/** A scoring-form criterion's key inside its copy — must match the server's formKey ("f:section:criterion"). */
export const formKey = (sectionIndex: number, criterionIndex: number) => `f:${sectionIndex}:${criterionIndex}`;
/** One item of a scoring-form criterion scored on its items (e.g. an SOP's step) — as the server keys it. */
export const formItemKey = (sectionIndex: number, criterionIndex: number, itemIndex: number) => `${formKey(sectionIndex, criterionIndex)}:${itemIndex}`;

/** One box to fill in. */
export interface ScoreInput {
  key: string;
  criterionId: string;
  /** The point or scoring-form criterion it's for (null = the criterion itself). */
  pointId: string | null;
  name: string;
  kind: ManualKind;
  scaleConfig: unknown;
  /** Its weight within its group (a scoring-form criterion's weight; points count equally). */
  weight: number;
  /** What it means — a scoring-form criterion's description (e.g. an SOP step's detail). */
  description?: string | null;
}

/**
 * A criterion's boxes, grouped — one unnamed group, or the copied scoring form's sections. When a section's
 * criteria are scored on their items (e.g. SOPs and their steps), each such criterion is its own group
 * (weight = its share of the section) and `inSection` says which section it's in and that section's share.
 */
export interface InputGroup { name: string | null; weight: number | null; inputs: ScoreInput[]; inSection?: { index: number; name: string; weight: number } }

export const inputKey = (criterionId: string, pointId: string | null) => `${criterionId}|${pointId ?? ''}`;

const input = (criterionId: string, pointId: string | null, name: string, kind: string, scaleConfig: unknown, weight = 1): ScoreInput | null =>
  MANUAL_KINDS.includes(kind) ? { key: inputKey(criterionId, pointId), criterionId, pointId, name, kind: kind as ManualKind, scaleConfig, weight } : null;
const present = <T,>(x: T | null): x is T => x != null;

interface CopiedItem { name: string; description?: string | null; inputType?: string; scaleConfig?: unknown }
interface CopiedSection { name: string; weight: number; criteria: { name: string; description?: string | null; weight: number; inputType: string; scaleConfig?: unknown; points?: CopiedItem[] }[] }

/** What's entered for a criterion. Empty = nothing to type (e.g. worked out automatically). */
export function inputGroups(c: TemplateCriterion): InputGroup[] {
  if (c.inputType === 'FORM') {
    const sections = ((c.scaleConfig as { sections?: CopiedSection[] } | null)?.sections ?? []);
    const box = (pointId: string, x: { name: string; description?: string | null; inputType?: string; scaleConfig?: unknown }, weight?: number) => {
      const i = input(c.id, pointId, x.name, x.inputType ?? 'RATING', x.scaleConfig ?? null, weight);
      return i && x.description ? { ...i, description: x.description } : i;
    };
    return sections.flatMap((s, si): InputGroup[] => {
      // Criteria scored on their items (e.g. SOPs → steps): a group per criterion, inside its section.
      if (s.criteria.some(fc => fc.points?.length)) {
        const inSection = { index: si, name: s.name, weight: s.weight };
        return s.criteria.map((fc, ci) => ({
          name: fc.name, weight: fc.weight, inSection,
          inputs: (fc.points?.length ? fc.points.map((it, ii) => box(formItemKey(si, ci, ii), it)) : [box(formKey(si, ci), fc, 1)]).filter(present),
        }));
      }
      return [{ name: s.name, weight: s.weight, inputs: s.criteria.map((fc, ci) => box(formKey(si, ci), fc, fc.weight)).filter(present) }];
    });
  }
  if (c.points.length > 0) return [{ name: null, weight: null, inputs: c.points.map(p => input(c.id, p.id, p.name, p.inputType, p.scaleConfig)).filter(present) }];
  const own = input(c.id, null, c.name, c.inputType, c.scaleConfig);
  return own ? [{ name: null, weight: null, inputs: [own] }] : [];
}

export const allInputs = (sections: TemplateSection[]): ScoreInput[] =>
  sections.flatMap(s => s.criteria).flatMap(c => inputGroups(c).flatMap(g => g.inputs));

/** What's typed, per box — '' = not scored yet. */
export type Values = Record<string, string>;

export function valuesFrom(scores: RunScore[]): Values {
  const out: Values = {};
  for (const s of scores) if (s.rawValue != null) out[inputKey(s.criterionId, s.pointId)] = String(s.rawValue);
  return out;
}

export const ratingMax = (scaleConfig: unknown) => (scaleConfig as { max?: number } | null)?.max ?? DEFAULT_RATING_MAX;
export const ratingLevels = (scaleConfig: unknown): RatingLevel[] => (scaleConfig as { levels?: RatingLevel[] } | null)?.levels ?? [];
export const numberTarget = (scaleConfig: unknown) => scaleConfig as { target?: number; higherIsBetter?: boolean } | null;

/** A mark as it reads, out of what it's out of: "4 / 5 · Good", "80 / 100", "Yes", "3 (target 2)". null = not marked. */
export function markText(i: Pick<ScoreInput, 'kind' | 'scaleConfig'>, value: string): string | null {
  if (value.trim() === '') return null;
  switch (i.kind) {
    case 'RATING': {
      const level = ratingLevels(i.scaleConfig).find(l => String(l.value) === value);
      return `${value} / ${ratingMax(i.scaleConfig)}${level ? ` · ${level.label}` : ''}`;
    }
    case 'YES_NO': return value === '1' ? 'Yes' : 'No';
    case 'PASS_FAIL': return PASS_FAIL_LABEL[value] ?? value;
    case 'LEVELS': {
      if (value === NOT_APPLICABLE) return 'N/A';
      const level = markLevels(i.scaleConfig)[Number(value)];
      return level ? `${level.label} · ${level.score}%` : value;
    }
    case 'PERCENT': return `${value} / 100`;
    case 'NUMBER': {
      const t = numberTarget(i.scaleConfig);
      return t?.target != null ? `${value} (target ${t.target})` : value;
    }
  }
}
/** Why what's typed doesn't fit, in a few words — null when it does (or nothing's typed). */
export function valueProblem(kind: ManualKind, scaleConfig: unknown, text: string): string | null {
  if (text.trim() === '') return null;
  const n = Number(text);
  if (!Number.isFinite(n)) return 'Enter a number.';
  switch (kind) {
    case 'RATING': { const max = ratingMax(scaleConfig); return Number.isInteger(n) && n >= 1 && n <= max ? null : `Pick 1 to ${max}.`; }
    case 'PERCENT': return n >= 0 && n <= PERCENT_MAX ? null : 'Enter 0 to 100.';
    case 'YES_NO': return n === 0 || n === 1 ? null : 'Pick yes or no.';
    case 'PASS_FAIL': return n === 0 || n === 1 || n === -1 ? null : 'Pick pass, fail or N/A.';
    case 'LEVELS': return n === -1 || (Number.isInteger(n) && n >= 0 && n < markLevels(scaleConfig).length) ? null : 'Pick a level or N/A.';
    case 'NUMBER': return n >= 0 ? null : 'Can’t be below 0.';
  }
}

const filled = (values: Values, i: ScoreInput) => (values[i.key] ?? '').trim() !== '';

/** Boxes whose value doesn't fit. */
export const invalidInputs = (inputs: ScoreInput[], values: Values) =>
  inputs.filter(i => valueProblem(i.kind, i.scaleConfig, values[i.key] ?? '') != null);

/** Criteria with something still to score, by name, in form order. */
export function unscoredCriteria(sections: TemplateSection[], values: Values): string[] {
  return sections.flatMap(s => s.criteria)
    .filter(c => { const inputs = inputGroups(c).flatMap(g => g.inputs); return inputs.length > 0 && inputs.some(i => !filled(values, i)); })
    .map(c => c.name);
}

/** Submit is blocked by a score that doesn't fit (not just by unscored items). */
export const FIX_RED_SCORES = 'Fix the scores marked in red first.';

/**
 * Why it can't be submitted yet — null when it can. Every box must fit; then
 * "Score everything" forms need every box filled, while forms that skip what's
 * missing need at least one score.
 */
export function submitBlocker(sections: TemplateSection[], policy: MissingPolicy, values: Values): string | null {
  const inputs = allInputs(sections);
  if (invalidInputs(inputs, values).length > 0) return FIX_RED_SCORES;
  if (policy === 'REQUIRE_ALL') {
    const todo = unscoredCriteria(sections, values);
    if (todo.length > 0) return `Still to score: ${todo.join(', ')}.`;
  } else if (!inputs.some(i => filled(values, i))) {
    return 'Score at least one thing first.';
  }
  return null;
}

/** Each box's comment, per box — '' = none. */
export type Notes = Record<string, string>;

export function notesFrom(scores: RunScore[]): Notes {
  const out: Notes = {};
  for (const s of scores) if (s.comment) out[inputKey(s.criterionId, s.pointId)] = s.comment;
  return out;
}

/** What to send: every box with its comment, empty ones as null. Assumes invalidInputs() is empty. */
export const scoresPayload = (inputs: ScoreInput[], values: Values, notes: Notes = {}): ScoreEntry[] =>
  inputs.map(i => ({
    criterionId: i.criterionId, pointId: i.pointId, rawValue: filled(values, i) ? Number(values[i.key]) : null,
    comment: (notes[i.key] ?? '').trim() || null,
  }));

/** How many boxes are filled in, of how many — the scorer's progress. */
export function progressOf(inputs: ScoreInput[], values: Values): { done: number; total: number } {
  return { done: inputs.filter(i => filled(values, i)).length, total: inputs.length };
}

/** Every box of a criterion is filled in. */
export const criterionDone = (c: TemplateCriterion, values: Values) => {
  const inputs = inputGroups(c).flatMap(g => g.inputs);
  return inputs.length > 0 && inputs.every(i => filled(values, i));
};

/** How many of a criterion's boxes are still empty. */
export const criterionLeft = (c: TemplateCriterion, values: Values) =>
  inputGroups(c).flatMap(g => g.inputs).filter(i => !filled(values, i)).length;

/** Changed since it was saved? Compares what each box would send, and each comment. */
export function isDirty(inputs: ScoreInput[], values: Values, saved: Values, comments: string, savedComments: string | null, notes: Notes = {}, savedNotes: Notes = {}): boolean {
  const norm = (v: Values, k: string) => { const t = (v[k] ?? '').trim(); return t === '' ? '' : String(Number(t)); };
  const note = (n: Notes, k: string) => (n[k] ?? '').trim();
  return inputs.some(i => norm(values, i.key) !== norm(saved, i.key) || note(notes, i.key) !== note(savedNotes, i.key))
    || comments.trim() !== (savedComments ?? '').trim();
}

// ── How it reads ─────────────────────────────────────────────────────────────

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_PER_QUARTER = 3;

/** "October 2026", "Q4 2026 (Oct–Dec)" or "2026" — the period an appraisal covers. */
export function periodLabel(periodType: PeriodType | null, p: Period): string {
  if (periodType === 'YEARLY') return String(p.year);
  if (periodType === 'QUARTERLY') {
    const q = Math.floor(p.month / MONTHS_PER_QUARTER);
    return `Q${q + 1} ${p.year} (${MONTH_LABELS[q * MONTHS_PER_QUARTER]}–${MONTH_LABELS[q * MONTHS_PER_QUARTER + 2]})`;
  }
  return `${MONTH_NAMES[p.month]} ${p.year}`;
}

export const STATUS_LABEL: Record<RunStatus, string> = {
  IN_PROGRESS: 'Being scored',
  SENT_BACK: 'Sent back',
  AWAITING_SIGN_OFF: 'Waiting for sign-off',
  AWAITING_ACKNOWLEDGEMENT: 'Waiting for staff to confirm',
  COMPLETED: 'Done',
};

export const STEP_LABEL: Record<StageKind, string> = { ASSESS: 'Score it', SIGN_OFF: 'Sign it off', ACKNOWLEDGE: 'Staff confirms' };

export type StepState = 'done' | 'current' | 'todo';

/** Each step's state: before the current one is done, the current one is on, the rest are to come. */
export function stepStates(stages: TemplateStage[], currentStep: number | null, status: RunStatus): StepState[] {
  if (status === 'COMPLETED' || currentStep == null) return stages.map(() => 'done');
  return stages.map((_, i) => (i < currentStep ? 'done' : i === currentStep ? 'current' : 'todo'));
}

/** The reason it was last sent back — shown while it's waiting to be rescored. */
export function sendBackReason(run: Pick<AppraisalRun, 'status' | 'log'>): RunLogEntry | null {
  if (run.status !== 'SENT_BACK') return null;
  return [...run.log].reverse().find(l => l.kind === 'SENT_BACK') ?? null;
}

/** Numbers shown before sections (1, 2…) and criteria (1.1, 1.2…), as on the form editor. */
export const criterionNumber = (sectionIndex: number, criterionIndex: number) => `${sectionIndex + 1}.${criterionIndex + 1}`;

/** Every criterion in form order, with its section and number — what Previous / Next and the score panel step through. */
export interface CriterionItem { si: number; c: TemplateCriterion; number: string }
export const criterionItems = (sections: TemplateSection[]): CriterionItem[] =>
  sections.flatMap((s, si) => s.criteria.map((c, ci) => ({ si, c, number: criterionNumber(si, ci) })));

/**
 * What signing off does here, in words: the button names the outcome, the
 * confirmation spells it out — sent to the staff member to confirm (they see it
 * then), on to the next approver, or finished.
 */
export function signOffOutcome(stages: Pick<TemplateStage, 'name' | 'kind'>[], currentStep: number | null, staffName: string): { label: string; message: string } {
  const next = currentStep == null ? undefined : stages[currentStep + 1];
  if (next?.kind === 'ACKNOWLEDGE') {
    return { label: `Sign off & send to ${staffName}`, message: `${staffName} will see the scores and comments and be asked to confirm. Scores can’t be changed after this.` };
  }
  if (next) {
    return { label: `Sign off & send to ${next.name}`, message: `It goes to “${next.name}” to sign off — ${staffName} doesn’t see it yet. Scores can’t be changed after this.` };
  }
  return { label: 'Sign off & complete', message: 'The appraisal is final and counts towards their averages. Scores can’t be changed after this.' };
}
