import { useState } from 'react';
import { getAvatarColor, getInitials } from '../../components/onboarding/avatar.js';
import { groupAssignable } from './appraisalSchedule.js';
import { ADMIN as p } from './runTheme.js';

/** Show up to this many rows, then scroll inside the list. */
const VISIBLE_ROWS = 10;
const ROW_HEIGHT = { mobile: 61, desktop: 53 };
/** Ten rows tall at most — and never taller than most of the screen. */
const LIST_MAX_HEIGHT = (mobile: boolean) => `min(${VISIBLE_ROWS * (mobile ? ROW_HEIGHT.mobile : ROW_HEIGHT.desktop)}px, 60vh)`;

export interface StaffOption { id: string; name: string; positionId: string | null; positionName: string | null; scheduleCount: number }

interface Props {
  staff: StaffOption[];
  picked: string[];
  /** Shown but can't be picked, with why (already on this form, not for this form's positions). */
  disabled: Map<string, string>;
  onChange: (ids: string[]) => void;
  mobile: boolean;
}

/**
 * Staff to tick, grouped: who can be assigned first, then who can't (with why),
 * each A–Z. A search and "Select all" (everyone assignable that matches). Up to
 * ten rows show; more scroll inside the list, which never grows taller than the
 * screen. Each shows their position and how many schedules they're on already.
 */
export default function ScheduleStaffList({ staff, picked, disabled, onChange, mobile }: Props) {
  const [search, setSearch] = useState('');
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const matching = staff.filter(s => words.every(w => s.name.toLowerCase().includes(w)));
  const { assignable: pickable, notAssignable } = groupAssignable(matching, disabled);
  const groups = [{ title: 'Can be assigned', list: pickable }, { title: 'Can’t be assigned', list: notAssignable }];
  const allPicked = pickable.length > 0 && pickable.every(s => picked.includes(s.id));
  const toggle = (id: string) => onChange(picked.includes(id) ? picked.filter(x => x !== id) : [...picked, id]);
  const toggleAll = () => onChange(allPicked
    ? picked.filter(id => !pickable.some(s => s.id === id))
    : [...new Set([...picked, ...pickable.map(s => s.id)])]);

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="search" aria-label="Search staff" placeholder="Search staff…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, boxSizing: 'border-box', padding: '8px 12px', minHeight: mobile ? 44 : 36, fontSize: mobile ? 16 : 14, border: `1px solid ${p.borderStrong}`, borderRadius: 8, fontFamily: 'inherit' }} />
        <span style={{ fontSize: 13, color: p.muted, whiteSpace: 'nowrap' }}>{picked.filter(id => !disabled.has(id)).length} selected</span>
      </div>
      {matching.length === 0 ? <p style={{ fontSize: 13, color: p.muted }}>No staff match “{search.trim()}”.</p> : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0 4px', fontSize: 12, fontWeight: 600, color: p.muted }}>
            <span style={{ flex: 1 }}>{matching.length} staff</span>
            {pickable.length > 0 && (
              <button type="button" onClick={toggleAll} style={{ border: 'none', background: 'none', color: p.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0' }}>
                {allPicked ? 'Clear all' : `Select all ${pickable.length}`}
              </button>
            )}
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, border: `1px solid ${p.border}`, borderRadius: 8, maxHeight: LIST_MAX_HEIGHT(mobile), overflowY: 'auto', overscrollBehavior: 'contain' }}>
            {groups.map(g => g.list.length > 0 && (
              <li key={g.title} role="group" aria-label={g.title}>
                {/* Sticks to the top while its group scrolls by. */}
                <div style={{ position: 'sticky', top: 0, zIndex: 1, padding: '6px 12px', fontSize: 12, fontWeight: 700, color: p.muted, background: p.bg, borderBottom: `1px solid ${p.border}` }}>
                  {g.title} · {g.list.length}
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {g.list.map((s, i) => <StaffRow key={s.id} s={s} first={i === 0} reason={disabled.get(s.id)} on={!disabled.has(s.id) && picked.includes(s.id)} onToggle={() => toggle(s.id)} mobile={mobile} />)}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

interface RowProps { s: StaffOption; first: boolean; reason: string | undefined; on: boolean; onToggle: () => void; mobile: boolean }

/** One person: tick box, initials, name and position — and why not, when they can't be assigned. */
function StaffRow({ s, first, reason, on, onToggle, mobile }: RowProps) {
  const avatar = getAvatarColor(s.name);
  return (
    <li style={{ borderTop: first ? 'none' : `1px solid ${p.border}`, background: on ? p.accentSoft : undefined }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', minHeight: mobile ? 44 : 36, cursor: reason ? 'default' : 'pointer', opacity: reason ? 0.6 : 1 }}>
        <input type="checkbox" checked={on} disabled={!!reason} onChange={onToggle} style={{ accentColor: p.accent, width: 16, height: 16 }} />
        <span aria-hidden style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: avatar.bg, color: avatar.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
          {getInitials(s.name)}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: p.text }}>{s.name}</span>
          <span style={{ display: 'block', fontSize: 12, color: p.muted }}>{s.positionName ?? 'No position'}</span>
        </span>
        <span style={{ fontSize: 12, color: p.muted, textAlign: 'right' }}>
          {reason ?? (s.scheduleCount ? `On ${s.scheduleCount} schedule${s.scheduleCount === 1 ? '' : 's'}` : 'Not scheduled')}
        </span>
      </label>
    </li>
  );
}