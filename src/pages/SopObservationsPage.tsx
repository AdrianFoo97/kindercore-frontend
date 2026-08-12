import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faTimes, faMagnifyingGlass, faClipboardCheck, faCircleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { fetchTeachers } from '../api/planner.js';
import { fetchPositions } from '../api/salary.js';
import { fetchTemplates } from '../api/sop-templates.js';
import {
  fetchObservations, createObservation, SopObservation, SopObservationStatus,
} from '../api/sop-observations.js';
import { useToast } from '../components/common/Toast.js';

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
  PENDING_TRAINEE: { label: 'Pending Trainee', bg: '#f1f5f9', fg: '#475569' },
  PENDING_TRAINER: { label: 'Pending Trainer', bg: '#fef3c7', fg: '#92400e' },
  PENDING_ASSESSOR: { label: 'Pending Assessor', bg: '#ffedd5', fg: '#9a3412' },
  PENDING_FOLLOWUP_1: { label: 'Pending Follow-up 1', bg: '#e0e7ff', fg: '#4338ca' },
  PENDING_FOLLOWUP_2: { label: 'Pending Follow-up 2', bg: '#e0e7ff', fg: '#4338ca' },
  CERTIFIED: { label: 'Certified', bg: '#dcfce7', fg: '#065f46' },
};
const TAB_ORDER: (SopObservationStatus | 'ALL')[] = [
  'ALL', 'PENDING_TRAINEE', 'PENDING_TRAINER', 'PENDING_ASSESSOR',
  'PENDING_FOLLOWUP_1', 'PENDING_FOLLOWUP_2', 'CERTIFIED',
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
  const [newModalOpen, setNewModalOpen] = useState(false);

  const { data: observations = [], isLoading } = useQuery({
    queryKey: ['sop-observations', tab],
    queryFn: () => fetchObservations(tab === 'ALL' ? undefined : { status: tab }),
  });

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={s.heading}>SOP Observations</h1>
            <p style={s.subheading}>Run and certify staff observations against the SOP library.</p>
          </div>
          <button onClick={() => setNewModalOpen(true)} style={s.primaryBtn}>
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
                    <th style={s.th}>SOP</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Last updated</th>
                  </tr>
                </thead>
                <tbody>
                  {observations.map(o => (
                    <tr key={o.id} onClick={() => navigate(`/hr/sop-observations/${o.id}`)} style={s.tr}>
                      <td style={s.td}>{o.teacherName}</td>
                      <td style={s.td}>{o.templateTitle}</td>
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

      {newModalOpen && (
        <NewObservationModal
          onCancel={() => setNewModalOpen(false)}
          onCreated={(id) => navigate(`/hr/sop-observations/${id}`)}
        />
      )}
    </div>
  );
}

function NewObservationModal({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const { showToast } = useToast();
  const qc = useQueryClient();
  const { data: teachers = [] } = useQuery({ queryKey: ['planner-teachers'], queryFn: fetchTeachers });
  const { data: positions = [] } = useQuery({ queryKey: ['salary-positions'], queryFn: fetchPositions });

  const [search, setSearch] = useState('');
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [sopTemplateId, setSopTemplateId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const activeTeachers = teachers.filter((t: any) => !t.resignedAt);
  const filteredTeachers = search.trim()
    ? activeTeachers.filter((t: any) => t.name.toLowerCase().includes(search.trim().toLowerCase()))
    : activeTeachers;

  const selectedTeacher = teachers.find((t: any) => t.id === teacherId) ?? null;
  const positionName = selectedTeacher?.positionId
    ? positions.find(p => p.positionId === selectedTeacher.positionId)?.name ?? null
    : null;

  // The SOP library is a flat, org-wide list — not scoped to the selected
  // teacher's position (many SOPs apply to everyone).
  const { data: templates = [] } = useQuery({ queryKey: ['sop-templates'], queryFn: () => fetchTemplates() });

  const submit = async () => {
    if (!teacherId || !sopTemplateId) return;
    setCreating(true);
    try {
      const obs = await createObservation({ teacherId, sopTemplateId });
      qc.invalidateQueries({ queryKey: ['sop-observations'] });
      onCreated(obs.id);
    } catch (e: any) {
      showToast(e?.message ?? 'Could not start observation', 'error');
    } finally {
      setCreating(false);
    }
  };

  return ReactDOM.createPortal(
    <div style={modalS.overlay} onClick={onCancel}>
      <div style={modalS.dialog} onClick={e => e.stopPropagation()}>
        <div style={modalS.header}>
          <h2 style={modalS.title}>New Observation</h2>
          <button onClick={onCancel} style={modalS.closeBtn} aria-label="Close">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div style={modalS.body}>
          <div style={modalS.field}>
            <label style={modalS.label}>Teacher</label>
            {!teacherId ? (
              <>
                <div style={{ position: 'relative' }}>
                  <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 12, top: 12, fontSize: 12, color: C.mutedSoft }} />
                  <input
                    autoFocus
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name…"
                    style={{ ...modalS.input, paddingLeft: 32 }}
                  />
                </div>
                <div style={modalS.pickList}>
                  {filteredTeachers.slice(0, 8).map((t: any) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { setTeacherId(t.id); setSopTemplateId(null); }}
                      style={modalS.pickRow}
                    >
                      {t.name}
                    </button>
                  ))}
                  {filteredTeachers.length === 0 && (
                    <div style={{ padding: '10px 12px', fontSize: 12, color: C.mutedSoft }}>No teachers match.</div>
                  )}
                </div>
              </>
            ) : (
              <div style={modalS.selectedChip}>
                <span>{selectedTeacher?.name}{positionName ? ` · ${positionName}` : ''}</span>
                <button type="button" onClick={() => { setTeacherId(null); setSopTemplateId(null); }} style={modalS.chipClear}>
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
            )}
          </div>

          {teacherId && (
            <div style={modalS.field}>
              <label style={modalS.label}>SOP</label>
              {templates.length === 0 ? (
                <p style={{ fontSize: 12, color: C.mutedSoft, margin: 0 }}>No SOPs configured yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {templates.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSopTemplateId(t.id)}
                      style={{
                        ...modalS.pickRow,
                        border: `1px solid ${sopTemplateId === t.id ? C.primary : C.cardBorder}`,
                        background: sopTemplateId === t.id ? C.primarySoft : '#fff',
                        color: sopTemplateId === t.id ? C.primary : C.text,
                        fontWeight: sopTemplateId === t.id ? 700 : 500,
                      }}
                    >
                      {t.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={modalS.footer}>
          <button onClick={onCancel} style={modalS.cancelBtn}>Cancel</button>
          <button
            onClick={submit}
            disabled={!teacherId || !sopTemplateId || creating}
            style={{ ...modalS.saveBtn, opacity: (!teacherId || !sopTemplateId || creating) ? 0.5 : 1 }}
          >
            {creating ? 'Starting…' : 'Start Observation'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
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

const modalS: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.42)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  dialog: {
    background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480,
    boxShadow: '0 24px 60px rgba(15,23,42,0.25)',
    maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '20px 24px 14px', borderBottom: `1px solid ${C.divider}`, gap: 12,
  },
  title: { margin: 0, fontSize: 17, fontWeight: 700, color: C.text },
  closeBtn: {
    width: 32, height: 32, borderRadius: 8, border: 'none',
    background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 14,
  },
  body: { padding: '20px 24px', overflowY: 'auto', flex: 1 },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: C.textSub, marginBottom: 6, letterSpacing: '0.01em' },
  input: {
    width: '100%', padding: '10px 12px', fontSize: 13,
    border: `1px solid ${C.cardBorder}`, borderRadius: 8,
    outline: 'none', color: C.text, boxSizing: 'border-box',
  },
  pickList: {
    marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4,
    maxHeight: 220, overflowY: 'auto',
  },
  pickRow: {
    textAlign: 'left' as const, padding: '9px 12px', borderRadius: 8,
    border: `1px solid ${C.cardBorder}`, background: '#fff', color: C.text,
    fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
  },
  selectedChip: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.primaryBorder}`,
    background: C.primarySoft, color: C.primary, fontSize: 13, fontWeight: 600,
  },
  chipClear: {
    border: 'none', background: 'transparent', color: C.primary, cursor: 'pointer', fontSize: 12,
  },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 10,
    padding: '14px 24px 20px', borderTop: `1px solid ${C.divider}`,
  },
  cancelBtn: {
    padding: '10px 18px', borderRadius: 10, border: `1px solid ${C.cardBorder}`,
    background: '#fff', color: C.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  saveBtn: {
    padding: '10px 18px', borderRadius: 10, border: 'none',
    background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
};
