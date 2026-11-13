import type React from 'react';

// Colours and small button styles shared by the Shopping List page and its rows.

export const C = {
  bg: '#f8fafc', card: '#ffffff', border: '#e2e8f0', text: '#0f172a', sub: '#334155',
  muted: '#64748b', mutedSoft: '#64748b', primary: '#5a67d8', primarySoft: '#eef2ff', green: '#047857', greenSoft: '#ecfdf5',
  amber: '#b45309', amberSoft: '#fffbeb',
};

export function btn(bg: string, fg: string, small = false): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: small ? '5px 10px' : '8px 13px', borderRadius: 8, border: 'none',
    background: bg, color: fg, fontSize: small ? 12 : 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
  };
}

export function iconBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', flexShrink: 0,
    color: disabled ? '#cbd5e1' : C.sub, cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}

export const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 12, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px',
};
