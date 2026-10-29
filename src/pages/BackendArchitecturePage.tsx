import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSitemap, faSearch, faXmark, faLockOpen, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { fetchBackendArchitecture, BackendArchitecture, ArchEndpoint } from '../api/admin.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import BackendArchitectureGraph, { nodeId, overviewRows, OverviewRow, Layer, LAYER_TITLE, LAYER_COLOR } from './BackendArchitectureGraph.js';

// Admin → Backend Architecture (Admin + Superadmin). The Express backend's
// layered design — Routes → Controllers → Services → Tables — generated
// from the backend source by `npm run arch:gen` and compiled into the
// server, so each environment shows the design of the code it runs. A
// backend test fails if the generated graph is out of date with the code.

const C = {
  bg: '#f8fafc', card: '#fff', border: '#e8ebf0', borderSoft: '#f1f3f6',
  text: '#0f172a', textSub: '#475569', muted: '#64748b', mutedSoft: '#94a3b8',
  primary: '#5a67d8', primarySoft: '#eef0fa', primaryDeep: '#3c339a',
};
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const METHOD_COLOR: Record<ArchEndpoint['method'], string> = {
  GET: '#059669', POST: '#2563eb', PUT: '#b45309', PATCH: '#b45309', DELETE: '#dc2626',
};

