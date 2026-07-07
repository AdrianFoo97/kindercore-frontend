import { apiFetch } from './client.js';
import { Position } from '../types/index.js';

// Category codes are admin-managed (see /settings/mission-categories)
// so the type is now an open string. Use `findCategoryMeta()` to resolve
// presentation (icon, color, achievement name) at render time.
export type MissionCategory = string;
export type MissionDifficulty = 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
export type MissionStatus = 'PENDING' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'COMPLETED';

export interface CareerMission {
  id: string;
  positionId: string;
  title: string;
  category: MissionCategory;
  description: string | null;
  whyItMatters: string | null;
  difficulty: MissionDifficulty;
  evidenceRequirements: string | null;
  required: boolean;
  highPriority: boolean;
  requiresApproval: boolean;
  displayOrder: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherMissionProgress {
  id: string;
  teacherId: string;
  missionId: string;
  status: MissionStatus;
  evidenceCount: number;
  evidenceTotal: number;
  /** True when the teacher has pinned this mission as a current focus. */
  isTargeted: boolean;
  notes: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MissionWithProgress extends CareerMission {
  progress: TeacherMissionProgress | null;
  /** Human-readable name of the position this mission belongs to.
   *  Useful when listing missions that come from future ladder
   *  positions ("for Senior EI", "for Supervisor", …). */
  positionName: string | null;
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

export interface TeacherCareerData {
  teacher: {
    id: string;
    name: string;
    color: string;
    positionId: string | null;
    level: number | null;
  };
  positions: Position[];
  ladder: Position[];
  currentPosition: Position | null;
  nextPosition: Position | null;
  nextPositionRequirements: string[];
  missions: MissionWithProgress[];
  missionPct: number;
  history: CareerRecord[];
  readiness: {
    missions: { completed: number; total: number; inProgress: number; met: boolean };
    appraisal: { value: number | null; required: number; met: boolean; mock: boolean; recordCount?: number; windowSize?: number };
    safety: { value: number | null; required: number; met: boolean; mock: boolean };
    sopCompliance: { passed: boolean; mock: boolean };
    supervisorApproval: { approved: boolean; mock: boolean };
    blockers: string[];
    overallReady: boolean;
    isFinalStage: boolean;
    isCurrentInLadder: boolean;
  };
}

export function fetchMissions(positionId?: string) {
  const qs = positionId ? `?positionId=${encodeURIComponent(positionId)}` : '';
  return apiFetch<CareerMission[]>(`/api/career-missions${qs}`);
}

export interface CreateMissionPayload {
  positionId: string;
  title: string;
  category: MissionCategory;
  description?: string | null;
  whyItMatters?: string | null;
  difficulty?: MissionDifficulty;
  evidenceRequirements?: string | null;
  required?: boolean;
  highPriority?: boolean;
  requiresApproval?: boolean;
  displayOrder?: number;
}

export function createMission(payload: CreateMissionPayload) {
  return apiFetch<CareerMission>('/api/career-missions', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateMission(id: string, payload: Partial<CreateMissionPayload>) {
  return apiFetch<CareerMission>(`/api/career-missions/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function deleteMission(id: string) {
  return apiFetch<void>(`/api/career-missions/${id}`, { method: 'DELETE' });
}

export function reorderMissions(positionId: string, orderedIds: string[]) {
  return apiFetch<{ ok: true }>('/api/career-missions/reorder', {
    method: 'POST',
    body: JSON.stringify({ positionId, orderedIds }),
  });
}

export function fetchTeacherCareer(teacherId: string) {
  return apiFetch<TeacherCareerData>(`/api/teachers/${teacherId}/career-page`);
}

export function upsertTeacherMissionProgress(
  teacherId: string,
  missionId: string,
  payload: { status?: MissionStatus; evidenceCount?: number; evidenceTotal?: number; notes?: string | null },
) {
  return apiFetch<TeacherMissionProgress>(`/api/teachers/${teacherId}/missions/${missionId}/progress`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function setMissionTarget(
  teacherId: string,
  missionId: string,
  isTargeted: boolean,
) {
  return apiFetch<TeacherMissionProgress>(`/api/teachers/${teacherId}/missions/${missionId}/target`, {
    method: 'PUT',
    body: JSON.stringify({ isTargeted }),
  });
}
