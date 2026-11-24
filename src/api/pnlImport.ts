import { ApiError, apiFetch } from './client.js';

// Finance → Operating Costs → Import P&L (backend pnlImport.service).

export type SectionKind = 'REVENUE' | 'COST_OF_SALES' | 'OTHER_INCOME' | 'EXPENSE';
export type LineStatus = 'MATCHED' | 'SUGGESTED' | 'NEW' | 'SKIP_RULE' | 'NOT_A_COST' | 'ZERO' | 'NEGATIVE';

export interface PreviewLine {
  key: string;
  section: string;
  sectionKind: SectionKind;
  name: string;
  amount: number;
  /** The amount was found printed in the PDF. */
  found: boolean;
  /** What the PDF's own text says for this line when it differs from the AI's reading (else null). */
  textAmount: number | null;
  status: LineStatus;
  categoryId: string | null;
}

export interface PreviewSection {
  title: string;
  kind: SectionKind;
  sum: number;
  printedSubtotal: number | null;
  addsUp: boolean | null;
}

export interface ImportCategory { id: string; name: string; groupId: string; groupName: string }

export interface ImportPreview {
  fileName: string;
  period: { year: number; month: number }; // month 1-12
  provider: string;
  model: string;
  instructionsVersion: number;
  /** Why the backup provider read it (null = the main one did). */
  backupReason: string | null;
  hasText: boolean;
  /** The PDF contains wording aimed at an AI — a person must check it. */
  injectionSuspected: boolean;
  sections: PreviewSection[];
  lines: PreviewLine[];
  existing: Record<string, number>;
  categories: ImportCategory[];
  groups: { id: string; name: string }[];
}

export interface ApplyLine {
  name: string;
  section: string;
  amount: number;
  action: 'RECORD' | 'SKIP';
  categoryId: string | null;
  byRule?: boolean;
  replace?: boolean;
  remember?: boolean;
}

export interface ApplyBody {
  year: number;
  month: number;
  fileName: string;
  provider: string;
  model: string;
  instructionsVersion: number;
  lines: ApplyLine[];
  newCategories: { tempId: string; name: string; groupId: string }[];
}

export interface ImportNotice {
  id: string;
  fileName: string;
  importedByName: string;
  createdAt: string;
  recordedCount: number;
  recordedTotal: number;
  notImported: { name: string; section: string; amount: number; reason: string }[];
}

export function fetchImportStatus() {
  return apiFetch<{ available: boolean; provider: string | null; model: string | null }>('/api/operating-cost/import/status');
}

/** The server's code when the AI couldn't read the file — the page then offers to read it without AI. */
export const AI_FAILED = 'AI_FAILED';

/**
 * A PDF as the JSON the server reads it from. Sent as base64 in JSON, not as a
 * file upload: the live server's host (Hostinger) has a firewall that answers a
 * PDF file upload with a bare 403 before it reaches the app.
 */
export async function pdfAsJson(file: File): Promise<{ fileName: string; pdfBase64: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new ApiError('Couldn’t open that file.', 0, 'FILE_READ'));
    reader.readAsDataURL(file);
  });
  return { fileName: file.name, pdfBase64: dataUrl.slice(dataUrl.indexOf(',') + 1) };
}

/** Sends the PDF to be read and checked. Saves nothing. `withoutAi`: read its printed text instead of asking the AI. */
export async function readPnl(file: File, opts: { withoutAi?: boolean } = {}): Promise<ImportPreview> {
  return apiFetch<ImportPreview>('/api/operating-cost/import/read', {
    method: 'POST',
    body: JSON.stringify({ ...(await pdfAsJson(file)), ...(opts.withoutAi ? { withoutAi: true } : {}) }),
  });
}

export function applyPnlImport(body: ApplyBody) {
  return apiFetch<{ importId: string; recordedCount: number; recordedTotal: number; notImportedCount: number }>(
    '/api/operating-cost/import/apply', { method: 'POST', body: JSON.stringify(body) },
  );
}

/** `month` is 0-11, as the Operating Costs page. */
export function fetchImportNotices(year: number, month: number) {
  return apiFetch<ImportNotice[]>(`/api/operating-cost/import/notices?year=${year}&month=${month}`);
}

export function dismissImportNotice(id: string) {
  return apiFetch<void>(`/api/operating-cost/import/notices/${encodeURIComponent(id)}/dismiss`, { method: 'POST' });
}

// ── Settings → Operating cost → Import rules (admins) ─────────────────────────

export interface ImportRule {
  id: string;
  lineName: string;
  action: 'RECORD' | 'SKIP';
  categoryId: string | null;
  categoryName: string | null;
  groupName: string | null;
  updatedAt: string;
}

const RULES = '/api/operating-cost/import/rules';
export const fetchImportRules = () => apiFetch<ImportRule[]>(RULES);
export const addImportRule = (r: { lineName: string; action: 'RECORD' | 'SKIP'; categoryId: string | null }) =>
  apiFetch<ImportRule[]>(RULES, { method: 'POST', body: JSON.stringify(r) });
export const changeImportRule = (id: string, r: { action: 'RECORD' | 'SKIP'; categoryId: string | null }) =>
  apiFetch<ImportRule[]>(`${RULES}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(r) });
export const deleteImportRule = (id: string) => apiFetch<ImportRule[]>(`${RULES}/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** One past import (Operating Costs → Import history). `month` is 0-11. */
export interface ImportHistoryItem {
  id: string;
  year: number;
  month: number;
  fileName: string;
  provider: string;
  model: string;
  importedByName: string;
  createdAt: string;
  recordedCount: number;
  recordedTotal: number;
  notImported: { name: string; section: string; amount: number; reason: string }[];
  dismissedAt: string | null;
}

export const fetchImportHistory = () => apiFetch<ImportHistoryItem[]>('/api/operating-cost/import/history');

/** Server code when the chosen category already has an amount that month — ask: replace or add? */
export const HAS_AMOUNT = 'HAS_AMOUNT';

/** Records one line an import left out. Throws ApiError(HAS_AMOUNT, body.existingAmount) when the month already has an amount there and no choice was given. */
export function recordNotRecordedLine(importId: string, body: { index: number; name: string; categoryId: string; existing?: 'replace' | 'add'; remember?: boolean }) {
  return apiFetch<{ ok: true }>(`/api/operating-cost/import/notices/${encodeURIComponent(importId)}/record`, { method: 'POST', body: JSON.stringify(body) });
}
