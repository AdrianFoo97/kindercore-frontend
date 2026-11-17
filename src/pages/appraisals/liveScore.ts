import type { MissingPolicy, TemplateCriterion, TemplateSection } from '../../api/appraisal-templates.js';
import { NOT_APPLICABLE, inputGroups, numberTarget, ratingMax, valueProblem, type InputGroup, type ScoreInput, type Values } from './appraisalRun.js';

// Scores worked out on screen as the scorer marks — each item, a scoring
// form's sections, and the criterion — so they see what a choice is worth
// straight away. DISPLAY ONLY: the same rules as the server's
// (kindercore-backend appraisalScoring.service normaliseCriterion /
// combinePoints / scoreAppraisal), which works out the real total on save and
// submit. Change both together; the tests here use the server's own examples.

const FULL = 100;
const clamp = (n: number) => Math.max(0, Math.min(FULL, n));
/**
 * A part marked N/A (Pass / Fail / N/A) — or one whose every part is N/A. It
 * isn't counted at all: it's left out and the rest share its weight, never a
 * gap that holds the total back (the server's withoutNotApplicable).
 */
export const NA = 'NA' as const;
type Part = number | null | typeof NA;
const asScore = (x: Part): number | null => (x === NA ? null : x);

/** One decimal, as the server shows totals. */
export const round1 = (n: number) => Math.round(n * 10) / 10;

/** One entered value → 0–100, N/A, or null (not scored yet, or what's typed doesn't fit). */
function itemPart(i: Pick<ScoreInput, 'kind' | 'scaleConfig'>, text: string): Part {
  if (i.kind === 'PASS_FAIL' && text.trim() === NOT_APPLICABLE) return NA;
  return itemScore(i, text);
}

/** One entered value → 0–100 (null = not scored yet, N/A, or what's typed doesn't fit). */
export function itemScore(i: Pick<ScoreInput, 'kind' | 'scaleConfig'>, text: string): number | null {
  if (text.trim() === '' || valueProblem(i.kind, i.scaleConfig, text)) return null;
  const raw = Number(text);
  switch (i.kind) {
    case 'RATING': return clamp((raw / ratingMax(i.scaleConfig)) * FULL); // 4 of 5 = 80
    case 'PERCENT': return clamp(raw);
    case 'YES_NO': return raw > 0 ? FULL : 0;
    case 'PASS_FAIL': return raw > 0 ? FULL : raw === 0 ? 0 : null;
    case 'NUMBER': {
      const t = numberTarget(i.scaleConfig);
      if (!t?.target) return null;
      if (t.higherIsBetter) return clamp((raw / t.target) * FULL);
      // Lower is better: at or under target = full marks; each target's-worth over loses everything.
      return raw <= t.target ? FULL : clamp(FULL * (1 - (raw - t.target) / t.target));
    }
  }
}

/**
 * Weighted score of parts. N/A parts are left out first. "Score everything"
 * forms: nothing until every other part is scored. "Skip what's missing":
 * unscored parts drop out and the rest share their weight. All N/A → N/A.
 */
function weightedPart(parts: { score: Part; weight: number }[], policy: MissingPolicy): Part {
  const counted = parts.filter(x => x.score !== NA);
  if (parts.length > 0 && counted.length === 0) return NA;
  const scored = counted.filter((x): x is { score: number; weight: number } => x.score != null);
  if (scored.length === 0) return null;
  if (policy === 'REQUIRE_ALL' && scored.length < counted.length) return null;
  const weight = scored.reduce((a, x) => a + x.weight, 0);
  return weight > 0 ? scored.reduce((a, x) => a + x.score * x.weight, 0) / weight : null;
}

/** Weighted score of parts (null = not enough yet, or all N/A). */
export const weightedScore = (parts: { score: number | null; weight: number }[], policy: MissingPolicy) => asScore(weightedPart(parts, policy));

const groupPart = (g: InputGroup, values: Values, policy: MissingPolicy): Part =>
  weightedPart(g.inputs.map(i => ({ score: itemPart(i, values[i.key] ?? ''), weight: i.weight })), policy);

/** A group of items (a copied scoring form's section, or a criterion's points). */
export const groupScore = (g: InputGroup, values: Values, policy: MissingPolicy) => asScore(groupPart(g, values, policy));

function criterionPart(c: TemplateCriterion, values: Values, policy: MissingPolicy): Part {
  const groups = inputGroups(c);
  if (groups.length === 0) return null;
  if (c.inputType === 'FORM') {
    // Plain sections count by their weight; criteria scored on their items (SOPs) are combined into their
    // section first (by their share of it), then the section counts by its weight — as the server does.
    const parts: { score: Part; weight: number }[] = [];
    const bySection = new Map<number, { weight: number; parts: { score: Part; weight: number }[] }>();
    for (const g of groups) {
      if (!g.inSection) { parts.push({ score: groupPart(g, values, policy), weight: g.weight ?? 0 }); continue; }
      const sec = bySection.get(g.inSection.index) ?? { weight: g.inSection.weight, parts: [] };
      sec.parts.push({ score: groupPart(g, values, policy), weight: g.weight ?? 0 });
      bySection.set(g.inSection.index, sec);
    }
    for (const sec of bySection.values()) parts.push({ score: weightedPart(sec.parts, policy), weight: sec.weight });
    return weightedPart(parts, policy);
  }
  return groupPart(groups[0], values, policy);
}

/** A criterion's 0–100 score from what's entered so far (null = not yet, or N/A). */
export const criterionScore = (c: TemplateCriterion, values: Values, policy: MissingPolicy) => asScore(criterionPart(c, values, policy));

const sectionPart = (s: TemplateSection, values: Values, policy: MissingPolicy): Part =>
  weightedPart(s.criteria.map(c => ({ score: criterionPart(c, values, policy), weight: c.weight })), policy);

/** A section's 0–100 score: its criteria by weight (null until there's enough, or all N/A). */
export const sectionScore = (s: TemplateSection, values: Values, policy: MissingPolicy) => asScore(sectionPart(s, values, policy));

/** The appraisal's total so far: its sections by weight, one decimal (null until there's enough). */
export function totalScore(sections: TemplateSection[], values: Values, policy: MissingPolicy): number | null {
  const total = asScore(weightedPart(sections.map(s => ({ score: sectionPart(s, values, policy), weight: s.weight })), policy));
  return total == null ? null : round1(total);
}
