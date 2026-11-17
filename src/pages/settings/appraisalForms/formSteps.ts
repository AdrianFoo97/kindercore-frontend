// The appraisal-form editor as three steps, each saying what it still needs —
// shown in that step, not in a list at the top of the page.

export type StepKey = 'basics' | 'scoring' | 'approval';

/** A step of the approval chain as far as these checks need it. */
interface ChainStep { name: string; kind: 'ASSESS' | 'SIGN_OFF' | 'ACKNOWLEDGE'; positionIds: string[] }

/**
 * What the approval chain still needs, checked on the page as positions are
 * picked (same words as the server's checks), so the tab and "Make live"
 * update straight away — not only after "Save draft".
 */
export function chainProblems(stages: ChainStep[]): string[] {
  const problems: string[] = [];
  for (const s of stages) {
    if (s.kind !== 'ACKNOWLEDGE' && s.positionIds.length === 0) problems.push(`"${s.name || 'A step'}" needs at least one position to do it.`);
  }
  if (stages.some(s => s.kind === 'ASSESS' && s.positionIds.length > 1)) problems.push('Only one position can score it — pick one.');
  return problems;
}

export interface FormStep {
  key: StepKey;
  number: number;
  title: string;
  /** What stops the form going live, from this step. */
  issues: string[];
}

export const NAME_MISSING = 'Give the form a name.';
/** Same words as the server's check. */
export const POSITIONS_MISSING = 'Pick who it’s for — at least one position.';

/**
 * The three steps with what each still needs. `overWeight` is checked on the
 * screen as you type; the rest is the server's verdict on the last autosave.
 */
export function formSteps({ name, overWeight, positionCount, stages, problemsByArea }: {
  name: string;
  overWeight: string[];
  /** Positions picked on the page right now (may not be saved yet). */
  positionCount: number;
  /** The approval chain as it is on the page right now. */
  stages: ChainStep[];
  problemsByArea: { basics?: string[]; scoring: string[]; approval: string[] } | undefined;
}): FormStep[] {
  const unique = (xs: string[]) => [...new Set(xs)];
  return [
    { key: 'basics', number: 1, title: 'Basics', issues: [...(name.trim() ? [] : [NAME_MISSING]), ...(positionCount ? [] : [POSITIONS_MISSING])] },
    { key: 'scoring', number: 2, title: 'What’s scored', issues: unique([...overWeight, ...(problemsByArea?.scoring ?? [])]) },
    // Checked on the page (as positions are picked); the server's other chain checks are about its shape, which the editor keeps right.
    { key: 'approval', number: 3, title: 'Who appraises', issues: unique([...chainProblems(stages), ...(problemsByArea?.approval ?? []).filter(p => !/position/.test(p))]) },
  ];
}

/** The first step that still needs something — where "Make live" takes you. */
export const firstStepToFix = (steps: FormStep[]) => steps.find(s => s.issues.length > 0) ?? null;

export type SaveState = 'saved' | 'saving' | 'pending' | 'error';

/** The autosave status in the header, in plain words. */
export function saveStatusText(state: SaveState, reason?: string): string {
  switch (state) {
    case 'saved': return 'All changes saved';
    case 'saving': return 'Saving…';
    case 'pending': return 'Unsaved changes';
    case 'error': return reason ? `Couldn’t save — ${reason}` : 'Couldn’t save';
  }
}

/** Why a draft can't be saved right now ("Save draft" stays off and says this), or null. */
export function saveBlocker(name: string, overWeight: string[]): string | null {
  if (!name.trim()) return 'give the form a name';
  if (overWeight.length) return 'weights add up to more than 100%';
  return null;
}