import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import { rewriteMessage } from '../../api/ai.js';

// Message templates → "Rewrite with AI": say how the message should change
// ("more professional", "more casual", "shorter"); the AI suggests a rewrite
// in the same language with every {{placeholder}} kept. The suggestion shows
// beside the message to compare; nothing changes until "Use this" — and
// nothing is saved until Save Template.

const C = { text: '#0f172a', sub: '#334155', muted: '#64748b', border: '#e2e8f0', primary: '#5a67d8', red: '#b91c1c' };
const MAX_REQUEST = 300;

export interface MessageRewrite {
  request: string;
  setRequest: (v: string) => void;
  busy: boolean;
  problem: string | null;
  /** The AI's suggestion, or null when there's none to show. */
  suggestion: string | null;
  rewrite: () => void;
  discard: () => void;
  /** Take the suggestion (and clear the request). */
  use: () => void;
}

/** The rewrite's state, so the request box and the suggestion can sit in different places. */
export function useMessageRewrite(text: string, onUse: (rewritten: string) => void): MessageRewrite {
  const [request, setRequest] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const rewrite = async () => {
    setBusy(true); setProblem(null); setSuggestion(null);
    try { setSuggestion((await rewriteMessage(text, request.trim())).text); }
    catch (e) { setProblem(e instanceof Error ? e.message : 'Couldn’t rewrite it.'); }
    finally { setBusy(false); }
  };
  return {
    request, setRequest, busy, problem, suggestion,
    rewrite: () => { void rewrite(); },
    discard: () => setSuggestion(null),
    use: () => { if (suggestion !== null) onUse(suggestion); setSuggestion(null); setRequest(''); },
  };
}

/** "How should it change?" + Rewrite — one row above the message, always in view. */
export function RewriteRequest({ text, r }: { text: string; r: MessageRewrite }) {
  const ready = !!text.trim() && !!r.request.trim() && !r.busy;
  return (
    <div style={s.box}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={s.inputWrap}>
          <span style={s.inputIcon} aria-hidden><FontAwesomeIcon icon={faWandMagicSparkles} /></span>
          {/* autoComplete off: the browser shouldn't remember and suggest past requests here. */}
          <input id="tpl-rewrite" aria-label="Rewrite with AI — how should it change?" autoComplete="off" value={r.request} maxLength={MAX_REQUEST} onChange={e => r.setRequest(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && ready) r.rewrite(); }}
            placeholder="Rewrite with AI — e.g. more professional, more casual, shorter" style={s.input} />
        </div>
        <button type="button" onClick={r.rewrite} disabled={!ready} title={!text.trim() ? 'Write the message first' : !r.request.trim() ? 'Say how it should change' : undefined}
          style={{ ...s.primary, opacity: ready ? 1 : 0.55, cursor: ready ? 'pointer' : 'default' }}>
          {r.busy ? 'Rewriting…' : 'Rewrite'}
        </button>
      </div>
      {r.problem && <p role="alert" style={{ margin: '8px 0 0', fontSize: 13, color: C.red }}>{r.problem}</p>}
    </div>
  );
}

/** The suggestion, beside the message — same height — with Use this / Discard. */
export function RewriteSuggestion({ r, height }: { r: MessageRewrite; height: number }) {
  if (r.suggestion === null) return null;
  return (
    <div style={{ ...s.suggestion, minHeight: height }} aria-live="polite" aria-label="AI suggestion">
      <div style={{ fontSize: 12, fontWeight: 600, color: C.primary, marginBottom: 8 }}>
        <FontAwesomeIcon icon={faWandMagicSparkles} /> Suggestion
      </div>
      <div style={{ flex: 1, fontSize: 14, color: C.text, lineHeight: 1.75, whiteSpace: 'pre-wrap', overflowY: 'auto' }}>{r.suggestion}</div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button type="button" onClick={r.discard} style={s.secondary}>Discard</button>
        <button type="button" onClick={r.use} style={s.primary}>Use this</button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  box: { marginBottom: 10 },
  inputWrap: { position: 'relative', flex: '1 1 260px', minWidth: 0 },
  inputIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', color: C.primary, fontSize: 13, pointerEvents: 'none' },
  input: { width: '100%', boxSizing: 'border-box', minHeight: 36, padding: '6px 12px 6px 34px', fontSize: 14, fontFamily: 'inherit', color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff' },
  primary: { minHeight: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' },
  secondary: { minHeight: 36, padding: '0 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.sub, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' },
  suggestion: {
    flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
    padding: '14px 16px', background: '#f8f9ff', border: `1px solid ${C.primary}55`, borderRadius: 10,
  },
};
