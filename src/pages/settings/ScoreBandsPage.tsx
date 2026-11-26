import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faPlus, faStar, faTrash } from '@fortawesome/free-solid-svg-icons';
import { fetchSettings, patchSetting } from '../../api/settings.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.js';
import SettingsNote from './SettingsNote.js';
import {
  BAND_TONES, DEFAULT_SCORE_BANDS, MAX_BANDS, MAX_LABEL_LENGTH, MIN_BANDS, SCORE_BANDS_KEY, TONE_KEYS,
  BAND_TIER_NAMES, bandFor, bandsFrom, bandsProblem, fromDrafts, scaleSegments, toDrafts, type BandDraft, type BandTone,
} from '../appraisals/scoreBands.js';

const C = { text: '#0f172a', sub: '#334155', muted: '#64748b', border: '#e2e8f0', borderStrong: '#cbd5e1', accent: '#5a67d8', red: '#b91c1c', green: '#047857', soft: '#f8fafc' };
const SAVED_NOTE_MS = 2000;
const SCALE_HEIGHT = 12;

/**
 * Settings → Performance Management → Score bands: what appraisal scores are
 * called and how they're coloured (e.g. 80+ Outstanding). The scale at the top
 * shows the whole 0–100 range as it's edited; bands run highest first and the
 * last one takes everything below the others.
 */
