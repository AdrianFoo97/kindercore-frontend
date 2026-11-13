import type React from 'react';
import type { TemplateStatus } from '../../../api/appraisal-templates.js';

// Colours and small styles shared by the Appraisal Forms list and editor
// (admin palette: slate + indigo).

export const C = {
  bg: '#f8fafc', card: '#ffffff', border: '#e2e8f0', borderStrong: '#cbd5e1', text: '#0f172a', sub: '#334155', muted: '#64748b',
  primary: '#5a67d8', primarySoft: '#eef2ff', green: '#047857', greenSoft: '#ecfdf5', amber: '#b45309', amberSoft: '#fffbeb',
  red: '#b91c1c', redSoft: '#fef2f2',
};

export const STATUS_TONE: Record<TemplateStatus, { fg: string; bg: string }> = {
  ACTIVE: { fg: C.green, bg: C.greenSoft },
  DRAFT: { fg: C.amber, bg: C.amberSoft },
  RETIRED: { fg: C.muted, bg: '#f1f5f9' },
};

export const card: React.CSSProperties = {
  background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, marginBottom: 16,
};

export const cardTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: C.text, margin: 0 };
export const cardHint: React.CSSProperties = { fontSize: 13, color: C.muted, margin: '4px 0 16px', lineHeight: 1.5 };

export const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: 4 };

export const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 12px', fontSize: 14, color: C.text, background: '#fff',
  border: `1px solid ${C.borderStrong}`, borderRadius: 8, fontFamily: 'inherit', outline: 'none',
};

/** A % weight box: narrow, right-aligned digits. */
export const weightInput: React.CSSProperties = { ...input, width: 72, textAlign: 'right', padding: '6px 8px' };

/** Button look. Pass `disabled` so it dims with a normal arrow cursor (house rule: never not-allowed). */
export function btn(kind: 'primary' | 'secondary' | 'danger' | 'ghost', small = false, disabled = false): React.CSSProperties {
  const tone = {
    primary: { background: C.primary, color: '#fff', border: `1px solid ${C.primary}` },
    secondary: { background: '#fff', color: C.sub, border: `1px solid ${C.borderStrong}` },
    danger: { background: '#fff', color: C.red, border: `1px solid #fecaca` },
    ghost: { background: 'none', color: C.primary, border: '1px solid transparent' },
  }[kind];
  return {
    ...tone, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8,
    padding: small ? '4px 8px' : '8px 16px', minHeight: small ? 28 : 36, fontSize: small ? 13 : 14, fontWeight: 600,
    fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: disabled ? 0.55 : 1,
  };
}

export const iconBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 8, border: 'none', background: 'none', color: C.muted, flexShrink: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13,
};

export function pill(fg: string, bg: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: fg, background: bg, whiteSpace: 'nowrap' };
}
