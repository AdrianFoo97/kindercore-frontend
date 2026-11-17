import { useRef, useState, type ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faCircle, faCircleCheck, faCircleHalfStroke } from '@fortawesome/free-solid-svg-icons';
import type { MissingPolicy } from '../../api/appraisal-templates.js';
import type { InputGroup, ScoreInput, Values } from './appraisalRun.js';
import { groupScore, weightedScore } from './liveScore.js';
import { useScoreBand } from './useScoreBand.js';
import { sopProgress, sopSections } from './sopCheck.js';
import type { RunPalette } from './runTheme.js';

interface Props {
  groups: InputGroup[];
  values: Values;
  policy: MissingPolicy;
  readOnly: boolean;
  palette: RunPalette;
  mobile: boolean;
  /** An SOP's checklist was opened (true) or closed back to the overview (false). */
  onFocus?: (open: boolean) => void;
  /** The Pass / Fail / N/A buttons and the comment box for one step. */
  scoreCell: (i: ScoreInput) => ReactNode;
  commentCell: (i: ScoreInput) => ReactNode;
}

/**
 * An SOP check (a criterion scored from SOPs — every step pass / fail / N/A):
 * first an overview of every SOP with how far it's got and its score, then —
 * on "Start" / "Continue" / "Review" — that SOP's checklist on its own, with
 * the way back to the overview and on to the next SOP. Same page, same draft:
 * nothing is lost moving between them.
 */
export default function SopCheckView({ groups, values, policy, readOnly, palette: p, mobile, onFocus, scoreCell, commentCell }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const go = (i: number | null) => { setOpen(i); onFocus?.(i != null); top.current?.scrollIntoView({ block: 'nearest' }); };
  return (
    <div ref={top} style={{ marginTop: 12, scrollMarginTop: 72 }}>
      {open == null
        ? <Overview groups={groups} values={values} policy={policy} readOnly={readOnly} palette={p} mobile={mobile} onOpen={go} />
        : <Checklist groups={groups} at={open} values={values} policy={policy} palette={p} mobile={mobile} onGo={go} scoreCell={scoreCell} commentCell={commentCell} />}
    </div>
  );
}

