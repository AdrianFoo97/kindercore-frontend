import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faMagnifyingGlass, faUsers, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useIsTestServer } from '../../hooks/useIsTestServer.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { groupSections, searchSettings, visibleGroups, type SettingsGroup, type SettingsItem } from './settingsNav.js';
import { C, isAdminRole, storedRole } from './settingsTheme.js';
import { columnCount, splitIntoColumns } from './settingsColumns.js';

/** /settings — every setting, grouped, with search. */
export default function SettingsHomePage() {
  const navigate = useNavigate();
  const { isMobile } = useIsMobile();
  const groups = visibleGroups(useIsTestServer(isAdminRole(storedRole())));
  const [query, setQuery] = useState('');
  const results = searchSettings(query, groups);
  const searching = query.trim().length > 0;

  return (
    <div className="m-pad" style={{ padding: '32px 32px 48px', background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: C.text }}>
      <style>{`.st-item:hover { background: ${C.hover}; }`}</style>
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Settings</h1>
          <label style={{ position: 'relative', flex: '0 1 360px', minWidth: 220 }}>
            <span style={srOnly}>Search settings</span>
            <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 13 }} />
            <input
              autoFocus={!isMobile /* never pop the phone keyboard on arrival */} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search settings"
              onKeyDown={e => {
                if (e.key === 'Enter' && results[0]) navigate(results[0].item.to);
                if (e.key === 'Escape') setQuery('');
              }}
              style={{ width: '100%', boxSizing: 'border-box', minHeight: 38, padding: '8px 36px 8px 34px', fontSize: 14, color: C.text,
                background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, fontFamily: 'inherit' }}
            />
            {searching && (
              <button type="button" aria-label="Clear search" title="Clear search" onClick={() => setQuery('')}
                style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30, border: 'none', background: 'none', color: C.muted, cursor: 'pointer', borderRadius: 6 }}>
                <FontAwesomeIcon icon={faXmark} />
              </button>
            )}
          </label>
        </header>

        {searching ? (
          <section aria-label="Search results" style={card}>
            {results.length === 0
              ? <p style={{ margin: 0, padding: 16, fontSize: 14, color: C.muted }}>No settings match “{query.trim()}”.</p>
              : results.map(({ group, item }) => <ItemRow key={item.key} item={item} context={group.section ? `${group.section} · ${group.label}` : group.label} />)}
          </section>
        ) : (
          // A section (HRMS) gets its own heading, with one card per module under it.
          groupSections(groups).map((sec, i) => sec.section ? (
            // One tinted, bordered panel round the whole section (same as the sidebar), so its cards plainly belong to it.
            <section key={sec.section} aria-labelledby={`st-sec-${i}`} style={{ margin: '0 0 16px', padding: 16, background: C.hover, border: `1px solid ${C.border}`, borderRadius: 14 }}>
              <h2 id={`st-sec-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: C.text, margin: '0 0 12px' }}>
                <FontAwesomeIcon icon={faUsers} style={{ fontSize: 14, color: C.primary }} /> {sec.section}
              </h2>
              <GroupCards groups={sec.groups} level={3} />
            </section>
          ) : (
            <div key={`plain-${i}`} style={{ margin: '0 0 16px' }}><GroupCards groups={sec.groups} level={2} /></div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * One card per group, in columns (down each, then across), split so the columns come out even.
 * Every column ends on the same line: its last card stretches to fill. Groups are never merged.
 */
/** Narrowest a column of group cards gets before there's one fewer column. */
const GROUP_COLUMN_MIN = 300;
const GROUP_GAP = 16;
/** A card's heading counts as about one row when evening out the columns. */
const CARD_HEADING_ROWS = 1;

/** An element's width, kept current as the window resizes (starts from the window's, so there's no one-column flash). */
function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth));
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function GroupCards({ groups, level }: { groups: SettingsGroup[]; level: 2 | 3 }) {
  const Heading = level === 2 ? 'h2' : 'h3';
  const [ref, width] = useWidth<HTMLDivElement>();
  // A card is about as tall as its heading plus its rows.
  const columns = splitIntoColumns(groups, g => CARD_HEADING_ROWS + g.items.length, columnCount(width, GROUP_COLUMN_MIN, GROUP_GAP));
  return (
    <div ref={ref} style={{ display: 'flex', gap: GROUP_GAP, alignItems: 'stretch' }}>
      {columns.map((col, ci) => (
        <div key={ci} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: GROUP_GAP }}>
          {col.map((g, gi) => (
            <section key={g.key} aria-labelledby={`st-${g.key}`} style={{ ...card, boxSizing: 'border-box', ...(gi === col.length - 1 ? { flex: 1 } : {}) }}>
              <Heading id={`st-${g.key}`} style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0, padding: '12px 16px 4px' }}>
                {g.label}
              </Heading>
              {g.items.map(item => <ItemRow key={item.key} item={item} />)}
            </section>
          ))}
        </div>
      ))}
    </div>
  );
}

function ItemRow({ item, context }: { item: SettingsItem; context?: string }) {
  return (
    <Link to={item.to} className="st-item" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', textDecoration: 'none', color: 'inherit', borderRadius: 8 }}>
      <span aria-hidden style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: item.danger ? C.dangerSoft : C.primarySoft, color: item.danger ? C.danger : C.primary, fontSize: 14,
      }}>
        <FontAwesomeIcon icon={item.icon} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: item.danger ? C.danger : C.text }}>
          {item.label}{context && <span style={{ fontWeight: 400, color: C.muted }}> · {context}</span>}
        </span>
        <span style={{ display: 'block', fontSize: 13, color: C.muted, marginTop: 2, lineHeight: 1.4 }}>{item.description}</span>
      </span>
      <FontAwesomeIcon icon={faChevronRight} aria-hidden style={{ color: '#cbd5e1', fontSize: 12 }} />
    </Link>
  );
}

const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 4 };
const srOnly: React.CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' };
