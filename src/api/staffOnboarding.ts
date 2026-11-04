import { apiFetch } from './client.js';
import type { OnboardingTask } from '../types/index.js';

// Staff onboarding — two checklists per new joiner:
//  - HR's (onboardingProgress), ticked on HR → Onboarding.
//  - Their own (selfOnboardingProgress), ticked by them in the app's "My onboarding" card.
// Onboarding can be marked complete only when both are done.

export interface StaffOnboardingEntry {
  id: string;
  name: string;
  color: string;
  phone: string | null;
  joinDate: string;
  positionName: string | null;
  onboardingProgress: OnboardingTask[];
  selfOnboardingProgress: OnboardingTask[];
}

export const STAFF_ONBOARDING_SETTING = 'staff_onboarding_tasks';
export const STAFF_SELF_ONBOARDING_SETTING = 'staff_self_onboarding_tasks';

export const fetchStaffOnboarding = () => apiFetch<StaffOnboardingEntry[]>('/api/staff-onboarding');

export const saveStaffOnboarding = (teacherId: string, progress: OnboardingTask[]) =>
  apiFetch<{ ok: true }>(`/api/teachers/${teacherId}/onboarding`, { method: 'PATCH', body: JSON.stringify({ progress }) });

export const completeStaffOnboarding = (teacherId: string, force = false) =>
  apiFetch<{ ok: true }>(`/api/teachers/${teacherId}/onboarding/complete${force ? '?force=true' : ''}`, { method: 'POST' });

/** Put an existing staff member on onboarding (Staff page → ⋯ → Create Onboarding Tasks). */
export const startStaffOnboarding = (teacherId: string) =>
  apiFetch<{ hrTasks: number; ownTasks: number }>(`/api/teachers/${teacherId}/onboarding/start`, { method: 'POST' });

/** Their own checklist. Saving sends ticks only — one true/false per task. */
export const fetchMyOnboarding = (teacherId: string) =>
  apiFetch<{ tasks: OnboardingTask[] }>(`/api/teachers/${teacherId}/my-onboarding`);

export const tickMyOnboarding = (teacherId: string, tasks: OnboardingTask[]) =>
  apiFetch<{ tasks: OnboardingTask[] }>(`/api/teachers/${teacherId}/my-onboarding`, {
    method: 'PUT', body: JSON.stringify({ done: tasks.map(t => t.done) }),
  });
