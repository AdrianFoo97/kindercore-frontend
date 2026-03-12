import { apiFetch } from './client.js';
import { Student, OnboardingTask } from '../types/index.js';

export function fetchStudents() {
  return apiFetch<Student[]>('/api/students');
}

export function createStudent(payload: {
  leadId: string;
  enrolmentYear: number;
  enrolmentMonth: number;
  packageId: string;
  enrolledAt?: string;
  notes?: string;
}) {
  return apiFetch<Student>('/api/students', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateStudent(id: string, payload: {
  enrolmentYear?: number;
  enrolmentMonth?: number;
  packageId?: string;
  enrolledAt?: string;
  notes?: string | null;
  childDob?: string;
  childName?: string;
  parentPhone?: string;
}) {
  return apiFetch<Student>(`/api/students/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function patchOnboardingProgress(id: string, progress: OnboardingTask[]) {
  return apiFetch<Student>(`/api/students/${id}/onboarding`, {
    method: 'PATCH',
    body: JSON.stringify({ progress }),
  });
}

export function completeOnboarding(id: string) {
  return apiFetch<Student>(`/api/students/${id}/complete-onboarding`, {
    method: 'PATCH',
  });
}

export function withdrawStudent(id: string, payload: { withdrawnAt: string; withdrawReason?: string }) {
  return apiFetch<Student>(`/api/students/${id}/withdraw`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function reactivateStudent(id: string) {
  return apiFetch<Student>(`/api/students/${id}/reactivate`, { method: 'PATCH' });
}

export function deleteStudent(id: string) {
  return apiFetch<void>(`/api/students/${id}`, { method: 'DELETE' });
}
