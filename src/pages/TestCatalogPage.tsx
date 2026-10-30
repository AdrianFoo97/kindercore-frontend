import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faVial, faSearch, faTriangleExclamation, faChevronLeft,
  faDatabase, faCube, faTerminal, faXmark, faCopy, faCheck, faCircleCheck, faCircleXmark, faClock, faSpinner, faForward, faPlay, faFlask,
} from '@fortawesome/free-solid-svg-icons';
import { TEST_SUITES, RUN_COMMANDS, CATEGORIES, Category, Project, TestSuite } from './testCatalog.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { fetchTestRunner, startTestRun, TestRun, TestRunnerInfo, TestRunScope, TestRunStatus } from '../api/admin.js';

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
type CategoryFilter = 'All' | Category;

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
  const { isMobile } = useIsMobile();
  const [filter, setFilter] = useState<Filter>('All');
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [fixingOnly, setFixingOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => TEST_SUITES.filter(s =>
      (filter === 'All' || s.project === filter)
      && (category === 'All' || s.category === category)
      && (!fixingOnly || !!s.caveat)
      && matches(s, q)),
    [filter, category, fixingOnly, q],
  );
  // Desktop always shows one file's details (the first, until you pick);
  // on a phone the list comes first and picking opens the details.
  const selected = shown.find(s => s.id === selectedId) ?? (isMobile ? null : shown[0] ?? null);

  // ── Test runner — TEST ENVIRONMENT ONLY ──
  // The backend answers 404 (→ null) unless TEST_RUNNER_ENABLED is set on
  // that server, so on production no run controls render at all. While a
  // run is in progress, poll every second for live per-test status.
  const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';
  const qc = useQueryClient();
  const { data: runner } = useQuery({
    queryKey: ['test-runner'],
    queryFn: fetchTestRunner,
    enabled: isAdmin,
    retry: false,
    refetchInterval: query => (query.state.data?.run?.status === 'running' ? 500 : false),
  });
  const [runError, setRunError] = useState<string | null>(null);
  const startMut = useMutation({
    mutationFn: startTestRun,
    onMutate: () => setRunError(null),
    onSuccess: run => qc.setQueryData<TestRunnerInfo | null>(['test-runner'], old => (old ? { ...old, run } : old)),
    onError: (e: Error) => setRunError(e.message || 'Could not start the test run'),
  });
  const runCtx: RunCtx | null = runner
    ? { run: runner.run, busy: runner.run?.status === 'running' || startMut.isPending, onRun: scope => startMut.mutate(scope) }
    : null;

  // Same audience as the Admin menu it lives in.
  if (!isAdmin) {
    return <div style={{ padding: 40, color: C.muted, fontFamily: 'system-ui, sans-serif' }}>This page is only available to Admins.</div>;
  }

  const total = TEST_SUITES.reduce((n, s) => n + s.cases.length, 0);
  const count = (p: Project) => TEST_SUITES.filter(s => s.project === p).reduce((n, s) => n + s.cases.length, 0);
  const caveated = TEST_SUITES.filter(s => s.caveat);

  return (
    <div style={st.page}>
      <div style={st.inner}>
        {/* Compact header — the tests below are the content, so the summary
            is one line, not a row of cards. */}
        <div style={st.headerRow}>
          <div style={{ minWidth: 0 }}>
            <h1 style={st.h1}><FontAwesomeIcon icon={faVial} style={{ color: C.primary, fontSize: 18, marginRight: 9 }} />Test Catalog</h1>
            <p style={st.sub}>Every automated test, in plain English. They run on every push to the <code style={st.code}>test</code> branch.</p>
          </div>
          <div style={st.summary1}>
            <b style={{ color: C.text }}>{total}</b> tests · {TEST_SUITES.length} files · {count('Frontend')} frontend · {count('Backend')} backend
          </div>
        </div>

        {runCtx && <RunBar ctx={runCtx} error={runError} backendTests={count('Backend')} />}

        {fixingOnly && caveated.length > 0 && (
          <div style={st.issuesBar}>
            <FontAwesomeIcon icon={faTriangleExclamation} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              {caveated.length} test file{caveated.length === 1 ? '' : 's'} need{caveated.length === 1 ? 's' : ''} a developer’s attention — they don’t protect app code yet.
            </span>
            <CopyButton text={allDeveloperMessages(caveated)} label="Copy all for developer" />
          </div>
        )}

        <div style={st.toolbar}>
          {/* Module = the top-menu area a test protects. Modules with no tests
              stay in the list (disabled) so coverage gaps are visible. */}
          <select value={category} onChange={e => setCategory(e.target.value as CategoryFilter)}
            style={{ ...st.select, fontWeight: 600, color: C.text, minWidth: 200 }} aria-label="Module">
            <option value="All">All modules ({total})</option>
            {CATEGORIES.map(c => {
              const n = TEST_SUITES.filter(s => s.category === c).reduce((t, s) => t + s.cases.length, 0);
              return (
                <option key={c} value={c} disabled={n === 0}>
                  {c === 'Security' ? 'Security — all modules' : c} {n ? `(${n})` : '— no tests yet'}
                </option>
              );
            })}
          </select>
          {caveated.length > 0 && (
            <button onClick={() => setFixingOnly(v => !v)} aria-pressed={fixingOnly} style={st.chip(fixingOnly, true)}
              title="Show only test files that don’t protect app code yet">
              <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 10 }} />
              Needs fixing
              <span style={st.chipCount(fixingOnly, true)}>{caveated.length}</span>
            </button>
          )}
          <select value={filter} onChange={e => setFilter(e.target.value as Filter)} style={st.select} aria-label="Frontend or backend">
            <option value="All">Frontend + backend</option>
            <option value="Frontend">Frontend only</option>
            <option value="Backend">Backend only</option>
          </select>
          <div style={st.searchWrap}>
            <FontAwesomeIcon icon={faSearch} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.mutedSoft }} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tests — e.g. budget, WhatsApp, honeypot…" style={st.search} />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear search" style={st.clearBtn}><FontAwesomeIcon icon={faXmark} /></button>
            )}
          </div>
        </div>

        {shown.length === 0 ? (
          <div style={st.empty}>{query ? `No tests match “${query}”.` : 'No tests in this category.'}</div>
        ) : (
          <div style={st.panes(isMobile)}>
            {(!isMobile || !selected) && (
              <SuiteList suites={shown} selectedId={selected?.id ?? null} onSelect={setSelectedId} runCtx={runCtx} />
            )}
            {selected && (
              <SuiteDetail suite={selected} query={q} onBack={isMobile ? () => setSelectedId(null) : undefined} runCtx={runCtx} />
            )}
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


// ── Test runner (test environment only) ────────────────────────────────

interface RunCtx { run: TestRun | null; busy: boolean; onRun: (scope: TestRunScope) => void }

/** Is this suite part of the run? Only backend tests can be run from here, a whole file at a time. */
function inScope(run: TestRun, s: TestSuite): boolean {
  if (s.project !== 'Backend') return false;
  return run.scope.kind === 'all' || run.scope.file === s.file;
}

/** Live status of one test in the current/last run, or null if it isn't part of it. */
function caseStatus(run: TestRun | null, s: TestSuite, name: string): TestRunStatus | null {
  if (!run || !inScope(run, s)) return null;
  const r = run.results?.[`${s.file}::${name}`];
  if (r) return r;
  // Not reported yet: waiting its turn while the run is going (the server
  // reports 'running' the moment each test actually starts).
  return run.status === 'running' ? 'pending' : 'skipped';
}

/** A whole file's status for the list: failed if any test failed, else running/pending, else passed. */
function fileStatus(run: TestRun | null, s: TestSuite): TestRunStatus | null {
  const all = s.cases.map(c => caseStatus(run, s, c.name)).filter((x): x is TestRunStatus => !!x);
  if (!all.length) return null;
  if (all.includes('failed')) return 'failed';
  if (all.includes('running')) return 'running';
  if (all.includes('pending')) return 'pending';
  if (all.every(x => x === 'skipped')) return 'skipped';
  return 'passed';
}

const STATUS_LOOK: Record<TestRunStatus, { icon: typeof faCheck; color: string; label: string; spin?: boolean }> = {
  pending: { icon: faClock, color: '#94a3b8', label: 'Pending' },
  running: { icon: faSpinner, color: '#5a67d8', label: 'Running', spin: true },
  passed: { icon: faCircleCheck, color: '#16a34a', label: 'Passed' },
  failed: { icon: faCircleXmark, color: '#dc2626', label: 'Failed' },
  skipped: { icon: faForward, color: '#94a3b8', label: 'Not run' },
};

/** 3 ms · 1.2 s */
function fmtMs(ms: number): string {
  return ms < 1000 ? `${Math.max(1, Math.round(ms))} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function StatusIcon({ status, size = 14 }: { status: TestRunStatus; size?: number }) {
  const l = STATUS_LOOK[status];
  return <FontAwesomeIcon icon={l.icon} spin={l.spin} title={l.label} style={{ color: l.color, fontSize: size, flexShrink: 0 }} />;
}

/** Test-environment banner: run everything, and the outcome of the current/last run. */
function RunBar({ ctx, error, backendTests }: { ctx: RunCtx; error: string | null; backendTests: number }) {
  const { run, busy, onRun } = ctx;
  const done = run ? Object.values(run.results ?? {}).filter(v => v === 'passed' || v === 'failed').length : 0;
  const scopeLabel = !run ? '' : run.scope.kind === 'all' ? 'all backend tests' : run.scope.file.split('/').pop();
  return (
    <div style={st.runBar}>
      <span style={st.envBadge}><FontAwesomeIcon icon={faFlask} style={{ fontSize: 10 }} /> Test environment</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.textSub }}>
        {error ? <span style={{ color: '#dc2626' }}>{error}</span>
          : !run ? 'Run the backend tests right here. Results appear next to each test as they finish.'
          : run.status === 'running' ? <>Running {scopeLabel}… <b>{done}</b> finished{run.scope.kind === 'all' ? ` of ${backendTests}` : ''}</>
          : run.status === 'error' ? <span style={{ color: '#dc2626' }}>Run of {scopeLabel} stopped: {run.error}</span>
          : <>Last run ({scopeLabel}, {new Date(run.finishedAt!).toLocaleTimeString()}): <b style={{ color: '#16a34a' }}>{(run.totals?.passed ?? 0)} passed</b>
              {(run.totals?.failed ?? 0) > 0 && <>, <b style={{ color: "#dc2626" }}>{run.totals.failed} failed</b></>}</>}
      </span>
      <button onClick={() => onRun({ kind: 'all' })} disabled={busy} style={st.runAllBtn(busy)}>
        <FontAwesomeIcon icon={busy ? faSpinner : faPlay} spin={busy} style={{ fontSize: 11 }} />
        {busy ? 'Running…' : `Run all backend tests (${backendTests})`}
      </button>
    </div>
  );
}

/** Row title: the area, minus a "Security — " style prefix that repeats its group. */
function titleOf(s: TestSuite): string {
  const t = s.area.startsWith(`${s.category} — `) ? s.area.slice(s.category.length + 3) : s.area;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Compact index grouped by category — one line per test file, so the whole catalog fits at a glance. */
function SuiteList({ suites, selectedId, onSelect, runCtx }: {
  suites: TestSuite[]; selectedId: string | null; onSelect: (id: string) => void; runCtx: RunCtx | null;
}) {
  const groups = CATEGORIES.filter(c => suites.some(s => s.category === c));
  return (
    <div style={st.listPane}>
      {groups.map(g => {
        const items = suites.filter(s => s.category === g);
        const n = items.reduce((t, s) => t + s.cases.length, 0);
        return (
          <div key={g}>
            <div style={st.groupLabel}><span>{g}</span><span style={{ color: '#cbd5e1' }}>{n}</span></div>
            {items.map(s => {
              const on = s.id === selectedId;
              const fs = fileStatus(runCtx?.run ?? null, s);
              return (
                <button key={s.id} onClick={() => onSelect(s.id)} style={st.listRow(on)} title={s.area}>
                  {fs
                    ? <StatusIcon status={fs} size={11} />
                    : s.caveat
                    ? <FontAwesomeIcon icon={faTriangleExclamation} style={{ color: C.warn, fontSize: 11, flexShrink: 0 }} title="Needs fixing" />
                    : <span style={st.dot(s.project)} title={s.project} />}
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleOf(s)}</span>
                  <span style={st.projTag(s.project)}>{s.project === 'Frontend' ? 'FE' : 'BE'}</span>
                  <span style={st.listCount}>{s.cases.length}</span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function SuiteDetail({ suite: s, query, onBack, runCtx }: { suite: TestSuite; query: string; onBack?: () => void; runCtx: RunCtx | null }) {
  const cases = query ? s.cases.filter(c => `${c.name} ${c.explains}`.toLowerCase().includes(query)) : s.cases;
  // Searching matched the suite itself (area/summary) but no single case → still show all its cases.
  const list = query && cases.length === 0 ? s.cases : cases;
  // Run controls: test environment only, and only backend tests (frontend
  // tests run in GitHub Actions / locally, not on the server).
  const canRun = !!runCtx && s.project === 'Backend';
  const run = runCtx?.run ?? null;
  return (
    <div style={st.card}>
      {onBack && (
        <button onClick={onBack} style={st.backBtn}><FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 10 }} /> All test files</button>
      )}
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
        {canRun && (
          <button onClick={() => runCtx!.onRun({ kind: 'file', file: s.file })} disabled={runCtx!.busy} style={st.runFileBtn(runCtx!.busy)}>
            <FontAwesomeIcon icon={faPlay} style={{ fontSize: 10 }} /> Run this file
          </button>
        )}
      </div>
      {runCtx && s.project === 'Frontend' && (
        <div style={{ fontSize: 12, color: C.mutedSoft, marginTop: 8 }}>
          Frontend tests can’t be run from the server — they run in GitHub Actions on every push, or locally with <code style={st.code}>npm run test:unit</code>.
        </div>
      )}

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

      <div style={st.casesHead}>
        {s.cases.length} test{s.cases.length === 1 ? '' : 's'}
        {query && cases.length > 0 && cases.length < s.cases.length && <span style={{ color: C.mutedSoft, fontWeight: 500 }}> · {cases.length} match your search</span>}
      </div>
      {/* The marks describe the test itself, not a run — say so, so a green
          tick is never mistaken for "passed". */}
      {canRun ? (
        <div style={st.legendLine}>
          {(['pending', 'running', 'passed', 'failed'] as TestRunStatus[]).map(k => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginRight: 10 }}>
              <StatusIcon status={k} size={11} /> {STATUS_LOOK[k].label.toLowerCase()}
            </span>
          ))}
          — results of the run on this test server
        </div>
      ) : (
        <div style={st.legendLine}>
          <FontAwesomeIcon icon={faCircleCheck} style={{ color: '#16a34a' }} /> complete — checks the real app code
          <span style={{ margin: '0 4px' }}>·</span>
          <FontAwesomeIcon icon={faTriangleExclamation} style={{ color: C.warn }} /> not complete yet
          <span style={{ margin: '0 4px' }}>·</span>
          pass / fail results are on the GitHub Actions run, not shown here
        </div>
      )}
      <ol style={st.cases}>
        {list.map(c => {
          const status = caseStatus(run, s, c.name);
          const key = `${s.file}::${c.name}`;
          // Optional chaining on the maps too: a run reported by an older
          // server version may not include them.
          const failure = status === 'failed' ? run?.failures?.[key] : undefined;
          const ms = run?.durations?.[key];
          return (
            <li key={c.name} style={{ ...st.caseRow, ...(status === 'failed' ? { background: '#fef2f2' } : {}) }}>
              {/* Position in the whole file — kept while searching, so "test 7" stays test 7. */}
              <span style={st.caseNum}>{s.cases.indexOf(c) + 1}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={st.caseExplains}>{c.explains}</div>
                <div style={st.caseName}>{c.name}</div>
                {failure && <pre style={st.failureBox}>{failure}</pre>}
              </div>
              {/* A run result when this test was part of the run; otherwise
                  the "complete / not complete" mark (not a pass/fail). */}
              {status && ms !== undefined && (
                <span style={st.duration} title="How long this test took">{fmtMs(ms)}</span>
              )}
              {status ? <StatusIcon status={status} />
                : s.caveat
                ? <FontAwesomeIcon icon={faTriangleExclamation} style={{ color: C.warn, fontSize: 13, marginTop: 3, flexShrink: 0 }}
                    title="Not done — doesn’t protect app code yet (see above)" />
                : <FontAwesomeIcon icon={faCircleCheck} style={{ color: canRun ? '#cbd5e1' : '#16a34a', fontSize: 14, marginTop: 2, flexShrink: 0 }}
                    title={canRun ? 'Not run yet in this session' : 'Done — protects the real app code'} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const st = {
  page: { padding: '20px 32px 40px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', background: C.bg, minHeight: '100%', color: C.text } as React.CSSProperties,
  inner: { maxWidth: 1180, margin: '0 auto' } as React.CSSProperties,
  headerRow: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 12 } as React.CSSProperties,
  summary1: { fontSize: 13, color: C.muted, fontVariantNumeric: 'tabular-nums', paddingBottom: 2 } as React.CSSProperties,
  chip: (on: boolean, warn: boolean): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
    border: `1px solid ${on ? (warn ? C.warnBorder : '#c7cdf0') : C.border}`, background: on ? (warn ? C.warnSoft : C.primarySoft) : '#fff', color: on ? (warn ? C.warn : '#3c339a') : (warn ? C.warn : C.textSub) }),
  chipCount: (on: boolean, warn: boolean): React.CSSProperties => ({ fontSize: 11, fontWeight: 700, padding: '0 6px', borderRadius: 999, minWidth: 18, textAlign: 'center', background: on ? (warn ? '#fde68a' : '#dfe3fb') : '#f1f5f9', color: warn ? C.warn : on ? '#3c339a' : C.mutedSoft }),
  select: { height: 38, padding: '0 10px', fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 9, background: '#fff', color: C.textSub, fontFamily: 'inherit', cursor: 'pointer' } as React.CSSProperties,
  h1: { margin: '0 0 2px', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center' } as React.CSSProperties,
  sub: { margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.55, maxWidth: 680 } as React.CSSProperties,
  code: { fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 12, background: '#eef0f4', padding: '1px 6px', borderRadius: 4, color: C.textSub } as React.CSSProperties,
  toolbar: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' } as React.CSSProperties,
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
  cases: { listStyle: 'none', margin: '6px 0 0', padding: 0, borderTop: `1px solid ${C.borderSoft}` } as React.CSSProperties,
  runBar: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 14px', marginBottom: 10, borderRadius: 10, background: '#f5f3ff', border: '1px solid #ddd6fe' } as React.CSSProperties,
  envBadge: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '3px 8px', borderRadius: 6, background: '#7c3aed', color: '#fff', flexShrink: 0 } as React.CSSProperties,
  runAllBtn: (busy: boolean): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8, border: 'none', background: busy ? '#a5b4fc' : C.primary, color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: busy ? 'default' : 'pointer', flexShrink: 0 }),
  runFileBtn: (busy: boolean): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: `1px solid ${busy ? C.border : '#c7cdf0'}`, background: '#fff', color: busy ? C.mutedSoft : C.primary, fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: busy ? 'default' : 'pointer', flexShrink: 0, height: 32 }),
  failureBox: { margin: '6px 0 0', padding: '8px 10px', borderRadius: 6, background: '#fff', border: '1px solid #fecaca', color: '#991b1b', fontSize: 11.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, SFMono-Regular, monospace' } as React.CSSProperties,
  duration: { fontSize: 11, color: C.mutedSoft, fontVariantNumeric: 'tabular-nums', marginTop: 4, flexShrink: 0, minWidth: 40, textAlign: 'right' } as React.CSSProperties,
  legendLine: { display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', fontSize: 11.5, color: C.mutedSoft, marginTop: 4 } as React.CSSProperties,
  casesHead: { marginTop: 16, fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' } as React.CSSProperties,
  panes: (mobile: boolean): React.CSSProperties => ({ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '320px minmax(0, 1fr)', gap: 14, alignItems: 'start' }),
  listPane: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '4px 8px 10px', position: 'sticky', top: 12, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' } as React.CSSProperties,
  groupLabel: { display: 'flex', justifyContent: 'space-between', fontSize: 10.5, fontWeight: 700, color: C.mutedSoft, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '12px 8px 4px' } as React.CSSProperties,
  listRow: (on: boolean): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 8px', borderRadius: 7, border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: 13, fontWeight: on ? 700 : 500, background: on ? C.primarySoft : 'transparent', color: on ? '#3c339a' : C.textSub }),
  dot: (p: Project): React.CSSProperties => ({ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: p === 'Frontend' ? '#818cf8' : '#34d399' }),
  projTag: (p: Project): React.CSSProperties => ({ fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4, flexShrink: 0, background: p === 'Frontend' ? '#eef0fa' : '#ecfdf5', color: p === 'Frontend' ? '#4c51bf' : '#047857' }),
  listCount: { fontSize: 11, color: C.mutedSoft, fontVariantNumeric: 'tabular-nums', minWidth: 18, textAlign: 'right' } as React.CSSProperties,
  backBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12, padding: '5px 10px', borderRadius: 7, border: `1px solid ${C.border}`, background: '#fff', color: C.textSub, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  caseRow: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 2px', borderBottom: `1px solid ${C.borderSoft}` } as React.CSSProperties,
  caseNum: { flexShrink: 0, width: 24, height: 24, borderRadius: '50%', background: '#f1f5f9', color: C.textSub, fontSize: 11.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontVariantNumeric: 'tabular-nums', marginTop: 1 } as React.CSSProperties,
  caseExplains: { fontSize: 13, color: C.text, lineHeight: 1.5 } as React.CSSProperties,
  caseName: { fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 11, color: C.mutedSoft, marginTop: 3 } as React.CSSProperties,
  runBox: {
    marginTop: 20, padding: '14px 18px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
    display: 'flex', flexDirection: 'column', gap: 8,
  } as React.CSSProperties,
  runTitle: { fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 } as React.CSSProperties,
  cmd: { fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 12, background: '#f1f5f9', padding: '4px 8px', borderRadius: 6, color: C.textSub } as React.CSSProperties,
};
