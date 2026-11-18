import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
import type { MissingPolicy, TemplateSection } from '../../api/appraisal-templates.js';
import { useScoreBand } from './useScoreBand.js';
import RunTotalScore, { MiniScoreRing } from './RunTotalScore.js';
import { FIX_RED_SCORES, allInputs, criterionItems, progressOf, submitBlocker, type Values } from './appraisalRun.js';
import { criterionScore, sectionScore, totalScore } from './liveScore.js';
import type { Band } from './scoreBands.js';
import { card, type RunPalette } from './runTheme.js';

interface Props {
  sections: TemplateSection[];
  values: Values;
  policy: MissingPolicy;
  /** The criterion open below (index into criterionItems) — its section's tile is highlighted. */
  current: number;
  onJump: (i: number) => void;
  /** While scoring: progress and what still blocks Submit are shown too. */
  editing: boolean;
  palette: RunPalette;
  mobile: boolean;
}

/** Gap between the top of the screen and the slim bar. */
const BAR_TOP = 8;
const pct = (n: number | null) => (n == null ? '—' : `${Math.round(n)}`);

/**
 * The score card on top of the form: the total (a ring in its band's colour)
 * with how much is scored, then a tile per section — its weight, score and a
 * bar. The tiles are the section tabs. Everything updates as marks are given
 * (the server's rules, liveScore).
 *
 * The card itself scrolls with the page. Once it has scrolled out of sight, a
 * separate slim bar (total, progress, sections) shows at the top of the screen,
 * and goes again when the card comes back.
 */
