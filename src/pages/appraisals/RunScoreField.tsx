import { useEffect, useState } from 'react';
import { NOT_APPLICABLE, markLevels, markText, numberTarget, ratingLevels, ratingMax, valueProblem, type ScoreInput } from './appraisalRun.js';
import { TARGET, type RunPalette } from './runTheme.js';

interface Props {
  input: ScoreInput;
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  palette: RunPalette;
  mobile: boolean;
}

/**
 * Where one score is entered: a row of level buttons for a rating, Yes / No,
 * or a number box for a percentage or a count. What's typed is kept as typed;
 * if it doesn't fit, it's flagged in red (and Submit stays disabled).
 */
export default function RunScoreField({ input, value, onChange, readOnly, palette: p, mobile }: Props) {
  if (readOnly) return <ReadOnlyValue input={input} value={value} palette={p} />;
  switch (input.kind) {
    case 'RATING': return <RatingButtons input={input} value={value} onChange={onChange} palette={p} mobile={mobile} />;
    case 'YES_NO':
      return (
        <Choices label={input.name} palette={p} mobile={mobile} value={value} onChange={onChange}
          options={[{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }]} />
      );
    case 'PASS_FAIL':
      // The same three choices as an SOP observation; N/A isn't counted.
      return (
        <Choices label={input.name} palette={p} mobile={mobile} value={value} onChange={onChange}
          options={[{ value: '1', label: 'Pass', tone: PASS_TONE }, { value: '0', label: 'Fail', tone: FAIL_TONE }, { value: NOT_APPLICABLE, label: 'N/A', tone: NA_TONE }]} />
      );
    case 'LEVELS':
      // The form's own levels (each worth a percentage), then N/A — which isn't counted.
      return (
        <Choices label={input.name} palette={p} mobile={mobile} value={value} onChange={onChange}
          options={[...markLevels(input.scaleConfig).map((l, i) => ({ value: String(i), label: l.label, title: `${l.score}%`, tone: levelTone(l.score) })), { value: NOT_APPLICABLE, label: 'N/A', tone: NA_TONE }]} />
      );
    case 'PERCENT':
    case 'NUMBER':
      return <NumberField input={input} value={value} onChange={onChange} palette={p} mobile={mobile} />;
  }
}

/**
 * A percentage or count. What's typed stays in the box and only counts —
 * live scores, progress — once you leave the box or press Enter, so the
 * totals don't jump about digit by digit. A click on the box's up/down
 * arrows is a finished change, so it counts straight away.
 */
function NumberField({ input, value, onChange, palette: p, mobile }: Omit<Props, 'readOnly'>) {
  const [draft, setDraft] = useState(value);
  // A change from outside (Discard changes, a reload) replaces what's in the box.
  useEffect(() => { setDraft(value); }, [value]);
  const commit = () => { if (draft !== value) onChange(draft); };
  const problem = valueProblem(input.kind, input.scaleConfig, draft);
  const id = `score-${input.key}`;
  const target = input.kind === 'NUMBER' ? numberTarget(input.scaleConfig) : null;
      return (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input id={id} type="number" inputMode="decimal" aria-label={input.name} aria-invalid={!!problem}
              aria-describedby={problem ? `${id}-problem` : undefined}
              min={0} max={input.kind === 'PERCENT' ? 100 : undefined} value={draft}
              onChange={e => {
                setDraft(e.target.value);
                // Typing carries an inputType (insertText, deleteContentBackward…); the arrows don't.
                if (!(e.nativeEvent as InputEvent).inputType) onChange(e.target.value);
              }}
              onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
              style={{
                width: 112, boxSizing: 'border-box', padding: '8px 12px', minHeight: mobile ? TARGET.mobile : TARGET.desktop,
                fontSize: mobile ? 16 : 14, fontFamily: 'inherit', color: p.text, background: '#fff', borderRadius: 8, outline: 'none',
                border: `1px solid ${problem ? p.red : p.borderStrong}`,
              }} />
            {input.kind === 'PERCENT' && <span style={{ fontSize: 14, color: p.sub }}>%</span>}
            {target?.target != null && (
              <span style={{ fontSize: 13, color: p.muted }}>Target {target.target} · {target.higherIsBetter ? 'higher' : 'lower'} is better</span>
            )}
          </div>
          {problem && <div id={`${id}-problem`} role="alert" style={{ fontSize: 13, color: p.red, marginTop: 4 }}>{problem}</div>}
        </div>
      );
}

function RatingButtons({ input, value, onChange, palette: p, mobile }: Omit<Props, 'readOnly'>) {
  const max = ratingMax(input.scaleConfig);
  const levels = ratingLevels(input.scaleConfig);
  // Each level's wording shows on hover only (its tooltip), not under the buttons once chosen.
  const options = Array.from({ length: max }, (_, i) => {
    const level = levels.find(l => l.value === i + 1);
    return { value: String(i + 1), label: String(i + 1), title: level ? `${level.label}${level.description ? ` — ${level.description}` : ''}` : undefined };
  });
  return <Choices label={input.name} palette={p} mobile={mobile} value={value} onChange={onChange} options={options} square />;
}

interface ChoicesProps {
  label: string;
  /** `tone`: the chosen button's colours (Pass green, Fail red, N/A grey — as in an SOP observation); default the accent. */
  options: { value: string; label: string; title?: string; tone?: Tone }[];
  value: string;
  onChange: (v: string) => void;
  palette: RunPalette;
  mobile: boolean;
  /** Equal square buttons (rating levels) rather than word buttons. */
  square?: boolean;
}

interface Tone { bg: string; fg: string; border: string }
/** Chosen Pass / Fail / N/A — the SOP observation's colours. */
const PASS_TONE: Tone = { bg: '#ecfdf5', fg: '#047857', border: '#047857' };
const FAIL_TONE: Tone = { bg: '#fef2f2', fg: '#b91c1c', border: '#b91c1c' };
const NA_TONE: Tone = { bg: '#f1f5f9', fg: '#475569', border: '#94a3b8' };
const MID_TONE: Tone = { bg: '#fffbeb', fg: '#b45309', border: '#b45309' };
/** A level's colour from its percentage: full marks green, none red, anything between amber (the label always shows too). */
const levelTone = (score: number): Tone => (score >= 100 ? PASS_TONE : score <= 0 ? FAIL_TONE : MID_TONE);

/** One-of-several buttons; tapping the chosen one again clears it. */
function Choices({ label, options, value, onChange, palette: p, mobile, square }: ChoicesProps) {
  const size = mobile ? TARGET.mobile : 36;
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} title={o.title}
            aria-label={o.title ? `${o.label} — ${o.title}` : o.label}
            onClick={() => onChange(on ? '' : o.value)}
            style={{
              minWidth: size, height: size, padding: square ? 0 : '0 16px', borderRadius: 8, fontFamily: 'inherit',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${on ? (o.tone?.border ?? p.accent) : p.borderStrong}`,
              background: on ? (o.tone?.bg ?? p.accent) : '#fff', color: on ? (o.tone?.fg ?? '#fff') : p.sub,
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** How a score reads once it can't be changed — markText: "4 / 5 · Good", "Yes", "80 / 100", "3 (target 2)". */
function ReadOnlyValue({ input, value, palette: p }: { input: ScoreInput; value: string; palette: RunPalette }) {
  const text = markText(input, value);
  return <span style={{ fontSize: 14, fontWeight: text ? 600 : 400, color: text ? p.text : p.muted }}>{text ?? 'Not scored'}</span>;
}
