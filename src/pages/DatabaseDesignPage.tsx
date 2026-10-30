import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDatabase, faSearch, faXmark, faKey, faArrowRight, faArrowLeft, faRotate, faLink, faCircleQuestion,
} from '@fortawesome/free-solid-svg-icons';
import { fetchDbSchema, DbSchema, DbTable, DbRelation } from '../api/admin.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { TABLE_NOTES, DOMAIN_ORDER, Domain } from './dbTableNotes.js';
import DatabaseErd from './DatabaseErd.js';

// Admin → Database Design (Admin + Superadmin). The structure shown is read
// LIVE from whichever database this environment's server uses (GET
// /api/admin/db-schema → MySQL information_schema), so after a migration is
// applied on test, the test site shows the new design immediately — no
// manual update. Plain-English notes per table live in ./dbTableNotes.ts.

const C = {
  bg: '#f8fafc', card: '#fff', border: '#e8ebf0', borderSoft: '#f1f3f6',
  text: '#0f172a', textSub: '#475569', muted: '#64748b', mutedSoft: '#94a3b8',
  primary: '#5a67d8', primarySoft: '#eef0fa', primaryDeep: '#3c339a',
  warn: '#b45309', warnSoft: '#fffbeb',
};
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

const domainOf = (t: string): Domain => TABLE_NOTES[t]?.domain ?? 'Other';

