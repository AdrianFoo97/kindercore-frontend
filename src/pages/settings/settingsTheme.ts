// Colours for the Settings home page and sidebar (admin palette: slate + indigo).
export const C = {
  bg: '#f8fafc', card: '#ffffff', border: '#e2e8f0', text: '#0f172a', sub: '#334155', muted: '#64748b',
  primary: '#5a67d8', primarySoft: '#eef2ff', primaryDeep: '#3c339a', danger: '#b91c1c', dangerSoft: '#fef2f2', hover: '#f1f5f9',
};

/** The signed-in person's role, from the stored profile (a display hint — the server decides access). */
export function storedRole(): string | null {
  try { return (JSON.parse(localStorage.getItem('user') ?? 'null') as { role?: string } | null)?.role ?? null; } catch { return null; }
}
export const isAdminRole = (role: string | null) => role === 'ADMIN' || role === 'SUPERADMIN';
