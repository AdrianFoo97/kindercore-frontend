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
  leadTemperature: 'COOL' | 'WARM' | 'HOT' | null;
  /** Where the parent first heard about the school — distinct from
   *  `submissionChannel` (how they submitted the form). Existing
   *  `howDidYouKnow` is kept as a fallback for legacy rows; new
   *  rows should populate this enum-style field. Optional during the
   *  rollout so backend can ship the column independently. */
  discoverySource?: 'facebook' | 'xhs' | 'tiktok' | 'referral' | 'word_of_mouth' | 'walk_in' | 'pass_by' | 'google' | 'instagram' | 'sibling' | 'billboard' | 'unknown' | null;
  /** How the enquiry actually reached us. A parent who heard of us
   *  on Facebook may still submit through a WhatsApp link — these are
   *  two different concepts. Optional until the backend ships it. */
  submissionChannel?: 'whatsapp_link' | 'website_form' | 'facebook_form' | 'qr_code' | 'manual_entry' | 'unknown' | null;
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
  /** Number of students currently assigned to this package — populated by /api/packages */
  studentCount?: number;
}

export interface OnboardingTask {
  task: string;
  done: boolean;
}

/**
 * One package-enrollment period for a student. A student can have many of
 * these — they form a non-overlapping timeline. The row with `endDate=null`
 * is the current enrollment. Past rows are immutable history; revenue for
 * past months reads from whichever row covered the month-end cutoff.
 */
export interface Enrollment {
  id: string;
  studentId: string;
  packageId: string;
  package?: {
    id: string;
    name: string;
    programme: string;
    age: number;
    year: number;
    price: number | null;
  };
  monthlyFee: number;
  feeOverridden: boolean;
  /** Inclusive start date (ISO). */
  startDate: string;
  /** Exclusive end date (ISO). null = currently active. */
  endDate: string | null;
  reason: string | null;
  createdAt: string;
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
  monthlyFee: number | null;
  feeOverridden: boolean;
  ageOffset: number;
  onboardingProgress: OnboardingTask[] | null;
  onboardingCompleted: boolean;
  withdrawnAt: string | null;
  withdrawReason: string | null;
  /** RFID card identifier — taps on a physical reader create an
   *  attendance row by looking up the student via this field. */
  rfid: string | null;
  status: 'enrolled' | 'active' | 'graduated' | 'withdrawn';
  createdAt: string;
  siblings: { id: string; childName: string }[];
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

// ── Employee Salary ──────────────────────────────────────────────────────────

export interface Position {
  positionId: string;
  name: string;
  titleWeight: number;
  basicSalary: number;
  maxLevel: number;
  sortOrder: number;
  inCareerProgression: boolean;
  badgeUrl: string | null;
  /** Hex color (e.g. "#C0C0C0" silver, "#FFD700" gold) used when an
   *  achievement is fully earned at this position. Each tier feels
   *  distinct (silver → gold → blue → ...). */
  starColor: string | null;
  /** Short headline summarising what this rank is mainly responsible
   *  for (e.g. "Overall School Management"). Rendered bold above the
   *  description on the teacher career page. */
  roleFocus: string | null;
  /** Free-form description of the rank — shown on the position edit
   *  page and (later) on the teacher-facing career journey. */
  description: string | null;
}

export interface LevelIncentive {
  id: string;
  positionId: string;
  level: number;
  amount: number;
}

export interface AllowanceType {
  id: string;
  name: string;
  isDefault: boolean;
  sortOrder: number;
  /** FontAwesome icon name (without `fa` prefix), e.g. "gauge-high" */
  icon: string;
  /** True = always paid (Guaranteed badge). False = conditional/confirmed-when-met. */
  isGuaranteed: boolean;
  /** Parent allowance type's id — null for top-level types. */
  parentId: string | null;
}

export interface TeacherAllowance {
  id: string;
  teacherId: string;
  allowanceTypeId: string;
  amount: number;
}

export interface CareerRecord {
  id: string;
  teacherId: string;
  positionId: string;
  level: number;
  effectiveDate: string;
  notes: string | null;
  createdAt: string;
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
  positionId: string | null;
  level: number | null;
  isFixedSalary: boolean;
  fixedSalaryAmount: number | null;
  salaryType: string | null;
  hourlyRate: number | null;
  excludeFromProfitShare: boolean;
  overrideProfitShareWeight: boolean;
  customProfitShareWeight: number | null;
  hasEpf: boolean;
  hasSocso: boolean;
  hasEis: boolean;
  phone: string | null;
  employmentType: string | null;
  resignedAt: string | null;
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
