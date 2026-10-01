import { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faChevronRight, faStar, faBullseye, faArrowTrendUp,
  faHandHoldingDollar, faTrophy,
} from '@fortawesome/free-solid-svg-icons';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { fetchTeachers } from '../api/planner.js';
import { fetchTeacherCareer, MissionWithProgress } from '../api/career-missions.js';
import { fetchFinanceSummary } from '../api/finance.js';
import { fetchSettings } from '../api/settings.js';
import {
  DEFAULT_EXPENSE_RATIO_TARGET, DEFAULT_PROFIT_SHARE_PERCENT,
} from './FinanceSettingsPage.js';
import { TEACHER_TOPBAR_SPACE } from '../components/common/TeacherTopBar.js';
import { MilestoneTrack, remainingLabel, type MonthDotState } from '../components/common/MilestoneTrack.js';
import { useAnnualBonusSummary } from '../hooks/useAnnualBonusSummary.js';

// ─────────────────────────────────────────────────────────────────────────────
// Teacher Home — a warm, motivating landing. Answers three things at a
// glance: what's my growth status, what should I focus on today, where
// do I go next. Real data only (career query — same source as My
// Career); never fabricated, never discouraging. Light gamification
// (missions / next role / progress) kept calm and professional.
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
  track: '#ede9fe',
  pAccent: '#7c3aed',
  pSoft: '#f5f3ff',
  pBorder: '#ddd6fe',
  pDeep: '#5b21b6',
};

const HERO_BG = '#ede9fe';

// The Current Focus mission: strictly the teacher's own pinned choice
// (isTargeted on their progress row), same as Career tab's "Active
// Quests" — this used to also auto-pick a suggestion when nothing was
// pinned and present it exactly like a real choice, which was actually
// misleading (confirmed the hard way: Home showed a "Current Focus"
// while Career's Active Quests showed "nothing pinned yet" for the
// exact same teacher, at the exact same time — two different answers
// to the same question). Null now means "nothing pinned" full stop;
// the caller distinguishes that from "no open missions left" itself.
function pickFocus(
  missions: MissionWithProgress[],
  focusMissionId: string | null,
): MissionWithProgress | null {
  if (!focusMissionId) return null;
  return missions.find(m => m.id === focusMissionId && m.progress?.status !== 'COMPLETED') ?? null;
}

// Avatar palette — kept in sync with the Leaderboard page so the teacher
// sees the same colour wherever their initial appears in the app.
const AVATAR_PALETTE = [
  '#7c3aed', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#6366f1',
  '#f43f5e', '#14b8a6', '#0ea5e9', '#f97316', '#06b6d4', '#d946ef',
];

// Cheap stable hash → palette index. Only used as a fallback when the
// teacher isn't in the standings set (so we can't reuse Standings'
// sorted-id assignment). One teacher per Home page, so uniqueness
// across teachers doesn't matter here.
function hashAvatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

// Level stars — visualises the teacher's current LEVEL within their
// position (0..maxLevel), not the position's titleWeight. Stars actually
// move as the teacher levels up, which is the real gamified moment.
// Total = position.maxLevel (capped visually at 10 to keep the row
// from wrapping); filled = current level, clamped to total.
function levelStars(
  level: number | null | undefined,
  maxLevel: number | undefined,
): { filled: number; total: number } {
  const total = maxLevel && maxLevel > 0 ? Math.min(10, maxLevel) : 5;
  const filled = Math.max(0, Math.min(total, level ?? 0));
  return { filled, total };
}

// Team-pool headline for the "Team this month" card on Home. Icon tile
// stays the left anchor now — the RM figure moved to a small secondary
// badge so the milestone track (not the dollar amount) is the first
// thing a teacher's eye lands on.
function pickTeamHeadline(hits: number, elapsed: number, pooled: number): {
  icon: IconDefinition; color: string;
  amount: string | null;          // small secondary badge; null → nothing pooled yet
  headline: string; subline: string;
} {
  const VIOLET = '#7c3aed';
  const GREEN  = '#16a34a';
  const rm = (n: number) =>
    `RM ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n))}`;

  if (elapsed === 0) {
    return {
      icon: faHandHoldingDollar, color: VIOLET, amount: null,
      headline: 'Quarter just started',
      subline: 'First month coming up',
    };
  }
  if (pooled <= 0) {
    return {
      icon: faHandHoldingDollar, color: VIOLET, amount: null,
      headline: 'Aiming for the first hit',
      subline: `${elapsed} of 3 elapsed · pool unlocks at first hit`,
    };
  }
  const onStreak = hits === elapsed;
  return {
    icon: onStreak ? faArrowTrendUp : faHandHoldingDollar,
    color: onStreak ? GREEN : VIOLET,
    amount: rm(pooled),
    headline: onStreak ? 'On a streak!' : 'Building up',
    subline: `${hits} of 3 months hit`,
  };
}

