import React, { useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft, faChevronLeft, faChevronRight, faRoad, faTriangleExclamation,
  faCircleCheck, faCircle, faClock, faPaperPlane, faCircleInfo,
  faStar, faCheck, faTrophy,
} from '@fortawesome/free-solid-svg-icons';
import {
  fetchTeacherCareer,
  MissionWithProgress, MissionCategory, MissionStatus,
} from '../api/career-missions.js';
import { useCategoryMeta } from '../utils/missionCategoryIcons.js';
import { useIsMobile } from '../hooks/useIsMobile.js';

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardSoft: '#fafbfc',
  cardBorder: '#eceef2',
  cardBorderSoft: '#e9ecf1',
  divider: '#eef0f3',
  // Mid-grey for headings + body text — calm, never stark.
  text: '#475569',
  textSub: '#64748b',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  primary: '#5a67d8',
  primaryDeep: '#4338ca',
  primarySoft: '#eef2ff',
  primaryBorder: '#c7d2fe',
  success: '#059669',
  successSoft: '#ecfdf5',
  successBorder: '#a7f3d0',
  warning: '#d97706',
  warningSoft: '#fffbeb',
  warningBorder: '#fde68a',
  danger: '#dc2626',
  dangerSoft: '#fee2e2',
  slate: '#475569',
  slateSoft: '#f1f5f9',
};

const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

type FilterKey = 'ALL' | MissionCategory;

