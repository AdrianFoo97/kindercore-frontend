import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowsRotate, faBan, faBoxArchive, faCalendarCheck, faChevronLeft, faChevronRight,
  faCircleCheck, faInbox, faLayerGroup, faPhone, faTrash, faUserXmark,
} from '@fortawesome/free-solid-svg-icons';

// Left-hand stage navigation for the Leads page: full sidebar on desktop,
// an icon rail when collapsed, horizontal pills on tablet / phone.

export type PipelineStage = 'all_active' | 'NEW' | 'CONTACTED' | 'APPOINTMENT_BOOKED' | 'FOLLOW_UP' | 'ENROLLED' | 'LOST' | 'REJECTED' | 'all_closed' | 'TRASH' | 'all_history';

export type StatsData = {
  NEW?: number; CONTACTED?: number; APPOINTMENT_BOOKED?: number;
  FOLLOW_UP?: number; ENROLLED?: number; LOST?: number; REJECTED?: number; TRASH?: number;
};

interface StageMeta {
  key: PipelineStage;
  label: string;
  icon: IconDefinition;
  accent: string;
  bg: string;
  text: string;
}

export const ACTIVE_STAGES: StageMeta[] = [
  { key: 'NEW',                label: 'New',         icon: faInbox,         accent: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8' },
  { key: 'CONTACTED',          label: 'Contacted',   icon: faPhone,         accent: '#f59e0b', bg: '#fffbeb', text: '#92400e' },
  { key: 'APPOINTMENT_BOOKED', label: 'Appt Booked', icon: faCalendarCheck, accent: '#6366f1', bg: '#eef2ff', text: '#3730a3' },
  { key: 'FOLLOW_UP',          label: 'Follow-Up',   icon: faArrowsRotate,  accent: '#f97316', bg: '#fff7ed', text: '#c2410c' },
];

export const CLOSED_STAGES: StageMeta[] = [
  { key: 'ENROLLED', label: 'Enrolled', icon: faCircleCheck, accent: '#22c55e', bg: '#f0fdf4', text: '#166534' },
  { key: 'LOST',     label: 'Lost',     icon: faUserXmark,   accent: '#f87171', bg: '#fef2f2', text: '#991b1b' },
  { key: 'REJECTED', label: 'Rejected', icon: faBan,         accent: '#d97706', bg: '#fffbeb', text: '#92400e' },
];

const GROUP_ACCENT = '#64748b';
const IDLE_BORDER = '#d1d5db';
const IDLE_ICON = '#9ca3af';

/** The round stage badge — filled with the stage colour when selected. */
function StageIcon({ icon, accent, selected, size = 22 }: { icon: IconDefinition; accent: string; selected: boolean; size?: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.45), lineHeight: 1,
      background: selected ? accent : '#fff',
      border: `${selected ? 2 : 1.5}px solid ${selected ? accent : IDLE_BORDER}`,
      color: selected ? '#fff' : IDLE_ICON,
      position: 'relative', zIndex: 1,
    }}>
      <FontAwesomeIcon icon={icon} />
    </span>
  );
}

/** One square button of the collapsed icon rail, count in the corner. */
function RailButton({ label, icon, accent, count, selected, onClick }: {
  label: string; icon: IconDefinition; accent: string; count: number; selected: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} title={`${label} (${count})`} aria-label={`${label} (${count})`} style={{
      width: 36, height: 36, border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
      background: selected ? accent + '18' : 'none',
    }}>
      <StageIcon icon={icon} accent={accent} selected={selected} />
      {count > 0 && (
        <span style={{ position: 'absolute', top: 2, right: 2, fontSize: 8, fontWeight: 700, color: accent, lineHeight: 1 }}>{count}</span>
      )}
    </button>
  );
}

