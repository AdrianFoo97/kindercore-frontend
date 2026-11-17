// Score bands — what an appraisal score (0–100) is called and how it's
// coloured: e.g. 80+ Outstanding, 60+ Satisfactory, under 60 Needs
// improvement. Set in Settings → Performance Management → Score bands and
// used everywhere a score is shown. Pure logic, no React.

export type BandTone = 'green' | 'teal' | 'blue' | 'violet' | 'amber' | 'orange' | 'red' | 'slate';

/** The colours a band can take — text colours all ≥ 4.5:1 on their background. */
export const BAND_TONES: Record<BandTone, { name: string; bg: string; color: string }> = {
  green: { name: 'Green', bg: '#dcfce7', color: '#15803d' },
  teal: { name: 'Teal', bg: '#ccfbf1', color: '#0f766e' },
  blue: { name: 'Blue', bg: '#dbeafe', color: '#1d4ed8' },
  violet: { name: 'Violet', bg: '#ede9fe', color: '#6d28d9' },
  amber: { name: 'Amber', bg: '#fef3c7', color: '#b45309' },
  orange: { name: 'Orange', bg: '#ffedd5', color: '#c2410c' },
  red: { name: 'Red', bg: '#fee2e2', color: '#991b1b' },
  slate: { name: 'Grey', bg: '#f1f5f9', color: '#475569' },
};
export const TONE_KEYS = Object.keys(BAND_TONES) as BandTone[];

export interface ScoreBand {
  label: string;
  /** Lowest score in this band (0–100). The lowest band always starts at 0. */
  min: number;
  tone: BandTone;
}

export const SCORE_BANDS_KEY = 'appraisal_score_bands';
export const MIN_BANDS = 2;
export const MAX_BANDS = 8;
export const MAX_LABEL_LENGTH = 40;

/** Until someone changes them in Settings. */
export const DEFAULT_SCORE_BANDS: ScoreBand[] = [
  { label: 'Outstanding', min: 80, tone: 'green' },
  { label: 'Satisfactory', min: 60, tone: 'amber' },
  { label: 'Needs improvement', min: 0, tone: 'red' },
];

/** A band as it's being edited — the lowest score kept exactly as typed. */
export interface BandDraft { label: string; min: string; tone: BandTone }

export const toDrafts = (bands: ScoreBand[]): BandDraft[] => bands.map(b => ({ label: b.label, min: String(b.min), tone: b.tone }));

/**
 * Why these bands can't be saved yet, or null. Bands run highest first; the
 * last one is the floor (it starts at 0, so every score has a band).
 */
export function bandsProblem(drafts: BandDraft[]): string | null {
  if (drafts.length < MIN_BANDS) return `Keep at least ${MIN_BANDS} bands.`;
  if (drafts.length > MAX_BANDS) return `Use at most ${MAX_BANDS} bands.`;
  const labels = drafts.map(d => d.label.trim());
  if (labels.some(l => !l)) return 'Give every band a name.';
  if (labels.some(l => l.length > MAX_LABEL_LENGTH)) return `Keep names to ${MAX_LABEL_LENGTH} characters.`;
  if (new Set(labels.map(l => l.toLowerCase())).size !== labels.length) return 'Two bands have the same name.';
  if (!drafts.every(d => d.tone in BAND_TONES)) return 'Pick a colour for every band.';
  const mins = drafts.slice(0, -1).map(d => d.min.trim());
  if (mins.some(m => m === '')) return 'Give every band its lowest score.';
  const nums = mins.map(Number);
  if (nums.some(n => !Number.isFinite(n) || n <= 0 || n > 100)) return 'Lowest scores must be above 0 and at most 100.';
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] >= nums[i - 1]) return 'Each band must start lower than the band above it.';
  }
  return null;
}

/** The saved bands, from drafts that passed bandsProblem. */
export const fromDrafts = (drafts: BandDraft[]): ScoreBand[] =>
  drafts.map((d, i) => ({ label: d.label.trim(), min: i === drafts.length - 1 ? 0 : Number(d.min), tone: d.tone }));

/** The saved setting, or the defaults if it's missing or not a valid set of bands. */
export function bandsFrom(value: unknown): ScoreBand[] {
  if (!Array.isArray(value)) return DEFAULT_SCORE_BANDS;
  const bands = value.filter((b): b is ScoreBand =>
    !!b && typeof b === 'object' && typeof b.label === 'string' && typeof b.min === 'number' && typeof b.tone === 'string');
  if (bands.length !== value.length) return DEFAULT_SCORE_BANDS;
  const sorted = [...bands].sort((a, b) => b.min - a.min);
  return bandsProblem(toDrafts(sorted)) || sorted[sorted.length - 1].min !== 0 ? DEFAULT_SCORE_BANDS : sorted;
}

export interface Band { label: string; tone: BandTone; bg: string; color: string }

/**
 * The band a score falls in (bands highest first, as bandsFrom returns them).
 * Scores are shown as whole numbers, so the band is judged on the whole number
 * too — 79.6 shows as 80 and is named as 80.
 */
export function bandFor(score: number, bands: ScoreBand[]): Band {
  const shown = Math.round(score);
  const band = bands.find(b => shown >= b.min) ?? bands[bands.length - 1];
  return { label: band.label, tone: band.tone, ...BAND_TONES[band.tone] };
}

/** "80 and above", "60 to under 80", "Under 60" — for drafts, by position in the list. */
export function rangeText(drafts: BandDraft[], i: number): string {
  const min = drafts[i].min.trim();
  const above = i > 0 ? drafts[i - 1].min.trim() : '';
  if (i === drafts.length - 1) return above ? `Under ${above}` : 'Everything lower';
  if (i === 0) return min ? `${min} and above` : '';
  return min && above ? `${min} to under ${above}` : '';
}

export interface ScaleSegment { label: string; tone: BandTone; from: number; to: number }

/**
 * The 0–100 scale the bands make, lowest first — for the picture at the top of
 * Settings → Score bands. Null while the bands can't be saved yet (no sensible picture).
 */
export function scaleSegments(drafts: BandDraft[]): ScaleSegment[] | null {
  if (bandsProblem(drafts)) return null;
  const bands = fromDrafts(drafts);
  return bands.map((b, i) => ({ label: b.label, tone: b.tone, from: b.min, to: i === 0 ? 100 : bands[i - 1].min })).reverse();
}
