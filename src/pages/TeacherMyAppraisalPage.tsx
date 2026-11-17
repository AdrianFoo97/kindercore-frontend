import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faClipboardCheck } from '@fortawesome/free-solid-svg-icons';
import { MyAppraisalTasksCard } from './teacherHome/MyAppraisalTasksCard.js';
import { fetchTeacherAppraisals } from '../api/teacher-appraisals.js';
import { TEACHER_CONTENT_TOP } from '../components/common/TeacherTopBar.js';
import LoadingSpinner from '../components/common/LoadingSpinner.js';
import { useScoreBand } from './appraisals/useScoreBand.js';
import { HISTORY_PAGE_MONTHS, groupByQuarter, withinLastMonths } from './myAppraisalHistory.js';
import FormModal from '../components/common/FormModal.js';
import type { TeacherAppraisal } from '../api/teacher-appraisals.js';

// ─────────────────────────────────────────────────────────────────────────────
// My Appraisal — read-only spoke off the Pay hub, right after Benefits &
// Perks (the card that already gates on "reach X appraisal"). Same
// ['teacher-appraisals', teacherId] data the admin AppraisalTab and the
// Career readiness pill already use — this just surfaces the teacher's
// own history, no edit controls (recording scores stays an HR action).
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
  mutedSoft: '#64748b',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
  primaryBorder: '#c7d2fe',
  primaryDeep: '#4338ca',
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function TeacherMyAppraisalPage() {
  const { id } = useParams<{ id: string }>();
  const bandOf = useScoreBand();
  const { data, isLoading } = useQuery({
    queryKey: ['teacher-appraisals', id],
    queryFn: () => fetchTeacherAppraisals(id!),
    enabled: !!id,
  });

  const items = [...(data?.items ?? [])].sort((a, b) => b.year - a.year || b.month - a.month);
  const ytd = data?.yearToDate;
  const ytdCount = ytd ? items.filter(it => it.year === ytd.year).length : 0;
  // The last 12 months to start; reaching the bottom shows 12 more, until there's nothing older.
  const [shownMonths, setShownMonths] = useState(HISTORY_PAGE_MONTHS);
  /** A hand-recorded month opened in a sheet. */
  const [openMonth, setOpenMonth] = useState<TeacherAppraisal | null>(null);
  const now = new Date();
  const shown = withinLastMonths(items, { year: now.getFullYear(), month: now.getMonth() }, shownMonths);
  const hasMore = shown.length < items.length;
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bottom.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setShownMonths(m => m + HISTORY_PAGE_MONTHS); });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, shownMonths]);
  const byQuarter = groupByQuarter(shown, data?.quarters ?? []);

  return (
    <div style={s.page}>
      <div style={s.inner}>
        {/* Page title — lives here as plain content, not in the shared
            floating bar (which suppresses its own at-rest title for
            every teacher page now — see TeacherTopBar.tsx's
            titleMovedToPage). Same treatment as Home/Pay hub/Guides. */}
        <h1 style={{
          margin: '0 0 16px', paddingLeft: 4, fontSize: 30, fontWeight: 800,
          color: C.textStrong, letterSpacing: '-0.02em',
        }}>
          My Appraisal
        </h1>
        {/* One waiting for them to read and confirm shows first. */}
        {id && <MyAppraisalTasksCard teacherId={id} sectionLabelStyle={s.sectionLabel} />}

        {/* ── Summary ─────────────────────────────────────────── */}
        <div style={s.summaryCard}>
          <div style={s.summaryIcon}>
            <FontAwesomeIcon icon={faClipboardCheck} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.summaryLabel}>Year to date</div>
            <div style={s.summaryValue}>
              {ytd?.average != null ? `${Math.round(ytd.average)}%` : '—'}
            </div>
            <div style={s.summarySub}>
              {ytd ? `${ytd.year} so far · ${ytdCount} ${ytdCount === 1 ? 'month' : 'months'}` : 'No records yet'}
            </div>
          </div>
        </div>

        {/* ── History ─────────────────────────────────────────── */}
        <div style={s.sectionLabel}>History</div>
        {isLoading ? (
          <div style={s.emptyCard}>
            <p style={{ margin: 0, fontSize: 13, color: C.mutedSoft }}><LoadingSpinner inline /></p>
          </div>
        ) : items.length === 0 ? (
          <div style={s.emptyCard}>
            <p style={{ margin: 0, fontSize: 13, color: C.mutedSoft }}>
              No appraisals recorded yet.
            </p>
          </div>
        ) : (
          byQuarter.map((q, qi) => (
          <div key={`${q.year}-${q.quarter}`} style={{ marginBottom: QUARTER_GAP }}>
            {/* A divider at each new year (not above the first). */}
            {qi > 0 && byQuarter[qi - 1].year !== q.year && (
              <div role="separator" aria-label={String(q.year)} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 4px 16px' }}>
                <span style={{ flex: 1, height: 1, background: C.divider }} />
                <span style={{ fontSize: 13, fontWeight: 800, color: C.muted }}>{q.year}</span>
                <span style={{ flex: 1, height: 1, background: C.divider }} />
              </div>
            )}
            {/* The quarter and its average (the months' average, from the server). */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 4px 8px', fontSize: 14, fontWeight: 800, color: C.text }}>
              <span>Q{q.quarter} {q.year}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: q.average == null ? C.muted : bandOf(q.average).color }}>{q.average == null ? '—' : `Quarter ${Math.round(q.average)}%`}</span>
            </div>
          <div style={s.historyCard}>
            {q.items.map((it, i) => {
              const band = bandOf(it.score);
              const rowStyle = { ...s.row, borderTop: i === 0 ? 'none' : `1px solid ${C.divider}` };
              const body = (
                <>
                  {/* Just the month and the mark — the details are a tap away (the appraisal itself). */}
                  <div style={{ flex: 1, minWidth: 0, alignSelf: 'center' }}>
                    <div style={s.rowMonth}>{MONTH_LABELS[it.month]} {it.year}</div>
                  </div>
                  <span style={{ ...s.scorePill, background: band.bg, color: band.color }}>
                    {Math.round(it.score)}%
                  </span>
                  <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 13, color: C.muted, alignSelf: 'center' }} />
                </>
              );
              // Scored with a form: opens the appraisal — the exact form it was scored on, and every score.
              return it.engineAppraisalId ? (
                <Link key={it.id} to={`/appraisals/${it.engineAppraisalId}?app=teacher`} style={{ ...rowStyle, textDecoration: 'none', color: 'inherit' }}>{body}</Link>
              ) : (
                <button key={it.id} type="button" onClick={() => setOpenMonth(it)} style={{ ...rowStyle, width: '100%', border: 'none', borderTop: rowStyle.borderTop, background: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>{body}</button>
              );
            })}
          </div>
          </div>
          ))
        )}
        {/* A month recorded by hand (no form behind it): its score and the appraiser's comment. */}
        {openMonth && (
          <FormModal title={`${MONTH_LABELS[openMonth.month]} ${openMonth.year}`} onClose={() => setOpenMonth(null)}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: bandOf(openMonth.score).color }}>{Math.round(openMonth.score)}%</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: bandOf(openMonth.score).color }}>{bandOf(openMonth.score).label}</span>
            </div>
            <div style={{ marginTop: 16, fontSize: 13, fontWeight: 700, color: C.muted }}>From your appraiser</div>
            <p style={{ margin: '4px 0 0', fontSize: 15, color: openMonth.notes ? C.text : C.muted, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{openMonth.notes || 'No comments.'}</p>
          </FormModal>
        )}
        {/* Reaching this loads the next 12 months. */}
        {hasMore && <div ref={bottom} style={{ padding: 16, textAlign: 'center' }}><LoadingSpinner inline /></div>}
      </div>
    </div>
  );
}

