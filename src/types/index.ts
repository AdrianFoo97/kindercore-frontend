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
  | 'LOST';

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
  relationship: string | null;
  programme: string | null;
  preferredAppointmentTime: string | null;
  addressLocation: string | null;
  needsTransport: boolean | null;
  howDidYouKnow: string | null;
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
  notes: string | null;
  onboardingProgress: OnboardingTask[] | null;
  onboardingCompleted: boolean;
  withdrawnAt: string | null;
  withdrawReason: string | null;
  createdAt: string;
  lead: { childName: string; childDob: string; parentPhone: string };
  package: { name: string; programme: string; age: number; year: number };
}
