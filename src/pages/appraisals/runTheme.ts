import type React from 'react';
import type { RunStatus } from '../../api/appraisal-runs.js';

// Looks for an appraisal and the appraisal schedule. The appraisal page is
// opened from the admin site (slate + indigo, system font) and from the
// teacher app (violet, Nunito), so its accent and font follow where it's open.

export interface RunPalette {
  bg: string; card: string; border: string; borderStrong: string; text: string; sub: string; muted: string;
  accent: string; accentSoft: string; green: string; greenSoft: string; amber: string; amberSoft: string; red: string; redSoft: string;
  font: string;
}

const BASE = {
  bg: '#f8fafc', card: '#ffffff', border: '#e2e8f0', borderStrong: '#cbd5e1', text: '#0f172a', sub: '#334155', muted: '#64748b',
  green: '#047857', greenSoft: '#ecfdf5', amber: '#b45309', amberSoft: '#fffbeb', red: '#b91c1c', redSoft: '#fef2f2',
};

export const ADMIN: RunPalette = { ...BASE, accent: '#5a67d8', accentSoft: '#eef2ff', font: 'system-ui, sans-serif' };
export const TEACHER: RunPalette = { ...BASE, accent: '#7c3aed', accentSoft: '#f5f3ff', font: 'Nunito, system-ui, sans-serif' };

/** Tap targets: 44px on a phone, 32px on a desktop. */
export const TARGET = { mobile: 44, desktop: 32 };

export function statusTone(p: RunPalette, s: RunStatus): { fg: string; bg: string } {
  if (s === 'COMPLETED') return { fg: p.green, bg: p.greenSoft };
  if (s === 'SENT_BACK') return { fg: p.red, bg: p.redSoft };
  if (s === 'IN_PROGRESS') return { fg: p.accent, bg: p.accentSoft };
  return { fg: p.amber, bg: p.amberSoft };
}

export function pill(fg: string, bg: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: fg, background: bg, whiteSpace: 'nowrap' };
}

export const card = (p: RunPalette): React.CSSProperties => ({ background: p.card, border: `1px solid ${p.border}`, borderRadius: 12, padding: 16, marginBottom: 16 });

/** Button look; disabled dims with a normal arrow cursor (house rule). */
export function button(p: RunPalette, kind: 'primary' | 'secondary' | 'danger' | 'ghost', opts: { disabled?: boolean; mobile?: boolean; small?: boolean } = {}): React.CSSProperties {
  const tone = {
    primary: { background: p.accent, color: '#fff', border: `1px solid ${p.accent}` },
    secondary: { background: '#fff', color: p.sub, border: `1px solid ${p.borderStrong}` },
    danger: { background: '#fff', color: p.red, border: '1px solid #fecaca' },
    ghost: { background: 'none', color: p.accent, border: '1px solid transparent' },
  }[kind];
  const height = opts.small ? (opts.mobile ? TARGET.mobile : 28) : (opts.mobile ? TARGET.mobile : 36);
  return {
    ...tone, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8,
    padding: opts.small ? '4px 12px' : '8px 16px', minHeight: height, fontSize: opts.small ? 13 : 14, fontWeight: 600,
    fontFamily: 'inherit', cursor: opts.disabled ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: opts.disabled ? 0.55 : 1,
  };
}
