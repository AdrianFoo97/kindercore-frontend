import type { OnboardingTask } from '../../types/index.js';
import { completeStaffOnboarding, saveStaffOnboarding, tickMyOnboarding, type StaffOnboardingEntry } from '../../api/staffOnboarding.js';
import { ChecklistModal } from '../../components/onboarding/ChecklistModal.js';
import { isListDone } from './progress.js';

// HR → Onboarding uses the same checklist window as Students → Onboarding,
// for either of a new joiner's two lists. Onboarding is only completed when
// BOTH lists end up fully ticked — so finishing one list while the other is
// still open just saves.

export type StaffList = 'hr' | 'own';

export function StaffChecklistModal({ entry, list, initial, onClose, onSaved }: {
  entry: StaffOnboardingEntry;
  list: StaffList;
  /** The list to edit (HR's falls back to a fresh copy of the template when empty). */
  initial: OnboardingTask[];
  onClose: () => void;
  onSaved: (completed: boolean) => void;
}) {
  const otherListDone = isListDone(list === 'hr' ? entry.selfOnboardingProgress : entry.onboardingProgress);
  const who = [entry.name, entry.positionName, entry.phone].filter(Boolean).join(' · ');
  const subtitle = list === 'hr'
    ? `HR tasks · ${who}`
    : `${entry.name}'s own tasks — they tick these in their app; you can tick them on their behalf`;

  return (
    <ChecklistModal
      subtitle={subtitle}
      initialItems={initial}
      canFinish={otherListDone}
      onClose={onClose}
      onSave={async (items, finish) => {
        if (list === 'hr') await saveStaffOnboarding(entry.id, items);
        else await tickMyOnboarding(entry.id, items);
        if (finish) await completeStaffOnboarding(entry.id);
        onSaved(finish);
      }}
    />
  );
}
