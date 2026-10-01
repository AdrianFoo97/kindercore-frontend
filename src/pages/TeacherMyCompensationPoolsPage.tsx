import { useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faXmark, faHandHoldingDollar } from '@fortawesome/free-solid-svg-icons';
import { useTeamPoolSummary } from '../hooks/useTeamPoolSummary.js';
import { TEACHER_CONTENT_TOP } from '../components/common/TeacherTopBar.js';

// ─────────────────────────────────────────────────────────────────────────────
// Team Pool — a teacher's own, honest view of this quarter's profit-
// share pool: how many months hit target, how much has accrued, and
// roughly what that means for them personally. Deliberately simplified
// from the admin ProfitSharingPage.tsx (no year/quarter picker, no
// per-teacher exclude controls, no full distribution table) — this is
// a "where do I stand" read, not a payout admin tool. Reuses the exact
// same math (see ProfitSharingPage.tsx) so the two surfaces can never
// disagree on the pool total.
// ─────────────────────────────────────────────────────────────────────────────

const FONT =
  '"Segoe UI", Roboto, Arial, sans-serif';

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eceef2',
  text: '#475569',
  textStrong: '#334155',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  slateSoft: '#f1f5f9',
  pAccent: '#7c3aed',
  pSoft: '#f5f3ff',
  pBorder: '#ddd6fe',
  pDeep: '#5b21b6',
  green: '#16a34a',
  greenSoft: '#ecfdf5',
  greenBorder: '#a7f3d0',
};

const MONTH_LABELS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtRM0(n: number): string {
  return `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function TeacherMyCompensationPoolsPage() {
  const { id } = useParams<{ id: string }>();
  const {
    year, quarter, monthlyPools, poolAmount, hitsCount,
    myShare, mySharePct, isEligible, isLoading,
  } = useTeamPoolSummary(id);

  const pageStyle: React.CSSProperties = {
    paddingTop: TEACHER_CONTENT_TOP,
    paddingRight: 16,
    paddingBottom: 40,
    paddingLeft: 16,
    minHeight: '100vh',
    fontFamily: FONT,
    color: C.text,
    background: C.bg,
  };

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* Page title — lives here as plain content, not in the shared
            floating bar (which suppresses its own at-rest title for
            every teacher page now — see TeacherTopBar.tsx's
            titleMovedToPage). Same treatment as Home/Pay hub/Guides. */}
        <h1 style={{
          margin: '0 0 16px', paddingLeft: 4, fontSize: 30, fontWeight: 800,
          color: C.textStrong, letterSpacing: '-0.02em',
        }}>
          Profit Sharing Pool
        </h1>

        {isLoading && (
          <div style={{ padding: 40, textAlign: 'center', color: C.mutedSoft, fontSize: 13 }}>
            Loading profit sharing pool…
          </div>
        )}

        {!isLoading && (
          <>
            {/* ── Quarter pool hero ─────────────────────────────── */}
            <div style={{
              background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 18,
              padding: '18px 20px', marginBottom: 16,
              boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {quarter.label} {year} · Profit Sharing Pool
              </div>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: C.pDeep, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtRM0(poolAmount)}
                </span>
              </div>
              <div style={{ marginTop: 4, fontSize: 12.5, fontWeight: 600, color: C.muted }}>
                {hitsCount} of 3 months hit target so far
              </div>

              {/* Month-by-month chips */}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                {monthlyPools.map(m => (
                  <div key={m.monthIdx} style={{
                    flex: 1, borderRadius: 12, padding: '10px 8px', textAlign: 'center',
                    background: m.isForecast ? C.slateSoft : m.hit ? C.greenSoft : '#fef2f2',
                    border: `1px solid ${m.isForecast ? C.cardBorder : m.hit ? C.greenBorder : '#fecaca'}`,
                  }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: 'uppercase' }}>
                      {MONTH_LABELS_SHORT[m.monthIdx]}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 14 }}>
                      {m.isForecast ? (
                        <span style={{ color: C.mutedSoft, fontSize: 10.5, fontWeight: 700 }}>Upcoming</span>
                      ) : (
                        <FontAwesomeIcon icon={m.hit ? faCheck : faXmark} style={{ color: m.hit ? C.green : '#dc2626' }} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── My estimated share ───────────────────────────── */}
            <div style={{
              background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 18,
              padding: '18px 20px', marginBottom: 16,
              boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isEligible ? 12 : 0 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 13, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: C.pSoft, color: C.pAccent, fontSize: 17,
                  border: `1px solid ${C.pBorder}`,
                }}>
                  <FontAwesomeIcon icon={faHandHoldingDollar} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.textStrong, letterSpacing: '-0.01em' }}>
                    Your estimated share
                  </div>
                  <div style={{ marginTop: 2, fontSize: 12, fontWeight: 600, color: C.muted }}>
                    {isEligible ? 'Based on your weight this quarter' : 'Not eligible this quarter'}
                  </div>
                </div>
              </div>
              {isEligible ? (
                <>
                  <div style={{
                    fontSize: 26, fontWeight: 800, color: C.pDeep,
                    letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
                  }}>
                    {fmtRM0(myShare)}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: C.muted }}>
                    ~{mySharePct}% of the pool so far — this updates as the quarter progresses.
                  </div>
                </>
              ) : (
                <p style={{ margin: 0, fontSize: 12.5, color: C.mutedSoft, lineHeight: 1.5 }}>
                  Your position wasn't active with a weighted share this quarter, so there's nothing to estimate yet.
                </p>
              )}
            </div>
            {/* No inline "honest caveats" block — the "!" button in the
                top bar already covers this exact copy (see
                TeacherTopBar.tsx's INFO_CONTENT.pools), so repeating it
                here was the same disclaimer shown twice on one screen. */}
          </>
        )}
      </div>
    </div>
  );
}
