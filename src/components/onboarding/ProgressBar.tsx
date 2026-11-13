// Onboarding progress bar — students and staff (HR's list and their own).

export function ProgressBar({ done, total, label }: {
  done: number;
  total: number;
  /** Optional prefix when a card shows more than one list, e.g. "HR tasks". */
  label?: string;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isComplete = total > 0 && done === total;
  const remaining = total - done;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: isComplete ? '#10b981' : '#3b82f6',
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: isComplete ? '#059669' : '#3b82f6', minWidth: 28, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const }}>
          {pct}%
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: isComplete ? '#059669' : '#64748b' }}>
          {label && <strong style={{ fontWeight: 700 }}>{label} · </strong>}
          {done} of {total} tasks complete
        </span>
        {!isComplete && (
          <span style={{ fontSize: 11, color: '#64748b' }}>{remaining} remaining</span>
        )}
      </div>
    </div>
  );
}
