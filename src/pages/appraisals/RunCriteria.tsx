import { useState, type ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faCircleCheck } from '@fortawesome/free-solid-svg-icons';
import type { MissingPolicy, TemplateCriterion, TemplateSection } from '../../api/appraisal-templates.js';
import { MARKS_WITH_NA, allInputs, criterionDone, criterionLeft, criterionItems, inputGroups, type CriterionItem, progressOf, type InputGroup, type Notes, type ScoreInput, type Values } from './appraisalRun.js';
import { criterionScore, groupScore } from './liveScore.js';
import RunScoreField from './RunScoreField.js';
import SopCheckView from './SopCheckView.js';
import { isSopCheck, markingLine } from './sopCheck.js';
import { card, pill, type RunPalette } from './runTheme.js';
import RunMobileItem from './RunMobileItem.js';
import InfoSheetButton from './InfoSheetButton.js';

const NOTE_MAX = 1000;
/** Criterion | Score | Comment on a desktop; on a phone the three stack. */
const COLUMNS = 'minmax(180px, 1.2fr) minmax(220px, 1fr) minmax(200px, 1fr)';

interface Props {
  sections: TemplateSection[];
  values: Values;
  onChange: (key: string, value: string) => void;
  /** A comment per scored item. */
  notes: Notes;
  onNote: (key: string, note: string) => void;
  readOnly: boolean;
  /** Each criterion's 0–100 score as last saved (null = not scored yet). */
  byCriterion: Record<string, number | null>;
  /** The form's rule for unscored items — used to work out scores as marks are given. */
  policy: MissingPolicy;
  palette: RunPalette;
  mobile: boolean;
}

type Item = CriterionItem;

/** Scored directly (one box), so it's one criterion | score | comment row. */
const isSingleRow = (c: TemplateCriterion) => { const g = inputGroups(c); return g.length === 1 && g[0].name == null && g[0].inputs.length === 1; };

/**
 * The form one criterion at a time (the section is picked on the score card
 * above): a strip of the section's criteria (ticked once scored, with their
 * scores), then the one being scored, full width — criterion | score | comment — with
 * Previous / Next naming where they go.
 */
export default function RunCriteria({ sections, palette: p, mobile, current, onCurrent: setCurrent, ...rest }: Props & { current: number; onCurrent: (i: number) => void }) {
  const items = criterionItems(sections);
  // While one SOP's checklist is open, its own Previous / Next SOP buttons are the way on — the criterion pager steps aside.
  // Kept per criterion, so moving to another one (from anywhere) brings the pager back.
  const [sopOpenFor, setSopOpenFor] = useState<string | null>(null);
  if (items.length === 0) return null;
  const at = Math.min(current, items.length - 1);
  const item = items[at];
  const section = sections[item.si];
  const inSection = items.map((x, i) => ({ ...x, i })).filter(x => x.si === item.si);
  const inSop = sopOpenFor === item.c.id;

  return (
    <section style={{ ...card(p), padding: 0, overflow: 'hidden' }} aria-label="What’s scored">
      {/* Sections are picked from the score card's tiles above; here, the section's criteria as chips. */}
      <div role="region" aria-label={`Section ${item.si + 1}: ${section.name}`}>
        {/* The section's criteria as a slim strip of chips, so the criterion itself gets the full width. */}
        {mobile
          ? <CriterionPicker list={inSection} current={at} onPick={setCurrent} values={rest.values} palette={p} sectionName={section.name} />
          : <CriterionChips list={inSection} current={at} onPick={setCurrent} values={rest.values} policy={rest.policy} palette={p} mobile={mobile} />}
        <div style={{ minWidth: 0 }}>
          {!mobile && isSingleRow(item.c) && (
            <div aria-hidden style={{ display: 'grid', gridTemplateColumns: COLUMNS, gap: 16, padding: '8px 16px', fontSize: 12, fontWeight: 700, color: p.muted, background: p.bg, borderBottom: `1px solid ${p.border}` }}>
              <span>Criterion</span><span>Score</span><span>Comment</span>
            </div>
          )}
          <CriterionRows key={item.c.id} c={item.c} number={item.number} first palette={p} mobile={mobile} onSopFocus={open => setSopOpenFor(open ? item.c.id : null)} {...rest} />
          {!inSop && <Pager items={items} sections={sections} at={at} onGo={setCurrent} palette={p} mobile={mobile} />}
        </div>
      </div>
    </section>
  );
}

type NavProps = { list: (Item & { i: number })[]; current: number; onPick: (i: number) => void; values: Values; palette: RunPalette };

