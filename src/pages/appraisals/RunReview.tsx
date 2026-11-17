import type { MissingPolicy, TemplateSection } from '../../api/appraisal-templates.js';
import { useScoreBand } from './useScoreBand.js';
import { criterionNumber, inputGroups, markText, type Notes, type Values } from './appraisalRun.js';
import { criterionScore, sectionScore, totalScore } from './liveScore.js';
import { card, type RunPalette } from './runTheme.js';
import MarksCriterionRow from './MarksCriterionRow.js';

/** Width of the right-hand score column. */
const SCORE_COL = 64;
/** A section row under the pointer — a shade darker than its tint. */
const MARK_SECTION_HOVER = '#e0e7ff';
const pct = (n: number | null) => (n == null ? '—' : `${Math.round(n)}`);

/**
 * Step 2 — the comments: every comment written while scoring, by criterion
 * (and by item, for a scoring form), so the scorer can read them back before
 * writing the overall comments.
 */
export function RunCommentsList({ sections, values, notes, palette: p }: { sections: TemplateSection[]; values: Values; notes: Notes; palette: RunPalette }) {
  const rows = sections.flatMap((s, si) => s.criteria.flatMap((c, ci) => inputGroups(c).flatMap(g => g.inputs
    .map(i => ({ key: i.key, number: criterionNumber(si, ci), criterion: c.name, item: i.pointId ? i.name : null, note: (notes[i.key] ?? '').trim(), mark: markText(i, values[i.key] ?? '') }))
    .filter(r => r.note))));
  return (
    <section aria-labelledby="comments-heading" style={card(p)}>
      <h2 id="comments-heading" style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: p.text }}>Comments on each criterion</h2>
      {rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: p.muted }}>No comments were added while scoring.</p>
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {rows.map((r, i) => (
            <li key={r.key} style={{ padding: '10px 0', borderTop: i ? `1px solid ${p.border}` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, fontSize: 13, fontWeight: 700, color: p.sub }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ color: p.muted, marginRight: 6 }}>{r.number}</span>{r.criterion}{r.item && <span style={{ fontWeight: 500, color: p.muted }}> · {r.item}</span>}
                </span>
                {/* The mark it's about, out of what it's out of. */}
                <span style={{ fontVariantNumeric: 'tabular-nums', color: r.mark ? p.text : p.muted, whiteSpace: 'nowrap' }}>{r.mark ?? 'Not marked'}</span>
              </div>
              <div style={{ fontSize: 14, color: p.text, marginTop: 2, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{r.note}</div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * Step 3 — the marks (and how anyone reads a finished appraisal): each section
 * with its criteria's scores, and the total. A criterion scored from a form or
 * on items opens to show each one's rating; comments sit behind an icon.
 */
export function RunMarksReview({ sections, values, notes = {}, policy, palette: p, detailHref }: {
  sections: TemplateSection[]; values: Record<string, string>; notes?: Notes; policy: MissingPolicy; palette: RunPalette;
  /** A criterion's own page — readers open form criteria there (the scorer expands them in place, keeping the draft). */
  detailHref?: (criterionId: string) => string;
}) {
  const bandOf = useScoreBand();
  const total = totalScore(sections, values, policy);
  const totalBand = total != null ? bandOf(total) : null;
  const scoreText = (n: number | null, big = false) => (
    <strong style={{ textAlign: 'right', fontSize: big ? 18 : 15, color: n == null ? p.muted : bandOf(n).color, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{pct(n)}</strong>
  );
  // The weight sits with the name it belongs to; the right-hand column is only scores, so they line up.
  const weight = (w: number, ofTotal: boolean) => (
    <span style={{ marginLeft: 8, padding: '1px 6px', borderRadius: 6, background: p.bg, border: `1px solid ${p.border}`, fontSize: 12, fontWeight: 600, color: p.muted, whiteSpace: 'nowrap' }}>
      {w}%{ofTotal ? ' of total' : ''}
    </span>
  );
  const row: React.CSSProperties = { display: 'grid', gridTemplateColumns: `1fr ${SCORE_COL}px`, alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: `1px solid ${p.border}` };
  return (
    <section aria-label="Marks" style={{ ...card(p), padding: 0, overflow: 'hidden' }}>
      {/* Hover feedback: the row under the pointer is highlighted, so a name is easy to follow across to its score. */}
      <style>{`.kc-mark-row{transition:background .12s}.kc-mark-row:hover{background:${p.bg}}.kc-mark-sec{background:${p.accentSoft}}.kc-mark-sec:hover{background:${MARK_SECTION_HOVER}}`}</style>
      <div aria-hidden style={{ ...row, borderTop: 'none', padding: '8px 16px', fontSize: 12, fontWeight: 700, color: p.muted }}>
        <span>Section / criterion</span><span style={{ textAlign: 'right' }}>Score</span>
      </div>
      {sections.map((s, si) => (
        <div key={s.id}>
          <div className="kc-mark-sec" style={row}>
            <span style={{ minWidth: 0, fontSize: 14, fontWeight: 700, color: p.text }}>{si + 1}. {s.name}{weight(s.weight, true)}</span>
            {scoreText(sectionScore(s, values, policy))}
          </div>
          {s.criteria.map((c, ci) => (
            <MarksCriterionRow key={c.id} c={c} number={criterionNumber(si, ci)} weightTag={weight(c.weight, false)}
              score={scoreText(criterionScore(c, values, policy))} values={values} notes={notes} palette={p} rowStyle={row} detailHref={detailHref?.(c.id)} />
          ))}
        </div>
      ))}
      <div style={{ ...row, borderTop: `2px solid ${p.border}` }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: p.text }}>
          Total <span style={{ fontSize: 13, fontWeight: 500, color: p.muted }}>out of 100</span>
          {totalBand && <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', background: totalBand.bg, color: totalBand.color }}>{totalBand.label}</span>}
        </span>
        {scoreText(total, true)}
      </div>
    </section>
  );
}
