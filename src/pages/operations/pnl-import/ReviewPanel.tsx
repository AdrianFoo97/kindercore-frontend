import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import type { ImportPreview, PreviewLine } from '../../../api/pnlImport.js';
import { blockReason, decisionLines, existingConflict, needsCheck, summarise, type Decision, type PlanState } from './importPlan.js';
import { LineRow, lineElementId } from './LineRow.js';
import { formatMoney } from './format.js';
import { C, MONTH_FULL } from '../operating-costs/shared.js';

// The Import P&L review: what will be recorded, what won't, and a decision
// for every cost line. Nothing is saved until Import.

export interface ReviewPanelProps {
  preview: ImportPreview;
  state: PlanState;
  onChange: (next: PlanState) => void;
  canAddCategory: boolean;
  importing: boolean;
  onImport: () => void;
  onCancel: () => void;
}

const isCost = (kind: string) => kind === 'EXPENSE' || kind === 'COST_OF_SALES';

export function ReviewPanel({ preview, state, onChange, canAddCategory, importing, onImport, onCancel }: ReviewPanelProps) {
  const sum = summarise(preview, state);
  const blocked = blockReason(preview, state);
  const monthLabel = `${MONTH_FULL[preview.period.month - 1]} ${preview.period.year}`;
  const toDecide = new Set(decisionLines(preview).map(l => l.key));
  const offList = (pred: (l: PreviewLine) => boolean) => preview.lines.filter(pred);
  const notCost = offList(l => l.status === 'NOT_A_COST');
  const zero = offList(l => l.status === 'ZERO');
  const off = preview.sections.filter(s => isCost(s.kind) && s.addsUp === false);
  const set = (patch: Partial<PlanState>) => onChange({ ...state, ...patch });
  const decide = (key: string, d: Decision) => set({ decisions: { ...state.decisions, [key]: d } });
  /** Scrolls to the next line still waiting for a decision and puts the cursor in its dropdown. */
  const goToNext = () => {
    const next = decisionLines(preview).find(l => (state.decisions[l.key] ?? null) === null);
    const row = next && document.getElementById(lineElementId(next.key));
    if (!row) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    row.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    row.querySelector('select')?.focus({ preventScroll: true });
  };

  return (
    <div>
      <section style={s.card} aria-label="Summary">
        <div style={{ padding: '16px 24px' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{monthLabel} P&L</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            {preview.fileName} · {preview.provider === 'none' ? 'read from the PDF’s text, without AI' : `read by ${preview.provider} (${preview.model})`}
          </div>
          {preview.backupReason && (
            <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>Read by the backup provider: {preview.backupReason}.</div>
          )}
        </div>
        <div style={s.stats}>
          <Stat label="Will be recorded" value={`${sum.record.count} · ${formatMoney(sum.record.total)}`} />
          <Stat label="Not imported" value={`${sum.notImported.count} · ${formatMoney(sum.notImported.total)}`} />
          <Stat label="Still to decide" value={String(sum.undecided)} tone={sum.undecided ? '#b45309' : undefined}
            action={sum.undecided ? { label: 'Go to next', onClick: goToNext } : undefined} />
        </div>
      </section>

      {(!preview.hasText || off.length > 0) && (
        <div role="alert" style={s.warn}>
          <FontAwesomeIcon icon={faTriangleExclamation} style={{ color: C.amber, marginTop: 2 }} />
          <div>
            {!preview.hasText && <div>This PDF has no text to check against (it may be scanned). Check every amount against the PDF.</div>}
            {off.map(sec => (
              <div key={sec.title}>“{sec.title}” adds up to {formatMoney(sec.sum)}, but the P&L prints {formatMoney(sec.printedSubtotal ?? 0)}. Check its amounts.</div>
            ))}
          </div>
        </div>
      )}

      {preview.sections.map((sec, si) => {
        // Line keys are "section index-line index", so two sections with the same heading never mix.
        const lines = preview.lines.filter(l => l.key.startsWith(`${si}-`) && toDecide.has(l.key));
        if (!lines.length) return null;
        return (
          <section key={si} style={s.card} aria-label={sec.title}>
            <div style={s.secHead}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{sec.title}</span>
              {sec.printedSubtotal !== null && <span style={{ fontSize: 12, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(sec.printedSubtotal)}</span>}
            </div>
            {lines.map(l => (
              <LineRow key={l.key} line={l} decision={state.decisions[l.key] ?? null}
                categories={preview.categories} groups={preview.groups} canAddCategory={canAddCategory}
                existing={existingConflict(preview, l, state.decisions[l.key] ?? null)} replace={!!state.replace[l.key]}
                hasText={preview.hasText}
                onDecide={d => decide(l.key, d)}
                onReplace={on => set({ replace: { ...state.replace, [l.key]: on } })} />
            ))}
          </section>
        );
      })}

      <OffList title="Revenue and other income — never imported" lines={notCost} />
      <OffList title="Nothing spent this month" lines={zero} />

      <section style={{ ...s.card, padding: '16px 24px' }} aria-label="Import">
        <label style={s.check}>
          <input type="checkbox" checked={state.remember} onChange={e => set({ remember: e.target.checked })} style={s.box} />
          Remember these choices for next month’s P&L
        </label>
        {needsCheck(preview, state) && (
          <label style={{ ...s.check, marginTop: 12 }}>
            <input type="checkbox" checked={state.checked} onChange={e => set({ checked: e.target.checked })} style={s.box} />
            I’ve checked the flagged amounts against the PDF
          </label>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
          {blocked && <span role="status" style={{ fontSize: 13, color: C.muted, marginRight: 'auto' }}>{blocked}</span>}
          <button type="button" onClick={onCancel} style={s.secondary}>Cancel</button>
          <button type="button" onClick={onImport} disabled={!!blocked || importing}
            style={{ ...s.primary, opacity: blocked || importing ? 0.5 : 1, cursor: blocked || importing ? 'default' : 'pointer' }}>
            {importing ? 'Importing…' : `Import into ${monthLabel}`}
          </button>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, tone, action }: { label: string; value: string; tone?: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div style={{ flex: '1 1 160px', padding: '12px 24px' }}>
      <div style={{ fontSize: 12, color: C.muted }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 2 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: tone ?? C.text, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        {action && (
          <button type="button" onClick={action.onClick}
            style={{ border: 'none', background: 'none', padding: 0, minHeight: 28, color: C.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

function OffList({ title, lines }: { title: string; lines: PreviewLine[] }) {
  if (!lines.length) return null;
  return (
    <details style={{ ...s.card, padding: '12px 24px' }}>
      <summary style={{ fontSize: 13, fontWeight: 600, color: C.textSub, cursor: 'pointer' }}>{title} ({lines.length})</summary>
      {lines.map(l => (
        <div key={l.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 13, color: C.muted, padding: '6px 0' }}>
          <span>{l.name}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatMoney(l.amount)}</span>
        </div>
      ))}
    </details>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 16, overflow: 'hidden' },
  stats: { display: 'flex', flexWrap: 'wrap', borderTop: `1px solid ${C.divider}` },
  secHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 24px', background: C.subtle },
  warn: {
    display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 16px', marginBottom: 16, borderRadius: 12,
    background: '#fffbeb', border: '1px solid #fde68a', color: '#78350f', fontSize: 13, lineHeight: 1.5,
  },
  check: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.textSub, cursor: 'pointer' },
  box: { width: 16, height: 16, accentColor: C.primary, cursor: 'pointer' },
  primary: { minHeight: 36, padding: '0 18px', borderRadius: 8, border: 'none', background: C.primary, color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' },
  secondary: { minHeight: 36, padding: '0 16px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.textSub, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' },
};
