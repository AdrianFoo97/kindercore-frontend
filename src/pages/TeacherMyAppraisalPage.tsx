import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClipboardCheck, faCircleUser } from '@fortawesome/free-solid-svg-icons';
import { fetchTeacherAppraisals } from '../api/teacher-appraisals.js';
import { TEACHER_CONTENT_TOP } from '../components/common/TeacherTopBar.js';

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
  mutedSoft: '#94a3b8',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
  primaryBorder: '#c7d2fe',
  primaryDeep: '#4338ca',
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Same banding as the admin AppraisalTab (≥80 green, 60–79 amber, <60
// red) — kept in sync by convention since both read the same score
// scale; duplicated rather than shared since it's five lines and the
// two views (edit vs read-only) have no other code in common.
function scoreColors(score: number): { bg: string; color: string } {
  if (score >= 80) return { bg: '#dcfce7', color: '#15803d' };
  if (score >= 60) return { bg: '#fef3c7', color: '#b45309' };
  return { bg: '#fee2e2', color: '#991b1b' };
}

export default function TeacherMyAppraisalPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['teacher-appraisals', id],
    queryFn: () => fetchTeacherAppraisals(id!),
    enabled: !!id,
  });

  const items = [...(data?.items ?? [])].sort((a, b) => b.year - a.year || b.month - a.month);
  const summary = data?.summary;

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
        {/* ── Summary ─────────────────────────────────────────── */}
        <div style={s.summaryCard}>
          <div style={s.summaryIcon}>
            <FontAwesomeIcon icon={faClipboardCheck} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.summaryLabel}>Average Appraisal</div>
            <div style={s.summaryValue}>
              {summary?.average != null ? `${Math.round(summary.average)}%` : '—'}
            </div>
            <div style={s.summarySub}>
              {summary
                ? `Last ${summary.windowSize} months · ${summary.recordCount} record${summary.recordCount === 1 ? '' : 's'}`
                : 'No records yet'}
            </div>
          </div>
        </div>

        {/* ── History ─────────────────────────────────────────── */}
        <div style={s.sectionLabel}>History</div>
        {isLoading ? (
          <div style={s.emptyCard}>
            <p style={{ margin: 0, fontSize: 13, color: C.mutedSoft }}>Loading…</p>
          </div>
        ) : items.length === 0 ? (
          <div style={s.emptyCard}>
            <p style={{ margin: 0, fontSize: 13, color: C.mutedSoft }}>
              No appraisals recorded yet.
            </p>
          </div>
        ) : (
          <div style={s.historyCard}>
            {items.map((it, i) => {
              const band = scoreColors(it.score);
              return (
                <div key={it.id} style={{ ...s.row, borderTop: i === 0 ? 'none' : `1px solid ${C.divider}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.rowMonth}>{MONTH_LABELS[it.month]} {it.year}</div>
                    {it.evaluatedBy && (
                      <div style={s.rowEvaluator}>
                        <FontAwesomeIcon icon={faCircleUser} style={{ fontSize: 10.5 }} />
                        {it.evaluatedBy}
                      </div>
                    )}
                    {it.notes && <div style={s.rowNotes}>{it.notes}</div>}
                  </div>
                  <span style={{ ...s.scorePill, background: band.bg, color: band.color }}>
                    {Math.round(it.score)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

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
    fontSize: 10.5, fontWeight: 800, color: C.primary,
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
  },
  summaryValue: {
    fontSize: 26, fontWeight: 800, color: C.textStrong,
    letterSpacing: '-0.02em', lineHeight: 1.2, marginTop: 2,
  },
  summarySub: { fontSize: 12, color: C.muted, marginTop: 2 },

  sectionLabel: {
    fontSize: 10.5, fontWeight: 800, color: C.muted,
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
  rowEvaluator: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 11.5, fontWeight: 600, color: C.mutedSoft, marginTop: 3,
  },
  rowNotes: { fontSize: 12.5, color: C.text, marginTop: 4, lineHeight: 1.5 },
  scorePill: {
    flexShrink: 0, padding: '4px 12px', borderRadius: 999,
    fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums' as const,
  },
};
