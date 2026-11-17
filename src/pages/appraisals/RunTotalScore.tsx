import type { Band } from './scoreBands.js';
import type { RunPalette } from './runTheme.js';

const RING = 88;
const STROKE = 8;
const RADIUS = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface Props {
  total: number | null;
  band: Band | null;
  /** While scoring: how much is scored. */
  progress: { done: number; count: number } | null;
  /** What's stopping Submit, shown in red (e.g. a score that doesn't fit). */
  problem: string | null;
  palette: RunPalette;
}

/**
 * The total at a glance: a ring filled to the score in its band's colour with
 * the number inside, the band's name beside it, and — while scoring — how much
 * is left to score.
 */
export default function RunTotalScore({ total, band, progress, problem, palette: p }: Props) {
  const shown = total == null ? null : Math.round(total);
  const colour = band?.color ?? p.muted;
  const left = progress ? progress.count - progress.done : 0;
  const complete = !!progress && progress.count > 0 && left === 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0, minWidth: 0 }}>
      <div style={{ position: 'relative', width: RING, height: RING, flexShrink: 0 }}
        role="img" aria-label={shown == null ? 'Total score: not scored yet' : `Total score ${shown} out of 100${band ? `, ${band.label}` : ''}`}>
        <svg width={RING} height={RING} aria-hidden style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={RING / 2} cy={RING / 2} r={RADIUS} fill="none" stroke={p.border} strokeWidth={STROKE} />
          {shown != null && (
            <circle className="kc-ring" cx={RING / 2} cy={RING / 2} r={RADIUS} fill="none" stroke={colour} strokeWidth={STROKE} strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * (1 - Math.min(100, Math.max(0, shown)) / 100)} />
          )}
        </svg>
        <div aria-hidden style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: colour, fontVariantNumeric: 'tabular-nums' }}>{shown ?? '—'}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: p.muted, marginTop: 2 }}>/ 100</span>
        </div>
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: p.muted }}>Total score</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: band ? band.color : p.muted, marginTop: 2, lineHeight: 1.25 }}>
          {band ? band.label : 'Not scored yet'}
        </div>
        {progress && (
          <div id="submit-blocker" style={{ marginTop: 8, minWidth: 160 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: complete ? p.green : p.sub, fontVariantNumeric: 'tabular-nums' }}>
              {progress.done} of {progress.count} scored{!complete && left > 0 ? ` · ${left} left` : ''}
            </div>
            <div aria-hidden style={{ height: 4, marginTop: 4, background: p.border, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${progress.count ? Math.round((progress.done / progress.count) * 100) : 0}%`, height: '100%', background: complete ? p.green : p.accent, borderRadius: 2 }} />
            </div>
          </div>
        )}
        {problem && <div style={{ fontSize: 12, color: p.red, marginTop: 4 }}>{problem}</div>}
      </div>
      {/* The ring eases to a new score — skipped for people who prefer less motion. */}
      <style>{'.kc-ring{transition:stroke-dashoffset .4s ease}@media (prefers-reduced-motion: reduce){.kc-ring{transition:none}}'}</style>
    </div>
  );
}

const MINI = 40;
const MINI_STROKE = 4;
const MINI_RADIUS = (MINI - MINI_STROKE) / 2;
const MINI_CIRCUMFERENCE = 2 * Math.PI * MINI_RADIUS;

/** The same ring, small — for the compact score bar shown while scrolling. */
export function MiniScoreRing({ total, band, palette: p }: { total: number | null; band: Band | null; palette: RunPalette }) {
  const shown = total == null ? null : Math.round(total);
  const colour = band?.color ?? p.muted;
  return (
    <div role="img" aria-label={shown == null ? 'Total score: not scored yet' : `Total score ${shown} out of 100${band ? `, ${band.label}` : ''}`}
      style={{ position: 'relative', width: MINI, height: MINI, flexShrink: 0 }}>
      <svg width={MINI} height={MINI} aria-hidden style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={MINI / 2} cy={MINI / 2} r={MINI_RADIUS} fill="none" stroke={p.border} strokeWidth={MINI_STROKE} />
        {shown != null && (
          <circle className="kc-ring" cx={MINI / 2} cy={MINI / 2} r={MINI_RADIUS} fill="none" stroke={colour} strokeWidth={MINI_STROKE} strokeLinecap="round"
            strokeDasharray={MINI_CIRCUMFERENCE} strokeDashoffset={MINI_CIRCUMFERENCE * (1 - Math.min(100, Math.max(0, shown)) / 100)} />
        )}
      </svg>
      <span aria-hidden style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: colour, fontVariantNumeric: 'tabular-nums' }}>
        {shown ?? '—'}
      </span>
    </div>
  );
}
