// "UP NEXT | <task>" box under an onboarding card's progress bar. Red when
// the person is overdue, amber otherwise. Drop the inner left accent when the
// card itself already carries one, so the urgency signal isn't doubled.

export function UpNextTask({ task, overdue = false, cardHasAccent = false, label = 'Up next' }: {
  task: string;
  overdue?: boolean;
  cardHasAccent?: boolean;
  /** The little uppercase tag — "Up next" unless the step is someone else's. */
  label?: string;
}) {
  const theme = overdue
    ? { bg: '#fef2f2', border: '#fecaca', accent: '#dc2626', label: '#b91c1c', divider: '#fca5a5', text: '#991b1b' }
    : { bg: '#fffbeb', border: '#fde68a', accent: '#f59e0b', label: '#d97706', divider: '#fcd34d', text: '#92400e' };
  return (
    <div style={{
      marginTop: 10, padding: '9px 12px',
      background: theme.bg,
      border: `1px solid ${theme.border}`,
      ...(cardHasAccent ? {} : { borderLeft: `3px solid ${theme.accent}` }),
      borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: theme.label, letterSpacing: '0.06em', whiteSpace: 'nowrap' as const, textTransform: 'uppercase' as const }}>
        {label}
      </span>
      <span style={{ width: 1, height: 12, background: theme.divider, flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: theme.text, lineHeight: 1.4, fontWeight: 500 }}>
        {task}
      </span>
    </div>
  );
}