/** The section's criteria in a row of chips: number, name, a tick once scored; the open one highlighted. Scrolls sideways when there are many. */
function CriterionChips({ list, current, onPick, values, policy, palette: p, mobile }: NavProps & { mobile: boolean; policy: MissingPolicy }) {
  return (
    <div role="tablist" aria-label="Criteria in this section" style={{ display: 'flex', gap: 4, padding: '0 8px', overflowX: 'auto', borderBottom: `1px solid ${p.border}` }}>
      {list.map(x => {
        const on = x.i === current;
        const done = criterionDone(x.c, values);
        const left = done ? 0 : criterionLeft(x.c, values);
        const score = criterionScore(x.c, values, policy);
        return (
          <button key={x.c.id} type="button" role="tab" aria-selected={on} onClick={() => onPick(x.i)} title={x.c.name}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, maxWidth: 260, minHeight: mobile ? 44 : 40, padding: '8px 12px',
              border: 'none', borderBottom: `2px solid ${on ? p.accent : 'transparent'}`, background: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 14, whiteSpace: 'nowrap', color: on ? p.accent : p.sub, fontWeight: on ? 700 : 500,
            }}>
            <span style={{ color: on ? p.accent : p.muted }}>{x.number}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.c.name}</span>
            {done && <FontAwesomeIcon icon={faCircleCheck} aria-label="Scored" style={{ color: p.green, fontSize: 12 }} />}
            {/* Not finished: how many are still to score, instead of the tick. */}
            {left > 0 && (
              <span aria-label={`${left} left to score`} title={`${left} left to score`} style={{ minWidth: 14, height: 14, padding: '0 3px', boxSizing: 'border-box', borderRadius: 999, background: p.amber, color: '#fff', fontSize: 10, fontWeight: 800, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontVariantNumeric: 'tabular-nums' }}>{left}</span>
            )}
            {score != null && <span style={{ fontWeight: 700, color: p.text, fontVariantNumeric: 'tabular-nums' }}>· {Math.round(score)}</span>}
          </button>
        );
      })}
    </div>
  );
}
/**
 * On a phone the section's criteria are a picker, not a strip of tabs cut off at the edge:
 * where you are ("Criterion 3 of 4 in KPI") and a full-width dropdown with each criterion's
 * whole name and how many marks it still needs (criteria can be many, so it's a dropdown).
 */
