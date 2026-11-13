// Current Focus — the quests a teacher has pinned to work on now. Kept short
// on purpose: at most MAX_FOCUS_MISSIONS unfinished ones at a time (the
// server enforces the same limit).

export const MAX_FOCUS_MISSIONS = 3;

interface MissionLike { id: string; progress?: { isTargeted?: boolean; status?: string } | null }

/** The pinned, unfinished quests, in board order. */
export function focusMissions<M extends MissionLike>(missions: M[]): M[] {
  return missions.filter(m => m.progress?.isTargeted && m.progress?.status !== 'COMPLETED').slice(0, MAX_FOCUS_MISSIONS);
}

/** Can another quest be pinned? (Unpinning is always allowed.) */
export function canPinAnother(missions: MissionLike[]): boolean {
  return missions.filter(m => m.progress?.isTargeted && m.progress?.status !== 'COMPLETED').length < MAX_FOCUS_MISSIONS;
}

export const FOCUS_FULL_MESSAGE = `You're focused on ${MAX_FOCUS_MISSIONS} already — unpin one first.`;