function timeAgo(iso: string) {
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

export default function DatabaseDesignPage() {
  const raw = localStorage.getItem('user');
  const role = raw ? (JSON.parse(raw) as { role?: string }).role : undefined;
  const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';
  const { isMobile } = useIsMobile();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['db-schema'],
    queryFn: fetchDbSchema,
    enabled: isAdmin,
  });

  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState<Domain | 'All'>('All');
  const [selected, setSelected] = useState<string | null>(null);
  // Diagram first — it answers "what does the design look like?" at a glance.
  const [view, setView] = useState<'diagram' | 'tables'>('diagram');

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => (data?.tables ?? []).filter(t =>
    (domain === 'All' || domainOf(t.name) === domain) &&
    (!q || t.name.toLowerCase().includes(q) || t.columns.some(c => c.name.toLowerCase().includes(q))
      || (TABLE_NOTES[t.name]?.about ?? '').toLowerCase().includes(q)),
  ), [data, domain, q]);

  if (!isAdmin) {
    return <div style={{ padding: 40, color: C.muted, fontFamily: 'system-ui, sans-serif' }}>This page is only available to Admins.</div>;
  }

  const current = data?.tables.find(t => t.name === selected) ?? (isMobile ? null : visible[0] ?? null);
  const fkCount = data?.relations.filter(r => r.kind === 'foreignKey').length ?? 0;
  const inferredCount = (data?.relations.length ?? 0) - fkCount;
  const undescribed = (data?.tables ?? []).filter(t => !TABLE_NOTES[t.name]);
  const domainsPresent = DOMAIN_ORDER.filter(d => (data?.tables ?? []).some(t => domainOf(t.name) === d));

  return (
    <div style={st.page}>
      <div style={st.inner}>
        {/* One compact row — the diagram / table list is the point of the page. */}
        <div style={st.header}>
          <h1 style={st.h1}
            title="Every table, its columns and how tables link — read straight from the database, so it updates on its own whenever the database changes.">
            <FontAwesomeIcon icon={faDatabase} style={{ color: C.primary, fontSize: 16, marginRight: 8 }} />Database Design
          </h1>
          {data && (
            <div style={st.stats}>
              <code style={st.code}>{data.database}</code>
              <Stat label="tables" value={data.tables.length} />
              <Stat label="columns" value={data.tables.reduce((n, t) => n + t.columns.length, 0)} />
              <Stat label="links" value={data.relations.length} hint={`${fkCount} enforced by the database · ${inferredCount} inferred from column names`} />
              <Stat label="rows (approx.)" value={data.tables.reduce((n, t) => n + t.approxRows, 0)} />
              <span>· read {timeAgo(data.readAt)}</span>
            </div>
          )}
          <button onClick={() => refetch()} disabled={isFetching} style={st.refreshBtn(isFetching)}>
            <FontAwesomeIcon icon={faRotate} spin={isFetching} style={{ fontSize: 11 }} /> {isFetching ? 'Reading…' : 'Refresh'}
          </button>
        </div>

        {isLoading ? (
          <div style={st.empty}>Reading the database structure…</div>
        ) : error || !data ? (
          <div style={st.empty}>Couldn’t read the database structure. {(error as Error | null)?.message}</div>
        ) : (
          <>
            {undescribed.length > 0 && (
              <div style={st.notice}>
                <FontAwesomeIcon icon={faCircleQuestion} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  {undescribed.length} table{undescribed.length === 1 ? ' has' : 's have'} no description yet ({undescribed.map(t => t.name).join(', ')}) —
                  add {undescribed.length === 1 ? 'it' : 'them'} to <code style={st.code}>src/pages/dbTableNotes.ts</code>.
                </span>
              </div>
            )}

            <div style={st.toolbar}>
              <div style={st.segment} role="tablist" aria-label="View">
                {(['diagram', 'tables'] as const).map(v => (
                  <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} style={st.segBtn(view === v)}>
                    {v === 'diagram' ? 'Diagram' : 'Tables'}
                  </button>
                ))}
              </div>
              <div style={st.searchWrap}>
                <FontAwesomeIcon icon={faSearch} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.mutedSoft }} />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tables or columns — e.g. teacherId, fee, Lead…" style={st.search} />
                {query && <button onClick={() => setQuery('')} aria-label="Clear search" style={st.clearBtn}><FontAwesomeIcon icon={faXmark} /></button>}
              </div>
              <select value={domain} onChange={e => setDomain(e.target.value as Domain | 'All')} style={st.select} aria-label="Filter by area">
                <option value="All">All areas</option>
                {domainsPresent.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {view === 'diagram' ? (
              // Search / area filter dim non-matching boxes rather than
              // removing them, so the overall shape stays recognisable.
              <DatabaseErd
                schema={data}
                visibleNames={new Set(visible.map(t => t.name))}
                onOpenTable={name => { setSelected(name); setQuery(''); setDomain('All'); setView('tables'); }}
              />
            ) : (
              <div style={st.panes(isMobile)}>
                {(!isMobile || !current) && (
                  <TableList tables={visible} selected={current?.name ?? null} onSelect={setSelected} query={q} />
                )}
                {current && (
                  <TableDetail
                    table={current}
                    schema={data}
                    onSelect={name => { setSelected(name); setQuery(''); setDomain('All'); }}
                    onBack={isMobile ? () => setSelected(null) : undefined}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <span title={hint} style={{ cursor: 'default' }}>
      <b style={{ color: C.text, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value.toLocaleString()}</b> {label}
    </span>
  );
}

function TableList({ tables, selected, onSelect, query }: {
  tables: DbTable[]; selected: string | null; onSelect: (name: string) => void; query: string;
}) {
  if (tables.length === 0) {
    return <div style={{ ...st.listPane, padding: 20, color: C.muted, fontSize: 13 }}>No tables match “{query}”.</div>;
  }
  return (
    <div style={st.listPane}>
      {DOMAIN_ORDER.filter(d => tables.some(t => domainOf(t.name) === d)).map(d => (
        <Fragment key={d}>
          <div style={st.groupLabel}>{d}</div>
          {tables.filter(t => domainOf(t.name) === d).map(t => {
            const on = t.name === selected;
            const colHit = query && !t.name.toLowerCase().includes(query)
              ? t.columns.find(c => c.name.toLowerCase().includes(query))?.name : undefined;
            return (
              <button key={t.name} onClick={() => onSelect(t.name)} style={st.listRow(on)}>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.name}
                  {colHit && <span style={{ color: C.mutedSoft, fontWeight: 500 }}> · {colHit}</span>}
                </span>
                <span style={st.listCount}>{t.columns.length}</span>
              </button>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

function TableDetail({ table: t, schema, onSelect, onBack }: {
  table: DbTable; schema: DbSchema; onSelect: (name: string) => void; onBack?: () => void;
}) {
  const note = TABLE_NOTES[t.name];
  const outgoing = schema.relations.filter(r => r.fromTable === t.name);
  const incoming = schema.relations.filter(r => r.toTable === t.name && r.fromTable !== t.name);
  const linkByColumn = new Map(outgoing.map(r => [r.fromColumn, r]));

  return (
    <div style={st.detailPane}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {onBack && (
          <button onClick={onBack} style={st.backBtn} aria-label="Back to tables"><FontAwesomeIcon icon={faArrowLeft} /></button>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={st.detailDomain}>{domainOf(t.name)}</div>
          <h2 style={st.detailName}>{t.name}</h2>
          <p style={{ ...st.about, ...(note ? {} : { color: C.warn, fontStyle: 'italic' }) }}>
            {note?.about ?? 'No description yet.'}
          </p>
          <div style={st.meta}>
            {t.columns.length} columns · ~{t.approxRows.toLocaleString()} rows
          </div>
        </div>
      </div>

      <div style={st.tableWrap}>
        <table style={st.table}>
          <thead>
            <tr>
              <th style={st.th}>Column</th>
              <th style={st.th}>Type</th>
              <th style={st.th}>Required</th>
              <th style={st.th}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {t.columns.map(c => {
              const link = linkByColumn.get(c.name);
              return (
                <tr key={c.name}>
                  <td style={{ ...st.td, fontFamily: MONO, fontWeight: c.primaryKey ? 700 : 500, color: C.text }}>
                    {c.primaryKey && <FontAwesomeIcon icon={faKey} title="Primary key" style={{ color: '#d97706', fontSize: 10, marginRight: 6 }} />}
                    {c.name}
                  </td>
                  <td style={{ ...st.td, fontFamily: MONO, color: C.textSub }}>{c.type}</td>
                  <td style={{ ...st.td, color: c.nullable ? C.mutedSoft : C.textSub }}>{c.nullable ? 'optional' : 'required'}</td>
                  <td style={st.td}>
                    <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {c.primaryKey && <span style={st.pill('#fef3c7', '#92400e')}>Primary key</span>}
                      {c.unique && <span style={st.pill('#f1f5f9', '#475569')}>Unique</span>}
                      {link && (
                        <button onClick={() => onSelect(link.toTable)} style={st.linkPill(link.kind)} title={link.kind === 'inferred' ? 'Inferred from the column name — not enforced by the database' : 'Foreign key enforced by the database'}>
                          <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 9 }} /> {link.toTable}
                        </button>
                      )}
                      {c.extra && <span style={{ fontSize: 11, color: C.mutedSoft }}>{c.extra}</span>}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={st.linksGrid}>
        <LinkList title="Links to" icon={faArrowRight} relations={outgoing} side="to" onSelect={onSelect} empty="This table doesn’t point at any other table." />
        <LinkList title="Linked from" icon={faArrowLeft} relations={incoming} side="from" onSelect={onSelect} empty="No other table points at this one." />
      </div>
      <div style={st.legend}>
        <span style={st.linkPill('foreignKey')}><FontAwesomeIcon icon={faLink} style={{ fontSize: 9 }} /> solid</span> enforced by the database
        <span style={{ ...st.linkPill('inferred'), marginLeft: 12 }}><FontAwesomeIcon icon={faLink} style={{ fontSize: 9 }} /> dashed</span> inferred from the column name
      </div>
    </div>
  );
}

function LinkList({ title, icon, relations, side, onSelect, empty }: {
  title: string; icon: typeof faArrowRight; relations: DbRelation[]; side: 'to' | 'from';
  onSelect: (name: string) => void; empty: string;
}) {
  return (
    <div>
      <div style={st.linksTitle}><FontAwesomeIcon icon={icon} style={{ fontSize: 10 }} /> {title} <span style={{ color: C.mutedSoft }}>{relations.length}</span></div>
      {relations.length === 0 ? (
        <div style={{ fontSize: 12, color: C.mutedSoft }}>{empty}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {relations.map(r => {
            const other = side === 'to' ? r.toTable : r.fromTable;
            return (
              <div key={`${r.fromTable}.${r.fromColumn}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, flexWrap: 'wrap' }}>
                <button onClick={() => onSelect(other)} style={st.linkPill(r.kind)}>{other}</button>
                <span style={{ fontFamily: MONO, color: C.mutedSoft }}>
                  {side === 'to' ? `via ${r.fromColumn}` : `${r.fromTable}.${r.fromColumn}`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const st = {
  page: { padding: '16px 32px 32px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', background: C.bg, minHeight: '100%', color: C.text } as React.CSSProperties,
  inner: { maxWidth: 1180, margin: '0 auto' } as React.CSSProperties,
  header: { display: 'flex', alignItems: 'center', gap: '8px 16px', marginBottom: 12, flexWrap: 'wrap' } as React.CSSProperties,
  h1: { margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', cursor: 'default' } as React.CSSProperties,
  sub: { margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.55, maxWidth: 720 } as React.CSSProperties,
  code: { fontFamily: MONO, fontSize: 12, background: '#eef0f4', padding: '1px 6px', borderRadius: 4, color: C.textSub } as React.CSSProperties,
  refreshBtn: (busy: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, marginLeft: 'auto',
    border: `1px solid ${C.border}`, background: '#fff', color: busy ? C.mutedSoft : C.textSub,
    fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: busy ? 'default' : 'pointer',
  }),
  empty: { padding: 32, textAlign: 'center', color: C.muted, fontSize: 13, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12 } as React.CSSProperties,
  stats: { display: 'flex', alignItems: 'center', gap: '4px 12px', flexWrap: 'wrap', flex: 1, minWidth: 0, fontSize: 12.5, color: C.muted } as React.CSSProperties,
  notice: {
    display: 'flex', gap: 8, padding: '10px 14px', marginBottom: 14, borderRadius: 10,
    background: C.warnSoft, border: '1px solid #fde68a', color: C.warn, fontSize: 12.5, lineHeight: 1.5,
  } as React.CSSProperties,
  toolbar: { display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' } as React.CSSProperties,
  segment: { display: 'inline-flex', gap: 2, padding: 3, background: '#eef0f4', borderRadius: 9, flexShrink: 0 } as React.CSSProperties,
  segBtn: (on: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 13, fontWeight: 600, background: on ? '#fff' : 'transparent', color: on ? C.text : C.muted,
    boxShadow: on ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
  }),
  searchWrap: { position: 'relative', flex: 1, minWidth: 220 } as React.CSSProperties,
  search: {
    width: '100%', boxSizing: 'border-box', height: 38, padding: '0 34px', fontSize: 13,
    border: `1px solid ${C.border}`, borderRadius: 9, outline: 'none', background: '#fff', color: C.text, fontFamily: 'inherit',
  } as React.CSSProperties,
  clearBtn: {
    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 26, height: 26,
    border: 'none', background: 'none', color: C.mutedSoft, cursor: 'pointer', borderRadius: 6,
  } as React.CSSProperties,
  select: {
    height: 38, padding: '0 12px', fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 9,
    background: '#fff', color: C.textSub, fontFamily: 'inherit', cursor: 'pointer',
  } as React.CSSProperties,
  panes: (mobile: boolean): React.CSSProperties => ({
    display: 'grid', gridTemplateColumns: mobile ? '1fr' : '260px 1fr', gap: 14, alignItems: 'start',
  }),
  listPane: {
    background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '6px 8px 10px',
    maxHeight: 'calc(100vh - 160px)', overflowY: 'auto', position: 'sticky', top: 12,
  } as React.CSSProperties,
  groupLabel: { fontSize: 10, fontWeight: 700, color: C.mutedSoft, letterSpacing: '0.07em', textTransform: 'uppercase', padding: '10px 8px 4px' } as React.CSSProperties,
  listRow: (on: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', borderRadius: 7,
    border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: MONO, fontSize: 12.5,
    fontWeight: on ? 700 : 500, background: on ? C.primarySoft : 'transparent', color: on ? C.primaryDeep : C.textSub,
  }),
  listCount: { fontSize: 11, color: C.mutedSoft, fontFamily: 'system-ui, sans-serif', fontVariantNumeric: 'tabular-nums' } as React.CSSProperties,
  detailPane: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px', minWidth: 0 } as React.CSSProperties,
  backBtn: { width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.muted, cursor: 'pointer', flexShrink: 0 } as React.CSSProperties,
  detailDomain: { fontSize: 10, fontWeight: 700, color: C.mutedSoft, letterSpacing: '0.07em', textTransform: 'uppercase' } as React.CSSProperties,
  detailName: { margin: '2px 0 6px', fontSize: 20, fontWeight: 700, fontFamily: MONO, color: C.text, wordBreak: 'break-word' } as React.CSSProperties,
  about: { margin: 0, fontSize: 13.5, color: C.textSub, lineHeight: 1.55 } as React.CSSProperties,
  meta: { fontSize: 12, color: C.mutedSoft, marginTop: 6 } as React.CSSProperties,
  tableWrap: { marginTop: 16, overflowX: 'auto', border: `1px solid ${C.borderSoft}`, borderRadius: 10 } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 } as React.CSSProperties,
  th: {
    textAlign: 'left', padding: '8px 12px', background: '#fafbfc', borderBottom: `1px solid ${C.borderSoft}`,
    fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
  } as React.CSSProperties,
  td: { padding: '7px 12px', borderBottom: `1px solid ${C.borderSoft}`, verticalAlign: 'middle', whiteSpace: 'nowrap' } as React.CSSProperties,
  pill: (bg: string, fg: string): React.CSSProperties => ({
    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: bg, color: fg,
    textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'default',
  }),
  linkPill: (kind: DbRelation['kind']): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 6,
    fontFamily: MONO, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
    background: C.primarySoft, color: C.primaryDeep,
    border: `1px ${kind === 'inferred' ? 'dashed' : 'solid'} #c7cdf0`,
  }),
  linksGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18, marginTop: 18 } as React.CSSProperties,
  linksTitle: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 } as React.CSSProperties,
  legend: { marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.borderSoft}`, fontSize: 11.5, color: C.mutedSoft, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' } as React.CSSProperties,
};
