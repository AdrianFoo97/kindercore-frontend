// Recruitment design tokens — shared by CandidatesPage and its pop-ups.

// Design tokens — refined palette + subtle shadow scale for a
// Linear/Ashby-style admin surface. Keeping the token names existing
// styles reference; only swapping the values where the change is subtle.
export const C = {
  bg: '#f7f8fa',
  bgSoft: '#fafbfc',
  surface: '#ffffff',
  text: '#0f172a',
  textSub: '#3f4b5c',
  muted: '#64748b',
  mutedSoft: '#64748b',
  border: '#e5e7ec',
  borderSoft: '#eff0f4',
  // Slightly deeper indigo — reads as "product primary", not "brand
  // pastel". PrimaryHover for interactive states.
  primary: '#4f46e5',
  primaryHover: '#4338ca',
  primaryDeep: '#3730a3',
  primarySoft: '#eef2ff',
  primarySofter: '#f5f7ff',
  success: '#059669',
  successSoft: '#ecfdf5',
  warning: '#d97706',
  warningSoft: '#fffbeb',
  gold: '#b45309',
  goldSoft: '#fef3c7',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  info: '#0284c7',
  infoSoft: '#f0f9ff',
};

export const SHADOW = {
  sm: '0 1px 2px rgba(15,23,42,0.04)',
  md: '0 4px 12px rgba(15,23,42,0.06)',
  lg: '0 12px 32px rgba(15,23,42,0.08)',
  focus: '0 0 0 3px rgba(79,70,229,0.15)',
};
