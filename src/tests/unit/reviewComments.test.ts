import { describe, it, expect } from 'vitest';
import { commentCountLabel, commentFor, commentsToSend, feedbackSummary, hasFeedback, attachComments, unplaced, rowComment, commentsOffTable } from '../../pages/operations/reviewComments';

// Sending a guide suggestion back: the supervisor comments on steps one by
// one as they go through them, and the teacher sees each comment on its step.

const steps = [
  { key: 'a', section: 'Arrival', title: 'Greet the parent' },
  { key: 'b', section: 'Arrival', title: 'Temperature check' },
  { key: 'c', section: 'Handover', title: 'Sign the sheet' },
];

describe('Step comments when sending a suggestion back', () => {
  it('sends the comments in step order, leaving out blank ones and steps that were removed', () => {
    const sent = commentsToSend({ c: 'Use the tablet', a: '  ', b: ' Which thermometer? ', gone: 'Old step' }, steps);
    expect(sent).toEqual([
      { section: 'Arrival', stepTitle: 'Temperature check', comment: 'Which thermometer?' },
      { section: 'Handover', stepTitle: 'Sign the sheet', comment: 'Use the tablet' },
    ]);
  });

  it('can send with step comments alone, an overall note alone, but not with nothing', () => {
    expect(hasFeedback('', [{ section: 'A', stepTitle: 'x', comment: 'y' }])).toBe(true);
    expect(hasFeedback('Add a step', [])).toBe(true);
    expect(hasFeedback('   ', [])).toBe(false);
  });

  it('shows the teacher each comment on the step it is about', () => {
    const comments = [{ section: 'Arrival', stepTitle: 'Temperature check', comment: 'Which thermometer?' }];
    expect(commentFor(comments, { section: 'arrival ', title: 'temperature check' })).toBe('Which thermometer?');
    expect(commentFor(comments, { section: 'Handover', title: 'Temperature check' })).toBeNull();
    expect(commentFor(null, steps[0])).toBeNull();
  });

  it('keeps each comment on its step even after the teacher renames it, and lists any whose step was removed', () => {
    const comments = [
      { section: 'Arrival', stepTitle: 'Temperature check', comment: 'Which thermometer?' },
      { section: 'Handover', stepTitle: 'Sign the sheet', comment: 'Use the tablet' },
      { section: 'Arrival', stepTitle: 'Old step', comment: 'Drop this' },
    ];
    const attached = attachComments(comments, steps);
    expect(attached.byKey.b.comment).toBe('Which thermometer?');
    // Renamed "Temperature check" (key b) still has its comment; step c was deleted.
    const now = [{ key: 'a' }, { key: 'b' }];
    expect(unplaced(attached, now).map(c => c.stepTitle)).toEqual(['Old step', 'Sign the sheet']);
    expect(unplaced(attachComments(null, steps), now)).toEqual([]);
  });

  it('puts each comment under its row of the side-by-side table, even when the step was renamed, and keeps the rest aside', () => {
    const comments = [
      { section: 'Arrival', stepTitle: 'Make a circle', comment: 'Make a rectangle' },
      { section: 'Arrival', stepTitle: 'Gone step', comment: 'Drop this' },
    ];
    const renamed = { before: { section: 'Arrival', title: 'Make a circle' }, after: { section: 'Arrival', title: 'Make a rectangle' } };
    const other = { before: { section: 'Arrival', title: 'Sing' }, after: { section: 'Arrival', title: 'Sing' } };
    expect(rowComment(comments, renamed)).toBe('Make a rectangle');
    expect(rowComment(comments, other)).toBeNull();
    expect(commentsOffTable(comments, [renamed, other]).map(c => c.stepTitle)).toEqual(['Gone step']);
  });

  it('sums the feedback up in one line for lists', () => {
    expect(feedbackSummary('Add a step', null)).toBe('Add a step');
    expect(feedbackSummary(null, [{ section: 'A', stepTitle: 'x', comment: 'y' }])).toBe('1 step comment');
    expect(commentCountLabel(3)).toBe('3 step comments');
    expect(feedbackSummary(null, [])).toBeNull();
  });
});
