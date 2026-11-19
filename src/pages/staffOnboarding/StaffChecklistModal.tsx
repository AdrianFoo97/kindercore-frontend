import type { OnboardingTask } from '../../types/index.js';
import { useQuery } from '@tanstack/react-query';
import { fetchSettings } from '../../api/settings.js';
import { STAFF_ONBOARDING_SETTING, STAFF_SELF_ONBOARDING_SETTING, completeStaffOnboarding, saveOwnOnboardingSteps, saveStaffOnboarding, tickMyOnboarding, type StaffOnboardingEntry } from '../../api/staffOnboarding.js';
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
  // The list's current steps in Settings — lets HR update an older copy to them.
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  const template = settings?.[list === 'hr' ? STAFF_ONBOARDING_SETTING : STAFF_SELF_ONBOARDING_SETTING];
  const otherListDone = isListDone(list === 'hr' ? entry.selfOnboardingProgress : entry.onboardingProgress);
  const who = [entry.name, entry.positionName, entry.phone].filter(Boolean).join(' · ');
  const subtitle = list === 'hr'
    ? `HR tasks · ${who}`
    : `${entry.name}'s own tasks — they tick these in their app; you can tick them on their behalf`;

  return (
    <ChecklistModal
      subtitle={subtitle}
      initialItems={initial}
      templateTasks={template}
      canFinish={otherListDone}
      onClose={onClose}
      onSave={async (items, finish, stepsChanged) => {
        if (list === 'hr') await saveStaffOnboarding(entry.id, items);
        // Their own list only takes ticks — unless HR just updated its steps.
        else if (stepsChanged) await saveOwnOnboardingSteps(entry.id, items);
        else await tickMyOnboarding(entry.id, items);
        if (finish) await completeStaffOnboarding(entry.id);
        onSaved(finish);
      }}
    />
  );
}
