import { useParams, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faArrowTrendUp } from '@fortawesome/free-solid-svg-icons';
import {
  MonthlySalaryBreakdown,
  useCompensationData,
} from './TeacherCompensationPage.js';
import { useTeamPoolSummary } from '../hooks/useTeamPoolSummary.js';
import { useAnnualBonusSummary } from '../hooks/useAnnualBonusSummary.js';
import { TEACHER_CONTENT_TOP } from '../components/common/TeacherTopBar.js';
import { MilestoneTrack, remainingLabel, type MonthDotState } from '../components/common/MilestoneTrack.js';

// ─────────────────────────────────────────────────────────────────────────────
// Pay Breakdown — the "anatomy" spoke of the new gamified pay hub
// (cousin of the Career Journey page). Four sections stacked:
//   1. MonthlySalaryBreakdown (full, non-compact table) — what you earn now.
//   2. GrowMyPayLink — a plain nav card into the existing "Ways your
//      earnings can grow" page (MoneyQuests, at /my-compensation/earn-
//      more), not the content inline. Sits right under the pay total so
//      it answers the natural next question ("how could this grow")
//      immediately — but stays a link card, not the content itself: it
//      used to be its own hub-level spoke with an urgent "quest"
//      callout on the Pay hub, pulled from there since growing your pay
//      is occasional, not a daily check (see TeacherPayPage.tsx), and
//      it briefly lived inline here too, which just traded one form of
//      clutter for another.
//   3. SharedRewardsPreview — a live Team Pool (quarterly profit-share)
//      snapshot: real RM figure, month-by-month hit/miss, estimated
//      share, linking through to the full Team Pool page. Title lives
//      inside the card ("Profit Sharing Pool", same pattern as "Total
//      Monthly Pay" in section 1) rather than as a separate floating
//      heading above it.
//   4. AnnualBonusPreview — same idea, year-scoped (12 months, via
//      useAnnualBonusSummary — mirrors AnnualBonusPage.tsx's math the
//      same way useTeamPoolSummary mirrors ProfitSharingPage.tsx),
//      linking to TeacherMyAnnualBonusPage. No month-chip grid here —
//      12 don't fit one row the way a quarter's 3 do; that detail
//      lives on the full page.
// Both live previews replace what used to be CompanyGoalRewards' two
// static conditions-list cards here (Quarterly Profit Sharing, Annual
// Bonus) — that static version now lives on Benefits & Perks instead
// (a "read once" rule set, not a number that changes monthly).
// The HR page and legacy teacher pages are untouched — this only
// consumes their shared data hook.
// ─────────────────────────────────────────────────────────────────────────────

const FONT =
  '"Segoe UI", Roboto, Arial, sans-serif';

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eceef2',
  divider: '#eef0f3',
  text: '#475569',
  textStrong: '#334155',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
  primaryBorder: '#c7d2fe',
  pDeep: '#5b21b6',
  green: '#16a34a',
};