// Same setting parser the Pools page uses — keeps Home and Pools in
// lock-step on the qualify-ratio and profit-share rates.
function settingNum(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n > lo && n <= hi ? n : fallback;
}

export default function TeacherHomePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isMobile } = useIsMobile();

  const { data: teachers = [] } = useQuery({
    queryKey: ['planner-teachers'],
    queryFn: fetchTeachers,
  });
  const teacher = (teachers as { id: string; name: string }[]).find(t => t.id === id);

  const { data: career } = useQuery({
    queryKey: ['teacher-career', id],
    queryFn: () => fetchTeacherCareer(id!),
    enabled: !!id,
  });

  // Team-pool data — finance summary + settings drive the "Team this
  // month" card. Same cache keys as the Team Pool page so the two
  // surfaces never disagree.
  const year = new Date().getFullYear();
  const { data: finance } = useQuery({
    queryKey: ['finance-summary', year],
    queryFn: () => fetchFinanceSummary(year),
  });
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  const firstName = (teacher?.name ?? career?.teacher?.name ?? '').trim().split(/\s+/)[0];
  const currentRole = career?.currentPosition?.name ?? null;
  const nextRole = career?.nextPosition?.name ?? null;
  const isFinalStage = career?.readiness?.isFinalStage ?? false;
  const mDone = career?.readiness?.missions?.completed ?? 0;
  const mTotal = career?.readiness?.missions?.total ?? 0;
  // No dedicated "focus mission" field on this branch's career API — the
  // teacher's pinned choice lives as `isTargeted` on their own mission
  // progress row.
  const pinnedFocusId = career?.missions.find(m => m.progress?.isTargeted)?.id ?? null;
  const focus = pickFocus(career?.missions ?? [], pinnedFocusId);
  // Distinguishes the two reasons `focus` can be null — genuinely
  // nothing left to do vs. just nothing pinned yet — so the empty state
  // doesn't claim "all caught up" when there's plenty open, just unpicked.
  const hasOpenMissions = (career?.missions ?? []).some(m => m.progress?.status !== 'COMPLETED');
  // Level stars — filled = current level within the position, total =
  // the position's maxLevel. Reaching all-filled is the cue to promote.
  const stars = levelStars(career?.teacher?.level, career?.currentPosition?.maxLevel);

  // Never let the bar read as "empty / behind" — keep a friendly floor.
  const pct = mTotal > 0 ? Math.round((mDone / mTotal) * 100) : 0;
  const barFill = mTotal > 0 ? Math.max(8, pct) : 8;

  // Team-quarter stats — current quarter's hits/elapsed + a rough
  // pooled estimate. Mirrors the Team Pool page's monthPool logic so
  // the two surfaces never disagree on what "hit target" means.
  const teamStats = useMemo(() => {
    const months = finance?.months ?? [];
    if (months.length === 0) return null;
    const target = settingNum(settings?.expense_ratio_target, 0, 2, DEFAULT_EXPENSE_RATIO_TARGET);
    const psPct  = settingNum(settings?.profit_share_percent, 0, 1, DEFAULT_PROFIT_SHARE_PERCENT);
    const qIdx = Math.floor(new Date().getMonth() / 3);
    const idxs = [qIdx * 3, qIdx * 3 + 1, qIdx * 3 + 2];
    let hits = 0, elapsed = 0, pooled = 0;
    // Per-month hit/miss/pending, not just the totals — a milestone
    // track needs to know WHICH months hit, not just how many, so a
    // miss in the middle of the quarter renders honestly instead of
    // being smoothed into a plain percentage fill.
    const monthStates: MonthDotState[] = [];
    for (const mi of idxs) {
      const m = months[mi];
      if (!m) { monthStates.push('pending'); continue; }
      if (!m.isForecast) elapsed++;
      const ratio = m.revenue > 0 ? (m.staffCost + m.operatingCost) / m.revenue : null;
      const qualifies = ratio !== null && ratio <= target;
      if (m.isForecast) {
        monthStates.push('pending');
      } else if (qualifies) {
        hits++;
        pooled += m.revenue * psPct;
        monthStates.push('hit');
      } else {
        monthStates.push('missed');
      }
    }
    return { hits, elapsed, pooled, monthStates };
  }, [finance, settings]);

  // Annual Bonus preview — via the shared hook (not an inline re-
  // computation like teamStats above, which predates it) so this can
  // never disagree with the Pay Breakdown preview or the full Annual
  // Bonus page.
  const annualBonus = useAnnualBonusSummary(id);

  // Personal avatar colour — stable hash so the avatar always looks
  // vibrant without depending on the (currently hidden) leaderboard cohort.
  const myAvatarColor = useMemo(() => (id ? hashAvatarColor(id) : '#94a3b8'), [id]);

  const pageStyle: React.CSSProperties = {
    // Longhand only — never combine the `padding` shorthand with the
    // `paddingTop` longhand: React can drop the longhand on re-render
    // (when async queries resolve), collapsing the top inset so the
    // greeting slides up under the floating top bar.
    // On desktop this collapses to a flat 28 (no floating bar to clear
    // — the real admin Navbar is already in-flow). On mobile, clears
    // just the back/"⋯" row (TEACHER_TOPBAR_SPACE) rather than the
    // full TEACHER_CONTENT_TOP reservation — the page's own <h1> below
    // is the title now (see titleMovedToPage in TeacherTopBar.tsx), so
    // there's no separate title row to also clear; the old extra 10px
    // breathing room just left a gap between the bar and this title.
    paddingTop: isMobile ? TEACHER_TOPBAR_SPACE : 28,
    paddingRight: isMobile ? 16 : 32,
    paddingBottom: 40,
    paddingLeft: isMobile ? 16 : 32,
    minHeight: '100vh',
    fontFamily: FONT,
    color: C.text,
    // Violet wash holds solid behind the identity hero + stats strip,
    // then fades to the calm page base. env(safe-area-inset-top) keeps
    // the fade aligned with the actual content position on iOS. Ramps
    // up gradually from 0 (not a hard C.bg→HERO_BG step at the title's
    // edge — two stops at the same position is an instant color jump,
    // which reads as a hard line under the title no matter how well
    // the colours either side "match" at that single point) so the
    // title sits in the barely-tinted start of one continuous fade,
    // not behind a discrete boundary.
    background: isMobile
      ? `linear-gradient(to bottom,
           ${C.bg}   0,
           ${HERO_BG} calc(160px + env(safe-area-inset-top)),
           ${HERO_BG} calc(220px + env(safe-area-inset-top)),
           ${C.bg}   calc(290px + env(safe-area-inset-top)),
           ${C.bg}   100%)`
      : C.bg,
  };

  const goCareer = () => navigate(`/teachers/${id}/my-career`);
  const goMissionBoard = () => navigate(`/teachers/${id}/career/missions`);
  // Current Focus card — Mission Board reads this same `focus` param
  // back and opens straight into that mission's own detail popup, not
  // just the Career hub the teacher would then have to hunt through
  // again. With nothing pinned, goes straight to the board to pick
  // one (same destination Career's own "Browse missions" CTA uses) —
  // there's nothing to jump into a detail popup for yet.
  const goFocusMission = () => {
    if (focus) navigate(`/teachers/${id}/career/missions?focus=${focus.id}`);
    else goMissionBoard();
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 10.5, fontWeight: 800, color: C.muted,
    textTransform: 'uppercase', letterSpacing: '0.09em', margin: '0 2px 8px',
  };

  return (
    <div style={pageStyle}>
      {/* 640 was really only ever a "don't stretch too wide" safety cap
          for a mobile-first page — real phone viewports never come
          close to it, so it went untested at any width that actually
          hits it until this page got a direct desktop entry point (the
          Navbar's own "My Profile" link). A bit wider there so the
          cards don't read as a narrow column stranded on an otherwise
          empty page. */}
      <div style={{ maxWidth: isMobile ? 640 : 760, margin: '0 auto' }}>

        {/* Page title — lives here as plain content (same left margin
            as every card below it), not in the shared floating bar.
            TeacherTopBar suppresses its own at-rest title for this
            route to match; it still shows a small centered version
            once scrolled (see TeacherTopBar.tsx's titleMovedToPage). */}
        {isMobile && (
          <h1 style={{
            margin: '0 0 16px', paddingLeft: 4, fontSize: 30, fontWeight: 800,
            color: C.textStrong, letterSpacing: '-0.02em',
          }}>
            Home
          </h1>
        )}

        {/* ── Identity hero ────────────────────────────────────── */}
        {/* Avatar + name + role + tier stars, all on one card. Makes
            the page feel personal at first glance — the teacher sees
            themselves before they see any data. */}
        <button
          type="button"
          onClick={() => navigate(`/teachers/${id}/settings`)}
          style={{
            display: 'flex', alignItems: 'center', gap: 14, width: '100%',
            textAlign: 'left', font: 'inherit', cursor: 'pointer', color: 'inherit',
            background: C.card, border: `1px solid ${C.cardBorder}`,
            borderRadius: 18, padding: '16px 18px', marginBottom: 12,
            boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <div style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: myAvatarColor, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 22, letterSpacing: '-0.01em',
            boxShadow: '0 0 0 4px rgba(124,58,237,0.10), 0 2px 6px rgba(15,23,42,0.14)',
          }}>
            {(firstName || '?').charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 20, fontWeight: 800, color: C.textStrong,
              letterSpacing: '-0.02em', lineHeight: 1.15,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {firstName || 'Welcome back'}
            </div>
            <div style={{
              marginTop: 4, display: 'flex', alignItems: 'center',
              gap: 8, flexWrap: 'wrap',
            }}>
              {currentRole && (
                <span style={{ fontSize: 12.5, fontWeight: 700, color: C.muted }}>
                  {currentRole}
                </span>
              )}
              {stars.filled > 0 && (
                <span
                  style={{ display: 'inline-flex', gap: 2 }}
                  title={`${stars.filled}-star ${currentRole ?? 'teacher'}`}
                >
                  {Array.from({ length: stars.filled }, (_, i) => (
                    <FontAwesomeIcon
                      key={i}
                      icon={faStar}
                      style={{ fontSize: 10.5, color: C.pAccent }}
                    />
                  ))}
                </span>
              )}
            </div>
          </div>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 13, color: C.mutedSoft, flexShrink: 0 }} />
        </button>

        {/* ── Current Focus ────────────────────────────────────── */}
        <div style={sectionLabel}>Current Focus</div>
        <button
          type="button"
          onClick={goFocusMission}
          style={{
            display: 'flex', alignItems: 'center', gap: 14, width: '100%',
            textAlign: 'left', font: 'inherit', cursor: 'pointer', color: 'inherit',
            marginBottom: 26,
            background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16,
            padding: '16px 16px',
            boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <div style={{
            width: 42, height: 42, borderRadius: 13, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: C.pSoft, color: C.pAccent, fontSize: 17,
            border: `1px solid ${C.pBorder}`,
          }}>
            <FontAwesomeIcon icon={faBullseye} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 15, fontWeight: 800, color: C.textStrong, letterSpacing: '-0.01em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {focus ? focus.title : hasOpenMissions ? 'Pick your next focus' : "You're all caught up"}
            </div>
            <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: 600, color: C.muted }}>
              {focus
                ? (focus.required
                    ? (nextRole ? `Required for promotion to ${nextRole}` : 'A required step')
                    : (nextRole ? `A step toward ${nextRole}` : 'A growth step'))
                : hasOpenMissions
                  ? 'Pin a mission from the board to start growing your skills.'
                  : 'Nice work — explore what\'s next below.'}
            </div>
          </div>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 13, color: C.mutedSoft, flexShrink: 0 }} />
        </button>

        {/* ── Growth Snapshot ──────────────────────────────────── */}
        <div style={sectionLabel}>Career</div>
        <button
          type="button"
          onClick={goCareer}
          style={{
            display: 'block', width: '100%', textAlign: 'left', font: 'inherit',
            cursor: 'pointer', color: 'inherit', marginBottom: 26,
            background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 18,
            padding: '16px 16px',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {/* Status shell — no icon tile. Role transition is the visual
              anchor, progress bar carries the rest. */}
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 8,
            flexWrap: 'wrap', marginBottom: 14,
          }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: C.textStrong, letterSpacing: '-0.01em' }}>
              {currentRole ?? 'Your role'}
            </span>
            {!isFinalStage && nextRole && (
              <>
                <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 10, color: C.mutedSoft }} />
                <span style={{ fontSize: 14.5, fontWeight: 700, color: C.pDeep }}>{nextRole}</span>
              </>
            )}
          </div>

          {isFinalStage ? (
            <div style={{ fontSize: 13, fontWeight: 700, color: C.pDeep }}>
              You've reached the top role — keep shining.
            </div>
          ) : (
            <>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                marginBottom: 8,
              }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: C.muted }}>
                  Missions
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: C.pDeep, fontVariantNumeric: 'tabular-nums' }}>
                  {pct}% complete
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: '#efeafe', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${barFill}%`, borderRadius: 999,
                  background: 'linear-gradient(90deg, #a78bfa, #7c3aed)',
                  transition: 'width 600ms cubic-bezier(0.4,0,0.2,1)',
                }} />
              </div>
              <div style={{ marginTop: 9, fontSize: 12, fontWeight: 600, color: C.muted }}>
                {mTotal === 0
                  ? 'Your growth path appears here once your role is set.'
                  : mDone >= mTotal
                    ? "All steps done — you're ready for what's next."
                    : `On the way to ${nextRole ?? 'your next role'}.`}
              </div>
            </>
          )}
        </button>

        {/* ── Team this month (team pool preview) ──────────────── */}
        {/* Collective lane — sits next to the personal "This month"
            card so Home shows both motivational engines daily. Adaptive
            headline tells the team's story without exposing raw
            finances. Tap → the full Team Pool page. */}
        {teamStats && (() => {
          const h = pickTeamHeadline(teamStats.hits, teamStats.elapsed, teamStats.pooled);
          const remaining = 3 - teamStats.elapsed;
          return (
            <>
              <div style={sectionLabel}>Profit Sharing Pool</div>
              <Link
                to={`/teachers/${id}/my-compensation/pools`}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 12, width: '100%',
                  textDecoration: 'none', color: 'inherit',
                  marginBottom: 26,
                  background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16,
                  padding: '16px 16px',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 13, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${h.color}1f`, color: h.color, fontSize: 17,
                  }}>
                    <FontAwesomeIcon icon={h.icon} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      fontSize: 14, fontWeight: 800, color: C.textStrong, letterSpacing: '-0.01em',
                    }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {h.headline}
                      </span>
                      {/* No RM figure here at all now — Home leads
                          entirely with the milestone track (the thing a
                          teacher can actually act on today); the real
                          number is one tap away on the full pool page,
                          same honest data, just not the first thing seen. */}
                      <span style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: C.mutedSoft }}>
                        See target ›
                      </span>
                    </div>
                  </div>
                  <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 13, color: C.mutedSoft, flexShrink: 0 }} />
                </div>
                <MilestoneTrack states={teamStats.monthStates} color={h.color} />
                <div style={{
                  fontSize: 11.5, fontWeight: 600, color: C.mutedSoft,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {remainingLabel(remaining, 'quarter')}
                </div>
              </Link>
            </>
          );
        })()}

        {/* ── Annual Bonus preview ──────────────────────────────── */}
        {/* Same card language as Profit Sharing Pool above — the two
            live pool previews sit together so Home shows every honest-
            money lever, not just the quarterly one. Sourced from the
            shared hook (not an inline recompute) so it can never
            disagree with the Pay Breakdown preview or the full page. */}
        {!annualBonus.isLoading && (() => {
          const onStreak = annualBonus.hitsCount === annualBonus.elapsedCount && annualBonus.hitsCount > 0;
          const abColor = onStreak ? '#16a34a' : '#7c3aed';
          const abStates: MonthDotState[] = annualBonus.monthlyPools.map(m =>
            m.isForecast ? 'pending' : m.hit ? 'hit' : 'missed');
          const remaining = 12 - annualBonus.elapsedCount;
          return (
            <>
              <div style={sectionLabel}>Annual Bonus Pool</div>
              <Link
                to={`/teachers/${id}/my-compensation/annual-bonus`}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 12, width: '100%',
                  textDecoration: 'none', color: 'inherit',
                  marginBottom: 26,
                  background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16,
                  padding: '16px 16px',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 13, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${abColor}1f`, color: abColor, fontSize: 17,
                  }}>
                    <FontAwesomeIcon icon={faTrophy} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      fontSize: 14, fontWeight: 800, color: C.textStrong, letterSpacing: '-0.01em',
                    }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {onStreak ? 'On a streak!' : 'Building up'}
                      </span>
                      <span style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: C.mutedSoft }}>
                        See target ›
                      </span>
                    </div>
                  </div>
                  <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 13, color: C.mutedSoft, flexShrink: 0 }} />
                </div>
                <MilestoneTrack states={abStates} color={abColor} />
                <div style={{
                  fontSize: 11.5, fontWeight: 600, color: C.mutedSoft,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {remainingLabel(remaining, 'year')}
                </div>
              </Link>
            </>
          );
        })()}


      </div>
    </div>
  );
}