function CriterionPicker({ list, current, onPick, values, palette: p, sectionName }: NavProps & { sectionName: string }) {
  const pos = list.findIndex(x => x.i === current);
  const state = (x: Item) => { if (criterionDone(x.c, values)) return ' · done'; const left = criterionLeft(x.c, values); return left > 0 ? ` · ${left} left` : ''; };
  return (
    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${p.border}` }}>
      <label htmlFor="criterion-pick" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: p.muted, marginBottom: 4 }}>
        Criterion {pos + 1} of {list.length} in {sectionName}
      </label>
      <select id="criterion-pick" value={current} onChange={e => onPick(Number(e.target.value))}
        style={{ width: '100%', minHeight: 44, padding: '8px 12px', fontSize: 16, fontWeight: 600, fontFamily: 'inherit', color: p.text, background: p.card, border: `1px solid ${p.borderStrong}`, borderRadius: 8 }}>
        {list.map(x => <option key={x.c.id} value={x.i}>{x.number} {x.c.name}{state(x)}</option>)}
      </select>
    </div>
  );
}

/** Previous / Next under the criterion, naming where they go — across sections too. */
function Pager({ items, sections, at, onGo, palette: p, mobile }: {
  items: Item[]; sections: TemplateSection[]; at: number; onGo: (i: number) => void; palette: RunPalette; mobile: boolean;
}) {
  const prev = items[at - 1];
  const next = items[at + 1];
  const label = (x: Item) => (x.si !== items[at].si ? `${x.si + 1}. ${sections[x.si].name}` : `${x.number} ${x.c.name}`);
  const btn = (enabled: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: mobile ? 44 : 36, padding: '8px 12px', borderRadius: 8, maxWidth: '48%',
    border: `1px solid ${p.borderStrong}`, background: '#fff', color: enabled ? p.sub : p.borderStrong, fontSize: 14, fontWeight: 600,
    fontFamily: 'inherit', cursor: enabled ? 'pointer' : 'default', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
  });
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '12px 16px', borderTop: `1px solid ${p.border}` }}>
      <button type="button" disabled={!prev} onClick={() => prev && onGo(at - 1)} aria-label={prev ? `Previous: ${label(prev)}` : 'Previous'} style={btn(!!prev)}>
        <FontAwesomeIcon icon={faChevronLeft} /> {prev && !mobile ? label(prev) : 'Previous'}
      </button>
      {next ? (
        <button type="button" onClick={() => onGo(at + 1)} aria-label={`${next.si !== items[at].si ? 'Next section' : 'Next'}: ${label(next)}`} style={{ ...btn(true), color: p.accent, borderColor: p.accent }}>
          {mobile ? (next.si !== items[at].si ? 'Next section' : 'Next') : <>{next.si !== items[at].si ? 'Next section: ' : 'Next: '}{label(next)}</>} <FontAwesomeIcon icon={faChevronRight} />
        </button>
      ) : (
        // Last criterion: nothing on the right — the bottom bar's "Next: comments" takes it from here.
        <span />
      )}
    </div>
  );
}


type RowProps = Omit<Props, 'sections'> & { c: TemplateCriterion; number: string; first: boolean; onSopFocus?: (open: boolean) => void };

/** A live score pill: "55 / 100" once there's enough to work it out, else "—". */
function ScorePill({ score, palette: p, label }: { score: number | null; palette: RunPalette; label: string }) {
  return (
    <span title={label} style={{ ...pill(score == null ? p.muted : p.accent, score == null ? p.bg : p.accentSoft), fontVariantNumeric: 'tabular-nums' }}>
      {score == null ? '—' : `${Math.round(score)} / 100`}
    </span>
  );
}

/**
 * One criterion: a single row (criterion | score | comment) when scored
 * directly; when scored from a scoring form, a table of its items grouped by
 * the form's sections, each section with its weight and score so far.
 * Scores update as marks are given (liveScore — the server's rules).
 */
function CriterionRows({ c, number, first, values, onChange, notes, onNote, readOnly, policy, palette: p, mobile, onSopFocus }: RowProps) {
  const groups = inputGroups(c);
  // An SOP check (every step pass / fail / N/A, several SOPs): an overview of the SOPs, each opened on its own.
  const sopCheck = isSopCheck(groups);
  const done = criterionDone(c, values);
  const live = criterionScore(c, values, policy);
  const single = groups.length === 1 && groups[0].name == null && groups[0].inputs.length === 1 && groups[0].inputs[0].pointId == null;
  const title = (
    <div>
      {/* The tab above already names it ({number} {c.name}) — here just its weight, its score so far and what it means. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }} aria-label={`${number} ${c.name}${done && !readOnly ? ', scored' : ''}`}>
        <span style={{ fontSize: 13, color: p.muted }}>{c.weight}% of the section</span>
        <ScorePill score={live} palette={p} label="Its score out of 100 from the marks given" />
        {mobile && (c.description || sopCheck) && (
          <InfoSheetButton title={`${number} ${c.name}`} label={sopCheck ? 'How it’s marked' : `What “${c.name}” means`} palette={p}>
            {sopCheck && <p style={{ margin: 0 }}>{markingLine(groups)}</p>}
            {c.description && <p style={{ margin: sopCheck ? '8px 0 0' : 0, color: sopCheck ? p.muted : p.sub }}>{c.description}</p>}
          </InfoSheetButton>
        )}
      </div>
      {/* An SOP check says how its steps are marked, from the steps themselves (so it's always right) — on a phone, behind a toggle. */}
      {!mobile && (
        <>
          {c.description && <p style={{ margin: '4px 0 0', fontSize: 13, color: p.muted, lineHeight: 1.5 }}>{c.description}</p>}
          {sopCheck && <p style={{ margin: '4px 0 0', fontSize: 13, color: p.sub, lineHeight: 1.5 }}>{markingLine(groups)}</p>}
        </>
      )}
    </div>
  );
  const scoreCell = (i: ScoreInput) => (
    <RunScoreField input={i} value={values[i.key] ?? ''} onChange={v => onChange(i.key, v)} readOnly={readOnly} palette={p} mobile={mobile} />
  );
  const commentCell = (i: ScoreInput) => (
    <CommentCell label={i.name} note={notes[i.key] ?? ''} onNote={v => onNote(i.key, v)} readOnly={readOnly} palette={p} mobile={mobile} />
  );
  const border = first ? 'none' : `1px solid ${p.border}`;

  if (groups.length === 0) {
    return <Row border={border} mobile={mobile}>{title}<span style={{ fontSize: 13, color: p.muted }}>Worked out automatically</span><span /></Row>;
  }
  if (single) {
    const i = groups[0].inputs[0];
    return <Row border={border} mobile={mobile}>{title}{scoreCell(i)}{commentCell(i)}</Row>;
  }
  if (sopCheck) {
    return (
      <div style={{ borderTop: border, padding: '12px 16px 16px' }}>
        {title}
        <SopCheckView groups={groups} values={values} policy={policy} readOnly={readOnly} palette={p} mobile={mobile} onFocus={onSopFocus} scoreCell={scoreCell} commentCell={commentCell} noteOf={i => notes[i.key] ?? ''} />
      </div>
    );
  }
  // Scored from a scoring form (or on points): a table. On a phone the rows stack.
  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: p.muted, borderBottom: `1px solid ${p.border}` };
  const td: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'top', borderBottom: `1px solid ${p.border}` };
  return (
    <div style={{ borderTop: border, padding: '12px 16px 16px' }}>
      {title}
      {mobile ? groups.map((g, gi) => (
        // On a phone: no box inside the card — the items run its full width, thin lines between them.
        <div key={gi} style={{ margin: '12px -16px 0', borderTop: `1px solid ${p.border}`, borderBottom: `1px solid ${p.border}` }}>
          {g.name && <GroupHeading g={g} score={groupScore(g, values, policy)} palette={p} />}
          {g.inputs.map((i, ii) => (
            <div key={i.key} style={{ borderTop: ii || g.name ? `1px solid ${p.border}` : 'none' }}>
              <RunMobileItem name={i.name} description={i.description} sub={g.name && !MARKS_WITH_NA.includes(i.kind) ? `${i.weight}% of ${g.name}` : null}
                score={scoreCell(i)} comment={commentCell(i)} hasComment={(notes[i.key] ?? '').trim() !== ''} readOnly={readOnly} palette={p} />
            </div>
          ))}
        </div>
      )) : (
        <table style={{ width: '100%', marginTop: 12, borderCollapse: 'separate', borderSpacing: 0, border: `1px solid ${p.border}`, borderRadius: 8, overflow: 'hidden', tableLayout: 'fixed' }}>
          <colgroup><col style={{ width: '28%' }} /><col style={{ width: '36%' }} /><col /></colgroup>
          <thead style={{ background: p.bg }}>
            <tr><th scope="col" style={th}>Item</th><th scope="col" style={th}>Score</th><th scope="col" style={th}>Comment</th></tr>
          </thead>
          {groups.map((g, gi) => (
            <tbody key={g.name ?? gi}>
              {g.name && (
                <tr><th scope="rowgroup" colSpan={3} style={{ ...th, padding: 0, background: p.accentSoft }}><GroupHeading g={g} score={groupScore(g, values, policy)} palette={p} /></th></tr>
              )}
              {g.inputs.map(i => {
                return (
                  <tr key={i.key}>
                    <th scope="row" style={{ ...td, textAlign: 'left', fontSize: 14, fontWeight: 600, color: p.sub }}>
                      {i.name}
                      {i.description && <div style={{ fontSize: 13, fontWeight: 400, color: p.muted, marginTop: 4, lineHeight: 1.5 }}>{i.description}</div>}
                      {/* A pass / fail step has no share to show — its SOP scores passed ÷ decided, N/A left out. */}
                      {g.name && i.kind !== 'PASS_FAIL' && <div style={{ fontSize: 12, fontWeight: 400, color: p.muted, marginTop: 2 }}>{i.weight}% of {g.name}</div>}
                    </th>
                    <td style={td}>{scoreCell(i)}</td>
                    <td style={td}>{commentCell(i)}</td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      )}
    </div>
  );
}

/** A scoring-form section's heading inside the table: its name, its weight, and its score so far. */
function GroupHeading({ g, score, palette: p }: { g: InputGroup; score: number | null; palette: RunPalette }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: p.accentSoft }}>
      <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: p.sub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {g.name}{g.weight != null && <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: p.muted }}> · {g.weight}%</span>}
      </span>
      <ScorePill score={score} palette={p} label={`${g.name} score out of 100 from the marks given`} />
    </div>
  );
}
/** One line of the table: criterion | score | comment (stacked on a phone). */
function Row({ children, border, mobile }: { children: ReactNode; border: string; mobile: boolean }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: mobile ? '1fr' : COLUMNS, gap: mobile ? 8 : 16, alignItems: 'start',
      padding: '12px 16px', borderTop: border,
    }}>
      {children}
    </div>
  );
}

interface NoteProps { label: string; note: string; onNote: (v: string) => void; readOnly: boolean; palette: RunPalette; mobile: boolean }

/** The comment for one scored item: a small box to type in, or the comment (or a dash) once it can't be changed. */
function CommentCell({ label, note, onNote, readOnly, palette: p, mobile }: NoteProps) {
  if (readOnly) return <span style={{ fontSize: 13, color: note ? p.sub : p.muted, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{note || '—'}</span>;
  return (
    <textarea aria-label={`Comment on ${label}`} rows={2} value={note} maxLength={NOTE_MAX} onChange={e => onNote(e.target.value)}
      placeholder={mobile ? 'Comment (optional)' : 'Optional'}
      style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '8px 12px', fontSize: mobile ? 16 : 14, fontFamily: 'inherit',
        color: p.text, border: `1px solid ${p.borderStrong}`, borderRadius: 8, outline: 'none', resize: 'vertical' }} />
  );
}
