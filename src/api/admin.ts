import { apiFetch, ApiError } from './client.js';

// Mirror of RolloverSummary in kindercore-backend.

export interface RolloverPackageCreated {
  id: string;
  programme: string;
  age: number;
  price: number | null;
  name: string;
}

export interface RolloverStudentRolled {
  studentId: string;
  childName: string;
  fromPackage: string;
  toPackage: string;
}

export interface RolloverStudentGraduated {
  studentId: string;
  childName: string;
  fromPackage: string;
  age: number;
}

export interface RolloverStudentSkipped {
  studentId: string;
  childName: string;
  reason: string;
}

export interface RolloverSummary {
  targetYear: number;
  packagesCreated: RolloverPackageCreated[];
  rolledOver: RolloverStudentRolled[];
  graduated: RolloverStudentGraduated[];
  skipped: RolloverStudentSkipped[];
}

export function runYearRollover(year: number, dryRun = false) {
  return apiFetch<RolloverSummary>('/api/admin/year-rollover', {
    method: 'POST',
    body: JSON.stringify({ year, dryRun }),
  });
}

export interface RolloverUndoSummary {
  targetYear: number;
  reopened: { studentId: string; childName: string; restoredPackage: string }[];
  ungraduated: { studentId: string; childName: string; restoredPackage: string }[];
  skipped: { studentId: string; childName: string; reason: string }[];
}

export function undoYearRollover(year: number) {
  return apiFetch<RolloverUndoSummary>('/api/admin/year-rollover/undo', {
    method: 'POST',
    body: JSON.stringify({ year }),
  });
}

export interface RolloverRepairSummary {
  targetYear: number;
  fixed: { studentId: string; childName: string; fromPackage: string; toPackage: string }[];
  skipped: { studentId: string; childName: string; reason: string }[];
}

export function repairStuckRollovers(year: number, dryRun = false) {
  return apiFetch<RolloverRepairSummary>('/api/admin/year-rollover/repair', {
    method: 'POST',
    body: JSON.stringify({ year, dryRun }),
  });
}

// ── Database Design (live schema) ─────────────────────────────────────────
// Mirrors DbSchemaResponse in kindercore-backend's db-schema.controller.ts.

export interface DbColumn {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  defaultValue: string | null;
  extra: string;
}

export interface DbRelation {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  /** 'foreignKey' = enforced by MySQL; 'inferred' = guessed from an `…Id` column name. */
  kind: 'foreignKey' | 'inferred';
}

export interface DbTable {
  name: string;
  approxRows: number;
  columns: DbColumn[];
}

export interface DbSchema {
  database: string;
  readAt: string;
  tables: DbTable[];
  relations: DbRelation[];
}

export function fetchDbSchema() {
  return apiFetch<DbSchema>('/api/admin/db-schema');
}

// ── Backend Architecture (generated from the backend source) ───────────────
// Mirrors Architecture in kindercore-backend's src/architecture/analyze.ts.

export interface ArchEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  middleware: string[];
  handler: string;
  controller: string | null;
}

export interface ArchRouteGroup {
  id: string;
  mount: string;
  endpoints: ArchEndpoint[];
}

export interface ArchModule {
  id: string;
  services: string[];
  controllers: string[];
  tables: string[];
}

export interface BackendArchitecture {
  routeGroups: ArchRouteGroup[];
  controllers: ArchModule[];
  services: ArchModule[];
  tables: string[];
}

export function fetchBackendArchitecture() {
  return apiFetch<BackendArchitecture>('/api/admin/architecture');
}

// ── Attendance reader key (Settings → Attendance Reader) ───────────────────
// Mirrors ReaderKeyStatus in kindercore-backend's readerKey.service.ts.

export interface ReaderKeyStatus {
  configured: boolean;
  source: 'env' | 'settings' | null;
  hint: string | null;
  createdAt: string | null;
}

export function fetchReaderKeyStatus() {
  return apiFetch<ReaderKeyStatus>('/api/admin/attendance-reader');
}

/** Returns the new key in plain text — the only time it is ever shown. */
export function generateReaderKey() {
  return apiFetch<{ key: string; status: ReaderKeyStatus }>('/api/admin/attendance-reader/key', { method: 'POST' });
}

export function clearReaderKey() {
  return apiFetch<ReaderKeyStatus>('/api/admin/attendance-reader/key', { method: 'DELETE' });
}

/** Full URL the RFID readers should post scans to. */
export function attendanceScanUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL || window.location.origin;
  return `${base.replace(/\/$/, '')}/api/attendance/scan`;
}

// ── Test runner (Admin → Test Catalog "Run" buttons) ──────────────────────
// TEST ENVIRONMENT ONLY: the backend answers 404 unless TEST_RUNNER_ENABLED
// is set on that server, which fetchTestRunner turns into `null` (= hide
// all run controls). Mirrors TestRunState in testRunner.service.ts.

export type TestRunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
export type TestRunScope =
  | { kind: 'all' }
  | { kind: 'file'; file: string };

export interface TestRun {
  id: string;
  scope: TestRunScope;
  status: 'running' | 'passed' | 'failed' | 'error';
  startedAt: string;
  finishedAt: string | null;
  /** Keyed `${file}::${testName}`. */
  results: Record<string, TestRunStatus>;
  /** How long each finished test took, in ms. */
  durations: Record<string, number>;
  failures: Record<string, string>;
  runningFiles: string[];
  totals: { passed: number; failed: number; skipped: number };
  error: string | null;
}

export interface TestRunnerInfo { enabled: true; files: string[]; run: TestRun | null }

export async function fetchTestRunner(): Promise<TestRunnerInfo | null> {
  try {
    return await apiFetch<TestRunnerInfo>('/api/admin/test-runner');
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null; // not a test environment
    throw e;
  }
}

export function startTestRun(scope: TestRunScope) {
  return apiFetch<TestRun>('/api/admin/test-runner/runs', { method: 'POST', body: JSON.stringify({ scope }) });
}
