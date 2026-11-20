// Card, field and button look shared by Settings → AI and Settings →
// Operating cost → Import rules. Admin palette: slate + indigo.

export const SC = {
  text: '#1e293b', textSub: '#334155', muted: '#64748b', border: '#e2e8f0', divider: '#eef0f4',
  primary: '#5a67d8', ok: '#15803d', danger: '#b91c1c',
};

export const S: Record<string, React.CSSProperties> = {
  card: { background: '#fff', border: `1px solid ${SC.border}`, borderRadius: 12, padding: 24, marginBottom: 16 },
  cardTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: SC.text },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  label: { fontSize: 13, fontWeight: 600, color: SC.text },
  hint: { fontSize: 12, color: SC.muted, lineHeight: 1.4 },
  input: {
    minHeight: 36, padding: '0 10px', borderRadius: 8, border: `1px solid ${SC.border}`, background: '#fff',
    fontSize: 13, color: SC.text, fontFamily: 'inherit', boxSizing: 'border-box', width: '100%',
  },
  primary: { minHeight: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: SC.primary, color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' },
  secondary: { minHeight: 36, padding: '0 14px', borderRadius: 8, border: `1px solid ${SC.border}`, background: '#fff', color: SC.textSub, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' },
};
