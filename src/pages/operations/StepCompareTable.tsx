import type { CSSProperties, ReactNode } from 'react';
import { countChanges, hasChanges, rowLabel, type CompareRow, type CompareStep } from './sopStepCompare.js';
import type { ReviewComment } from '../../api/sop-revisions.js';
import { rowComment } from './reviewComments.js';
import StepFeedback from './StepFeedback.js';

const C = {
  text: '#0f172a', body: '#334155', muted: '#64748b', border: '#e2e8f0', divider: '#f1f5f9',
  added: '#047857', addedBg: '#ecfdf5', removed: '#b91c1c', removedBg: '#fef2f2',
  changed: '#b45309', changedBg: '#fffbeb', mark: '#fde68a', moved: '#1d4ed8', movedBg: '#eff6ff',
};

const TONE: Record<string, { fg: string; bg: string }> = {
  Added: { fg: C.added, bg: C.addedBg },
  Removed: { fg: C.removed, bg: C.removedBg },
  Changed: { fg: C.changed, bg: C.changedBg },
  'Moved to another section': { fg: C.changed, bg: C.changedBg },
  Moved: { fg: C.moved, bg: C.movedBg },
};

interface Props<A extends CompareStep> {
  rows: CompareRow<A>[];
  beforeLabel?: string;
  afterLabel: string;
  isMobile: boolean;
  /** Buttons for a step in the suggestion (edit, comment, …) — reviewer only. */
  renderActions?: (step: A) => ReactNode;
  /** Something under a step in the suggestion (the reviewer's comment box). */
  renderBelow?: (step: A) => ReactNode;
  /** A supervisor's step comments, each shown under the step it's about. */
  notes?: ReviewComment[] | null;
  notesLabel?: string;
}

/**
 * The current guide and the suggested version side by side, one row per
 * step. Changes are marked in colour AND words; unchanged steps are quiet,
 * so the guide reads in full while the changes stand out. On a phone each
 * row stacks Before above After.
 */
