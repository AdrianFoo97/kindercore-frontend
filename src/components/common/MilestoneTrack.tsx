// Milestone-track state for one month: did it hit target, miss, or
// hasn't happened yet. Segmented (not a smooth % fill) so a miss in
// the middle of the quarter/year is visible, not averaged away.
export type MonthDotState = 'hit' | 'missed' | 'pending';

// Segmented progress track for a pool's month-by-month hit/miss record.
// Used on both the Home pool previews (where it's the card's primary
// visual) and the Pay Breakdown previews (alongside the real RM figure,
// which stays visible there since that page is a deliberate look-in,
// not a passive glance).
export function MilestoneTrack({ states, color }: { states: MonthDotState[]; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {states.map((s, i) => (
        <div
          key={i}
          style={{
            flex: 1, height: 7, borderRadius: 999,
            background: s === 'hit' ? color : s === 'missed' ? '#fecaca' : '#ede9fe',
          }}
        />
      ))}
    </div>
  );
}

// "2 months left this quarter" style caption under the track — keeps
// the card forward-looking (what's still ahead) rather than only
// reporting what already happened.
export function remainingLabel(remaining: number, unit: 'quarter' | 'year'): string {
  if (remaining <= 0) return unit === 'quarter' ? 'Quarter complete' : 'Year complete';
  return `${remaining} month${remaining === 1 ? '' : 's'} left this ${unit}`;
}
