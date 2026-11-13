import type React from 'react';
import { TEACHER_CONTENT_TOP } from '../../components/common/TeacherTopBar.js';
import type { StatusTone } from './mySuggestions.js';

// Look of the "My guide ideas" pages — violet + Segoe in the teacher app
// (like the other guide pages there), indigo + system font on desktop.

export const C = {
  bg: '#f8fafc', card: '#ffffff', border: '#e2e8f0', text: '#0f172a', body: '#334155', muted: '#64748b',
  good: '#047857', goodSoft: '#ecfdf5', no: '#b91c1c', noSoft: '#fef2f2', review: '#1d4ed8', reviewSoft: '#eff6ff', action: '#b45309', actionSoft: '#fffbeb',
};
const TEACHER = { accent: '#7c3aed', soft: '#f5f3ff', font: '"Segoe UI", Roboto, Arial, sans-serif' };
const ADMIN = { accent: '#5a67d8', soft: '#eef2ff', font: 'system-ui, -apple-system, "Segoe UI", sans-serif' };

export function theme(teacher: boolean) { return teacher ? TEACHER : ADMIN; }

export function pageStyle(teacher: boolean, isMobile: boolean): React.CSSProperties {
  return {
    // TEACHER_CONTENT_TOP is a CSS expression (clears the floating teacher top bar) — used as-is.
    padding: isMobile ? '16px 16px 32px' : '32px 32px 48px',
    ...(isMobile && teacher ? { paddingTop: TEACHER_CONTENT_TOP } : {}),
    fontFamily: theme(teacher).font, color: C.text, background: C.bg, minHeight: '100%',
  };
}

export const TONE: Record<StatusTone, { fg: string; bg: string }> = {
  review: { fg: C.review, bg: C.reviewSoft },
  action: { fg: C.action, bg: C.actionSoft },
  good: { fg: C.good, bg: C.goodSoft },
  no: { fg: C.no, bg: C.noSoft },
};

export const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 };
export const sectionLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' };