export default function StepCompareTable<A extends CompareStep>({ rows, beforeLabel = 'Current guide', afterLabel, isMobile, renderActions, renderBelow, notes, notesLabel }: Props<A>) {
  const c = countChanges(rows);
  const summary = hasChanges(rows)
    ? [c.changed && `${c.changed} changed`, c.added && `${c.added} added`, c.removed && `${c.removed} removed`, c.moved && `${c.moved} moved`].filter(Boolean).join(' · ')
    : 'No changes to the steps.';
  const withActions = !!renderActions;
  let lastSection = '';

  return (
    <div>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: C.muted }}>{summary}</p>
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
        {!isMobile && (
          <div style={{ ...gridRow(withActions), background: C.divider, fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <div>{beforeLabel}</div><div>{afterLabel}</div>{withActions && <div />}
          </div>
        )}
        {rows.map((r, idx) => {
          const section = (r.after ?? r.before)!.section;
          const header = section !== lastSection;
          lastSection = section;
          return (
            <div key={idx}>
              {header && (
                <div style={{ padding: '12px 16px 4px', fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em', borderTop: idx ? `1px solid ${C.border}` : 'none' }}>
                  {section}
                </div>
              )}
              {isMobile
                ? <MobileRow r={r} beforeLabel={beforeLabel} afterLabel={afterLabel} renderActions={renderActions} renderBelow={renderBelow} note={rowComment(notes ?? null, r)} notesLabel={notesLabel} />
                : <DesktopRow r={r} withActions={withActions} renderActions={renderActions} renderBelow={renderBelow} note={rowComment(notes ?? null, r)} notesLabel={notesLabel} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function gridRow(withActions: boolean): CSSProperties {
  return { display: 'grid', gridTemplateColumns: `minmax(0, 1fr) minmax(0, 1fr)${withActions ? ' auto' : ''}`, gap: 16, padding: '10px 16px', alignItems: 'start' };
}

interface RowProps<A extends CompareStep> {
  r: CompareRow<A>;
  renderActions?: (step: A) => ReactNode;
  renderBelow?: (step: A) => ReactNode;
  note: string | null;
  notesLabel?: string;
}

function DesktopRow<A extends CompareStep>({ r, withActions, renderActions, renderBelow, note, notesLabel }: RowProps<A> & { withActions: boolean }) {
  const below = r.after && renderBelow?.(r.after);
  return (
    <div style={{ borderTop: `1px solid ${C.divider}` }}>
      <div style={gridRow(withActions)}>
        <StepCell r={r} side="before" />
        <StepCell r={r} side="after" />
        {withActions && <div style={{ display: 'flex', gap: 4 }}>{r.after && renderActions?.(r.after)}</div>}
      </div>
      {note && <div style={{ padding: '0 16px 12px' }}><StepFeedback comment={note} label={notesLabel} /></div>}
      {below && <div style={{ padding: '0 16px 12px', marginLeft: '50%' }}>{below}</div>}
    </div>
  );
}

function MobileRow<A extends CompareStep>({ r, beforeLabel, afterLabel, renderActions, renderBelow, note, notesLabel }: RowProps<A> & { beforeLabel: string; afterLabel: string }) {
  const changed = r.kind !== 'same' || r.moved;
  const sideLabel = (text: string) => <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px' }}>{text}</div>;
  return (
    <div style={{ borderTop: `1px solid ${C.divider}`, padding: '12px 16px', display: 'grid', gap: 10 }}>
      {/* An unchanged step is shown once; a change shows both versions. */}
      {changed && r.before && <div>{r.kind !== 'changed' && sideLabel(beforeLabel)}<StepCell r={r} side="before" /></div>}
      {r.after && <div>{changed && r.kind !== 'changed' && sideLabel(afterLabel)}<StepCell r={r} side="after" /></div>}
      {note && <StepFeedback comment={note} label={notesLabel} />}
      {r.after && renderActions && <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>{renderActions(r.after)}</div>}
      {r.after && renderBelow?.(r.after)}
    </div>
  );
}

/**
 * One version of a step: number, title, details. On a changed row the old
 * wording is struck through in red ("Was") and the new wording highlighted
 * ("Now"), so the reviewer sees what it said before, not only the result.
 */
function StepCell({ r, side }: { r: CompareRow; side: 'before' | 'after' }) {
  const step = side === 'before' ? r.before : r.after;
  if (!step) {
    return <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic', paddingTop: 2 }}>{side === 'before' ? 'Not in the current guide' : 'Removed in this version'}</div>;
  }
  const was = side === 'before';
  const label = rowLabel(r);
  const tone = label ? TONE[label] : null;
  const removed = r.kind === 'removed';
  const added = r.kind === 'added';
  const quiet = r.kind === 'same' && !r.moved;
  // Which side carries the coloured box and the label chip.
  const boxed = (added && !was) || (removed && was);
  const showChip = !!tone && (removed ? was : !was);
  const tag = r.kind === 'changed' ? (was ? 'Was' : 'Now') : null;
  const mark = (on: boolean): CSSProperties => (!on ? {} : was
    ? { background: C.removedBg, color: C.removed, textDecoration: 'line-through', borderRadius: 3, padding: '0 2px' }
    : { background: C.mark, borderRadius: 3, padding: '0 2px' });
  const number = was ? r.beforeNumber : r.afterNumber;
  const lines = (step.detail ?? '').split('\n').map(l => l.trim()).filter(Boolean);

  return (
    <div style={{ minWidth: 0, padding: boxed ? '6px 10px' : 0, borderRadius: 8, background: boxed && tone ? tone.bg : 'transparent' }}>
      {(showChip || tag) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          {tag && <span style={{ fontSize: 11, fontWeight: 700, color: was ? C.removed : C.changed, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{tag}</span>}
          {showChip && tone && (
            <span style={{ padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: tone.fg, background: boxed ? '#fff' : tone.bg }}>{label}</span>
          )}
        </div>
      )}
      <div style={{ fontSize: 14, fontWeight: 600, color: quiet ? C.muted : C.text, lineHeight: 1.45, overflowWrap: 'anywhere', textDecoration: removed ? 'line-through' : 'none' }}>
        <span style={{ color: C.muted, fontWeight: 600, marginRight: 6 }}>{number}.</span>
        <span style={mark(r.titleChanged)}>{step.title}</span>
      </div>
      {r.sectionChanged && (
        <div style={{ fontSize: 12, color: was ? C.removed : C.changed, marginTop: 2 }}>Section: {step.section}</div>
      )}
      {lines.length > 0 ? (
        <div style={{ marginTop: 4, fontSize: 13, color: quiet ? C.muted : C.body, lineHeight: 1.5, overflowWrap: 'anywhere', textDecoration: removed ? 'line-through' : 'none' }}>
          <span style={mark(r.detailChanged)}>{lines.join(' · ')}</span>
        </div>
      ) : r.detailChanged && (
        // Details added or removed: say so on the empty side, so the change reads from both.
        <div style={{ marginTop: 4, fontSize: 12.5, color: C.muted, fontStyle: 'italic' }}>No details</div>
      )}
    </div>
  );
}
