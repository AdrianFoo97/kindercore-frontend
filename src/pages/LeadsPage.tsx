import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchLeads, updateLead, deleteLead, fetchTrashedLeads, restoreLead, permanentDeleteLead, createAppointment, confirmAppointment, confirmAppointmentNoCalendar, fetchUpcomingAppointments, fetchLeadStats, UpcomingAppointment, UpdateLeadPayload } from '../api/leads.js';
import { fetchSettings } from '../api/settings.js';
import { getConnectToken } from '../api/google.js';
import { fetchPackages, fetchPackageYears } from '../api/packages.js';
import { createStudent } from '../api/students.js';
import { Lead, LeadStatus, LeadsResponse, Package } from '../types/index.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { useDeleteDialog } from '../components/common/DeleteDialog.js';
import { useToast } from '../components/common/Toast.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDays, faCircleCheck, faClock, faEnvelope, faGraduationCap, faXmark, faTrash, faPen, faTriangleExclamation, faArrowUpRightFromSquare, faCircleXmark, faMagnifyingGlass, faPhone, faCopy, faNoteSticky, faChevronLeft, faChevronRight, faFire, faSun, faSnowflake, faBolt, faScaleBalanced, faFilter, faArrowRight, faPerson, faPersonDress, faUser } from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';

const STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'APPOINTMENT_BOOKED', 'FOLLOW_UP', 'ENROLLED', 'LOST', 'REJECTED'];

function RelationshipIcon({ relationship }: { relationship?: string | null }) {
  if (!relationship) return null;
  const r = relationship.toLowerCase();
  const isMother = r.includes('mother') || r.includes('妈') || r.includes('母');
  const isFather = r.includes('father') || r.includes('爸') || r.includes('父');
  const icon = isMother ? faPersonDress : isFather ? faPerson : faUser;
  const color = isMother ? '#ec4899' : isFather ? '#3b82f6' : '#94a3b8';
  return <span title={relationship} style={{ cursor: 'default', color, fontSize: 10 }}><FontAwesomeIcon icon={icon} /></span>;
}
const currentYear = new Date().getFullYear();
const ENROLMENT_YEARS = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
type SortField = 'submittedAt' | 'childName' | 'childDob' | 'enrolmentYear' | 'status' | 'intent';
type SortOrder = 'asc' | 'desc';
type PipelineStage = 'all_active' | 'NEW' | 'CONTACTED' | 'APPOINTMENT_BOOKED' | 'FOLLOW_UP' | 'ENROLLED' | 'LOST' | 'REJECTED' | 'TRASH';

// ── Helpers ────────────────────────────────────────────────────────────────────

const CTA_SOURCE_LABELS: Record<string, string> = {
  final: '整个页面', courses: '课程详情', methods: '学习方式', story: '故事部分', hero: '顶部',
};

function getLeadHeat(ctaSource: string | null): { level: number; label: string; color: string; bg: string; icon: typeof faFire | null; tooltip: string } {
  const sourceOrder: Record<string, number> = {
    hero: 1, story: 2, methods: 3, courses: 4, final: 5,
  };
  const score = sourceOrder[ctaSource || ''] || 0;
  const section = CTA_SOURCE_LABELS[ctaSource || ''] || '';
  if (score >= 4) return { level: 3, label: 'Hot', color: '#ef4444', bg: '#fef2f2', icon: faFire, tooltip: 'Hot Lead' };
  if (score >= 2) return { level: 2, label: 'Warm', color: '#f59e0b', bg: '#fffbeb', icon: faSun, tooltip: 'Warm Lead' };
  if (score >= 1) return { level: 1, label: 'Cold', color: '#60a5fa', bg: '#eff6ff', icon: faSnowflake, tooltip: 'Cold Lead' };
  return { level: 0, label: '', color: '', bg: '', icon: null, tooltip: '' };
}

function calcClassAge(dob: string, enrolmentYear: number): number {
  return enrolmentYear - new Date(dob).getFullYear();
}

