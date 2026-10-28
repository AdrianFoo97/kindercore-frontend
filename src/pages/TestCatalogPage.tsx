import { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faVial, faSearch, faTriangleExclamation, faChevronDown, faChevronRight,
  faDatabase, faCube, faTerminal, faXmark, faCopy, faCheck,
} from '@fortawesome/free-solid-svg-icons';
import { TEST_SUITES, RUN_COMMANDS, Project, TestSuite } from './testCatalog.js';

// Admin → Test Catalog (Admin + Superadmin). A plain-English list of every
// automated test in both projects: what each one checks and why it matters.
// Data lives in ./testCatalog.ts — update it whenever a test is added.

const C = {
  bg: '#f8fafc', card: '#fff', border: '#e8ebf0', borderSoft: '#f1f3f6',
  text: '#0f172a', textSub: '#475569', muted: '#64748b', mutedSoft: '#94a3b8',
  primary: '#5a67d8', primarySoft: '#eef0fa',
  warn: '#b45309', warnSoft: '#fffbeb', warnBorder: '#fde68a',
};

type Filter = 'All' | Project;

const REPO: Record<Project, string> = { Frontend: 'kindercore-frontend', Backend: 'kindercore-backend' };

// Self-contained note an admin can paste to a developer (WhatsApp, email,
// ticket) — names the repo + file, the problem, the fix, and every test
// affected, so the developer needs no other context.
function developerMessage(s: TestSuite): string {
  return [
    `Test needs fixing — ${s.area}`,
    `Repo: ${REPO[s.project]} (${s.kind.toLowerCase()} test)`,
    `File: ${s.file}`,
    '',
    `Problem: ${s.caveat}`,
    ...(s.fix ? ['', `Fix: ${s.fix}`] : []),
    '',
    `Tests affected (${s.cases.length}):`,
    ...s.cases.map(c => `- ${c.name}`),
    '',
    'When fixed: run the tests, then update this entry in kindercore-frontend/src/pages/testCatalog.ts (remove the caveat/fix) so the Test Catalog page stops flagging it.',
  ].join('\n');
}

function allDeveloperMessages(suites: TestSuite[]): string {
  return [
    `KinderTech — ${suites.length} test file${suites.length === 1 ? '' : 's'} need fixing (from Admin → Test Catalog)`,
    ...suites.map((s, i) => `\n──── ${i + 1} of ${suites.length} ────\n${developerMessage(s)}`),
  ].join('\n');
}

function matches(s: TestSuite, q: string) {
  if (!q) return true;
  const hay = [s.area, s.summary, s.file, s.caveat ?? '', ...s.cases.flatMap(c => [c.name, c.explains])];
  return hay.some(h => h.toLowerCase().includes(q));
}

