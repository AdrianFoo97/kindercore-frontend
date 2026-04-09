// Canonical marketing channel options for `Lead.howDidYouKnow`.
// Used by both the public enquiry form and the manual student creation modal,
// so the analytics breakdown stays consistent.

export interface MarketingChannel {
  value: string;   // stored in DB
  label: string;   // displayed in dropdown
}

export const MARKETING_CHANNELS: MarketingChannel[] = [
  { value: 'Facebook',        label: 'Facebook' },
  { value: 'Friend Referral', label: '朋友介绍 (Friend Referral)' },
  { value: '小红书',          label: '小红书 (Xiaohongshu)' },
  { value: 'Instagram',       label: 'Instagram' },
  { value: 'Pass By',         label: '驾车经过 (Pass By)' },
  { value: 'Google',          label: 'Google' },
  { value: 'Sibling',         label: '其他孩子在就读 (Sibling)' },
  { value: 'Billboard',       label: '广告牌 (Billboard)' },
];
