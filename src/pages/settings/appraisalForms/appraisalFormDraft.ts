import type {
  AppraisalTemplate, Frequency, InputType, MissingPolicy, NumberScale, RatingLevel, RatingScale, StageKind, StageScope, TemplateSavePayload, TemplateStatus,
} from '../../../api/appraisal-templates.js';

// The appraisal-form editor's working copy and the plain rules around it.
// The server is the judge of whether a form can go live (it returns
// `problems`); this module only shapes the draft and the words on screen.

export const FULL_WEIGHT = 100;
export const RATING_SCALES = [3, 4, 5, 10] as const;
export const DEFAULT_RATING_MAX = 5;

/** Kinds of input the editor offers (automatic ones come later). */
export type ManualInput = Exclude<InputType, 'AUTO'>;
export const INPUT_LABEL: Record<ManualInput, string> = {
  RATING: 'Rating scale', PERCENT: 'Percentage', YES_NO: 'Yes or no', NUMBER: 'Number against a target',
};
export const FREQUENCY_LABEL: Record<Frequency, string> = { MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', YEARLY: 'Yearly' };
export const STATUS_LABEL: Record<TemplateStatus, string> = { DRAFT: 'Draft', ACTIVE: 'Live', RETIRED: 'Retired' };

export interface DraftCriterion {
  key: string;
  name: string;
  description: string;
  weight: number;
  inputType: InputType;
  ratingMax: number;
  /** Optional word for each level, index 0 = level 1. */
  ratingLabels: string[];
  /** Optional "what it looks like" for each level (the assessor's rubric), index 0 = level 1. */
  ratingDescriptions: string[];
  target: number | '';
  higherIsBetter: boolean;
  /** Settings of a kind the editor doesn't offer (AUTO) — kept as they were. */
  otherConfig: unknown;
  /** Optional points it's judged on — each scored on its scale, the criterion = their average. */
  points: DraftPoint[];
}
export interface DraftPoint { key: string; name: string }
export const newPoint = (name = ''): DraftPoint => ({ key: newKey('p'), name });
/** Points with a name (blank rows that were never filled in are left out). */
export const namedPoints = (points: DraftPoint[]) => points.map(p => ({ ...p, name: p.name.trim() })).filter(p => p.name);
export interface DraftSection { key: string; name: string; weight: number; criteria: DraftCriterion[] }
export interface DraftStage { key: string; name: string; kind: StageKind; scope: StageScope; positionIds: string[] }
export interface FormDraft {
  name: string;
  description: string;
  frequency: Frequency;
  missingPolicy: MissingPolicy;
  sections: DraftSection[];
  stages: DraftStage[];
}

let seq = 0;
/** A key for list rendering — unique within the page, never sent to the server. */
export const newKey = (prefix: string) => `${prefix}-${++seq}`;

export function newCriterion(name = ''): DraftCriterion {
  return {
    key: newKey('c'), name, description: '', weight: 0, inputType: 'RATING', ratingMax: DEFAULT_RATING_MAX,
    ratingLabels: [], ratingDescriptions: [], target: '', higherIsBetter: false, otherConfig: null, points: [],
  };
}
export const newSection = (name = ''): DraftSection => ({ key: newKey('s'), name, weight: 0, criteria: [] });
export const newSignOff = (): DraftStage => ({ key: newKey('st'), name: 'Signed off by', kind: 'SIGN_OFF', scope: 'ANYONE', positionIds: [] });
const ACKNOWLEDGE_STEP = (): DraftStage => ({ key: newKey('st'), name: 'Acknowledged by the staff member', kind: 'ACKNOWLEDGE', scope: 'ANYONE', positionIds: [] });

export function draftFromTemplate(t: AppraisalTemplate): FormDraft {
  return {
    name: t.name,
    description: t.description ?? '',
    frequency: t.frequency,
    missingPolicy: t.missingPolicy,
    sections: t.sections.map(s => ({
      key: newKey('s'), name: s.name, weight: s.weight,
      criteria: s.criteria.map(c => {
        const rating = c.inputType === 'RATING' ? (c.scaleConfig as RatingScale | null) : null;
        const num = c.inputType === 'NUMBER' ? (c.scaleConfig as NumberScale | null) : null;
        const max = rating?.max ?? DEFAULT_RATING_MAX;
        const level = (i: number) => rating?.levels?.find(l => l.value === i + 1);
        return {
          key: newKey('c'), name: c.name, description: c.description ?? '', weight: c.weight, inputType: c.inputType,
          ratingMax: max,
          ratingLabels: Array.from({ length: max }, (_, i) => level(i)?.label ?? ''),
          ratingDescriptions: Array.from({ length: max }, (_, i) => level(i)?.description ?? ''),
          target: num?.target ?? '', higherIsBetter: num?.higherIsBetter ?? false,
          otherConfig: c.inputType === 'AUTO' ? c.scaleConfig : null,
          points: (c.points ?? []).map(p => newPoint(p.name)),
        };
      }),
    })),
    stages: t.stages.map(s => ({ key: newKey('st'), name: s.name, kind: s.kind, scope: s.scope, positionIds: [...s.positionIds] })),
  };
}

/** The levels that have a name or a description, within the current scale (1…max). */
export function ratingLevels(c: Pick<DraftCriterion, 'ratingMax' | 'ratingLabels' | 'ratingDescriptions'>): RatingLevel[] {
  return Array.from({ length: c.ratingMax }, (_, i) => {
    const label = (c.ratingLabels[i] ?? '').trim();
    const description = (c.ratingDescriptions[i] ?? '').trim();
    return { value: i + 1, label, ...(description ? { description } : {}) };
  }).filter(l => l.label || l.description);
}

function scaleOf(c: DraftCriterion): unknown {
  switch (c.inputType) {
    case 'RATING':
      return { max: c.ratingMax, levels: ratingLevels(c) };
    case 'NUMBER':
      return { target: c.target === '' ? 0 : c.target, higherIsBetter: c.higherIsBetter };
    case 'AUTO':
      return c.otherConfig;
    default:
      return null;
  }
}

export function payloadFromDraft(d: FormDraft): TemplateSavePayload {
  return {
    name: d.name.trim(),
    description: d.description.trim() || null,
    frequency: d.frequency,
    missingPolicy: d.missingPolicy,
    sections: d.sections.map(s => ({
      name: s.name.trim(), weight: s.weight,
      criteria: s.criteria.map(c => ({
        name: c.name.trim(), description: c.description.trim() || null, weight: c.weight, inputType: c.inputType, scaleConfig: scaleOf(c),
        points: namedPoints(c.points).map(p => ({ name: p.name })),
      })),
    })),
    stages: d.stages.map(s => ({ name: s.name.trim(), kind: s.kind, scope: s.scope, positionIds: s.kind === 'ACKNOWLEDGE' ? [] : s.positionIds })),
  };
}

/** Whole-number weights that make exactly 100, the leftover going to the first ones (3 → 34, 33, 33). */
export function spreadEvenly(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(FULL_WEIGHT / count);
  const extra = FULL_WEIGHT - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Sum of weights, to one decimal (so 33.3 × 3 shows as 99.9, not 99.89999). */
export const weightTotal = (weights: number[]) => Math.round(weights.reduce((a, b) => a + b, 0) * 10) / 10;
export const isFullWeight = (weights: number[]) => Math.abs(weightTotal(weights) - FULL_WEIGHT) < 0.05;

export const isOverWeight = (weights: number[]) => weightTotal(weights) > FULL_WEIGHT;

/** What's still unassigned in a group (100% for the first item) — the starting weight for a new one. */
export const remainingWeight = (weights: number[]) => Math.max(0, weightTotal([FULL_WEIGHT, ...weights.map(w => -w)]));

/** A typed weight as entered — only kept to 0–100 (what one box can mean), never changed to fit the others. */
export const typedWeight = (typed: number) => Math.min(FULL_WEIGHT, Math.max(0, Number.isFinite(typed) ? typed : 0));

/**
 * Every group of weights that adds up to more than 100%, in plain words.
 * The form can't be saved while any are listed (the server refuses it too).
 */
export function overWeightProblems(sections: Pick<DraftSection, 'name' | 'weight' | 'criteria'>[]): string[] {
  const over = (weights: number[]) => `${weightTotal(weights)}%, ${weightTotal([...weights, -FULL_WEIGHT])}% too much`;
  const problems: string[] = [];
  const sectionWeights = sections.map(s => s.weight);
  if (isOverWeight(sectionWeights)) problems.push(`Sections add up to ${over(sectionWeights)}.`);
  for (const s of sections) {
    const w = s.criteria.map(c => c.weight);
    if (isOverWeight(w)) problems.push(`Criteria in “${s.name || 'Untitled section'}” add up to ${over(w)}.`);
  }
  return problems;
}

/** "Rating 1–5", "Number · target 2, lower is better" — how a criterion is scored, in a few words. */
export function inputSummary(c: Pick<DraftCriterion, 'inputType' | 'ratingMax' | 'target' | 'higherIsBetter'> & { ratingLabels?: string[] }): string {
  switch (c.inputType) {
    case 'RATING': {
      // Show the named ends of the scale, so it's clear the rating has its own wording.
      const named = (c.ratingLabels ?? []).slice(0, c.ratingMax).map((l, i) => ({ n: i + 1, l: l.trim() })).filter(x => x.l);
      const words = named.length >= 2 ? `${named[0].l} → ${named[named.length - 1].l}` : named.length === 1 ? `${named[0].n} = ${named[0].l}` : '';
      return `Rating 1–${c.ratingMax}${words ? ` · ${words}` : ''}`;
    }
    case 'PERCENT': return 'Percentage';
    case 'YES_NO': return 'Yes or no';
    case 'NUMBER': return c.target === '' ? 'Number · no target yet' : `Number · target ${c.target}, ${c.higherIsBetter ? 'higher' : 'lower'} is better`;
    case 'AUTO': return 'Automatic';
  }
}

/** How a number-against-target criterion turns into a mark, in a sentence. */
export function numberRule(target: number | '', higherIsBetter: boolean): string {
  if (target === '' || target <= 0) return 'Set a target above 0.';
  return higherIsBetter
    ? `${target} or more scores 100%. Half of it (${target / 2}) scores 50%.`
    : `${target} or fewer scores 100%. ${target * 2} or more scores 0%.`;
}

// ── The approval chain: one assess step, any sign-offs, optional acknowledge ──

export const assessStep = (stages: DraftStage[]) => stages.find(s => s.kind === 'ASSESS');
export const signOffSteps = (stages: DraftStage[]) => stages.filter(s => s.kind === 'SIGN_OFF');
export const hasAcknowledge = (stages: DraftStage[]) => stages.some(s => s.kind === 'ACKNOWLEDGE');

/** Rebuild the chain in its fixed order: assess → sign-offs → acknowledge (if on). */
export function orderedChain(assess: DraftStage | undefined, signOffs: DraftStage[], acknowledge: boolean): DraftStage[] {
  return [
    assess ?? { key: newKey('st'), name: 'Assessed by', kind: 'ASSESS', scope: 'OWN_TEAM', positionIds: [] },
    ...signOffs,
    ...(acknowledge ? [ACKNOWLEDGE_STEP()] : []),
  ];
}

/** Move an item one place up (-1) or down (+1); out-of-range moves change nothing. */
export function moveItem<T>(items: T[], index: number, by: -1 | 1): T[] {
  const to = index + by;
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}