export function PipelineNav({ selected, onChange, stats, compact, collapsed, onToggle }: {
  selected: PipelineStage; onChange: (stage: PipelineStage) => void; stats: StatsData | undefined; compact?: boolean; collapsed?: boolean; onToggle?: () => void;
}) {
  const getCount = (key: PipelineStage) => (stats as Record<string, number> | undefined)?.[key] ?? 0;
  const totalActive = ACTIVE_STAGES.reduce((sum, s) => sum + getCount(s.key), 0);
  const totalClosed = CLOSED_STAGES.reduce((sum, s) => sum + getCount(s.key), 0);
  const trashCount = getCount('TRASH');
  const allActiveSelected = selected === 'all_active';
  const allClosedSelected = selected === 'all_closed';

  // ── Compact horizontal mode (mobile / tablet) ──
  if (compact) {
    const allStages = [
      { key: 'all_active' as PipelineStage, label: 'All', accent: GROUP_ACCENT, count: totalActive },
      ...ACTIVE_STAGES.map(s => ({ key: s.key, label: s.label, accent: s.accent, count: getCount(s.key) })),
      { key: 'all_closed' as PipelineStage, label: 'Closed', accent: GROUP_ACCENT, count: totalClosed },
      ...CLOSED_STAGES.map(s => ({ key: s.key, label: s.label, accent: s.accent, count: getCount(s.key) })),
      { key: 'TRASH' as PipelineStage, label: 'Trash', accent: '#e53e3e', count: trashCount },
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

  // ── Collapsed sidebar (icon rail with tooltips) ──
  if (collapsed) {
    const divider = <div style={{ width: 20, height: 1, background: '#f1f5f9', margin: '6px 0' }} />;
    return (
      <div className="kc-no-scrollbar" style={{ width: 48, flexShrink: 0, background: '#fff', borderRight: '1px solid #e2e8f0', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 12, gap: 2 }}>
        <button onClick={onToggle} title="Show pipeline" aria-label="Show pipeline" style={{
          width: 32, height: 28, border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 11, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6,
        }}>
          <FontAwesomeIcon icon={faChevronRight} />
        </button>

        <RailButton label="All Active" icon={faLayerGroup} accent={GROUP_ACCENT} count={totalActive} selected={allActiveSelected} onClick={() => onChange('all_active')} />
        {ACTIVE_STAGES.map(s => (
          <RailButton key={s.key} label={s.label} icon={s.icon} accent={s.accent} count={getCount(s.key)} selected={selected === s.key} onClick={() => onChange(s.key)} />
        ))}

        {divider}

        <RailButton label="All Closed" icon={faBoxArchive} accent={GROUP_ACCENT} count={totalClosed} selected={allClosedSelected} onClick={() => onChange('all_closed')} />
        {CLOSED_STAGES.map(s => (
          <RailButton key={s.key} label={s.label} icon={s.icon} accent={s.accent} count={getCount(s.key)} selected={selected === s.key} onClick={() => onChange(s.key)} />
        ))}

        {divider}

        <button onClick={() => onChange('TRASH')} title={`Trash (${trashCount})`} aria-label={`Trash (${trashCount})`} style={{
          width: 36, height: 36, border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: selected === 'TRASH' ? '#fee2e2' : 'none', color: selected === 'TRASH' ? '#e53e3e' : IDLE_BORDER, fontSize: 13,
        }}>
          <FontAwesomeIcon icon={faTrash} />
        </button>
      </div>
    );
  }

  // ── Full vertical sidebar (desktop) ──
  return (
    <div className="kc-no-scrollbar" style={{ width: 208, flexShrink: 0, background: '#fff', borderRight: '1px solid #e2e8f0', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', paddingTop: 8 }}>

      {onToggle && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '2px 8px 8px' }}>
          <button onClick={onToggle} title="Collapse sidebar" aria-label="Collapse sidebar" style={{
            color: '#cbd5e1', fontSize: 10, padding: '4px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: 4, border: 'none', background: 'transparent',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = '#f1f5f9'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.background = 'transparent'; }}
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
        </div>
      )}

      <GroupHeader label="Active Pipeline" count={totalActive} selected={allActiveSelected} onClick={() => onChange('all_active')} />

      {/* Pipeline stages, joined by a vertical line behind the icons */}
      <div style={{ position: 'relative', marginBottom: 4 }}>
        <div style={{ position: 'absolute', left: 25, top: 14, bottom: 14, width: 1, background: '#e5e7eb' }} />
        {ACTIVE_STAGES.map(s => (
          <StageRow key={s.key} stage={s} count={getCount(s.key)} selected={selected === s.key} onClick={() => onChange(s.key)} />
        ))}
      </div>

      <div style={{ margin: '12px 14px 10px', borderTop: '1px solid #f1f5f9' }} />

      <GroupHeader label="Closed" count={totalClosed} selected={allClosedSelected} onClick={() => onChange('all_closed')} />
      {CLOSED_STAGES.map(s => (
        <StageRow key={s.key} stage={s} count={getCount(s.key)} selected={selected === s.key} onClick={() => onChange(s.key)} />
      ))}

      <div style={{ margin: '12px 14px 10px', borderTop: '1px solid #f1f5f9' }} />

      <TrashRow count={trashCount} selected={selected === 'TRASH'} onClick={() => onChange('TRASH')} />
    </div>
  );
}

/** "Active Pipeline" / "Closed" heading — also the "all in this group" filter. */
function GroupHeader({ label, count, selected, onClick }: { label: string; count: number; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      width: '100%', padding: '7px 14px',
      background: selected ? '#f1f5f9' : 'none',
      border: 'none', borderLeft: `${selected ? 4 : 3}px solid ${selected ? GROUP_ACCENT : 'transparent'}`,
      cursor: 'pointer', marginBottom: 2,
    }}>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: selected ? '#334155' : '#94a3b8' }}>
        {label}
      </span>
      <CountPill count={count} accent={GROUP_ACCENT} selected={selected} />
    </button>
  );
}

