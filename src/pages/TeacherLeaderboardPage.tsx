import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTrophy, faCrown, faArrowTrendUp, faArrowTrendDown, faMinus,
} from '@fortawesome/free-solid-svg-icons';
import { fetchStandings, StandingsRow } from '../api/points.js';
import { TEACHER_CONTENT_TOP } from '../components/common/TeacherTopBar.js';

// ─────────────────────────────────────────────────────────────────────────────
// Leaderboard — monthly standings for points earned. Points-only, no
// money attached (see CLAUDE.md's "Pay surfaces — honest-money only"
// rule — this tab is the gamified/points side, kept deliberately
// separate from the Pay tab's real RM numbers). Current/previous month
// toggle; full ranked list so a teacher outside the top 3 can still see
// their own movement, which is the actual motivational lever.
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
  meBg: '#f5f3ff',
  meBorder: '#c4b5fd',
  green: '#16a34a',
  red: '#dc2626',
};

const GOLD = '#d4af37';
const SILVER = '#a8a9ad';
const BRONZE = '#b87333';

function rankBadgeColor(rank: number): string {
  if (rank === 1) return GOLD;
  if (rank === 2) return SILVER;
  if (rank === 3) return BRONZE;
  return C.pAccent;
}

function DeltaBadge({ delta, prevRank }: { delta: number | null; prevRank: number | null }) {
  if (prevRank === null) {
    return <span style={{ fontSize: 10.5, fontWeight: 700, color: C.mutedSoft }}>New</span>;
  }
  if (delta === null || delta === 0) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: C.mutedSoft }}>
        <FontAwesomeIcon icon={faMinus} style={{ fontSize: 8 }} />
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 800,
      color: up ? C.green : C.red,
      fontVariantNumeric: 'tabular-nums',
    }}>
      <FontAwesomeIcon icon={up ? faArrowTrendUp : faArrowTrendDown} style={{ fontSize: 9 }} />
      {Math.abs(delta)}
    </span>
  );
}

function StandingRow({ row }: { row: StandingsRow }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', borderRadius: 14,
      background: row.isMe ? C.meBg : C.card,
      border: `1px solid ${row.isMe ? C.meBorder : C.cardBorder}`,
    }}>
      <div style={{
        width: 26, textAlign: 'center', flexShrink: 0,
        fontSize: 13, fontWeight: 800, color: rankBadgeColor(row.rank),
        fontVariantNumeric: 'tabular-nums',
      }}>
        {row.rank <= 3 ? <FontAwesomeIcon icon={row.rank === 1 ? faCrown : faTrophy} /> : row.rank}
      </div>
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        background: row.color, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: 14,
      }}>
        {row.displayName.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: row.isMe ? 800 : 700, color: C.textStrong,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {row.displayName}{row.isMe ? ' (You)' : ''}
        </div>
        <div style={{ marginTop: 1, fontSize: 11, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>
          {row.pts.toLocaleString('en-MY')} pts
        </div>
      </div>
      <DeltaBadge delta={row.delta} prevRank={row.prevRank} />
    </div>
  );
}

export default function TeacherLeaderboardPage() {
  const { id } = useParams<{ id: string }>();
  const [period, setPeriod] = useState<'current' | 'previous'>('current');

  const { data, isLoading } = useQuery({
    queryKey: ['points-standings', id, period],
    queryFn: () => fetchStandings(id!, period),
    enabled: !!id,
  });

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
          Leaderboard
        </h1>

        {/* ── Period toggle ─────────────────────────────────────── */}
        <div style={{
          display: 'inline-flex', padding: 4, borderRadius: 12,
          background: C.slateSoft, marginBottom: 16,
        }}>
          {(['current', 'previous'] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              style={{
                padding: '7px 16px', borderRadius: 9, border: 'none',
                background: period === p ? C.card : 'transparent',
                color: period === p ? C.textStrong : C.muted,
                fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: period === p ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
              }}
            >
              {p === 'current' ? 'This month' : 'Last month'}
            </button>
          ))}
        </div>

        {isLoading && (
          <div style={{ padding: 40, textAlign: 'center', color: C.mutedSoft, fontSize: 13 }}>
            Loading standings…
          </div>
        )}

        {data && (
          <>
            {/* ── Team total card ──────────────────────────────── */}
            <div style={{
              background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16,
              padding: '16px 18px', marginBottom: 20,
              boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {data.period.label} · Team total
              </div>
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: C.textStrong, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                  {data.team.totalPts.toLocaleString('en-MY')}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>pts earned</span>
                {data.team.vsPrevious !== 0 && (
                  <span style={{
                    marginLeft: 'auto', fontSize: 12, fontWeight: 800,
                    color: data.team.vsPrevious > 0 ? C.green : C.red,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {data.team.vsPrevious > 0 ? '+' : ''}{data.team.vsPrevious.toLocaleString('en-MY')} vs last
                  </span>
                )}
              </div>
            </div>

            {/* ── Climbers strip ───────────────────────────────── */}
            {data.climbers.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {data.climbers.map(c => (
                  <div key={c.teacherId} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 999,
                    background: C.pSoft, border: `1px solid ${C.pBorder}`,
                    fontSize: 11.5, fontWeight: 700, color: C.pDeep,
                  }}>
                    <FontAwesomeIcon icon={faArrowTrendUp} style={{ fontSize: 10, color: C.green }} />
                    {c.displayName} +{c.delta}
                  </div>
                ))}
              </div>
            )}

            {/* ── Ranked list ───────────────────────────────────── */}
            {data.rows.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: C.mutedSoft, fontSize: 13 }}>
                No one's on the leaderboard yet this {period === 'current' ? 'month' : 'period'}.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.rows.map(row => (
                  <StandingRow key={row.teacherId} row={row} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