function Overview({ groups, values, policy, readOnly, palette: p, mobile, onOpen }: {
  groups: InputGroup[]; values: Values; policy: MissingPolicy; readOnly: boolean; palette: RunPalette; mobile: boolean; onOpen: (i: number) => void;
}) {
  const bandOf = useScoreBand();
  const all = groups.map(g => sopProgress(g, values));
  const done = all.filter(x => x.status === 'DONE').length;
  // One clear next step: only the first SOP not yet done gets the filled button.
  const nextUp = readOnly ? -1 : all.findIndex(x => x.status !== 'DONE');
  // One section: just the SOPs — no heading repeating the whole total.
  const secs = sopSections(groups);
  const grouped = secs.length > 1;
  return (
    <section aria-label="SOPs to check">
      <div style={{ fontSize: 13, fontWeight: 600, color: p.sub, marginBottom: 8 }}>
        {groups.length} SOPs · {done} done · {all.reduce((n, x) => n + x.marked, 0)} of {all.reduce((n, x) => n + x.total, 0)} steps marked
      </div>
      {secs.map((sec, si) => {
        // A section's score so far: its SOPs by their share of it.
        const secScore = weightedScore(sec.sops.map(({ g }) => ({ score: groupScore(g, values, policy), weight: g.weight ?? 0 })), policy);
        return (
          <div key={sec.name ?? si} style={{ marginTop: si ? 16 : 0 }}>
            {sec.name && grouped && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '0 0 6px' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: p.sub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{sec.name}</span>
                {sec.weight != null && <span style={{ fontSize: 12, color: p.muted }}>{sec.weight}% of the total</span>}
                <span style={{ flex: 1 }} />
                <strong style={{ fontSize: 13, color: secScore == null ? p.muted : bandOf(secScore).color, fontVariantNumeric: 'tabular-nums' }}>
                  {secScore == null ? '—' : `${Math.round(secScore)} / 100`}
                </strong>
              </div>
            )}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, border: `1px solid ${p.border}`, borderRadius: 8, overflow: 'hidden' }}>
              {sec.sops.map(({ g, index: gi }, row) => {
                const x = all[gi];
                const score = groupScore(g, values, policy);
                const verb = readOnly || x.status === 'DONE' ? 'Review' : x.status === 'IN_PROGRESS' ? 'Continue' : 'Start';
                const icon = x.status === 'DONE' ? faCircleCheck : x.status === 'IN_PROGRESS' ? faCircleHalfStroke : faCircle;
                const iconColour = x.status === 'DONE' ? p.green : x.status === 'IN_PROGRESS' ? p.amber : p.border;
                return (
                  <li key={g.name ?? gi} className="kc-sop-row" style={{ borderTop: row ? `1px solid ${p.border}` : 'none' }}>
                    <button type="button" onClick={() => onOpen(gi)} aria-label={`${verb} ${g.name}`}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: mobile ? '12px' : '10px 16px', minHeight: mobile ? 56 : 52,
                        border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                      }}>
                      <FontAwesomeIcon icon={icon} aria-hidden style={{ color: iconColour, fontSize: 16, flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: p.text }}>{g.name}</span>
                        <span style={{ display: 'block', fontSize: 12, color: p.muted, marginTop: 2 }}>
                          {x.marked === 0 ? `${x.total} steps` : `${x.marked} of ${x.total} marked · ${x.passed} passed`}
                          {grouped && g.inSection && g.weight != null ? ` · ${g.weight}% of ${g.inSection.name}` : ''}
                        </span>
                      </span>
                      <strong style={{ fontSize: 15, minWidth: 32, textAlign: 'right', color: score == null ? p.muted : bandOf(score).color, fontVariantNumeric: 'tabular-nums' }}>
                        {score == null ? '—' : Math.round(score)}
                      </strong>
                      {!mobile && (
                        <span style={{
                          minWidth: 84, textAlign: 'center', padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                          ...(gi === nextUp ? { border: `1px solid ${p.accent}`, color: '#fff', background: p.accent } : { border: `1px solid ${p.borderStrong}`, color: p.sub, background: '#fff' }),
                        }}>{verb}</span>
                      )}
                      {mobile && <FontAwesomeIcon icon={faChevronRight} aria-hidden style={{ color: p.muted, fontSize: 12 }} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <style>{`.kc-sop-row:hover{background:${p.bg}}`}</style>
    </section>
  );
}

function Checklist({ groups, at, values, policy, palette: p, mobile, onGo, scoreCell, commentCell }: {
  groups: InputGroup[]; at: number; values: Values; policy: MissingPolicy; palette: RunPalette; mobile: boolean;
  onGo: (i: number | null) => void; scoreCell: (i: ScoreInput) => ReactNode; commentCell: (i: ScoreInput) => ReactNode;
}) {
  const bandOf = useScoreBand();
  const g = groups[at];
  const x = sopProgress(g, values);
  const score = groupScore(g, values, policy);
  const navBtn = (primary: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: mobile ? 44 : 36, padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
    fontSize: 14, fontWeight: 600, fontFamily: 'inherit', maxWidth: '48%', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
    border: `1px solid ${primary ? p.accent : p.borderStrong}`, background: '#fff', color: primary ? p.accent : p.sub,
  });
  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: p.muted, borderBottom: `1px solid ${p.border}` };
  const td: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'top', borderBottom: `1px solid ${p.border}` };

  return (
    <section aria-label={g.name ?? 'SOP'}>
      {/* Where you are: back to every SOP, this SOP's name, its place in the list, progress and score. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <button type="button" onClick={() => onGo(null)} style={{ ...navBtn(false), maxWidth: 'none' }}>
          <FontAwesomeIcon icon={faChevronLeft} /> All SOPs
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: p.text }}>{g.name}</div>
          <div style={{ fontSize: 12, color: p.muted }}>{g.inSection && sopSections(groups).length > 1 ? `${g.inSection.name} · ` : ''}SOP {at + 1} of {groups.length} · {x.marked} of {x.total} marked · {x.passed} passed</div>
        </div>
        <strong title="Steps passed ÷ (passed + failed); N/A isn't counted" style={{ fontSize: 18, color: score == null ? p.muted : bandOf(score).color, fontVariantNumeric: 'tabular-nums' }}>
          {score == null ? '—' : `${Math.round(score)} / 100`}
        </strong>
      </div>

      {mobile ? (
        <div style={{ border: `1px solid ${p.border}`, borderRadius: 8, overflow: 'hidden' }}>
          {g.inputs.map((i, ii) => (
            <div key={i.key} style={{ padding: 12, borderTop: ii ? `1px solid ${p.border}` : 'none', display: 'grid', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: p.sub }}>{ii + 1}. {i.name}
                {i.description && <span style={{ display: 'block', fontSize: 13, fontWeight: 400, color: p.muted, marginTop: 4, lineHeight: 1.5 }}>{i.description}</span>}
              </span>
              {scoreCell(i)}
              {commentCell(i)}
            </div>
          ))}
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, border: `1px solid ${p.border}`, borderRadius: 8, overflow: 'hidden', tableLayout: 'fixed' }}>
          <colgroup><col style={{ width: '26%' }} /><col style={{ width: '30%' }} /><col style={{ width: '24%' }} /><col /></colgroup>
          <thead style={{ background: p.bg }}>
            <tr><th scope="col" style={th}>Step</th><th scope="col" style={th}>Details</th><th scope="col" style={th}>Result</th><th scope="col" style={th}>Comment</th></tr>
          </thead>
          <tbody>
            {g.inputs.map((i, ii) => (
              <tr key={i.key}>
                <th scope="row" style={{ ...td, textAlign: 'left', fontSize: 14, fontWeight: 600, color: p.sub }}>
                  <span style={{ color: p.muted, marginRight: 6 }}>{ii + 1}.</span>{i.name}
                </th>
                <td style={{ ...td, fontSize: 13, color: p.muted, lineHeight: 1.5 }}>{i.description ?? '—'}</td>
                <td style={td}>{scoreCell(i)}</td>
                <td style={td}>{commentCell(i)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 12 }}>
        {at > 0
          ? <button type="button" onClick={() => onGo(at - 1)} style={navBtn(false)}><FontAwesomeIcon icon={faChevronLeft} /> {groups[at - 1].name}</button>
          : <span />}
        {at < groups.length - 1
          ? <button type="button" onClick={() => onGo(at + 1)} style={navBtn(true)}>Next SOP: {groups[at + 1].name} <FontAwesomeIcon icon={faChevronRight} /></button>
          : <button type="button" onClick={() => onGo(null)} style={navBtn(true)}>Done — back to all SOPs</button>}
      </div>
    </section>
  );
}
