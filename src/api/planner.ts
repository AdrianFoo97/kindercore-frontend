import { apiFetch } from './client.js';
import { Teacher, Classroom, PlannerSubject, PlannerTask, ScheduleBlock } from '../types/index.js';

// ── Teachers ─────────────────────────────────────────────────────────────────

export function fetchTeachers() {
  return apiFetch<Teacher[]>('/api/planner/teachers');
}

export function createTeacher(data: { name: string; color: string; allowedSubjectIds?: string[]; allowedClassroomIds?: string[]; workStartMinute?: number; workEndMinute?: number; workDays?: number[] }) {
  return apiFetch<Teacher>('/api/planner/teachers', { method: 'POST', body: JSON.stringify(data) });
}

export function updateTeacher(id: string, data: Partial<{ name: string; color: string; allowedSubjectIds: string[] | null; allowedClassroomIds: string[] | null; workStartMinute: number | null; workEndMinute: number | null; workDays: number[] | null }>) {
  return apiFetch<Teacher>(`/api/planner/teachers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteTeacher(id: string) {
  return apiFetch<void>(`/api/planner/teachers/${id}`, { method: 'DELETE' });
}

// ── Classrooms ───────────────────────────────────────────────────────────────

export function fetchClassrooms() {
  return apiFetch<Classroom[]>('/api/planner/classrooms');
}

export function createClassroom(data: { name: string; capacity?: number; startMinute?: number; endMinute?: number; daysOfWeek?: number[] }) {
  return apiFetch<Classroom>('/api/planner/classrooms', { method: 'POST', body: JSON.stringify(data) });
}

export function updateClassroom(id: string, data: Partial<{ name: string; capacity: number | null; startMinute: number | null; endMinute: number | null; daysOfWeek: number[] | null }>) {
  return apiFetch<Classroom>(`/api/planner/classrooms/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteClassroom(id: string) {
  return apiFetch<void>(`/api/planner/classrooms/${id}`, { method: 'DELETE' });
}

// ── Subjects ─────────────────────────────────────────────────────────────────

export function fetchSubjects() {
  return apiFetch<PlannerSubject[]>('/api/planner/subjects');
}

export function createSubject(data: { name: string; color: string; lessonsPerWeek?: number; defaultDuration?: number; classLessons?: Record<string, number> }) {
  return apiFetch<PlannerSubject>('/api/planner/subjects', { method: 'POST', body: JSON.stringify(data) });
}

export function updateSubject(id: string, data: Partial<{ name: string; color: string; lessonsPerWeek: number | null; defaultDuration: number | null; classLessons: Record<string, number> | null }>) {
  return apiFetch<PlannerSubject>(`/api/planner/subjects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteSubject(id: string) {
  return apiFetch<void>(`/api/planner/subjects/${id}`, { method: 'DELETE' });
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export function fetchTasks() {
  return apiFetch<PlannerTask[]>('/api/planner/tasks');
}

export function createTask(data: { name: string; category: string; color: string; defaultDuration?: number }) {
  return apiFetch<PlannerTask>('/api/planner/tasks', { method: 'POST', body: JSON.stringify(data) });
}

export function updateTask(id: string, data: Partial<{ name: string; category: string; color: string; defaultDuration: number }>) {
  return apiFetch<PlannerTask>(`/api/planner/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteTask(id: string) {
  return apiFetch<void>(`/api/planner/tasks/${id}`, { method: 'DELETE' });
}

// ── Schedule Blocks ──────────────────────────────────────────────────────────

export interface CreateBlockPayload {
  weekDate: string;
  dayOfWeek: number;
  startMinute: number;
  durationMinutes: number;
  teacherId?: string;
  subjectId?: string;
  taskId?: string;
  classroomId?: string;
  notes?: string;
}

export interface UpdateBlockPayload {
  dayOfWeek?: number;
  startMinute?: number;
  durationMinutes?: number;
  teacherId?: string;
  subjectId?: string | null;
  taskId?: string | null;
  classroomId?: string | null;
  assignedTeacherIds?: string[] | null;
  notes?: string | null;
}

export function fetchBlocks(weekDate: string) {
  return apiFetch<ScheduleBlock[]>(`/api/planner/blocks?weekDate=${weekDate}`);
}

export function createBlock(data: CreateBlockPayload) {
  return apiFetch<ScheduleBlock>('/api/planner/blocks', { method: 'POST', body: JSON.stringify(data) });
}

export function updateBlock(id: string, data: UpdateBlockPayload) {
  return apiFetch<ScheduleBlock>(`/api/planner/blocks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deleteBlock(id: string) {
  return apiFetch<void>(`/api/planner/blocks/${id}`, { method: 'DELETE' });
}

export function duplicateBlock(data: { blockId: string; dayOfWeek?: number; startMinute?: number }) {
  return apiFetch<ScheduleBlock>('/api/planner/blocks/duplicate', { method: 'POST', body: JSON.stringify(data) });
}

export function copyWeek(data: { sourceWeekDate: string; targetWeekDate: string }) {
  return apiFetch<{ count: number }>('/api/planner/blocks/copy-week', { method: 'POST', body: JSON.stringify(data) });
}

export function checkConflicts(data: {
  teacherId: string;
  classroomId?: string;
  dayOfWeek: number;
  startMinute: number;
  durationMinutes: number;
  weekDate: string;
  excludeBlockId?: string;
}) {
  return apiFetch<{ conflicts: Array<{ type: string; description: string; blockId: string }> }>(
    '/api/planner/blocks/check-conflicts',
    { method: 'POST', body: JSON.stringify(data) },
  );
}

// ── Saved Timetables ────────────────────────────────────────────────────────

export interface SavedTimetable {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export function fetchSavedTimetables() {
  return apiFetch<SavedTimetable[]>('/api/planner/timetables');
}

export function saveTimetable(data: { name: string; weekDate: string }) {
  return apiFetch<{ id: string; name: string; blockCount: number }>('/api/planner/timetables', {
    method: 'POST', body: JSON.stringify(data),
  });
}

export function loadSavedTimetable(id: string, weekDate: string) {
  return apiFetch<{ message: string; blockCount: number }>(`/api/planner/timetables/${id}/load?weekDate=${weekDate}`, {
    method: 'POST',
  });
}

export function deleteSavedTimetable(id: string) {
  return apiFetch<{ message: string }>(`/api/planner/timetables/${id}`, { method: 'DELETE' });
}
