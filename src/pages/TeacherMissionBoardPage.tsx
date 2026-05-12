import React, { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft, faChevronLeft, faChevronRight, faRoad, faTriangleExclamation,
  faCircleCheck, faCircle, faClock, faPaperPlane, faPlay, faCircleInfo,
  faStar, faThumbtack, faCheck, faTrophy,
} from '@fortawesome/free-solid-svg-icons';
import {
  fetchTeacherCareer, upsertTeacherMissionProgress,
  MissionWithProgress, MissionCategory, MissionStatus, MissionDifficulty,
} from '../api/career-missions.js';
import { useToast } from '../components/common/Toast.js';
import { MissionDetailModal } from './TeacherCareerPage.js';
import { useCategoryMeta } from '../utils/missionCategoryIcons.js';
import { useMissionTargets } from '../hooks/useMissionTargets.js';
import { useIsMobile } from '../hooks/useIsMobile.js';

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardSoft: '#fafbfc',
  cardBorder: '#eceef2',
  cardBorderSoft: '#e9ecf1',
  divider: '#eef0f3',
  text: '#0f172a',
  textSub: '#475569',
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

// Difficulty → label + estimated duration. Mirrors the heuristic in
// TeacherCareerPage (effortFor) but lives here so the Board page is
// self-contained and easier to evolve.
function effortFor(m: MissionWithProgress): { label: string; hint: string } {
  const evidenceItems = (m.evidenceRequirements?.split('\n').filter(l => l.trim()).length) ?? 0;
  if (m.difficulty === 'BASIC') {
    return evidenceItems <= 2
      ? { label: 'Quick',  hint: '~1 hour' }
      : { label: 'Quick',  hint: '~2–3 hours' };
  }
  if (m.difficulty === 'INTERMEDIATE') {
    return evidenceItems <= 3
      ? { label: 'Medium', hint: '1–3 days' }
      : { label: 'Medium', hint: '3–5 days' };
  }
  return evidenceItems <= 3
    ? { label: 'Major',  hint: '~1 week' }
    : { label: 'Major',  hint: '1–2 weeks' };
}