/** Who can call an endpoint, in words, from its middleware. */
function accessOf(mw: string[]): { label: string; tone: 'public' | 'auth' | 'admin' | 'scoped' }[] {
  const out: { label: string; tone: 'public' | 'auth' | 'admin' | 'scoped' }[] = [];
  if (!mw.includes('authMiddleware')) out.push({ label: 'Public', tone: 'public' });
  for (const m of mw) {
    if (m === 'authMiddleware') out.push({ label: 'Signed in', tone: 'auth' });
    else if (m === 'adminMiddleware') out.push({ label: 'Admin', tone: 'admin' });
    else if (m === 'superadminMiddleware') out.push({ label: 'Superadmin', tone: 'admin' });
    else {
      const mod = m.match(/^requireModule\(MODULES\.(\w+)\)$/);
      const view = m.match(/^requireView\(['"`](\w+)['"`]\)$/);
      out.push({ label: mod ? `Module: ${mod[1]}` : view ? `View: ${view[1]}` : m, tone: 'scoped' });
    }
  }
  return out;
}

const TONE: Record<string, { bg: string; fg: string }> = {
  public: { bg: '#fef3c7', fg: '#92400e' },
  auth: { bg: '#f1f5f9', fg: '#475569' },
  admin: { bg: '#fee2e2', fg: '#991b1b' },
  scoped: { bg: '#eef0fa', fg: '#3c339a' },
};

export default function BackendArchitecturePage() {
  const raw = localStorage.getItem('user');
  const role = raw ? (JSON.parse(raw) as { role?: string }).role : undefined;
  const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';
  const { isMobile } = useIsMobile();
  const { data, isLoading, error } = useQuery({ queryKey: ['backend-architecture'], queryFn: fetchBackendArchitecture, enabled: isAdmin });

  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  // One overview row per route file, with its whole chain flattened out.
  const rows = useMemo(() => (data ? overviewRows(data) : []), [data]);
  const shownRows = useMemo(() => {
    if (!q) return rows;
    const hit = (s: string) => s.toLowerCase().includes(q);
    return rows.filter(r => hit(r.group.id) || hit(r.group.mount) || r.group.endpoints.some(e => hit(e.path))
      || [...r.controllers, ...r.services, ...r.tables].some(hit));
  }, [rows, q]);

  if (!isAdmin) {
    return <div style={{ padding: 40, color: C.muted, fontFamily: 'system-ui, sans-serif' }}>This page is only available to Admins.</div>;
  }

  const endpoints = data?.routeGroups.flatMap(r => r.endpoints) ?? [];
  const publicCount = endpoints.filter(e => !e.middleware.includes('authMiddleware')).length;

  return (
    <div style={st.page}>
      <div style={st.inner}>
        <div style={{ marginBottom: 18 }}>
          <h1 style={st.h1}><FontAwesomeIcon icon={faSitemap} style={{ color: C.primary, fontSize: 20, marginRight: 10 }} />Backend Architecture</h1>
          <p style={st.sub}>
            How the server is built: each request comes in through a <b>route</b>, passes its access checks, is handled by
            a <b>controller</b>, which may call a shared <b>service</b>, and reads or writes database <b>tables</b>.
            Generated from the server’s own code, so it always matches what’s deployed.
          </p>
        </div>

        {isLoading ? (
          <div style={st.empty}>Loading the architecture…</div>
        ) : error || !data ? (
          <div style={st.empty}>Couldn’t load the architecture. {(error as Error | null)?.message}</div>
        ) : (
          <>
            <div style={st.stats}>
              <Stat label="Endpoints" value={endpoints.length} />
              <Stat label="Route files" value={data.routeGroups.length} />
              <Stat label="Controllers" value={data.controllers.length} />
              <Stat label="Services" value={data.services.length} />
              <Stat label="Public endpoints" value={publicCount} hint="Reachable without signing in — e.g. the enquiry and job application forms" />
            </div>

            {selected ? (
              // ── Focus: one chain, diagram + details ──
              <>
                <button onClick={() => setSelected(null)} style={st.backLink}>
                  <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 11 }} /> All routes
                </button>
                <div style={st.layout(isMobile)}>
                  <div style={st.graphCard}>
                    <div style={st.graphScroll}>
                      <BackendArchitectureGraph arch={data} selected={selected} onSelect={setSelected} />
                    </div>
                    <div style={st.foot}>
                      Showing only what’s connected to the selected box · hover a box to see its direct links · click one to follow it
                    </div>
                  </div>
                  <div style={st.panel}>
                    <Detail arch={data} id={selected} onSelect={setSelected} />
                  </div>
                </div>
              </>
            ) : (
              // ── Overview: one readable row per route file ──
              <>
                <div style={st.toolbar}>
                  <div style={st.searchWrap}>
                    <FontAwesomeIcon icon={faSearch} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.mutedSoft }} />
                    <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search — e.g. points, payroll, /api/leads, Teacher…" style={st.search} />
                    {query && <button onClick={() => setQuery('')} aria-label="Clear search" style={st.clearBtn}><FontAwesomeIcon icon={faXmark} /></button>}
                  </div>
                </div>
                <div style={st.legendRow}>
                  <span><Chip tone="public">Public</Chip> no sign-in needed</span>
                  <span><Chip tone="auth">Signed in</Chip> any logged-in user</span>
                  <span><Chip tone="admin">Admin</Chip> Admin / Superadmin only</span>
                  <span><Chip tone="scoped">Module: HR</Chip> needs that module or view</span>
                </div>
                <Overview rows={shownRows} mobile={isMobile} onSelect={setSelected} query={query} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const TABLES_SHOWN = 6;

/** The overview: each route file's chain on one line, left to right. */
function Overview({ rows, mobile, onSelect, query }: {
  rows: OverviewRow[]; mobile: boolean; onSelect: (id: string) => void; query: string;
}) {
  if (rows.length === 0) return <div style={st.empty}>Nothing matches “{query}”.</div>;
  return (
    <div style={st.overview}>
      {!mobile && (
        <div style={st.ovHead}>
          {(['route', 'controller', 'service', 'table'] as Layer[]).map(l => (
            <span key={l} style={{ color: LAYER_COLOR[l] }}>{LAYER_TITLE[l]}</span>
          ))}
        </div>
      )}
      {rows.map(r => <OverviewRowView key={r.group.id} row={r} mobile={mobile} onSelect={onSelect} />)}
    </div>
  );
}

function OverviewRowView({ row: r, mobile, onSelect }: { row: OverviewRow; mobile: boolean; onSelect: (id: string) => void }) {
  const [allTables, setAllTables] = useState(false);
  const tables = allTables ? r.tables : r.tables.slice(0, TABLES_SHOWN);
  const chip = (layer: Layer, id: string) => (
    <button key={id} onClick={() => onSelect(nodeId(layer, id))} style={st.ovChip(LAYER_COLOR[layer])}>
      {id.replace(/\.(controller|service)$/, '')}
    </button>
  );
  const cell = (label: string, children: React.ReactNode) => (
    <div style={{ minWidth: 0 }}>
      {mobile && <div style={st.ovMobileLabel}>{label}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{children}</div>
    </div>
  );
  return (
    <div style={st.ovRow(mobile)}>
      <button onClick={() => onSelect(nodeId('route', r.group.id))} style={st.ovRoute}>
        <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: C.text }}>{r.group.id.replace(/\.routes$/, '')}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted, wordBreak: 'break-all' }}>{r.group.mount}</span>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: C.mutedSoft }}>
          {r.group.endpoints.length} endpoint{r.group.endpoints.length === 1 ? '' : 's'}
          {r.publicEndpoints > 0 && <Chip tone="public">{r.publicEndpoints} public</Chip>}
        </span>
      </button>
      {cell('Controllers', r.controllers.length ? r.controllers.map(c => chip('controller', c)) : <span style={st.none}>inline only</span>)}
      {cell('Services', r.services.length ? r.services.map(s => chip('service', s)) : <span style={st.none}>—</span>)}
      {cell('Tables', r.tables.length ? (
        <>
          {tables.map(t => chip('table', t))}
          {r.tables.length > TABLES_SHOWN && (
            <button onClick={() => setAllTables(v => !v)} style={st.moreBtn}>
              {allTables ? 'show less' : `+${r.tables.length - TABLES_SHOWN} more`}
            </button>
          )}
        </>
      ) : <span style={st.none}>—</span>)}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div style={st.stat} title={hint}>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  );
}