export default function RunScoreSummary({ sections, values, policy, current, onJump, editing, palette: p, mobile }: Props) {
  const bandOf = useScoreBand();
  const total = totalScore(sections, values, policy);
  const band = total != null ? bandOf(total) : null;
  const { done, total: count } = progressOf(allInputs(sections), values);
  const blocker = editing ? submitBlocker(sections, policy, values) : null;
  const items = criterionItems(sections);
  const openItem = items[Math.min(current, items.length - 1)];
  const openSection = openItem?.si ?? 0;
  // The criterion being scored and its mark — its own line is under the slim bar once scrolled, so the bar shows it.
  const openScore = openItem ? criterionScore(openItem.c, values, policy) : null;
  const passed = useScrolledPast();
  // The slim bar can be put away (to a small "Show score" button) and brought back.
  const [barHidden, setBarHidden] = useState(false);
  const jumpToSection = (si: number) => onJump(items.findIndex(x => x.si === si));
  const summary = { total, band, progress: editing ? { done, count } : null, problem: blocker === FIX_RED_SCORES ? blocker : null };

  return (
    <>
      {mobile && editing ? (
        // Scoring on a phone: the score is a compact row and the sections are chips — the marking starts on the first screen.
        <section id="score-card-body" aria-label="Score" style={{ ...card(p), padding: 12 }}>
          <SlimBar {...summary} palette={p} flat />
          <ol aria-label="Sections — pick one to score it" style={{ listStyle: 'none', margin: '10px 0 0', padding: '0 0 2px', display: 'flex', gap: 6, overflowX: 'auto' }}>
            {sections.map((s, si) => {
              const score = sectionScore(s, values, policy);
              const on = si === openSection;
              return (
                <li key={s.id} style={{ flexShrink: 0 }}>
                  <button type="button" onClick={() => jumpToSection(si)} aria-current={on ? 'step' : undefined}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: on ? 700 : 600, whiteSpace: 'nowrap', border: `1px solid ${on ? p.accent : p.border}`, background: on ? p.accentSoft : p.card, color: on ? p.accent : p.sub }}>
                    {si + 1}. {s.name}
                    <span style={{ fontWeight: 700, color: score == null ? p.muted : bandOf(score).color, fontVariantNumeric: 'tabular-nums' }}>{pct(score)}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: p.muted }}>{s.weight}%</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ) : (
        <section id="score-card-body" aria-label="Score" style={{ ...card(p), display: 'flex', gap: mobile ? 16 : 24, flexDirection: mobile ? 'column' : 'row', alignItems: mobile ? 'stretch' : 'center' }}>
          <div style={{ flexShrink: 0, minWidth: mobile ? 0 : 280 }}>
            <RunTotalScore {...summary} palette={p} />
          </div>
          {/* The section tiles are also the section tabs: pick one to score that section. */}
          <ol aria-label="Sections — pick one to score it" style={{ listStyle: 'none', margin: 0, padding: 0, flex: 1, minWidth: 0, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {sections.map((s, si) => {
              const score = sectionScore(s, values, policy);
              const on = si === openSection;
              return (
                <li key={s.id}>
                  <button type="button" onClick={() => jumpToSection(si)} aria-current={on ? 'step' : undefined}
                    style={{
                      width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', minHeight: mobile ? 44 : 32,
                      border: `1px solid ${on ? p.accent : p.border}`, background: on ? p.accentSoft : p.card,
                    }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: p.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{si + 1}. {s.name}</span>
                      <strong style={{ fontSize: 15, color: score == null ? p.muted : bandOf(score).color, fontVariantNumeric: 'tabular-nums' }}>{pct(score)}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: p.muted, marginTop: 2 }}>{s.weight}% of total</div>
                    <div aria-hidden style={{ height: 4, marginTop: 6, background: p.border, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${score ?? 0}%`, height: '100%', background: score == null ? 'transparent' : bandOf(score).color, transition: 'width 0.3s ease' }} />
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Where the card ends: once this has scrolled up past the (zero-height, sticky) pin below, the card is out of sight. */}
      <div ref={passed.mark} aria-hidden />
      <div ref={passed.pin} aria-hidden={!passed.past} style={{ position: 'sticky', top: 0, height: 0, zIndex: 20 }}>
        {passed.past && barHidden && (
          <div className="kc-slim-bar" style={{ position: 'absolute', right: 0, top: BAR_TOP }}>
            <button type="button" onClick={() => setBarHidden(false)} aria-label="Show the score bar"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: mobile ? 44 : 36, padding: '4px 12px 4px 4px', borderRadius: 999, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: p.sub, background: p.card, border: `1px solid ${p.border}`, boxShadow: '0 4px 16px rgba(15,23,42,0.12)',
              }}>
              <MiniScoreRing total={total} band={band} palette={p} /> Show score <FontAwesomeIcon icon={faChevronDown} />
            </button>
          </div>
        )}
        {passed.past && !barHidden && (
          <div className="kc-slim-bar" style={{ position: 'absolute', left: 0, right: 0, top: BAR_TOP }}>
            <SlimBar {...summary} palette={p} shadow after={
              <button type="button" onClick={() => setBarHidden(true)} aria-label="Hide the score bar" title="Hide"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, minHeight: mobile ? 44 : 32, padding: '0 10px', borderRadius: 8,
                  border: `1px solid ${p.border}`, background: p.card, color: p.sub, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                }}>
                Hide <FontAwesomeIcon icon={faChevronUp} />
              </button>
            } end={<>
              {openItem && (
                <div aria-label={`Now scoring ${openItem.number} ${openItem.c.name}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, padding: '0 12px', marginLeft: 4, borderLeft: `1px solid ${p.border}` }}>
                  <span style={{ fontSize: 13, color: p.muted, whiteSpace: 'nowrap' }}>{openItem.number}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: p.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: mobile ? 120 : 220 }}>{openItem.c.name}</span>
                  <strong style={{ fontSize: 14, color: openScore == null ? p.muted : bandOf(openScore).color, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {openScore == null ? '—' : `${Math.round(openScore)} / 100`}
                  </strong>
                </div>
              )}
              {!mobile && (
              <ol aria-label="Sections" style={{ listStyle: 'none', margin: '0 0 0 8px', padding: 0, display: 'flex', gap: 6, minWidth: 0, overflowX: 'auto' }}>
                {sections.map((s, si) => {
                  const score = sectionScore(s, values, policy);
                  const on = si === openSection;
                  return (
                    <li key={s.id}>
                      <button type="button" onClick={() => jumpToSection(si)} aria-current={on ? 'step' : undefined}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 32, padding: '0 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                          border: `1px solid ${on ? p.accent : p.border}`, background: on ? p.accentSoft : p.card, whiteSpace: 'nowrap',
                        }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: p.text }}>{si + 1}. {s.name}</span>
                        <strong style={{ fontSize: 13, color: score == null ? p.muted : bandOf(score).color, fontVariantNumeric: 'tabular-nums' }}>{pct(score)}</strong>
                      </button>
                    </li>
                  );
                })}
              </ol>
              )}
            </>} />
          </div>
        )}
      </div>
      <style>{'.kc-slim-bar{animation:kc-slim-in .15s ease-out}@keyframes kc-slim-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion: reduce){.kc-slim-bar{animation:none}}'}</style>
    </>
  );
}

