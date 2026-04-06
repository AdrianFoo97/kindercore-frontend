import { apiFetch } from './client.js';
import { Lead, LeadStatus, LeadsResponse } from '../types/index.js';

export function fetchLeadPhones() {
  return apiFetch<{ id: string; parentPhone: string; childName: string; submittedAt: string }[]>('/api/leads/phones');
}

export function fetchLeadById(id: string) {
  return apiFetch<Lead>(`/api/leads/${id}`);
}

export function fetchLeads(
  page: number,
  pageSize: number,
  status?: string,
  sortBy?: string,
  sortOrder?: string,
  search?: string,
  year?: number,
) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (status) params.set('status', status);
  if (sortBy) params.set('sortBy', sortBy);
  if (sortOrder) params.set('sortOrder', sortOrder);
  if (search) params.set('search', search);
  if (year) params.set('year', String(year));
  return apiFetch<LeadsResponse>(`/api/leads?${params}`);
}

export interface UpdateLeadPayload {
  childName?: string;
  parentPhone?: string;
  childDob?: string;
  enrolmentYear?: number;
  status?: LeadStatus;
  notes?: string;
  lostReason?: string | null;
  relationship?: string | null;
  programme?: string | null;
  preferredAppointmentTime?: string | null;
  addressLocation?: string | null;
  needsTransport?: boolean | null;
  howDidYouKnow?: string | null;
  appointmentStart?: string | null;
  appointmentEnd?: string | null;
  statusChangedAt?: string | null;
  attended?: boolean;
}

export function updateLead(leadId: string, payload: UpdateLeadPayload) {
  return apiFetch<Lead>(`/api/leads/${leadId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function submitLead(payload: {
  childName: string;
  parentPhone: string;
  childDob: string;
  enrolmentYear: number;
  company?: string;
  relationship?: string;
  programme?: string;
  preferredAppointmentTime?: string;
  addressLocation?: string;
  needsTransport?: boolean;
  howDidYouKnow?: string;
  submittedAt?: string;
}) {
  return apiFetch<Lead>('/api/leads', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteLead(id: string) {
  return apiFetch<void>(`/api/leads/${id}`, { method: 'DELETE' });
}

export function fetchTrashedLeads() {
  return apiFetch<Lead[]>('/api/leads/trash');
}

export function restoreLead(id: string) {
  return apiFetch<Lead>(`/api/leads/${id}/restore`, { method: 'POST' });
}

export function permanentDeleteLead(id: string) {
  return apiFetch<void>(`/api/leads/${id}/permanent`, { method: 'DELETE' });
}

export interface UpcomingAppointment {
  id: string;
  childName: string;
  parentPhone: string;
  appointmentStart: string;
  appointmentEnd: string | null;
  appointmentIsPlaceholder: boolean;
}

export function fetchUpcomingAppointments() {
  return apiFetch<UpcomingAppointment[]>('/api/leads/upcoming');
}

export interface LeadStats {
  NEW: number;
  CONTACTED: number;
  APPOINTMENT_BOOKED: number;
  FOLLOW_UP: number;
  ENROLLED: number;
  LOST: number;
  REJECTED: number;
  TRASH: number;
}

export function fetchLeadStats(year?: number) {
  const params = year ? `?year=${year}` : '';
  return apiFetch<LeadStats>(`/api/leads/stats${params}`);
}

export interface MonthlyAgeEntry {
  month: string;
  total: number;
  [age: string]: number | string;
}

export interface AnalyticsData {
  selectedYear: number;
  prevYear: number;
  totalLeads: number;
  totalAppointments: number;
  completedLeads: number;
  attendedAppointments: number;
  noShowLeads: number;
  appointmentRate: number;
  pendingLeads: number;
  rejectedLeads: number;
  monthlyComparison: { month: string; current: number; previous: number }[];
  monthlyByAge: MonthlyAgeEntry[];
  addressBreakdown: { location: string; count: number }[];
  marketingChannelBreakdown: { channel: string; count: number }[];
  leadsDetail: { monthIdx: number; address: string | null; channel: string | null }[];
  availableYears: number[];
}

export function fetchAnalytics(year?: number) {
  const params = year ? `?year=${year}` : '';
  return apiFetch<AnalyticsData>(`/api/leads/analytics${params}`);
}

export interface SalesLeadRow {
  id: string;
  childName: string;
  status: string;
  enrolmentYear: number;
  notes: string | null;
  addressLocation: string | null;
  howDidYouKnow: string | null;
  age: number;
  submittedAt: string;
}

export interface SalesAnalyticsData {
  selectedYear: number;
  prevYear: number;
  totalLeads: number;
  enrolledLeads: number;
  lostLeads: number;
  closingRate: number;
  monthlyComparison: { month: string; enrolled: number; lost: number; previous: number }[];
  monthlyByAge: MonthlyAgeEntry[];
  addressBreakdown: { location: string; count: number }[];
  marketingChannelBreakdown: { channel: string; count: number }[];
  leadsTable: SalesLeadRow[];
  availableYears: number[];
}

export function fetchSalesAnalytics(year?: number) {
  const params = year ? `?year=${year}` : '';
  return apiFetch<SalesAnalyticsData>(`/api/leads/sales-analytics${params}`);
}

export function createAppointment(leadId: string, appointmentStart: string, whatsappMessage: string, isPlaceholder = false, skipCalendar = false) {
  return apiFetch<{ googleEventId: string | null; googleEventLink: string | null; calendarSynced?: boolean }>(
    `/api/leads/${leadId}/appointment`,
    { method: 'POST', body: JSON.stringify({ appointmentStart, whatsappMessage, isPlaceholder, skipCalendar }) },
  );
}

export function confirmAppointment(leadId: string) {
  return apiFetch<{ googleEventId: string; googleEventLink: string }>(
    `/api/leads/${leadId}/confirm-appointment`,
    { method: 'POST' },
  );
}

export function confirmAppointmentNoCalendar(leadId: string) {
  return apiFetch<{ confirmed: boolean; calendarSynced: boolean }>(
    `/api/leads/${leadId}/confirm-appointment-no-calendar`,
    { method: 'POST' },
  );
}
