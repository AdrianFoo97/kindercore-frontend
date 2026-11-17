import type { AppraisalRun } from '../../api/appraisal-runs.js';
import RunTotalScore from './RunTotalScore.js';
import { shortPeriod } from './RunHeader.js';
import { useScoreBand } from './useScoreBand.js';
import { card, type RunPalette } from './runTheme.js';

/**
 * The staff member reading their own appraisal (teacher app): the score and
 * its band, and what to do if it's waiting for them — then the breakdown, and
 * their appraiser's overall comments (OwnAppraisalComments) after it.
 */
export default function OwnAppraisalSummary({ run, total, palette: p }: { run: AppraisalRun; total: number | null; palette: RunPalette }) {
  const bandOf = useScoreBand();
  const band = total != null ? bandOf(total) : null;
  const toConfirm = run.can.acknowledge;
  return (
    <>
      <section aria-labelledby="own-title" style={card(p)}>
        <header style={{ marginBottom: 16 }}>
          <h1 id="own-title" style={{ margin: 0, fontSize: 20, fontWeight: 700, color: p.text }}>{shortPeriod(run)} Appraisal</h1>
          <div style={{ fontSize: 14, color: p.muted, marginTop: 2 }}>{run.form.name}</div>
        </header>
        <RunTotalScore total={total} band={band} progress={null} problem={null} palette={p} />
        {toConfirm && (
          <div role="status" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: p.accentSoft, color: p.text, fontSize: 14, lineHeight: 1.5 }}>
            Read it through, then tap <strong>I’ve read it</strong> below.
          </div>
        )}
      </section>
      <h2 style={{ margin: '8px 0 8px', fontSize: 15, fontWeight: 700, color: p.text }}>Breakdown</h2>
    </>
  );
}

/** Below the breakdown: their appraiser's overall comments. */
export function OwnAppraisalComments({ comments, palette: p }: { comments: string | null; palette: RunPalette }) {
  return (
    <section aria-labelledby="own-comments" style={card(p)}>
      <h2 id="own-comments" style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: p.text }}>From your appraiser</h2>
      <p style={{ margin: 0, fontSize: 15, color: comments ? p.sub : p.muted, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
        {comments || 'No overall comments.'}
      </p>
    </section>
  );
}