function classAgeBadgeStyle(age: number): React.CSSProperties {
  const palette: Record<number, { bg: string; color: string }> = {
    2: { bg: '#fed7e2', color: '#97266d' },
    3: { bg: '#feebc8', color: '#c05621' },
    4: { bg: '#fefcbf', color: '#744210' },
    5: { bg: '#c6f6d5', color: '#276749' },
    6: { bg: '#bee3f8', color: '#2c5282' },
  };
  const { bg, color } = palette[age] ?? { bg: '#e2e8f0', color: '#4a5568' };
  return { display: 'inline-block', padding: '1px 7px', background: bg, color, borderRadius: 10, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' as const };
}

const YEAR_PALETTE = [
  { bg: '#d1fae5', color: '#065f46' },
  { bg: '#dbeafe', color: '#1e40af' },
  { bg: '#fef3c7', color: '#92400e' },
  { bg: '#ede9fe', color: '#5b21b6' },
  { bg: '#fce7f3', color: '#9d174d' },
];

function enrolmentYearBadgeStyle(year: number): React.CSSProperties {
  const { bg, color } = YEAR_PALETTE[Math.abs(year - 2020) % YEAR_PALETTE.length];
  return { display: 'inline-block', padding: '1px 7px', background: bg, color, borderRadius: 10, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' as const };
}

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+')) return cleaned.replace(/\D/g, '');
  if (cleaned.startsWith('0')) return '60' + cleaned.slice(1);
  // If already starts with a country code (60=MY, 65=SG, etc.), keep as-is
  if (/^(60|65|62|66|63|91|44|1)\d+$/.test(cleaned)) return cleaned;
  return '60' + cleaned;
}

function whatsappUrl(phone: string, message: string): string {
  return `https://web.whatsapp.com/send?phone=${normalizePhone(phone)}&text=${encodeURIComponent(message)}`;
}

function defaultAppointmentTime(): string {
  const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const remainder = d.getMinutes() % 30;
  if (remainder !== 0) d.setMinutes(d.getMinutes() + (30 - remainder), 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function relTime(iso: string): { text: string; stale: boolean } {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return { text: 'just now', stale: false };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor(diff / 60000);
  if (days >= 1) return { text: `${days}d ago`, stale: days >= 3 };
  if (hours >= 1) return { text: `${hours}h ago`, stale: false };
  if (mins <= 0) return { text: 'just now', stale: false };
  return { text: `${mins}m ago`, stale: false };
}

function relDays(iso: string): { text: string; stale: boolean } {
  const appt = new Date(iso);
  const now = new Date();
  const apptDay = new Date(appt.getFullYear(), appt.getMonth(), appt.getDate()).getTime();
  const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.round((todayDay - apptDay) / 86400000);
  if (days <= 0) return { text: 'today', stale: false };
  if (days === 1) return { text: '1d ago', stale: false };
  return { text: `${days}d ago`, stale: days >= 3 };
}

function leadAgeDays(lead: Lead): number {
  return (Date.now() - new Date(lead.submittedAt).getTime()) / 86400000;
}

function urgencyBorder(lead: Lead, orangeDays = 1, redDays = 3): string {
  const days = leadAgeDays(lead);
  if (lead.status === 'FOLLOW_UP') return '#f59e0b';
  if (lead.status === 'NEW' && days > redDays) return '#ef4444';
  if (lead.status === 'NEW' && days > orangeDays) return '#f59e0b';
  if (lead.status === 'CONTACTED' && days > redDays * 2) return '#f59e0b';
  return 'transparent';
}

function urgencyTooltip(lead: Lead, orangeDays = 1, redDays = 3): { label: string; rule: string } | null {
  const days = Math.floor(leadAgeDays(lead));
  if (lead.status === 'FOLLOW_UP') return { label: 'Follow-up pending', rule: `${days} days since visit` };
  if (lead.status === 'NEW' && days > redDays) return { label: 'Needs attention', rule: `${days} days waiting` };
  if (lead.status === 'NEW' && days > orangeDays) return { label: 'Contact soon', rule: `${days} days waiting` };
  if (lead.status === 'CONTACTED' && days > redDays * 2) return { label: 'Book visit soon', rule: `${days} days since contact` };
  return null;
}

const STATUS_VERB: Record<LeadStatus, string> = {
  NEW:                'Submitted',
  CONTACTED:          'Contacted',
  APPOINTMENT_BOOKED: 'Booked',
  FOLLOW_UP:          'Attended',
  ENROLLED:           'Enrolled',
  LOST:               'Lost',
  REJECTED:           'Rejected',
};

const STATUS_CFG: Record<LeadStatus, { label: string; color: string; dot: string; bg: string }> = {
  NEW:                { label: 'New',         color: '#2563eb', dot: '#3b82f6', bg: '#eff6ff' },
  CONTACTED:          { label: 'Contacted',   color: '#7c3aed', dot: '#8b5cf6', bg: '#f5f3ff' },
  APPOINTMENT_BOOKED: { label: 'Appt Confirmed', color: '#0d9488', dot: '#14b8a6', bg: '#f0fdfa' },
  FOLLOW_UP:          { label: 'Follow-Up',   color: '#d97706', dot: '#f59e0b', bg: '#fffbeb' },
  ENROLLED:           { label: 'Enrolled',    color: '#16a34a', dot: '#22c55e', bg: '#f0fdf4' },
  LOST:               { label: 'Lost',        color: '#dc2626', dot: '#f87171', bg: '#fef2f2' },
  REJECTED:           { label: 'Rejected',    color: '#92400e', dot: '#d97706', bg: '#fffbeb' },
};

// Safe accessor — returns a neutral slate fallback for any status we don't
// recognize (legacy rows, corrupted data, or enum drift between backend &
// frontend) so renders degrade gracefully instead of crashing the whole page.
const UNKNOWN_STATUS_CFG = { label: 'Unknown', color: '#64748b', dot: '#94a3b8', bg: '#f1f5f9' };
const reportedUnknownStatuses = new Set<string>();
function statusCfgOf(status: string | null | undefined) {
  const hit = status ? STATUS_CFG[status as LeadStatus] : null;
  if (hit) return hit;
  const key = status == null ? `[${typeof status}]` : `"${status}"`;
  if (!reportedUnknownStatuses.has(key)) {
    reportedUnknownStatuses.add(key);
    // Log once per unknown value so it's visible in DevTools without
    // spamming. Helps diagnose enum-drift or corrupted-row issues.
    console.warn('[LeadsPage] Unrecognized lead status:', key);
  }
  return UNKNOWN_STATUS_CFG;
}

type StatsData = {
  NEW?: number; CONTACTED?: number; APPOINTMENT_BOOKED?: number;
  FOLLOW_UP?: number; ENROLLED?: number; LOST?: number; REJECTED?: number; TRASH?: number;
};

// ── Pipeline Nav ────────────────────────────────────────────────────────────────

const ACTIVE_STAGES = [
  { key: 'NEW' as PipelineStage,                label: 'New',         accent: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8' },
  { key: 'CONTACTED' as PipelineStage,          label: 'Contacted',   accent: '#f59e0b', bg: '#fffbeb', text: '#92400e' },
  { key: 'APPOINTMENT_BOOKED' as PipelineStage, label: 'Appt Booked', accent: '#6366f1', bg: '#eef2ff', text: '#3730a3' },
  { key: 'FOLLOW_UP' as PipelineStage,          label: 'Follow-Up',   accent: '#f97316', bg: '#fff7ed', text: '#c2410c' },
];

const CLOSED_STAGES = [
  { key: 'ENROLLED' as PipelineStage, label: 'Enrolled', accent: '#22c55e', bg: '#f0fdf4', text: '#166534' },
  { key: 'LOST' as PipelineStage,     label: 'Lost',     accent: '#f87171', bg: '#fef2f2', text: '#991b1b' },
  { key: 'REJECTED' as PipelineStage, label: 'Rejected', accent: '#d97706', bg: '#fffbeb', text: '#92400e' },
];

function PipelineNav({ selected, onChange, stats, compact, collapsed, onToggle }: {
  selected: PipelineStage; onChange: (stage: PipelineStage) => void; stats: StatsData | undefined; compact?: boolean; collapsed?: boolean; onToggle?: () => void;
}) {
  const totalActive = (stats?.NEW ?? 0) + (stats?.CONTACTED ?? 0) + (stats?.APPOINTMENT_BOOKED ?? 0) + (stats?.FOLLOW_UP ?? 0);
  const getCount = (key: PipelineStage) => (stats as Record<string, number> | undefined)?.[key] ?? 0;
  const allActiveSelected = selected === 'all_active';

  // ── Compact horizontal mode (mobile / tablet) ──
  if (compact) {
    const allStages = [
      { key: 'all_active' as PipelineStage, label: 'All', accent: '#64748b', count: totalActive },
      ...ACTIVE_STAGES.map(s => ({ key: s.key, label: s.label, accent: s.accent, count: getCount(s.key) })),
      ...CLOSED_STAGES.map(s => ({ key: s.key, label: s.label, accent: s.accent, count: getCount(s.key) })),
      { key: 'TRASH' as PipelineStage, label: 'Trash', accent: '#e53e3e', count: getCount('TRASH') },
    ];
    return (
      <div className="kc-no-scrollbar" style={{ display: 'flex', gap: 6, padding: '10px 12px', overflowX: 'auto', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        {allStages.map(s => {
          const isSel = selected === s.key;
          return (
            <button key={s.key} onClick={() => onChange(s.key)} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${isSel ? s.accent : '#e5e7eb'}`,
              background: isSel ? s.accent : '#fff', color: isSel ? '#fff' : '#6b7280', fontSize: 12, fontWeight: isSel ? 700 : 500,
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit',
            }}>
              {s.label}
              <span style={{ fontSize: 10, fontWeight: 700, background: isSel ? 'rgba(255,255,255,0.25)' : '#f1f5f9', color: isSel ? '#fff' : '#94a3b8', borderRadius: 8, padding: '1px 6px' }}>{s.count}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // ── Collapsed sidebar (icon-only with tooltips) ──
  if (collapsed) {
    const allStages = [
      { key: 'all_active' as PipelineStage, label: 'All Active', accent: '#64748b', count: totalActive, icon: null, num: null },
      ...ACTIVE_STAGES.map((s, i) => ({ key: s.key, label: s.label, accent: s.accent, count: getCount(s.key), icon: null, num: i + 1 })),
    ];
    const closedStages = CLOSED_STAGES.map(s => ({ key: s.key, label: s.label, accent: s.accent, count: getCount(s.key) }));
    const trashCount = getCount('TRASH');

    return (
      <div className="kc-no-scrollbar" style={{ width: 48, flexShrink: 0, background: '#fff', borderRight: '1px solid #e2e8f0', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', paddingTop: 12, gap: 2 }}>
        {/* Expand button */}
        <button onClick={onToggle} title="Show pipeline" style={{
          width: 32, height: 28, border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 11, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6,
        }}>
          <FontAwesomeIcon icon={faChevronRight} />
        </button>

        {/* Stage dots */}
        {allStages.map(s => {
          const isSel = selected === s.key;
          return (
            <button key={s.key} onClick={() => onChange(s.key)} title={`${s.label} (${s.count})`} style={{
              width: 36, height: 36, border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
              background: isSel ? s.accent + '18' : 'none',
            }}>
              {s.num != null ? (
                <span style={{
                  width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, background: isSel ? s.accent : '#fff', border: `2px solid ${isSel ? s.accent : '#d1d5db'}`, color: isSel ? '#fff' : '#9ca3af',
                }}>{s.num}</span>
              ) : (
                <span style={{
                  width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 8, fontWeight: 800, background: isSel ? '#64748b' : '#fff', border: `2px solid ${isSel ? '#64748b' : '#d1d5db'}`, color: isSel ? '#fff' : '#9ca3af',
                }}>ALL</span>
              )}
              {s.count > 0 && (
                <span style={{ position: 'absolute', top: 2, right: 2, fontSize: 8, fontWeight: 700, color: s.accent, lineHeight: 1 }}>{s.count}</span>
              )}
            </button>
          );
        })}

        <div style={{ width: 20, height: 1, background: '#f1f5f9', margin: '6px 0' }} />

        {/* Closed */}
        {closedStages.map(s => {
          const isSel = selected === s.key;
          return (
            <button key={s.key} onClick={() => onChange(s.key)} title={`${s.label} (${s.count})`} style={{
              width: 36, height: 36, border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
              background: isSel ? s.accent + '18' : 'none',
            }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: isSel ? s.accent : '#d1d5db' }} />
              {s.count > 0 && (
                <span style={{ position: 'absolute', top: 2, right: 2, fontSize: 8, fontWeight: 700, color: s.accent, lineHeight: 1 }}>{s.count}</span>
              )}
            </button>
          );
        })}

        <div style={{ width: 20, height: 1, background: '#f1f5f9', margin: '6px 0' }} />

        {/* Trash */}
        {(() => {
          const isSel = selected === 'TRASH';
          return (
            <button onClick={() => onChange('TRASH')} title={`Trash (${trashCount})`} style={{
              width: 36, height: 36, border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isSel ? '#fee2e2' : 'none', color: isSel ? '#e53e3e' : '#d1d5db', fontSize: 13,
            }}>
              <FontAwesomeIcon icon={faTrash} />
            </button>
          );
        })()}
      </div>
    );
  }

  // ── Full vertical sidebar (desktop) ──
  return (
    <div className="kc-no-scrollbar" style={{ width: 208, flexShrink: 0, background: '#fff', borderRight: '1px solid #e2e8f0', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' as const, paddingTop: 8 }}>

      {/* Collapse arrow — top right */}
      {onToggle && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '2px 8px 8px' }}>
          <span onClick={onToggle} title="Collapse sidebar" style={{
            color: '#cbd5e1', fontSize: 10, padding: '4px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: 4,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = '#f1f5f9'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.background = 'transparent'; }}
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </span>
        </div>
      )}

      {/* "Active Pipeline" header — also acts as "All Active" filter */}
      <button onClick={() => onChange('all_active')} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '7px 14px',
        background: allActiveSelected ? '#f1f5f9' : 'none',
        border: 'none', borderLeft: `${allActiveSelected ? 4 : 3}px solid ${allActiveSelected ? '#64748b' : 'transparent'}`,
        cursor: 'pointer', marginBottom: 2,
      }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: allActiveSelected ? '#334155' : '#94a3b8' }}>
          Active Pipeline
        </span>
        <span style={{ fontSize: allActiveSelected ? 12 : 11, fontWeight: 700, borderRadius: 10, padding: allActiveSelected ? '2px 8px' : '1px 7px', background: allActiveSelected ? '#64748b' : '#f1f5f9', color: allActiveSelected ? '#fff' : '#94a3b8', flexShrink: 0 }}>
          {totalActive}
        </span>
      </button>

      {/* Pipeline stages with vertical connector */}
      <div style={{ position: 'relative' as const, marginBottom: 4 }}>
        {/* Connector line behind the step dots */}
        <div style={{ position: 'absolute' as const, left: 25, top: 14, bottom: 14, width: 1, background: '#e5e7eb' }} />

        {ACTIVE_STAGES.map((s, idx) => {
          const isSelected = selected === s.key;
          const count = getCount(s.key);
          return (
            <button key={s.key} onClick={() => onChange(s.key)} style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 14px 8px 11px',
              background: isSelected ? s.bg : 'none',
              border: 'none', borderLeft: `${isSelected ? 4 : 3}px solid ${isSelected ? s.accent : 'transparent'}`,
              cursor: 'pointer', textAlign: 'left' as const, position: 'relative' as const, zIndex: 1,
            }}>
              {/* Numbered step dot */}
              <span style={{
                width: isSelected ? 22 : 20, height: isSelected ? 22 : 20, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 800, lineHeight: 1,
                background: isSelected ? s.accent : '#fff',
                border: `${isSelected ? 2 : 1.5}px solid ${isSelected ? s.accent : '#d1d5db'}`,
                color: isSelected ? '#fff' : '#9ca3af',
                position: 'relative' as const, zIndex: 1,
              }}>
                {idx + 1}
              </span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: isSelected ? 700 : 400, color: isSelected ? s.text : '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                {s.label}
              </span>
              <span style={{ fontSize: isSelected ? 12 : 11, fontWeight: 700, borderRadius: 10, padding: isSelected ? '2px 8px' : '1px 7px', background: isSelected ? s.accent : '#f1f5f9', color: isSelected ? '#fff' : '#94a3b8', flexShrink: 0 }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ margin: '12px 14px 10px', borderTop: '1px solid #f1f5f9' }} />

      <div style={{ padding: '0 14px 6px', fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
        Closed
      </div>
      {CLOSED_STAGES.map(s => {
        const isSelected = selected === s.key;
        const count = getCount(s.key);
        return (
          <button key={s.key} onClick={() => onChange(s.key)} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '8px 14px 8px 11px',
            background: isSelected ? s.bg : 'none',
            border: 'none', borderLeft: `${isSelected ? 4 : 3}px solid ${isSelected ? s.accent : 'transparent'}`,
            cursor: 'pointer', textAlign: 'left' as const,
          }}>
            <span style={{ width: isSelected ? 9 : 7, height: isSelected ? 9 : 7, borderRadius: '50%', flexShrink: 0, background: isSelected ? s.accent : '#d1d5db' }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: isSelected ? 700 : 400, color: isSelected ? s.text : '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
              {s.label}
            </span>
            <span style={{ fontSize: isSelected ? 12 : 11, fontWeight: 700, borderRadius: 10, padding: isSelected ? '2px 8px' : '1px 7px', background: isSelected ? s.accent : '#f1f5f9', color: isSelected ? '#fff' : '#94a3b8', flexShrink: 0 }}>
              {count}
            </span>
          </button>
        );
      })}

      <div style={{ margin: '12px 14px 10px', borderTop: '1px solid #f1f5f9' }} />

      {/* Trash */}
      {(() => {
        const isSelected = selected === 'TRASH';
        const trashCount = getCount('TRASH');
        return (
          <button onClick={() => onChange('TRASH')} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '8px 14px 8px 11px',
            background: isSelected ? '#fff5f5' : 'none',
            border: 'none', borderLeft: `${isSelected ? 4 : 3}px solid ${isSelected ? '#e53e3e' : 'transparent'}`,
            cursor: 'pointer', textAlign: 'left' as const,
          }}>
            <FontAwesomeIcon icon={faTrash} style={{ fontSize: isSelected ? 13 : 12, color: isSelected ? '#e53e3e' : '#d1d5db', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: isSelected ? 700 : 400, color: isSelected ? '#c53030' : '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
              Trash
            </span>
            {trashCount > 0 && (
              <span style={{ fontSize: isSelected ? 12 : 11, fontWeight: 700, borderRadius: 10, padding: isSelected ? '2px 8px' : '1px 7px', background: isSelected ? '#e53e3e' : '#f1f5f9', color: isSelected ? '#fff' : '#94a3b8', flexShrink: 0 }}>
                {trashCount}
              </span>
            )}
          </button>
        );
      })()}

    </div>
  );
}

// ── Sidebar ─────────────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ── Summary Strip (compact metrics above table) ───────────────────────────────
function SummaryStrip({ appointmentCount, followUpCount, overdueCount, onOpen }: {
  appointmentCount: number; followUpCount: number; overdueCount: number;
  onOpen: (tab: string) => void;
}) {
  const items = [
    { key: 'appointments', label: 'Appointments', count: appointmentCount, icon: faCalendarDays, color: '#1d4ed8', bg: '#eff6ff' },
    { key: 'overdue', label: 'Status Pending', count: overdueCount, icon: faTriangleExclamation, color: '#d97706', bg: '#fffbeb', alert: overdueCount > 0 },
    { key: 'followups', label: 'Follow-Ups', count: followUpCount, icon: faArrowRight, color: '#7c3aed', bg: '#f5f3ff' },
  ];
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
      {items.map(it => (
        <button key={it.key} onClick={() => onOpen(it.key)} style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px',
          background: it.alert ? it.bg : '#fff', border: `1px solid ${it.alert ? it.color + '40' : '#e5e7eb'}`,
          borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
          color: it.count > 0 ? it.color : '#94a3b8', transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = it.color; e.currentTarget.style.background = it.bg; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = it.alert ? it.color + '40' : '#e5e7eb'; e.currentTarget.style.background = it.alert ? it.bg : '#fff'; }}
        >
          <FontAwesomeIcon icon={it.icon} style={{ fontSize: 11 }} />
          {it.label}
          <span style={{
            padding: '1px 7px', borderRadius: 10, fontSize: 11, fontWeight: 700,
            background: it.count > 0 ? it.color : '#e5e7eb', color: it.count > 0 ? '#fff' : '#94a3b8',
          }}>{it.count}</span>
        </button>
      ))}
    </div>
  );
}

// ── Right Context Panel (docked, collapsible like left nav) ───────────────────
function ContextPanel({ expanded, activeTab, onToggle, onTabChange, upcomingAppts, followUpLeads, overdueApptLeads, onFollowUp, onWhatsApp, onSelectLead }: {
  expanded: boolean; activeTab: string; onToggle: () => void; onTabChange: (tab: string) => void;
  upcomingAppts: UpcomingAppointment[]; followUpLeads: Lead[]; overdueApptLeads: Lead[];
  onFollowUp: (lead: Lead) => void; onWhatsApp: (apptId: string) => void; onSelectLead: (lead: Lead) => void;
}) {
  const today = new Date();
  const todayAppts = upcomingAppts.filter(a => isSameDay(new Date(a.appointmentStart), today));
  const comingAppts = upcomingAppts.filter(a => !isSameDay(new Date(a.appointmentStart), today));

  const tabs = [
    { key: 'appointments', label: 'Appointments', icon: faCalendarDays, count: upcomingAppts.length, color: '#1d4ed8' },
    { key: 'overdue', label: 'Pending', icon: faTriangleExclamation, count: overdueApptLeads.length, color: '#d97706', alert: overdueApptLeads.length > 0 },
    { key: 'followups', label: 'Follow-Up', icon: faPhone, count: followUpLeads.length, color: '#7c3aed' },
  ];

  // ── Collapsed: icon strip ──
  if (!expanded) {
    return (
      <div className="kc-no-scrollbar" style={{ width: 48, flexShrink: 0, background: '#fff', borderLeft: '1px solid #e2e8f0', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 12, gap: 2 }}>
        <button onClick={onToggle} style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: '#f1f5f9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 12, marginBottom: 8 }}>
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>
        {tabs.map(t => (
          <button key={t.key} onClick={() => onTabChange(t.key)}
            title={t.label}
            style={{
              width: 34, height: 34, borderRadius: 8, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
              background: t.alert ? '#fffbeb' : 'transparent', color: t.alert ? t.color : '#94a3b8', fontSize: 13,
            }}>
            <FontAwesomeIcon icon={t.icon} />
            {t.count > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: 2, fontSize: 9, fontWeight: 700,
                background: t.alert ? t.color : '#94a3b8', color: '#fff',
                borderRadius: 10, padding: '0 4px', lineHeight: '15px', minWidth: 15, textAlign: 'center',
              }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>
    );
  }

  // ── Expanded: full panel ──
  return (
    <div className="kc-no-scrollbar" style={{ width: 260, flexShrink: 0, background: '#fff', borderLeft: '1px solid #e2e8f0', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Header with toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 8px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Context</span>
        <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 12, padding: 4 }}>
          <FontAwesomeIcon icon={faChevronRight} />
        </button>
      </div>

      {/* Tab buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '0 8px 8px' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => onTabChange(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 7,
            border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === t.key ? 600 : 500,
            background: activeTab === t.key ? (t.alert ? '#fffbeb' : '#f1f5f9') : 'transparent',
            color: activeTab === t.key ? t.color : '#64748b', fontFamily: 'inherit',
            transition: 'all 0.12s',
          }}>
            <FontAwesomeIcon icon={t.icon} style={{ fontSize: 11, width: 14 }} />
            {t.label}
            <span style={{
              marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
              background: t.count > 0 ? (t.alert ? t.color : '#e5e7eb') : '#f1f5f9',
              color: t.count > 0 ? (t.alert ? '#fff' : '#374151') : '#cbd5e1',
            }}>{t.count}</span>
          </button>
        ))}
      </div>

      <div style={{ height: 1, background: '#f1f5f9', margin: '0 14px' }} />

      {/* Active tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {activeTab === 'appointments' && (() => {
          // Sort all appointments by date/time, then group by date
          const sorted = [...upcomingAppts].sort((a, b) => new Date(a.appointmentStart).getTime() - new Date(b.appointmentStart).getTime());
          const groups: { label: string; isToday: boolean; items: typeof sorted }[] = [];
          for (const a of sorted) {
            const d = new Date(a.appointmentStart);
            const isToday = isSameDay(d, today);
            const datePart = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            const dayPart = d.toLocaleDateString('en-GB', { weekday: 'short' });
            const label = isToday
              ? `Today · (${dayPart}) ${datePart}`
              : `(${dayPart}) ${datePart}`;
            const existing = groups.find(g => g.label === label);
            if (existing) existing.items.push(a);
            else groups.push({ label, isToday, items: [a] });
          }
          return groups.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 12, color: '#cbd5e1' }}>No upcoming appointments</div>
          ) : groups.map((group, gi) => (
            <div key={group.label}>
              <div style={{ padding: '6px 14px', fontSize: 10, fontWeight: 700, color: group.isToday ? '#1d4ed8' : '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase', background: group.isToday ? '#eff6ff' : '#f8fafc', borderTop: gi > 0 ? '1px solid #e2e8f0' : 'none', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{group.label}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: group.isToday ? '#3b82f6' : '#94a3b8', background: group.isToday ? '#dbeafe' : '#e2e8f0', borderRadius: 8, padding: '1px 6px' }}>{group.items.length}</span>
              </div>
              {group.items.map(a => {
                const s = new Date(a.appointmentStart);
                const e = a.appointmentEnd ? new Date(a.appointmentEnd) : null;
                const fmtT = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
                return (
                  <div key={a.id} onClick={() => onSelectLead(a as any)}
                    onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                    style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', gap: 10, transition: 'background 0.1s' }}>
                    <div style={{ width: 3, height: 28, borderRadius: 2, background: group.isToday ? '#3b82f6' : '#e2e8f0', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{a.childName}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        {fmtT(s)}{e ? ` – ${fmtT(e)}` : ''}
                      </div>
                    </div>
                    <button onClick={ev => { ev.stopPropagation(); onWhatsApp(a.id); }} style={{ ...sp.waBtn, opacity: 0.5 }}
                      onMouseEnter={ev => { (ev.target as HTMLElement).style.opacity = '1'; }}
                      onMouseLeave={ev => { (ev.target as HTMLElement).style.opacity = '0.5'; }}>
                      <FontAwesomeIcon icon={faWhatsapp} />
                    </button>
                  </div>
                );
              })}
            </div>
          ));
        })()}

        {activeTab === 'overdue' && (
          <>
            {overdueApptLeads.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: 12, color: '#cbd5e1' }}>
                <FontAwesomeIcon icon={faCircleCheck} style={{ marginRight: 5, color: '#22c55e' }} /> All clear
              </div>
            ) : (
              <>
                <div style={{ padding: '6px 14px 4px', fontSize: 10, color: '#b45309' }}>Update their status</div>
                {overdueApptLeads.map(lead => (
                  <div key={lead.id} onClick={() => onSelectLead(lead)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 14px', borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fffbeb')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{lead.childName}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{lead.parentPhone}</div>
                    </div>
                    <FontAwesomeIcon icon={faArrowRight} style={{ color: '#d97706', fontSize: 11 }} />
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {activeTab === 'followups' && (
          <>
            {followUpLeads.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: 12, color: '#cbd5e1' }}>
                <FontAwesomeIcon icon={faCircleCheck} style={{ marginRight: 5, color: '#22c55e' }} /> All clear
              </div>
            ) : followUpLeads.map(lead => (
              <div key={lead.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 14px', borderBottom: '1px solid #f8fafc' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{lead.childName}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{lead.parentPhone}</div>
                </div>
                <button onClick={() => onFollowUp(lead)} style={sp.waBtn}><FontAwesomeIcon icon={faWhatsapp} /></button>
              </div>
            ))}
          </>
        )}

      </div>
    </div>
  );
}

// ── Appointment Modal ─────────────────────────────────────────────────────────

const RELATIONSHIP_ZH: Record<string, string> = { Mother: '妈咪', Father: '爸爸' };
function relationshipZh(rel: string): string { return RELATIONSHIP_ZH[rel] || rel; }
const DAY_ZH = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function applyWaTemplate(template: string, childName: string, relationship: string, dt: string, address: string, durationMinutes: number, isZh = false): string {
  const d = new Date(dt);
  const end = new Date(d.getTime() + durationMinutes * 60_000);
  const dayStr = isZh ? DAY_ZH[d.getDay()] : d.toLocaleDateString('en-GB', { weekday: 'long' });
  const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
  const endTimeStr = end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
  return template
    .replace(/\{\{childName\}\}/g, childName)
    .replace(/\{\{relationship\}\}/g, isZh ? relationshipZh(relationship) : relationship)
    .replace(/\{\{appointmentDay\}\}/g, dayStr)
    .replace(/\{\{appointmentDate\}\}/g, dateStr)
    .replace(/\{\{appointmentTime\}\}/g, timeStr)
    .replace(/\{\{appointmentEndTime\}\}/g, endTimeStr)
    .replace(/\{\{address\}\}/g, address);
}

function AppointmentModal({
  lead, intent = 'book', waTemplate, waTemplateZh, address, durationMinutes, upcomingAppts, onClose, onConfirm, onConfirmNoCalendar,
}: {
  lead: Lead; intent?: 'book' | 'reschedule'; waTemplate: string; waTemplateZh: string; address: string; durationMinutes: number;
  upcomingAppts: UpcomingAppointment[];
  onClose: () => void;
  onConfirm: (appointmentStart: string, waMessage: string, isPlaceholder: boolean) => Promise<void>;
  onConfirmNoCalendar: (appointmentStart: string, waMessage: string, isPlaceholder: boolean) => Promise<void>;
}) {
  const initialDateTime = lead.appointmentStart
    ? (() => {
        const d = new Date(lead.appointmentStart);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      })()
    : defaultAppointmentTime();
  const [dateTime, setDateTime] = useState(initialDateTime);
  const isPlaceholder = lead.status === 'NEW' || lead.status === 'CONTACTED';
  const isReschedule = intent === 'reschedule';
  const relationship = lead.relationship || '';
  const [message, setMessage] = useState(() => applyWaTemplate(waTemplate, lead.childName, relationship, initialDateTime, address, durationMinutes));
  const [messageEdited, setMessageEdited] = useState(false);
  const [messageZh, setMessageZh] = useState(() => waTemplateZh ? applyWaTemplate(waTemplateZh, lead.childName, relationship, initialDateTime, address, durationMinutes, true) : '');
  const [messageZhEdited, setMessageZhEdited] = useState(false);
  const [lang, setLang] = useState<'en' | 'zh'>('zh');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [lastAttemptWantedWa, setLastAttemptWantedWa] = useState(false);
  const { data: googleStatus } = useQuery({ queryKey: ['google-status'], queryFn: () => import('../api/google.js').then(m => m.getGoogleStatus()), staleTime: 60_000 });

  useEffect(() => { if (!messageEdited) setMessage(applyWaTemplate(waTemplate, lead.childName, relationship, dateTime, address, durationMinutes)); }, [dateTime]);
  useEffect(() => { if (!messageZhEdited && waTemplateZh) setMessageZh(applyWaTemplate(waTemplateZh, lead.childName, relationship, dateTime, address, durationMinutes, true)); }, [dateTime]);

  const handleConfirm = async (openWhatsApp = false) => {
    if (!dateTime) { setError('Please select a date and time.'); return; }
    setConfirming(true); setError(''); setLastAttemptWantedWa(openWhatsApp);
    try {
      await onConfirm(new Date(dateTime).toISOString(), message, isPlaceholder);
      if (openWhatsApp) window.open(whatsappUrl(lead.parentPhone, lang === 'en' ? message : messageZh), '_blank', 'noopener,noreferrer');
      onClose();
    }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to book appointment'); }
    finally { setConfirming(false); }
  };

  const apptEndTime = dateTime ? (() => {
    const start = new Date(dateTime);
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    const fmt = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
    const fmtDate = start.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    return `${fmtDate} · ${fmt(start)} – ${fmt(end)}`;
  })() : null;

  const clashes = dateTime ? (() => {
    const start = new Date(dateTime);
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    return upcomingAppts.filter(a => {
      if (a.id === lead.id) return false;
      const aStart = new Date(a.appointmentStart);
      const aEnd = a.appointmentEnd ? new Date(a.appointmentEnd) : new Date(aStart.getTime() + durationMinutes * 60_000);
      return aStart < end && aEnd > start;
    });
  })() : [];

  const [msgExpanded, setMsgExpanded] = useState(false);
  const currentMsg = lang === 'en' ? message : messageZh;

  // Pre-compute selected date parts for the summary card
  const selectedDate = dateTime ? new Date(dateTime) : null;
  const selectedEnd = selectedDate ? new Date(selectedDate.getTime() + durationMinutes * 60_000) : null;
  const fmtTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const hasClash = clashes.length > 0;

  return (
    <div style={am.backdrop}>
      <div style={{ ...am.card, padding: 0, maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', borderRadius: 14, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

        {/* ── Header bar ── */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FontAwesomeIcon icon={faCalendarDays} style={{ color: '#3b82f6', fontSize: 15 }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
                {isReschedule ? 'Reschedule Appointment' : 'Book Appointment'}
              </h2>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                {lead.childName} · {lead.parentPhone}
                <span
                  title={googleStatus?.connected ? `Syncing to: ${googleStatus.calendarName || googleStatus.calendarId || 'Primary calendar'}` : 'Google Calendar not connected'}
                  style={{ width: 7, height: 7, borderRadius: '50%', background: googleStatus?.connected ? '#22c55e' : '#ef4444', display: 'inline-block' }}
                />
              </div>
              {lead.preferredAppointmentTime && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  Preferred: <span style={{ color: '#64748b', fontWeight: 500 }}>{lead.preferredAppointmentTime}</span>
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 15, cursor: 'pointer', color: '#cbd5e1', padding: '4px 2px', lineHeight: 1 }}><FontAwesomeIcon icon={faXmark} /></button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>

        {/* ── Confirmation anchor — selected slot summary ── */}
        <div style={{ padding: '0 24px' }}>
          <div style={{
            margin: '16px 0 0', padding: '12px 16px', borderRadius: 10, minHeight: 64,
            background: selectedDate ? (hasClash ? '#fffbeb' : '#f0f9ff') : '#f8fafc',
            border: selectedDate ? (hasClash ? '1px solid #fde68a' : '1px solid #bae6fd') : '1px dashed #d1d5db',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            {selectedDate ? (<>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fff', borderRadius: 8, padding: '6px 12px', border: '1px solid #e0f2fe', lineHeight: 1, minWidth: 48 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#0284c7', textTransform: 'uppercase' }}>{selectedDate.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#0c4a6e', lineHeight: 1.2 }}>{selectedDate.getDate()}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: '#0284c7', textTransform: 'uppercase' }}>{selectedDate.toLocaleDateString('en-US', { month: 'short' })}</span>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0c4a6e' }}>{fmtTime(selectedDate)} – {fmtTime(selectedEnd!)}</div>
                <div style={{ fontSize: 11, color: '#0369a1', marginTop: 2 }}>{selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {durationMinutes} min</div>
              </div>
              <div style={{ marginLeft: 'auto', width: 220, textAlign: 'right', flexShrink: 0, visibility: hasClash ? 'visible' : 'hidden' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', marginBottom: 3, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                  <FontAwesomeIcon icon={faTriangleExclamation} style={{ color: '#f59e0b', fontSize: 11 }} />
                  Conflicts with another booking
                </div>
                {clashes.map(c => {
                  const cStart = new Date(c.appointmentStart);
                  const cEnd = c.appointmentEnd ? new Date(c.appointmentEnd) : new Date(cStart.getTime() + durationMinutes * 60_000);
                  return (
                    <div key={c.id} style={{ fontSize: 11, color: '#92400e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.childName} · {fmtTime(cStart)}–{fmtTime(cEnd)}
                    </div>
                  );
                })}
              </div>
            </>) : (
              <span style={{ fontSize: 13, color: '#9ca3af' }}>Select a date and time below</span>
            )}
          </div>
        </div>

        {/* ── Two-column body ── */}
        <div style={{ display: 'flex', padding: '16px 24px 20px', gap: 0 }}>

          {/* ── LEFT: Date & Time selection (primary) ── */}
          <div style={{ flex: '0 0 330px', paddingRight: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', letterSpacing: '0.03em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: '#3b82f6', color: '#fff', fontSize: 10, fontWeight: 700 }}>1</span>
              Select Date &amp; Time
            </div>
            <input type="date" style={{ display: 'block', width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff', color: '#1e293b' }} value={dateTime.split('T')[0]} onChange={e => { const time = dateTime.split('T')[1] || '10:00'; setDateTime(`${e.target.value}T${time}`); }} required />

            {(() => {
              const selectedTime = dateTime.split('T')[1] || '';
              const morning: string[] = [];
              const afternoon: string[] = [];
              for (let h = 8; h <= 17; h++) { for (const m of ['00', '30']) { if (h === 17 && m === '30') continue; const slot = `${String(h).padStart(2, '0')}:${m}`; if (h < 12) morning.push(slot); else afternoon.push(slot); } }
              const fmtSlotLabel = (slot: string) => new Date(`2000-01-01T${slot}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

              const dateStr = dateTime.split('T')[0];
              const clashingSlots = new Set<string>();
              for (const a of upcomingAppts) {
                if (a.id === lead.id) continue;
                const aStart = new Date(a.appointmentStart);
                const aEnd = a.appointmentEnd ? new Date(a.appointmentEnd) : new Date(aStart.getTime() + durationMinutes * 60_000);
                for (const slot of [...morning, ...afternoon]) {
                  const sStart = new Date(`${dateStr}T${slot}`);
                  const sEnd = new Date(sStart.getTime() + durationMinutes * 60_000);
                  if (sStart < aEnd && sEnd > aStart) clashingSlots.add(slot);
                }
              }

              const slotBtn = (slot: string) => {
                const isSelected = selectedTime === slot;
                const isClash = clashingSlots.has(slot);
                const isSelectedClash = isSelected && isClash;
                return (
                  <button key={slot} onClick={() => setDateTime(`${dateStr}T${slot}`)}
                    style={{
                      padding: '7px 0', fontSize: 11, fontWeight: 600,
                      borderRadius: 7, cursor: 'pointer',
                      border: 'none',
                      background: isSelected ? (isClash ? '#fef3c7' : '#3b82f6') : isClash ? '#fffbeb' : '#f1f5f9',
                      color: isSelected ? (isClash ? '#92400e' : '#fff') : isClash ? '#92400e' : '#334155',
                      boxShadow: isSelectedClash ? 'inset 0 0 0 2px #f59e0b' : 'none',
                      outline: 'none',
                      position: 'relative' as const,
                      transition: 'all 0.12s ease',
                    }}>
                    {fmtSlotLabel(slot)}
                    {isClash && !isSelected && <span style={{ position: 'absolute', top: 3, right: 5, width: 5, height: 5, borderRadius: '50%', background: '#f59e0b' }} />}
                  </button>
                );
              };

              const groupLabel = (label: string) => (
                <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
              );

              return (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    {groupLabel('Morning')}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>{morning.map(slotBtn)}</div>
                  </div>
                  <div>
                    {groupLabel('Afternoon')}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>{afternoon.map(slotBtn)}</div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Divider */}
          <div style={{ width: 1, background: '#f1f5f9', flexShrink: 0, alignSelf: 'stretch' }} />

          {/* ── RIGHT: Message preview (secondary) ── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', paddingLeft: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', letterSpacing: '0.03em', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: '#e2e8f0', color: '#64748b', fontSize: 10, fontWeight: 700 }}>2</span>
              Message Preview
            </div>

            {/* Controls row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              {waTemplateZh ? (
                <div style={{ display: 'inline-flex', borderRadius: 6, background: '#f1f5f9', padding: 2 }}>
                  {(['en', 'zh'] as const).map(t => (
                    <button key={t} onClick={() => setLang(t)} style={{
                      padding: '2px 11px', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer', lineHeight: '18px',
                      border: 'none', background: lang === t ? '#fff' : 'transparent',
                      color: lang === t ? '#1e293b' : '#94a3b8',
                      boxShadow: lang === t ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    }}>{t === 'en' ? 'EN' : '中文'}</button>
                  ))}
                </div>
              ) : <div />}
              <button onClick={() => setMsgExpanded(!msgExpanded)} style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: msgExpanded ? '#3b82f6' : '#94a3b8', fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 4, padding: 0,
              }}>
                <FontAwesomeIcon icon={faPen} style={{ fontSize: 9 }} /> {msgExpanded ? 'Done' : 'Edit'}
              </button>
            </div>

            {/* Message content */}
            {msgExpanded ? (
              lang === 'en' ? (
                <textarea style={{ display: 'block', width: '100%', flex: 1, minHeight: 140, resize: 'none', padding: '11px 13px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.55, background: '#fff', color: '#1e293b' }} value={message} onChange={e => { setMessage(e.target.value); setMessageEdited(true); }} />
              ) : (
                <textarea style={{ display: 'block', width: '100%', flex: 1, minHeight: 140, resize: 'none', padding: '11px 13px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.55, background: '#fff', color: '#1e293b' }} value={messageZh} onChange={e => { setMessageZh(e.target.value); setMessageZhEdited(true); }} />
              )
            ) : (
              <div style={{
                flex: 1, background: '#f8faf9', borderRadius: 10, padding: '12px 14px',
                fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap',
                overflowY: 'auto', maxHeight: 240, border: '1px solid #e5e7eb',
              }}>
                {currentMsg || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No message template set</span>}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div style={{ padding: '8px 24px', marginTop: 4 }}>
            <div style={{ background: error.includes('Google Calendar') ? '#fffbeb' : '#fef2f2', border: error.includes('Google Calendar') ? '1px solid #fde68a' : '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: error.includes('Google Calendar') ? '#92400e' : '#dc2626' }}>
              {error.includes('Google Calendar') ? (<>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Google Calendar sync failed</div>
                <div style={{ lineHeight: 1.5 }}>
                  The appointment was not saved. <a href="/settings/calendar" style={{ color: '#92400e', fontWeight: 600 }}>Reconnect in Settings</a>, or{' '}
                  <button onClick={async () => {
                    setError(''); setConfirming(true);
                    try {
                      await onConfirmNoCalendar(new Date(dateTime).toISOString(), message, isPlaceholder);
                      if (lastAttemptWantedWa) window.open(whatsappUrl(lead.parentPhone, lang === 'en' ? message : messageZh), '_blank', 'noopener,noreferrer');
                      onClose();
                    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to save'); }
                    finally { setConfirming(false); }
                  }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#92400e', fontWeight: 600, fontSize: 12, textDecoration: 'underline' }}>
                    {lastAttemptWantedWa ? 'save & send WhatsApp without calendar' : 'save without calendar'}
                  </button>.
                </div>
              </>) : error}
            </div>
          </div>
        )}

        </div>{/* end scrollable body */}

        {/* ── Inline conflict helper (always rendered to prevent layout shift) ── */}
        <div style={{ padding: hasClash ? '8px 24px' : '0 24px', fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6, background: hasClash ? '#fffbeb' : 'transparent', borderTop: hasClash ? '1px solid #fde68a' : '1px solid transparent', overflow: 'hidden', maxHeight: hasClash ? 40 : 0, transition: 'max-height 0.15s ease, padding 0.15s ease', flexShrink: 0 }}>
          <FontAwesomeIcon icon={faTriangleExclamation} style={{ color: '#f59e0b', fontSize: 11, flexShrink: 0 }} />
          This slot overlaps with another booking. You may choose another time or proceed anyway.
        </div>

        {/* ── Footer — decisive action hierarchy ── */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10, background: '#fafbfc', flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#64748b', fontWeight: 500, padding: '9px 16px' }}>Cancel</button>
          <div style={{ flex: 1 }} />
          <button onClick={() => handleConfirm(false)} disabled={confirming} style={{
            padding: '9px 16px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer',
            fontSize: 13, color: '#374151', fontWeight: 600,
          }}>
            {confirming ? 'Saving…' : isReschedule ? 'Reschedule' : 'Book Only'}
          </button>
          <button
            onClick={() => handleConfirm(true)}
            disabled={confirming}
            style={{
              padding: '9px 20px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8,
              cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7,
              boxShadow: '0 1px 3px rgba(34,197,94,0.3)',
            }}
          >
            <FontAwesomeIcon icon={faWhatsapp} /> {confirming ? 'Saving…' : isReschedule ? 'Reschedule & Send' : 'Book & Send WhatsApp'}
          </button>
        </div>

      </div>

    </div>
  );
}

// ── WhatsApp Modal ─────────────────────────────────────────────────────────────

interface WhatsAppContact {
  childName: string; parentPhone: string; relationship?: string | null;
  status?: LeadStatus; appointmentStart?: string | null; notes?: string | null;
  submittedAt?: string; childDob?: string;
}

interface WaTemplateOption { id: string; name: string; content_en: string; content_zh: string; }

function applyTemplatePlaceholders(template: string, contact: WhatsAppContact, address: string, durationMinutes: number, isZh = false): string {
  const childName = contact.childName;
  const relationship = contact.relationship || '';
  const rel = isZh ? relationshipZh(relationship) : relationship;
  const dt = contact.appointmentStart;
  if (dt) {
    const d = new Date(dt);
    const end = new Date(d.getTime() + durationMinutes * 60_000);
    const dayStr = isZh ? DAY_ZH[d.getDay()] : d.toLocaleDateString('en-GB', { weekday: 'long' });
    const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
    const endTimeStr = end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
    return template
      .replace(/\{\{childName\}\}/g, childName).replace(/\{\{relationship\}\}/g, rel)
      .replace(/\{\{appointmentDay\}\}/g, dayStr).replace(/\{\{appointmentDate\}\}/g, dateStr)
      .replace(/\{\{appointmentTime\}\}/g, timeStr).replace(/\{\{appointmentEndTime\}\}/g, endTimeStr)
      .replace(/\{\{address\}\}/g, address);
  }
  return template.replace(/\{\{childName\}\}/g, childName).replace(/\{\{relationship\}\}/g, rel)
    .replace(/\{\{appointmentDay\}\}/g, '').replace(/\{\{appointmentDate\}\}/g, '')
    .replace(/\{\{appointmentTime\}\}/g, '').replace(/\{\{appointmentEndTime\}\}/g, '').replace(/\{\{address\}\}/g, address);
}

function WhatsAppModal({ contact, defaultTemplate = 'none', templates, address, durationMinutes, onClose }: {
  contact: WhatsAppContact; defaultTemplate?: string; templates: WaTemplateOption[]; address: string; durationMinutes: number; onClose: () => void;
}) {
  const [templateId, setTemplateId] = useState(defaultTemplate);
  const [lang, setLang] = useState<'en' | 'zh'>('zh');
  const [edited, setEdited] = useState<Record<string, boolean>>({});

  const resolve = (id: string, l: 'en' | 'zh') => {
    if (id === 'none') return '';
    const tpl = templates.find(t => t.id === id);
    if (!tpl) return '';
    const content = l === 'zh' ? tpl.content_zh : tpl.content_en;
    if (!content) return '';
    return applyTemplatePlaceholders(content, contact, address, durationMinutes, l === 'zh');
  };

  const [messages, setMessages] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = { none_en: '', none_zh: '' };
    for (const t of templates) {
      init[`${t.id}_en`] = resolve(t.id, 'en');
      init[`${t.id}_zh`] = resolve(t.id, 'zh');
    }
    return init;
  });

  const key = `${templateId}_${lang}`;
  const currentMsg = messages[key] ?? '';
  const currentTpl = templates.find(t => t.id === templateId);
  const hasZh = templateId !== 'none' && !!currentTpl?.content_zh;

  const handleTemplateChange = (id: string) => {
    setTemplateId(id);
    if (id === 'none') return;
    const enKey = `${id}_en`;
    const zhKey = `${id}_zh`;
    if (!edited[enKey]) setMessages(m => ({ ...m, [enKey]: resolve(id, 'en') }));
    if (!edited[zhKey]) setMessages(m => ({ ...m, [zhKey]: resolve(id, 'zh') }));
  };

  // Lead context info
  const statusCfg = contact.status ? statusCfgOf(contact.status) : null;
  const apptInfo = contact.appointmentStart ? (() => {
    const d = new Date(contact.appointmentStart);
    const { text: rel } = relDays(contact.appointmentStart);
    const dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
    return { dateStr, timeStr, rel };
  })() : null;

  const childAge = contact.childDob ? (() => {
    const dob = new Date(contact.childDob);
    const now = new Date();
    let y = now.getFullYear() - dob.getFullYear();
    if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) y--;
    return y >= 0 ? y : null;
  })() : null;

  const submittedStr = contact.submittedAt ? (() => {
    const d = new Date(contact.submittedAt);
    const { text: rel } = relDays(contact.submittedAt);
    const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${dateStr} (${rel})`;
  })() : null;

  const hasMetadata = !!(childAge !== null || submittedStr || apptInfo);

  // Segmented language control
  const langSeg = hasZh ? (
    <div style={{ display: 'inline-flex', borderRadius: 6, background: '#f1f5f9', padding: 2 }}>
      {(['en', 'zh'] as const).map(t => (
        <button key={t} onClick={() => setLang(t)} style={{
          padding: '3px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', lineHeight: '16px',
          border: 'none', borderRadius: 4,
          background: lang === t ? '#fff' : 'transparent',
          color: lang === t ? '#1e293b' : '#94a3b8',
          boxShadow: lang === t ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
          transition: 'all 0.15s',
        }}>{t === 'en' ? 'EN' : '中文'}</button>
      ))}
    </div>
  ) : null;

  return (
    <div style={am.backdrop}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden' as const }} onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{contact.childName}</h2>
                {statusCfg && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: statusCfg.color, flexShrink: 0 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusCfg.dot }} />
                    {statusCfg.label}
                  </span>
                )}
              </div>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#78849b', fontVariantNumeric: 'tabular-nums' }}>{contact.parentPhone}</p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 15, cursor: 'pointer', color: '#b0b8c9', padding: '2px 4px', lineHeight: 1, borderRadius: 4 }}><FontAwesomeIcon icon={faXmark} /></button>
          </div>
        </div>

        {/* ── Lead Context ── */}
        {(hasMetadata || contact.notes) && (
          <div style={{ padding: '0 24px' }}>
            <div style={{ background: '#fafbfc', borderRadius: 8, border: '1px solid #ebeef3', marginTop: 16 }}>
              {/* Metadata grid */}
              {hasMetadata && (
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 0', padding: '11px 14px', fontSize: 12 }}>
                  {childAge !== null && (<>
                    <span style={{ color: '#8893a7', paddingRight: 14, fontWeight: 500 }}>Age</span>
                    <span style={{ color: '#1e293b', fontWeight: 500 }}>{childAge} years old</span>
                  </>)}
                  {submittedStr && (<>
                    <span style={{ color: '#8893a7', paddingRight: 14, fontWeight: 500 }}>Enquiry</span>
                    <span style={{ color: '#475569' }}>{submittedStr}</span>
                  </>)}
                  {apptInfo && (<>
                    <span style={{ color: '#8893a7', paddingRight: 14, fontWeight: 500 }}>Visit</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#1e293b', fontWeight: 500 }}>{apptInfo.dateStr}, {apptInfo.timeStr}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#b45309', background: '#fef9c3', borderRadius: 20, padding: '1px 8px', lineHeight: '16px' }}>{apptInfo.rel}</span>
                    </div>
                  </>)}
                </div>
              )}
              {/* Notes */}
              {contact.notes && (
                <div style={{
                  padding: '9px 14px 10px', fontSize: 12, color: '#64748b', lineHeight: 1.5, whiteSpace: 'pre-wrap' as const,
                  ...(hasMetadata ? { borderTop: '1px solid #ebeef3' } : {}),
                  background: hasMetadata ? '#f5f6f8' : 'transparent', borderRadius: hasMetadata ? '0 0 8px 8px' : 8,
                }}>
                  <span style={{ color: '#8893a7', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'block', marginBottom: 3 }}>Note</span>
                  <span style={{ color: '#475569' }}>{contact.notes}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Message Composer ── */}
        <div style={{ padding: '16px 24px 0' }}>
          {/* Controls row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <select value={templateId} onChange={e => handleTemplateChange(e.target.value)} style={{
              padding: '4px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', appearance: 'auto' as const, background: '#fff', color: '#334155',
            }}>
              <option value="none">No template</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div style={{ flex: 1 }} />
            {langSeg}
          </div>

          {/* Textarea */}
          <textarea
            placeholder="Type your message..."
            style={{
              display: 'block', width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
              fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const, background: '#fff',
              height: 120, resize: 'vertical' as const, lineHeight: 1.5, color: '#1e293b',
            }}
            value={currentMsg}
            onChange={e => { setMessages(m => ({ ...m, [key]: e.target.value })); setEdited(ed => ({ ...ed, [key]: true })); }}
          />
          {edited[key] && templateId !== 'none' && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontStyle: 'italic' as const }}>Modified from template</div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '16px 24px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', background: 'none', border: 'none', borderRadius: 8,
            cursor: 'pointer', fontSize: 13, color: '#94a3b8', fontWeight: 500,
          }}>Cancel</button>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => window.open(whatsappUrl(contact.parentPhone, currentMsg), '_blank', 'noopener,noreferrer')}
            style={{
              padding: '9px 22px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8,
              cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7,
              boxShadow: '0 1px 3px rgba(34,197,94,0.3)',
            }}
          >
            <FontAwesomeIcon icon={faWhatsapp} style={{ fontSize: 15 }} />
            Send via WhatsApp
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} style={{ fontSize: 9, opacity: 0.7, marginLeft: 1 }} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Decline Modal ──────────────────────────────────────────────────────────────

function DeclineModal({ lead, lostReasons, onClose, onDeclined }: {
  lead: Lead; lostReasons: string[]; onClose: () => void; onDeclined: () => void;
}) {
  const [reason, setReason] = useState('');
  const [otherText, setOtherText] = useState('');
  const [notes, setNotes] = useState(lead.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isOther = reason === 'Others';
  const finalReason = isOther ? otherText.trim() : reason;

  const handleConfirm = async () => {
    if (!reason) { setError('Please select a reason.'); return; }
    if (isOther && !otherText.trim()) { setError('Please describe the reason.'); return; }
    setSaving(true);
    try {
      await updateLead(lead.id, { status: 'LOST', lostReason: finalReason, notes: notes.trim() });
      onDeclined(); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#1a202c' }}>Not Enrolling</h3>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: '#718096' }}>{lead.childName} · {lead.parentPhone}</p>
        <label style={{ display: 'flex', flexDirection: 'column' as const, gap: 5, fontSize: 13, fontWeight: 600, color: '#4a5568', marginBottom: 12 }}>
          <span>Notes <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>(optional)</span></span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add any remarks before confirming…"
            style={{ padding: '8px 10px', border: '1px solid #cbd5e0', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: '#fafafa', resize: 'vertical' as const, height: 72, lineHeight: 1.5 }}
          />
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#4a5568', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Reason <span style={{ color: '#e53e3e' }}>*</span></span>
            <select value={reason} onChange={e => { setReason(e.target.value); setError(''); }}
              style={{ padding: '8px 10px', border: '1px solid #cbd5e0', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', background: '#fafafa' }}>
              <option value="">— select reason —</option>
              {lostReasons.map(r => <option key={r} value={r}>{r}</option>)}
              <option value="Others">Others</option>
            </select>
          </label>
          {isOther && (
            <textarea
              autoFocus
              placeholder="Describe the reason…"
              value={otherText}
              onChange={e => { setOtherText(e.target.value); setError(''); }}
              style={{ padding: '8px 10px', border: '1px solid #cbd5e0', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', background: '#fafafa', resize: 'vertical', height: 80 }}
            />
          )}
        </div>
        {error && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 8 }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 7, cursor: 'pointer', fontSize: 13, color: '#4a5568' }}>Cancel</button>
          <button onClick={handleConfirm} disabled={saving}
            style={{ padding: '8px 18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reject Modal ────────────────────────────────────────────────────────────────

function RejectModal({ lead, lostReasons, onClose, onRejected }: {
  lead: Lead; lostReasons: string[]; onClose: () => void; onRejected: () => void;
}) {
  const [reason, setReason] = useState('');
  const [otherText, setOtherText] = useState('');
  const [notes, setNotes] = useState(lead.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isOther = reason === 'Others';
  const finalReason = isOther ? otherText.trim() : reason;

  const handleConfirm = async () => {
    if (!reason) { setError('Please select a reason.'); return; }
    if (isOther && !otherText.trim()) { setError('Please describe the reason.'); return; }
    setSaving(true);
    try {
      await updateLead(lead.id, { status: 'REJECTED', lostReason: finalReason, notes: notes.trim() });
      onRejected(); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#1a202c' }}>Reject Lead</h3>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: '#718096' }}>{lead.childName} · {lead.parentPhone}</p>
        <label style={{ display: 'flex', flexDirection: 'column' as const, gap: 5, fontSize: 13, fontWeight: 600, color: '#4a5568', marginBottom: 12 }}>
          <span>Notes <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>(optional)</span></span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add any remarks before rejecting…"
            style={{ padding: '8px 10px', border: '1px solid #cbd5e0', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: '#fafafa', resize: 'vertical' as const, height: 72, lineHeight: 1.5 }}
          />
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#4a5568', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Reason <span style={{ color: '#e53e3e' }}>*</span></span>
            <select value={reason} onChange={e => { setReason(e.target.value); setError(''); }}
              style={{ padding: '8px 10px', border: '1px solid #cbd5e0', borderRadius: 6, fontSize: 13, background: '#fafafa', cursor: 'pointer' }}>
              <option value="">— select reason —</option>
              {lostReasons.map(r => <option key={r} value={r}>{r}</option>)}
              <option value="Others">Others</option>
            </select>
          </label>
          {isOther && (
            <input value={otherText} onChange={e => { setOtherText(e.target.value); setError(''); }}
              placeholder="Describe the reason…" autoFocus
              style={{ padding: '8px 10px', border: '1px solid #cbd5e0', borderRadius: 6, fontSize: 13, background: '#fafafa' }} />
          )}
        </div>
        {error && <p style={{ color: '#e53e3e', fontSize: 13, marginTop: 6 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f7fafc', color: '#4a5568', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Cancel</button>
          {(() => {
            const canReject = !!finalReason && !saving;
            return (
              <button onClick={handleConfirm} disabled={!canReject}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#92400e', color: '#fff', cursor: canReject ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: 14, opacity: canReject ? 1 : 0.5 }}>
                {saving ? 'Saving…' : 'Reject'}
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ── Edit Modal ─────────────────────────────────────────────────────────────────

// The lost-reason list is owned by the backend settings API — system-pinned
// labels are always prepended server-side via normalizeLostReasons(), so the
// frontend just consumes the list verbatim.

function NotesModal({ lead, onClose, onSaved }: {
  lead: Lead; onClose: () => void; onSaved: (updated: Lead) => void;
}) {
  const [notes, setNotes] = useState(lead.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const updated = await updateLead(lead.id, { notes });
      onSaved(updated);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div style={mo.backdrop}>
      <div style={{ ...mo.card, maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div style={mo.header}>
          <h2 style={mo.title}><FontAwesomeIcon icon={faNoteSticky} style={{ marginRight: 8, color: '#94a3b8' }} />Notes — {lead.childName}</h2>
          <button onClick={onClose} style={mo.closeBtn}><FontAwesomeIcon icon={faXmark} /></button>
        </div>
        <textarea
          autoFocus
          style={{ ...mo.input, height: 120, resize: 'vertical', fontSize: 13, lineHeight: 1.5 }}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Add notes about this lead..."
        />
        {error && <p style={{ color: '#e53e3e', fontSize: 13, marginTop: 8 }}>{error}</p>}
        <div style={mo.footer}>
          <button type="button" onClick={onClose} style={mo.cancelBtn}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={mo.saveBtn}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

interface EditForm {
  childName: string; parentPhone: string; childDob: string;
  enrolmentYear: string; status: LeadStatus; notes: string; lostReason: string;
  relationship: string; programme: string; howDidYouKnow: string;
  addressLocation: string; needsTransport: string; preferredAppointmentTime: string;
  attendedDate: string;
}

const RELATIONSHIP_OPTIONS = ['Mother', 'Father', 'Guardian', 'Grandparent', 'Other'];
const PROGRAMME_OPTIONS = [
  { value: 'Core', label: '日常课程 Core' },
  { value: 'Core+Music', label: '日常+音乐 Core+Music' },
  { value: 'FullDay', label: 'Full Day 学习生活' },
];
const MARKETING_CHANNELS = ['Facebook', 'Instagram', 'Google', 'Friend Referral', 'Walk-in', 'Banner/Flyer', 'Other'];

type EditTab = 'child' | 'contact' | 'other';
const EDIT_TABS: { key: EditTab; label: string }[] = [
  { key: 'child', label: 'Child' },
  { key: 'contact', label: 'Contact' },
  { key: 'other', label: 'Other' },
];

function programmeLabel(val: string): string {
  return PROGRAMME_OPTIONS.find(p => p.value === val)?.label || val || '—';
}
function transportLabel(val: boolean | number | null): string {
  if (val === true || val === 1) return 'Yes';
  if (val === false || val === 0) return 'No';
  return '—';
}
function statusDisplayLabel(s: string): string {
  const map: Record<string, string> = { NEW: 'New', CONTACTED: 'Contacted', APPOINTMENT_BOOKED: 'Appt Booked', FOLLOW_UP: 'Follow-Up', ENROLLED: 'Enrolled', LOST: 'Lost', REJECTED: 'Rejected' };
  return map[s] || s;
}

function EditModal({ lead, lostReasons, onClose, onSaved }: {
  lead: Lead; lostReasons: string[]; onClose: () => void; onSaved: (updated: Lead) => void;
}) {
  const [tab, setTab] = useState<EditTab>('child');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm>({
    childName: lead.childName, parentPhone: lead.parentPhone,
    childDob: lead.childDob.split('T')[0], enrolmentYear: String(lead.enrolmentYear),
    status: lead.status, notes: lead.notes ?? '', lostReason: lead.lostReason ?? '',
    relationship: lead.relationship ?? '', programme: lead.programme ?? '',
    howDidYouKnow: lead.howDidYouKnow ?? '', addressLocation: lead.addressLocation ?? '',
    needsTransport: lead.needsTransport === null ? '' : lead.needsTransport ? 'yes' : 'no',
    preferredAppointmentTime: lead.preferredAppointmentTime ?? '',
    attendedDate: lead.status === 'FOLLOW_UP' && lead.statusChangedAt ? new Date(lead.statusChangedAt).toISOString().split('T')[0] : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (field: keyof EditForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const childAge = lead.enrolmentYear - new Date(lead.childDob).getFullYear();
  const statusCfg = statusCfgOf(lead.status);
  const statusDate = lead.statusChangedAt || lead.submittedAt;
  const statusDaysAgo = Math.floor((Date.now() - new Date(statusDate).getTime()) / 86400000);
  const statusAction: Record<string, string> = { NEW: 'Submitted', CONTACTED: 'Contacted', APPOINTMENT_BOOKED: 'Booked', FOLLOW_UP: 'Attended', ENROLLED: 'Enrolled', LOST: 'Lost', REJECTED: 'Rejected' };
  const statusTimeLabel = `${statusAction[lead.status] || 'Updated'} ${statusDaysAgo === 0 ? 'today' : `${statusDaysAgo}d ago`}`;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((form.status === 'LOST' || form.status === 'REJECTED') && !form.lostReason) { setError(`Please select a reason for marking this lead as ${form.status === 'REJECTED' ? 'Rejected' : 'Lost'}.`); return; }
    setSaving(true); setError('');
    try {
      const payload: UpdateLeadPayload = {
        childName: form.childName, parentPhone: form.parentPhone, childDob: form.childDob,
        enrolmentYear: Number(form.enrolmentYear), status: form.status, notes: form.notes,
        lostReason: (form.status === 'LOST' || form.status === 'REJECTED') ? form.lostReason : null,
        relationship: form.relationship || null, programme: form.programme || null,
        howDidYouKnow: form.howDidYouKnow || null, addressLocation: form.addressLocation || null,
        needsTransport: form.needsTransport === '' ? null : form.needsTransport === 'yes',
        preferredAppointmentTime: form.preferredAppointmentTime || null,
        ...(form.status === 'FOLLOW_UP' && form.attendedDate ? { statusChangedAt: new Date(form.attendedDate).toISOString() } : {}),
      };
      const updated = await updateLead(lead.id, payload);
      onSaved(updated);
      setEditing(false);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleCancel = () => {
    setForm({
      childName: lead.childName, parentPhone: lead.parentPhone,
      childDob: lead.childDob.split('T')[0], enrolmentYear: String(lead.enrolmentYear),
      status: lead.status, notes: lead.notes ?? '', lostReason: lead.lostReason ?? '',
      relationship: lead.relationship ?? '', programme: lead.programme ?? '',
      howDidYouKnow: lead.howDidYouKnow ?? '', addressLocation: lead.addressLocation ?? '',
      needsTransport: lead.needsTransport === null ? '' : lead.needsTransport ? 'yes' : 'no',
      preferredAppointmentTime: lead.preferredAppointmentTime ?? '',
      attendedDate: lead.status === 'FOLLOW_UP' && lead.statusChangedAt ? new Date(lead.statusChangedAt).toISOString().split('T')[0] : '',
    });
    setEditing(false);
    setError('');
  };

  const ViewRow = ({ label, value }: { label: string; value: string }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: value && value !== '—' ? '#1e293b' : '#cbd5e1', fontWeight: 500 }}>{value || '—'}</span>
    </div>
  );

  return (
    <div style={mo.backdrop}>
      <div style={{ ...mo.card, maxWidth: 480 }} onClick={e => e.stopPropagation()}>

        {/* ── Profile Header ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#1e293b' }}>{lead.childName}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  Age {childAge} · {lead.enrolmentYear} Intake
                  {lead.programme ? ` · ${programmeLabel(lead.programme)}` : ''}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                  background: statusCfg.dot + '18', color: statusCfg.color,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusCfg.dot }} />
                  {statusCfg.label}
                </span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  {lead.relationship && `${lead.relationship} · `}{statusTimeLabel}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginTop: 2 }}>
              {!editing && (
                <button onClick={() => setEditing(true)} style={{
                  padding: '4px 10px', fontSize: 11, fontWeight: 600, color: '#64748b',
                  background: 'none', border: '1px solid #e2e8f0', borderRadius: 5,
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                }}>
                  <FontAwesomeIcon icon={faPen} style={{ fontSize: 10, marginRight: 4 }} />Edit
                </button>
              )}
              <button onClick={onClose} style={{ ...mo.closeBtn, fontSize: 16 }}><FontAwesomeIcon icon={faXmark} /></button>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e2e8f0', marginBottom: 18 }}>
          {EDIT_TABS.map(t => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} style={{
              padding: '7px 18px', fontSize: 12, fontWeight: tab === t.key ? 700 : 500, cursor: 'pointer',
              background: 'none', border: 'none', borderBottom: tab === t.key ? '2px solid #3c339a' : '2px solid transparent',
              color: tab === t.key ? '#3c339a' : '#b0b8c4', transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
        </div>

        <form onSubmit={handleSave}>
          <div style={{ minHeight: 180 }}>
            {/* ── Child tab ── */}
            {tab === 'child' && !editing && (
              <div>
                <ViewRow label="Child Name" value={lead.childName} />
                <ViewRow label="Date of Birth" value={new Date(lead.childDob).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} />
                <ViewRow label="Enrollment Year" value={String(lead.enrolmentYear)} />
                <ViewRow label="Programme" value={programmeLabel(lead.programme ?? '')} />
              </div>
            )}
            {tab === 'child' && editing && (
              <div style={mo.grid}>
                <label style={mo.label}>Child Name<input style={mo.input} value={form.childName} onChange={set('childName')} required /></label>
                <label style={mo.label}>Date of Birth<input style={mo.input} type="date" value={form.childDob} onChange={set('childDob')} max={new Date().toISOString().split('T')[0]} required /></label>
                <label style={mo.label}>Enrollment Year
                  <select style={mo.input} value={form.enrolmentYear} onChange={set('enrolmentYear')}>
                    {ENROLMENT_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </label>
                <label style={mo.label}>Programme<input style={mo.input} value={form.programme} onChange={set('programme')} placeholder="e.g. Core, FullDay" /></label>
              </div>
            )}

            {/* ── Contact tab ── */}
            {tab === 'contact' && !editing && (
              <div>
                <ViewRow label="Phone" value={lead.parentPhone} />
                <ViewRow label="Relationship" value={lead.relationship || '—'} />
                <ViewRow label="Location" value={lead.addressLocation || '—'} />
                <ViewRow label="Transport" value={transportLabel(lead.needsTransport)} />
              </div>
            )}
            {tab === 'contact' && editing && (
              <div style={mo.grid}>
                <label style={mo.label}>Phone<input style={mo.input} value={form.parentPhone} onChange={set('parentPhone')} required /></label>
                <label style={mo.label}>Relationship
                  <select style={mo.input} value={form.relationship} onChange={set('relationship')}>
                    <option value="">—</option>
                    {RELATIONSHIP_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                <label style={mo.label}>Location<input style={mo.input} value={form.addressLocation} onChange={set('addressLocation')} placeholder="e.g. Bukit Indah" /></label>
                <label style={mo.label}>Transport
                  <select style={mo.input} value={form.needsTransport} onChange={set('needsTransport')}>
                    <option value="">—</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
              </div>
            )}

            {/* ── Other tab ── */}
            {tab === 'other' && !editing && (
              <div>
                <ViewRow label="Source" value={lead.howDidYouKnow || '—'} />
                {lead.utmSource && <ViewRow label="UTM Source" value={lead.utmSource} />}
                <ViewRow label="Visit Preference" value={lead.preferredAppointmentTime || '—'} />
                <ViewRow label="Status" value={statusDisplayLabel(lead.status)} />
                {lead.status === 'FOLLOW_UP' && lead.statusChangedAt && (
                  <ViewRow label="Attended Date" value={new Date(lead.statusChangedAt).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })} />
                )}
                {(lead.status === 'LOST' || lead.status === 'REJECTED') && <ViewRow label={lead.status === 'REJECTED' ? 'Reject Reason' : 'Lost Reason'} value={lead.lostReason || '—'} />}
                {lead.notes && (
                  <div style={{ marginTop: 12, background: '#f8fafc', borderRadius: 8, padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>Notes</span>
                    <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0', lineHeight: 1.6 }}>{lead.notes}</p>
                  </div>
                )}
              </div>
            )}
            {tab === 'other' && editing && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={mo.grid}>
                  <label style={mo.label}>Source
                    <select style={mo.input} value={form.howDidYouKnow} onChange={set('howDidYouKnow')}>
                      <option value="">—</option>
                      {MARKETING_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label style={mo.label}>Visit Preference<input style={mo.input} value={form.preferredAppointmentTime} onChange={set('preferredAppointmentTime')} placeholder="e.g. Weekday afternoon" /></label>
                  <label style={mo.label}>Status
                    <select style={mo.input} value={form.status} onChange={set('status')}>
                      {STATUSES.filter(s => (s !== 'ENROLLED' || lead.status === 'ENROLLED') && (s !== 'REJECTED' || lead.status === 'REJECTED')).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  {form.status === 'FOLLOW_UP' && (
                    <label style={mo.label}>Attended Date
                      <input type="date" style={mo.input} value={form.attendedDate} onChange={set('attendedDate')} />
                    </label>
                  )}
                  {(form.status === 'LOST' || form.status === 'REJECTED') && (
                    <label style={mo.label}>
                      <span>{form.status === 'REJECTED' ? 'Reject' : 'Lost'} Reason <span style={{ color: '#e53e3e' }}>*</span></span>
                      <select style={mo.input} value={form.lostReason} onChange={set('lostReason')} required>
                        <option value="">— select reason —</option>
                        {lostReasons.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </label>
                  )}
                </div>
                <label style={mo.label}>
                  Notes
                  <textarea style={{ ...mo.input, height: 60, resize: 'vertical' }} value={form.notes} onChange={set('notes')} placeholder="Optional notes..." />
                </label>
              </div>
            )}
          </div>

          {error && <p style={{ color: '#e53e3e', fontSize: 13, marginTop: 8 }}>{error}</p>}

          {editing && (
            <div style={mo.footer}>
              <button type="button" onClick={handleCancel} style={mo.cancelBtn}>Cancel</button>
              <button type="submit" disabled={saving} style={mo.saveBtn}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// ── Enrollment Modal ────────────────────────────────────────────────────────────

function EnrollmentModal({ lead, onClose, onEnrolled }: { lead: Lead; onClose: () => void; onEnrolled: () => void }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedProgramme, setSelectedProgramme] = useState('');
  const [selectedAge, setSelectedAge] = useState<number | ''>('');
  const [paymentDate, setPaymentDate] = useState(todayStr);
  const [startDate, setStartDate] = useState(() => {
    const ref = lead.appointmentStart ?? lead.submittedAt;
    const base = ref ? new Date(ref) : new Date();
    base.setDate(base.getDate() + 7);
    return base.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const enrolmentYear = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear();
  const enrolmentMonth = startDate ? new Date(startDate).getMonth() + 1 : new Date().getMonth() + 1;

  const { data: availableYears = [] } = useQuery({ queryKey: ['packageYears'], queryFn: fetchPackageYears });
  const { data: packages = [], isLoading: loadingPkgs } = useQuery({
    queryKey: ['packages', enrolmentYear], queryFn: () => fetchPackages(enrolmentYear), enabled: !!enrolmentYear,
  });

  // Derive unique programmes and ages from packages
  const programmes = [...new Set(packages.map((p: Package) => p.programme))];
  const ages = [...new Set(packages.map((p: Package) => p.age))].sort((a, b) => a - b);

  // Auto-select based on child age and lead programme
  useEffect(() => {
    if (packages.length > 0) {
      const childAge = enrolmentYear - new Date(lead.childDob).getFullYear();
      setSelectedAge(ages.includes(childAge) ? childAge : ages[0] ?? '');
      // Match lead's programme if available
      const leadProg = lead.programme;
      if (leadProg && programmes.some(p => p.toLowerCase().includes(leadProg.toLowerCase()))) {
        setSelectedProgramme(programmes.find(p => p.toLowerCase().includes(leadProg.toLowerCase())) || programmes[0]);
      } else {
        setSelectedProgramme(programmes[0] || '');
      }
    }
  }, [packages]);

  // Resolve package ID from programme + age
  const selectedPackageId = packages.find((p: Package) => p.programme === selectedProgramme && p.age === selectedAge)?.id || '';

  const handleSubmit = async () => {
    if (!startDate) { setError('Please enter a first day of school'); return; }
    if (!selectedPackageId) { setError('Please select a package'); return; }
    if (!paymentDate) { setError('Please enter a payment date'); return; }
    if (!availableYears.includes(enrolmentYear)) { setError(`No packages available for ${enrolmentYear}`); return; }
    setSubmitting(true); setError('');
    try {
      await createStudent({ leadId: lead.id, enrolmentYear, enrolmentMonth, packageId: selectedPackageId, enrolledAt: new Date(paymentDate).toISOString(), startDate, notes: notes || undefined });
      onEnrolled(); onClose();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Enrollment failed'); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={mo.backdrop}>
      <div style={mo.card} onClick={e => e.stopPropagation()}>
        <div style={mo.header}>
          <h2 style={mo.title}>Enroll Student</h2>
          <button onClick={onClose} style={mo.closeBtn}><FontAwesomeIcon icon={faXmark} /></button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: '#4a5568' }}>Enrolling <strong>{lead.childName}</strong></p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={mo.label}>Payment Date<input type="date" style={mo.input} value={paymentDate} onChange={e => setPaymentDate(e.target.value)} required /></label>
          <label style={mo.label}>
            First Day of School
            <input type="date" style={mo.input} value={startDate} onChange={e => setStartDate(e.target.value)} required />
          </label>
          <label style={mo.label}>
            Enrolment Year
            <input type="text" style={{ ...mo.input, background: '#f8fafc', color: '#64748b' }} value={enrolmentYear} disabled />
          </label>
          {loadingPkgs ? <span style={{ fontSize: 13, color: '#a0aec0' }}>Loading packages…</span>
            : packages.length === 0
              ? <span style={{ fontSize: 13, color: '#a0aec0' }}>No packages for {enrolmentYear}</span>
            : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={mo.label}>
                  Programme
                  <select style={mo.input} value={selectedProgramme} onChange={e => setSelectedProgramme(e.target.value)}>
                    {programmes.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <label style={mo.label}>
                  Age Group
                  <select style={mo.input} value={selectedAge} onChange={e => setSelectedAge(Number(e.target.value))}>
                    {ages.map(a => <option key={a} value={a}>Age {a}</option>)}
                  </select>
                </label>
              </div>
            )}
          <label style={mo.label}>Notes<textarea style={{ ...mo.input, height: 72, resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" /></label>
        </div>
        {error && <p style={{ color: '#e53e3e', fontSize: 13, marginTop: 12 }}>{error}</p>}
        <div style={mo.footer}>
          <button onClick={onClose} style={mo.cancelBtn}>Cancel</button>
          <button onClick={handleSubmit} disabled={submitting || availableYears.length === 0 || packages.length === 0} style={{ ...mo.saveBtn, background: '#38a169' }}>
            {submitting ? 'Enrolling…' : 'Confirm Enrollment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const { isMobile, isTablet } = useIsMobile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [selectedStage, setSelectedStage] = useState<PipelineStage>('all_active');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState('appointments');
  const [sortBy, setSortBy] = useState<SortField>('submittedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [notesLead, setNotesLead] = useState<Lead | null>(null);
  const [bookingLead, setBookingLead] = useState<Lead | null>(null);
  const [bookingIntent, setBookingIntent] = useState<'book' | 'reschedule'>('book');
  const [whatsappContact, setWhatsappContact] = useState<WhatsAppContact | null>(null);
  const [whatsappDefaultTemplate, setWhatsappDefaultTemplate] = useState('none');
  const openWhatsApp = (contact: WhatsAppContact, template = 'none') => { setWhatsappContact(contact); setWhatsappDefaultTemplate(template); };
  const findLeadById = (id: string): Lead | undefined => {
    for (const key of [['leads'], ['leads-follow-up'], ['leads-appt-booked']] as const) {
      const cached = queryClient.getQueriesData<LeadsResponse>({ queryKey: key });
      for (const [, resp] of cached) { const found = resp?.items?.find(l => l.id === id); if (found) return found; }
    }
    return undefined;
  };
  const [enrollingLead, setEnrollingLead] = useState<Lead | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void; destructive?: boolean; details?: string[] } | null>(null);
  const { confirm: confirmDelete } = useDeleteDialog();
  const { showToast } = useToast();
  const [confirmBookingLead, setConfirmBookingLead] = useState<Lead | null>(null);
  const [confirmBookingLang, setConfirmBookingLang] = useState<'en' | 'zh'>('zh');
  const [confirmBookingTplId, setConfirmBookingTplId] = useState('confirm_appointment');
  const [cbMsgEdited, setCbMsgEdited] = useState(''); // user-edited message, empty = use template
  const [cbStatus, setCbStatus] = useState<'idle' | 'confirming' | 'calendarFailed' | 'done'>('idle');
  const [cbCalendarError, setCbCalendarError] = useState('');
  const [cbPendingWa, setCbPendingWa] = useState(false); // was the user trying to send WA?
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, bottom: 0, right: 0 });
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [rowResults, setRowResults] = useState<Record<string, { link?: string | null; error?: string }>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [selectedTrashIds, setSelectedTrashIds] = useState<Set<string>>(new Set());
  const [attendedLead, setAttendedLead] = useState<Lead | null>(null);
  const [attendedNotes, setAttendedNotes] = useState('');
  const [attendedDate, setAttendedDate] = useState('');
  const [decliningLead, setDecliningLead] = useState<Lead | null>(null);
  const [rejectingLead, setRejectingLead] = useState<Lead | null>(null);

  useEffect(() => {
    const close = () => setMenuOpenId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const apiFilterStatus = selectedStage === 'all_active' ? 'active' : selectedStage;
  const isClosed = selectedStage === 'ENROLLED' || selectedStage === 'LOST' || selectedStage === 'REJECTED';
  const [closedYear, setClosedYear] = useState<number>(new Date().getFullYear());
  const apiYear = isClosed ? closedYear : undefined;

  const handleStageSelect = (stage: PipelineStage) => { setSelectedStage(stage); setPage(1); };

  // SSE: real-time lead updates
  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const es = new EventSource(`${baseUrl}/api/events`);
    es.addEventListener('new-lead', () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads-follow-up'] });
      queryClient.invalidateQueries({ queryKey: ['leads-appt-booked'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
      queryClient.invalidateQueries({ queryKey: ['upcomingAppointments'] });
    });
    return () => es.close();
  }, [queryClient]);

  const apiSort = sortBy === 'intent' ? 'submittedAt' : sortBy;
  const apiOrder = sortBy === 'intent' ? 'desc' : sortOrder;
  const { data: rawData, isLoading, isError, error } = useQuery({
    queryKey: ['leads', page, pageSize, apiFilterStatus, apiSort, apiOrder, debouncedSearch, apiYear],
    queryFn: () => fetchLeads(page, pageSize, apiFilterStatus || undefined, apiSort, apiOrder, debouncedSearch || undefined, apiYear),
    enabled: selectedStage !== 'TRASH',
    refetchInterval: 30_000,
    staleTime: 0,
  });

  const data = rawData ? {
    ...rawData,
    items: sortBy === 'intent'
      ? [...rawData.items].sort((a, b) => {
          const scoreA = getLeadHeat(a.ctaSource).level;
          const scoreB = getLeadHeat(b.ctaSource).level;
          return sortOrder === 'desc' ? scoreB - scoreA : scoreA - scoreB;
        })
      : rawData.items,
  } : undefined;

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });

  const { data: upcomingAppts = [] } = useQuery({
    queryKey: ['upcomingAppointments'], queryFn: fetchUpcomingAppointments, refetchInterval: 60_000,
  });

  const { data: followUpData } = useQuery({
    queryKey: ['leads-follow-up'],
    queryFn: () => fetchLeads(1, 50, 'FOLLOW_UP', 'submittedAt', 'asc'),
    refetchInterval: 60_000,
  });
  const followUpLeads = followUpData?.items ?? [];

  const { data: apptBookedData } = useQuery({
    queryKey: ['leads-appt-booked'],
    queryFn: () => fetchLeads(1, 50, 'APPOINTMENT_BOOKED', 'submittedAt', 'asc'),
    refetchInterval: 60_000,
  });

  const { data: stats } = useQuery({
    queryKey: ['lead-stats', closedYear], queryFn: () => fetchLeadStats(closedYear), staleTime: 0, refetchInterval: 60_000,
  });

  const { data: trashedLeads = [] } = useQuery({
    queryKey: ['leads-trash'],
    queryFn: fetchTrashedLeads,
    enabled: selectedStage === 'TRASH',
  });

  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`lead-row-${highlightId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => setHighlightId(null), 2000);
    return () => clearTimeout(t);
  }, [highlightId, data]);

  // Open edit modal from URL param ?edit=<leadId>
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && data?.items) {
      const lead = data.items.find(l => l.id === editId) ?? findLeadById(editId);
      if (lead) { setEditingLead(lead); setSearchParams({}, { replace: true }); }
    }
  }, [searchParams, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const waTemplate = settings?.whatsapp_template ?? 'Hi, this is KinderTech. Thanks for your enquiry for {{childName}}. Would you like to arrange a school visit?';
  const waTemplateZh = settings?.whatsapp_template_zh ?? '';
  const followUpTemplate = settings?.whatsapp_followup_template ?? "Hi, just following up on {{childName}}'s enquiry. Do you have any questions?";
  const followUpTemplateZh = settings?.whatsapp_followup_template_zh ?? '';
  const confirmApptTemplate = settings?.whatsapp_confirm_appt_template ?? 'Hi {{relationship}}, this is Ten Toes Preschool. We are pleased to confirm your school visit for {{childName}}.\n\nDate: {{appointmentDay}}, {{appointmentDate}}\nTime: {{appointmentTime}} - {{appointmentEndTime}}\nAddress: {{address}}\n\nPlease let us know if you need to reschedule. See you there!';
  const confirmApptTemplateZh = settings?.whatsapp_confirm_appt_template_zh ?? '您好{{relationship}}，这是Ten Toes Preschool。我们很高兴确认{{childName}}的参观预约。\n\n日期：{{appointmentDay}} {{appointmentDate}}\n时间：{{appointmentTime}} - {{appointmentEndTime}}\n地址：{{address}}\n\n如需改期，请提前通知我们。期待您的到来！';
  const kinderAddress = typeof settings?.kinder_address === 'string' ? settings.kinder_address : '';
  const apptDuration = typeof settings?.appointment_duration_minutes === 'number' ? settings.appointment_duration_minutes : 30;

  // Build unified template list for WhatsApp modal
  const waTemplates: WaTemplateOption[] = [
    { id: 'enquiry', name: 'Enquiry', content_en: String(waTemplate), content_zh: String(waTemplateZh) },
    { id: 'follow_up', name: 'Follow Up', content_en: String(followUpTemplate), content_zh: String(followUpTemplateZh) },
    { id: 'confirm_appointment', name: 'Confirm Appointment', content_en: String(confirmApptTemplate), content_zh: String(confirmApptTemplateZh) },
    ...(Array.isArray(settings?.whatsapp_custom_templates)
      ? (settings.whatsapp_custom_templates as { id: string; name: string; content_en: string; content_zh: string }[]).map(t => ({
          id: t.id, name: t.name, content_en: t.content_en, content_zh: t.content_zh,
        }))
      : []),
  ];
  const lostReasons: string[] = Array.isArray(settings?.lost_reasons)
    ? (settings.lost_reasons as string[])
    : [];

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    queryClient.invalidateQueries({ queryKey: ['leads-follow-up'] });
    queryClient.invalidateQueries({ queryKey: ['leads-appt-booked'] });
    queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
    queryClient.invalidateQueries({ queryKey: ['upcomingAppointments'] });
    queryClient.invalidateQueries({ queryKey: ['analytics'] });
    queryClient.invalidateQueries({ queryKey: ['sales-analytics'] });
  };

  const handleConfirmAppointment = async (lead: Lead, appointmentStart: string, waMessage: string, isPlaceholder: boolean) => {
    try {
      const result = await createAppointment(lead.id, appointmentStart, waMessage, isPlaceholder);
      setRowResults(prev => ({ ...prev, [lead.id]: { link: result.googleEventLink } }));
      invalidateAll();
      showToast('Appointment booked — calendar event created.', 'success', result.googleEventLink ?? undefined);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Google calendar not connected')) {
        const { url } = await getConnectToken();
        sessionStorage.setItem('google_return_to', window.location.pathname);
        window.location.href = url;
        return;
      }
      throw err;
    }
  };

  const handleConfirmAppointmentNoCalendar = async (lead: Lead, appointmentStart: string, waMessage: string, isPlaceholder: boolean) => {
    await createAppointment(lead.id, appointmentStart, waMessage, isPlaceholder, true);
    invalidateAll();
    showToast('Appointment booked (calendar not synced).', 'success');
  };

  async function handleExport() {
    if (!data || data.total === 0) return;
    setIsExporting(true);
    try {
      const all = await fetchLeads(1, data.total, apiFilterStatus || undefined, sortBy, sortOrder);
      const rows = all.items.map((l: Lead) => ({
        'Submitted At': l.submittedAt, 'Child Name': l.childName, 'Parent Phone': l.parentPhone,
        'Child Date of Birth': l.childDob ? l.childDob.toString().split('T')[0] : '',
        'Enrollment Year': l.enrolmentYear, 'Relationship to Child': l.relationship ?? '',
        'Programme': l.programme ?? '', 'Preferred Appointment Time': l.preferredAppointmentTime ?? '',
        'Address / Location': l.addressLocation ?? '',
        'Needs Transport': l.needsTransport == null ? '' : l.needsTransport ? 'Yes' : 'No',
        'How Did You Know': l.howDidYouKnow ?? '', 'UTM Source': l.utmSource ?? '', 'Status': l.status,
        'Notes': l.notes ?? '', 'Lost / Declined Reason': l.lostReason ?? '',
        'Appointment': l.appointmentStart ?? '',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-${apiFilterStatus || 'all'}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally { setIsExporting(false); }
  }

  const urgencyOrangeDays = typeof settings?.urgency_orange_days === 'number' ? settings.urgency_orange_days : 1;
  const urgencyRedDays = typeof settings?.urgency_red_days === 'number' ? settings.urgency_red_days : 3;

  async function requestMoveToTrash(lead: Lead) {
    const ok = await confirmDelete({
      entityType: 'Lead',
      entityName: lead.childName,
      actionLabel: 'Move to Trash',
      consequence: <>This will move <strong>{lead.childName}</strong> to Trash. You can restore them later.</>,
      onConfirm: async () => {
        await deleteLead(lead.id);
        invalidateAll();
        queryClient.invalidateQueries({ queryKey: ['leads-trash'] });
      },
    });
    if (ok) {
      showToast(`${lead.childName} moved to`, 'success', undefined, { label: 'Trash', onClick: () => handleStageSelect('TRASH') });
    }
  }

  async function markAttendance(lead: Lead, attended: boolean, notes?: string, attendedDateStr?: string) {
    try {
      await updateLead(lead.id, attended
        ? { status: 'FOLLOW_UP', attended: true, ...(notes ? { notes } : {}), ...(attendedDateStr ? { statusChangedAt: new Date(attendedDateStr).toISOString() } : {}) }
        : { status: 'LOST', lostReason: 'Missed appointment', attended: false },
      );
      invalidateAll();
      if (attended) {
        const id = lead.id;
        showToast(`${lead.childName} marked as attended — moved to`, 'success', undefined, { label: 'Follow Up', onClick: () => { handleStageSelect('FOLLOW_UP'); setHighlightId(id); } });
      } else {
        const id = lead.id;
        showToast(`${lead.childName} marked as no show — moved to`, 'success', undefined, { label: 'Lost', onClick: () => { handleStageSelect('LOST'); setHighlightId(id); } });
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Update failed', 'error');
    }
  }

  async function confirmBookingDirect(lead: Lead) {
    try {
      const result = await confirmAppointment(lead.id);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads-appt-booked'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
      queryClient.invalidateQueries({ queryKey: ['upcomingAppointments'] });
      showToast('Booking confirmed — calendar event updated.', 'success', result.googleEventLink ?? undefined);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to confirm booking', 'error');
    }
  }

  // ── Button style system ──
  const btnBase: React.CSSProperties = { padding: '5px 12px', border: '1px solid', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' as const, lineHeight: '18px', transition: 'all .12s ease' };
  const btnStyles = {
    bookVisit:       { ...btnBase, background: '#eef2fa', color: '#5a79c8', borderColor: '#c7d2e8' },
    confirmBooking:  { ...btnBase, background: '#f0fdfa', color: '#0d9488', borderColor: '#99f6e4' },
    attended:        { ...btnBase, background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' },
    enroll:          { ...btnBase, background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' },
    noShow:          { ...btnBase, background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' },
    notEnrolling:    { ...btnBase, background: '#fff', color: '#9f1239', borderColor: '#e2e8f0' },
    followUp:        { ...btnBase, background: '#eef2fa', color: '#5a79c8', borderColor: '#c7d2e8' },
    reject:          { ...btnBase, background: '#fffbeb', color: '#92400e', borderColor: '#fde68a' },
  };

  function getPrimaryAction(lead: Lead): { label: React.ReactNode; style: React.CSSProperties; action: () => void } | null {
    switch (lead.status) {
      case 'NEW':
        return { label: <><FontAwesomeIcon icon={faCalendarDays} style={{ marginRight: 6 }} /> Book Visit</>, style: btnStyles.bookVisit, action: () => { setBookingIntent('book'); setBookingLead(lead); } };
      case 'CONTACTED':
        return { label: <><FontAwesomeIcon icon={faCircleCheck} style={{ marginRight: 6 }} /> Confirm Booking</>, style: btnStyles.confirmBooking, action: () => setConfirmBookingLead(lead) };
      case 'APPOINTMENT_BOOKED':
        return { label: <><FontAwesomeIcon icon={faCircleCheck} style={{ marginRight: 6 }} /> Attended</>, style: btnStyles.attended, action: () => { setAttendedLead(lead); setAttendedNotes(''); setAttendedDate(lead.appointmentStart ? new Date(lead.appointmentStart).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]); } };
      case 'FOLLOW_UP':
        return { label: <><FontAwesomeIcon icon={faEnvelope} style={{ marginRight: 6 }} /> Follow Up</>, style: btnStyles.followUp, action: () => openWhatsApp(lead, 'follow_up') };
      default:
        return null;
    }
  }

  const STAGE_TITLES: Record<PipelineStage, string> = {
    all_active: 'All Active Leads', NEW: 'New Leads', CONTACTED: 'Contacted',
    APPOINTMENT_BOOKED: 'Appointment Booked', FOLLOW_UP: 'Follow-Up',
    ENROLLED: 'Enrolled', LOST: 'Lost / Declined', REJECTED: 'Rejected', TRASH: 'Trash',
  };
  const pageTitle = STAGE_TITLES[selectedStage];
  const isTrash = selectedStage === 'TRASH';

  const currentStageCfg = selectedStage !== 'all_active' && selectedStage !== 'TRASH'
    ? [...ACTIVE_STAGES, ...CLOSED_STAGES].find(s => s.key === selectedStage)
    : null;
  const stageAccentColor = currentStageCfg?.accent ?? '#1a202c';
  const stageBgColor = currentStageCfg?.bg ?? '#f8fafc';
  const stageTextColor = currentStageCfg?.text ?? '#374151';

  return (
    <div style={{ display: 'flex', flexDirection: isTablet ? 'column' : 'row', fontFamily: 'system-ui, sans-serif', background: '#f8fafc', height: '100%', overflow: 'hidden' }}>
      <style>{`.kc-no-scrollbar::-webkit-scrollbar{display:none}.kc-no-scrollbar{scrollbar-width:none;-ms-overflow-style:none}@keyframes kcFadeHL{0%{background:#fefce8}100%{background:transparent}}.kc-hl{animation:kcFadeHL 2s forwards}textarea:focus::placeholder{color:transparent}.kc-mi{display:flex;align-items:center;width:100%;padding:8px 12px;text-align:left;background:none;border:none;border-radius:8px;cursor:pointer;font-size:13px;color:#374151;font-weight:500;text-decoration:none;box-sizing:border-box;transition:all .12s ease;letter-spacing:-0.01em;line-height:1.3}.kc-mi:hover{background:#f1f5f9}.kc-mi:active{background:#e8ecf1}.kc-mi-danger{color:#dc2626!important;font-weight:500}.kc-mi-danger:hover{background:#fef2f2!important}.kc-row{transition:background .15s ease}.kc-row:hover{background:#f1f5f9!important}.kc-phone .kc-copy{opacity:0;transition:opacity .12s}.kc-phone:hover .kc-copy{opacity:1}@keyframes kc-slide-in{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>


      {/* Attended modal */}
      {attendedLead && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setAttendedLead(null)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1a202c', marginBottom: 4 }}>Mark as Attended</h3>
            <p style={{ fontSize: 13, color: '#718096', marginBottom: 18 }}>{attendedLead.childName} · {attendedLead.parentPhone}</p>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#4a5568', display: 'block', marginBottom: 14 }}>
              Attended Date
              <input
                type="date"
                value={attendedDate}
                onChange={e => setAttendedDate(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 6, padding: '8px 10px', border: '1px solid #cbd5e0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#4a5568' }}>
              Notes (optional)
              <textarea
                value={attendedNotes}
                onChange={e => setAttendedNotes(e.target.value)}
                placeholder="e.g. Parents are interested, will decide next week…"
                style={{ display: 'block', width: '100%', marginTop: 6, padding: '8px 10px', border: '1px solid #cbd5e0', borderRadius: 8, fontSize: 13, resize: 'vertical', height: 90, boxSizing: 'border-box' }}
              />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setAttendedLead(null)} style={{ padding: '8px 18px', background: '#edf2f7', color: '#4a5568', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={async () => { const l = attendedLead; setAttendedLead(null); await markAttendance(l, true, attendedNotes || undefined, attendedDate || undefined); }} style={{ padding: '8px 18px', background: '#38a169', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}><FontAwesomeIcon icon={faCircleCheck} style={{ marginRight: 6 }} /> Confirm Attended</button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px 28px', minWidth: 320, maxWidth: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#1a202c', lineHeight: 1.5 }}>{confirmDialog.message}</p>
            {confirmDialog.details && confirmDialog.details.length > 0 && (
              <div style={{ background: confirmDialog.destructive ? '#fef2f2' : '#f8fafc', border: `1px solid ${confirmDialog.destructive ? '#fecaca' : '#e2e8f0'}`, borderRadius: 8, padding: '8px 12px', marginBottom: 16, maxHeight: 180, overflowY: 'auto' }}>
                {confirmDialog.details.map((d, i) => (
                  <div key={i} style={{ fontSize: 12, color: confirmDialog.destructive ? '#991b1b' : '#475569', padding: '3px 0', borderBottom: i < confirmDialog.details!.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    {d}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDialog(null)} style={{ padding: '8px 18px', background: '#edf2f7', color: '#4a5568', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} style={{ padding: '8px 18px', background: confirmDialog.destructive ? '#dc2626' : '#3182ce', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                {confirmDialog.destructive ? 'Delete' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmBookingLead && (() => {
        const lead = confirmBookingLead;
        const start = lead.appointmentStart ? new Date(lead.appointmentStart) : null;
        const end = lead.appointmentEnd ? new Date(lead.appointmentEnd) : (start ? new Date(start.getTime() + apptDuration * 60000) : null);
        const fmtT = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        const contact: WhatsAppContact = { childName: lead.childName, parentPhone: lead.parentPhone, relationship: lead.relationship, appointmentStart: lead.appointmentStart };
        const selectedTpl = waTemplates.find(t => t.id === 'confirm_appointment');
        const tplContent = selectedTpl ? (confirmBookingLang === 'zh' ? selectedTpl.content_zh : selectedTpl.content_en) : '';
        const resolvedMsg = tplContent ? applyTemplatePlaceholders(tplContent, contact, kinderAddress, apptDuration, confirmBookingLang === 'zh') : '';
        const cbMsg = cbMsgEdited || resolvedMsg;

        const closeModal = () => { setConfirmBookingLead(null); setCbStatus('idle'); setCbCalendarError(''); setCbPendingWa(false); setCbMsgEdited(''); };

        const invalidateLeads = () => {
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          queryClient.invalidateQueries({ queryKey: ['leads-appt-booked'] });
          queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
          queryClient.invalidateQueries({ queryKey: ['upcomingAppointments'] });
        };

        const handleConfirmBooking = async (sendWa: boolean) => {
          setCbStatus('confirming');
          setCbPendingWa(sendWa);
          setCbCalendarError('');
          try {
            const result = await confirmAppointment(lead.id);
            invalidateLeads();
            if (sendWa && cbMsg) window.open(whatsappUrl(lead.parentPhone, cbMsg), '_blank', 'noopener,noreferrer');
            showToast('Booking confirmed — calendar event created.', 'success', result.googleEventLink ?? undefined);
            closeModal();
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to confirm booking';
            if (msg.includes('Google Calendar') || msg.includes('Google calendar')) {
              setCbCalendarError(msg);
              setCbStatus('calendarFailed');
            } else {
              setCbCalendarError(msg);
              setCbStatus('idle');
            }
          }
        };

        // Save without calendar + optionally send WA
        const handleSaveWithoutCalendar = async (sendWa: boolean) => {
          setCbStatus('confirming'); setCbCalendarError('');
          try {
            await confirmAppointmentNoCalendar(lead.id);
            invalidateLeads();
            if (sendWa && cbMsg) window.open(whatsappUrl(lead.parentPhone, cbMsg), '_blank', 'noopener,noreferrer');
            showToast('Booking confirmed (calendar not synced).', 'success');
            closeModal();
          } catch (e) {
            setCbCalendarError(e instanceof Error ? e.message : 'Failed to save');
            setCbStatus('calendarFailed');
          }
        };

        // Retry: try calendar again
        const handleRetryCalendar = () => handleConfirmBooking(cbPendingWa);

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520, boxShadow: '0 16px 48px rgba(0,0,0,0.14)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 48px)' }} onClick={e => e.stopPropagation()}>

              {/* Header — compact, context only */}
              <div style={{ padding: '14px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Confirm Booking</h3>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{lead.childName} · {lead.parentPhone}</div>
                </div>
                <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', color: '#cbd5e1', padding: '4px 2px', lineHeight: 1 }}><FontAwesomeIcon icon={faXmark} /></button>
              </div>

              {/* Body */}
              <div style={{ padding: '12px 24px 16px', flex: 1, overflowY: 'auto', minHeight: 0 }}>

                {/* Appointment summary — the hero */}
                {start ? (
                  <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#0c4a6e', letterSpacing: '-0.01em' }}>
                      {fmtT(start)}{end ? ` – ${fmtT(end)}` : ''}
                    </div>
                    <div style={{ fontSize: 12, color: '#0369a1', marginTop: 4 }}>
                      {start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      <span style={{ color: '#7dd3fc', margin: '0 6px' }}>·</span>
                      {apptDuration} min
                    </div>
                  </div>
                ) : (
                  <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#854d0e' }}>No appointment time set</div>
                )}

                {/* WhatsApp message section — secondary */}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Message</span>
                    <div style={{ display: 'inline-flex', borderRadius: 5, background: '#f1f5f9', padding: 2 }}>
                      {(['en', 'zh'] as const).map(t => (
                        <button key={t} onClick={() => { setConfirmBookingLang(t); setCbMsgEdited(''); }} style={{
                          padding: '1px 10px', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer', lineHeight: '17px',
                          border: 'none', background: confirmBookingLang === t ? '#fff' : 'transparent',
                          color: confirmBookingLang === t ? '#1e293b' : '#94a3b8',
                          boxShadow: confirmBookingLang === t ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                        }}>{t === 'en' ? 'EN' : '中文'}</button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={cbMsg}
                    onChange={e => setCbMsgEdited(e.target.value)}
                    style={{ display: 'block', width: '100%', height: 200, background: '#fafafa', borderRadius: 8, padding: '12px 14px', fontSize: 12.5, color: '#475569', lineHeight: 1.6, border: '1px solid #eef0f2', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box', overflowY: 'auto' }}
                  />
                </div>

              </div>

              {/* Error block — calendar failed state */}
              <div style={{ overflow: 'hidden', maxHeight: cbStatus === 'calendarFailed' ? 140 : cbCalendarError && cbStatus === 'idle' ? 60 : 0, transition: 'max-height 0.15s ease', flexShrink: 0 }}>
                <div style={{ padding: '6px 24px 8px' }}>
                  {cbStatus === 'calendarFailed' ? (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e' }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Google Calendar sync failed</div>
                      <div style={{ lineHeight: 1.5, color: '#a16207' }}>
                        The booking has not been saved yet. You can retry using the button below.
                      </div>
                      <div style={{ marginTop: 6, fontSize: 11, color: '#a16207', lineHeight: 1.5 }}>
                        Or{' '}
                        <button onClick={() => handleSaveWithoutCalendar(cbPendingWa)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#92400e', fontWeight: 600, fontSize: 11, textDecoration: 'underline' }}>
                          {cbPendingWa ? 'save & send WhatsApp without calendar' : 'save without calendar'}
                        </button>
                        {' · '}<a href="/settings/calendar" style={{ color: '#92400e', fontSize: 11 }}>Reconnect in Settings</a>
                      </div>
                    </div>
                  ) : cbCalendarError ? (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#dc2626' }}>
                      {cbCalendarError}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Footer — always the same 3 buttons */}
              <div style={{ padding: '12px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <button onClick={closeModal} disabled={cbStatus === 'confirming'} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#94a3b8', fontWeight: 500, padding: '8px 4px' }}>Cancel</button>
                <div style={{ flex: 1 }} />
                <button onClick={() => handleConfirmBooking(false)} disabled={cbStatus === 'confirming'}
                  style={{ padding: '8px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 7, cursor: 'pointer', fontSize: 12, color: '#475569', fontWeight: 600, opacity: cbStatus === 'confirming' ? 0.5 : 1 }}>
                  {cbStatus === 'confirming' && !cbPendingWa ? 'Confirming…' : 'Confirm Only'}
                </button>
                <button onClick={() => handleConfirmBooking(true)} disabled={cbStatus === 'confirming'}
                  style={{ padding: '8px 18px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 1px 3px rgba(34,197,94,0.25)', opacity: cbStatus === 'confirming' ? 0.5 : 1 }}>
                  <FontAwesomeIcon icon={faWhatsapp} /> {cbStatus === 'confirming' && cbPendingWa ? 'Confirming…' : 'Confirm & Send'}
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {editingLead && (
        <EditModal lead={editingLead} lostReasons={lostReasons} onClose={() => setEditingLead(null)}
          onSaved={(_updated: Lead) => { invalidateAll(); queryClient.invalidateQueries({ queryKey: ['students'] }); setEditingLead(null); }} />
      )}
      {notesLead && (
        <NotesModal lead={notesLead} onClose={() => setNotesLead(null)}
          onSaved={() => { invalidateAll(); setNotesLead(null); }} />
      )}
      {bookingLead && (
        <AppointmentModal lead={bookingLead} intent={bookingIntent} waTemplate={waTemplate} waTemplateZh={waTemplateZh}
          address={kinderAddress} durationMinutes={apptDuration} upcomingAppts={upcomingAppts}
          onClose={() => setBookingLead(null)}
          onConfirm={(start, msg, isPlaceholder) => handleConfirmAppointment(bookingLead, start, msg, isPlaceholder)}
          onConfirmNoCalendar={(start, msg, isPlaceholder) => handleConfirmAppointmentNoCalendar(bookingLead, start, msg, isPlaceholder)} />
      )}
      {whatsappContact && (
        <WhatsAppModal contact={whatsappContact} defaultTemplate={whatsappDefaultTemplate}
          templates={waTemplates}
          address={kinderAddress} durationMinutes={apptDuration} onClose={() => setWhatsappContact(null)} />
      )}
      {enrollingLead && (
        <EnrollmentModal lead={enrollingLead} onClose={() => setEnrollingLead(null)}
          onEnrolled={() => { const { childName } = enrollingLead; invalidateAll(); queryClient.invalidateQueries({ queryKey: ['students'] }); setEnrollingLead(null); showToast(`${childName} enrolled —`, 'success', undefined, { label: 'View Onboarding', onClick: () => navigate('/onboarding') }); }} />
      )}
      {decliningLead && (
        <DeclineModal lead={decliningLead} lostReasons={lostReasons} onClose={() => setDecliningLead(null)}
          onDeclined={() => { const { childName, id } = decliningLead; invalidateAll(); showToast(`${childName} marked as not enrolling — moved to`, 'success', undefined, { label: 'Lost', onClick: () => { handleStageSelect('LOST'); setHighlightId(id); } }); }} />
      )}
      {rejectingLead && (
        <RejectModal lead={rejectingLead} lostReasons={lostReasons} onClose={() => setRejectingLead(null)}
          onRejected={() => { const { childName, id } = rejectingLead; invalidateAll(); showToast(`${childName} rejected — moved to`, 'success', undefined, { label: 'Rejected', onClick: () => { handleStageSelect('REJECTED'); setHighlightId(id); } }); }} />
      )}


      {/* Left Pipeline Nav — desktop: vertical sidebar, mobile/tablet: horizontal pills */}
      {!isTablet && (
        <PipelineNav selected={selectedStage} onChange={handleStageSelect} stats={stats} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />
      )}

      {/* Content area — this is the ONE scroll container; scrollbar appears at the far right edge */}
      <div style={{ flex: 1, overflowY: 'auto', height: '100%', minWidth: 0, width: 0 }}>
        {isTablet && <PipelineNav selected={selectedStage} onChange={handleStageSelect} stats={stats} compact />}
        <div style={{ maxWidth: 1380, margin: '0 auto', padding: isMobile ? '16px 12px' : isTablet ? '20px 16px' : '28px 32px', minWidth: 0, boxSizing: 'border-box', width: '100%' }}>
        <div style={{ minWidth: 0 }}>

          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            {selectedStage === 'all_active' && (
              <>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a202c' }}>All Active Leads</h1>
                {data && <span style={{ fontSize: 13, color: '#a0aec0', fontWeight: 400 }}>{data.total} leads</span>}
              </>
            )}
            {selectedStage !== 'all_active' && !isTrash && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 14, color: '#9ca3af', fontWeight: 400 }}>Leads</span>
                <span style={{ fontSize: 14, color: '#d1d5db' }}>›</span>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: stageAccentColor }}>{STAGE_TITLES[selectedStage]}</h1>
                {data && <span style={{ fontSize: 13, color: '#a0aec0', fontWeight: 400, marginLeft: 4 }}>{data.total} leads</span>}
              </div>
            )}
            {isTrash && (
              <>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#c53030' }}>Trash</h1>
                <span style={{ fontSize: 13, color: '#a0aec0', fontWeight: 400 }}>{trashedLeads.length} leads</span>
              </>
            )}
          </div>

          {/* Search + Sort + Export toolbar */}
          {!isTrash && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
              {/* Search — full width on mobile */}
              <div style={{ position: 'relative', flex: 1, ...(isMobile ? { width: '100%', flexBasis: '100%' } : {}) }}>
                <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#b0b8c9', fontSize: 12 }} />
                <input
                  placeholder="Search by name or phone..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  style={{ width: '100%', padding: '7px 30px 7px 32px', border: '1px solid #e8ecf1', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', color: '#1e293b', background: '#f8fafc', outline: 'none' }}
                />
                {searchInput && (
                  <button onClick={() => setSearchInput('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 11, padding: 2 }}>
                    <FontAwesomeIcon icon={faXmark} />
                  </button>
                )}
              </div>
              {/* Sort */}
              <select
                value={`${sortBy}:${sortOrder}`}
                onChange={e => {
                  const [field, order] = e.target.value.split(':');
                  setSortBy(field as SortField); setSortOrder(order as SortOrder); setPage(1);
                }}
                style={{ padding: '7px 10px', border: '1px solid #e8ecf1', borderRadius: 7, fontSize: 13, color: '#64748b', background: '#fff', cursor: 'pointer', flexShrink: 0, ...(isMobile ? { flex: 4 } : {}) }}
              >
                <option value="submittedAt:desc">Newest first</option>
                <option value="submittedAt:asc">Oldest first</option>
                <option value="childName:asc">Name A→Z</option>
                <option value="childName:desc">Name Z→A</option>
                <option value="enrolmentYear:asc">Year ↑</option>
                <option value="enrolmentYear:desc">Year ↓</option>
                <option value="intent:desc">Intent Hot→Cool</option>
                <option value="intent:asc">Intent Cool→Hot</option>
              </select>
              {/* Year filter — closed stages only */}
              {isClosed && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#f8fafc', border: '1px solid #e8ecf1', borderRadius: 7, flexShrink: 0 }}>
                  <FontAwesomeIcon icon={faFilter} style={{ fontSize: 10, color: '#94a3b8' }} />
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>Year</span>
                  <select
                    value={closedYear}
                    onChange={e => { setClosedYear(Number(e.target.value)); setPage(1); }}
                    style={{ padding: '2px 4px', border: 'none', fontSize: 13, color: '#374151', background: 'transparent', cursor: 'pointer', fontWeight: 600 }}
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Export */}
              <button
                onClick={handleExport} disabled={isExporting || !data || data.total === 0}
                style={{ padding: '7px 12px', fontSize: 12, fontWeight: 500, background: '#fff', color: '#64748b', border: '1px solid #e8ecf1', borderRadius: 7, cursor: 'pointer', opacity: isExporting || !data || data.total === 0 ? 0.5 : 1, whiteSpace: 'nowrap', flexShrink: 0, ...(isMobile ? { flex: 1 } : {}) }}
              >
                {isExporting ? 'Exporting...' : '↓ Export'}
              </button>
            </div>
          )}


          {!isTrash && isLoading && <div style={{ padding: 40, textAlign: 'center', color: '#718096', fontSize: 14 }}>Loading…</div>}
          {!isTrash && isError && <div style={{ padding: 20, color: '#e53e3e', fontSize: 14 }}>Error: {(error as Error).message}</div>}

          {isTrash && trashedLeads.length === 0 && (
            <div style={{ padding: '60px 20px', textAlign: 'center', background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}><FontAwesomeIcon icon={faTrash} /></div>
              <div style={{ fontWeight: 600, color: '#4a5568', marginBottom: 6 }}>Trash is empty</div>
              <div style={{ fontSize: 13, color: '#a0aec0' }}>Deleted leads will appear here.</div>
            </div>
          )}

          {isTrash && trashedLeads.length > 0 && (
            <div>
              {/* Bulk action bar */}
              {selectedTrashIds.size > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8' }}>{selectedTrashIds.size} selected</span>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => {
                    setConfirmDialog({
                      message: `Restore ${selectedTrashIds.size} lead${selectedTrashIds.size > 1 ? 's' : ''}?`,
                      onConfirm: async () => {
                        try {
                          await Promise.all([...selectedTrashIds].map(id => restoreLead(id)));
                          invalidateAll();
                          queryClient.invalidateQueries({ queryKey: ['leads-trash'] });
                          showToast(`${selectedTrashIds.size} lead${selectedTrashIds.size > 1 ? 's' : ''} restored`, 'success');
                          setSelectedTrashIds(new Set());
                        } catch { showToast('Failed to restore', 'error'); }
                      },
                    });
                  }} style={{ padding: '6px 14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    Restore Selected
                  </button>
                  <button onClick={() => {
                    const names = trashedLeads.filter(l => selectedTrashIds.has(l.id)).map(l => l.childName);
                    setConfirmDialog({
                      message: `Permanently delete ${selectedTrashIds.size} lead${selectedTrashIds.size > 1 ? 's' : ''}? This cannot be undone.`,
                      destructive: true,
                      details: names,
                      onConfirm: async () => {
                        try {
                          await Promise.all([...selectedTrashIds].map(id => permanentDeleteLead(id)));
                          queryClient.invalidateQueries({ queryKey: ['leads-trash'] });
                          queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
                          showToast(`${selectedTrashIds.size} lead${selectedTrashIds.size > 1 ? 's' : ''} permanently deleted`, 'success');
                          setSelectedTrashIds(new Set());
                        } catch { showToast('Failed to delete', 'error'); }
                      },
                    });
                  }} style={{ padding: '6px 14px', background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    Delete Forever
                  </button>
                  <button onClick={() => setSelectedTrashIds(new Set())} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#94a3b8', fontWeight: 500, padding: '6px 4px' }}>
                    Clear
                  </button>
                </div>
              )}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ ...tH, width: 40, textAlign: 'center' as const }}>
                        <input type="checkbox"
                          checked={selectedTrashIds.size === trashedLeads.length && trashedLeads.length > 0}
                          onChange={e => setSelectedTrashIds(e.target.checked ? new Set(trashedLeads.map(l => l.id)) : new Set())}
                          style={{ cursor: 'pointer' }}
                        />
                      </th>
                      <th style={tH}>Lead</th>
                      <th style={tH}>Phone</th>
                      <th style={tH}>Status</th>
                      <th style={tH}>Deleted</th>
                      <th style={{ ...tH, textAlign: 'right' as const }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trashedLeads.map((lead: Lead) => {
                      const isSelected = selectedTrashIds.has(lead.id);
                      return (
                        <tr key={lead.id} className="kc-row" style={{ borderBottom: '1px solid #f1f5f9', background: isSelected ? '#f0f9ff' : undefined }}>
                          <td style={{ ...tD, width: 40, textAlign: 'center' as const }}>
                            <input type="checkbox" checked={isSelected}
                              onChange={() => {
                                const next = new Set(selectedTrashIds);
                                if (isSelected) next.delete(lead.id); else next.add(lead.id);
                                setSelectedTrashIds(next);
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                          <td style={tD}>
                            <div style={{ fontWeight: 600, fontSize: 14, color: '#1a202c' }}>{lead.childName}</div>
                            <div style={{ fontSize: 11, color: '#a0aec0', marginTop: 2 }}>
                              Submitted {new Date(lead.submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                          </td>
                          <td style={{ ...tD, fontSize: 13, color: '#4a5568' }}>{lead.parentPhone}</td>
                          <td style={tD}>
                            {(() => { const cfg = statusCfgOf(lead.status); return (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: cfg.color }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot }} />
                                {cfg.label}
                              </span>
                            ); })()}
                          </td>
                          <td style={{ ...tD, fontSize: 13, color: '#718096' }}>
                            {lead.deletedAt ? new Date(lead.deletedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td style={{ ...tD, position: 'relative' as const, textAlign: 'right' as const }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                              <button
                                onClick={() => {
                                  setConfirmDialog({
                                    message: `Restore ${lead.childName}?`,
                                    onConfirm: async () => {
                                      try {
                                        await restoreLead(lead.id);
                                        invalidateAll();
                                        queryClient.invalidateQueries({ queryKey: ['leads-trash'] });
                                        setSelectedTrashIds(prev => { const n = new Set(prev); n.delete(lead.id); return n; });
                                        showToast(`${lead.childName} restored`, 'success');
                                      } catch { showToast('Failed to restore lead', 'error'); }
                                    },
                                  });
                                }}
                                style={{ padding: '6px 14px', background: '#dbeafe', color: '#1d4ed8', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                              >
                                ↩ Restore
                              </button>
                              <div style={{ position: 'relative' as const }}>
                                <button
                                  onClick={e => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setMenuPos({ top: rect.bottom + 4, bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right }); setMenuOpenId(menuOpenId === `trash-${lead.id}` ? null : `trash-${lead.id}`); }}
                                  style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', padding: '3px 9px', fontSize: 15, color: '#718096', lineHeight: 1 }}
                                >⋮</button>
                                {menuOpenId === `trash-${lead.id}` && (
                                  <div onClick={e => e.stopPropagation()} style={{ position: 'fixed' as const, ...(menuPos.top > window.innerHeight * 0.6 ? { bottom: menuPos.bottom } : { top: menuPos.top }), right: menuPos.right, zIndex: 9999, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', minWidth: 160, padding: 4 }}>
                                    <button
                                      onClick={() => {
                                        setMenuOpenId(null);
                                        setConfirmDialog({
                                          message: `Permanently delete ${lead.childName}? This cannot be undone.`,
                                          destructive: true,
                                          onConfirm: async () => {
                                            try {
                                              await permanentDeleteLead(lead.id);
                                              queryClient.invalidateQueries({ queryKey: ['leads-trash'] });
                                              queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
                                              setSelectedTrashIds(prev => { const n = new Set(prev); n.delete(lead.id); return n; });
                                              showToast(`${lead.childName} permanently deleted`, 'success');
                                            } catch { showToast('Failed to delete', 'error'); }
                                          },
                                        });
                                      }}
                                      className={`${mI} kc-mi-danger`}
                                    >
                                      <FontAwesomeIcon icon={faTrash} fixedWidth style={{ marginRight: 8 }} /> Delete Forever
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!isTrash && data && data.items.length === 0 && (
            <div style={{ padding: '60px 20px', textAlign: 'center', background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}><FontAwesomeIcon icon={faCalendarDays} /></div>
              <div style={{ fontWeight: 600, color: '#4a5568', marginBottom: 6 }}>No leads here</div>
              <div style={{ fontSize: 13, color: '#a0aec0' }}>Leads appear here as they progress through the pipeline.</div>
            </div>
          )}

          {!isTrash && data && data.items.length > 0 && isMobile && (
            /* ── Mobile card view ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.items.map((lead: Lead) => {
                const urgency = isClosed ? 'transparent' : urgencyBorder(lead, urgencyOrangeDays, urgencyRedDays);
                const urgencyTip = urgency !== 'transparent' ? urgencyTooltip(lead, urgencyOrangeDays, urgencyRedDays) : null;
                const primaryAction = getPrimaryAction(lead);
                const cfg = statusCfgOf(lead.status);
                const rt = lead.status === 'FOLLOW_UP' && lead.statusChangedAt
                  ? relDays(lead.statusChangedAt)
                  : relTime(lead.status === 'NEW' || !lead.statusChangedAt ? lead.submittedAt : lead.statusChangedAt);
                return (
                  <div key={lead.id} id={`lead-row-${lead.id}`} className={highlightId === lead.id ? 'kc-hl' : ''}
                    title={urgencyTip ? `${urgencyTip.label} — ${urgencyTip.rule}` : undefined}
                    style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '12px 14px', borderLeft: `4px solid ${urgency === 'transparent' ? '#e5e7eb' : urgency}`, position: 'relative' }}>
                    {/* Top: Name + Status + Menu */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                          <RelationshipIcon relationship={lead.relationship} />
                          <span style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{lead.childName}</span>
                          {lead.notes && (
                            <span title={`${lead.howDidYouKnow ? `Channel: ${lead.howDidYouKnow}` : ''}${lead.howDidYouKnow && lead.notes ? '\n\n' : ''}${lead.notes || ''}`} style={{ color: '#cbd5e1', fontSize: 10, cursor: 'default' }}>
                              <FontAwesomeIcon icon={faNoteSticky} />
                            </span>
                          )}
                          {getLeadHeat(lead.ctaSource).label && (() => {
                            const heat = getLeadHeat(lead.ctaSource);
                            return (
                              <span title={heat.tooltip} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                color: heat.color, fontSize: 9, fontWeight: 600, cursor: 'default',
                              }}>
                                {heat.icon && <FontAwesomeIcon icon={heat.icon} style={{ fontSize: 8 }} />}
                                {heat.label}
                              </span>
                            );
                          })()}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                          <span title={`${STATUS_VERB[lead.status]} ${new Date(lead.status === 'NEW' || !lead.statusChangedAt ? lead.submittedAt : lead.statusChangedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`} style={{ cursor: 'default' }}>
                            {STATUS_VERB[lead.status]} {rt.text}
                          </span>
                        </div>
                      </div>
                      {!isClosed && (
                        <button onClick={e => { e.stopPropagation(); openWhatsApp(lead, lead.status === 'FOLLOW_UP' ? 'follow_up' : 'none'); }}
                          title="Send WhatsApp"
                          style={{ background: 'none', border: '1px solid #dcfce7', borderRadius: 6, cursor: 'pointer', padding: '4px 8px', fontSize: 14, color: '#25D366', lineHeight: 1, flexShrink: 0, transition: 'all .12s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = '#86efac'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = '#dcfce7'; }}
                        ><FontAwesomeIcon icon={faWhatsapp} /></button>
                      )}
                      <button onClick={e => { e.stopPropagation(); if (menuOpenId !== lead.id) { const rect = e.currentTarget.getBoundingClientRect(); setMenuPos({ top: rect.bottom + 4, bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right }); } setMenuOpenId(menuOpenId === lead.id ? null : lead.id); }}
                        style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', padding: '4px 10px', fontSize: 16, color: '#718096', lineHeight: 1, flexShrink: 0 }}>⋮</button>
                    </div>
                    {/* Details row */}
                    <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12, color: '#64748b', flexWrap: 'wrap' }}>
                      <span title={`DOB: ${new Date(lead.childDob).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`} style={{ cursor: 'default' }}>{lead.enrolmentYear} · Age {calcClassAge(lead.childDob, lead.enrolmentYear)}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <FontAwesomeIcon icon={faPhone} style={{ fontSize: 9, color: '#94a3b8' }} />{lead.parentPhone}
                      </span>
                    </div>
                    {/* Primary action */}
                    {primaryAction && !isClosed && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={e => { e.stopPropagation(); primaryAction.action(); }}
                          style={{ ...primaryAction.style, padding: '6px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                          {primaryAction.label}
                        </button>
                        {lead.status === 'APPOINTMENT_BOOKED' && (
                          <button onClick={e => { e.stopPropagation(); setConfirmDialog({ message: `Mark ${lead.childName} as No Show?`, onConfirm: () => markAttendance(lead, false) }); }}
                            style={{ ...btnStyles.noShow, padding: '6px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                            <FontAwesomeIcon icon={faCircleXmark} style={{ marginRight: 6 }} /> No Show
                          </button>
                        )}
                      </div>
                    )}
                    {/* Context menu */}
                    {menuOpenId === lead.id && (() => {
                      const hasScheduleActions = lead.status === 'CONTACTED' || lead.status === 'APPOINTMENT_BOOKED';
                      const hasEnroll = lead.status !== 'ENROLLED' && lead.status !== 'LOST' && lead.status !== 'REJECTED';
                      const sep = <div style={{ height: 1, background: '#f0f2f5', margin: '3px 10px' }} />;
                      const secLabel = (label: string, icon?: any) => <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase' as const, display: 'flex', alignItems: 'center', gap: 6 }}>{icon && <FontAwesomeIcon icon={icon} style={{ fontSize: 10, color: '#c0c7d1' }} />}{label}</div>;
                      return (
                        <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', ...(menuPos.top > window.innerHeight * 0.6 ? { bottom: menuPos.bottom } : { top: menuPos.top }), right: menuPos.right, zIndex: 200, background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.04)', minWidth: 200, padding: '5px' }}>
                          {secLabel('Actions', faBolt)}
                          <div style={{ padding: '0 2px' }}>
                            {hasScheduleActions && (
                              <button onClick={() => { setBookingIntent('reschedule'); setBookingLead(lead); setMenuOpenId(null); }} className={mI}><FontAwesomeIcon icon={faCalendarDays} fixedWidth style={{ marginRight: 8, color: '#94a3b8', fontSize: 12 }} /> Reschedule Appt</button>
                            )}
                            <button onClick={() => { openWhatsApp(lead, lead.status === 'FOLLOW_UP' ? 'follow_up' : 'none'); setMenuOpenId(null); }} className={mI}><FontAwesomeIcon icon={faWhatsapp} fixedWidth style={{ marginRight: 8, color: '#25D366', fontSize: 13 }} /> Send WhatsApp</button>
                            <button onClick={() => { setNotesLead(lead); setMenuOpenId(null); }} className={mI}><FontAwesomeIcon icon={faNoteSticky} fixedWidth style={{ marginRight: 8, color: '#94a3b8', fontSize: 12 }} /> Edit Notes</button>
                            {isMobile && (
                              <button onClick={() => { window.location.href = `tel:${lead.parentPhone}`; setMenuOpenId(null); }} className={mI}><FontAwesomeIcon icon={faPhone} fixedWidth style={{ marginRight: 8, color: '#94a3b8', fontSize: 12 }} /> Call</button>
                            )}
                          </div>
                          {hasEnroll && (<>
                            {sep}
                            {secLabel('Decision', faScaleBalanced)}
                            <div style={{ padding: '0 2px' }}>
                              <button onClick={() => { setEnrollingLead(lead); setMenuOpenId(null); }} className={mI} style={{ color: '#15803d', fontWeight: 600 }}>
                                <span style={{ width: 20, height: 20, borderRadius: 6, background: '#dcfce7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, flexShrink: 0 }}>
                                  <FontAwesomeIcon icon={faGraduationCap} style={{ fontSize: 10, color: '#16a34a' }} />
                                </span>
                                Enroll Student
                              </button>
                              <button onClick={() => { setRejectingLead(lead); setMenuOpenId(null); }} className={mI} style={{ color: '#b45309', fontSize: 12 }}>
                                <span style={{ width: 20, height: 20, borderRadius: 6, background: '#fef3c7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, flexShrink: 0 }}>
                                  <FontAwesomeIcon icon={faXmark} style={{ fontSize: 10, color: '#d97706' }} />
                                </span>
                                Reject Lead
                              </button>
                            </div>
                          </>)}
                          {sep}
                          <div style={{ padding: '0 2px' }}>
                            <button onClick={() => { setEditingLead(lead); setMenuOpenId(null); }} className={mI} style={{ color: '#64748b' }}><FontAwesomeIcon icon={faPen} fixedWidth style={{ marginRight: 8, color: '#b0b8c9', fontSize: 11 }} /> View Lead Details</button>
                          </div>
                          {sep}
                          <div style={{ padding: '0 2px' }}>
                            <button onClick={() => { void requestMoveToTrash(lead); setMenuOpenId(null); }} className={`${mI} kc-mi-danger`} style={{ fontSize: 12 }}><FontAwesomeIcon icon={faTrash} fixedWidth style={{ marginRight: 8, fontSize: 11 }} /> Delete</button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}

              {/* Mobile pagination */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 0', fontSize: 13 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pB}>‹</button>
                  <span style={{ fontWeight: 600, color: '#2b6cb0', padding: '4px 10px', background: '#ebf4ff', borderRadius: 5 }}>{page}/{totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={pB}>›</button>
                </div>
                <span style={{ color: '#94a3b8', fontSize: 11 }}>{data.total} leads</span>
              </div>
            </div>
          )}

          {!isTrash && data && data.items.length > 0 && !isMobile && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', position: 'relative' as const }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 10, tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ width: 4, padding: 0, borderTopLeftRadius: 10 }} />
                    <th style={{ ...tH, width: '25%' }}>Lead</th>
                    <th style={{ ...tH, width: '11%' }}>Enrolment</th>
                    <th style={{ ...tH, width: '15%' }}>Phone</th>
                    {isClosed
                      ? <th style={{ ...tH, width: '12%' }}>Closed</th>
                      : <th style={{ ...tH, width: '20%' }}>Visit</th>
                    }
                    {isClosed
                      ? <th style={{ ...tH }}>Reason</th>
                      : <th style={{ ...tH, textAlign: 'right' as const, width: '35%' }}>Next Action</th>
                    }
                    <th style={{ ...tH, width: 44, textAlign: 'center' as const }} />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((lead: Lead) => {
                    const urgency = isClosed ? 'transparent' : urgencyBorder(lead, urgencyOrangeDays, urgencyRedDays);
                    const urgencyTip = urgency !== 'transparent' ? urgencyTooltip(lead, urgencyOrangeDays, urgencyRedDays) : null;
                    const primaryAction = getPrimaryAction(lead);
                    const cfg = statusCfgOf(lead.status);
                    const isMenuOpen = menuOpenId === lead.id;
                    const rt = lead.status === 'FOLLOW_UP' && lead.statusChangedAt
                      ? relDays(lead.statusChangedAt)
                      : relTime(lead.status === 'NEW' || !lead.statusChangedAt ? lead.submittedAt : lead.statusChangedAt);
                    return (
                      <tr key={lead.id} id={`lead-row-${lead.id}`} className={`kc-row${highlightId === lead.id ? ' kc-hl' : ''}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        {/* Urgency stripe */}
                        <td style={{ width: 4, padding: 0, background: urgency, minWidth: 4, cursor: urgencyTip ? 'default' : undefined }} title={urgencyTip ? `${urgencyTip.label} — ${urgencyTip.rule}` : undefined} />

                        {/* Lead info */}
                        <td style={tD}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <RelationshipIcon relationship={lead.relationship} />
                            <span style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{lead.childName}</span>
                            {lead.notes && (
                              <span title={lead.notes} style={{ color: '#cbd5e1', fontSize: 10, cursor: 'default' }}>
                                <FontAwesomeIcon icon={faNoteSticky} />
                              </span>
                            )}
                            {getLeadHeat(lead.ctaSource).label && (() => {
                              const heat = getLeadHeat(lead.ctaSource);
                              return (
                                <span title={heat.tooltip} style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 3,
                                  color: heat.color, fontSize: 10, fontWeight: 600,
                                  cursor: 'default', whiteSpace: 'nowrap' as const,
                                }}>
                                  {heat.icon && <FontAwesomeIcon icon={heat.icon} style={{ fontSize: 9 }} />}
                                  {heat.label}
                                </span>
                              );
                            })()}
                          </div>
                          <div style={{ fontSize: 11, color: '#b0b8c9', marginTop: 2 }}>
                            <span title={`${STATUS_VERB[lead.status]} ${new Date(lead.status === 'NEW' || !lead.statusChangedAt ? lead.submittedAt : lead.statusChangedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`} style={{ cursor: 'default' }}>
                              {STATUS_VERB[lead.status]} {rt.text}
                            </span>
                          </div>
                        </td>

                        {/* Enrolment */}
                        <td style={{ ...tD, cursor: 'default' }} title={`DOB: ${new Date(lead.childDob).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}>
                          <span style={{ display: 'inline-block', background: '#f1f5f9', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 500, color: '#475569', whiteSpace: 'nowrap' as const }}>
                            {lead.enrolmentYear} · Age {calcClassAge(lead.childDob, lead.enrolmentYear)}
                          </span>
                        </td>

                        {/* Phone */}
                        <td style={{ ...tD, fontSize: 13, color: '#475569' }}>
                          <span className="kc-phone" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontVariantNumeric: 'tabular-nums' }}>
                            <FontAwesomeIcon icon={faPhone} style={{ color: '#94a3b8', fontSize: 10 }} />
                            {lead.parentPhone}
                            <FontAwesomeIcon icon={faCopy} className="kc-copy"
                              onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(lead.parentPhone); showToast('Phone number copied', 'success'); }}
                              style={{ color: '#cbd5e1', fontSize: 10, cursor: 'pointer' }} />
                          </span>
                        </td>

                        {/* Visit + Status combined */}
                        {isClosed ? (
                          <td style={{ ...tD, fontSize: 13, color: '#4a5568' }}>
                            {lead.statusChangedAt
                              ? new Date(lead.statusChangedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                              : <span style={{ color: '#d1d5db' }}>—</span>}
                          </td>
                        ) : (
                          <td style={{ ...tD, fontSize: 13 }}>
                            {lead.appointmentStart && ['CONTACTED', 'APPOINTMENT_BOOKED', 'FOLLOW_UP'].includes(lead.status) ? (() => {
                              const isFollowUp = lead.status === 'FOLLOW_UP';
                              const displayDate = isFollowUp && lead.statusChangedAt ? new Date(lead.statusChangedAt) : new Date(lead.appointmentStart);
                              const apptDate = new Date(lead.appointmentStart);
                              const isPast = lead.status === 'APPOINTMENT_BOOKED' && apptDate < new Date();
                              const calendarNotSynced = !lead.googleEventId && !!lead.appointmentStart;
                              const visitStatus = isFollowUp
                                ? { label: 'Attended', color: '#16a34a', dot: '#22c55e' }
                                : isPast
                                ? { label: 'Update Status', color: '#92400e', dot: '#f59e0b' }
                                : lead.status === 'APPOINTMENT_BOOKED'
                                ? { label: 'Appt Confirmed', color: '#2563eb', dot: '#3b82f6' }
                                : { label: 'Contacted', color: '#d97706', dot: '#f59e0b' };
                              const icon = isFollowUp ? faCircleCheck : isPast ? faCircleCheck : lead.status === 'APPOINTMENT_BOOKED' ? faCalendarDays : faClock;
                              const iconColor = isFollowUp ? '#16a34a' : isPast ? '#d97706' : lead.status === 'APPOINTMENT_BOOKED' ? '#3b82f6' : '#94a3b8';
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 500, color: '#374151', fontSize: 13, whiteSpace: 'nowrap' as const }}>
                                  <span title={visitStatus.label} style={{ cursor: 'default' }}>
                                    <FontAwesomeIcon icon={icon} style={{ color: iconColor, fontSize: 11 }} />
                                  </span>
                                  <span>{displayDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ({displayDate.toLocaleDateString('en-GB', { weekday: 'short' })})</span>
                                  {!isFollowUp && (
                                    <span style={{ color: '#b0b8c9', fontWeight: 400, fontSize: 12 }}>
                                      {apptDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                    </span>
                                  )}
                                  {calendarNotSynced && (
                                    <span title="Google Calendar not synced" style={{ fontSize: 9, color: '#f59e0b', cursor: 'default' }}>
                                      <FontAwesomeIcon icon={faTriangleExclamation} />
                                    </span>
                                  )}
                                </div>
                              );
                            })() : (
                              <span
                                title={cfg === UNKNOWN_STATUS_CFG ? `Raw status: ${JSON.stringify(lead.status)}` : undefined}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: cfg.color,
                                  background: cfg.bg,
                                  padding: '3px 9px',
                                  borderRadius: 8,
                                  border: `1px solid ${cfg.dot}20`,
                                }}>
                                {cfg.label}
                              </span>
                            )}
                          </td>
                        )}

                        {/* Next Action / Reason */}
                        {isClosed ? (
                          <td style={{ ...tD, fontSize: 13, color: '#6b7280', maxWidth: 180 }}>
                            {lead.lostReason ?? <span style={{ color: '#d1d5db' }}>—</span>}
                          </td>
                        ) : (
                          <td style={{ ...tD, textAlign: 'right' as const }} onClick={e => e.stopPropagation()}>
                            {lead.status === 'FOLLOW_UP' ? (
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                                <button onClick={() => setEnrollingLead(lead)} style={btnStyles.enroll}>
                                  <FontAwesomeIcon icon={faGraduationCap} style={{ marginRight: 6 }} /> Enroll
                                </button>
                                <button onClick={() => setDecliningLead(lead)} style={btnStyles.notEnrolling}>
                                  <FontAwesomeIcon icon={faXmark} style={{ marginRight: 6 }} /> Not Enrolling
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                                {primaryAction ? (
                                  <button onClick={primaryAction.action} style={primaryAction.style}>
                                    {primaryAction.label}
                                  </button>
                                ) : <span style={{ fontSize: 12, color: '#e2e8f0' }}>—</span>}
                                {lead.status === 'APPOINTMENT_BOOKED' && (
                                  <button
                                    onClick={() => setConfirmDialog({ message: `Mark ${lead.childName} as No Show?`, onConfirm: () => markAttendance(lead, false) })}
                                    style={btnStyles.noShow}
                                  >
                                    <FontAwesomeIcon icon={faCircleXmark} style={{ marginRight: 6 }} /> No Show
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        )}

                        {/* Overflow menu */}
                        <td style={{ ...tD, position: 'relative' as const, width: 44, textAlign: 'center' as const, padding: '8px 6px' }}>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (!isMenuOpen) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setMenuPos({ top: rect.bottom + 4, bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right });
                              }
                              setMenuOpenId(isMenuOpen ? null : lead.id);
                            }}
                            style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', padding: '3px 9px', fontSize: 15, color: '#718096', lineHeight: 1 }}
                          >⋮</button>
                          {isMenuOpen && (() => {
                            const hasScheduleActions = lead.status === 'CONTACTED' || lead.status === 'APPOINTMENT_BOOKED';
                            const hasEnroll = lead.status !== 'ENROLLED' && lead.status !== 'LOST' && lead.status !== 'REJECTED';
                            const sep = <div style={{ height: 1, background: '#f1f5f9', margin: '4px 8px' }} />;
                            return (
                              <div
                                onClick={e => e.stopPropagation()}
                                style={{ position: 'fixed' as const, ...(menuPos.top > window.innerHeight * 0.6 ? { bottom: menuPos.bottom } : { top: menuPos.top }), right: menuPos.right, zIndex: 200, background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.04)', minWidth: 200, padding: '5px' }}
                              >
                                {(() => {
                                  const secLabel = (label: string, icon?: any) => <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase' as const, display: 'flex', alignItems: 'center', gap: 6 }}>{icon && <FontAwesomeIcon icon={icon} style={{ fontSize: 10, color: '#c0c7d1' }} />}{label}</div>;
                                  return <>
                                    {secLabel('Actions', faBolt)}
                                    <div style={{ padding: '0 2px' }}>
                                      {hasScheduleActions && (
                                        <button onClick={() => { setBookingIntent('reschedule'); setBookingLead(lead); setMenuOpenId(null); }} className={mI}><FontAwesomeIcon icon={faCalendarDays} fixedWidth style={{ marginRight: 8, color: '#94a3b8', fontSize: 12 }} /> Reschedule Appt</button>
                                      )}
                                      <button onClick={() => { openWhatsApp(lead, lead.status === 'FOLLOW_UP' ? 'follow_up' : 'none'); setMenuOpenId(null); }} className={mI}><FontAwesomeIcon icon={faWhatsapp} fixedWidth style={{ marginRight: 8, color: '#25D366', fontSize: 13 }} /> Send WhatsApp</button>
                                      <button onClick={() => { setNotesLead(lead); setMenuOpenId(null); }} className={mI}><FontAwesomeIcon icon={faNoteSticky} fixedWidth style={{ marginRight: 8, color: '#94a3b8', fontSize: 12 }} /> Edit Notes</button>
                                    </div>
                                    {hasEnroll && (<>
                                      {sep}
                                      {secLabel('Decision', faScaleBalanced)}
                                      <div style={{ padding: '0 2px' }}>
                                        <button onClick={() => { setEnrollingLead(lead); setMenuOpenId(null); }} className={mI} style={{ color: '#15803d', fontWeight: 600 }}>
                                          <span style={{ width: 20, height: 20, borderRadius: 6, background: '#dcfce7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, flexShrink: 0 }}>
                                            <FontAwesomeIcon icon={faGraduationCap} style={{ fontSize: 10, color: '#16a34a' }} />
                                          </span>
                                          Enroll Student
                                        </button>
                                        <button onClick={() => { setRejectingLead(lead); setMenuOpenId(null); }} className={mI} style={{ color: '#b45309', fontSize: 12 }}>
                                          <span style={{ width: 20, height: 20, borderRadius: 6, background: '#fef3c7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, flexShrink: 0 }}>
                                            <FontAwesomeIcon icon={faXmark} style={{ fontSize: 10, color: '#d97706' }} />
                                          </span>
                                          Reject Lead
                                        </button>
                                      </div>
                                    </>)}
                                    {sep}
                                    <div style={{ padding: '0 2px' }}>
                                      <button onClick={() => { setEditingLead(lead); setMenuOpenId(null); }} className={mI} style={{ color: '#64748b' }}><FontAwesomeIcon icon={faPen} fixedWidth style={{ marginRight: 8, color: '#b0b8c9', fontSize: 11 }} /> View Lead Details</button>
                                    </div>
                                    {sep}
                                    <div style={{ padding: '0 2px' }}>
                                      <button onClick={() => { void requestMoveToTrash(lead); setMenuOpenId(null); }} className={`${mI} kc-mi-danger`} style={{ fontSize: 12 }}><FontAwesomeIcon icon={faTrash} fixedWidth style={{ marginRight: 8, fontSize: 11 }} /> Delete</button>
                                    </div>
                                  </>;
                                })()}
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid #f1f5f9', background: '#fafafa' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: '#718096' }}>Rows:</span>
                  <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                    style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 13, cursor: 'pointer' }}>
                    {[10, 15, 20, 30, 50].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => setPage(1)} disabled={page === 1} style={pB}>«</button>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pB}>‹ Prev</button>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#2b6cb0', padding: '4px 12px', background: '#ebf4ff', borderRadius: 5 }}>{page} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={pB}>Next ›</button>
                  <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} style={pB}>»</button>
                </div>
                <span style={{ fontSize: 13, color: '#718096' }}>{data.total} leads</span>
              </div>
            </div>
          )}
        </div>

        </div>{/* end inner flex row */}
      </div>{/* end scroll container */}

      {/* Right context panel — docked like left nav */}
      {!isTablet && (
        <ContextPanel
          expanded={panelOpen} activeTab={panelTab}
          onToggle={() => setPanelOpen(o => !o)}
          onTabChange={tab => { setPanelTab(tab); setPanelOpen(true); }}
          upcomingAppts={upcomingAppts}
          followUpLeads={followUpLeads}
          overdueApptLeads={(apptBookedData?.items ?? []).filter(l => !upcomingAppts.some(a => a.id === l.id))}
          onFollowUp={lead => openWhatsApp(lead, 'follow_up')}
          onWhatsApp={id => { const lead = findLeadById(id); if (lead) openWhatsApp(lead); }}
          onSelectLead={lead => { handleStageSelect('APPOINTMENT_BOOKED'); setHighlightId(lead.id); }}
        />
      )}
    </div>
  );
}

// ── Style constants ────────────────────────────────────────────────────────────

const tH: React.CSSProperties = {
  textAlign: 'left', padding: '9px 14px', fontWeight: 600, fontSize: 11,
  color: '#8893a7', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap',
};

const tD: React.CSSProperties = { padding: '10px 14px', verticalAlign: 'middle', overflow: 'hidden', textOverflow: 'ellipsis' };

const mI = 'kc-mi';

const pB: React.CSSProperties = {
  padding: '5px 10px', background: '#fff', border: '1px solid #e2e8f0',
  borderRadius: 5, cursor: 'pointer', fontSize: 13, color: '#4a5568',
};

// Sidebar panel styles
const sp = {
  box: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' } as React.CSSProperties,
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' } as React.CSSProperties,
  title: { fontSize: 13, fontWeight: 700, color: '#374151' } as React.CSSProperties,
  badge: { background: '#f59e0b', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700 } as React.CSSProperties,
  sectionLabel: { padding: '5px 14px', fontSize: 10, fontWeight: 800, color: '#a0aec0', letterSpacing: '0.08em', textTransform: 'uppercase' as const, background: '#f8fafc' } as React.CSSProperties,
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid #f8fafc', gap: 8 } as React.CSSProperties,
  empty: { padding: '24px 14px', textAlign: 'center' as const, fontSize: 13, color: '#a0aec0' } as React.CSSProperties,
  waBtn: { background: 'none', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', fontSize: 18, lineHeight: 1, flexShrink: 0, color: '#25d366' } as React.CSSProperties,
  ph: { display: 'inline-block', padding: '0 4px', background: '#7c3aed', color: '#fff', borderRadius: 3, fontSize: 9, fontWeight: 800, marginRight: 4, verticalAlign: 'middle' } as React.CSSProperties,
  followUpBtn: { background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0 } as React.CSSProperties,
};

// Modal styles
const mo: Record<string, React.CSSProperties> = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  card: { background: '#fff', borderRadius: 8, padding: 28, width: '100%', maxWidth: 560, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { margin: 0, fontSize: 18 },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#718096', lineHeight: 1 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600, color: '#2d3748' },
  input: { padding: '7px 10px', border: '1px solid #cbd5e0', borderRadius: 4, fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  cancelBtn: { padding: '8px 18px', background: '#edf2f7', border: '1px solid #e2e8f0', borderRadius: 4, cursor: 'pointer', fontSize: 14 },
  saveBtn: { padding: '8px 18px', background: '#4299e1', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
};

const am: Record<string, React.CSSProperties> = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 },
  card: { background: '#fff', borderRadius: 14, padding: '24px 28px', width: '100%', maxWidth: 780, boxShadow: '0 16px 56px rgba(0,0,0,0.16), 0 2px 6px rgba(0,0,0,0.04)', boxSizing: 'border-box' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: '#1a202c' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#718096' },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#718096', lineHeight: 1, marginLeft: 8 },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: '#a0aec0', letterSpacing: '0.07em', textTransform: 'uppercase' },
  label: { fontSize: 13, fontWeight: 600, color: '#2d3748' },
  input: { display: 'block', width: '100%', marginTop: 0, padding: '9px 11px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', background: '#fafafa' },
  divider: { borderTop: '1px solid #f1f5f9', margin: '18px 0' },
  error: { color: '#e53e3e', fontSize: 13, marginTop: 8 },
  footer: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 20 },
  cancelBtn: { padding: '9px 16px', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 7, cursor: 'pointer', fontSize: 14, color: '#4a5568', fontWeight: 500 },
  waBtn: { padding: '9px 16px', background: '#25D366', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  confirmBtn: { padding: '9px 22px', background: '#2b6cb0', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 14, fontWeight: 700 },
};
