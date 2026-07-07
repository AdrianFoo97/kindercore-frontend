import { useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { fetchTeacherCareer } from '../api/career-missions.js';
import { CareerJourneyVertical } from './TeacherCareerPage.js';

// ─────────────────────────────────────────────────────────────────────────────
// Teacher-facing Career Journey — drilldown from the My Career hub.
// Hosts only the vertical ladder so the teacher gets a focused view of
// the full promotion path on a single screen, mirroring the HR version
// but without HR-only sections (appraisal review, supervisor approval).
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eceef2',
  text: '#0f172a',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
};

export default function TeacherMyJourneyPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['teacher-career', id],
    queryFn: () => fetchTeacherCareer(id!),
    enabled: !!id,
  });

  // Auto-scroll to the current stage once data has rendered so the
  // teacher lands directly on "I am here" instead of having to scroll
  // past completed stages.
  //
  // Strategy: walk up to find every scrollable ancestor and centre
  // the current element inside EACH of them — same approach as the
  // browser's native scrollIntoView({block:'center'}) but more
  // resilient when the layout has nested scroll containers (app
  // shell + page wrapper). We also fall back to window scroll if
  // nothing nested is actually scrollable.
  const scrolledRef = useRef(false);
  useEffect(() => {
    if (!data || scrolledRef.current) return;
    // Custom smooth-scroll with a configurable duration. The
    // browser's native `behavior: 'smooth'` runs ~300ms which feels
    // abrupt for a "let me show you where you are" reveal; this
    // gives a calmer ~900ms ease-in-out.
    const SCROLL_DURATION = 900;
    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const animateScroll = (
      getCurrent: () => number,
      setCurrent: (y: number) => void,
      to: number,
    ) => {
      const from = getCurrent();
      const change = to - from;
      if (Math.abs(change) < 1) return;
      const start = performance.now();
      const step = (now: number) => {
        const elapsed = now - start;
        const t = Math.min(1, elapsed / SCROLL_DURATION);
        setCurrent(from + change * easeInOutCubic(t));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const run = () => {
      // Prefer the pulsing "Level N" bead inside the current segment
      // — that's the precise "you are here" pin. Falls back to the
      // current-stage row if levels aren't configured.
      const beadEl = document.querySelector('[data-current-level-bead]') as SVGGraphicsElement | null;
      const el = (beadEl as unknown as HTMLElement | null)
        ?? (document.querySelector('[data-stage-state="current"]') as HTMLElement | null);
      if (!el) return;
      scrolledRef.current = true;

      const isScrollable = (node: HTMLElement): boolean => {
        const style = window.getComputedStyle(node);
        return /(auto|scroll)/.test(style.overflowY)
          && node.scrollHeight > node.clientHeight + 1;
      };
      const scrollContainerToCentre = (container: HTMLElement, target: Element) => {
        const tRect = target.getBoundingClientRect();
        const cRect = container.getBoundingClientRect();
        const offsetTop = (tRect.top - cRect.top) + container.scrollTop;
        const desired = Math.max(0, offsetTop - (container.clientHeight - tRect.height) / 2);
        animateScroll(
          () => container.scrollTop,
          (y) => { container.scrollTop = y; },
          desired,
        );
      };

      let found = false;
      let node: HTMLElement | null = (el as Element).parentElement;
      while (node && node !== document.body) {
        if (isScrollable(node)) {
          scrollContainerToCentre(node, el);
          found = true;
          break;
        }
        node = node.parentElement;
      }
      if (!found) {
        const r = el.getBoundingClientRect();
        const target = Math.max(0, window.scrollY + r.top - (window.innerHeight - r.height) / 2);
        animateScroll(
          () => window.scrollY,
          (y) => window.scrollTo(0, y),
          target,
        );
      }
    };
    // Two RAFs lets the cubic bezier SVG paths fully render before we
    // measure positions; setTimeout adds a small extra buffer for
    // glow-animation initial paint.
    const t = window.setTimeout(() => {
      requestAnimationFrame(() => requestAnimationFrame(run));
    }, 80);
    return () => window.clearTimeout(t);
  }, [data]);

  return (
    <div style={s.page}>
      <style>{`
        .tmj-back-btn:hover { background: #f1f5f9 !important; color: ${C.text} !important; border-color: #cbd5e1 !important; }
      `}</style>

      <div style={s.inner}>
        {/* Floating back button (replaces the breadcrumb). Stays in
            the upper-left corner so the centered title can dominate
            the page intro. */}
        <button
          onClick={() => navigate(`/teachers/${id}/my-career`)}
          className="tmj-back-btn"
          style={s.floatingBack}
          title="Back"
        >
          <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 12 }} />
        </button>

        {/* Page intro — centered, punchy framing so the timeline
            below reads as the answer to a clear question. */}
        <div style={s.intro}>
          <div style={s.eyebrow}>The Path Ahead</div>
          <h1 style={s.heading}>Your Career Journey</h1>
        </div>

        {isLoading && (
          <div style={s.state}>Loading career journey…</div>
        )}
        {isError && (
          <div style={{ ...s.state, color: '#b91c1c' }}>
            <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: 6 }} />
            Couldn't load career journey. Please retry.
          </div>
        )}
        {data && (() => {
          const ladder = data.ladder ?? data.positions ?? [];
          if (ladder.length === 0) {
            return <div style={s.state}>No career ladder configured yet.</div>;
          }
          const isCurrentInLadder = data.readiness?.isCurrentInLadder
            ?? (!!data.currentPosition && ladder.some(p => p.positionId === data.currentPosition!.positionId));
          return (
            <CareerJourneyVertical
              ladder={ladder}
              currentPositionId={data.currentPosition?.positionId ?? data.teacher.positionId ?? null}
              currentLevel={data.teacher.level}
              nextPositionId={data.nextPosition?.positionId ?? null}
              nextPositionRequirements={data.nextPositionRequirements ?? []}
              isCurrentInLadder={isCurrentInLadder}
              missionsCompleted={data.readiness.missions.completed}
              missionsTotal={data.readiness.missions.total}
              missionPct={data.missionPct ?? 0}
              appraisalRequired={data.readiness.appraisal?.required ?? null}
              appraisalCurrent={data.readiness.appraisal?.value ?? null}
              teacherId={id}
            />
          );
        })()}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: '16px 12px 96px',  // bigger bottom padding so the Summit trophy + label breathe above the viewport edge
    background: C.bg, minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    color: C.text,
  },
  inner: { maxWidth: 640, margin: '0 auto', position: 'relative' as const },

  breadcrumb: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
    fontSize: 12, flexWrap: 'wrap', rowGap: 4,
  },
  crumbLink: { color: C.muted, textDecoration: 'none', fontWeight: 500 },
  crumbCurrent: { color: C.text, fontWeight: 600 },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 7,
    border: `1px solid ${C.cardBorder}`,
    background: C.card, color: C.muted,
    cursor: 'pointer',
    transition: 'all 160ms ease',
  },

  state: {
    background: C.card,
    border: `1px solid ${C.cardBorder}`,
    borderRadius: 14,
    padding: '24px 18px',
    textAlign: 'center',
    fontSize: 13,
    color: C.muted,
  },

  intro: {
    marginBottom: 40,
    padding: '8px 4px 0',
    textAlign: 'center' as const,
  },
  eyebrow: {
    fontSize: 10, fontWeight: 800, color: C.primary,
    textTransform: 'uppercase' as const, letterSpacing: '0.12em',
    marginBottom: 6,
  },
  heading: {
    margin: 0, fontSize: 22, fontWeight: 800, color: C.text,
    letterSpacing: '-0.022em', lineHeight: 1.15,
  },
  subheading: {
    margin: '6px 0 0', fontSize: 13, fontWeight: 500, color: C.muted,
    lineHeight: 1.45, letterSpacing: '-0.003em',
  },

  floatingBack: {
    position: 'absolute' as const,
    top: 16, left: 12,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 36, height: 36, borderRadius: 10,
    border: `1px solid ${C.cardBorder}`,
    background: C.card, color: C.muted,
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
    zIndex: 2,
  },
};
