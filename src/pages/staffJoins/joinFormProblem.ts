import type { StaffJoinInput } from '../../api/staffJoins.js';

const MIN_NAME_LENGTH = 2;
const MIN_PHONE_DIGITS = 8;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GMAIL_DOMAINS = ['gmail.com', 'googlemail.com'];

/** First problem with the New staff form, in plain words — or null when it can be sent. */
export function joinFormProblem(d: StaffJoinInput, today: string): string | null {
  if (d.fullName.trim().length < MIN_NAME_LENGTH) return 'Please enter your full name.';
  if (d.phone.replace(/\D/g, '').length < MIN_PHONE_DIGITS) return 'Please enter a phone number we can reach you on.';
  if (!d.dob) return 'Please enter your date of birth.';
  if (d.dob >= today) return 'Your date of birth must be in the past.';
  if (!d.email.trim()) return 'Please enter your email address.';
  if (!EMAIL_SHAPE.test(d.email.trim())) return 'That email address doesn\'t look right.';
  return null;
}

/** Gmail is preferred (they'll sign in to the app with it) but not required. */
export function isGmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1] ?? '';
  return GMAIL_DOMAINS.includes(domain);
}
