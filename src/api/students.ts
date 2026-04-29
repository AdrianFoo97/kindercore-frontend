import { apiFetch } from './client.js';
import { Student, StudentsResponse, OnboardingTask, Enrollment } from '../types/index.js';

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

export function createSibling(payload: {
  leadId: string;
  childName: string;
  childDob: string;            // YYYY-MM-DD
  enrolmentYear: number;
  enrolmentMonth: number;
  packageId: string;
  enrolledAt?: string;
  startDate?: string | null;
  notes?: string | null;
  monthlyFee?: number;
  feeOverridden?: boolean;
}) {
  return apiFetch<Student>('/api/students/sibling', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function createStudentWithLead(payload: {
  childName: string;
  parentPhone: string;
  childDob: string;            // YYYY-MM-DD
  howDidYouKnow: string;
  programme: string;
  submittedAt?: string;        // ISO datetime; default = now
  enrolmentYear: number;
  enrolmentMonth: number;
  packageId: string;
  enrolledAt?: string;
  startDate?: string | null;
  notes?: string | null;
  monthlyFee?: number;
  feeOverridden?: boolean;
}) {
  return apiFetch<Student>('/api/students/with-lead', {
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
  ageOffset?: number;
  childDob?: string;
  childName?: string;
  parentPhone?: string;
}) {
  return apiFetch<Student>(`/api/students/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// ── Enrollment history ────────────────────────────────────────────────
// Each enrollment row owns the package + fee for a contiguous period.
// Multiple rows form a non-overlapping timeline; the row with endDate=null
// is "current".

export function fetchEnrollments(studentId: string) {
  return apiFetch<Enrollment[]>(`/api/students/${studentId}/enrollments`);
}

export interface CreateEnrollmentPayload {
  packageId: string;
  monthlyFee: number;
  feeOverridden: boolean;
  /** Effective start date (ISO YYYY-MM-DD). The current row's endDate is set to this date. */
  startDate: string;
  reason?: string | null;
}

export function createEnrollment(studentId: string, payload: CreateEnrollmentPayload) {
  return apiFetch<Enrollment>(`/api/students/${studentId}/enrollments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface UpdateEnrollmentPayload {
  packageId?: string;
  monthlyFee?: number;
  feeOverridden?: boolean;
  startDate?: string;
  endDate?: string | null;
  reason?: string | null;
}

export function updateEnrollment(enrollmentId: string, payload: UpdateEnrollmentPayload) {
  return apiFetch<Enrollment>(`/api/enrollments/${enrollmentId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteEnrollment(enrollmentId: string) {
  return apiFetch<void>(`/api/enrollments/${enrollmentId}`, { method: 'DELETE' });
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
  monthlyRevenue: Array<{
    month: string;
    revenue: number;
    studentCount: number;
    current: number;
    previous: number;
    isForecast: boolean;
    breakdown: Record<string, Record<string, { count: number; revenue: number }>>;
    events: Array<{
      studentId: string;
      studentName: string;
      effectiveDate: string;
      type: 'new' | 'change';
      packageName: string | null;
      programme: string | null;
      packageAge: number | null;
      monthlyFee: number;
      prevPackageName: string | null;
      prevProgramme: string | null;
      prevMonthlyFee: number | null;
    }>;
  }>;
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
