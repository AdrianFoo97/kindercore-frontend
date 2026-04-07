export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'APPOINTMENT_BOOKED'
  | 'FOLLOW_UP'
  | 'ENROLLED'
  | 'LOST'
  | 'REJECTED';

export interface Lead {
  id: string;
  submittedAt: string;
  childName: string;
  parentPhone: string;
  childDob: string;
  enrolmentYear: number;
  status: LeadStatus;
  notes: string | null;
  appointmentStart: string | null;
  appointmentEnd: string | null;
  googleEventId: string | null;
  googleEventLink: string | null;
  appointmentCreatedByUserId: string | null;
  appointmentIsPlaceholder: boolean;
  lostReason: string | null;
  statusChangedAt: string | null;
  relationship: string | null;
  programme: string | null;
  preferredAppointmentTime: string | null;
  addressLocation: string | null;
  needsTransport: boolean | null;
  howDidYouKnow: string | null;
  ctaSource: string | null;
  utmSource: string | null;
  deletedAt: string | null;
}

export interface LeadsResponse {
  items: Lead[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Settings {
  whatsapp_template: string;
  whatsapp_template_zh: string;
  whatsapp_followup_template: string;
  whatsapp_followup_template_zh: string;
  appointment_duration_minutes: number;
  appointment_lead_time_hours: number;
  kinder_address: string;
  lost_reasons: string[];
  onboarding_tasks: string[];
  [key: string]: unknown;
}

export type Programme = 'Half Day' | 'Full Day' | 'Half Day + Enrichment';

export interface Package {
  id: string;
  year: number;
  programme: Programme;
  age: number;
  name: string;
  price: number | null;
  updatedAt: string;
}

export interface OnboardingTask {
  task: string;
  done: boolean;
}

export interface Student {
  id: string;
  leadId: string;
  enrolmentYear: number;
  enrolmentMonth: number;
  packageId: string;
  enrolledAt: string;
  startDate: string | null;
  notes: string | null;
  onboardingProgress: OnboardingTask[] | null;
  onboardingCompleted: boolean;
  withdrawnAt: string | null;
  withdrawReason: string | null;
  status: 'enrolled' | 'active' | 'graduated' | 'withdrawn';
  createdAt: string;
  lead: { childName: string; childDob: string; parentPhone: string; submittedAt: string };
  package: { name: string; programme: string; age: number; year: number };
}

export interface StudentsResponse {
  items: Student[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: { enrolled: number; active: number; graduated: number; withdrawn: number };
  onboardingCounts: { total: number; notStarted: number; inProgress: number; readyToComplete: number };
  availableYears: number[];
}

// ── Operations Planner ───────────────────────────────────────────────────────

export interface Teacher {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  allowedSubjectIds: string[] | null;
  allowedClassroomIds: string[] | null;
  workStartMinute: number | null;
  workEndMinute: number | null;
  workDays: number[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface Classroom {
  id: string;
  name: string;
  capacity: number | null;
  startMinute: number | null;
  endMinute: number | null;
  daysOfWeek: number[] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlannerSubject {
  id: string;
  name: string;
  color: string;
  lessonsPerWeek: number | null;
  defaultDuration: number | null;
  classLessons: Record<string, number> | null;
  createdAt: string;
}

export interface PlannerTask {
  id: string;
  name: string;
  category: 'TEACHING' | 'ADMIN' | 'DUTY' | 'BREAK' | 'OTHER';
  color: string;
  defaultDuration: number;
  createdAt: string;
}

export interface ScheduleBlock {
  id: string;
  weekDate: string;
  dayOfWeek: number;
  startMinute: number;
  durationMinutes: number;
  teacherId: string | null;
  subjectId: string | null;
  taskId: string | null;
  classroomId: string | null;
  assignedTeacherIds: string[] | null;
  notes: string | null;
  teacher: { id: string; name: string; color: string } | null;
  subject: { id: string; name: string; color: string } | null;
  task: { id: string; name: string; category: string; color: string } | null;
  classroom: { id: string; name: string } | null;
  conflicts?: Array<{ type: string; description: string }>;
}