export default function TestCatalogPage() {
  const raw = localStorage.getItem('user');
  const role = raw ? (JSON.parse(raw) as { role?: string }).role : undefined;
  const [filter, setFilter] = useState<Filter>('All');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => TEST_SUITES.filter(s => (filter === 'All' || s.project === filter) && matches(s, q)),
    [filter, q],
  );

  // Same audience as the Admin menu it lives in.
  if (role !== 'ADMIN' && role !== 'SUPERADMIN') {
    return <div style={{ padding: 40, color: C.muted, fontFamily: 'system-ui, sans-serif' }}>This page is only available to Admins.</div>;
  }

  const total = TEST_SUITES.reduce((n, s) => n + s.cases.length, 0);
  const count = (p: Project) => TEST_SUITES.filter(s => s.project === p).reduce((n, s) => n + s.cases.length, 0);
  const caveated = TEST_SUITES.filter(s => s.caveat);
  const toggle = (id: string) => setOpen(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div style={st.page}>
      <div style={st.inner}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={st.h1}><FontAwesomeIcon icon={faVial} style={{ color: C.primary, fontSize: 20, marginRight: 10 }} />Test Catalog</h1>
          <p style={st.sub}>
            Every automated test in KinderTech, in plain English — what it checks and why it matters.
            They run automatically on every push to the <code style={st.code}>test</code> branch.
          </p>
        </div>

        <div style={st.stats}>
          <Stat label="Tests" value={total} />
          <Stat label="Test files" value={TEST_SUITES.length} />
          <Stat label="Frontend" value={count('Frontend')} />
          <Stat label="Backend" value={count('Backend')} />
          <Stat label="Need fixing" value={caveated.length} warn={caveated.length > 0}
            hint={caveated.length ? 'Files that don’t actually protect app code' : undefined} />
        </div>

        {caveated.length > 0 && (
          <div style={st.issuesBar}>
            <FontAwesomeIcon icon={faTriangleExclamation} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              {caveated.length} test file{caveated.length === 1 ? '' : 's'} need{caveated.length === 1 ? 's' : ''} a developer’s attention.
            </span>
            <CopyButton text={allDeveloperMessages(caveated)} label="Copy all for developer" />
          </div>
        )}

        <div style={st.toolbar}>
          <div style={st.segment} role="tablist" aria-label="Filter by project">
            {(['All', 'Frontend', 'Backend'] as Filter[]).map(f => (
              <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} style={st.segBtn(filter === f)}>{f}</button>
            ))}
          </div>
          <div style={st.searchWrap}>
            <FontAwesomeIcon icon={faSearch} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.mutedSoft }} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tests — e.g. budget, WhatsApp, honeypot…" style={st.search} />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear search" style={st.clearBtn}><FontAwesomeIcon icon={faXmark} /></button>
            )}
          </div>
        </div>

        {shown.length === 0 ? (
          <div style={st.empty}>No tests match “{query}”.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {shown.map(s => (
              <SuiteCard key={s.id} suite={s} expanded={!!q || open.has(s.id)} onToggle={() => toggle(s.id)} query={q} />
            ))}
          </div>
        )}

        <div style={st.runBox}>
          <div style={st.runTitle}><FontAwesomeIcon icon={faTerminal} style={{ fontSize: 11 }} /> Run them yourself</div>
          {(['Frontend', 'Backend'] as Project[]).map(p => (
            <div key={p} style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ width: 70, fontSize: 12, fontWeight: 600, color: C.textSub }}>{p}</span>
              <code style={st.cmd}>{RUN_COMMANDS[p]}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* clipboard blocked */ }
      }}
      title="Copies a ready-to-send note: the file, the problem, the fix and every affected test"
      style={st.copyBtn(copied)}
    >
      <FontAwesomeIcon icon={copied ? faCheck : faCopy} style={{ fontSize: 11 }} />
      {copied ? 'Copied — paste it to your developer' : label}
    </button>
  );
}

