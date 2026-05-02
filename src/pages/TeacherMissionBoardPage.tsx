import React, { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft, faChevronLeft, faChevronRight, faRoad, faTriangleExclamation,
  faCircleCheck, faCircle, faClock, faPaperPlane, faPlay, faCircleInfo,
  faStar,
} from '@fortawesome/free-solid-svg-icons';
import {
  fetchTeacherCareer, upsertTeacherMissionProgress,
  MissionWithProgress, MissionCategory, MissionStatus, MissionDifficulty,
} from '../api/career-missions.js';
import { useToast } from '../components/common/Toast.js';
import { MissionDetailModal } from './TeacherCareerPage.js';
import { useCategoryMeta } from '../utils/missionCategoryIcons.js';

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
  IN_PROGRESS:  { label: 'In Progress',     bg: C.primarySoft,  color: C.primary, icon: faClock,        cta: 'Update' },
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

  const { data, isLoading, isError } = useQuery({
    queryKey: ['teacher-career', id],
    queryFn: () => fetchTeacherCareer(id!),
    enabled: !!id,
  });

  const [filter, setFilter] = useState<FilterKey>('ALL');
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

  const invalidate = () => qc.invalidateQueries({ queryKey: ['teacher-career', id] });

  if (isLoading) return <div style={s.page}><p style={{ padding: 40, color: C.mutedSoft }}>Loading…</p></div>;
  if (isError || !data) return <div style={s.page}><p style={{ padding: 40, color: C.danger }}>Failed to load.</p></div>;

  const { teacher, currentPosition, readiness } = data;
  const isCurrentInLadder = readiness.isCurrentInLadder ?? true;

  // Filter row: ALL + the categories that actually have missions, in
  // their admin-set sort order. Hides empty categories.
  const filterKeys: FilterKey[] = ['ALL', ...missionCategories.filter(c => (counts[c.code]?.total ?? 0) > 0).map(c => c.code)];

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

  const showBody = currentPosition && isCurrentInLadder && sortedMissions.length > 0;

  return (
    <div style={s.page}>
      <div style={s.inner}>
        {/* ── Top bar — back + breadcrumb ─────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: SP.lg }}>
          <button
            onClick={() => navigate(`/teachers/${id}/career`)}
            style={s.backBtn}
            aria-label="Back"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <div style={s.breadcrumb}>
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
        <div style={{ marginBottom: SP.xl }}>
          <h1 style={s.heading}>Mission Board</h1>
          <p style={s.subheading}>
            Complete missions to unlock this achievement.
          </p>
        </div>

        {/* ── Mission Track Summary ───────────────────────────────────── */}
        {/* Mission-track focused — never shows promotion progress. The
            promotion overview already lives on the career page; here we
            only care about the selected track / achievement. */}
        {showBody && (() => {
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

        {/* ── Category filter ─────────────────────────────────────────── */}
        {showBody && (
          <div style={s.filterCard}>
            <div style={s.filterRow}>
              {filterKeys.map(k => {
                const active = k === filter;
                const meta = k === 'ALL' ? null : getMeta(k);
                const stat = counts[k] ?? { completed: 0, total: 0 };
                const done = stat.total > 0 && stat.completed === stat.total;

                const tintColor = done ? C.success : (meta ? meta.color : C.primary);
                const tintBg = done ? `${C.success}14` : (meta ? meta.bg : C.primarySoft);
                const tintBorder = done ? `${C.success}55` : (meta ? `${meta.color}55` : C.primaryBorder);

                return (
                  <button
                    key={k}
                    onClick={() => setFilter(k)}
                    style={{
                      ...s.filterBtn,
                      background: active ? tintBg : 'transparent',
                      color: active ? tintColor : (done ? C.success : C.textSub),
                      borderColor: active ? tintBorder : 'transparent',
                    }}
                  >
                    {meta && <FontAwesomeIcon icon={meta.icon} style={{ fontSize: 11 }} />}
                    <span>{k === 'ALL' ? 'All' : (meta!.achievementName || meta!.label)}</span>
                    <span style={{
                      marginLeft: 2, padding: '0 8px', height: 18,
                      display: 'inline-flex', alignItems: 'center', borderRadius: 999,
                      fontSize: 10, fontWeight: 700,
                      background: active ? '#fff' : C.divider,
                      color: active ? tintColor : (done ? C.success : C.muted),
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {stat.completed}/{stat.total}
                    </span>
                  </button>
                );
              })}
            </div>
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
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={faRoad}
            title="No missions in this category"
            hint="Switch to a different category to see other missions."
          />
        ) : (
          <>
            {requiredMissions.length > 0 && (
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
                  />
                )}
              />
            )}
            {optionalMissions.length > 0 && (
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
                  />
                )}
              />
            )}
            {completedMissions.length > 0 && (
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
                  />
                )}
              />
            )}
          </>
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
  const earnedColor = starColor || C.success;
  // Track-tinted accent — when the user has selected a specific
  // achievement we use its category color; "All" view uses the primary.
  const accent = trackMeta ? trackMeta.color : C.primary;
  // When fully earned, the whole card pivots to the position's star
  // color so the win is visually distinct from other states.
  const tint = done ? earnedColor : accent;

  return (
    <div style={{
      ...s.summaryCard,
      background: done ? `${earnedColor}0a` : C.card,
      border: `1px solid ${done ? `${earnedColor}40` : C.cardBorder}`,
    }}>
      {/* Top row — track icon + track name + earned indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SP.md, marginBottom: SP.md }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: done ? `${earnedColor}14` : (trackMeta ? trackMeta.bg : C.primarySoft),
          color: tint, fontSize: 18,
          border: `1px solid ${done ? `${earnedColor}40` : 'transparent'}`,
        }}>
          <FontAwesomeIcon
            icon={done ? faStar : (trackMeta ? trackMeta.icon : faStar)}
            style={done ? { filter: `drop-shadow(0 1px 3px ${earnedColor}66)` } : undefined}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: C.muted,
            textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>
            Mission Track
          </div>
          <div style={{
            marginTop: 2, fontSize: 18, fontWeight: 800,
            color: done ? earnedColor : C.text,
            letterSpacing: '-0.02em', lineHeight: 1.2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {trackName}
          </div>
        </div>
        {/* Big count, right-aligned. Tabular numerics so segment changes
            don't shift width. */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontSize: 22, fontWeight: 800,
            color: done ? earnedColor : C.text,
            letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          }}>
            {completed}<span style={{ color: C.mutedSoft, fontWeight: 600 }}> / {total}</span>
          </div>
          <div style={{
            marginTop: 4, fontSize: 11, fontWeight: 600, color: C.muted,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            Missions
          </div>
        </div>
      </div>

      {/* Chunky segmented bar — each segment is exactly one mission, so
          one completion produces a clear ~1/N visual jump. Caps at 16
          segments to stay readable on narrow widths; larger sets fall
          back to a continuous bar. */}
      <SegmentedProgress completed={completed} total={total} color={tint} />

      {/* Supporting line — never mentions promotion, just track progress. */}
      <div style={{
        marginTop: SP.md, fontSize: 13, fontWeight: 600,
        color: done ? earnedColor : C.textSub,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {done ? (
          <>
            <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 13 }} />
            <span>This track is completed. Achievement earned.</span>
          </>
        ) : total === 0 ? (
          <span style={{ color: C.muted }}>No missions in this track yet.</span>
        ) : (
          <>
            <span>{completed} of {total} missions completed</span>
            <span style={{ color: C.divider }}>·</span>
            <span style={{ color: accent }}>
              {remaining === 1 ? '1 mission to go' : `${remaining} missions to go`}
            </span>
          </>
        )}
      </div>
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

  return (
    <div style={{ marginBottom: SP.xxl }}>
      <div style={{ marginBottom: SP.md }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <h2 style={{
            margin: 0, fontSize: 14, fontWeight: 700, color: C.text,
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
        <p style={{
          margin: '4px 0 0', fontSize: 12, fontWeight: 500, color: C.muted, lineHeight: 1.5,
        }}>
          {hint}
        </p>
      </div>
      <div style={{
        display: 'grid', gap: SP.md,
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
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
      marginTop: SP.md, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
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
  mission, variant, isFuture, onEdit,
}: {
  mission: MissionWithProgress;
  variant: 'required' | 'optional';
  /** True when this mission belongs to a future ladder position. The
   *  card surfaces a "For {Position}" pill so the teacher knows it's
   *  head-start work, not part of their current promotion. */
  isFuture: boolean;
  onEdit: () => void;
}) {
  const { getMeta } = useCategoryMeta();
  const cat = getMeta(mission.category);
  const status: MissionStatus = mission.progress?.status ?? 'PENDING';
  const sm = STATUS_META[status];
  const isCompleted = status === 'COMPLETED';
  const isOptional = variant === 'optional';
  const effort = effortFor(mission);

  // Card chrome — required keeps the standard white card; optional steps
  // back to a soft fill + lighter border so the eye trusts the priority order.
  const cardBg = isCompleted ? C.successSoft : (isOptional ? C.cardSoft : C.card);
  const cardBorder = isCompleted ? C.successBorder : (isOptional ? C.cardBorderSoft : C.cardBorder);
  const cardShadow = isOptional
    ? 'none'
    : '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)';

  // Required pill — visible but not aggressive. We use a soft danger tint
  // to mark "must do" without screaming. Optional pill is calm slate.
  const requiredPill = mission.required
    ? { bg: C.dangerSoft, color: C.danger, label: 'Required' }
    : { bg: C.slateSoft, color: C.slate, label: 'Optional' };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: SP.md,
      padding: SP.lg,
      background: cardBg,
      border: `1px solid ${cardBorder}`,
      borderRadius: 14,
      boxShadow: cardShadow,
      transition: 'box-shadow 200ms ease, transform 200ms ease',
    }}>
      {/* Header — icon + title + required/optional pill */}
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
      </div>

      {/* Metadata row — category · difficulty · duration · (future tier) */}
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
        {isFuture && mission.positionName && (
          <>
            <span style={{ color: C.divider }}>·</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '1px 8px', height: 18, borderRadius: 999,
              fontSize: 10, fontWeight: 700,
              background: C.primarySoft, color: C.primary,
              border: `1px solid ${C.primaryBorder}`,
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              For {mission.positionName}
            </span>
          </>
        )}
      </div>

      {/* Description */}
      {mission.description && (
        <p style={{
          margin: 0, fontSize: 13, fontWeight: 400, color: C.textSub, lineHeight: 1.55,
        }}>
          {mission.description}
        </p>
      )}

      {/* Footer — status + CTA. Pushes to bottom via flex. */}
      <div style={{
        marginTop: 'auto', paddingTop: SP.md,
        borderTop: `1px solid ${C.divider}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', height: 24, borderRadius: 999,
          fontSize: 11, fontWeight: 600,
          background: sm.bg, color: sm.color,
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
            : isOptional
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
  inner: { maxWidth: 1200, margin: '0 auto' },

  backBtn: {
    width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.cardBorder}`,
    background: '#fff', cursor: 'pointer', color: C.muted, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 12,
  },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 },
  crumbLink: { color: C.muted, textDecoration: 'none', fontWeight: 500 },
  crumbCurrent: { color: C.text, fontWeight: 600 },

  heading: { margin: 0, fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: '-0.025em' },
  subheading: {
    margin: '6px 0 0', fontSize: 13, fontWeight: 500, color: C.muted, lineHeight: 1.5,
    maxWidth: 600,
  },

  summaryCard: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 14,
    padding: SP.xl, marginBottom: SP.lg,
    boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
  },

  filterCard: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 14,
    padding: 8, marginBottom: SP.lg, overflowX: 'auto',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
  },
  filterRow: { display: 'flex', gap: 6, flexWrap: 'nowrap' },
  filterBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 10,
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: '1px solid transparent', whiteSpace: 'nowrap',
    fontFamily: 'inherit',
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
