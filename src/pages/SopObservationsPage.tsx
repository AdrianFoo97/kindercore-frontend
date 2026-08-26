import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faClipboardCheck } from '@fortawesome/free-solid-svg-icons';
import { fetchObservations, SopObservation, SopObservationStatus } from '../api/sop-observations.js';

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eef0f4',
  divider: '#f1f5f9',
  text: '#0f172a',
  textSub: '#475569',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
  primaryBorder: '#c7d2fe',
};
const RADIUS = 14;
const SHADOW = '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)';

const STATUS_META: Record<SopObservationStatus, { label: string; bg: string; fg: string }> = {
  PENDING_TRAINER: { label: 'Pending Trainer', bg: '#fef3c7', fg: '#92400e' },
  PENDING_ASSESSOR: { label: 'Pending Assessor', bg: '#ffedd5', fg: '#9a3412' },
  CERTIFIED: { label: 'Certified', bg: '#dcfce7', fg: '#065f46' },
};
const TAB_ORDER: (SopObservationStatus | 'ALL')[] = [
  'ALL', 'PENDING_TRAINER', 'PENDING_ASSESSOR', 'CERTIFIED',
];

function StatusPill({ status }: { status: SopObservationStatus }) {
  const meta = STATUS_META[status];
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, background: meta.bg, color: meta.fg,
    }}>{meta.label}</span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SopObservationsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<SopObservationStatus | 'ALL'>('ALL');

  const { data: observations = [], isLoading } = useQuery({
    queryKey: ['sop-observations', tab],
    queryFn: () => fetchObservations(tab === 'ALL' ? undefined : { status: tab }),
  });

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={s.heading}>Practice Observations</h1>
            <p style={s.subheading}>Run and certify staff observations against the How-To Guides library.</p>
          </div>
          <button onClick={() => navigate('/hr/sop-observations/new')} style={s.primaryBtn}>
            <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
            New Observation
          </button>
        </div>

        <div style={s.tabsCard}>
          <div style={s.tabsRow}>
            {TAB_ORDER.map(t => {
              const active = t === tab;
              const label = t === 'ALL' ? 'All' : STATUS_META[t].label;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    ...s.tab,
                    background: active ? C.primarySoft : 'transparent',
                    color: active ? C.primary : C.textSub,
                    borderColor: active ? C.primaryBorder : 'transparent',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={s.card}>
          {isLoading ? (
            <p style={{ padding: 32, textAlign: 'center', color: C.mutedSoft }}>Loading…</p>
          ) : observations.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <FontAwesomeIcon icon={faClipboardCheck} style={{ fontSize: 24, color: C.mutedSoft, marginBottom: 10 }} />
              <p style={{ margin: 0, fontSize: 13, color: C.muted }}>No observations in this view.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Teacher</th>
                    <th style={s.th}>How-To Guide</th>
                    <th style={s.th}>Trainer</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Last updated</th>
                  </tr>
                </thead>
                <tbody>
                  {observations.map(o => (
                    <tr key={o.id} onClick={() => navigate(`/hr/sop-observations/${o.id}`)} style={s.tr}>
                      <td style={s.td}>{o.teacherName}</td>
                      <td style={s.td}>{o.templateTitle}</td>
                      <td style={{ ...s.td, color: o.assignedTrainerName ? C.text : C.mutedSoft }}>{o.assignedTrainerName ?? 'Unassigned'}</td>
                      <td style={s.td}><StatusPill status={o.status} /></td>
                      <td style={{ ...s.td, color: C.mutedSoft }}>{fmtDate(o.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', background: C.bg, minHeight: '100vh', color: C.text },
  inner: { maxWidth: 1100, margin: '0 auto' },
  heading: { margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' },
  subheading: { margin: 0, fontSize: 13, color: C.muted },
  primaryBtn: {
    padding: '9px 16px', borderRadius: 10, border: 'none',
    background: C.primary, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  tabsCard: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS,
    padding: 8, marginBottom: 18, boxShadow: SHADOW,
  },
  tabsRow: { display: 'flex', gap: 6, flexWrap: 'wrap' as const },
  tab: {
    padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: '1px solid transparent', whiteSpace: 'nowrap',
  },
  card: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS,
    boxShadow: SHADOW, overflow: 'hidden',
  },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: {
    textAlign: 'left' as const, padding: '12px 20px', fontSize: 11, fontWeight: 700,
    color: C.mutedSoft, textTransform: 'uppercase' as const, letterSpacing: '0.04em',
    borderBottom: `1px solid ${C.divider}`,
  },
  tr: { cursor: 'pointer', borderBottom: `1px solid ${C.divider}` },
  td: { padding: '14px 20px', fontSize: 13.5, color: C.text },
};