function Chip({ tone, children }: { tone: keyof typeof TONE; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 5, background: TONE[tone].bg, color: TONE[tone].fg, whiteSpace: 'nowrap' }}>
      {tone === 'public' && <FontAwesomeIcon icon={faLockOpen} style={{ fontSize: 8 }} />}{children}
    </span>
  );
}

function EndpointRow({ e }: { e: ArchEndpoint }) {
  return (
    <div style={{ padding: '8px 0', borderBottom: `1px solid ${C.borderSoft}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
        <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: METHOD_COLOR[e.method], width: 48, flexShrink: 0 }}>{e.method}</span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.text, wordBreak: 'break-all' }}>{e.path}</span>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4, marginLeft: 56, alignItems: 'center' }}>
        {accessOf(e.middleware).map((a, i) => <Chip key={i} tone={a.tone}>{a.label}</Chip>)}
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.mutedSoft }}>→ {e.handler}</span>
      </div>
    </div>
  );
}

function LinkChips({ title, items, layer, onSelect }: { title: string; items: string[]; layer: Layer; onSelect: (id: string) => void }) {
  if (!items.length) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={st.panelLabel}>{title} · {items.length}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map(i => (
          <button key={i} onClick={() => onSelect(nodeId(layer, i))} style={st.linkChip}>{i.replace(/\.(controller|service|routes)$/, '')}</button>
        ))}
      </div>
    </div>
  );
}

function Detail({ arch, id, onSelect }: { arch: BackendArchitecture; id: string; onSelect: (id: string) => void }) {
  const [layer, name] = [id.slice(0, id.indexOf(':')) as Layer, id.slice(id.indexOf(':') + 1)];
  const allEps = arch.routeGroups.flatMap(r => r.endpoints);
  const head = (
    <>
      <div style={st.panelLabel}>{LAYER_TITLE[layer].replace(/s$/, '')}</div>
      <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4, wordBreak: 'break-word' }}>{name}</div>
    </>
  );

  if (layer === 'route') {
    const g = arch.routeGroups.find(r => r.id === name)!;
    const ctrls = [...new Set(g.endpoints.map(e => e.controller).filter((c): c is string => !!c))];
    return (
      <div>
        {head}
        <div style={{ fontSize: 12, color: C.muted }}>Mounted at <code style={{ fontFamily: MONO }}>{g.mount}</code> · {g.endpoints.length} endpoints</div>
        <LinkChips title="Handled by" items={ctrls} layer="controller" onSelect={onSelect} />
        <div style={{ ...st.panelLabel, marginTop: 14 }}>Endpoints</div>
        {g.endpoints.map((e, i) => <EndpointRow key={i} e={e} />)}
      </div>
    );
  }
  if (layer === 'controller' || layer === 'service') {
    const m = (layer === 'controller' ? arch.controllers : arch.services).find(x => x.id === name)!;
    const eps = layer === 'controller' ? allEps.filter(e => e.controller === name) : [];
    const usedByCtrls = arch.controllers.filter(x => x.services.includes(name) || x.controllers.includes(name)).map(x => x.id);
    const usedBySvcs = arch.services.filter(x => x.services.includes(name)).map(x => x.id);
    return (
      <div>
        {head}
        <LinkChips title="Calls services" items={m.services} layer="service" onSelect={onSelect} />
        <LinkChips title="Uses controllers" items={m.controllers} layer="controller" onSelect={onSelect} />
        <LinkChips title="Reads / writes tables" items={m.tables} layer="table" onSelect={onSelect} />
        <LinkChips title="Used by controllers" items={usedByCtrls} layer="controller" onSelect={onSelect} />
        <LinkChips title="Used by services" items={usedBySvcs} layer="service" onSelect={onSelect} />
        {eps.length > 0 && (
          <>
            <div style={{ ...st.panelLabel, marginTop: 14 }}>Endpoints handled · {eps.length}</div>
            {eps.map((e, i) => <EndpointRow key={i} e={e} />)}
          </>
        )}
      </div>
    );
  }
  const ctrls = arch.controllers.filter(c => c.tables.includes(name)).map(c => c.id);
  const svcs = arch.services.filter(s => s.tables.includes(name)).map(s => s.id);
  return (
    <div>
      {head}
      <div style={{ fontSize: 12, color: C.muted }}>Database table — see Admin → Database Design for its columns.</div>
      <LinkChips title="Used by controllers" items={ctrls} layer="controller" onSelect={onSelect} />
      <LinkChips title="Used by services" items={svcs} layer="service" onSelect={onSelect} />
    </div>
  );
}

const st = {
  page: { padding: '28px 32px 48px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', background: C.bg, minHeight: '100%', color: C.text } as React.CSSProperties,
  inner: { maxWidth: 1240, margin: '0 auto' } as React.CSSProperties,
  h1: { margin: '0 0 6px', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center' } as React.CSSProperties,
  sub: { margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.6, maxWidth: 760 } as React.CSSProperties,
  empty: { padding: 32, textAlign: 'center', color: C.muted, fontSize: 13, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12 } as React.CSSProperties,
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 } as React.CSSProperties,
  stat: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px', cursor: 'default' } as React.CSSProperties,
  toolbar: { display: 'flex', gap: 10, marginBottom: 14 } as React.CSSProperties,
  searchWrap: { position: 'relative', flex: 1 } as React.CSSProperties,
  search: {
    width: '100%', boxSizing: 'border-box', height: 38, padding: '0 34px', fontSize: 13,
    border: `1px solid ${C.border}`, borderRadius: 9, outline: 'none', background: '#fff', color: C.text, fontFamily: 'inherit',
  } as React.CSSProperties,
  clearBtn: {
    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 26, height: 26,
    border: 'none', background: 'none', color: C.mutedSoft, cursor: 'pointer', borderRadius: 6,
  } as React.CSSProperties,
  layout: (mobile: boolean): React.CSSProperties => ({
    display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'minmax(0, 1fr) 340px', gap: 14, alignItems: 'start',
  }),
  graphCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', minWidth: 0 } as React.CSSProperties,
  graphScroll: { overflow: 'auto', maxHeight: 'calc(100vh - 200px)', background: '#fbfcfd' } as React.CSSProperties,
  foot: { padding: '8px 14px', borderTop: `1px solid ${C.borderSoft}`, fontSize: 11.5, color: C.mutedSoft } as React.CSSProperties,
  panel: {
    background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px',
    maxHeight: 'calc(100vh - 160px)', overflowY: 'auto', position: 'sticky', top: 12,
  } as React.CSSProperties,
  backLink: {
    display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 12, padding: '6px 12px', borderRadius: 8,
    border: `1px solid ${C.border}`, background: '#fff', color: C.textSub, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  } as React.CSSProperties,
  legendRow: { display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: 12, color: C.muted, marginBottom: 12 } as React.CSSProperties,
  overview: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' } as React.CSSProperties,
  ovHead: {
    display: 'grid', gridTemplateColumns: '220px 220px 170px 1fr', gap: 16, padding: '10px 16px',
    background: '#fafbfc', borderBottom: `1px solid ${C.borderSoft}`,
    fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
  } as React.CSSProperties,
  ovRow: (mobile: boolean): React.CSSProperties => ({
    display: 'grid', gridTemplateColumns: mobile ? '1fr' : '220px 220px 170px 1fr', gap: mobile ? 8 : 16,
    padding: '12px 16px', borderBottom: `1px solid ${C.borderSoft}`, alignItems: 'start',
  }),
  ovRoute: {
    display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start', textAlign: 'left',
    border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', minWidth: 0,
  } as React.CSSProperties,
  ovChip: (color: string): React.CSSProperties => ({
    fontFamily: MONO, fontSize: 11.5, fontWeight: 600, padding: '3px 8px 3px 7px', borderRadius: 6, cursor: 'pointer',
    border: '1px solid #e5e8ef', borderLeft: `3px solid ${color}`, background: '#fff', color: C.text,
  }),
  ovMobileLabel: { fontSize: 10, fontWeight: 700, color: C.mutedSoft, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 } as React.CSSProperties,
  moreBtn: {
    fontSize: 11.5, fontWeight: 600, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
    border: '1px dashed #cbd5e1', background: '#fff', color: C.muted, fontFamily: 'inherit',
  } as React.CSSProperties,
  none: { fontSize: 12, color: C.mutedSoft } as React.CSSProperties,
  panelLabel: { fontSize: 10.5, fontWeight: 700, color: C.mutedSoft, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 } as React.CSSProperties,
  linkChip: {
    fontFamily: MONO, fontSize: 11.5, fontWeight: 600, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
    border: '1px solid #dfe3f5', background: C.primarySoft, color: C.primaryDeep,
  } as React.CSSProperties,
};
