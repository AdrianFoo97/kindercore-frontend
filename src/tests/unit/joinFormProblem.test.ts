import { describe, it, expect } from 'vitest';
import { isGmail, joinFormProblem } from '../../pages/staffJoins/joinFormProblem';
import type { StaffJoinInput } from '../../api/staffJoins';

// The public "New staff" form's own check, before anything is sent.

const TODAY = '2026-11-04';
const OK: StaffJoinInput = { fullName: 'Aisyah Rahman', phone: '012-345 6789', dob: '1998-04-12', email: 'aisyah@gmail.com' };

describe('New staff form — checking the details', () => {
  it('lets a complete form through, Gmail or not', () => {
    expect(joinFormProblem(OK, TODAY)).toBeNull();
    expect(joinFormProblem({ ...OK, email: 'aisyah@yahoo.com' }, TODAY)).toBeNull();
  });

  it('asks for whatever is missing, one thing at a time', () => {
    expect(joinFormProblem({ ...OK, fullName: ' ' }, TODAY)).toBe('Please enter your full name.');
    expect(joinFormProblem({ ...OK, phone: '012' }, TODAY)).toBe('Please enter a phone number we can reach you on.');
    expect(joinFormProblem({ ...OK, email: '' }, TODAY)).toBe('Please enter your email address.');
  });

  it('refuses a birth date that is today or later, and a malformed email', () => {
    expect(joinFormProblem({ ...OK, dob: TODAY }, TODAY)).toBe('Your date of birth must be in the past.');
    expect(joinFormProblem({ ...OK, email: 'not-an-email' }, TODAY)).toBe('That email address doesn\'t look right.');
  });

  it('recognises a Gmail address, so the form can nudge towards one', () => {
    expect(isGmail('Aisyah@Gmail.com')).toBe(true);
    expect(isGmail('aisyah@googlemail.com')).toBe(true);
    expect(isGmail('aisyah@yahoo.com')).toBe(false);
  });
});
