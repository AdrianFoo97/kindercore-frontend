import { apiFetch } from './client.js';

export interface PointsBalance { current: number; earnedThisMonth: number; lifetimeEarned: number; }
export interface TeacherGoal { rewardId: string; setAt: string; }
export interface TeacherPoints {
  balance: PointsBalance;
  goal: TeacherGoal | null;
  pointsLastSeenAt: string | null;
}

export interface PointTransaction {
  id: string;
  teacherId: string;
  kind: 'earned' | 'redeemed';
  label: string;
  delta: number;
  balanceAfter: number;
  date: string;
  ruleId: string | null;
  redemptionId: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

// Real 3-state enum only — the mock's extra 'available'/'used'/'expired'
// states have no backend equivalent and are not used anywhere in this app.
export type RedemptionStatus = 'redeemed' | 'pending' | 'delivered';

export interface RewardRedemption {
  id: string;
  teacherId: string;
  rewardId: string;
  label: string;
  icon: string;
  pointsSpent: number;
  status: RedemptionStatus;
  voucherCode: string | null;
  redemptionCode: string;
  instructions: string | null;
  redeemedDate: string;
  createdAt: string;
  updatedAt: string;
}

// Admin fulfilment-workbench shape — `listAllRedemptions` joins in the
// teacher's name so HR doesn't need a per-teacher drill-down.
export interface AdminRedemption {
  id: string;
  teacherId: string;
  teacherName: string | null;
  rewardId: string;
  label: string;
  icon: string;
  pointsSpent: number;
  status: RedemptionStatus;
  voucherCode: string | null;
  redemptionCode: string;
  instructions: string | null;
  redeemedDate: string;
}

export interface PointsRewardItem {
  id: string;
  icon: string;
  label: string;
  sub: string | null;
  cost: number;
  stock: 'in' | 'limited' | 'out';
  category: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PointsEarningRule {
  id: string;
  icon: string;
  label: string;
  description: string | null;
  amount: number;
  category: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StandingsRow {
  teacherId: string;
  displayName: string;
  color: string;
  pts: number;
  rank: number;
  prevRank: number | null;
  delta: number | null;
  ptsToAbove: number;
  isMe: boolean;
}
export interface Standings {
  period: { start: string; end: string; label: string; kind: 'current' | 'previous' };
  team: { totalPts: number; vsPrevious: number };
  rows: StandingsRow[];
  climbers: { teacherId: string; displayName: string; delta: number }[];
}

// ── Teacher-scoped points ────────────────────────────────────────────────
export const fetchTeacherPoints = (teacherId: string) =>
  apiFetch<TeacherPoints>(`/api/teachers/${teacherId}/points`);

export const fetchStandings = (teacherId: string, period: 'current' | 'previous' = 'current') =>
  apiFetch<Standings>(`/api/teachers/${teacherId}/points/standings?period=${period}`);

export const fetchTransactions = (teacherId: string) =>
  apiFetch<PointTransaction[]>(`/api/teachers/${teacherId}/points/transactions`);

export const grantPoints = (teacherId: string, body: { amount: number; label: string; ruleId?: string | null; note?: string | null }) =>
  apiFetch<PointTransaction>(`/api/teachers/${teacherId}/points/grant`, {
    method: 'POST', body: JSON.stringify(body),
  });

export const markPointsSeen = (teacherId: string) =>
  apiFetch<{ pointsLastSeenAt: string }>(`/api/teachers/${teacherId}/points/seen`, { method: 'POST' });

export const updateTransaction = (id: string, body: Partial<{ amount: number; label: string; note: string | null }>) =>
  apiFetch<PointTransaction>(`/api/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

export const deleteTransaction = (id: string) =>
  apiFetch<{ ok: true }>(`/api/transactions/${id}`, { method: 'DELETE' });

export const setGoal = (teacherId: string, rewardId: string) =>
  apiFetch<TeacherGoal>(`/api/teachers/${teacherId}/points/goal`, {
    method: 'PUT', body: JSON.stringify({ rewardId }),
  });

export const clearGoal = (teacherId: string) =>
  apiFetch<{ ok: true }>(`/api/teachers/${teacherId}/points/goal`, { method: 'DELETE' });

// ── Teacher-scoped rewards / redemptions ─────────────────────────────────
export const fetchMyRewards = (teacherId: string) =>
  apiFetch<RewardRedemption[]>(`/api/teachers/${teacherId}/rewards`);

export const redeemReward = (teacherId: string, rewardId: string) =>
  apiFetch<RewardRedemption>(`/api/teachers/${teacherId}/rewards/redeem`, {
    method: 'POST', body: JSON.stringify({ rewardId }),
  });

// ── Global catalog / rules (read: everyone; write: admin CRUD) ──────────
export const fetchRewardCatalog = () => apiFetch<PointsRewardItem[]>('/api/points/rewards');
export const fetchEarningRules = () => apiFetch<PointsEarningRule[]>('/api/points/rules');

export const createRule = (body: { icon: string; label: string; description?: string | null; amount: number; category?: string; active?: boolean }) =>
  apiFetch<PointsEarningRule>('/api/points/rules', { method: 'POST', body: JSON.stringify(body) });
export const updateRule = (id: string, body: Partial<{ icon: string; label: string; description: string | null; amount: number; category: string; active: boolean }>) =>
  apiFetch<PointsEarningRule>(`/api/points/rules/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteRule = (id: string) =>
  apiFetch<{ ok: true }>(`/api/points/rules/${id}`, { method: 'DELETE' });

export const createReward = (body: { icon: string; label: string; sub?: string | null; cost: number; stock?: 'in' | 'limited' | 'out'; category?: string; active?: boolean }) =>
  apiFetch<PointsRewardItem>('/api/points/rewards', { method: 'POST', body: JSON.stringify(body) });
export const updateReward = (id: string, body: Partial<{ icon: string; label: string; sub: string | null; cost: number; stock: 'in' | 'limited' | 'out'; category: string; active: boolean }>) =>
  apiFetch<PointsRewardItem>(`/api/points/rewards/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteReward = (id: string) =>
  apiFetch<{ ok: true }>(`/api/points/rewards/${id}`, { method: 'DELETE' });
