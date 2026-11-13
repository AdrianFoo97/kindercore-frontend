import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClockRotateLeft, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { fetchAccessLog, type AccessArea, type AccessLogEntry } from '../../api/accessLog.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { DEFAULT_PERIOD_DAYS, PERIODS, actionLabel, rangeLabel, whenLabel } from './accessLogDisplay.js';

const C = {
  bg: '#f8fafc', card: '#ffffff', border: '#e2e8f0', text: '#0f172a', sub: '#334155', muted: '#64748b',
  primary: '#5a67d8', primarySoft: '#eef2ff', red: '#b91c1c',
};
const SEARCH_DELAY_MS = 300;

/** Admin → Access Log: who opened pay, finance, appraisal and applicant records, newest first. */
export default function AccessLogPage() {
  const { isMobile } = useIsMobile();
  const [days, setDays] = useState<number>(DEFAULT_PERIOD_DAYS);
  const [area, setArea] = useState<AccessArea | ''>('');
  const [typed, setTyped] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  // Search after a short pause in typing; any filter change goes back to page 1.
  useEffect(() => { const t = setTimeout(() => setQ(typed), SEARCH_DELAY_MS); return () => clearTimeout(t); }, [typed]);
  useEffect(() => { setPage(1); }, [days, area, q]);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['access-log', days, area, q, page],
    queryFn: () => fetchAccessLog({ days, area, q, page }),
    placeholderData: keepPreviousData,
  });

  const periodLabel = PERIODS.find(p => p.days === days)?.label.toLowerCase() ?? `last ${days} days`;
  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="m-pad" style={{ padding: '24px 32px 48px', background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: C.text }}>
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Access Log</h1>
        <p style={{ fontSize: 14, color: C.muted, margin: '4px 0 24px', lineHeight: 1.5 }}>
          Who opened pay, finance, appraisal and job-applicant records, and when. People opening their own record aren’t listed.
          Entries are kept for {data?.retentionDays ?? 365} days.
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <label style={{ position: 'relative', flex: '1 1 240px' }}>
            <span style={srOnly}>Search by person</span>
            <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 13 }} />
            <input value={typed} onChange={e => setTyped(e.target.value)} placeholder="Search by who opened it, or whose record"
              style={{ ...field, width: '100%', paddingLeft: 34 }} />
          </label>
          <label>
            <span style={srOnly}>Area</span>
            <select value={area} onChange={e => setArea(e.target.value as AccessArea | '')} style={field}>
              <option value="">All areas</option>
              {data && (Object.entries(data.areas) as [AccessArea, string][]).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
          <label>
            <span style={srOnly}>Period</span>
            <select value={days} onChange={e => setDays(Number(e.target.value))} style={field}>
              {PERIODS.map(p => <option key={p.days} value={p.days}>{p.label}</option>)}
            </select>
          </label>
        </div>

        {isLoading && <p style={{ fontSize: 14, color: C.muted }}>Loading…</p>}
        {isError && <p role="alert" style={{ fontSize: 14, color: C.red }}>{(error as Error).message}</p>}

        {data && data.rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12 }}>
            <FontAwesomeIcon icon={faClockRotateLeft} style={{ fontSize: 24, color: C.primary }} />
            <p style={{ fontSize: 15, fontWeight: 600, margin: '12px 0 4px' }}>Nothing opened in the {periodLabel}</p>
            <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>{q || area ? 'Try a different search or area.' : 'Views of sensitive records will appear here.'}</p>
          </div>
        )}

        {data && data.rows.length > 0 && (
          <div style={{ opacity: isFetching ? 0.6 : 1, transition: 'opacity 0.15s' }}>
            {isMobile
              ? <div style={{ display: 'grid', gap: 8 }}>{data.rows.map(r => <EntryCard key={r.id} entry={r} />)}</div>
              : <EntryTable rows={data.rows} />}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 16, fontSize: 13, color: C.muted }}>
              <span>{rangeLabel(data.page, data.pageSize, data.total)}</span>
              <span style={{ display: 'flex', gap: 8 }}>
                <PagerButton label="Previous" disabled={page <= 1} onClick={() => setPage(p => p - 1)} />
                <PagerButton label="Next" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)} />
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EntryTable({ rows }: { rows: AccessLogEntry[] }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: C.bg, textAlign: 'left' }}>
            {['When', 'Who opened it', 'What', 'Whose record'].map(h => (
              <th key={h} scope="col" style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: C.muted, borderBottom: `1px solid ${C.border}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} style={{ borderTop: i ? `1px solid ${C.border}` : 'none' }}>
              <td style={{ ...cell, whiteSpace: 'nowrap', color: C.sub }}>{whenLabel(r.at)}</td>
              <td style={cell}>
                <div style={{ fontWeight: 600 }}>{r.userName || r.userEmail}</div>
                {r.userName && <div style={{ fontSize: 12, color: C.muted }}>{r.userEmail}</div>}
              </td>
              <td style={cell}>
                <div>{r.areaLabel}</div>
                <div style={{ fontSize: 12, color: C.muted, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{actionLabel(r.action)}</div>
              </td>
              <td style={{ ...cell, color: r.subjectName ? C.text : C.muted }}>{r.subjectName ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EntryCard({ entry: r }: { entry: AccessLogEntry }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{r.userName || r.userEmail}</span>
        <span style={{ fontSize: 12, color: C.muted, whiteSpace: 'nowrap' }}>{whenLabel(r.at)}</span>
      </div>
      <div style={{ fontSize: 14, color: C.sub, marginTop: 4 }}>
        {r.areaLabel}{r.subjectName ? ` · ${r.subjectName}` : ''}
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 2, overflowWrap: 'anywhere' }}>{actionLabel(r.action)}</div>
    </div>
  );
}

function PagerButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} style={{
      minHeight: 32, padding: '4px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', fontFamily: 'inherit',
      fontSize: 13, fontWeight: 600, color: disabled ? '#94a3b8' : C.sub, cursor: disabled ? 'default' : 'pointer',
    }}>{label}</button>
  );
}

const field: React.CSSProperties = {
  minHeight: 36, padding: '6px 12px', fontSize: 14, color: C.text, background: '#fff', border: `1px solid #cbd5e1`,
  borderRadius: 8, fontFamily: 'inherit', boxSizing: 'border-box',
};
const cell: React.CSSProperties = { padding: '12px 16px', verticalAlign: 'top' };
const srOnly: React.CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' };
