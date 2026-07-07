import { apiFetch } from './client.js';

export interface AttendanceRecord {
  id: string;
  studentId: string;
  scannedAt: string;
  source: 'rfid' | 'manual' | string;
  notes: string | null;
  createdAt: string;
}

/** Newest-first list of attendance entries for a student (capped at 200). */
export function fetchStudentAttendance(studentId: string) {
  return apiFetch<AttendanceRecord[]>(`/api/students/${studentId}/attendance`);
}

/** Remove an attendance entry — used to undo erroneous manual ticks. */
export function deleteAttendance(attendanceId: string) {
  return apiFetch<{ ok: true }>(`/api/attendance/${attendanceId}`, { method: 'DELETE' });
}

export interface ScanResponse {
  ok: boolean;
  deduplicated: boolean;
  student: { id: string; childName: string | null; withdrawn: boolean };
  attendance: AttendanceRecord;
}

/** Manually post an attendance scan from the admin UI (e.g. test the
 *  reader, or back-fill a missed tap). The physical reader hits the
 *  same endpoint with `source: 'rfid'`. */
export function scanAttendance(payload: { rfid: string; source?: 'rfid' | 'manual'; notes?: string | null }) {
  return apiFetch<ScanResponse>('/api/attendance/scan', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
