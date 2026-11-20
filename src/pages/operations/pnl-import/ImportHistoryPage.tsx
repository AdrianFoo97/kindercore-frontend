import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { fetchImportHistory, type ImportHistoryItem } from '../../../api/pnlImport.js';
import { useIsMobile } from '../../../hooks/useIsMobile.js';
import LoadingSpinner from '../../../components/common/LoadingSpinner.js';
import { formatMoney, groupBySection } from './format.js';
import { C, MONTH_FULL } from '../operating-costs/shared.js';

// Finance → Operating Costs → Import history: every P&L import — which
// month, who, which AI read it, what was recorded and what was left out.

const BACK = '/operations/operating-costs';
const when = (iso: string) => new Date(iso).toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const sum = (lines: { amount: number }[]) => Math.round(lines.reduce((t, l) => t + l.amount, 0) * 100) / 100;

export default function ImportHistoryPage() {
  const navigate = useNavigate();
  const { isMobile } = useIsMobile();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['operating-cost-import-history'], queryFn: fetchImportHistory });

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: isMobile ? '20px 12px 48px' : '28px 32px 48px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button type="button" onClick={() => navigate(BACK)} aria-label="Back to Operating Costs" title="Back" style={s.back}>
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>Import history</h1>
      </div>

      {isLoading ? <LoadingSpinner /> : isError || !data ? (
        <div style={s.card}>
          <p style={{ margin: 0, fontSize: 14, color: C.red }}>Couldn’t load the import history.</p>
          <button type="button" onClick={() => refetch()} style={{ ...s.link, marginTop: 8 }}>Retry</button>
        </div>
      ) : data.length === 0 ? (
        <div style={{ ...s.card, textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>No imports yet.</div>
          <button type="button" onClick={() => navigate('/operations/operating-costs/import')} style={{ ...s.link, marginTop: 8 }}>Import a P&amp;L</button>
        </div>
      ) : (
        <section style={{ ...s.card, padding: 0 }} aria-label="Imports">
          {data.map((item, i) => <HistoryRow key={item.id} item={item} first={i === 0} onOpenMonth={() => navigate(`${BACK}?year=${item.year}&month=${item.month}`)} />)}
        </section>
      )}
    </div>
  );
}

function HistoryRow({ item, first, onOpenMonth }: { item: ImportHistoryItem; first: boolean; onOpenMonth: () => void }) {
  const [open, setOpen] = useState(false);
  const left = item.notImported.length;
  return (
    <div style={{ borderTop: first ? 'none' : `1px solid ${C.divider}`, padding: '16px 24px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: '2 1 240px', minWidth: 0 }}>
          <button type="button" onClick={onOpenMonth} style={{ ...s.link, fontSize: 15 }}>{MONTH_FULL[item.month]} {item.year}</button>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2, overflowWrap: 'anywhere' }}>
            {item.fileName} · {item.importedByName} · {when(item.createdAt)}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{item.provider === 'none' ? 'Read without AI' : `Read by ${item.provider} (${item.model})`}</div>
        </div>
        <Figure label="Recorded" value={`${item.recordedCount} · ${formatMoney(item.recordedTotal)}`} />
        <Figure label="Not imported" value={`${left} · ${formatMoney(sum(item.notImported))}`} />
      </div>
      {left > 0 && (
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} style={{ ...s.link, marginTop: 8, fontSize: 13 }}>
          <FontAwesomeIcon icon={open ? faChevronDown : faChevronRight} style={{ fontSize: 11, marginRight: 6 }} />
          {open ? 'Hide what wasn’t imported' : 'Show what wasn’t imported'}{item.dismissedAt ? ' (notice dismissed)' : ''}
        </button>
      )}
      {open && (
        <div style={{ marginTop: 8 }}>
          {groupBySection(item.notImported).map(g => (
            <div key={g.section} style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 0' }}>
                <span>{g.section}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatMoney(g.total)}</span>
              </div>
              {g.lines.map((l, i) => (
                <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '6px 0', fontSize: 13, borderBottom: `1px solid ${C.divider}` }}>
                  <span style={{ flex: '1 1 160px', color: C.text }}>{l.name}</span>
                  <span style={{ flex: '1 1 160px', color: C.muted }}>{l.reason}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: C.text }}>{formatMoney(l.amount)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: '1 1 140px' }}>
      <div style={{ fontSize: 12, color: C.muted }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  back: { width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.muted, cursor: 'pointer', flexShrink: 0 },
  card: { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, overflow: 'hidden' },
  link: { border: 'none', background: 'none', padding: 0, minHeight: 28, color: C.primary, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' },
};
