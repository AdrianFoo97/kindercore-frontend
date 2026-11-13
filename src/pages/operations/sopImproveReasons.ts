// Step 1 of a teacher's "Suggest an improvement" to a How-To Guide: list why
// it needs improving before changing any steps. The reasons go to the
// reviewer with the suggestion. (The server also requires at least one.)

export const MAX_REASONS = 10;
export const MAX_REASON_LENGTH = 300;

/** Common reasons a teacher can tap to add, then edit. */
export const REASON_SUGGESTIONS = [
  'A step is out of date',
  'A step is missing',
  'Hard to follow',
  'Steps are in the wrong order',
  'Safety concern',
] as const;

/** The reasons as they'll be sent: trimmed, single-spaced, blanks dropped. */
export function cleanReasons(list: string[]): string[] {
  return list.map(r => r.trim().replace(/\s+/g, ' ')).filter(Boolean);
}

/** Can the teacher go on to step 2 (change the steps)? */
export const canContinue = (list: string[]) => cleanReasons(list).length > 0;

/**
 * Add a suggested reason: fills the last row if it's empty, otherwise adds a
 * row. Nothing happens if it's already listed (any case) or the list is full.
 */
export function addReason(list: string[], text: string): string[] {
  const already = cleanReasons(list).some(r => r.toLowerCase() === text.trim().toLowerCase());
  if (already) return list;
  const lastBlank = list.length > 0 && !list[list.length - 1].trim();
  if (lastBlank) return [...list.slice(0, -1), text];
  if (list.length >= MAX_REASONS) return list;
  return [...list, text];
}
