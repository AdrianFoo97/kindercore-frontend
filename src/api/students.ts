import { apiFetch } from './client.js';
import { Student, StudentsResponse, OnboardingTask } from '../types/index.js';

export interface FetchStudentsParams {
  status?: string;
  onboarding?: 'pending' | 'completed' | 'all';
  onboardingStatus?: 'notStarted' | 'inProgress' | 'readyToComplete';
  search?: string;
  year?: number;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function fetchStudents(params?: FetchStudentsParams) {
  const qs = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
  }
  const query = qs.toString();
  return apiFetch<StudentsResponse>(`/api/students${query ? '?' + query : ''}`);
}

export function createStudent(payload: {
  leadId: string;
  enrolmentYear: number;
  enrolmentMonth: number;
  packageId: string;
  enrolledAt?: string;
  startDate?: string;
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
  startDate?: string | null;
  notes?: string | null;
  monthlyFee?: number;
  feeOverridden?: boolean;
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

export function completeOnboarding(id: string, force = false) {
  return apiFetch<Student>(`/api/students/${id}/complete-onboarding${force ? '?force=true' : ''}`, {
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

export interface RevenueAnalyticsData {
  selectedYear: number;
  prevYear: number;
  currentMonthIdx: number;
  totalActiveStudents: number;
  totalMonthlyRevenue: number;
  avgRevenuePerStudent: number;
  annualRevenue: number;
  actualRevenue: number;
  forecastRevenue: number;
  monthlyRevenue: Array<{ month: string; revenue: number; studentCount: number; current: number; previous: number; isForecast: boolean }>;
  revenueByProgramme: Array<{ programme: string; revenue: number; studentCount: number }>;
  revenueByAge: Array<{ age: string; revenue: number; studentCount: number }>;
  availableYears: number[];
}

export function fetchRevenueAnalytics(year?: number) {
  const params = year ? `?year=${year}` : '';
  return apiFetch<RevenueAnalyticsData>(`/api/students/revenue-analytics${params}`);
}

export function deleteStudent(id: string) {
  return apiFetch<void>(`/api/students/${id}`, { method: 'DELETE' });
}