/** Space between quarters in the history. */
const QUARTER_GAP = 32;

const s: Record<string, React.CSSProperties> = {
  page: {
    paddingTop: TEACHER_CONTENT_TOP,
    paddingRight: 16,
    paddingBottom: 40,
    paddingLeft: 16,
    background: C.bg,
    minHeight: '100vh',
    fontFamily: FONT,
    color: C.text,
  },
  inner: { maxWidth: 640, margin: '0 auto' },

  summaryCard: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: C.card, border: `1px solid ${C.primaryBorder}`, borderRadius: 18,
    padding: '16px 18px', marginBottom: 22,
    boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
  },
  summaryIcon: {
    width: 48, height: 48, borderRadius: 14, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: C.primarySoft, color: C.primaryDeep, fontSize: 19,
  },
  summaryLabel: {
    fontSize: 11, fontWeight: 800, color: C.primary,
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
  },
  summaryValue: {
    fontSize: 26, fontWeight: 800, color: C.textStrong,
    letterSpacing: '-0.02em', lineHeight: 1.2, marginTop: 2,
  },
  summarySub: { fontSize: 12, color: C.muted, marginTop: 2 },

  sectionLabel: {
    fontSize: 11, fontWeight: 800, color: C.muted,
    textTransform: 'uppercase' as const, letterSpacing: '0.09em', margin: '0 2px 8px',
  },
  emptyCard: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16,
    padding: '28px 18px', textAlign: 'center' as const,
  },
  historyCard: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: 12, padding: '14px 16px',
  },
  rowMonth: { fontSize: 14, fontWeight: 800, color: C.textStrong },
  scorePill: {
    flexShrink: 0, padding: '4px 12px', borderRadius: 999,
    fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums' as const,
  },
};
