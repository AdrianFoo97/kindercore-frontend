import { describe, it, expect } from 'vitest';
import { MAX_REASONS, addReason, canContinue, cleanReasons } from '../../pages/operations/sopImproveReasons';

// Step 1 of a teacher's "Suggest an improvement" to a How-To Guide: list why
// it needs improving before changing any steps.

describe('Suggesting an improvement — step 1, why it needs improving', () => {
  it('only lets the teacher go on to the steps once at least one reason is written', () => {
    expect(canContinue([])).toBe(false);
    expect(canContinue(['', '   '])).toBe(false);
    expect(canContinue(['', 'Step 3 is out of date'])).toBe(true);
  });

  it('sends the reasons tidied — trimmed, single-spaced, blank rows dropped', () => {
    expect(cleanReasons(['  Step 3 is  out of date ', '', ' Hard to follow'])).toEqual(['Step 3 is out of date', 'Hard to follow']);
  });

  it('adds a common reason into the empty row, or as a new row, and never twice', () => {
    expect(addReason([], 'Safety concern')).toEqual(['Safety concern']);
    expect(addReason(['Missing a step', ''], 'Safety concern')).toEqual(['Missing a step', 'Safety concern']);
    expect(addReason(['Missing a step'], 'Safety concern')).toEqual(['Missing a step', 'Safety concern']);
    expect(addReason(['safety concern'], 'Safety concern')).toEqual(['safety concern']);
  });

  it('stops at the most reasons allowed', () => {
    const full = Array.from({ length: MAX_REASONS }, (_, i) => `Reason ${i + 1}`);
    expect(addReason(full, 'Safety concern')).toBe(full);
  });
});