const DIFFICULTY_LABEL: Record<MissionDifficulty, string> = {
  BASIC: 'Quick', INTERMEDIATE: 'Medium', ADVANCED: 'Major',
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TeacherMissionBoardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { categories: missionCategories, getMeta } = useCategoryMeta();
  const { isMobile } = useIsMobile();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['teacher-career', id],
    queryFn: () => fetchTeacherCareer(id!),
    enabled: !!id,
  });

  const [filter, setFilter] = useState<FilterKey>('ALL');
  type ShowMode = 'all' | 'required' | 'optional' | 'completed';
  const [showMode, setShowMode] = useState<ShowMode>('required');
  const [editingMission, setEditingMission] = useState<MissionWithProgress | null>(null);
  const { isTargeted, toggle: toggleTarget } = useMissionTargets(id);

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

  const invalidate = () => qc.invalidateQueries({ queryKey: ['teacher-career', id] });

  const pageStyle = { ...s.page, ...(isMobile ? sMobile.page : null) };
  if (isLoading) return <div style={pageStyle}><p style={{ padding: 40, color: C.mutedSoft }}>Loading…</p></div>;
  if (isError || !data) return <div style={pageStyle}><p style={{ padding: 40, color: C.danger }}>Failed to load.</p></div>;

  const { teacher, currentPosition, readiness } = data;
  const isCurrentInLadder = readiness.isCurrentInLadder ?? true;

  // Filter row: only categories that have missions, sorted alphabetically
  // by their displayed name (achievement name when set, else category
  // name). The teacher always lands on a specific category — there's
  // no "All" state.
  const filterKeys: FilterKey[] = missionCategories
    .filter(c => (counts[c.code]?.total ?? 0) > 0)
    .map(c => {
      const meta = getMeta(c.code);
      return { code: c.code, label: meta.achievementName || meta.label };
    })
    .sort((a, b) => a.label.localeCompare(b.label))
    .map(c => c.code);

  // Auto-select the first available category once they've loaded so
  // the user never sees the "all missions" state.
  React.useEffect(() => {
    if (filterKeys.length > 0 && !filterKeys.includes(filter)) {
      setFilter(filterKeys[0]);
    }
  }, [filterKeys, filter]);

  const onSaveMission = async (status: MissionStatus, evidenceCount: number, evidenceTotal: number, notes: string | null) => {
    if (!editingMission) return;
    try {
      await upsertTeacherMissionProgress(id!, editingMission.id, { status, evidenceCount, evidenceTotal, notes });
      showToast('Mission progress updated');
      invalidate();
      setEditingMission(null);
    } catch (e: any) {
      showToast(e?.message ?? 'Save failed', 'error');
    }
  };

  return (
    <div style={pageStyle}>
      <style>{`
        .mb-filter-btn:hover { background: #f8fafc !important; }
        .mb-filter-btn-done:hover { background: #f59e0b14 !important; }
        .mb-chip-scroll { -webkit-overflow-scrolling: touch; scrollbar-width: none; }
        .mb-chip-scroll::-webkit-scrollbar { display: none; }
      `}</style>
      <div style={s.inner}>
        {/* ── Top bar — back + breadcrumb ─────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: SP.lg, minWidth: 0 }}>
          <button
            onClick={() => navigate(`/teachers/${id}/career`)}
            style={s.backBtn}
            aria-label="Back"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <div style={{ ...s.breadcrumb, flexWrap: 'wrap', rowGap: 4, minWidth: 0 }}>
            <Link to="/teachers" style={s.crumbLink}>Teachers</Link>
            <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
            <Link to={`/teachers/${id}`} style={s.crumbLink}>{teacher.name}</Link>
            <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
            <Link to={`/teachers/${id}/career`} style={s.crumbLink}>Career</Link>
            <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
            <span style={s.crumbCurrent}>Mission Board</span>
          </div>
        </div>

        {/* ── Title block ─────────────────────────────────────────────── */}
        <div style={{ marginBottom: isMobile ? SP.md : SP.xl }}>
          <h1 style={{ ...s.heading, fontSize: isMobile ? 22 : 26 }}>Mission Board</h1>
        </div>

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

                  // Active state uses one consistent focus color across all
                  // categories — the category's own colour stays as the icon
                  // tile tint so the row still reads as that category.
                  // Completed categories swap to the success palette.
                  // Completed categories celebrate in gold (matching the
                  // Mission Track band + trophy empty state). Active /
                  // hover both pull in the same gold palette.
                  const GOLD = '#f59e0b';
                  const focusBg = done ? `${GOLD}1a` : C.primarySoft;
                  const focusBorder = done ? `${GOLD}55` : C.primaryBorder;
                  const focusFg = done ? GOLD : C.primary;

                  const fullLabel = k === 'ALL' ? 'All' : (meta!.achievementName || meta!.label);
                  return (
                    <button
                      key={k}
                      onClick={() => setFilter(k)}
                      title={fullLabel}
                      className={done ? 'mb-filter-btn mb-filter-btn-done' : 'mb-filter-btn'}
                      style={{
                        ...s.filterBtn,
                        ...(isMobile ? sMobile.filterBtn : null),
                        background: active ? focusBg : (isMobile ? '#fff' : 'transparent'),
                        color: active ? focusFg : (done ? GOLD : C.textSub),
                        borderColor: active ? focusBorder : (isMobile ? C.cardBorder : 'transparent'),
                      }}
                    >
                      <span style={{
                        width: 22, height: 22, borderRadius: 6,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: meta ? `${meta.color}1a` : 'transparent',
                        color: meta ? meta.color : C.muted,
                        flexShrink: 0,
                      }}>
                        {meta && <FontAwesomeIcon icon={meta.icon} style={{ fontSize: 11 }} />}
                      </span>
                      <span style={{
                        flex: 1, minWidth: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {fullLabel}
                      </span>
                      {/* Count badge — replaced with a gold tick when
                          the category is fully completed. */}
                      <span style={{
                        padding: '0 8px', height: 18,
                        display: 'inline-flex', alignItems: 'center', borderRadius: 999,
                        fontSize: 10, fontWeight: 700,
                        background: active ? '#fff' : C.divider,
                        color: done ? GOLD : (active ? focusFg : C.muted),
                        fontVariantNumeric: 'tabular-nums',
                        flexShrink: 0,
                      }}>
                        {done
                          ? <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10, fontWeight: 900 }} />
                          : `${stat.completed}/${stat.total}`}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Show — single-select view mode. Defaults to Required
                  so the teacher lands on must-do work. */}
              {!isMobile && <div style={s.sidebarDivider} />}
              {!isMobile && <div style={s.filterEyebrow}>Show</div>}
              <div style={{
                ...s.filterList,
                ...(isMobile ? {
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  gap: 0,
                  marginTop: 10,
                  border: `1px solid ${C.cardBorder}`,
                  borderRadius: 10,
                  overflow: 'hidden',
                  background: '#fff',
                } : null),
              }}>
                {([
                  { key: 'all' as const, label: 'All', count: requiredMissions.length + optionalMissions.length + completedMissions.length },
                  { key: 'required' as const, label: 'Required', count: requiredMissions.length },
                  { key: 'optional' as const, label: 'Optional', count: optionalMissions.length },
                  { key: 'completed' as const, label: 'Completed', count: completedMissions.length },
                ]).map(vm => {
                  const active = showMode === vm.key;
                  if (isMobile) {
                    // Segmented control: each button is a flush cell
                    // separated only by a hairline border on the left.
                    // Label sits on top of count so the label never
                    // truncates at narrow widths (4 cells on 375px ≈ 88px each).
                    return (
                      <button
                        key={vm.key}
                        type="button"
                        onClick={() => setShowMode(vm.key)}
                        aria-pressed={active}
                        style={{
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          gap: 1, width: '100%', minWidth: 0,
                          padding: '8px 4px',
                          borderRadius: 0,
                          border: 'none',
                          borderLeft: vm.key === 'all' ? 'none' : `1px solid ${C.cardBorder}`,
                          background: active ? C.primarySoft : '#fff',
                          color: active ? C.primary : C.textSub,
                          fontFamily: 'inherit',
                          cursor: 'pointer',
                          transition: 'background 160ms ease, color 160ms ease',
                        }}
                      >
                        <span style={{
                          fontSize: 12, fontWeight: active ? 700 : 600,
                          lineHeight: 1.2,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          maxWidth: '100%',
                        }}>
                          {vm.label}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          color: active ? C.primary : C.mutedSoft,
                          fontVariantNumeric: 'tabular-nums', lineHeight: 1.2,
                        }}>
                          {vm.count}
                        </span>
                      </button>
                    );
                  }
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
            </aside>

            {/* ── Main — track summary + mission sections ─────────────── */}
            <main style={s.main}>
              {(() => {
                const focusedCat = filter === 'ALL'
                  ? null
                  : missionCategories.find(c => c.code === filter) ?? null;
                const stat = filter === 'ALL'
                  ? totalStats
                  : counts[filter] ?? { completed: 0, total: 0 };
                const trackName = focusedCat
                  ? focusedCat.achievementName || focusedCat.name
                  : 'All Missions';
                const trackMeta = focusedCat ? getMeta(focusedCat.code) : null;
                // Surface the most actionable mission so the band reads
                // as "command center", not just stats. Required for the
                // current position wins; otherwise fall back to the
                // first non-completed mission in the category.
                const nextMission = requiredMissions[0]?.title
                  ?? optionalMissions.find(m => m.positionId === currentPositionId)?.title
                  ?? optionalMissions[0]?.title
                  ?? null;
                return (
                  <MissionTrackSummary
                    trackName={trackName}
                    trackMeta={trackMeta}
                    completed={stat.completed}
                    total={stat.total}
                    starColor={currentPosition?.starColor ?? null}
                    nextMission={nextMission}
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
                    const GOLD = '#f59e0b';
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
                return (
                  <>
                    {showRequiredSec && requiredMissions.length > 0 && (
                      <SectionBlock
                        eyebrow="Required Missions"
                        hint="Missions you need to complete for your next promotion."
                        accent={C.danger}
                        items={requiredMissions}
                        pageSize={6}
                        getKey={m => m.id}
                        renderItem={m => (
                          <BoardMissionCard
                            mission={m}
                            variant="required"
                            isFuture={false}
                            onEdit={() => setEditingMission(m)}
                            isTargeted={isTargeted(m.id)}
                            onToggleTarget={() => toggleTarget(m.id)}
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
                        renderItem={m => (
                          <BoardMissionCard
                            mission={m}
                            variant="optional"
                            isFuture={m.positionId !== currentPositionId}
                            onEdit={() => setEditingMission(m)}
                            isTargeted={isTargeted(m.id)}
                            onToggleTarget={() => toggleTarget(m.id)}
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
                        renderItem={m => (
                          <BoardMissionCard
                            mission={m}
                            variant={m.required && m.positionId === currentPositionId ? 'required' : 'optional'}
                            isFuture={m.positionId !== currentPositionId}
                            onEdit={() => setEditingMission(m)}
                            isTargeted={isTargeted(m.id)}
                            onToggleTarget={() => toggleTarget(m.id)}
                          />
                        )}
                      />
                    )}
                  </>
                );
              })()}
            </main>
          </div>
        )}
      </div>

      {editingMission && (
        <MissionDetailModal
          mission={editingMission}
          onClose={() => setEditingMission(null)}
          onSave={onSaveMission}
        />
      )}
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
  trackName, trackMeta, completed, total, starColor, nextMission,
}: {
  trackName: string;
  /** null when the user is on the "All" tab — we render a neutral track card. */
  trackMeta: { icon: any; bg: string; color: string } | null;
  completed: number;
  total: number;
  /** Position-tier color for the earned star (silver/gold/blue/...). */
  starColor: string | null;
  /** Title of the mission to nudge the teacher toward. Renders a small
   *  "Next" line under the progress bar. */
  nextMission: string | null;
}) {
  const done = total > 0 && completed === total;
  const remaining = Math.max(0, total - completed);
  // Celebratory gold for completed tracks. The position's starColor can
  // be silver/bronze on lower tiers — using it here washed the band
  // out to grey, which read as "stale" instead of "earned". A vibrant
  // amber-gold consistently celebrates the achievement.
  const GOLD = '#f59e0b';
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
      // When the track is done we lift the gold tint to a more visible
      // celebratory level — otherwise the band still reads as a calm
      // progress strip.
      background: done
        ? `linear-gradient(135deg, ${bandTint}1f, ${bandTint}0a)`
        : `linear-gradient(135deg, ${bandTint}10, ${bandTint}05)`,
      border: `1px solid ${done ? `${bandTint}40` : `${bandTint}26`}`,
      boxShadow: done ? `0 1px 2px ${bandTint}1f, 0 4px 12px ${bandTint}14` : 'none',
    }}>
      {/* Top row — track icon + name + count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SP.md, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#fff',
          color: bandTint, fontSize: 16,
          border: `1px solid ${bandTint}33`,
        }}>
          <FontAwesomeIcon
            icon={done ? faStar : (trackMeta ? trackMeta.icon : faStar)}
            style={done ? { filter: `drop-shadow(0 1px 3px ${earnedColor}66)` } : undefined}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 16, fontWeight: 800,
            color: done ? earnedColor : C.text,
            letterSpacing: '-0.018em', lineHeight: 1.2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {trackName}
          </div>
          <div style={{
            marginTop: 2, fontSize: 12, fontWeight: 500,
            color: done ? earnedColor : C.muted,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {done
              ? 'Track completed · achievement earned'
              : total === 0
              ? 'No missions in this track yet'
              : `${remaining} mission${remaining === 1 ? '' : 's'} to go`}
          </div>
        </div>
        {/* Compact count, right-aligned. */}
        <div style={{
          fontSize: 15, fontWeight: 700,
          color: done ? earnedColor : C.text,
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
        }}>
          {completed}<span style={{ color: C.mutedSoft, fontWeight: 500 }}> / {total}</span>
        </div>
      </div>

      {/* Chunky segmented bar — the motivation hero. Each segment is one
          mission, so each completion produces a satisfying step. */}
      <SegmentedProgress completed={completed} total={total} color={bandTint} />

      {/* Next-step microline — turns the band into a "what do I do
          next" cue, not just a progress readout. Hides when the track
          is finished or empty. */}
      {!done && total > 0 && nextMission && (
        <div style={{
          marginTop: 12,
          display: 'flex', alignItems: 'baseline', gap: 6,
          fontSize: 12, fontWeight: 500, color: C.muted,
          minWidth: 0,
        }}>
          <span style={{
            fontSize: 9, fontWeight: 800, color: bandTint,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            flexShrink: 0,
          }}>
            Next
          </span>
          <span style={{
            color: C.textSub, fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            minWidth: 0,
          }}>
            {nextMission}
          </span>
        </div>
      )}
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
        height: 14, background: `${color}1a`, borderRadius: 6, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: color, borderRadius: 6,
          transition: 'width 500ms cubic-bezier(0.4, 0, 0.2, 1)',
        }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {Array.from({ length: total }).map((_, i) => {
        const filled = i < completed;
        return (
          <div key={i} style={{
            flex: 1, height: 14, borderRadius: 5,
            background: filled ? color : `${color}1f`,
            boxShadow: filled
              ? `inset 0 1px 0 rgba(255,255,255,0.25), 0 1px 2px ${color}33`
              : 'none',
            transition: 'background 400ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 400ms ease',
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
  eyebrow, hint, accent, items, pageSize, renderItem, getKey,
}: {
  eyebrow: string;
  hint: string;
  accent: string;
  items: T[];
  pageSize: number;
  renderItem: (item: T) => React.ReactNode;
  getKey: (item: T) => string;
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

  // Section colour-keys the eyebrow against the work's priority. The
  // accent passed in (danger/muted/success) doubles as a small left
  // accent bar so the section reads with visual weight matching its
  // importance, not just its label.
  return (
    <div style={{ marginBottom: isMobile ? 24 : 40 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: SP.md,
      }}>
        <span style={{
          width: 3, height: 14, borderRadius: 999, background: accent, flexShrink: 0,
        }} />
        <h2 style={{
          margin: 0, fontSize: isMobile ? 12 : 14, fontWeight: 700, color: C.text,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {eyebrow}
        </h2>
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '0 8px', height: 18, borderRadius: 999,
          fontSize: 10, fontWeight: 700,
          background: `${accent}14`, color: accent,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {total}
        </span>
      </div>
      <div style={{
        display: 'grid', gap: SP.md,
        gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(auto-fill, minmax(340px, 1fr))',
      }}>
        {visible.map(item => (
          <React.Fragment key={getKey(item)}>{renderItem(item)}</React.Fragment>
        ))}
      </div>
      {totalPages > 1 && (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          startIndex={start + 1}
          endIndex={end}
          total={total}
          onChange={setPage}
        />
      )}
    </div>
  );
}

// Compact pagination footer — chevron prev/next + range readout.
// Stays muted by default so it doesn't compete with mission cards.
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
      justifyContent: isMobile ? 'center' : 'space-between', gap: 8,
    }}>
      {!isMobile && (
        <div style={{ fontSize: 11, fontWeight: 500, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>
          Showing <span style={{ color: C.text, fontWeight: 700 }}>{startIndex}</span>
          –<span style={{ color: C.text, fontWeight: 700 }}>{endIndex}</span> of {total}
        </div>
      )}
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
  mission, variant, isFuture, onEdit,
  isTargeted, onToggleTarget,
}: {
  mission: MissionWithProgress;
  variant: 'required' | 'optional';
  /** True when this mission belongs to a future ladder position. The
   *  card surfaces a "For {Position}" pill so the teacher knows it's
   *  head-start work, not part of their current promotion. */
  isFuture: boolean;
  onEdit: () => void;
  isTargeted: boolean;
  onToggleTarget: () => void;
}) {
  const { isMobile } = useIsMobile();
  const { getMeta } = useCategoryMeta();
  const cat = getMeta(mission.category);
  const status: MissionStatus = mission.progress?.status ?? 'PENDING';
  const sm = STATUS_META[status];
  const isCompleted = status === 'COMPLETED';
  const isOptional = variant === 'optional';
  const effort = effortFor(mission);

  // Card chrome — required keeps the standard white card; optional steps
  // back to a soft fill + lighter border so the eye trusts the priority order.
  // Completed missions are greyed out so the eye skips past them to active work.
  const cardBg = isCompleted ? C.cardSoft : (isOptional ? C.cardSoft : C.card);
  const cardBorder = isCompleted ? C.cardBorderSoft : (isOptional ? C.cardBorderSoft : C.cardBorder);
  const cardShadow = isCompleted || isOptional
    ? 'none'
    : '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)';

  // Mission-priority pill — context-aware label so we never contradict
  // ourselves: a mission required *for a future role* is shown as
  // "FOR {POSITION}", not "REQUIRED" (which would only apply to the
  // current promotion). Optional missions read as "OPTIONAL".
  const requiredPill = mission.required && !isFuture
    ? { bg: C.dangerSoft, color: C.danger, label: 'Required' }
    : isFuture && mission.positionName
    ? { bg: C.primarySoft, color: C.primary, label: `For ${mission.positionName}` }
    : { bg: C.slateSoft, color: C.slate, label: 'Optional' };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: SP.md,
      padding: SP.lg,
      background: cardBg,
      border: `1px solid ${cardBorder}`,
      borderRadius: 14,
      boxShadow: cardShadow,
      opacity: isCompleted ? 0.65 : 1,
      transition: 'box-shadow 200ms ease, transform 200ms ease, opacity 200ms ease',
    }}>
      {/* Header — icon + title + pin + required/optional pill */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: cat.bg, color: cat.color, fontSize: 15,
        }}>
          <FontAwesomeIcon icon={cat.icon} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, fontWeight: 700, color: C.text,
            letterSpacing: '-0.012em', lineHeight: 1.3,
          }}>
            {mission.title}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {!isMobile && mission.highPriority && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', height: 22, borderRadius: 999,
              fontSize: 10, fontWeight: 700,
              background: C.warningSoft, color: C.warning,
              border: `1px solid ${C.warningBorder}`,
            }}>
              <FontAwesomeIcon icon={faStar} style={{ fontSize: 9 }} />
              Priority
            </span>
          )}
          {!isMobile && (
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '2px 9px', height: 22, borderRadius: 999,
              fontSize: 10, fontWeight: 700,
              background: requiredPill.bg, color: requiredPill.color,
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {requiredPill.label}
            </span>
          )}
          {/* Target pin — far-right anchor so the priority pill stays
              the dominant header signal. Filled when targeted,
              outlined-grey when not. */}
          <button
            type="button"
            onClick={onToggleTarget}
            title={isTargeted ? 'Remove from Current Targets' : 'Pin to Current Targets'}
            aria-pressed={isTargeted}
            style={{
              width: 24, height: 24, borderRadius: 6,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: isTargeted ? C.primarySoft : 'transparent',
              color: isTargeted ? C.primary : C.mutedSoft,
              border: `1px solid ${isTargeted ? C.primaryBorder : 'transparent'}`,
              cursor: 'pointer', padding: 0, fontFamily: 'inherit',
              transition: 'background 160ms ease, color 160ms ease, border-color 160ms ease',
            }}
          >
            <FontAwesomeIcon
              icon={faThumbtack}
              style={{
                fontSize: 11,
                transform: isTargeted ? 'rotate(0deg)' : 'rotate(45deg)',
                transition: 'transform 200ms ease',
              }}
            />
          </button>
        </div>
      </div>

      {/* Mobile-only pill row — gives the title above the full row width
          while keeping the priority + required signal visible. */}
      {isMobile && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {mission.highPriority && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', height: 22, borderRadius: 999,
              fontSize: 10, fontWeight: 700,
              background: C.warningSoft, color: C.warning,
              border: `1px solid ${C.warningBorder}`,
            }}>
              <FontAwesomeIcon icon={faStar} style={{ fontSize: 9 }} />
              Priority
            </span>
          )}
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '2px 9px', height: 22, borderRadius: 999,
            fontSize: 10, fontWeight: 700,
            background: requiredPill.bg, color: requiredPill.color,
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {requiredPill.label}
          </span>
        </div>
      )}

      {/* Metadata row — category · difficulty · duration. The "For X"
          context now lives in the priority pill itself, so this row is
          purely about the mission shape. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        fontSize: 12, fontWeight: 500, color: C.muted,
      }}>
        <span style={{ color: cat.color, fontWeight: 600 }}>{cat.label}</span>
        <span style={{ color: C.divider }}>·</span>
        <span>{DIFFICULTY_LABEL[mission.difficulty]}</span>
        <span style={{ color: C.divider }}>·</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <FontAwesomeIcon icon={faClock} style={{ fontSize: 10 }} />
          {effort.hint}
        </span>
      </div>

      {/* Description */}
      {mission.description && (
        <p style={{
          margin: '4px 0 0', fontSize: 13, fontWeight: 400, color: C.textSub,
          lineHeight: 1.6,
        }}>
          {mission.description}
        </p>
      )}

      {/* Footer — status on the left, action on the right. CTA visual
          weight follows priority + status:
            • Pending Required → solid primary (strongest)
            • Pending Optional → outlined primary
            • In progress      → solid primary "Continue" feel
            • Completed        → ghost success "View"
          For multi-evidence missions (e.g. "Conduct 2 parent meetings")
          we surface a small "{count} / {total} logged" chip beside the
          status pill so the teacher can see how far in they are without
          opening the detail modal. */}
      {(() => {
        // Always render the segmented progress bar so every card carries
        // the same baseline visual rhythm — empty pills for not-yet-
        // started, filled for logged evidence, all green for completed.
        const evidenceTotal = Math.max(1, mission.progress?.evidenceTotal ?? 1);
        const rawCount = mission.progress?.evidenceCount ?? 0;
        // Completed always reads as fully filled, even if the count
        // was never logged (some missions complete without evidence).
        const filledCount = isCompleted ? evidenceTotal : rawCount;
        // Pinned (targeted) cards get the saturated fill so the
        // teacher's focus list visibly carries more weight; everything
        // else stays in the calm Border-tier palette so non-target
        // cards don't compete for attention.
        const fillColor = isTargeted
          ? (isCompleted ? C.success : status === 'UNDER_REVIEW' ? C.warning : C.primary)
          : (isCompleted ? C.successBorder : status === 'UNDER_REVIEW' ? C.warningBorder : C.primaryBorder);
        return (
      <>
      <div style={{ marginTop: 'auto' }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {Array.from({ length: evidenceTotal }).map((_, i) => {
            const filled = i < filledCount;
            return (
              <div key={i} style={{
                flex: 1, height: 4, borderRadius: 999,
                background: filled ? fillColor : C.divider,
                transition: 'background 300ms ease',
              }} />
            );
          })}
        </div>
        <div style={{
          marginTop: 6,
          fontSize: 11, fontWeight: 500,
          color: C.mutedSoft,
          fontVariantNumeric: 'tabular-nums',
        }}>
          <span style={{ color: C.muted, fontWeight: 600 }}>{filledCount}</span>
          <span> / {evidenceTotal}</span>
          <span style={{ marginLeft: 4 }}>logged</span>
        </div>
      </div>
      <div style={{
        marginTop: SP.md,
        paddingTop: SP.md,
        borderTop: `1px solid ${C.divider}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', height: 24, borderRadius: 999,
          fontSize: 11, fontWeight: 600,
          background: sm.bg, color: sm.color,
          flexShrink: 0,
        }}>
          <FontAwesomeIcon icon={sm.icon} style={{ fontSize: 10 }} />
          {sm.label}
        </span>
        <button
          onClick={onEdit}
          style={isCompleted
            ? {
                ...s.btnGhost,
                color: C.success, borderColor: C.successBorder, background: '#fff',
              }
            : (isOptional && status === 'PENDING')
            ? s.btnOutline
            : s.btnPrimary
          }
        >
          {status === 'PENDING' && (
            <FontAwesomeIcon icon={faPlay} style={{ fontSize: 9, marginRight: 6 }} />
          )}
          {sm.cta}
        </button>
      </div>
      </>
        );
      })()}
    </div>
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
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    background: C.bg, minHeight: '100vh', color: C.text,
  },
  inner: { maxWidth: 1440, margin: '0 auto' },

  backBtn: {
    width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.cardBorder}`,
    background: '#fff', cursor: 'pointer', color: C.muted, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 12,
  },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 },
  crumbLink: { color: C.muted, textDecoration: 'none', fontWeight: 500 },
  crumbCurrent: { color: C.text, fontWeight: 600 },

  heading: { margin: 0, fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: '-0.025em' },

  summaryCard: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 14,
    padding: SP.xl, marginBottom: 32,
    boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
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
  // Horizontal scrollable chip rail for the category list.
  filterList: {
    flexDirection: 'row',
    overflowX: 'auto',
    gap: 6,
    paddingBottom: 4,
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
