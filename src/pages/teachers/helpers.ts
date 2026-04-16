export function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const p = h >= 12 ? 'PM' : 'AM';
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hh}:${String(mm).padStart(2, '0')} ${p}`;
}

export function fmtRM(v: number): string {
  return `RM ${v.toLocaleString('en-MY', { minimumFractionDigits: 0 })}`;
}

/** Deduct an hour break when the shift is at least 6 hours long. */
export function computeDailyHours(start: number, end: number): number {
  const raw = (end - start) / 60;
  return raw >= 6 ? raw - 1 : raw;
}

export function formatResignedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Convert a #rrggbb hex color to an rgba() string at the given alpha. */
export function hexAlpha(hex: string, alpha: number): string {
  const h = (hex || '').replace('#', '');
  if (h.length !== 6) return `rgba(148, 163, 184, ${alpha})`;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Compact RM formatter: RM 3.2k, RM 12k. */
export function fmtRMCompact(v: number): string {
  if (v >= 1000) {
    const k = v / 1000;
    return `RM ${k.toFixed(k >= 10 ? 0 : 1).replace(/\.0$/, '')}k`;
  }
  return `RM ${v.toFixed(0)}`;
}
