import { apiFetch } from './client.js';
import type { MissionDifficulty } from './career-missions.js';

// Settings → Career missions → Import with AI (backend missionImport).

export interface PreviewCategory {
  key: string;
  name: string;
  achievementName: string;
  description: string | null;
  code: string;
  icon: string;
  color: string;
  /** Already a category with this name — nothing to create. */
  existingCode: string | null;
}

export interface PreviewMission {
  key: string;
  title: string;
  positionId: string | null;
  /** What the file said, when it didn't match a position. */
  positionText: string | null;
  categoryCode: string | null;
  description: string | null;
  whyItMatters: string | null;
  evidenceRequirements: string | null;
  difficulty: MissionDifficulty;
  required: boolean;
  highPriority: boolean;
  /** A mission with this title already exists for that position. */
  duplicate: boolean;
}

export interface MissionImportPreview {
  fileName: string;
  provider: string;
  model: string;
  categories: PreviewCategory[];
  missions: PreviewMission[];
}

export interface MissionImportBody {
  categories: { code: string; name: string; achievementName: string; description: string | null; icon: string; color: string }[];
  missions: {
    positionId: string; title: string; category: string; description: string | null; whyItMatters: string | null;
    evidenceRequirements: string | null; difficulty: MissionDifficulty; required: boolean; highPriority: boolean;
  }[];
}

/** The server's code when the AI couldn't read the file. */
export const AI_FAILED = 'AI_FAILED';

/** A file as base64 — sent inside JSON, since the live server's firewall blocks file uploads. */
async function fileAsBase64(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Couldn’t open that file.'));
    reader.readAsDataURL(file);
  });
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

/** The AI reads the Excel or PDF file into a preview. Saves nothing. */
export async function readMissionFile(file: File): Promise<MissionImportPreview> {
  return apiFetch<MissionImportPreview>('/api/career-missions/import/read', {
    method: 'POST',
    body: JSON.stringify({ fileName: file.name, fileBase64: await fileAsBase64(file) }),
  });
}

const REVOKE_DELAY_MS = 1000;

/** How the server says a file was read straight from the template (no AI). */
export const FROM_TEMPLATE = 'template';

/** Download the no-AI template (built by the server with today's positions and categories). */
export async function downloadMissionTemplate(): Promise<void> {
  const { fileName, fileBase64 } = await apiFetch<{ fileName: string; fileBase64: string }>('/api/career-missions/import/template');
  const bytes = Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  // Released a moment later — some browsers (Safari, Firefox) cancel a download whose link is revoked at once.
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

export function applyMissionImport(body: MissionImportBody) {
  return apiFetch<{ categories: number; missions: number }>('/api/career-missions/import/apply', { method: 'POST', body: JSON.stringify(body) });
}