function fmtRM0(n: number): string {
  return `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function SharedRewardsPreview({ teacherId }: { teacherId: string }) {
  const {
    year, quarter, monthlyPools, poolAmount, hitsCount, elapsedCount,
    myShare, mySharePct, isEligible, isLoading,
  } = useTeamPoolSummary(teacherId);

  if (isLoading) return null;

  const onStreak = hitsCount === elapsedCount && hitsCount > 0;
  const trackColor = onStreak ? C.green : C.pDeep;
  const states: MonthDotState[] = monthlyPools.map(m =>
    m.isForecast ? 'pending' : m.hit ? 'hit' : 'missed');

  return (
    <section style={{ marginTop: 10 }}>
      {/* No separate "Shared Rewards" heading above the card — the
          card carries its own title internally now ("Profit Sharing
          Pool"), same pattern as "Total Monthly Pay" inside the card
          above, instead of a floating section header repeating the
          same idea the card already states. */}
      <Link
        to={`/teachers/${teacherId}/my-compensation/pools`}
        style={{
          display: 'block', textDecoration: 'none', color: 'inherit',
          background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16,
          padding: '16px 18px', boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '0.07em',
            }}>
              Profit Sharing Pool
            </div>
            {/* Deliberately smaller than the guaranteed Total Monthly Pay
                hero above — this is a variable, unguaranteed estimate
                (see the disclaimer on the full Team Pool page), so it
                shouldn't visually outrank the real guaranteed number. */}
            <div style={{
              marginTop: 4, fontSize: 20, fontWeight: 800, color: C.pDeep,
              letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
            }}>
              {fmtRM0(poolAmount)}
            </div>
            <div style={{ marginTop: 2, fontSize: 12, fontWeight: 600, color: C.muted }}>
              {quarter.label} {year} · {hitsCount} of 3 months hit target so far
            </div>
          </div>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 13, color: C.mutedSoft, marginTop: 4, flexShrink: 0 }} />
        </div>

        {/* Milestone track — same segmented hit/miss/pending visual as
            the Home pool previews, so a teacher reads "which months
            hit" the same way everywhere. The RM figure above stays
            (unlike Home's version): this page is a deliberate look-in,
            not a passive glance, so hiding the real number here would
            just add a tap for no reason. */}
        <div style={{ marginTop: 14 }}>
          <MilestoneTrack states={states} color={trackColor} />
          <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 600, color: C.mutedSoft }}>
            {remainingLabel(3 - elapsedCount, 'quarter')}
          </div>
        </div>

        <div style={{
          marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.divider}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: C.muted }}>Your estimated share</span>
          <span style={{
            fontSize: 15, fontWeight: 800, color: C.textStrong,
            fontVariantNumeric: 'tabular-nums', flexShrink: 0,
          }}>
            {isEligible ? `${fmtRM0(myShare)} · ~${mySharePct}%` : 'Not eligible yet'}
          </span>
        </div>
      </Link>
    </section>
  );
}

// Same card language as SharedRewardsPreview above (title inside the
// card, no floating heading) but no month-chip grid — 12 months don't
// fit one row the way a quarter's 3 do, and cramming them small would
// just be noise in a preview; the full grid lives on the detail page
// this links to.
function AnnualBonusPreview({ teacherId }: { teacherId: string }) {
  const {
    year, monthlyPools, poolAmount, hitsCount, elapsedCount,
    myShare, mySharePct, isEligible, isLoading,
  } = useAnnualBonusSummary(teacherId);

  if (isLoading) return null;

  const onStreak = hitsCount === elapsedCount && hitsCount > 0;
  const trackColor = onStreak ? C.green : C.pDeep;
  const states: MonthDotState[] = monthlyPools.map(m =>
    m.isForecast ? 'pending' : m.hit ? 'hit' : 'missed');

  return (
    <section style={{ marginTop: 10 }}>
      <Link
        to={`/teachers/${teacherId}/my-compensation/annual-bonus`}
        style={{
          display: 'block', textDecoration: 'none', color: 'inherit',
          background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16,
          padding: '16px 18px', boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '0.07em',
            }}>
              Annual Bonus Pool
            </div>
            <div style={{
              marginTop: 4, fontSize: 20, fontWeight: 800, color: C.pDeep,
              letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
            }}>
              {fmtRM0(poolAmount)}
            </div>
            <div style={{ marginTop: 2, fontSize: 12, fontWeight: 600, color: C.muted }}>
              {year} · {hitsCount} of 12 months hit target so far
            </div>
          </div>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 13, color: C.mutedSoft, marginTop: 4, flexShrink: 0 }} />
        </div>

        {/* Milestone track — same treatment as the quarterly pool above
            and Home's previews. 12 segments read fine here since it's
            a flexible bar, not fixed-width labeled chips (which is why
            this card never had a per-month grid before). */}
        <div style={{ marginTop: 14 }}>
          <MilestoneTrack states={states} color={trackColor} />
          <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 600, color: C.mutedSoft }}>
            {remainingLabel(12 - elapsedCount, 'year')}
          </div>
        </div>

        <div style={{
          marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.divider}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: C.muted }}>Your estimated share</span>
          <span style={{
            fontSize: 15, fontWeight: 800, color: C.textStrong,
            fontVariantNumeric: 'tabular-nums', flexShrink: 0,
          }}>
            {isEligible ? `${fmtRM0(myShare)} · ~${mySharePct}%` : 'Not eligible yet'}
          </span>
        </div>
      </Link>
    </section>
  );
}

// Self-contained card, no eyebrow/title floating above it (unlike
// SharedRewardsPreview below) — "Ways your earnings can grow" is the
// card's own heading now, not a separate section label repeating the
// same idea twice.
function GrowMyPayLink({ teacherId }: { teacherId: string }) {
  return (
    <Link
      to={`/teachers/${teacherId}/my-compensation/earn-more`}
      style={{
        display: 'block',
        // MonthlySalaryBreakdown renders its own <section> with a
        // 56px marginBottom (s.section, in TeacherCompensationPage.tsx
        // — sized for that desktop admin page's rhythm, no style prop
        // to override it here). Adjacent margins collapse to the
        // LARGER value, not the sum, so a small positive marginTop
        // here did nothing — the 56px always won. A negative margin
        // combines with it correctly instead (56 + -40 = 16px, CSS's
        // actual collapsing rule for mixed-sign margins).
        marginTop: -40,
        textDecoration: 'none', color: 'inherit',
        background: `linear-gradient(135deg, ${C.primary}0f, ${C.primary}03), ${C.card}`,
        border: `1px solid ${C.primaryBorder}`, borderRadius: 16,
        padding: '18px', boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 13, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#fff', color: C.primary, fontSize: 18,
          border: `1px solid ${C.primaryBorder}`,
        }}>
          <FontAwesomeIcon icon={faArrowTrendUp} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.textStrong, letterSpacing: '-0.01em' }}>
            Ways your earnings can grow
          </div>
          <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: 600, color: C.muted }}>
            Promotion, qualifications & commission
          </div>
        </div>
        <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 13, color: C.primary, flexShrink: 0 }} />
      </div>
    </Link>
  );
}

export default function TeacherPayBreakdownPage() {
  const { id } = useParams<{ id: string }>();
  // Bare call — this is the render-time side effect that populates the
  // module-level `compensationData` object MonthlySalaryBreakdown reads
  // from (see the "compensationData is module-level mutable state" note
  // in CLAUDE.md). Nothing on this page needs the returned value.
  useCompensationData(id);

  return (
    <div style={{
      paddingTop: TEACHER_CONTENT_TOP,
      paddingRight: 12,
      paddingBottom: 28,
      paddingLeft: 12,
      background: C.bg, minHeight: '100vh',
      fontFamily: FONT, color: C.text,
    }}>
      {/* MonthlySalaryBreakdown renders its own card per the non-compact
          SectionHeader variant — built to sit directly on a page
          background, not inside a second wrapping card. Admin's own
          usage (TeacherCompensationPage.tsx) wraps the `compact`
          variant in a card instead — a different prop, untouched here.
          It also renders its own "Pay Breakdown" <h2> at page-title size
          (30px) — explicitly built to BE this page's title, not a
          subsection label (see that component's own comment) — so this
          page doesn't need a second one of its own above it. A quick
          pre-beta sweep's h1-only selector missed that h2 and led to a
          real duplicate title bug here; fixed by not adding one, rather
          than by hunting the h2 down and restyling it. */}
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <MonthlySalaryBreakdown />
        {/* Right under "what you earn now" so it answers the natural
            next question ("how could this grow") before Shared Rewards —
            still just a link card into the full page, not the content
            itself, per the earlier "not a daily focus" direction. */}
        {id && <GrowMyPayLink teacherId={id} />}
        {id && <SharedRewardsPreview teacherId={id} />}
        {id && <AnnualBonusPreview teacherId={id} />}
      </div>
    </div>
  );
}