/** One line: small ring, band, progress — plus whatever goes on the end (the sections, or "Show sections"). */
function SlimBar({ total, band, progress, problem, palette: p, end, after, shadow, flat }: {
  total: number | null; band: Band | null; progress: { done: number; count: number } | null; problem: string | null;
  /** After the progress (the sections); `after` goes on the far right (Hide). */
  palette: RunPalette; end?: React.ReactNode; after?: React.ReactNode; shadow?: boolean;
  /** Inside another card (the compact phone card): no card of its own, with a progress bar. */
  flat?: boolean;
}) {
  const left = progress ? progress.count - progress.done : 0;
  const complete = !!progress && progress.count > 0 && left === 0;
  return (
    <section aria-label="Score" style={flat
      ? { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }
      : { ...card(p), marginBottom: shadow ? 0 : card(p).marginBottom, display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px', boxShadow: shadow ? '0 4px 16px rgba(15,23,42,0.12)' : undefined }}>
      <MiniScoreRing total={total} band={band} palette={p} />
      <div style={{ minWidth: 0, flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: band?.color ?? p.muted, lineHeight: 1.2 }}>{band?.label ?? 'Not scored yet'}</div>
        {progress && (
          <div style={{ fontSize: 12, fontWeight: 600, color: complete ? p.green : p.muted, fontVariantNumeric: 'tabular-nums' }}>
            {progress.done} of {progress.count} scored{left > 0 ? ` · ${left} left` : ''}
          </div>
        )}
      </div>
      {problem && <span style={{ fontSize: 12, color: p.red }}>{problem}</span>}
      {end}
      <span style={{ flex: 1 }} />
      {after}
      {flat && progress && (
        <div aria-hidden style={{ flexBasis: '100%', height: 4, background: p.border, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${progress.count ? Math.round((progress.done / progress.count) * 100) : 0}%`, height: '100%', background: complete ? p.green : p.accent, borderRadius: 2 }} />
        </div>
      )}
    </section>
  );
}

/**
 * Has the page scrolled past the score card? `mark` goes right after the card
 * and `pin` (sticky, zero height) right after that: they sit together until
 * the page scrolls, then the pin stays at the top while the mark moves up.
 * Checked on every scroll of the page or any panel, so it works whatever scrolls.
 */
function useScrolledPast() {
  const mark = useRef<HTMLDivElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const [past, setPast] = useState(false);
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      if (!mark.current || !pin.current) return;
      setPast(pin.current.getBoundingClientRect().top - mark.current.getBoundingClientRect().top > 1);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(check); };
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    check();
    return () => { document.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onScroll); cancelAnimationFrame(frame); };
  }, []);
  return { mark, pin, past };
}
