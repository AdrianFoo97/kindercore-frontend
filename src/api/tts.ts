import { apiFetch } from './client.js';

export interface SpeechClip {
  id: string;
  studentId: string;
  text: string;
  voiceId: string;
  filePath: string;
  sampleRate: number;
  createdAt: string;
  updatedAt: string;
}

/** The student's current attendance-greeting clip, or null if none generated yet. */
export function fetchStudentSpeech(studentId: string) {
  return apiFetch<{ clip: SpeechClip | null }>(`/api/students/${studentId}/speech`);
}

/** Generate (or regenerate) the student's greeting via ElevenLabs. */
export function generateStudentSpeech(studentId: string, text?: string) {
  return apiFetch<{ ok: true; clip: SpeechClip }>(`/api/students/${studentId}/speech`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}
