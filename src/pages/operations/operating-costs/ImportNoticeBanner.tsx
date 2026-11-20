import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import { dismissImportNotice, fetchImportNotices, type ImportNotice } from '../../../api/pnlImport.js';
import { formatMoney, groupBySection } from '../pnl-import/format.js';
import FormModal from '../../../components/common/FormModal.js';
import { fetchOperatingCostCategories } from '../../../api/operatingCost.js';
import { NotRecordedLine } from './NotRecordedLine.js';
import { C } from './shared.js';

// Operating Costs (month view): what a P&L import for this month didn't
// record, and why — stays until someone dismisses it.

export function ImportNoticeBanner({ year, month }: { year: number; month: number }) {
  const qc = useQueryClient();
  const { data: notices = [] } = useQuery({
    queryKey: ['operating-cost-import-notices', year, month],
    queryFn: () => fetchImportNotices(year, month),
  });
  const dismiss = async (id: string) => {
    await dismissImportNotice(id);
    await qc.invalidateQueries({ queryKey: ['operating-cost-import-notices', year, month] });
  };
  const withGaps = notices.filter(n => n.notImported.length > 0);
  if (!withGaps.length) return null;
  const recorded = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['operating-cost-import-notices', year, month] }),
      qc.invalidateQueries({ queryKey: ['operating-cost-entries', year] }),
      qc.invalidateQueries({ queryKey: ['operating-cost-import-history'] }),
    ]);
  };
  return <>{withGaps.map(n => <Notice key={n.id} notice={n} onDismiss={() => dismiss(n.id)} onRecorded={recorded} />)}</>;
}

function Notice({ notice, onDismiss, onRecorded }: { notice: ImportNotice; onDismiss: () => void; onRecorded: () => void }) {
  const [open, setOpen] = useState(false);
  const { data: categories = [] } = useQuery({ queryKey: ['operating-cost-categories'], queryFn: fetchOperatingCostCategories, enabled: open });
  const [busy, setBusy] = useState(false);
  const total = Math.round(notice.notImported.reduce((t, l) => t + l.amount, 0) * 100) / 100;
  const count = notice.notImported.length;
  return (
    <div role="status" style={s.box}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <FontAwesomeIcon icon={faCircleExclamation} style={{ color: C.amber, marginTop: 3 }} />
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>
            From {notice.fileName}: {count} line{count === 1 ? '' : 's'} weren’t recorded · {formatMoney(total)}
          </div>
          <div style={{ fontSize: 12, color: '#92400e', marginTop: 2 }}>Imported by {notice.importedByName}</div>
        </div>
        <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" style={s.link}>Show list</button>
        <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await onDismiss(); } finally { setBusy(false); } }}
          style={{ ...s.link, color: C.textSub, cursor: busy ? 'default' : 'pointer' }}>Dismiss</button>
      </div>
      {open && (
        <FormModal title="Not recorded from this P&L" subtitle={`${notice.fileName} · ${count} line${count === 1 ? '' : 's'} · ${formatMoney(total)}`}
          onClose={() => setOpen(false)} width={600}>
          {/* The list scrolls on its own so the pop-up stays short; the total stays in view below it. */}
          <div style={s.scroll}>
            {groupBySection(notice.notImported.map((l, index) => ({ ...l, index }))).map((g, gi) => (
              <section key={g.section} aria-label={g.section} style={{ marginTop: gi ? 12 : 0 }}>
                <div style={s.sectionHead}>
                  <span>{g.section}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatMoney(g.total)}</span>
                </div>
                {g.lines.map((l, i) => (
                  <NotRecordedLine key={`${l.index}-${l.name}`} importId={notice.id} index={l.index} line={l} categories={categories}
                    first={i === 0} onRecorded={onRecorded} />
                ))}
              </section>
            ))}
          </div>
          <div style={{ ...s.line, borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 12 }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.textSub }}>Total not recorded</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(total)}</span>
          </div>
        </FormModal>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  box: { background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 16px', marginBottom: 16, color: '#78350f', fontSize: 13 },
  link: { border: 'none', background: 'none', padding: '4px 0', minHeight: 28, color: C.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  line: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '8px 4px' },
  // At most about half the screen (never over 480 px) — longer lists scroll inside.
  scroll: { maxHeight: 'min(50vh, 480px)', overflowY: 'auto', margin: '0 -4px', padding: '0 4px' },
  sectionHead: {
    position: 'sticky', top: 0, zIndex: 1,
    display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 12px', borderRadius: 8, background: C.subtleDense,
    fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em',
  },
};