export default function ScoreBandsPage() {
  const { isMobile } = useIsMobile();
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  const saved = bandsFrom((data as Record<string, unknown> | undefined)?.[SCORE_BANDS_KEY]);
  const [drafts, setDrafts] = useState<BandDraft[] | null>(null);
  /** The band whose colour palette is open. */
  const [picking, setPicking] = useState<number | null>(null);
  const [savedNote, setSavedNote] = useState(false);
  useEffect(() => { if (data && !drafts) setDrafts(toDrafts(saved)); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!savedNote) return;
    const t = setTimeout(() => setSavedNote(false), SAVED_NOTE_MS);
    return () => clearTimeout(t);
  }, [savedNote]);

  const save = useMutation({
    mutationFn: (d: BandDraft[]) => patchSetting(SCORE_BANDS_KEY, fromDrafts(d) as unknown as Record<string, unknown>[]),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['settings'] }); setSavedNote(true); },
  });

  if (isPending || !drafts) return <div className="m-pad"><h1>Score bands</h1><LoadingSpinner /></div>;

  const problem = bandsProblem(drafts);
  const dirty = JSON.stringify(drafts) !== JSON.stringify(toDrafts(saved));
  const isDefault = JSON.stringify(drafts) === JSON.stringify(toDrafts(DEFAULT_SCORE_BANDS));
  const replace = (next: BandDraft[]) => { setSavedNote(false); setPicking(null); setDrafts(next); };
  const edit = (i: number, patch: Partial<BandDraft>) => { setSavedNote(false); setDrafts(ds => ds!.map((d, j) => (j === i ? { ...d, ...patch } : d))); };
  // A new band goes just above the lowest one; its lowest score is picked after.
  const add = () => replace([...drafts.slice(0, -1), { label: '', min: '', tone: unusedTone(drafts) }, drafts[drafts.length - 1]]);
  const canAdd = drafts.length < MAX_BANDS;

  return (
    <div className="m-pad">
      <h1>Score bands</h1>
      <SettingsNote>The top band marks a <strong>High Performer</strong> and the next band a <strong>Performer</strong>, judged on each person’s latest appraisal. Changing them changes Pay tiers, benefits and the gold ring on Home.</SettingsNote>
      <section aria-label="Bands" style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12 }}>
        <ScalePreview drafts={drafts} />
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {drafts.map((d, i) => (
            <BandRow key={i} draft={d} index={i} drafts={drafts} mobile={isMobile} picking={picking === i}
              onPickToggle={() => setPicking(p => (p === i ? null : i))}
              onChange={patch => edit(i, patch)}
              onRemove={drafts.length > MIN_BANDS && i < drafts.length - 1 ? () => replace(drafts.filter((_, j) => j !== i)) : null} />
          ))}
        </ol>
        <div style={{ padding: '8px 16px 12px', borderTop: `1px solid ${C.border}` }}>
          <button type="button" onClick={add} disabled={!canAdd} style={linkBtn(canAdd, isMobile)} title={canAdd ? undefined : `At most ${MAX_BANDS} bands`}>
            <FontAwesomeIcon icon={faPlus} /> Add band
          </button>
        </div>
      </section>

      <ScoreTester drafts={drafts} mobile={isMobile} />

      {/* Reset on its own at the left; Discard and Save together at the right, Save last. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => replace(toDrafts(DEFAULT_SCORE_BANDS))} disabled={isDefault} style={linkBtn(!isDefault, isMobile)}>Reset to defaults</button>
        <span style={{ flex: 1 }} />
        {problem && dirty && <span role="status" style={{ fontSize: 13, color: C.red }}>{problem}</span>}
        {save.error && <span role="alert" style={{ fontSize: 13, color: C.red }}>{(save.error as Error).message}</span>}
        {savedNote && <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: C.green }}><FontAwesomeIcon icon={faCheck} /> Saved</span>}
        <button type="button" onClick={() => replace(toDrafts(saved))} disabled={!dirty} style={secondaryBtn(dirty, isMobile)}>Discard</button>
        <button type="button" onClick={() => save.mutate(drafts)} disabled={!dirty || !!problem || save.isPending}
          title={problem ?? (!dirty ? 'No changes to save' : undefined)} style={primaryBtn(dirty && !problem && !save.isPending, isMobile)}>
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

/** The 0–100 scale the bands make, lowest on the left — redrawn as the bands are edited. */
function ScalePreview({ drafts }: { drafts: BandDraft[] }) {
  const segments = scaleSegments(drafts);
  return (
    <div style={{ padding: 16, borderBottom: `1px solid ${C.border}`, background: C.soft, borderRadius: '12px 12px 0 0' }}>
      {segments ? (
        <>
          <div role="img" aria-label={segments.map(s => `${s.label}: ${s.from} to ${s.to}`).join(', ')}
            style={{ display: 'flex', height: SCALE_HEIGHT, borderRadius: 999, overflow: 'hidden', gap: 2 }}>
            {segments.map(s => <span key={s.label} style={{ flex: s.to - s.from, background: BAND_TONES[s.tone].color }} />)}
          </div>
          <div aria-hidden style={{ display: 'flex', marginTop: 6 }}>
            {segments.map((s, i) => (
              <div key={s.label} style={{ flex: s.to - s.from, minWidth: 0, display: 'flex', justifyContent: 'space-between', gap: 4, fontSize: 12 }}>
                <span style={{ color: C.muted }}>{s.from}</span>
                <span style={{ fontWeight: 700, color: BAND_TONES[s.tone].color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                <span style={{ color: C.muted }}>{i === segments.length - 1 ? 100 : ''}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: C.muted }}>The scale shows here once every band has a name and a lowest score.</p>
      )}
    </div>
  );
}

/** One band: its colour, name and range in plain words ("From 60 to under 80"). */
function BandRow({ draft: d, index: i, drafts, mobile, picking, onPickToggle, onChange, onRemove }: {
  draft: BandDraft; index: number; drafts: BandDraft[]; mobile: boolean; picking: boolean;
  onPickToggle: () => void; onChange: (patch: Partial<BandDraft>) => void; onRemove: (() => void) | null;
}) {
  const lowest = i === drafts.length - 1;
  const above = i > 0 ? drafts[i - 1].min.trim() : '';
  const tone = BAND_TONES[d.tone];
  const tap = mobile ? 44 : 32;
  return (
    <li style={{ padding: '12px 16px', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: mobile ? 'wrap' : 'nowrap' }}>
        <button type="button" onClick={onPickToggle} aria-expanded={picking} aria-label={`Colour: ${tone.name}. Change it`} title="Change colour"
          style={{ width: tap, height: tap, flexShrink: 0, borderRadius: 8, border: `1px solid ${C.border}`, background: tone.bg, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <span aria-hidden style={{ width: 14, height: 14, borderRadius: 999, background: tone.color }} />
        </button>
        <input aria-label={`Band ${i + 1} name`} value={d.label} maxLength={MAX_LABEL_LENGTH} placeholder="Band name, e.g. Outstanding"
          onChange={e => onChange({ label: e.target.value })}
          style={{ ...input(mobile), flex: mobile ? '1 1 160px' : '1 1 auto', fontWeight: 600, color: tone.color }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, fontSize: 14, color: C.sub }}>
          {lowest ? (
            <span style={{ color: C.muted }}>{above ? `Below ${above}` : 'Everything lower'}</span>
          ) : (
            <>
              From
              <input aria-label={`Band ${i + 1} lowest score`} type="number" inputMode="decimal" min={0} max={100} value={d.min} placeholder="0–100"
                onChange={e => onChange({ min: e.target.value })} style={{ ...input(mobile), width: 80, textAlign: 'center' }} />
              <span style={{ whiteSpace: 'nowrap' }}>{i === 0 ? 'to 100' : `to under ${above || '…'}`}</span>
            </>
          )}
        </div>
        {i < BAND_TIER_NAMES.length && <TierTag name={BAND_TIER_NAMES[i]} />}
        {onRemove ? (
          <button type="button" onClick={onRemove} aria-label={`Remove ${d.label.trim() || `band ${i + 1}`}`} title="Remove band"
            style={{ width: tap, height: tap, flexShrink: 0, border: 'none', background: 'none', color: C.muted, cursor: 'pointer', borderRadius: 8 }}>
            <FontAwesomeIcon icon={faTrash} />
          </button>
        ) : <span aria-hidden style={{ width: tap, flexShrink: 0 }} />}
      </div>
      {picking && (
        <div role="radiogroup" aria-label={`Band ${i + 1} colour`} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingLeft: tap + 12 }}>
          {TONE_KEYS.map(k => <Swatch key={k} tone={k} on={k === d.tone} size={tap} onPick={() => { onChange({ tone: k }); onPickToggle(); }} />)}
        </div>
      )}
    </li>
  );
}

/** What this band decides — "High Performer" (top) or "Performer" (next). */
function TierTag({ name }: { name: string }) {
  return (
    <span title={`Scores in this band count as ${name}`} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, padding: '4px 10px', borderRadius: 999,
      background: C.soft, border: `1px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.sub, whiteSpace: 'nowrap',
    }}>
      <FontAwesomeIcon icon={faStar} style={{ fontSize: 10, color: '#b45309' }} />
      {name}
    </span>
  );
}

function Swatch({ tone, on, size, onPick }: { tone: BandTone; on: boolean; size: number; onPick: () => void }) {
  const t = BAND_TONES[tone];
  return (
    <button type="button" role="radio" aria-checked={on} aria-label={t.name} title={t.name} onClick={onPick}
      style={{ width: size, height: size, padding: 0, borderRadius: 8, cursor: 'pointer', background: t.bg, border: `2px solid ${on ? t.color : 'transparent'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {on ? <FontAwesomeIcon icon={faCheck} style={{ color: t.color, fontSize: 12 }} /> : <span aria-hidden style={{ width: 12, height: 12, borderRadius: 999, background: t.color }} />}
    </button>
  );
}

/** Type a score, see the band it gets — judged on the whole number, as everywhere else. */
function ScoreTester({ drafts, mobile }: { drafts: BandDraft[]; mobile: boolean }) {
  const [score, setScore] = useState('72');
  const n = Number(score);
  const valid = score.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 100 && !bandsProblem(drafts);
  const band = valid ? bandFor(n, fromDrafts(drafts)) : null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap', fontSize: 14, color: C.sub }}>
      <label htmlFor="band-try">Try a score</label>
      <input id="band-try" type="number" inputMode="decimal" min={0} max={100} value={score} onChange={e => setScore(e.target.value)}
        style={{ ...input(mobile), width: 80, textAlign: 'center' }} />
      {band
        ? <span>shows as <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 13, fontWeight: 700, background: band.bg, color: band.color }}>{band.label}</span></span>
        : <span style={{ color: C.muted }}>{score.trim() === '' ? '' : 'Enter 0–100 (and fix the bands above, if needed).'}</span>}
    </div>
  );
}

const unusedTone = (drafts: BandDraft[]): BandTone => TONE_KEYS.find(k => !drafts.some(d => d.tone === k)) ?? 'slate';

const input = (mobile: boolean): React.CSSProperties => ({
  boxSizing: 'border-box', padding: '8px 12px', minHeight: mobile ? 44 : 36, fontSize: mobile ? 16 : 14, fontFamily: 'inherit',
  color: C.text, border: `1px solid ${C.borderStrong}`, borderRadius: 8, background: '#fff', minWidth: 0,
});
const linkBtn = (enabled: boolean, mobile: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: mobile ? 44 : 32, padding: '0 4px', border: 'none', background: 'none', fontFamily: 'inherit',
  fontSize: 14, fontWeight: 600, color: enabled ? C.accent : C.muted, cursor: enabled ? 'pointer' : 'default',
});
const primaryBtn = (enabled: boolean, mobile: boolean): React.CSSProperties => ({
  minHeight: mobile ? 44 : 36, padding: '0 18px', borderRadius: 8, border: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
  background: enabled ? C.accent : '#cbd5e1', color: '#fff', cursor: enabled ? 'pointer' : 'default',
});
const secondaryBtn = (enabled: boolean, mobile: boolean): React.CSSProperties => ({
  minHeight: mobile ? 44 : 36, padding: '0 14px', borderRadius: 8, border: `1px solid ${C.borderStrong}`, background: '#fff', fontFamily: 'inherit',
  fontSize: 14, fontWeight: 600, color: enabled ? C.sub : C.muted, cursor: enabled ? 'pointer' : 'default',
});
