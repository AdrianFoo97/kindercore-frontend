import type React from 'react';

// Filter bar styling for the onboarding pages (students and staff) — one
// floating card of chip rows, so every filter dimension reads as a sibling.

export const toolbarCard: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 14,
  padding: '12px 14px', marginBottom: 16,
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 14,
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

export const filterRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  overflowX: 'auto', WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none', msOverflowStyle: 'none',
};

export const filterLabel: React.CSSProperties = {
  fontSize: 11, color: '#94a3b8', fontWeight: 600,
  whiteSpace: 'nowrap', textTransform: 'uppercase',
  letterSpacing: '0.06em', minWidth: 64,
};

export const clearFiltersBtn: React.CSSProperties = {
  marginLeft: 'auto',
  padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
  cursor: 'pointer', border: 'none', background: 'none', color: '#94a3b8',
  whiteSpace: 'nowrap', flexShrink: 0,
  display: 'flex', alignItems: 'center', gap: 5,
};

export function chipStyle(active: boolean, color: string, bg: string, muted: boolean): React.CSSProperties {
  return {
    padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', border: '1px solid', transition: 'all 0.12s',
    whiteSpace: 'nowrap', flexShrink: 0,
    background: active ? color : muted ? '#f8fafc' : bg,
    color: active ? '#fff' : muted ? '#cbd5e1' : color,
    borderColor: active ? color : 'transparent',
    display: 'flex', alignItems: 'center', gap: 6,
  };
}

export function chipCount(active: boolean, color: string, muted = false): React.CSSProperties {
  return {
    fontSize: 11, fontWeight: 700,
    padding: '0 6px', borderRadius: 8,
    background: active ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.06)',
    color: active ? '#fff' : muted ? '#cbd5e1' : color,
    fontVariantNumeric: 'tabular-nums',
  };
}