function Stat({ label, value, warn, hint }: { label: string; value: number; warn?: boolean; hint?: string }) {
  return (
    <div style={{ ...st.stat, ...(warn ? { background: C.warnSoft, borderColor: C.warnBorder } : {}) }} title={hint}>
      <div style={{ fontSize: 22, fontWeight: 700, color: warn ? C.warn : C.text, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: warn ? C.warn : C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  );
}

function SuiteCard({ suite: s, expanded, onToggle, query }: { suite: TestSuite; expanded: boolean; onToggle: () => void; query: string }) {
  const cases = query ? s.cases.filter(c => `${c.name} ${c.explains}`.toLowerCase().includes(query)) : s.cases;
  // Searching matched the suite itself (area/summary) but no single case → still show all its cases.
  const list = query && cases.length === 0 ? s.cases : cases;
  return (
    <div style={st.card}>
      <div style={st.cardTop}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={st.area}>{s.area}</span>
            <span style={st.badge(s.project === 'Frontend' ? '#eef0fa' : '#ecfdf5', s.project === 'Frontend' ? '#4c51bf' : '#047857')}>{s.project}</span>
            <span style={st.badge('#f1f5f9', '#475569')} title={s.kind === 'Integration' ? 'Runs against a real MySQL test database' : 'Runs on code alone, no database'}>
              <FontAwesomeIcon icon={s.kind === 'Integration' ? faDatabase : faCube} style={{ fontSize: 9 }} />
              {s.kind}
            </span>
          </div>
          <div style={st.file}>{s.file}</div>
          <p style={st.summary}>{s.summary}</p>
        </div>
      </div>

      {s.caveat && (
        <div style={st.caveat}>
          <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div><strong>Doesn’t protect app code yet.</strong> {s.caveat}</div>
            {s.fix && <div style={{ marginTop: 4 }}><strong>Fix:</strong> {s.fix}</div>}
            <div style={{ marginTop: 8 }}>
              <CopyButton text={developerMessage(s)} label="Copy message for developer" />
            </div>
          </div>
        </div>
      )}

      <button onClick={onToggle} style={st.toggle} aria-expanded={expanded}>
        <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} style={{ fontSize: 10, width: 10 }} />
        {expanded ? 'Hide' : 'Show'} {s.cases.length} test{s.cases.length === 1 ? '' : 's'}
        {query && cases.length > 0 && cases.length < s.cases.length && <span style={{ color: C.mutedSoft, fontWeight: 500 }}>· {cases.length} match</span>}
      </button>

      {expanded && (
        <ol style={st.cases}>
          {list.map(c => (
            <li key={c.name} style={st.caseRow}>
              <div style={st.caseExplains}>{c.explains}</div>
              <div style={st.caseName}>{c.name}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const st = {
  page: { padding: '28px 32px 48px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', background: C.bg, minHeight: '100%', color: C.text } as React.CSSProperties,
  inner: { maxWidth: 980, margin: '0 auto' } as React.CSSProperties,
  h1: { margin: '0 0 6px', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center' } as React.CSSProperties,
  sub: { margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.55, maxWidth: 680 } as React.CSSProperties,
  code: { fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 12, background: '#eef0f4', padding: '1px 6px', borderRadius: 4, color: C.textSub } as React.CSSProperties,
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 18 } as React.CSSProperties,
  stat: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px', cursor: 'default' } as React.CSSProperties,
  toolbar: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' } as React.CSSProperties,
  segment: { display: 'inline-flex', gap: 2, padding: 3, background: '#eef0f4', borderRadius: 9 } as React.CSSProperties,
  segBtn: (on: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 13, fontWeight: 600, background: on ? '#fff' : 'transparent', color: on ? C.text : C.muted,
    boxShadow: on ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
  }),
  searchWrap: { position: 'relative', flex: 1, minWidth: 220 } as React.CSSProperties,
  search: {
    width: '100%', boxSizing: 'border-box', height: 38, padding: '0 34px 0 34px', fontSize: 13,
    border: `1px solid ${C.border}`, borderRadius: 9, outline: 'none', background: '#fff', color: C.text, fontFamily: 'inherit',
  } as React.CSSProperties,
  clearBtn: {
    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 26, height: 26,
    border: 'none', background: 'none', color: C.mutedSoft, cursor: 'pointer', borderRadius: 6,
  } as React.CSSProperties,
  empty: { padding: 32, textAlign: 'center', color: C.muted, fontSize: 13, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12 } as React.CSSProperties,
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px', boxShadow: '0 1px 2px rgba(15,23,42,0.03)' } as React.CSSProperties,
  cardTop: { display: 'flex', gap: 12, alignItems: 'flex-start' } as React.CSSProperties,
  area: { fontSize: 15, fontWeight: 700, color: C.text } as React.CSSProperties,
  badge: (bg: string, fg: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700,
    padding: '2px 8px', borderRadius: 6, background: bg, color: fg, textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'default',
  }),
  file: { fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 11.5, color: C.mutedSoft, marginTop: 4 } as React.CSSProperties,
  summary: { margin: '8px 0 0', fontSize: 13, color: C.textSub, lineHeight: 1.55 } as React.CSSProperties,
  caveat: {
    display: 'flex', gap: 8, marginTop: 12, padding: '10px 12px', borderRadius: 9,
    background: C.warnSoft, border: `1px solid ${C.warnBorder}`, color: C.warn, fontSize: 12.5, lineHeight: 1.5,
  } as React.CSSProperties,
  issuesBar: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14,
    padding: '10px 14px', borderRadius: 10, background: C.warnSoft, border: `1px solid ${C.warnBorder}`,
    color: C.warn, fontSize: 13, fontWeight: 600,
  } as React.CSSProperties,
  copyBtn: (copied: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 8,
    fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
    border: `1px solid ${copied ? '#bbf7d0' : C.warnBorder}`,
    background: copied ? '#f0fdf4' : '#fff',
    color: copied ? '#15803d' : C.warn,
    transition: 'background 0.12s, color 0.12s, border-color 0.12s',
  }),
  toggle: {
    display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 12, padding: '5px 10px 5px 8px',
    border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff', cursor: 'pointer',
    fontSize: 12, fontWeight: 600, color: C.primary, fontFamily: 'inherit',
  } as React.CSSProperties,
  cases: { listStyle: 'none', margin: '12px 0 0', padding: 0, borderTop: `1px solid ${C.borderSoft}` } as React.CSSProperties,
  caseRow: { padding: '10px 2px', borderBottom: `1px solid ${C.borderSoft}` } as React.CSSProperties,
  caseExplains: { fontSize: 13, color: C.text, lineHeight: 1.5 } as React.CSSProperties,
  caseName: { fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 11, color: C.mutedSoft, marginTop: 3 } as React.CSSProperties,
  runBox: {
    marginTop: 20, padding: '14px 18px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
    display: 'flex', flexDirection: 'column', gap: 8,
  } as React.CSSProperties,
  runTitle: { fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 } as React.CSSProperties,
  cmd: { fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 12, background: '#f1f5f9', padding: '4px 8px', borderRadius: 6, color: C.textSub } as React.CSSProperties,
};