// ── Style helpers ────────────────────────────────────────────────────────────
// Status → all visual props for the status pill on each mission card.
// Calm palette: not-started reads as "ready to pick up", in-progress as
// "active", awaiting review as "waiting on someone else", completed as "done".
const STATUS_META: Record<MissionStatus, {
  label: string; bg: string; color: string; icon: any; cta: string;
}> = {
  PENDING:      { label: 'Not Started',     bg: C.slateSoft,    color: C.slate,   icon: faCircle,       cta: 'Start Mission' },
  IN_PROGRESS:  { label: 'In Progress',     bg: C.primarySoft,  color: C.primary, icon: faClock,        cta: 'Continue' },
  UNDER_REVIEW: { label: 'Awaiting Review', bg: C.warningSoft,  color: C.warning, icon: faPaperPlane,   cta: 'View' },
  COMPLETED:    { label: 'Completed',       bg: C.successSoft,  color: C.success, icon: faCircleCheck,  cta: 'View' },
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TeacherMissionBoardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // Back goes to wherever the teacher actually came from. `location.key`
  // is 'default' only when this is the first in-app entry (deep link /
  // refresh) — in that case there's no history to pop, so fall back to
  // the career page rather than leaving the app.
  const goBack = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(`/teachers/${id}/career`);
  };
  const { categories: missionCategories, getMeta } = useCategoryMeta();
  const { isMobile } = useIsMobile();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['teacher-career', id],
    queryFn: () => fetchTeacherCareer(id!),
    enabled: !!id,
  });

  const [filter, setFilter] = useState<FilterKey>('ALL');
  type ShowMode = 'all' | 'required' | 'optional' | 'completed';
  // Default to 'all' so mobile (which no longer has a Show
  // segmented control) lands on every section split by header,
  // not just Required. Desktop users can still switch via the
  // sidebar radios.
  const [showMode, setShowMode] = useState<ShowMode>('all');
  const [editingMission, setEditingMission] = useState<MissionWithProgress | null>(null);

  const currentPositionId = data?.currentPosition?.positionId ?? null;

  // Stable sort — high-priority required first, then required, then optional;
  // completed sink to the bottom.
  const sortedMissions = useMemo(() => {
    const ms = data?.missions ?? [];
    return [...ms].sort((a, b) => {
      const aDone = a.progress?.status === 'COMPLETED' ? 1 : 0;
      const bDone = b.progress?.status === 'COMPLETED' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      const aPri = (a.highPriority ? 0 : 1) + (a.required ? 0 : 2);
      const bPri = (b.highPriority ? 0 : 1) + (b.required ? 0 : 2);
      if (aPri !== bPri) return aPri - bPri;
      return a.displayOrder - b.displayOrder;
    });
  }, [data?.missions]);

  // Per-category {completed, total} for the achievement summary +
  // filter pills. Scoped to CURRENT-position missions only — achievements
  // are earned at a tier, so future-position missions don't inflate the
  // counts toward the achievement the teacher is working on right now.
  const counts = useMemo(() => {
    const currentMs = sortedMissions.filter(m => m.positionId === currentPositionId);
    const c: Record<string, { completed: number; total: number }> = {
      ALL: { completed: 0, total: currentMs.length },
    };
    for (const m of currentMs) {
      const done = m.progress?.status === 'COMPLETED';
      if (!c[m.category]) c[m.category] = { completed: 0, total: 0 };
      c[m.category].total += 1;
      if (done) {
        c[m.category].completed += 1;
        c.ALL.completed += 1;
      }
    }
    return c;
  }, [sortedMissions, currentPositionId]);

  // Aggregate count for the "All" track view (current position only).
  const totalStats = counts.ALL ?? { completed: 0, total: 0 };

  // Apply the category filter to the full mission list (current + future
  // positions). The 3-group split below decides where each lands.
  const filtered = useMemo(() => {
    if (filter === 'ALL') return sortedMissions;
    return sortedMissions.filter(m => m.category === filter);
  }, [sortedMissions, filter]);

  // Three-group split — Required / Optional / Completed.
  //   Required = current-position required missions, not completed
  //   Optional = current-position optional missions
  //              + ALL future-position missions (treated as optional
  //                head-start work, regardless of their `required` flag
  //                at that position) — completing one now counts toward
  //                that future position when the teacher reaches it.
  //   Completed = anything completed, sorted alphabetically by title so
  //               the trophy case reads as a clean roster.
  const requiredMissions = useMemo(
    () => filtered.filter(m =>
      m.positionId === currentPositionId
      && m.required
      && m.progress?.status !== 'COMPLETED'
    ),
    [filtered, currentPositionId],
  );
  const optionalMissions = useMemo(
    () => filtered.filter(m => {
      if (m.progress?.status === 'COMPLETED') return false;
      // Current-position optional, OR any future-position mission.
      const isCurrent = m.positionId === currentPositionId;
      if (isCurrent) return !m.required;
      return true;
    }),
    [filtered, currentPositionId],
  );
  const completedMissions = useMemo(
    () => filtered
      .filter(m => m.progress?.status === 'COMPLETED')
      .sort((a, b) => a.title.localeCompare(b.title)),
    [filtered],
  );

  // Mobile gets a soft sky-blue hero zone at the top. Instead of a
  // razor-sharp cut, the tint holds solid then eases out across a
  // gentle ~50px band centred on the mid-point of the mission track
  // summary card, so the boundary reads as a soft fade rather than a
  // hard line. Sky blue pairs cleanly with the purple primary in the
  // card without competing with it.
  const HERO_BG = '#dbeafe';
  const pageStyle = {
    ...s.page,
    ...(isMobile ? sMobile.page : null),
    ...(isMobile ? {
      background: `linear-gradient(to bottom, ${HERO_BG} 0, ${HERO_BG} 195px, ${C.bg} 245px, ${C.bg} 100%)`,
    } : null),
  };
  // Filter row: only categories that have missions, sorted alphabetically
  // by their displayed name (achievement name when set, else category
  // name). The teacher always lands on a specific category — there's
  // no "All" state.
  // Memoised so the auto-select effect below has a stable dependency
  // and doesn't re-fire every render.
  const filterKeys = useMemo<FilterKey[]>(() => missionCategories
    .filter(c => (counts[c.code]?.total ?? 0) > 0)
    .map(c => {
      const meta = getMeta(c.code);
      return { code: c.code, label: meta.achievementName || meta.label };
    })
    .sort((a, b) => a.label.localeCompare(b.label))
    .map(c => c.code),
    [missionCategories, counts, getMeta],
  );

  // Auto-select the first available category once they've loaded so
  // the user never sees the "all missions" state. Uses
  // useLayoutEffect so the filter switch happens BEFORE the browser
  // paints — without this, the segmented progress bar briefly
  // renders the "ALL" counts (e.g. 4/11) and then fades segments
  // out via its 400ms background transition when the filter flips
  // to the first category (e.g. 3/6). useLayoutEffect collapses
  // both renders into one frame so no flash is ever visible.
  //
  // IMPORTANT: this hook MUST sit above the loading / error early
  // returns below — Rules of Hooks require the same order every
  // render, and the early returns would otherwise hide this hook
  // on the first render but reveal it on the second.
  React.useLayoutEffect(() => {
    if (filterKeys.length > 0 && !filterKeys.includes(filter)) {
      setFilter(filterKeys[0]);
    }
  }, [filterKeys, filter]);

  if (isLoading) return <div style={pageStyle}><p style={{ padding: 40, color: C.mutedSoft }}>Loading…</p></div>;
  if (isError || !data) return <div style={pageStyle}><p style={{ padding: 40, color: C.danger }}>Failed to load.</p></div>;

  const { teacher, currentPosition, readiness } = data;
  const isCurrentInLadder = readiness.isCurrentInLadder ?? true;

  return (
    <div style={pageStyle}>
      <style>{`
        /* Hover only applies to non-pressed buttons so the active
           badge keeps its filled accent colour when the cursor lands
           on it. */
        .mb-filter-btn:not([aria-pressed="true"]):hover { background: #f8fafc !important; }
        .mb-filter-btn-done:not([aria-pressed="true"]):hover { background: #eab30814 !important; }
        /* Drop every browser-painted overlay that can show as a
           rectangle on press: the mobile tap-highlight, focus
           outlines, the iOS long-press callout, and text-selection
           halos. Each of these is a separate WebKit/Blink behavior
           that has to be opted out of individually. */
        .mb-filter-btn,
        .mb-filter-btn *,
        .mb-mission-card,
        .mb-mission-card * {
          -webkit-tap-highlight-color: transparent !important;
          -webkit-tap-highlight-color: rgba(0,0,0,0) !important;
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
        }
        .mb-filter-btn,
        .mb-mission-card {
          touch-action: manipulation;
          background-clip: padding-box;
        }
        .mb-filter-btn:focus,
        .mb-filter-btn:focus-visible,
        .mb-filter-btn:active,
        .mb-filter-btn:active:focus,
        .mb-mission-card:focus,
        .mb-mission-card:focus-visible,
        .mb-mission-card:active,
        .mb-mission-card:active:focus {
          outline: none !important;
          -webkit-tap-highlight-color: transparent !important;
        }
        .mb-filter-btn::-moz-focus-inner,
        .mb-mission-card::-moz-focus-inner { border: 0; padding: 0; }
        /* Ensure ancestor doesn't paint a selection rectangle either. */
        .mb-chip-scroll { -webkit-tap-highlight-color: transparent; }
        /* Horizontal chip rail: hide scrollbars + fade both edges so
           overflowing chips obviously imply "scroll for more" rather
           than appearing as a hard clipped row. */
        .mb-chip-scroll { -webkit-overflow-scrolling: touch; scrollbar-width: none; }
        .mb-chip-scroll::-webkit-scrollbar { display: none; }
        .mb-chip-scroll {
          -webkit-mask-image: linear-gradient(to right, transparent 0, #000 20px, #000 calc(100% - 28px), transparent 100%);
          mask-image: linear-gradient(to right, transparent 0, #000 20px, #000 calc(100% - 28px), transparent 100%);
        }
      `}</style>
      <div style={s.inner}>
        {/* ── Top bar — back button + page title.
            Breadcrumb dropped on mobile: it was a 4-step chain
            (Teachers > Name > Career > Mission Board) that ate two
            lines on phone widths without giving teachers useful
            navigation context. Back button + title is the iOS-native
            pattern and reclaims valuable vertical space. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isMobile ? 18 : SP.lg, minWidth: 0 }}>
          <button
            onClick={goBack}
            style={isMobile ? s.backBtnMobile : s.backBtn}
            aria-label="Back"
          >
            <FontAwesomeIcon icon={isMobile ? faChevronLeft : faArrowLeft} />
          </button>
          {!isMobile && (
            <div style={{ ...s.breadcrumb, flexWrap: 'wrap', rowGap: 4, minWidth: 0 }}>
              <Link to="/teachers" style={s.crumbLink}>Teachers</Link>
              <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
              <Link to={`/teachers/${id}`} style={s.crumbLink}>{teacher.name}</Link>
              <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
              <Link to={`/teachers/${id}/career`} style={s.crumbLink}>Career</Link>
              <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
              <span style={s.crumbCurrent}>Mission Board</span>
            </div>
          )}
          {isMobile && (
            <>
              {/* Title sits right next to the back chevron — the
                  compact phone-app pattern (chevron + label inline). */}
              <h1 style={{
                ...s.heading, fontSize: 20, margin: 0, flex: 1, minWidth: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>Mission Board</h1>
            </>
          )}
        </div>

        {/* ── Title block (desktop only — mobile shows the title in
            the back-button row above to save vertical space). ──── */}
        {!isMobile && (
          <div style={{ marginBottom: SP.xl }}>
            <h1 style={{ ...s.heading, fontSize: 26 }}>Mission Board</h1>
          </div>
        )}

        {/* ── Body ─────────────────────────────────────────────────────── */}
        {!currentPosition ? (
          <EmptyState
            icon={faRoad}
            title="No position assigned"
            hint="Assign a position from the teacher's profile to start tracking career progression."
          />
        ) : !isCurrentInLadder ? (
          <EmptyState
            icon={faTriangleExclamation}
            title="Position not on the career ladder"
            hint={
              <>
                <strong>{currentPosition.name}</strong> is excluded from the career progression path.{' '}
                Missions for this position aren&apos;t tracked toward a promotion.
              </>
            }
          />
        ) : sortedMissions.length === 0 ? (
          <EmptyState
            icon={faRoad}
            title="No missions configured"
            hint={
              <>
                No missions have been configured for this position yet.{' '}
                <Link to="/settings/career-missions" style={{ color: C.primary, fontWeight: 600 }}>Configure now →</Link>
              </>
            }
          />
        ) : (
          <div style={{ ...s.layout, ...(isMobile ? sMobile.layout : null) }}>
            {/* ── Sidebar — vertical category filter ──────────────────── */}
            <aside style={{ ...s.sidebar, ...(isMobile ? sMobile.sidebar : null) }}>
              {!isMobile && <div style={s.filterEyebrow}>Categories</div>}
              <div
                className={isMobile ? 'mb-chip-scroll' : undefined}
                style={{ ...s.filterList, ...(isMobile ? sMobile.filterList : null) }}
              >
                {filterKeys.map(k => {
                  const active = k === filter;
                  const meta = getMeta(k);
                  const stat = counts[k] ?? { completed: 0, total: 0 };
                  const done = stat.total > 0 && stat.completed === stat.total;
                  const GOLD = '#eab308';
                  const fullLabel = k === 'ALL' ? 'All' : (meta!.achievementName || meta!.label);
                  const isAll = k === 'ALL';
                  // Always render the chip as a round icon-only
                  // badge — keeps the rail visually consistent on
                  // both mobile and desktop, and avoids the legacy
                  // rounded-square shape that a wider viewport used
                  // to fall into. "All" gets the primary palette so
                  // it doesn't render as the fallback muted-grey
                  // from getMeta() — it's the most-tapped pill.
                  const accent = done ? GOLD : isAll ? C.primary : (meta ? meta.color : C.primary);
                  return (
                    // The whole column (icon + label) is the tap
                    // target so the teacher can tap either the icon
                    // or the text. Fixed-height label slot keeps
                    // every column the same size whether or not it's
                    // selected — switching categories never shifts
                    // the row layout.
                    <div
                      key={k}
                      onClick={() => setFilter(k)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFilter(k); } }}
                      title={fullLabel}
                      aria-label={fullLabel}
                      aria-pressed={active}
                      role="button"
                      tabIndex={0}
                      className="mb-filter-btn"
                      style={{
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', gap: 6,
                        flexShrink: 0,
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          width: 52, height: 52, minWidth: 52, minHeight: 52,
                          borderRadius: 999,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          // Solid accent fill when active; inactive is
                          // a clean white disc with a coloured accent
                          // outline so it reads as an outlined chip and
                          // the active (filled) state clearly pops.
                          background: active ? accent : '#fff',
                          color: active ? '#fff' : `${accent}cc`,
                          border: `2px solid ${active ? accent : `${accent}b3`}`,
                          backgroundClip: 'padding-box',
                          transition: 'background 160ms ease, color 160ms ease, border-color 160ms ease',
                          pointerEvents: 'none',
                        }}
                      >
                        {isAll ? (
                          <span style={{
                            fontSize: 13, fontWeight: 800, letterSpacing: '-0.01em',
                          }}>
                            All
                          </span>
                        ) : (
                          meta && <FontAwesomeIcon icon={meta.icon} style={{ fontSize: 20 }} />
                        )}
                        {done && (
                          <span style={{
                            position: 'absolute', bottom: -2, right: -2,
                            width: 16, height: 16, borderRadius: '50%',
                            background: GOLD, color: '#fff',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 8, fontWeight: 900,
                            border: '2px solid #fff',
                            boxShadow: `0 1px 3px ${GOLD}66`,
                          }}>
                            <FontAwesomeIcon icon={faCheck} />
                          </span>
                        )}
                      </div>
                      {/* Caption under every badge — active state
                          uses the accent colour; inactive stays
                          muted so the active one still pops without
                          hiding the others' identity. */}
                      <div style={{
                        height: 12,
                        lineHeight: '12px',
                        fontSize: 9, fontWeight: 700,
                        color: active ? accent : C.mutedSoft,
                        letterSpacing: '0.02em',
                        textTransform: 'uppercase' as const,
                        maxWidth: 64,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        textAlign: 'center' as const,
                        pointerEvents: 'none',
                      }}>
                        {isAll ? 'All' : (meta?.label ?? fullLabel)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Show — single-select view mode (desktop only).
                  On mobile this segmented control was redundant with
                  the section headers below (REQUIRED / OPTIONAL /
                  COMPLETED already split missions visually); two
                  filter UIs on one narrow screen felt overwhelming.
                  Mobile teachers see all sections by default and
                  scroll; the category chip scroll above still gives
                  them a per-skill filter. */}
              {!isMobile && (
                <>
                  <div style={s.sidebarDivider} />
                  <div style={s.filterEyebrow}>Show</div>
                  <div style={s.filterList}>
                    {([
                      { key: 'all' as const, label: 'All', count: requiredMissions.length + optionalMissions.length + completedMissions.length },
                      { key: 'required' as const, label: 'Required', count: requiredMissions.length },
                      { key: 'optional' as const, label: 'Optional', count: optionalMissions.length },
                      { key: 'completed' as const, label: 'Completed', count: completedMissions.length },
                    ]).map(vm => {
                      const active = showMode === vm.key;
                      return (
                        <label key={vm.key} style={s.toggleRow}>
                          <input
                            type="radio"
                            name="mb-show-mode"
                            checked={active}
                            onChange={() => setShowMode(vm.key)}
                            style={s.toggleCheckbox}
                          />
                          <span style={{
                            flex: 1, minWidth: 0,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            fontWeight: active ? 600 : 500,
                            color: active ? C.text : C.textSub,
                          }}>
                            {vm.label}
                          </span>
                          <span style={{
                            padding: '0 8px', height: 18,
                            display: 'inline-flex', alignItems: 'center', borderRadius: 999,
                            fontSize: 10, fontWeight: 700,
                            background: C.divider, color: C.muted,
                            fontVariantNumeric: 'tabular-nums',
                            flexShrink: 0,
                          }}>
                            {vm.count}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </aside>

            {/* ── Main — track summary + mission sections ───────────────
                Track summary now renders ONLY when a specific
                category is focused. On the "All" view the summary
                duplicated info already shown by the category chips
                and section headers; surfacing it just for category
                drilldowns keeps the screen calmer. */}
            <main style={s.main}>
              {filter !== 'ALL' && (() => {
                const focusedCat = missionCategories.find(c => c.code === filter) ?? null;
                if (!focusedCat) return null;
                const stat = counts[filter] ?? { completed: 0, total: 0 };
                const trackName = focusedCat.achievementName || focusedCat.name;
                const trackMeta = getMeta(focusedCat.code);
                return (
                  <MissionTrackSummary
                    trackName={trackName}
                    trackMeta={trackMeta}
                    completed={stat.completed}
                    total={stat.total}
                    starColor={currentPosition?.starColor ?? null}
                  />
                );
              })()}

              {filtered.length === 0 ? (
                <EmptyState
                  icon={faRoad}
                  title="No missions in this category"
                  hint="Switch to a different category to see other missions."
                />
              ) : (() => {
                const showRequiredSec = showMode === 'all' || showMode === 'required';
                const showOptionalSec = showMode === 'all' || showMode === 'optional';
                const showCompletedSec = showMode === 'all' || showMode === 'completed';
                const visibleSections = (showRequiredSec && requiredMissions.length > 0 ? 1 : 0)
                  + (showOptionalSec && optionalMissions.length > 0 ? 1 : 0)
                  + (showCompletedSec && completedMissions.length > 0 ? 1 : 0);

                if (visibleSections === 0) {
                  // Track-completion celebration — when the user has
                  // finished the whole track and the active Show filter
                  // happens to land on an empty section, swap the dry
                  // "No required missions" message for a gold trophy
                  // moment. The work is done; the screen should feel
                  // like a win, not an absent list.
                  const trackStat = counts[filter] ?? { completed: 0, total: 0 };
                  const trackDone = trackStat.total > 0
                    && trackStat.completed === trackStat.total
                    && completedMissions.length > 0;
                  if (trackDone) {
                    const GOLD = '#eab308';
                    return (
                      <div style={{
                        padding: '56px 24px', textAlign: 'center',
                        background: `linear-gradient(135deg, ${GOLD}1a, ${GOLD}08)`,
                        border: `1px solid ${GOLD}40`,
                        borderRadius: 14,
                        boxShadow: `0 1px 2px ${GOLD}1f, 0 4px 12px ${GOLD}14`,
                      }}>
                        <div style={{
                          width: 56, height: 56, borderRadius: '50%',
                          margin: '0 auto 16px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: '#fff',
                          border: `1px solid ${GOLD}40`,
                          color: GOLD, fontSize: 22,
                          boxShadow: `0 1px 3px ${GOLD}33`,
                        }}>
                          <FontAwesomeIcon icon={faTrophy} />
                        </div>
                        <h4 style={{
                          margin: '0 0 4px', fontSize: 16, fontWeight: 800,
                          color: GOLD, letterSpacing: '-0.01em',
                        }}>
                          Achievement earned
                        </h4>
                        <p style={{
                          margin: '0 0 16px', fontSize: 13, color: C.muted, lineHeight: 1.5,
                        }}>
                          Every mission in this track is complete. Nice work.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowMode('completed')}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            height: 32, padding: '0 16px', borderRadius: 8,
                            fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                            background: GOLD, color: '#fff', border: 'none',
                            cursor: 'pointer',
                            boxShadow: `0 1px 2px ${GOLD}40`,
                          }}
                        >
                          View completed missions
                          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9 }} />
                        </button>
                      </div>
                    );
                  }
                  const labels: Record<ShowMode, string> = {
                    all: 'No missions yet',
                    required: 'No required missions',
                    optional: 'No optional missions',
                    completed: 'No completed missions',
                  };
                  return (
                    <EmptyState
                      icon={faRoad}
                      title={labels[showMode]}
                      hint="Switch the Show filter to see other missions."
                    />
                  );
                }
                // Drop the per-section eyebrow on mobile when the
                // segmented Show filter has already pinned the page
                // to a single state — the active tab already says
                // "Required" / "Optional" / "Completed", so a
                // section header repeating it adds noise.
                const hideSectionHeaders = isMobile && showMode !== 'all';
                const sectionsContent = (
                  <>
                    {showRequiredSec && requiredMissions.length > 0 && (
                      <SectionBlock
                        eyebrow="Required Missions"
                        hint="Missions you need to complete for your next promotion."
                        accent={C.danger}
                        items={requiredMissions}
                        pageSize={4}
                        getKey={m => m.id}
                        hideHeader={hideSectionHeaders}
                        renderItem={m => (
                          <BoardMissionCard
                            mission={m}
                            variant="required"
                            onOpen={() => setEditingMission(m)}
                          />
                        )}
                      />
                    )}
                    {showOptionalSec && optionalMissions.length > 0 && (
                      <SectionBlock
                        eyebrow="Optional Missions"
                        hint="Get a head start on future promotions — completing these now counts when you reach that stage."
                        accent={C.muted}
                        items={optionalMissions}
                        pageSize={3}
                        getKey={m => m.id}
                        hideHeader={hideSectionHeaders}
                        renderItem={m => (
                          <BoardMissionCard
                            mission={m}
                            variant="optional"
                            onOpen={() => setEditingMission(m)}
                          />
                        )}
                      />
                    )}
                    {showCompletedSec && completedMissions.length > 0 && (
                      <SectionBlock
                        eyebrow="Completed"
                        hint="Missions you've already finished, sorted alphabetically."
                        accent={C.success}
                        items={completedMissions}
                        pageSize={3}
                        getKey={m => m.id}
                        hideHeader={hideSectionHeaders}
                        renderItem={m => (
                          <BoardMissionCard
                            mission={m}
                            variant={m.required && m.positionId === currentPositionId ? 'required' : 'optional'}
                            onOpen={() => setEditingMission(m)}
                          />
                        )}
                      />
                    )}
                  </>
                );
                return sectionsContent;
              })()}
            </main>
          </div>
        )}
      </div>

      {editingMission && (
        <TeacherMissionDetailView
          mission={editingMission}
          onClose={() => setEditingMission(null)}
        />
      )}
    </div>
  );
}

// ── Teacher mission detail view ──────────────────────────────────────────────
// Read-only viewer for teachers — replaces the editable
// MissionDetailModal (status / evidence count / notes inputs are
// supervisor-only territory). Renders as a bottom sheet on mobile
// (anchored, slides up) and as a centered modal on desktop. Shows
// title, category, description, and "why this matters" — nothing
// the teacher can change.

function TeacherMissionDetailView({
  mission, onClose,
}: {
  mission: MissionWithProgress;
  onClose: () => void;
}) {
  const { isMobile } = useIsMobile();
  const { getMeta } = useCategoryMeta();
  const cat = getMeta(mission.category);
  const status: MissionStatus = mission.progress?.status ?? 'PENDING';
  const sm = STATUS_META[status];
  const evidenceTotal = Math.max(1, mission.progress?.evidenceTotal ?? 1);
  const rawCount = mission.progress?.evidenceCount ?? 0;
  const isCompleted = status === 'COMPLETED';
  const filledCount = isCompleted ? evidenceTotal : rawCount;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15,23,42,0.45)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : 24,
        animation: 'tmbv-fade 180ms ease',
      }}
    >
      <style>{`
        @keyframes tmbv-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes tmbv-slide-up {
          from { transform: translateY(24px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes tmbv-pop-in {
          from { transform: scale(0.96); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          width: '100%',
          maxWidth: isMobile ? '100%' : 480,
          maxHeight: isMobile ? '85vh' : '90vh',
          overflowY: 'auto' as const,
          borderRadius: isMobile ? '20px 20px 0 0' : 16,
          padding: isMobile ? '14px 20px 28px' : '22px 24px',
          boxShadow: '0 -8px 32px rgba(15,23,42,0.16)',
          animation: isMobile
            ? 'tmbv-slide-up 220ms cubic-bezier(0.4, 0, 0.2, 1)'
            : 'tmbv-pop-in 180ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Pull handle (mobile only) */}
        {isMobile && (
          <div style={{
            width: 40, height: 4, borderRadius: 999,
            background: '#eceef2',
            margin: '0 auto 16px',
          }} />
        )}

        {/* Top row — category pill (left) + close button (right) */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, marginBottom: 12,
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 999,
            background: cat.bg, color: cat.color,
            fontSize: 10, fontWeight: 700,
            letterSpacing: '0.02em',
            minWidth: 0,
          }}>
            <FontAwesomeIcon icon={cat.icon} style={{ fontSize: 9 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
              {cat.label}
            </span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 999,
              background: sm.bg, color: sm.color,
              fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase' as const, letterSpacing: '0.06em',
            }}>
              <FontAwesomeIcon icon={sm.icon} style={{ fontSize: 9 }} />
              {sm.label}
            </span>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: 8,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: '#f1f5f9', color: C.muted,
                border: `1px solid ${C.divider}`,
                cursor: 'pointer', flexShrink: 0,
              }}
              aria-label="Close"
            >
              <span style={{ fontSize: 16, lineHeight: 1, fontWeight: 600 }}>×</span>
            </button>
          </div>
        </div>

        {/* Mission title */}
        <h2 style={{
          margin: '0 0 12px', fontSize: 20, fontWeight: 800, color: C.text,
          letterSpacing: '-0.015em', lineHeight: 1.25,
        }}>
          {mission.title}
        </h2>

        {/* Description — the "what is this mission" body copy. */}
        {mission.description && (
          <p style={{
            margin: '0 0 16px',
            fontSize: 13, fontWeight: 500, color: C.textSub,
            lineHeight: 1.55, whiteSpace: 'pre-wrap' as const,
          }}>
            {mission.description}
          </p>
        )}

        {/* Why this matters — separate framed block in the category
            colour so the motivation reads as distinct from the
            description, not just more body copy. */}
        {mission.whyItMatters && (
          <div style={{
            padding: '14px 14px',
            background: `${cat.color}0d`,
            border: `1px solid ${cat.color}26`,
            borderRadius: 12,
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 10, fontWeight: 800,
              color: cat.color,
              textTransform: 'uppercase' as const, letterSpacing: '0.1em',
              marginBottom: 6,
            }}>
              <FontAwesomeIcon icon={faCircleInfo} style={{ fontSize: 10 }} />
              Why this matters
            </div>
            <p style={{
              margin: 0, fontSize: 13, fontWeight: 500, color: C.text,
              lineHeight: 1.55, whiteSpace: 'pre-wrap' as const,
            }}>
              {mission.whyItMatters}
            </p>
          </div>
        )}

        {/* Progress readout — read-only. Bar + count, no inputs.
            Hidden when the mission has no evidence requirements at
            all (some missions complete without logged evidence). */}
        {evidenceTotal > 1 && (
          <div style={{
            marginTop: 16,
            padding: '12px 14px',
            background: isCompleted ? C.successSoft : '#f8fafc',
            border: `1px solid ${isCompleted ? C.successBorder : C.divider}`,
            borderRadius: 12,
          }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              gap: 10, marginBottom: 6,
            }}>
              <span style={{
                fontSize: 10, fontWeight: 800,
                color: isCompleted ? C.success : C.muted,
                textTransform: 'uppercase' as const, letterSpacing: '0.1em',
              }}>
                Evidence logged
              </span>
              <span style={{
                fontSize: 13, fontWeight: 800,
                color: C.text,
                fontVariantNumeric: 'tabular-nums' as const,
              }}>
                {filledCount}<span style={{ color: C.mutedSoft, fontWeight: 600 }}> / {evidenceTotal}</span>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {Array.from({ length: evidenceTotal }).map((_, i) => {
                const filled = i < filledCount;
                return (
                  <div key={i} style={{
                    flex: 1, height: 5, borderRadius: 999,
                    background: filled
                      ? (isCompleted ? C.success : C.primary)
                      : C.divider,
                  }} />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Mission Track Summary ────────────────────────────────────────────────────
// Mission-focused, NOT promotion-focused. Shows progress for the selected
// track (achievement) only — chunky segmented bar where each segment is
// one mission, so a single completion produces a noticeable jump.
//
// The page deliberately does not surface promotion-stage progress; that
// lives on the main career page. Here, the teacher's mental model is:
//   "I'm working on Classroom Leader. 1 of 6 done. 5 to go."

function MissionTrackSummary({
  trackName, trackMeta, completed, total, starColor,
}: {
  trackName: string;
  /** null when the user is on the "All" tab — we render a neutral track card. */
  trackMeta: { icon: any; bg: string; color: string } | null;
  completed: number;
  total: number;
  /** Position-tier color for the earned star (silver/gold/blue/...). */
  starColor: string | null;
}) {
  const done = total > 0 && completed === total;
  const remaining = Math.max(0, total - completed);
  // Celebratory gold for completed tracks. The position's starColor can
  // be silver/bronze on lower tiers — using it here washed the band
  // out to grey, which read as "stale" instead of "earned". A vibrant
  // amber-gold consistently celebrates the achievement.
  const GOLD = '#eab308';
  const earnedColor = GOLD;
  // Track-tinted accent — when the user has selected a specific
  // achievement we use its category color; "All" view uses the primary.
  const accent = trackMeta ? trackMeta.color : C.primary;
  // When fully earned, the whole card pivots to gold so the win is
  // visually distinct from other states.
  const tint = done ? earnedColor : accent;

  // Visual identity: a *band* tinted with the track's accent colour, not
  // a white card — so it never feels like another mission tile but still
  // gives the teacher the "I'm working towards something" feedback via
  // the chunky segmented bar.
  const bandTint = done ? earnedColor : accent;

  return (
    <div style={{
      ...s.summaryCard,
      // Layered fill: a solid white base ensures the page's hero
      // background can't bleed through the card, then a soft tinted
      // overlay restores the gentle "band" colour the card always
      // had. When done we lift the gold tint to a more visible
      // celebratory level.
      background: done
        ? `linear-gradient(135deg, ${bandTint}1f, ${bandTint}0a), ${C.card}`
        : `linear-gradient(135deg, ${bandTint}10, ${bandTint}05), ${C.card}`,
      border: `1px solid ${done ? `${bandTint}40` : `${bandTint}26`}`,
      boxShadow: done ? `0 1px 2px ${bandTint}1f, 0 4px 12px ${bandTint}14` : s.summaryCard.boxShadow,
    }}>
      {/* Top row — track icon + name + count.
          More breathing space: gap 12 → 14, mb 14 → 18, and the
          rank name reads as the hero (17px / 800), with the
          "missions to go" subtitle stepped down clearly below. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#fff',
          color: bandTint, fontSize: 17,
          border: `1px solid ${bandTint}33`,
        }}>
          <FontAwesomeIcon
            icon={done ? faStar : (trackMeta ? trackMeta.icon : faStar)}
            style={done ? { filter: `drop-shadow(0 1px 3px ${earnedColor}66)` } : undefined}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            // Slightly stronger tracking + ever-so-slightly bigger
            // line-height anchor — keeps the rank name as the card's
            // clear focal point alongside the new count chip.
            fontSize: 18, fontWeight: 800,
            color: done ? earnedColor : C.text,
            letterSpacing: '-0.02em', lineHeight: 1.15,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {trackName}
          </div>
          <div style={{
            marginTop: 4, fontSize: 12, fontWeight: 500,
            color: done ? earnedColor : C.muted,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.3,
          }}>
            {done
              ? 'Track completed · achievement earned'
              : total === 0
              ? 'No missions in this track yet'
              : `${remaining} mission${remaining === 1 ? '' : 's'} to go`}
          </div>
        </div>
        {/* Count — top-aligned with the rank name so the X / Y reads
            as the title's right-side companion, not floating below
            the subtitle. */}
        <div style={{
          alignSelf: 'flex-start',
          paddingTop: 1,
          fontSize: 15, fontWeight: 800,
          color: done ? earnedColor : C.text,
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
          letterSpacing: '-0.005em',
        }}>
          {completed}<span style={{ color: C.mutedSoft, fontWeight: 500 }}> / {total}</span>
        </div>
      </div>

      {/* Chunky segmented bar — the motivation hero. Each segment is one
          mission, so each completion produces a satisfying step. */}
      <SegmentedProgress completed={completed} total={total} color={bandTint} />
    </div>
  );
}

// Chunky segmented progress bar — discrete, momentum-y, rewarding.
// Each completed mission visibly fills one segment. Track total >16 →
// continuous bar fallback so dozens of missions don't crush horizontally.
function SegmentedProgress({
  completed, total, color,
}: {
  completed: number; total: number; color: string;
}) {
  if (total === 0) {
    return (
      <div style={{ height: 14, background: C.divider, borderRadius: 6 }} />
    );
  }

  const useSegments = total <= 16;
  const pct = Math.round((completed / total) * 100);

  if (!useSegments) {
    return (
      <div style={{
        height: 10, background: `${color}1a`, borderRadius: 999, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: color, borderRadius: 999,
          transition: 'width 500ms cubic-bezier(0.4, 0, 0.2, 1)',
        }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {Array.from({ length: total }).map((_, i) => {
        const filled = i < completed;
        // Key segments by (i + total + filled) so React fully remounts
        // them whenever the underlying state changes — no in-place
        // background transition can animate stale "filled" segments
        // out (the source of the "4th bar flashes then disappears"
        // bug when the filter auto-switches from ALL to a category
        // with a different total/completed count).
        // Slimmer (10px) + dropped the inner highlight/shadow so the
        // bar reads as a calm progress strip rather than a chunky
        // game widget — matches the page's lighter polish pass.
        return (
          <div key={`${total}-${i}-${filled}`} style={{
            flex: 1, height: 10, borderRadius: 999,
            background: filled ? color : `${color}1f`,
          }} />
        );
      })}
    </div>
  );
}

// ── Section Block ────────────────────────────────────────────────────────────
// A titled, paginated grid of mission cards. Each section paginates
// independently (Required = 6 per page, Optional/Completed = 3 per page)
// so a long list never overwhelms the page. Page resets to 0 when
// `items` shrinks below the current page.
function SectionBlock<T>({
  eyebrow, hint, accent, items, pageSize, renderItem, getKey, hideHeader = false,
}: {
  eyebrow: string;
  hint: string;
  accent: string;
  items: T[];
  pageSize: number;
  renderItem: (item: T) => React.ReactNode;
  getKey: (item: T) => string;
  /** Hide the eyebrow + count badge. Used on mobile when the page's
   *  segmented filter (All / Required / Optional / Completed) is
   *  already pinned to this section's state — the section header
   *  would otherwise repeat what the filter just said. */
  hideHeader?: boolean;
}) {
  const { isMobile } = useIsMobile();
  const [page, setPage] = useState(0);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  // Auto-clamp when filter shrinks the list past the current page.
  React.useEffect(() => {
    if (page > totalPages - 1) setPage(0);
  }, [page, totalPages]);

  const start = safePage * pageSize;
  const end = Math.min(start + pageSize, total);
  const visible = items.slice(start, end);

  // Mobile pages — group items into pageSize-sized chunks rendered
  // as horizontal scroll-snap columns. Teachers swipe left/right
  // between pages instead of tapping a chevron.
  const pages = React.useMemo(() => {
    const out: T[][] = [];
    for (let i = 0; i < totalPages; i++) {
      out.push(items.slice(i * pageSize, (i + 1) * pageSize));
    }
    return out;
  }, [items, totalPages, pageSize]);

  // Track the snapped page from scroll position so the dot indicator
  // stays in sync with what's visible. We measure container width
  // (each page slot is `flex: 0 0 100%`) and round scrollLeft / width
  // to the nearest page index.
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    const next = Math.round(el.scrollLeft / w);
    if (next !== safePage && next >= 0 && next < totalPages) {
      setPage(next);
    }
  };

  // Section colour-keys the eyebrow against the work's priority. The
  // accent passed in (danger/muted/success) doubles as a small left
  // accent bar so the section reads with visual weight matching its
  // importance, not just its label.
  return (
    <div style={{ marginBottom: isMobile ? 52 : 56 }}>
      {!hideHeader && (
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12,
        }}>
          {/* Plain sentence-case heading — same hierarchy as the hub's
              "Active Quests" title. No coloured accent bar: the
              section's own card chrome already groups its missions,
              so the row doesn't need extra decoration. */}
          <h2 style={{
            margin: 0, fontSize: 18, fontWeight: 800, color: C.text,
            letterSpacing: '-0.02em', lineHeight: 1.15,
          }}>
            {eyebrow}
          </h2>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 22, height: 20, padding: '0 7px', borderRadius: 999,
            fontSize: 11, fontWeight: 700,
            background: C.slateSoft, color: C.muted,
            fontVariantNumeric: 'tabular-nums',
            // Nudge up so the chip's vertical centre aligns with the
            // heading's optical centre (the heading uses lineHeight
            // 1.15 which pulls its baseline above the row baseline).
            transform: 'translateY(2px)',
          }}>
            {total}
          </span>
        </div>
      )}

      {isMobile && totalPages > 1 ? (
        <>
          <style>{`
            .mb-sect-scroll { -webkit-overflow-scrolling: touch; scrollbar-width: none; }
            .mb-sect-scroll::-webkit-scrollbar { display: none; }
          `}</style>
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="mb-sect-scroll"
            style={{
              display: 'flex',
              overflowX: 'auto' as const,
              // `mandatory` snap + `contain` overscroll keeps the
              // rail focused on its own pages so a flick can't bleed
              // into the parent page scroll. The flex gap shows as
              // a visible gutter between pages mid-swipe so they
              // read as separate slides, not one continuous wall.
              scrollSnapType: 'x mandatory' as any,
              overscrollBehaviorX: 'contain' as any,
              gap: 16,
            }}
          >
            {pages.map((pageItems, pi) => (
              <div
                key={pi}
                style={{
                  flex: '0 0 100%',
                  // `scroll-snap-align: start` + `scroll-snap-stop: always`
                  // forces the browser to STOP on every page during a
                  // fast flick instead of letting inertia carry past
                  // several pages. Combined with `mandatory` above,
                  // this caps each swipe at exactly one page.
                  scrollSnapAlign: 'start' as any,
                  scrollSnapStop: 'always' as any,
                  display: 'flex', flexDirection: 'column' as const,
                  gap: SP.md,
                }}
              >
                {pageItems.map(item => (
                  <React.Fragment key={getKey(item)}>{renderItem(item)}</React.Fragment>
                ))}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{
          display: 'grid', gap: SP.md,
          gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(auto-fill, minmax(340px, 1fr))',
        }}>
          {visible.map(item => (
            <React.Fragment key={getKey(item)}>{renderItem(item)}</React.Fragment>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          startIndex={start + 1}
          endIndex={end}
          total={total}
          onChange={(next) => {
            setPage(next);
            // When the dot is tapped on mobile, programmatically
            // snap-scroll to that page so the dot + the visible
            // cards stay aligned.
            const el = scrollRef.current;
            if (el) el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
          }}
        />
      )}
    </div>
  );
}

// Compact pagination footer — mobile uses a "dot" pager (round
// chevron buttons + filled dot per page) so it reads as a swipeable
// stack-marker, not a document footer. Desktop keeps the "Showing
// 1–6 of 11" readout for precision.
function Pagination({
  page, totalPages, startIndex, endIndex, total, onChange,
}: {
  page: number; totalPages: number;
  startIndex: number; endIndex: number; total: number;
  onChange: (next: number) => void;
}) {
  const { isMobile } = useIsMobile();
  const canPrev = page > 0;
  const canNext = page < totalPages - 1;

  // Mobile pager — dots only. Chevrons were removed because the
  // section above is now a horizontal swipe rail; teachers slide
  // between pages of mission cards directly. The dots act as a
  // page indicator (tap to jump to that page).
  if (isMobile) {
    return (
      <div style={{
        marginTop: 20,
        paddingBottom: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 8,
      }}>
        {Array.from({ length: totalPages }).map((_, i) => {
          const isActive = i === page;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(i)}
              aria-label={`Page ${i + 1}`}
              aria-current={isActive ? 'page' : undefined}
              style={{
                // Active dot pill is just enough wider to read as
                // "you are here" without dominating the row. Dot
                // size kept compact for a calm mobile control.
                width: isActive ? 16 : 6,
                height: 6,
                borderRadius: 999,
                background: isActive ? C.primary : C.divider,
                border: 'none', padding: 0,
                cursor: 'pointer',
                transition: 'width 200ms ease, background 200ms ease',
              }}
            />
          );
        })}
      </div>
    );
  }

  // Desktop — keep the precise "Showing X–Y of N" readout. */
  const navBtn = (disabled: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, borderRadius: 8,
    background: '#fff', border: `1px solid ${C.cardBorder}`,
    color: disabled ? C.mutedSoft : C.textSub,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit', fontSize: 11,
    transition: 'background 160ms ease, border-color 160ms ease',
  });
  return (
    <div style={{
      marginTop: SP.md, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 8,
    }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>
        Showing <span style={{ color: C.text, fontWeight: 700 }}>{startIndex}</span>
        –<span style={{ color: C.text, fontWeight: 700 }}>{endIndex}</span> of {total}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => canPrev && onChange(page - 1)}
          style={navBtn(!canPrev)}
          aria-label="Previous page"
        >
          <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 10 }} />
        </button>
        <span style={{
          padding: '0 10px', fontSize: 12, fontWeight: 600,
          color: C.textSub, fontVariantNumeric: 'tabular-nums',
        }}>
          Page {page + 1} of {totalPages}
        </span>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => canNext && onChange(page + 1)}
          style={navBtn(!canNext)}
          aria-label="Next page"
        >
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 10 }} />
        </button>
      </div>
    </div>
  );
}

// ── Board-specific Mission Card ──────────────────────────────────────────────
// Cleaner hierarchy than the shared MissionCard:
//   [icon] [title] [Required/Optional pill]
//   Category · Difficulty · Estimated duration
//   Description
//   Status: ___              [Start Mission]
//
// Required cards use full white + filled CTA; optional cards use a softer
// fill + outline CTA so the visual weight matches their importance.

function BoardMissionCard({
  mission, variant, onOpen,
}: {
  mission: MissionWithProgress;
  variant: 'required' | 'optional';
  /** Tap handler — opens the read-only mission detail sheet. Replaces
   *  the previous separate onEdit / onToggleTarget callbacks since
   *  teachers can no longer edit progress or pin missions; the only
   *  affordance is "see more". */
  onOpen: () => void;
}) {
  const { getMeta } = useCategoryMeta();
  const cat = getMeta(mission.category);
  const status: MissionStatus = mission.progress?.status ?? 'PENDING';
  const isCompleted = status === 'COMPLETED';
  const isOptional = variant === 'optional';

  // Card chrome — all cards use a neutral white-ish surface; the
  // required vs optional priority is signalled by a 3px coloured
  // left accent strip + a slightly brighter card body for required.
  // That keeps the row's visual weight consistent (required and
  // Card chrome — required cards "feel more active": white bg with a
  // soft primary-tinted border + a faint primary shadow so they pop
  // off the page. Optional cards step back to a softer fill and
  // neutral border so the priority order is visible at a glance.
  // Completed missions desaturate further so the eye skips past them.
  const cardBg = isCompleted ? C.cardSoft : (isOptional ? C.cardSoft : C.card);
  const cardBorder = isCompleted
    ? C.cardBorderSoft
    : isOptional
      ? C.cardBorderSoft
      : `${C.primary}33`;
  const cardShadow = isCompleted
    ? 'none'
    : isOptional
      ? 'none'
      : `0 1px 2px ${C.primary}14, 0 4px 12px ${C.primary}0a`;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mb-mission-card"
      style={{
        // alignItems: stretch lets the right-column icon tile span
        // the full card height (top of title → bottom of bar)
        // instead of just floating at vertical centre.
        display: 'flex', alignItems: 'stretch', gap: 14,
        padding: SP.lg,
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        borderRadius: 14,
        boxShadow: cardShadow,
        // Completed cards stay full-opacity so the win is visible —
        // the green progress fill + soft card chrome already
        // differentiate them.
        transition: 'box-shadow 200ms ease, transform 200ms ease',
        textAlign: 'left' as const,
        font: 'inherit',
        color: 'inherit',
        cursor: 'pointer',
        width: '100%',
      }}
    >
      {/* Left column — title (top) + progress bar (with count inside).
          Two compact rows; the bar itself carries the X/Y readout so
          the card stays to two visible elements + the right-side icon. */}
      <div style={{
        flex: 1, minWidth: 0,
        display: 'flex', flexDirection: 'column' as const, gap: 12,
      }}>
        <div style={{
          // Bold (700) — clear, strong title weight that reads
          // confidently in Nunito without going extra-heavy.
          fontSize: 15, fontWeight: 700, color: C.text,
          letterSpacing: '-0.008em', lineHeight: 1.3,
          display: '-webkit-box' as any,
          WebkitLineClamp: 2 as any,
          WebkitBoxOrient: 'vertical' as any,
          overflow: 'hidden',
        }}>
          {mission.title}
        </div>

        {(() => {
          const evidenceTotal = Math.max(1, mission.progress?.evidenceTotal ?? 1);
          const rawCount = mission.progress?.evidenceCount ?? 0;
          const filledCount = isCompleted ? evidenceTotal : rawCount;
          const pct = Math.max(0, Math.min(100, (filledCount / evidenceTotal) * 100));
          const fillColor = isCompleted
            ? C.success
            : status === 'UNDER_REVIEW' ? C.warning : C.primary;
          // Pill-shaped bar with the X/Y count rendered ON TOP of the
          // fill+track. Text is right-aligned and uses a thin white
          // halo (text-shadow) so it stays legible whether it lands
          // on the filled or unfilled portion.
          return (
            <div style={{
              position: 'relative',
              height: 16, borderRadius: 999,
              // Theme-tinted track (~10% opacity of the fill colour)
              // — visible at 0% progress without going so dark the
              // empty bar reads as filled. Hints at the fill colour
              // the bar will become.
              background: `${fillColor}1a`,
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', insetBlock: 0, left: 0,
                width: `${pct}%`,
                background: `linear-gradient(90deg, ${fillColor}, ${
                  isCompleted ? '#15803d' : status === 'UNDER_REVIEW' ? '#b45309' : C.primaryDeep
                })`,
                borderRadius: 999,
                transition: 'width 400ms cubic-bezier(0.4, 0, 0.2, 1)',
              }} />
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 600, lineHeight: 1,
                // Greyed out when the fill hasn't reached the centred
                // text yet — reads as "no progress here yet" instead
                // of competing with the bar. Switches to crisp white
                // (with a soft dark shadow) once the fill crosses
                // halfway so the count stays legible on colour.
                color: pct >= 50 ? '#fff' : C.mutedSoft,
                fontVariantNumeric: 'tabular-nums' as const,
                letterSpacing: '0.01em',
                textShadow: pct >= 50
                  ? '0 1px 2px rgba(0,0,0,0.25)'
                  : 'none',
                pointerEvents: 'none',
              }}>
                {filledCount}/{evidenceTotal}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Right column — category logo. Lightened to a soft 8% tint
          + 75% icon opacity so the same category icon repeated down
          a long list reads as a quiet identity stamp rather than a
          competing visual element next to the title. The tile still
          stretches vertically via the parent's alignItems: stretch. */}
      <div style={{
        width: 40, minHeight: 40, borderRadius: 12, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${cat.color}14`,
        color: `${cat.color}bf`,
        fontSize: 16,
      }}>
        <FontAwesomeIcon icon={cat.icon} />
      </div>
    </button>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ icon, title, hint }: { icon: any; title: string; hint: React.ReactNode }) {
  return (
    <div style={{
      padding: '48px 24px', textAlign: 'center', background: C.card,
      border: `1px solid ${C.cardBorder}`, borderRadius: 14,
      boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
    }}>
      <FontAwesomeIcon icon={icon} style={{ fontSize: 22, color: C.mutedSoft, marginBottom: 10 }} />
      <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: C.text }}>{title}</h4>
      <p style={{ margin: 0, fontSize: 12, color: C.muted }}>{hint}</p>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: '28px 32px',
    // Rounded/friendly type stack — Nunito (Google Fonts) primary,
    // then `ui-rounded` (Apple SF Pro Rounded) + system fallbacks so
    // the teacher-facing page reads as soft & approachable.
    fontFamily: '"Nunito", ui-rounded, -apple-system, "SF Pro Rounded", "Avenir Next", "Segoe UI", system-ui, sans-serif',
    background: C.bg, minHeight: '100vh', color: C.text,
  },
  inner: { maxWidth: 1440, margin: '0 auto' },

  backBtn: {
    width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.cardBorder}`,
    background: '#fff', cursor: 'pointer', color: C.muted, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 12,
  },
  // Mobile: bare chevron, no box/border — the native phone-app
  // back affordance, sitting inline right before the page title.
  backBtnMobile: {
    width: 28, height: 28, border: 'none', background: 'transparent',
    cursor: 'pointer', color: C.text, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 19,
    padding: 0, flexShrink: 0, WebkitAppearance: 'none' as const,
    WebkitTapHighlightColor: 'transparent', outline: 'none',
  },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 },
  crumbLink: { color: C.muted, textDecoration: 'none', fontWeight: 500 },
  crumbCurrent: { color: C.text, fontWeight: 600 },

  heading: { margin: 0, fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: '-0.025em' },

  summaryCard: {
    background: C.card,
    border: `1px solid ${C.cardBorder}`,
    borderRadius: 20,
    padding: '20px 20px 22px', marginBottom: 44,
    // Calm two-layer shadow: a tight close shadow for crispness +
    // a softer mid-distance drop for gentle depth. Pulled back from
    // the previous heavier three-layer version so the card lifts
    // without dropping a dark band below it.
    boxShadow: '0 1px 2px rgba(15,23,42,0.05), 0 6px 16px rgba(15,23,42,0.06)',
  },


  // Two-column layout: filter sidebar on the left, mission content on the right.
  layout: {
    display: 'grid',
    gridTemplateColumns: '288px minmax(0, 1fr)',
    gap: SP.xl,
    alignItems: 'start',
  },
  sidebar: {
    position: 'sticky' as const, top: 28,
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 14,
    padding: 14,
    boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
  },
  main: { minWidth: 0 },
  filterEyebrow: {
    fontSize: 10, fontWeight: 700, color: C.muted,
    textTransform: 'uppercase' as const, letterSpacing: '0.08em',
    padding: '4px 8px 8px',
  },
  filterList: { display: 'flex', flexDirection: 'column' as const, gap: 2 },
  sidebarDivider: {
    height: 1, background: C.divider,
    margin: '12px 4px',
  },
  toggleRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    width: '100%', padding: '7px 10px', borderRadius: 8,
    fontSize: 13, fontWeight: 500, color: C.textSub,
    cursor: 'pointer', userSelect: 'none' as const,
    transition: 'background 160ms ease',
  },
  toggleCheckbox: {
    width: 15, height: 15, margin: 0, accentColor: C.primary,
    cursor: 'pointer', flexShrink: 0,
  },
  filterBtn: {
    display: 'flex', alignItems: 'center', gap: 10,
    width: '100%', padding: '8px 10px', borderRadius: 8,
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: '1px solid transparent',
    fontFamily: 'inherit', textAlign: 'left' as const,
    transition: 'background 160ms ease, color 160ms ease, border-color 160ms ease',
  },

  // Buttons
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    height: 32, padding: '0 14px', borderRadius: 8,
    fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
    background: C.primary, color: '#fff', border: 'none',
    cursor: 'pointer',
    boxShadow: `0 1px 2px ${C.primary}40`,
    transition: 'background 160ms ease, box-shadow 160ms ease',
  },
  btnOutline: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    height: 32, padding: '0 14px', borderRadius: 8,
    fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
    background: '#fff', color: C.primary,
    border: `1px solid ${C.primaryBorder}`,
    cursor: 'pointer',
    transition: 'background 160ms ease, border-color 160ms ease',
  },
  btnGhost: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    height: 32, padding: '0 14px', borderRadius: 8,
    fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
    background: 'transparent', color: C.muted,
    border: `1px solid ${C.cardBorder}`,
    cursor: 'pointer',
  },
};

// Mobile overrides — spread onto base styles via useIsMobile so the
// layout reacts to live window resize instead of being frozen at
// module-load time.
const sMobile: Record<string, React.CSSProperties> = {
  page: { padding: `${SP.lg}px ${SP.md}px ${SP.xxl}px` },
  // minmax(0, 1fr) — not '1fr' — so the track can shrink below its
  // children's intrinsic min-content. Without this, a wide child
  // (e.g. a segmented progress bar with many cells) blows the grid
  // track wider than the viewport.
  layout: { gridTemplateColumns: 'minmax(0, 1fr)', gap: SP.lg },
  // Strip card chrome on mobile — the filters sit directly on the page
  // background so they feel like native top-of-screen controls.
  sidebar: {
    position: 'static', top: 'auto',
    padding: 0,
    background: 'transparent',
    border: 'none',
    boxShadow: 'none',
    borderRadius: 0,
  },
  // Horizontal scrollable chip rail for the category list. Uses
  // `space-evenly` so the gap from the first badge to the left edge,
  // every inter-badge gap, and the gap from the last badge to the
  // right edge are all equal — the row reads as a balanced strip
  // rather than badges hugging the screen edges. The vertical
  // padding gives the badges breathing room above and below.
  filterList: {
    flexDirection: 'row',
    overflowX: 'auto',
    justifyContent: 'space-evenly',
    gap: 8,
    padding: '6px 0 14px',
    flexWrap: 'nowrap',
  },
  filterBtn: {
    width: 'auto',
    flexShrink: 0,
    gap: 6,
    padding: '6px 10px',
    borderRadius: 999,
    border: `1px solid ${C.cardBorder}`,
    background: '#fff',
    fontSize: 12,
  },
  sidebarDivider: { margin: '10px 0' },
};