function StageRow({ stage, count, selected, onClick }: { stage: StageMeta; count: number; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
      padding: '8px 14px 8px 11px',
      background: selected ? stage.bg : 'none',
      border: 'none', borderLeft: `${selected ? 4 : 3}px solid ${selected ? stage.accent : 'transparent'}`,
      cursor: 'pointer', textAlign: 'left', position: 'relative', zIndex: 1,
    }}>
      <StageIcon icon={stage.icon} accent={stage.accent} selected={selected} size={selected ? 22 : 20} />
      <span style={{ flex: 1, fontSize: 13, fontWeight: selected ? 700 : 400, color: selected ? stage.text : '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {stage.label}
      </span>
      <CountPill count={count} accent={stage.accent} selected={selected} />
    </button>
  );
}

function TrashRow({ count, selected, onClick }: { count: number; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
      padding: '8px 14px 8px 11px',
      background: selected ? '#fff5f5' : 'none',
      border: 'none', borderLeft: `${selected ? 4 : 3}px solid ${selected ? '#e53e3e' : 'transparent'}`,
      cursor: 'pointer', textAlign: 'left',
    }}>
      <FontAwesomeIcon icon={faTrash} style={{ fontSize: selected ? 13 : 12, color: selected ? '#e53e3e' : IDLE_BORDER, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, fontWeight: selected ? 700 : 400, color: selected ? '#c53030' : '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        Trash
      </span>
      {count > 0 && <CountPill count={count} accent="#e53e3e" selected={selected} />}
    </button>
  );
}

function CountPill({ count, accent, selected }: { count: number; accent: string; selected: boolean }) {
  return (
    <span style={{ fontSize: selected ? 12 : 11, fontWeight: 700, borderRadius: 10, padding: selected ? '2px 8px' : '1px 7px', background: selected ? accent : '#f1f5f9', color: selected ? '#fff' : '#94a3b8', flexShrink: 0 }}>
      {count}
    </span>
  );
}
