import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faRotateRight, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import { acceptPosterDraft, discardPosterDraft, drawPosterDraft, fetchPosterAiStatus, type SopTemplate } from '../../../api/sop-templates.js';
import { useToast } from '../../../components/common/Toast.js';
import type { PosterView } from './posterView.js';

// Guide authors' poster controls. "Make poster with AI" draws a new poster
// (once — it's saved and reused); the new one waits as a draft to be checked
// word by word, then "Use this poster" saves it, or "Try again" / "Discard".

const C = { text: '#0f172a', sub: '#334155', muted: '#64748b', border: '#e2e8f0', primary: '#5a67d8', amberBg: '#fffbeb', amberBorder: '#fde68a', amberText: '#92400e', red: '#b91c1c' };

interface Props {
  template: SopTemplate;
  view: PosterView;
  outdated: boolean;
}

export default function PosterAiControls({ template, view, outdated }: Props) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const status = useQuery({ queryKey: ['guide-poster-ai-status'], queryFn: fetchPosterAiStatus });
  const [busy, setBusy] = useState<null | 'draw' | 'accept' | 'discard'>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const run = async (kind: 'draw' | 'accept' | 'discard', work: () => Promise<unknown>, done?: string) => {
    setBusy(kind); setProblem(null);
    try {
      await work();
      await qc.invalidateQueries({ queryKey: ['sop-templates'] });
      if (done) showToast(done);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(null);
    }
  };
  const draw = () => run('draw', () => drawPosterDraft(template.id));
  const canDraw = !!status.data?.available && !busy;

  if (view === 'draft') {
    return (
      <div role="region" aria-label="New poster to check" style={{ ...s.bar, background: C.amberBg, borderColor: C.amberBorder }}>
        <p style={{ margin: 0, fontSize: 13, color: C.amberText, lineHeight: 1.5, flex: '1 1 260px' }}>
          <strong>Check every word before using it</strong> — AI can misspell or skip a step. It replaces the current poster only when you use it.
        </p>
        <div style={s.actions}>
          <button type="button" onClick={() => run('discard', () => discardPosterDraft(template.id))} disabled={!!busy} style={s.secondary}>
            {busy === 'discard' ? 'Discarding…' : 'Discard'}
          </button>
          <button type="button" onClick={draw} disabled={!canDraw} style={{ ...s.secondary, opacity: canDraw ? 1 : 0.55, cursor: canDraw ? 'pointer' : 'default' }}>
            <FontAwesomeIcon icon={faRotateRight} style={{ marginRight: 6 }} />{busy === 'draw' ? 'Drawing…' : 'Try again'}
          </button>
          <button type="button" onClick={() => run('accept', () => acceptPosterDraft(template.id), 'Poster saved')} disabled={!!busy} style={s.primary}>
            <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />{busy === 'accept' ? 'Saving…' : 'Use this poster'}
          </button>
        </div>
        {busy === 'draw' && <DrawingNote />}
        {problem && <p role="alert" style={s.problem}>{problem}</p>}
      </div>
    );
  }

  return (
    <div style={s.bar}>
      <p style={{ margin: 0, fontSize: 13, color: C.sub, lineHeight: 1.5, flex: '1 1 260px' }}>
        {view === 'ai'
          ? (outdated
            ? <>Drawn for version {template.posterVersion} — the guide is now version {template.currentVersion}, so its steps may have changed.</>
            : <>Drawn with AI{template.posterMadeAt ? ` on ${new Date(template.posterMadeAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}. It’s saved — opening it doesn’t redraw it.</>)
          : 'This is the simple poster. Make one with AI — drawn once, then saved for everyone.'}
        {status.data && !status.data.available && <span style={{ display: 'block', color: C.muted }}>{status.data.reason}</span>}
      </p>
      <button type="button" onClick={draw} disabled={!canDraw} title={status.data?.reason ?? undefined}
        style={{ ...(view === 'ai' && !outdated ? s.secondary : s.primary), opacity: canDraw ? 1 : 0.55, cursor: canDraw ? 'pointer' : 'default' }}>
        <FontAwesomeIcon icon={faWandMagicSparkles} style={{ marginRight: 6 }} />
        {busy === 'draw' ? 'Drawing…' : view === 'ai' ? 'Make a new poster' : 'Make poster with AI'}
      </button>
      {busy === 'draw' && <DrawingNote />}
      {problem && <p role="alert" style={s.problem}>{problem}</p>}
    </div>
  );
}

function DrawingNote() {
  return <p role="status" style={{ margin: 0, width: '100%', fontSize: 12.5, color: C.muted }}>Drawing the poster — this can take up to a minute. Keep this page open.</p>;
}

const s: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', marginBottom: 16,
    background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10,
  },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  problem: { margin: 0, width: '100%', fontSize: 13, color: C.red },
  primary: {
    display: 'inline-flex', alignItems: 'center', minHeight: 36, padding: '0 16px', borderRadius: 8, border: 'none',
    background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
  },
  secondary: {
    display: 'inline-flex', alignItems: 'center', minHeight: 36, padding: '0 14px', borderRadius: 8, border: `1px solid ${C.border}`,
    background: '#fff', color: C.sub, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
  },
};
