import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import type { AuthRoleRecord } from '../../api/auth-roles.js';
import { ALL_MODULE_KEYS, MODULE_LABELS } from '../../constants/authModules.js';
import { combinedModules, groupByArea, searchRoles } from './accessRoleForm.js';

// A person's access roles, Stripe-style: every role listed in place with a
// checkbox and a one-line description (tick as many as apply), searchable,
// grouped by area, in a fixed-height scrolling box so the dialog keeps its
// size. The role their position gives is ticked and marked. Underneath, a
// plain summary of what they can open.

const C = {
  text: '#1a1f36', sub: '#3c4257', muted: '#697386', border: '#e3e8ee', divider: '#ebeef1',
  selected: '#f5f6ff', accent: '#5a67d8', badge: '#f6f8fa', badgeText: '#3c4257',
};
/** Height of the role list before it scrolls — keeps the dialog a steady size. */
const LIST_MAX_HEIGHT = 300;

export interface InheritedRole { role: AuthRoleRecord; positionName: string }

export default function AccessRolesPicker({ roles, value, onChange, inherited, id, scroll = true, showSummary = true }: {
  roles: AuthRoleRecord[]; value: string[]; onChange: (ids: string[]) => void;
  /** The role their linked staff record's position gives, if any. */
  inherited?: InheritedRole | null;
  id?: string;
  /** Keep the list in a fixed-height scrolling box (pop-ups). On a page, let it flow with the page. */
  scroll?: boolean;
  /** Show "Can open" under the list — off when the page has its own summary. */
  showSummary?: boolean;
}) {
  const [query, setQuery] = useState('');
  const isChosen = (rid: string) => rid === inherited?.role.id || value.includes(rid);
  const chosenCount = roles.filter(r => isChosen(r.id)).length;
  const opens = combinedModules(roles, [...value, ...(inherited ? [inherited.role.id] : [])], ALL_MODULE_KEYS);
  const found = searchRoles(roles, query);
  const groups = [
    ...groupByArea(found.filter(r => r.builtIn)),
    ...(found.some(r => !r.builtIn) ? [{ area: 'Your roles', roles: found.filter(r => !r.builtIn) }] : []),
  ];
  const toggle = (rid: string) => onChange(value.includes(rid) ? value.filter(v => v !== rid) : [...value, rid]);

  return (
    <div>
      <div style={s.toolbar}>
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 12, pointerEvents: 'none' }} />
          <input id={id} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search roles"
            aria-label="Search roles" style={s.search} />
        </div>
        <span aria-live="polite" style={{ fontSize: 13, color: C.muted, whiteSpace: 'nowrap' }}>{chosenCount} selected</span>
      </div>
      <div style={s.box}>
        <div role="group" aria-label="Access roles" style={scroll ? { maxHeight: LIST_MAX_HEIGHT, overflowY: 'auto' } : undefined}>
          {groups.length === 0 && <div style={{ padding: 16, fontSize: 13, color: C.muted }}>No roles match “{query.trim()}”.</div>}
          {groups.map(g => (
            <div key={g.area}>
              <div style={s.group}>{g.area}</div>
              {g.roles.map(r => (
                <RoleRow key={r.id} role={r} checked={isChosen(r.id)}
                  fromPosition={r.id === inherited?.role.id ? inherited.positionName : null}
                  onToggle={() => toggle(r.id)} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {showSummary && <div style={{ marginTop: 16 }}>
        <div style={s.label}>Can open</div>
        {opens.length === 0 ? (
          <div style={{ fontSize: 13, color: C.muted }}>Only their own pages.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {opens.map(m => <span key={m} style={s.badge}>{MODULE_LABELS[m]}</span>)}
          </div>
        )}
      </div>}
    </div>
  );
}

function RoleRow({ role, checked, fromPosition, onToggle }: {
  role: AuthRoleRecord; checked: boolean; fromPosition: string | null; onToggle: () => void;
}) {
  const locked = fromPosition !== null;
  return (
    <label style={{ ...s.row, background: checked ? C.selected : '#fff', cursor: locked ? 'default' : 'pointer' }}
      title={locked ? 'Comes with their position — change it on the position' : undefined}>
      <input type="checkbox" checked={checked} disabled={locked} onChange={onToggle}
        style={{ width: 16, height: 16, marginTop: 2, accentColor: C.accent, flexShrink: 0, cursor: locked ? 'default' : 'pointer' }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{role.name}</span>
          {locked && <span style={s.tag}>From position · {fromPosition}</span>}
        </span>
        {role.description && <span style={s.desc}>{role.description}</span>}
      </span>
    </label>
  );
}

const s: Record<string, React.CSSProperties> = {
  box: { border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', background: '#fff' },
  toolbar: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 },
  search: { width: '100%', minHeight: 40, padding: '0 12px 0 34px', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', color: C.text, background: '#fff', boxSizing: 'border-box' },
  group: { padding: '12px 12px 4px', fontSize: 12, fontWeight: 600, color: C.muted, background: '#fff' },
  row: { display: 'flex', alignItems: 'flex-start', gap: 12, minHeight: 44, padding: '8px 12px', borderTop: `1px solid ${C.divider}`, boxSizing: 'border-box' },
  desc: {
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
    marginTop: 2, fontSize: 13, color: C.muted, lineHeight: 1.45,
  },
  tag: { fontSize: 11, fontWeight: 600, color: C.sub, background: C.badge, border: `1px solid ${C.border}`, borderRadius: 4, padding: '1px 6px' },
  label: { fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: 8 },
  badge: { fontSize: 12, fontWeight: 500, color: C.badgeText, background: C.badge, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 8px' },
};
