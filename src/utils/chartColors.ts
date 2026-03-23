// Shared chart color utilities for analysis pages

export const CHANNEL_COLORS: Record<string, string> = {
  'Facebook': '#1877F2',
  'Google': '#34A853',
  '小红书': '#FF2442',
  'Instagram': '#E4405F',
  'WhatsApp': '#25D366',
  'TikTok': '#000000',
  'YouTube': '#FF0000',
  'Twitter': '#1DA1F2',
  'Pass By': '#EAB308',
  'Friend': '#f97316',
  'Sibling': '#14b8a6',
  'Others': '#94a3b8',
};

export const ADDRESS_PALETTE = [
  '#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899',
  '#f59e0b', '#10b981', '#f97316', '#64748b',
];

const NON_BRAND_PALETTE = ['#f59e0b', '#10b981', '#6366f1', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#64748b'];

export function getChannelColor(name: string, index: number): string {
  const n = name.toLowerCase();
  if (n.includes('facebook')) return CHANNEL_COLORS['Facebook'];
  if (n.includes('google')) return CHANNEL_COLORS['Google'];
  if (n.includes('小红书')) return CHANNEL_COLORS['小红书'];
  if (n.includes('instagram')) return CHANNEL_COLORS['Instagram'];
  if (n.includes('whatsapp')) return CHANNEL_COLORS['WhatsApp'];
  if (n.includes('tiktok')) return CHANNEL_COLORS['TikTok'];
  if (n.includes('youtube')) return CHANNEL_COLORS['YouTube'];
  if (n.includes('pass by') || n.includes('驾车经过')) return CHANNEL_COLORS['Pass By'];
  if (n.includes('friend') || n.includes('朋友介绍')) return CHANNEL_COLORS['Friend'];
  if (n.includes('sibling') || n.includes('兄弟') || n.includes('其他孩子在就读')) return CHANNEL_COLORS['Sibling'];
  if (n === 'others') return CHANNEL_COLORS['Others'];
  return NON_BRAND_PALETTE[index % NON_BRAND_PALETTE.length];
}

export function getAddressColor(name: string, index: number): string {
  if (name.toLowerCase() === 'others') return '#94a3b8';
  return ADDRESS_PALETTE[index % ADDRESS_PALETTE.length];
}
