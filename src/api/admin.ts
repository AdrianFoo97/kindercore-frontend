import { apiFetch } from './client.js';

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
