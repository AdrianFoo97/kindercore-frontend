import type React from 'react';
import { C } from './theme.js';

// Shared look for the Recruitment pop-ups (interview, offer, hire, notes…).
export const ISM = {
  backdrop: {
    position: 'fixed' as const, inset: 0, background: 'rgba(15,23,42,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 24,
  } as React.CSSProperties,
  card: {
    background: '#fff', borderRadius: 14, width: 'min(880px, 100%)',
    maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' as const,
    boxShadow: '0 24px 60px rgba(15,23,42,0.25)', overflow: 'hidden',
  } as React.CSSProperties,
  header: {
    padding: '16px 24px', borderBottom: '1px solid #f1f5f9',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  } as React.CSSProperties,
  headerIcon: {
    width: 36, height: 36, borderRadius: 8, background: '#eef2ff',
    color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 15,
  } as React.CSSProperties,
  title: { margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 } as React.CSSProperties,
  subtitle: { fontSize: 12, color: '#64748b', marginTop: 2 } as React.CSSProperties,
  closeBtn: {
    background: 'none', border: 'none', fontSize: 15, cursor: 'pointer',
    color: '#94a3b8', padding: '4px 6px',
  } as React.CSSProperties,

  summaryWrap: { padding: '16px 24px 0' } as React.CSSProperties,
  summary: {
    padding: '12px 16px', borderRadius: 10, border: '1px solid transparent',
    display: 'flex', alignItems: 'center', gap: 14,
  } as React.CSSProperties,
  summaryDate: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    background: '#fff', borderRadius: 8, padding: '6px 12px', border: '1px solid #e0f2fe',
    minWidth: 48, lineHeight: 1,
  } as React.CSSProperties,
  summaryDow: { fontSize: 10, fontWeight: 600, color: '#0284c7', textTransform: 'uppercase' } as React.CSSProperties,
  summaryDay: { fontSize: 20, fontWeight: 800, color: '#0c4a6e', lineHeight: 1.2 } as React.CSSProperties,
  summaryMonth: { fontSize: 9, fontWeight: 600, color: '#0284c7', textTransform: 'uppercase' } as React.CSSProperties,
  summaryTime: { fontSize: 14, fontWeight: 700, color: '#0c4a6e' } as React.CSSProperties,
  summaryFullDate: { fontSize: 11, color: '#0369a1', marginTop: 2 } as React.CSSProperties,
  clashCol: { marginLeft: 'auto', textAlign: 'right' as const, minWidth: 200, flexShrink: 0 } as React.CSSProperties,
  clashTitle: {
    fontSize: 11, fontWeight: 700, color: '#b45309', marginBottom: 3,
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5,
  } as React.CSSProperties,
  clashRow: { fontSize: 11, color: '#92400e' } as React.CSSProperties,

  body: { display: 'flex', padding: '16px 24px 20px', gap: 22, overflowY: 'auto' as const } as React.CSSProperties,
  leftCol: { flex: '0 0 330px', paddingRight: 22, borderRight: '1px solid #f1f5f9' } as React.CSSProperties,
  rightCol: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' as const } as React.CSSProperties,
  sectionLabel: {
    fontSize: 11, fontWeight: 700, color: '#334155', letterSpacing: '0.03em',
    textTransform: 'uppercase' as const, marginBottom: 10,
    display: 'flex', alignItems: 'center', gap: 7,
  } as React.CSSProperties,
  stepChip: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 18, height: 18, borderRadius: '50%',
    background: '#4f46e5', color: '#fff', fontSize: 10, fontWeight: 700,
  } as React.CSSProperties,
  dateInput: {
    display: 'block', width: '100%', padding: '8px 10px',
    border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13,
    fontFamily: 'inherit', boxSizing: 'border-box' as const,
    background: '#fff', color: '#1e293b',
  } as React.CSSProperties,
  slotGroupLabel: {
    fontSize: 10, fontWeight: 600, color: '#94a3b8',
    textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6,
  } as React.CSSProperties,
  slotGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 } as React.CSSProperties,
  slotBtn: {
    padding: '7px 0', fontSize: 11, fontWeight: 600, borderRadius: 7,
    cursor: 'pointer', border: 'none', outline: 'none',
    transition: 'all 0.12s ease',
  } as React.CSSProperties,

  editToggle: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 11, color: C.primary, fontWeight: 600, padding: 0,
    display: 'inline-flex', alignItems: 'center', gap: 4,
  } as React.CSSProperties,
  langSwitch: {
    display: 'inline-flex', borderRadius: 6,
    background: '#f1f5f9', padding: 2,
  } as React.CSSProperties,
  langBtn: {
    padding: '2px 11px', borderRadius: 5, fontSize: 11, fontWeight: 600,
    cursor: 'pointer', lineHeight: '18px', border: 'none',
    background: 'transparent', color: '#94a3b8',
  } as React.CSSProperties,
  msgMissing: {
    padding: '12px 14px', borderRadius: 10,
    background: '#fffbeb', border: '1px solid #fde68a',
    color: '#92400e', fontSize: 12, lineHeight: 1.6,
    height: 260, boxSizing: 'border-box' as const,
    overflowY: 'auto' as const,
  } as React.CSSProperties,
  // Legacy standalone preview + editor — still used by the Offer modal.
  msgPreview: {
    background: '#f8faf9', borderRadius: 10, padding: '12px 14px',
    fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' as const,
    overflowY: 'auto' as const, height: 260,
    border: '1px solid #e5e7eb', boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  msgEdit: {
    display: 'block', width: '100%', height: 260,
    resize: 'none' as const,
    padding: '11px 13px', border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const,
    lineHeight: 1.55, background: '#fff', color: '#1e293b',
    overflowY: 'auto' as const,
  } as React.CSSProperties,
  // Toolbar row for the message preview — lang tabs on the left, Edit
  // action on the right, sitting above the preview box.
  msgToolbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8, gap: 10,
  } as React.CSSProperties,
  resetLink: {
    background: 'none', border: 'none', padding: 0,
    color: C.muted, fontSize: 11, cursor: 'pointer',
    marginTop: 8, alignSelf: 'flex-start' as const,
    textDecoration: 'underline',
  } as React.CSSProperties,

  errorRow: {
    margin: '0 24px 12px', padding: '8px 12px', borderRadius: 8,
    background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
    fontSize: 12,
  } as React.CSSProperties,
  // Amber-toned pre-flight banner. Distinct from the red errorRow so
  // the admin reads it as "you need to do something first" rather
  // than "a save just failed".
  warnRow: {
    margin: '0 24px 12px', padding: '8px 12px', borderRadius: 8,
    background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e',
    fontSize: 12,
  } as React.CSSProperties,

  footer: {
    padding: '14px 24px', borderTop: '1px solid #e2e8f0',
    display: 'flex', alignItems: 'center', gap: 10, background: '#fafbfc',
  } as React.CSSProperties,
  cancelBtn: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
    cursor: 'pointer', fontSize: 13, color: '#64748b', fontWeight: 500,
    padding: '9px 16px',
  } as React.CSSProperties,
  saveBtn: {
    padding: '9px 20px', background: '#4f46e5', color: '#fff', border: 'none',
    borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
  } as React.CSSProperties,
  waBtn: {
    padding: '9px 16px', background: '#25D366', color: '#fff', border: 'none',
    borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none',
  } as React.CSSProperties,
};
