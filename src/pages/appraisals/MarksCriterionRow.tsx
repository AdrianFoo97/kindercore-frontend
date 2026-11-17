import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronRight, faComment } from '@fortawesome/free-solid-svg-icons';
import type { TemplateCriterion } from '../../api/appraisal-templates.js';
import { inputGroups, markText, type Notes, type Values } from './appraisalRun.js';
import type { RunPalette } from './runTheme.js';

/** A comment behind a small icon — read on a tap, so the marks stay easy to scan. */
export function CommentToggle({ note, about, open, onToggle, palette: p }: { note: string; about: string; open: boolean; onToggle: () => void; palette: RunPalette }) {
  if (!note.trim()) return null;
  return (
    <button type="button" onClick={e => { e.stopPropagation(); onToggle(); }} aria-expanded={open} aria-label={`${open ? 'Hide' : 'Read'} the comment on ${about}`} title={open ? 'Hide comment' : 'Read comment'}
      style={{ width: 32, height: 32, flexShrink: 0, border: 'none', borderRadius: 8, cursor: 'pointer', background: open ? p.accentSoft : 'transparent', color: open ? p.accent : p.muted }}>
      <FontAwesomeIcon icon={faComment} />
    </button>
  );
}

const CommentText = ({ note, palette: p }: { note: string; palette: RunPalette }) => (
  <div style={{ margin: '4px 0 0', padding: '8px 10px', background: p.bg, borderRadius: 8, fontSize: 13, color: p.text, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{note.trim()}</div>
);

/**
 * One criterion in the marks: its score, a comment icon (when there's a
 * comment), and — when it's scored from a form or on items — a tap opens each
 * item with its rating or pass / fail / N/A (and their comments the same way).
 */
export default function MarksCriterionRow({ c, number, weightTag, score, values, notes, palette: p, rowStyle, detailHref }: {
  c: TemplateCriterion; number: string; weightTag: React.ReactNode; score: React.ReactNode;
  values: Values; notes: Notes; palette: RunPalette; rowStyle: React.CSSProperties;
  /** Its own page (items, ratings, comments) — when set, tapping a form criterion opens it instead of expanding here. */
  detailHref?: string;
}) {
  const navigate = useNavigate();
  const groups = inputGroups(c);
  const inputs = groups.flatMap(g => g.inputs);
  const direct = inputs.length === 1 && inputs[0].pointId == null ? inputs[0] : null;
  const hasItems = !direct && inputs.length > 0;
  const [open, setOpen] = useState(false);
  const [readingKey, setReadingKey] = useState<string | null>(null);
  const toggleNote = (key: string) => setReadingKey(k => (k === key ? null : key));
  const directNote = direct ? (notes[direct.key] ?? '') : '';
  const go = () => (detailHref ? navigate(detailHref) : setOpen(o => !o));

  const name = (
    <span style={{ minWidth: 0, fontSize: 14, color: p.sub, paddingLeft: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
      {hasItems && <FontAwesomeIcon icon={detailHref ? faChevronRight : open ? faChevronDown : faChevronRight} style={{ fontSize: 11, color: p.muted, width: 12 }} />}
      <span><span style={{ color: p.muted, marginRight: 6 }}>{number}</span>{c.name}{weightTag}</span>
      {direct && <CommentToggle note={directNote} about={c.name} open={readingKey === direct.key} onToggle={() => toggleNote(direct.key)} palette={p} />}
    </span>
  );
  return (
    <div>
      <div className="kc-mark-row" style={{ ...rowStyle, cursor: hasItems ? 'pointer' : 'default' }}
        {...(hasItems ? { role: detailHref ? 'link' : 'button', tabIndex: 0, ...(detailHref ? {} : { 'aria-expanded': open }), onClick: go, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } } } : {})}>
        {name}
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
          {score}
        </span>
      </div>
      {direct && readingKey === direct.key && <div style={{ padding: '0 16px 10px 32px' }}><CommentText note={directNote} palette={p} /></div>}
      {hasItems && open && <div style={{ padding: '4px 16px 12px 44px', borderTop: `1px solid ${p.border}` }}><CriterionItems c={c} values={values} notes={notes} palette={p} /></div>}
    </div>
  );
}

/** Each item of a criterion scored from a form or on items — grouped by the form's sections (or SOPs) — with its rating or pass / fail / N/A, and its comment behind an icon. */
export function CriterionItems({ c, values, notes, palette: p, onlyGroup }: {
  c: TemplateCriterion; values: Values; notes: Notes; palette: RunPalette;
  /** Show just this group (e.g. the SOP picked from a dropdown) — without its heading, the dropdown names it. */
  onlyGroup?: number;
}) {
  const [readingKey, setReadingKey] = useState<string | null>(null);
  const groups = inputGroups(c);
  // Pass / fail steps (an SOP) read as Step | Result; anything else as Item | Rating.
  const passFail = groups.every(g => g.inputs.every(i => i.kind === 'PASS_FAIL'));
  return (
    <>
      <div aria-hidden style={{ display: 'flex', justifyContent: 'space-between', gap: 8, paddingBottom: 6, fontSize: 12, fontWeight: 700, color: p.muted }}>
        <span>{passFail ? 'Step' : 'Item'}</span><span>{passFail ? 'Result' : 'Rating'}</span>
      </div>
      {groups.map((g, gi) => (onlyGroup != null && gi !== onlyGroup ? null : (
        <div key={g.name ?? gi} style={{ marginTop: gi && onlyGroup == null ? 16 : 0 }}>
          {g.name && onlyGroup == null && <div style={{ fontSize: 12, fontWeight: 700, color: p.muted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{g.name}</div>}
          {g.inputs.map(i => {
            const mark = markText(i, values[i.key] ?? '');
            const note = notes[i.key] ?? '';
            return (
              <div key={i.key} style={{ padding: '6px 0', borderTop: `1px solid ${p.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* The comment icon sits right after the name, not out by the mark. */}
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <span style={{ minWidth: 0, fontSize: 14, color: p.text }}>{i.name}</span>
                    <CommentToggle note={note} about={i.name} open={readingKey === i.key} onToggle={() => setReadingKey(k => (k === i.key ? null : i.key))} palette={p} />
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: markColour(i.kind, values[i.key] ?? '', p) ?? (mark ? p.text : p.muted), whiteSpace: 'nowrap' }}>{mark ?? 'Not marked'}</span>
                </div>
                {readingKey === i.key && <CommentText note={note} palette={p} />}
              </div>
            );
          })}
        </div>
      )))}
    </>
  );
}

/** Pass green, Fail red, N/A grey — as in an SOP observation (with the word, never colour alone). Other kinds: no special colour. */
function markColour(kind: string, value: string, p: RunPalette): string | null {
  if (kind !== 'PASS_FAIL') return null;
  return value === '1' ? p.green : value === '0' ? p.red : value === '-1' ? p.muted : null;
}
