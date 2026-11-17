import { describe, it, expect } from 'vitest';
import { DEFAULT_SCORE_BANDS, bandFor, bandsFrom, bandsProblem, fromDrafts, rangeText, scaleSegments, toDrafts } from '../../pages/appraisals/scoreBands';

// Settings → Score bands: what an appraisal score is called and its colour.

describe('Score bands', () => {
  it('names scores 80 and above Outstanding, 60 and above Satisfactory, and below 60 Needs improvement by default', () => {
    expect(bandFor(80, DEFAULT_SCORE_BANDS).label).toBe('Outstanding');
    expect(bandFor(79.4, DEFAULT_SCORE_BANDS).label).toBe('Satisfactory');
    // Scores show as whole numbers, so 79.6 (shown as 80) is Outstanding.
    expect(bandFor(79.6, DEFAULT_SCORE_BANDS).label).toBe('Outstanding');
    expect(bandFor(60, DEFAULT_SCORE_BANDS).label).toBe('Satisfactory');
    expect(bandFor(59, DEFAULT_SCORE_BANDS).label).toBe('Needs improvement');
    expect(bandFor(0, DEFAULT_SCORE_BANDS).color).toBe('#991b1b');
  });

  it('uses the saved bands, highest first, and falls back to the defaults when the setting is missing or broken', () => {
    const saved = [{ label: 'Low', min: 0, tone: 'red' }, { label: 'Top', min: 90, tone: 'green' }];
    expect(bandsFrom(saved).map(b => b.label)).toEqual(['Top', 'Low']);
    expect(bandFor(95, bandsFrom(saved)).label).toBe('Top');
    expect(bandsFrom(undefined)).toBe(DEFAULT_SCORE_BANDS);
    expect(bandsFrom([{ label: 'Only', min: 50, tone: 'green' }])).toBe(DEFAULT_SCORE_BANDS);
    expect(bandsFrom([{ label: 'A', min: 70, tone: 'green' }, { label: 'B', min: 10, tone: 'red' }])).toBe(DEFAULT_SCORE_BANDS);
  });

  it('keeps Save disabled until every band has a name and starts lower than the one above', () => {
    const ok = toDrafts(DEFAULT_SCORE_BANDS);
    expect(bandsProblem(ok)).toBeNull();
    expect(bandsProblem([{ ...ok[0], label: ' ' }, ...ok.slice(1)])).toBe('Give every band a name.');
    expect(bandsProblem([ok[0], { ...ok[1], label: 'outstanding' }, ok[2]])).toBe('Two bands have the same name.');
    expect(bandsProblem([ok[0], { ...ok[1], min: '' }, ok[2]])).toBe('Give every band its lowest score.');
    expect(bandsProblem([ok[0], { ...ok[1], min: '85' }, ok[2]])).toBe('Each band must start lower than the band above it.');
    expect(bandsProblem([{ ...ok[0], min: '120' }, ...ok.slice(1)])).toBe('Lowest scores must be above 0 and at most 100.');
    expect(bandsProblem([ok[2]])).toBe('Keep at least 2 bands.');
  });

  it('saves the lowest band from 0 and describes each band\'s range', () => {
    const drafts = toDrafts(DEFAULT_SCORE_BANDS);
    expect(fromDrafts([...drafts.slice(0, 2), { ...drafts[2], min: '' }]).slice(-1)[0].min).toBe(0);
    expect(rangeText(drafts, 0)).toBe('80 and above');
    expect(rangeText(drafts, 1)).toBe('60 to under 80');
    expect(rangeText(drafts, 2)).toBe('Under 60');
  });

  it('draws the 0–100 scale from the bands, lowest first — and nothing while they can’t be saved', () => {
    expect(scaleSegments(toDrafts(DEFAULT_SCORE_BANDS))).toEqual([
      { label: 'Needs improvement', tone: 'red', from: 0, to: 60 },
      { label: 'Satisfactory', tone: 'amber', from: 60, to: 80 },
      { label: 'Outstanding', tone: 'green', from: 80, to: 100 },
    ]);
    expect(scaleSegments([{ label: 'Top', min: '', tone: 'green' }, { label: 'Rest', min: '', tone: 'red' }])).toBeNull();
  });
});
