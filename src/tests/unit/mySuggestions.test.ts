import { describe, it, expect } from 'vitest';
import { STATUS_TEXT, decisionWord, feedbackHeading, kindLabel, parseSuggestionTab, suggestionsOn, outcomeLine, resubmitPath, sentSuggestions } from '../../pages/operations/mySuggestions';

// "My guide ideas": a teacher sees every How-To Guide suggestion they sent
// (new guides and improvements), where each stands, and what it changes.

type S = { status: 'DRAFT' | 'PENDING' | 'TRIAL' | 'CHANGES_REQUESTED' | 'APPROVED' | 'REJECTED'; createdAt: string; sopTemplateId: string | null };
const s = (status: S['status'], createdAt: string, sopTemplateId: string | null = 'g1'): S => ({ status, createdAt, sopTemplateId });

describe('My guide ideas — the list', () => {
  it('shows what was sent, newest first, leaving out unfinished drafts', () => {
    const list = [s('APPROVED', '2026-11-01T00:00:00Z'), s('DRAFT', '2026-11-12T00:00:00Z'), s('PENDING', '2026-11-10T00:00:00Z')];
    expect(sentSuggestions(list).map(r => r.status)).toEqual(['PENDING', 'APPROVED']);
  });

  it('shows two tabs — In progress (sent-back ideas first) and Done — opening on In progress', () => {
    const list = [s('APPROVED', 'c'), s('PENDING', 'a'), s('TRIAL', 'f'), s('CHANGES_REQUESTED', 'e'), s('REJECTED', 'd')];
    expect(suggestionsOn(list, 'progress').map(r => r.status)).toEqual(['CHANGES_REQUESTED', 'PENDING', 'TRIAL']);
    expect(suggestionsOn(list, 'done').map(r => r.status)).toEqual(['APPROVED', 'REJECTED']);
    expect(parseSuggestionTab(null)).toBe('progress');
    expect(parseSuggestionTab('done')).toBe('done');
  });

  it('calls a change to an existing guide an improvement, and anything else a new guide', () => {
    expect(kindLabel({ sopTemplateId: 'g1' })).toBe('Improvement');
    expect(kindLabel({ sopTemplateId: null })).toBe('New guide');
  });

  it('says plainly where it stands — in review, on trial, sent back, approved and live, or not approved and by whom', () => {
    const date = () => '12 Nov 2026';
    expect(outcomeLine({ status: 'PENDING', reviewedByName: null, reviewedAt: null, versionNumber: null }, date)).toMatch(/will review it/);
    expect(outcomeLine({ status: 'APPROVED', reviewedByName: 'Rina', reviewedAt: 'x', versionNumber: 4 }, date))
      .toBe('Approved by Rina on 12 Nov 2026 — now live as version 4.');
    expect(outcomeLine({ status: 'TRIAL', reviewedByName: null, reviewedAt: null, versionNumber: null }, date)).toMatch(/trying it out in practice/);
    expect(outcomeLine({ status: 'CHANGES_REQUESTED', reviewedByName: 'Rina', reviewedAt: 'x', versionNumber: null }, date))
      .toBe('Sent back by Rina on 12 Nov 2026 — update it and send it again.');
    expect(outcomeLine({ status: 'REJECTED', reviewedByName: 'Rina', reviewedAt: 'x', versionNumber: null }, date)).toBe('Not approved by Rina on 12 Nov 2026.');
  });
});

describe('My guide ideas — sent back for changes', () => {
  it('names the statuses in plain words — In review, not "waiting"', () => {
    expect(STATUS_TEXT.PENDING.label).toBe('In review');
    expect(STATUS_TEXT.CHANGES_REQUESTED.label).toBe('Needs changes');
    expect(STATUS_TEXT.TRIAL.label).toBe('On trial');
  });

  it('heads the supervisor\'s note by what it is now — what to change, or earlier feedback after resending', () => {
    expect(feedbackHeading('CHANGES_REQUESTED', 'Rina')).toBe('What to change — from Rina');
    expect(feedbackHeading('PENDING', null)).toBe('Earlier feedback from your supervisor');
    expect(feedbackHeading('REJECTED', 'Rina')).toBe('Note from Rina');
  });

  it('opens the same form it was made with to make the changes — Suggest an Edit or Suggest a Guide', () => {
    expect(resubmitPath({ id: 'r1', sopTemplateId: 'g1' }, true)).toBe('/operations/sops/g1/propose?resubmit=r1&app=teacher');
    expect(resubmitPath({ id: 'r2', sopTemplateId: null }, false)).toBe('/operations/sops/propose?resubmit=r2');
  });

  it('gives reviewers one word for each decision', () => {
    expect(decisionWord('CHANGES_REQUESTED')).toBe('Sent back');
    expect(decisionWord('APPROVED')).toBe('Approved');
    expect(decisionWord('PENDING')).toBe('');
  });
});
