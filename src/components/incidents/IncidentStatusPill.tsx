import { INCIDENT_STATUS_LABEL, IncidentStatus } from '../../api/incidents.js';

// Status colours + pill for the admin incident pages (the list and a single
// report) — kept in one place so a status always looks the same in both.

export const INCIDENT_STATUSES: IncidentStatus[] = ['OPEN', 'PARENT_INFORMED', 'RESOLVED'];

export const INCIDENT_STATUS_LOOK: Record<IncidentStatus, { fg: string; bg: string; border: string }> = {
  OPEN: { fg: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
  PARENT_INFORMED: { fg: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  RESOLVED: { fg: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
};

export default function IncidentStatusPill({ status }: { status: IncidentStatus }) {
  const l = INCIDENT_STATUS_LOOK[status];
  return (
    <span style={{
      display: 'inline-block', padding: '2px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
      color: l.fg, background: l.bg, border: `1px solid ${l.border}`,
    }}>{INCIDENT_STATUS_LABEL[status]}</span>
  );
}
