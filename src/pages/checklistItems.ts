// Onboarding checklist items — a line of text, an optional description (shown
// on hover / tap), and, if the admin chose, a button with a link. The server checks the same rules
// (kindercore-backend/src/services/checklist.logic.ts); this copy lets the
// Settings editor explain a problem before saving.

export const MAX_TASK_LENGTH = 300;
export const MAX_LINK_LABEL_LENGTH = 40;
export const MAX_DESCRIPTION_LENGTH = 500;

export interface ChecklistItem { task: string; description?: string; linkLabel?: string; linkUrl?: string }

/** Why a link can't be used — or null. Web addresses (http/https) or a page in this app ("/…"). */
export function checklistLinkProblem(url: string): string | null {
  const u = url.trim();
  if (!u) return 'Add the link the button opens.';
  if (u.startsWith('/') && !u.startsWith('//')) return null;
  try {
    const parsed = new URL(u);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return null;
  } catch { /* not a URL */ }
  return 'Use a web address starting with https:// (or a page in the app starting with /).';
}

/** Why one item can't be saved — or null. */
export function checklistItemProblem(item: ChecklistItem): string | null {
  const task = item.task.trim();
  if (!task) return 'Every item needs some text.';
  if (task.length > MAX_TASK_LENGTH) return `Keep each item under ${MAX_TASK_LENGTH} characters.`;
  if ((item.description ?? '').trim().length > MAX_DESCRIPTION_LENGTH) return `Keep the description under ${MAX_DESCRIPTION_LENGTH} characters.`;
  const label = (item.linkLabel ?? '').trim();
  const url = (item.linkUrl ?? '').trim();
  if (!label && !url) return null;
  if (!label) return 'Give the button a label.';
  if (label.length > MAX_LINK_LABEL_LENGTH) return `Keep the button label under ${MAX_LINK_LABEL_LENGTH} characters.`;
  return checklistLinkProblem(url);
}

/** A checklist template from settings — old plain-text lists and lists with links alike. */
export function parseChecklistTemplate(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r): ChecklistItem[] => {
    if (typeof r === 'string') return r.trim() ? [{ task: r.trim() }] : [];
    if (!r || typeof r !== 'object' || !('task' in r)) return [];
    const { task, description, linkLabel, linkUrl } = r as { task: unknown; description?: unknown; linkLabel?: unknown; linkUrl?: unknown };
    const text = String(task ?? '').trim();
    if (!text) return [];
    const item: ChecklistItem = { task: text };
    const about = typeof description === 'string' ? description.trim() : '';
    if (about) item.description = about;
    const label = typeof linkLabel === 'string' ? linkLabel.trim() : '';
    const url = typeof linkUrl === 'string' ? linkUrl.trim() : '';
    if (label && url && !checklistLinkProblem(url)) { item.linkLabel = label; item.linkUrl = url; }
    return [item];
  });
}

/** True for a web address (opens in a new tab); false for a page in this app. */
export function isExternalLink(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

/** One ticked step in someone's checklist. */
export interface ChecklistStep extends ChecklistItem { done: boolean }

const stepKey = (task: string) => task.trim().replace(/\s+/g, ' ').toLowerCase();
const sameStep = (a: ChecklistItem, b: ChecklistItem) =>
  a.task.trim() === b.task.trim() && (a.description ?? '') === (b.description ?? '')
  && (a.linkLabel ?? '') === (b.linkLabel ?? '') && (a.linkUrl ?? '') === (b.linkUrl ?? '');

/** True when someone's checklist has exactly the steps of the current template (ticks aside). */
export function matchesTemplate<T extends ChecklistItem>(steps: T[], template: ChecklistItem[]): boolean {
  return steps.length === template.length && steps.every((s, i) => sameStep(s, template[i]));
}

/**
 * Someone's checklist brought up to the current template: its steps, in its
 * order, keeping the tick on any step whose wording still matches. Also says
 * how many steps were added and removed.
 */
export function updateToTemplate(steps: ChecklistStep[], template: ChecklistItem[]): { steps: ChecklistStep[]; added: number; removed: number } {
  const unused = [...steps];
  let added = 0;
  const next = template.map(t => {
    const i = unused.findIndex(s => stepKey(s.task) === stepKey(t.task));
    if (i < 0) { added++; return { ...t, done: false }; }
    const [old] = unused.splice(i, 1);
    return { ...t, done: old.done };
  });
  return { steps: next, added, removed: unused.length };
}
