/**
 * "Step 1 of 2 · About the guide" with a bar per step — where you are and
 * how much is left, at a glance. Words carry it; the bar backs them up.
 */
export default function WizardProgress({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#475569' }}>
        Step {step} of {total} · <span style={{ color: '#0f172a' }}>{label}</span>
      </div>
      <div aria-hidden style={{ display: 'grid', gridTemplateColumns: `repeat(${total}, 1fr)`, gap: 6, marginTop: 8 }}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} style={{ height: 4, borderRadius: 999, background: i < step ? 'var(--sop-accent)' : '#e2e8f0' }} />
        ))}
      </div>
    </div>
  );
}