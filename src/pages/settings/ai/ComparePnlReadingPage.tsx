import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faCircleCheck, faCircleExclamation, faCircleXmark, faFilePdf } from '@fortawesome/free-solid-svg-icons';
import { compareProvidersOnPnl, type Comparison, type CompareResult } from '../../../api/ai.js';
import LoadingSpinner from '../../../components/common/LoadingSpinner.js';
import SettingsNote from '../SettingsNote.js';
import { formatMoney } from '../../operations/pnl-import/format.js';
import { S, SC } from '../cardStyles.js';

// Settings → AI → Read P&L statements → Compare providers (test site only):
// one P&L read by every provider that has a key, side by side. Imports nothing.

const readerKey = (r: CompareResult) => `${r.provider}:${r.model}`;

function verdict(r: CompareResult) {
  if (!r.answered) return { icon: faCircleXmark, text: r.error ?? 'Couldn’t read it', color: SC.danger };
  if (r.passedChecks) return { icon: faCircleCheck, text: 'Passed every check', color: SC.ok };
  return { icon: faCircleExclamation, text: `${r.problems} problem${r.problems === 1 ? '' : 's'} found`, color: '#b45309' };
}

export default function ComparePnlReadingPage() {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [result, setResult] = useState<{ fileName: string; comparison: Comparison } | null>(null);

  const run = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== 'application/pdf') { setProblem('Choose a PDF file.'); return; }
    setBusy(true); setProblem(''); setResult(null);
    try {
      setResult({ fileName: file.name, comparison: await compareProvidersOnPnl(file) });
      qc.invalidateQueries({ queryKey: ['ai-settings'] });
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Couldn’t compare the providers.');
    } finally { setBusy(false); }
  };

  return (
    <div className="m-pad">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Link to="/settings/ai" aria-label="Back to AI settings" title="Back"
          style={{ ...S.secondary, width: 32, minHeight: 32, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesomeIcon icon={faChevronLeft} />
        </Link>
        <h1 style={{ margin: 0 }}>Compare providers</h1>
      </div>

      <SettingsNote>Every provider with a key reads the same P&amp;L — each reading is a real request and is charged. Nothing is imported.</SettingsNote>

      <section style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }} aria-label="Choose a P&L">
        <FontAwesomeIcon icon={faFilePdf} style={{ fontSize: 24, color: SC.primary }} />
        <span style={{ flex: '1 1 200px', fontSize: 14, color: SC.textSub }}>{result ? result.fileName : 'Choose a P&L PDF to read with every provider.'}</span>
        <button type="button" disabled={busy} onClick={() => fileInput.current?.click()}
          style={{ ...S.primary, opacity: busy ? 0.5 : 1, cursor: busy ? 'default' : 'pointer' }}>{busy ? 'Reading…' : result ? 'Try another P&L' : 'Choose PDF'}</button>
        <input ref={fileInput} type="file" accept="application/pdf" hidden onChange={e => { void run(e.target.files?.[0]); e.target.value = ''; }} />
      </section>

      {problem && <p role="alert" style={{ fontSize: 14, color: SC.danger }}>{problem}</p>}
      {busy && <div role="status" style={{ padding: 24 }}><LoadingSpinner /></div>}

      {result && <Results comparison={result.comparison} />}
    </div>
  );
}

function Results({ comparison: c }: { comparison: Comparison }) {
  const readers = c.results.filter(r => r.answered);
  return (
    <>
      {!c.hasText && <p style={{ fontSize: 13, color: SC.muted }}>This PDF has no text to check against (it may be scanned), so no reading could be proved.</p>}
      <section style={{ ...S.card, padding: 0, overflow: 'hidden' }} aria-label="How each provider did">
        {c.results.map((r, i) => {
          const v = verdict(r);
          return (
            <div key={readerKey(r)} style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '16px 24px', borderTop: i ? `1px solid ${SC.divider}` : 'none' }}>
              <div style={{ flex: '2 1 220px', minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: SC.text }}>{r.provider} <span style={{ fontWeight: 500, color: SC.muted }}>({r.model})</span></div>
                <div style={{ fontSize: 13, color: v.color, marginTop: 4 }}><FontAwesomeIcon icon={v.icon} style={{ marginRight: 6 }} />{v.text}</div>
              </div>
              <Fig label="Costs read" value={r.costTotal === null ? '—' : `${r.costLines} lines · ${formatMoney(r.costTotal)}`} />
              <Fig label="Time" value={`${r.seconds} s`} />
              <Fig label="Tokens in / out" value={r.inputTokens === null ? '—' : `${r.inputTokens.toLocaleString()} / ${(r.outputTokens ?? 0).toLocaleString()}`} />
            </div>
          );
        })}
      </section>

      {readers.length > 1 && (
        <section style={S.card} aria-label="Lines read differently">
          <h2 style={S.cardTitle}>{c.differences.length ? 'Lines the providers read differently' : 'Every provider read the same amounts.'}</h2>
          {c.differences.length > 0 && (
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={s.th}>Line</th>
                    {readers.map(r => <th key={readerKey(r)} style={{ ...s.th, textAlign: 'right' }}>{r.provider}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {c.differences.map(d => (
                    <tr key={d.name}>
                      <td style={s.td}>{d.name}</td>
                      {readers.map(r => {
                        const v = d.amounts[readerKey(r)];
                        return <td key={readerKey(r)} style={{ ...s.td, textAlign: 'right', color: v === null ? SC.muted : SC.text }}>{v === null ? 'not found' : formatMoney(v)}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function Fig({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: '1 1 120px' }}>
      <div style={{ fontSize: 12, color: SC.muted }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: SC.text, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  th: { textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 600, color: SC.muted, borderBottom: `1px solid ${SC.border}`, whiteSpace: 'nowrap' },
  td: { padding: '8px 12px', borderBottom: `1px solid ${SC.divider}`, fontVariantNumeric: 'tabular-nums' },
};
