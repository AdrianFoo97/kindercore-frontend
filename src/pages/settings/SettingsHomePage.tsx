import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useIsTestServer } from '../../hooks/useIsTestServer.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { searchSettings, visibleGroups, type SettingsItem } from './settingsNav.js';
import { C, isAdminRole, storedRole } from './settingsTheme.js';

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
              : results.map(({ group, item }) => <ItemRow key={item.key} item={item} context={group.label} />)}
          </section>
        ) : (
          // Every card the same height: each stretches to its row, and every row matches the tallest (1fr).
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gridAutoRows: '1fr', gap: 16, alignItems: 'stretch' }}>
            {groups.map(g => (
              <section key={g.key} aria-labelledby={`st-${g.key}`} style={card}>
                <h2 id={`st-${g.key}`} style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0, padding: '12px 16px 4px' }}>
                  {g.label}
                </h2>
                {g.items.map(item => <ItemRow key={item.key} item={item} />)}
              </section>
            ))}
          </div>
        )}
      </div>
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
