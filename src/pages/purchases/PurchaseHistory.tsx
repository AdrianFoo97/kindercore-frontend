import type { PurchaseLogEntry } from '../../api/purchaseRequests.js';
import { HISTORY_LABEL, fmtMoment, timelineWithCarryOvers } from './purchaseDisplay.js';

// The record of a purchase request as a timeline — asked for, edited,
// carried over to the next week, approved, bought… — with who and exactly
// when, oldest first. Shown to the supervisor (note / record pop-up) and the
// requester (under their request), so "I asked on Monday" is never a dispute.

const CARRIED_COLOUR = '#d97706';

export default function PurchaseHistory({ entries, compact }: { entries: PurchaseLogEntry[]; compact?: boolean }) {
  const timeline = timelineWithCarryOvers(entries);
  if (timeline.length === 0) return <div style={{ fontSize: 12.5, color: '#64748b' }}>No record yet.</div>;
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: compact ? 8 : 12 }}>
      {timeline.map((e, i) => {
        const carried = e.kind === 'CARRIED_OVER';
        const last = i === timeline.length - 1;
        return (
          <li key={e.id} style={{ display: 'flex', gap: 10 }}>
            {/* Dot + connecting line down to the next step. */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 5 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: carried ? '#fff' : last ? '#5a67d8' : '#cbd5e1',
                border: carried ? `2px solid ${CARRIED_COLOUR}` : 'none', boxSizing: 'border-box',
              }} />
              {!last && <span style={{ flex: 1, width: 2, background: '#e2e8f0', marginTop: 3 }} />}
            </div>
            <div style={{ minWidth: 0, paddingBottom: 2 }}>
              <div style={{ fontSize: compact ? 12.5 : 13.5, color: carried ? CARRIED_COLOUR : '#0f172a' }}>
                <strong>{HISTORY_LABEL[e.kind]}</strong>
                {e.authorName && <span style={{ color: '#64748b' }}> by {e.authorName}</span>}
              </div>
              {e.detail && <div style={{ fontSize: 12.5, color: '#334155', marginTop: 1, overflowWrap: 'anywhere' }}>{e.detail}</div>}
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 1 }}>{fmtMoment(e.createdAt)}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
