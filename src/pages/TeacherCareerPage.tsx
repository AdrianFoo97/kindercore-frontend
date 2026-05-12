import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft, faCheck, faClock, faCircleCheck, faCircleNotch, faBookOpen,
  faClipboardCheck, faCalendarDays, faPeopleArrows, faStar, faRoad,
  faLightbulb, faMedal, faLock, faChevronRight, faTimes,
  faChartLine, faShieldHalved, faUserCheck, faTriangleExclamation,
  faPlay, faRocket, faFlag, faCircleInfo, faXmark, faThumbtack,
} from '@fortawesome/free-solid-svg-icons';
import {
  fetchTeacherCareer, upsertTeacherMissionProgress,
  MissionWithProgress, MissionCategory, MissionStatus, MissionDifficulty, TeacherCareerData,
} from '../api/career-missions.js';
import { useCategoryMeta } from '../utils/missionCategoryIcons.js';
import { useMissionTargets } from '../hooks/useMissionTargets.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { uploadUrl } from '../api/upload.js';
import { useToast } from '../components/common/Toast.js';

// ── Design tokens ────────────────────────────────────────────────────────────
// Slate-based neutral scale + a single primary accent. Lighter borders and
// softer shadows than the previous round — the goal is for the page to feel
// like a Linear/Stripe canvas where information sits *in* the surface, not
// boxed off from it.
const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eceef2',     // lighter than slate-200
  cardBorderHover: '#dde1e8',
  divider: '#eef0f3',        // hairline divider, slightly cooler
  dividerSoft: '#f6f7f9',
  text: '#0f172a',
  textSub: '#3f4b5c',        // a touch warmer/darker for body
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
  primaryBorder: '#c7d2fe',
  primaryDeep: '#3c339a',
  success: '#059669',
  successSoft: '#ecfdf5',    // softer mint
  successBorder: '#a7f3d0',
  warning: '#d97706',
  warningSoft: '#fffbeb',
  warningBorder: '#fde68a',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  dangerBorder: '#fecaca',
  ghost: '#f1f5f9',
};
// 4px-base spacing scale. Every margin/padding in the file should resolve to
// one of these — keeps vertical/horizontal rhythm strict.
const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, x4: 40, x5: 48 };
const RADIUS_SM = 8;   // pills, badges, mini-controls
const RADIUS = 12;     // cards, sections
const RADIUS_LG = 16;  // hero
// Softer-than-before shadow stack. Each level only adds the smallest visible
// difference, which is the SaaS-product trick.
const SHADOW = '0 1px 2px rgba(15,23,42,0.03)';
const SHADOW_LG = '0 1px 3px rgba(15,23,42,0.03), 0 4px 12px rgba(15,23,42,0.035)';
const SHADOW_HOVER = '0 1px 3px rgba(15,23,42,0.04), 0 6px 18px rgba(15,23,42,0.05)';
const TRANSITION = 'all 160ms cubic-bezier(0.4, 0, 0.2, 1)';

export const CATEGORY_META: Record<MissionCategory, { label: string; color: string; bg: string; icon: any }> = {
  CLASSROOM:  { label: 'Classroom',  color: '#1e40af', bg: '#dbeafe', icon: faRoad },
  SOP:        { label: 'SOP',        color: '#0e7490', bg: '#cffafe', icon: faClipboardCheck },
  EVENT:      { label: 'Event',      color: '#9a3412', bg: '#ffedd5', icon: faCalendarDays },
  PARENT:     { label: 'Parent',     color: '#86198f', bg: '#fae8ff', icon: faPeopleArrows },
  LEADERSHIP: { label: 'Leadership', color: '#92400e', bg: '#fef3c7', icon: faStar },
};

const STATUS_META: Record<MissionStatus, { label: string; color: string; bg: string; icon: any; cta: string }> = {
  PENDING:      { label: 'Not Started', color: C.muted,   bg: C.ghost,        icon: faClock,          cta: 'Start Mission' },
  IN_PROGRESS:  { label: 'In Progress', color: '#1e40af', bg: '#dbeafe',      icon: faCircleNotch,    cta: 'Continue' },
  UNDER_REVIEW: { label: 'Under Review', color: C.warning, bg: C.warningSoft,  icon: faClipboardCheck, cta: 'View Submission' },
  COMPLETED:    { label: 'Completed',   color: C.success, bg: C.successSoft,  icon: faCircleCheck,    cta: 'View' },
};

// Capability identity per category — what mastering this category SAYS about
// the teacher. Surfaced on Achievement badges so each one feels like an
// earned identity, not just a counter.
const CAPABILITY_IDENTITY: Record<MissionCategory, string> = {
  CLASSROOM:  'Classroom Leader',
  SOP:        'SOP Reliable',
  EVENT:      'Event Leader',
  PARENT:     'Parent Communication Ready',
  LEADERSHIP: 'Team Builder',
};

// One-sentence description of what each capability represents. Shown on the
// trophy detail cards so each badge feels like a real, recognised skill —
// not just an icon and a name.
const CAPABILITY_DESCRIPTION: Record<MissionCategory, string> = {
  CLASSROOM:  'Demonstrated independent classroom routines and lesson delivery.',
  SOP:        'Reliably follows school standard operating procedures.',
  EVENT:      'Plans and leads school events end-to-end.',
  PARENT:     'Owns parent relationships with confidence.',
  LEADERSHIP: 'Mentors and develops other teachers.',
};

const DIFFICULTY_LABEL: Record<MissionDifficulty, string> = {
  BASIC: 'Quick', INTERMEDIATE: 'Medium', ADVANCED: 'Major',
};

// Estimated effort derived from difficulty + evidence count. Keeps the
// teacher's mental model right when picking what to start next.
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

export default function TeacherCareerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { isMobile } = useIsMobile();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['teacher-career', id],
    queryFn: () => fetchTeacherCareer(id!),
    enabled: !!id,
  });

  const [editingMission, setEditingMission] = useState<MissionWithProgress | null>(null);
  const { isTargeted, toggle: toggleTarget } = useMissionTargets(id);

  // Sort missions: high-priority first, then required, then by display order.
  // Completed sink to the bottom. Computed unconditionally so React's hook
  // order stays stable across the loading/error early returns below.
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

  const invalidate = () => qc.invalidateQueries({ queryKey: ['teacher-career', id] });

  const pageStyle = { ...s.page, ...(isMobile ? sMobile.page : null) };
  if (isLoading) return <div style={pageStyle}><p style={{ padding: 40, color: C.mutedSoft }}>Loading…</p></div>;
  if (isError || !data) return <div style={pageStyle}><p style={{ padding: 40, color: C.danger }}>Failed to load.</p></div>;

  const { teacher, currentPosition, nextPosition, missions, missionPct } = data;
  // Defensive defaults — protect against a backend that hasn't been
  // restarted with the new ladder/blockers/requirements fields yet.
  const ladder = data.ladder ?? data.positions ?? [];
  const nextPositionRequirements = data.nextPositionRequirements ?? [];
  const readiness = data.readiness;
  const isFinalStage = readiness.isFinalStage ?? (!!currentPosition && !nextPosition);
  const isCurrentInLadder = readiness.isCurrentInLadder ?? true;
  const blockers = readiness.blockers ?? [];

  const completedCount = missions.filter(m => m.progress?.status === 'COMPLETED').length;
  const requiredCompleted = readiness.missions.completed;
  const requiredTotal = readiness.missions.total;
  const allRequiredComplete = readiness.missions.met;

  // Stage indicator — "Stage X of Y" framing for the hero. Only set when
  // the current position is on the ladder; otherwise the concept doesn't
  // apply (e.g. off-ladder roles like Staff).
  const ladderIdx = currentPosition && isCurrentInLadder
    ? ladder.findIndex(p => p.positionId === currentPosition.positionId)
    : -1;
  const stageNumber = ladderIdx >= 0 ? ladderIdx + 1 : null;
  const totalStages = ladder.length;

  // ── Top-level page-state branches ──────────────────────────────────────
  // 1. Final stage — separate hero
  // 2. Position not on ladder — distinct empty/info state
  // 3. No position assigned — distinct empty state
  // 4. Otherwise — normal hero + 2-column body

  return (
    <div style={pageStyle}>
      <style>{`
        .tcp-card { transition: box-shadow 160ms cubic-bezier(0.4,0,0.2,1), border-color 160ms cubic-bezier(0.4,0,0.2,1); }
        .tcp-card:hover { box-shadow: 0 1px 3px rgba(15,23,42,0.04), 0 6px 18px rgba(15,23,42,0.05); border-color: ${C.cardBorderHover}; }
        .tcp-back-btn:hover { background: #f1f5f9; color: #475569; border-color: #cbd5e1; }
        .tcp-cta { transition: transform 140ms ease, box-shadow 160ms ease, background-color 160ms ease; }
        .tcp-cta:hover { transform: translateY(-1px); box-shadow: 0 6px 14px rgba(90,103,216,0.25); }
        .tcp-link:hover { text-decoration: underline; text-underline-offset: 2px; }
        .tcp-gate { transition: border-color 160ms cubic-bezier(0.4,0,0.2,1), box-shadow 160ms cubic-bezier(0.4,0,0.2,1); }
        .tcp-gate:hover { border-color: ${C.cardBorderHover}; box-shadow: 0 1px 2px rgba(15,23,42,0.04); }
        .tcp-crumb-link:hover { color: ${C.text}; }
        @keyframes tcp-progress-in { from { width: 0; } }
        .tcp-progress-fill { animation: tcp-progress-in 700ms cubic-bezier(0.4, 0, 0.2, 1); }
      `}</style>
      <div style={s.inner}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <button
            onClick={() => navigate('/teachers')}
            style={s.backBtn}
            className="tcp-back-btn"
            aria-label="Back"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <Breadcrumb id={id!} teacherName={teacher.name} />
        </div>

        {/* === Hero (replaces with stage-specific variants) === */}
        {isFinalStage ? (
          <FinalStageHero teacherName={teacher.name} positionName={currentPosition!.name} color={teacher.color} />
        ) : !currentPosition ? (
          <NoPositionHero teacherName={teacher.name} color={teacher.color} />
        ) : !isCurrentInLadder ? (
          <OffLadderHero
            teacherName={teacher.name}
            positionName={currentPosition.name}
            color={teacher.color}
          />
        ) : allRequiredComplete && requiredTotal > 0 ? (
          <StageCompletionHero
            teacherName={teacher.name}
            positionName={currentPosition.name}
            nextPositionName={nextPosition?.name ?? null}
            color={teacher.color}
            readiness={readiness}
          />
        ) : (
          <CareerHero
            teacherId={id!}
            teacherName={teacher.name}
            currentPosition={currentPosition.name}
            currentLevel={teacher.level ?? null}
            currentMaxLevel={currentPosition.maxLevel ?? null}
            nextPosition={nextPosition?.name ?? null}
            missionPct={missionPct}
            requiredCompleted={requiredCompleted}
            requiredTotal={requiredTotal}
            blockers={blockers}
            color={teacher.color}
            readiness={readiness}
            missions={missions}
            stageNumber={stageNumber}
            totalStages={totalStages}
            currentBadgeUrl={currentPosition.badgeUrl ?? null}
          />
        )}

        {/* === Body — Current Targets on the left, Career Journey
            (vertical) on the right. Side-by-side so the user sees what
            to work on AND where they are in the ladder at the same time. */}
        <div style={{ ...s.bodyGrid, ...(isMobile ? sMobile.bodyGrid : null) }}>
          {(() => {
          // "Current Targets" = the missions the teacher has explicitly
          // pinned as their focus on the Mission Board. Independent of
          // progress status, so a target can be Not Started, In Progress,
          // or Awaiting Review. Stored client-side via localStorage —
          // see useMissionTargets.
          const activeMissions = sortedMissions.filter(m =>
            isTargeted(m.id) && m.progress?.status !== 'COMPLETED'
          );
          const allMissionsLink = (
            <Link
              to={`/teachers/${id}/career/missions`}
              style={{
                fontSize: 12, fontWeight: 600, color: C.primary,
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              View all missions →
            </Link>
          );
          return (
            <div style={{ ...s.card, ...(isMobile ? sMobile.card : null) }} className="tcp-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={s.cardTitle}>Current Targets</div>
                  {/* Subtitle hides when there are no active targets — the
                      empty state below already explains the situation. */}
                  {currentPosition && isCurrentInLadder && activeMissions.length > 0 && (
                    <div style={s.cardSub}>
                      {activeMissions.length} target{activeMissions.length === 1 ? '' : 's'} pinned for this cycle
                    </div>
                  )}
                  {!currentPosition && (
                    <div style={s.cardSub}>Assign a position to see missions</div>
                  )}
                  {currentPosition && !isCurrentInLadder && (
                    <div style={s.cardSub}>This position is not on the career path</div>
                  )}
                </div>
                {currentPosition && isCurrentInLadder && missions.length > 0 && allMissionsLink}
              </div>

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
                      Missions for this position aren't tracked toward a promotion.
                    </>
                  }
                />
              ) : missions.length === 0 ? (
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
              ) : activeMissions.length === 0 ? (
                <div style={{
                  padding: '48px 24px', textAlign: 'center',
                  background: '#fafbfc', border: `1px dashed ${C.cardBorder}`,
                  borderRadius: RADIUS, margin: '4px 0',
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    margin: '0 auto 16px', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: '#fff', border: `1px solid ${C.divider}`,
                    color: C.warning, fontSize: 22,
                  }}>
                    <FontAwesomeIcon icon={faLightbulb} />
                  </div>
                  <h4 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>
                    No targets pinned yet
                  </h4>
                  <p style={{
                    margin: '0 0 4px', fontSize: 10, fontWeight: 700,
                    color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    Recommended
                  </p>
                  <p style={{
                    margin: '0 auto 20px', maxWidth: 340,
                    fontSize: 13, color: C.muted, lineHeight: 1.6,
                  }}>
                    Pin 2–3 missions on the board to focus on this cycle.
                  </p>
                  <Link
                    to={`/teachers/${id}/career/missions`}
                    className="tcp-cta"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '10px 20px',
                      background: C.primary, color: '#fff', borderRadius: RADIUS_SM,
                      textDecoration: 'none', fontSize: 13, fontWeight: 600,
                      boxShadow: '0 1px 2px rgba(90,103,216,0.18)',
                    }}
                  >
                    Set Targets
                    <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 10 }} />
                  </Link>
                </div>
              ) : (
                <div style={{
                  display: 'grid', gap: 14,
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
                }}>
                  {activeMissions.map(m => (
                    <MissionCard
                      key={m.id}
                      mission={m}
                      onEdit={() => setEditingMission(m)}
                      isTargeted={isTargeted(m.id)}
                      onToggleTarget={() => toggleTarget(m.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })()}

          {/* Right — vertical Career Journey */}
          {ladder.length > 0 && (
            <CareerJourneyVertical
              ladder={ladder}
              currentPositionId={currentPosition?.positionId ?? null}
              currentLevel={teacher.level ?? null}
              nextPositionId={nextPosition?.positionId ?? null}
              nextPositionRequirements={nextPositionRequirements}
              isCurrentInLadder={isCurrentInLadder}
              missionsCompleted={readiness.missions.completed}
              missionsTotal={readiness.missions.total}
              missionPct={missionPct}
            />
          )}
        </div>
      </div>

      {editingMission && (
        <MissionDetailModal
          mission={editingMission}
          onClose={() => setEditingMission(null)}
          onSave={async (status, evidenceCount, evidenceTotal, notes) => {
            try {
              await upsertTeacherMissionProgress(id!, editingMission.id, {
                status, evidenceCount, evidenceTotal, notes,
              });
              showToast('Mission progress updated');
              invalidate();
              setEditingMission(null);
            } catch (e: any) {
              showToast(e?.message ?? 'Save failed', 'error');
            }
          }}
        />
      )}
    </div>
  );
}

// ── Breadcrumb ───────────────────────────────────────────────────────────────

function Breadcrumb({ id, teacherName }: { id: string; teacherName: string }) {
  return (
    <div style={{ ...s.breadcrumb, flexWrap: 'wrap', rowGap: 4, minWidth: 0 }}>
      <Link to="/teachers" style={s.crumbLink} className="tcp-crumb-link">Teachers</Link>
      <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
      <Link to={`/teachers/${id}`} style={s.crumbLink} className="tcp-crumb-link">{teacherName}</Link>
      <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
      <span style={s.crumbCurrent}>Career</span>
    </div>
  );
}

// ── Hero variants ────────────────────────────────────────────────────────────

// Compute the overall promotion status from the 3 gates. Used in hero +
// completion banner. Safety/SOP intentionally NOT in scoring per spec.
// Only two pill states make sense on this page — once "approved" the
// teacher is promoted and rendered against the *next* stage instead.
// So the pill is always either "In Progress" (still working toward
// the gates) or "Ready for Review" (all gates met, awaiting promotion).
type OverallStatus = 'NOT_READY' | 'READY_FOR_REVIEW';
function computeStatus(
  missionsMet: boolean,
  appraisalMet: boolean,
): OverallStatus {
  if (missionsMet && appraisalMet) return 'READY_FOR_REVIEW';
  return 'NOT_READY';
}
const STATUS_LABEL: Record<OverallStatus, { label: string; color: string; bg: string }> = {
  // Amber for in-progress momentum; green for "all gates met, ready
  // to be promoted" — the closest the teacher gets to a celebration
  // on this page (the actual promotion bumps them to the next stage).
  NOT_READY:        { label: 'In Progress',       color: C.warning, bg: C.warningSoft },
  READY_FOR_REVIEW: { label: 'Ready for Review',  color: C.success, bg: C.successSoft },
};

function CareerHero({
  teacherId,
  teacherName, currentPosition, currentLevel, currentMaxLevel,
  nextPosition, missionPct,
  requiredCompleted, requiredTotal, color, readiness, missions,
  stageNumber, totalStages, currentBadgeUrl,
}: {
  teacherId: string;
  teacherName: string;
  currentPosition: string;
  currentLevel: number | null;
  currentMaxLevel: number | null;
  nextPosition: string | null;
  missionPct: number;
  requiredCompleted: number;
  requiredTotal: number;
  blockers: string[];
  color: string;
  readiness: TeacherCareerData['readiness'];
  missions: MissionWithProgress[];
  stageNumber: number | null;
  totalStages: number;
  currentBadgeUrl: string | null;
}) {
  const { isMobile } = useIsMobile();
  const missionsMet = readiness.missions.met;
  const appraisalMet = readiness.appraisal.met;
  const status = computeStatus(missionsMet, appraisalMet);
  const statusMeta = STATUS_LABEL[status];

  // Promotion checklist gates — short labels + tight values so each row
  // fits on a single line in the side-by-side layout.
  const allRequiredComplete = readiness.missions.met;
  const requiredRemaining = Math.max(0, readiness.missions.total - readiness.missions.completed);
  const appraisalThreshold = readiness.appraisal.required;
  // Label = the target/rule. Value = the teacher's current status.
  // E.g. "Average appraisal > 75%" tells you the rule; "78%" tells you
  // where they stand. Cleaner than repeating the threshold on the right.
  const gates: Array<{ label: string; value: string; met: boolean; remainingLabel: string }> = [
    {
      label: 'Required missions',
      value: readiness.missions.total === 0 ? 'None' : `${missionPct}%`,
      met: allRequiredComplete && readiness.missions.total > 0,
      remainingLabel: readiness.missions.total === 0
        ? 'Configure required missions'
        : `Complete all required missions (${requiredRemaining} remaining)`,
    },
    {
      label: `Average appraisal > ${appraisalThreshold}%`,
      value: readiness.appraisal.value != null
        ? `${readiness.appraisal.value}%`
        : 'Not Evaluated',
      met: readiness.appraisal.met,
      remainingLabel: `Reach average appraisal of ${appraisalThreshold}%`,
    },
    {
      label: 'Supervisor approval',
      value: readiness.supervisorApproval.approved ? 'Approved' : 'Pending',
      met: readiness.supervisorApproval.approved,
      remainingLabel: 'Supervisor approval',
    },
  ];
  const allMet = gates.every(g => g.met);
  const remainingGates = gates.filter(g => !g.met);

  const badgeSize = isMobile ? 64 : 120;

  return (
    <div style={{ ...s.hero, ...(isMobile ? sMobile.hero : null) }}>
      {/* Top row: badge on the left, identity stack on the right. The
          status pill sits on the eyebrow line — frees the title to use
          the full row width instead of being squeezed by the pill. */}
      <div style={{
        display: 'flex', alignItems: 'center',
        gap: isMobile ? 12 : 18, minWidth: 0,
        marginBottom: isMobile ? 16 : 22,
      }}>
        {currentBadgeUrl ? (
          <img
            src={uploadUrl(currentBadgeUrl)}
            alt={currentPosition}
            style={{
              width: badgeSize, height: badgeSize, objectFit: 'contain', flexShrink: 0,
              filter: 'drop-shadow(0 6px 14px rgba(15,23,42,0.18))',
            }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <Avatar name={teacherName} color={color} />
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 8, marginBottom: 4,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>
              Career Path
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: isMobile ? '3px 8px' : '4px 10px', borderRadius: 999, flexShrink: 0,
              background: statusMeta.bg, border: `1px solid ${statusMeta.color}33`,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: 999, background: statusMeta.color,
              }} />
              <span style={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: statusMeta.color }}>
                {statusMeta.label}
              </span>
            </div>
          </div>
          <div style={{
            fontSize: isMobile ? 20 : 28, fontWeight: 700, color: C.text,
            letterSpacing: '-0.025em', lineHeight: 1.15,
          }}>
            {teacherName}&apos;s Journey
          </div>
          <div style={{
            marginTop: 8, fontSize: 13, fontWeight: 500,
            display: 'flex', alignItems: 'center', flexWrap: 'wrap',
            lineHeight: 1.3, color: C.muted,
          }}>
            <span style={{ color: C.primary, fontWeight: 700 }}>{currentPosition}</span>
            {currentLevel != null && currentMaxLevel != null && currentMaxLevel > 0 && (
              <span style={{
                marginLeft: 8,
                display: 'inline-flex', alignItems: 'center',
                padding: '2px 8px', borderRadius: 999,
                background: C.primarySoft, color: C.primary,
                border: `1px solid ${C.primaryBorder}`,
                fontSize: 11, fontWeight: 700,
                fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em',
              }}>
                Lv {currentLevel}
              </span>
            )}
            {nextPosition && (
              <>
                <span style={{ margin: '0 8px', color: C.divider }}>•</span>
                <span style={{ color: C.muted }}>Next:&nbsp;</span>
                <span style={{ color: C.text, fontWeight: 600 }}>{nextPosition}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Combined section: progress on the left, requirements list on
          the right. Saves vertical space and lets the eye compare
          "where I am" against "what's left" at one glance. */}
      <div style={s.heroSection}>
        <div style={{ ...s.heroBody, ...(isMobile ? sMobile.heroBody : null) }}>
          {/* Left — mission progress */}
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {/* Header — label on the left, big percentage on the right.
                Percentage is the focal number so the teacher reads "where
                am I" before the details. */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
              <span style={s.heroLabel}>Required Missions</span>
              <span style={{
                fontSize: 22, fontWeight: 700,
                color: missionPct === 100 ? C.success : C.primary,
                letterSpacing: '-0.02em', lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {missionPct}%
              </span>
            </div>

            {/* Segmented progress — one cell per required mission so the
                teacher sees discrete progress ("3 of 6 done") rather than
                an abstract bar. Falls back to a single bar when there
                are too many cells to read individually. */}
            {requiredTotal > 0 && requiredTotal <= 12 ? (
              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: requiredTotal }).map((_, i) => {
                  const filled = i < requiredCompleted;
                  return (
                    <div key={i} style={{
                      flex: 1, height: 10, borderRadius: 4,
                      background: filled ? (missionPct === 100 ? C.success : C.primary) : C.divider,
                      boxShadow: filled ? `inset 0 1px 0 rgba(255,255,255,0.25)` : 'none',
                      transition: 'background 400ms ease',
                    }} />
                  );
                })}
              </div>
            ) : (
              <div style={{ ...s.progressTrack, height: 10 }}>
                <div
                  className="tcp-progress-fill"
                  style={{
                    ...s.progressFill,
                    width: `${missionPct}%`,
                    background: missionPct === 100 ? C.success : C.primary,
                  }}
                />
              </div>
            )}

            {/* Footer row — completion count on the left, CTA on the right.
                Pushed to the bottom of the column so the row aligns with
                the bottom of the requirements list when both columns are
                next to each other. */}
            <div style={{
              marginTop: 14, display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.muted, lineHeight: 1.4 }}>
                {requiredTotal > 0 && requiredRemaining > 0 && (
                  <>
                    <span style={{ color: C.text, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {requiredCompleted} of {requiredTotal}
                    </span>
                    <span style={{ margin: '0 6px', color: C.divider }}>•</span>
                    <span style={{ color: requiredRemaining <= 2 ? C.success : C.muted, fontWeight: 600 }}>
                      {requiredRemaining} to go
                    </span>
                  </>
                )}
                {requiredTotal > 0 && requiredRemaining === 0 && (
                  <span style={{ color: C.success, fontWeight: 700 }}>
                    <FontAwesomeIcon icon={faCircleCheck} style={{ marginRight: 6, fontSize: 12 }} />
                    All required missions complete
                  </span>
                )}
              </div>
              {requiredTotal > 0 && (
                <Link
                  to={`/teachers/${teacherId}/career/missions`}
                  className="tcp-link"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 12, fontWeight: 600, color: C.primary,
                    textDecoration: 'none',
                  }}
                >
                  Open Mission Board
                  <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9 }} />
                </Link>
              )}
            </div>
          </div>

          {/* Right — promotion requirements as a compact list */}
          <div style={{ ...s.heroChecklistCol, ...(isMobile ? sMobile.heroChecklistCol : null) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <span style={s.heroLabel}>Promotion Requirements</span>
              <span style={{
                fontSize: 12, fontWeight: 700, color: C.muted,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {gates.filter(g => g.met).length} <span style={{ color: C.mutedSoft, fontWeight: 500 }}>of {gates.length} met</span>
              </span>
            </div>
            <div style={s.checklistList}>
              {gates.map((g, i) => (
                <ChecklistRow key={g.label} item={g} isFirst={i === 0} />
              ))}
            </div>
            {allMet && (
              <p style={{ margin: `${SP.md}px 0 0`, fontSize: 11, color: C.mutedSoft, lineHeight: 1.5 }}>
                All requirements met. Awaiting admin to record the promotion.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Section 3 — Achievements (full-width) */}
      <div style={s.heroSection}>
        <AchievementStrip missions={missions} />
      </div>
    </div>
  );
}

// "Stage Rewards" — capability identities the teacher unlocks as they
// complete missions in each category. Lives in the hero so the rewards
// for clearing this stage are visible alongside the rules.
function AchievementStrip({ missions }: { missions: MissionWithProgress[] }) {
  const { isMobile } = useIsMobile();
  const { categories, getMeta } = useCategoryMeta();
  const byCategory = new Map<MissionCategory, { total: number; completed: number }>();
  for (const m of missions) {
    const slot = byCategory.get(m.category) ?? { total: 0, completed: 0 };
    slot.total++;
    if (m.progress?.status === 'COMPLETED') slot.completed++;
    byCategory.set(m.category, slot);
  }
  // Walk admin-managed categories in their saved sortOrder; only include
  // ones that actually have missions configured.
  const cats = categories
    .filter(c => byCategory.has(c.code))
    .map(c => ({ category: c.code, ...byCategory.get(c.code)! }))
    // Sort so the most-progressed badges sit on the left:
    //   1. Mastered (all complete)
    //   2. Partially earned, ordered by progress %
    //   3. Locked (no completions)
    // Stable on category order within each tier.
    .sort((a, b) => {
      const tier = (x: typeof a) => {
        if (x.total > 0 && x.completed === x.total) return 0; // mastered
        if (x.completed > 0) return 1;                         // earned
        return 2;                                              // locked
      };
      const ta = tier(a), tb = tier(b);
      if (ta !== tb) return ta - tb;
      // Within "earned" tier, more progress wins.
      if (ta === 1) {
        const pctA = a.completed / a.total;
        const pctB = b.completed / b.total;
        if (pctA !== pctB) return pctB - pctA;
      }
      return 0;
    });

  if (cats.length === 0) return null;

  return (
    <div>
      <div style={{ ...s.heroLabel, marginBottom: SP.md }}>Achievements</div>

      <div style={{
        display: 'flex',
        gap: isMobile ? SP.sm : SP.lg,
        flexWrap: 'wrap',
        justifyContent: isMobile ? 'center' : 'flex-start',
      }}>
        {cats.map(({ category, total, completed }) => {
          const meta = getMeta(category);
          const identity = meta.achievementName;
          const description = meta.description ?? '';
          const earned = completed > 0;
          const mastered = total > 0 && completed === total;
          const remaining = total - completed;
          // Inline label below the badge — visible action, not just hover.
          const subLabel = mastered
            ? 'Unlocked'
            : earned
              ? `${remaining} to master`
              : `Complete ${total} to unlock`;
          // Tooltip carries the longer description + the explicit action.
          const tip = mastered
            ? `${identity} — ${description}`
            : earned
              ? `${description} · Complete ${remaining} more ${meta.label.toLowerCase()} mission${remaining === 1 ? '' : 's'} to master.`
              : `${description} · Complete ${total} ${meta.label.toLowerCase()} mission${total === 1 ? '' : 's'} to unlock.`;

          // Progress ring percentage drives the conic gradient that
          // wraps the medallion. Replaces the floating "1/2" chip with
          // a calmer, integrated visual.
          const pct = total > 0 ? completed / total : 0;
          const ringDeg = Math.max(0.001, pct * 360);
          const ringFill = mastered
            ? meta.color
            : earned
              ? `conic-gradient(${meta.color} 0deg ${ringDeg}deg, ${C.cardBorder} ${ringDeg}deg 360deg)`
              : C.cardBorder;

          return (
            <div key={category} title={tip} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              minWidth: isMobile ? 88 : 116, maxWidth: isMobile ? 110 : 140,
              opacity: earned ? 1 : 0.72,
              transition: TRANSITION,
            }}>
              {/* Outer ring (conic gradient) wraps the medallion. Mastered
                  = full color ring; earned = partial fill arc; locked = gray. */}
              <div style={{
                position: 'relative',
                width: isMobile ? 52 : 64, height: isMobile ? 52 : 64, borderRadius: '50%',
                background: ringFill,
                padding: 3, boxSizing: 'border-box',
                marginBottom: SP.md,
                boxShadow: mastered
                  ? `0 4px 14px ${meta.color}30`
                  : earned ? `0 2px 8px ${meta.color}1f` : 'none',
              }}>
                {/* Inner medallion face — must be OPAQUE so the conic
                    progress ring outside doesn't bleed through. We mix
                    the category colour with white to get a soft opaque
                    tint for the earned state. */}
                <div style={{
                  width: '100%', height: '100%', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: mastered
                    ? `radial-gradient(circle at 30% 28%, color-mix(in srgb, ${meta.color} 18%, #fff) 0%, color-mix(in srgb, ${meta.color} 10%, #fff) 100%)`
                    : earned ? `color-mix(in srgb, ${meta.color} 12%, #fff)` : '#fff',
                  color: earned ? meta.color : C.mutedSoft,
                  fontSize: isMobile ? 16 : 20,
                  boxShadow: mastered ? 'inset 0 1px 0 rgba(255,255,255,0.6)' : 'none',
                }}>
                  <FontAwesomeIcon icon={meta.icon} />
                </div>
                {mastered && (
                  <div style={{
                    position: 'absolute', top: -3, right: -3,
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                    color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    border: '2px solid #fff',
                    boxShadow: '0 2px 4px rgba(245,158,11,0.35)',
                  }}>★</div>
                )}
              </div>
              {/* Fixed-height title area so a 2-line identity (like
                  "Parent Communication Ready") doesn't push siblings up. */}
              <div style={{
                fontSize: 12, fontWeight: 700, textAlign: 'center', lineHeight: 1.35,
                color: earned ? C.text : C.muted,
                letterSpacing: '-0.005em',
                minHeight: 32,
                display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
              }}>
                {identity}
              </div>
              {/* Single uniform sub-label — same weight + case everywhere. */}
              <div style={{
                marginTop: 4,
                fontSize: 11, fontWeight: 500, textAlign: 'center', lineHeight: 1.3,
                color: mastered ? meta.color : C.mutedSoft,
                fontVariantNumeric: 'tabular-nums',
                minHeight: 14,
              }}>
                {subLabel}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StageCompletionHero({ teacherName, positionName, nextPositionName, color, readiness }: {
  teacherName: string; positionName: string; nextPositionName: string | null; color: string;
  readiness: TeacherCareerData['readiness'];
}) {
  const { isMobile } = useIsMobile();
  // Stage-aware completion message — match the spec's exact phrasing
  // so each downstream state has a clear "what's next".
  const appraisalMet = readiness.appraisal.met;
  const approvalApproved = readiness.supervisorApproval.approved;
  const allDone = appraisalMet && approvalApproved;
  const threshold = readiness.appraisal.required;
  const message = allDone
    ? 'Ready for promotion approval.'
    : !appraisalMet
      ? `All required missions completed. Next: pass average appraisal above ${threshold}%.`
      : 'Promotion requirements completed. Waiting for supervisor approval.';

  return (
    <div style={{ ...s.hero, ...(isMobile ? sMobile.hero : null), background: `linear-gradient(135deg, #fff 0%, ${C.successSoft} 100%)` }}>
      <div style={s.heroLeft}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <Avatar name={teacherName} color={color} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.success, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {allDone ? 'Ready for Approval' : 'Stage Missions Completed'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text, marginTop: 4, letterSpacing: '-0.01em' }}>
              {positionName}{nextPositionName && <span style={{ color: C.mutedSoft, fontWeight: 500 }}> → {nextPositionName}</span>}
            </div>
          </div>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: C.textSub, lineHeight: 1.5 }}>
          {message}
        </p>
      </div>
      <div style={{ ...s.heroRight, borderLeftColor: C.successSoft }}>
        <div style={{ fontSize: 36, color: C.success, marginBottom: 6 }}>
          <FontAwesomeIcon icon={faCircleCheck} />
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.success, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {allDone ? 'Approved' : 'Awaiting Review'}
        </div>
      </div>
    </div>
  );
}

function FinalStageHero({ teacherName, positionName, color }: { teacherName: string; positionName: string; color: string }) {
  const { isMobile } = useIsMobile();
  return (
    <div style={{ ...s.hero, ...(isMobile ? sMobile.hero : null), background: `linear-gradient(135deg, #fff 0%, ${C.warningSoft} 100%)` }}>
      <div style={s.heroLeft}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
          <Avatar name={teacherName} color={color} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.warning, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Highest Stage Reached
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text, marginTop: 4 }}>
              {positionName}
            </div>
          </div>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: C.textSub }}>
          You have reached the top of the career ladder.
        </p>
      </div>
      <div style={{ ...s.heroRight, borderLeftColor: C.warningSoft }}>
        <FontAwesomeIcon icon={faMedal} style={{ fontSize: 36, color: C.warning }} />
      </div>
    </div>
  );
}

function NoPositionHero({ teacherName, color }: { teacherName: string; color: string }) {
  const { isMobile } = useIsMobile();
  return (
    <div style={{ ...s.hero, ...(isMobile ? sMobile.hero : null), background: '#fff' }}>
      <div style={s.heroLeft}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
          <Avatar name={teacherName} color={color} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              No Position Assigned
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginTop: 4 }}>Set a position to begin</div>
          </div>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: C.textSub }}>
          Assign {teacherName} a position from the teacher's profile to start tracking career progression.
        </p>
      </div>
    </div>
  );
}

function OffLadderHero({ teacherName, positionName, color }: { teacherName: string; positionName: string; color: string }) {
  const { isMobile } = useIsMobile();
  return (
    <div style={{ ...s.hero, ...(isMobile ? sMobile.hero : null), background: '#fff' }}>
      <div style={s.heroLeft}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
          <Avatar name={teacherName} color={color} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Off-Ladder Position
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginTop: 4 }}>{positionName}</div>
          </div>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: C.textSub }}>
          {positionName} is not part of the career progression ladder, so promotions and missions aren't tracked here. Add it to the ladder in <Link to="/settings/employee-salary" style={{ color: C.primary, fontWeight: 600 }}>Position settings</Link>.
        </p>
      </div>
    </div>
  );
}

function Avatar({ name, color }: { name: string; color: string }) {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  return <div style={{ ...s.avatar, background: color }}>{initials}</div>;
}

// ── Vertical Career Journey ──────────────────────────────────────────────────
// Sidebar variant of the journey — stacks stages top-to-bottom with a
// vertical rail. Sits beside Current Targets on the page so the teacher
// sees "what to do" and "where they are" together.

type StageState = 'completed' | 'current' | 'next' | 'locked';

interface StageStyleSet {
  dotBg: string;
  dotBorder: string;
  dotIcon: 'check' | 'flag' | null;
  dotIconColor: string;
  dotShadow: string;
  badgeOpacity: number;
  badgeFilter: string;
  nameColor: string;
  nameWeight: number;
  nameSize: number;
  stageNumColor: string;
  chip: { label: string; bg: string; color: string; border: string } | null;
}

// State → all visual props in one place. Kept as a function (not a const map)
// so it stays inside the JS bundle's tree-shaking and reads naturally.
//
// Premium SaaS palette: rank names use dark slate (C.text) so the page feels
// calm and structured. The blue/purple accent is carried by the dot, the
// halo, and the chip — *not* by the title typography. Locked badges fade
// noticeably so future stages don't compete with the current one.
function getStageStyle(state: StageState): StageStyleSet {
  switch (state) {
    case 'completed':
      return {
        dotBg: C.success, dotBorder: C.success,
        dotIcon: 'check', dotIconColor: '#fff',
        dotShadow: 'none',
        badgeOpacity: 1,
        badgeFilter: 'drop-shadow(0 1px 2px rgba(15,23,42,0.06))',
        nameColor: C.text, nameWeight: 600, nameSize: 14,
        stageNumColor: C.success,
        chip: null,
      };
    case 'current':
      return {
        dotBg: C.primary, dotBorder: C.primary,
        dotIcon: null, dotIconColor: '#fff',
        dotShadow: `0 2px 6px ${C.primary}33`,
        badgeOpacity: 1,
        badgeFilter: 'drop-shadow(0 2px 6px rgba(15,23,42,0.10))',
        nameColor: C.text, nameWeight: 700, nameSize: 15,
        stageNumColor: C.primary,
        chip: { label: 'Current', bg: C.primary, color: '#fff', border: C.primary },
      };
    case 'next':
      return {
        dotBg: '#fff', dotBorder: C.primary,
        dotIcon: 'flag', dotIconColor: C.primary,
        dotShadow: `0 1px 3px ${C.primary}1f`,
        badgeOpacity: 0.92,
        badgeFilter: 'drop-shadow(0 1px 2px rgba(15,23,42,0.06))',
        nameColor: C.text, nameWeight: 600, nameSize: 14,
        stageNumColor: C.muted,
        chip: { label: 'Next', bg: '#fff', color: C.primary, border: C.primaryBorder },
      };
    case 'locked':
      return {
        dotBg: '#fff', dotBorder: '#e2e8f0',
        dotIcon: null, dotIconColor: C.mutedSoft,
        dotShadow: 'none',
        badgeOpacity: 0.55,
        badgeFilter: 'grayscale(0.55) drop-shadow(0 1px 2px rgba(15,23,42,0.04))',
        nameColor: C.mutedSoft, nameWeight: 600, nameSize: 14,
        stageNumColor: C.mutedSoft,
        chip: null,
      };
  }
}

function CareerJourneyVertical({
  ladder, currentPositionId, currentLevel, nextPositionId, isCurrentInLadder,
  missionsCompleted, missionsTotal, missionPct,
}: {
  ladder: { positionId: string; name: string; titleWeight: number; maxLevel?: number; badgeUrl?: string | null }[];
  currentPositionId: string | null;
  currentLevel: number | null;
  nextPositionId: string | null;
  nextPositionRequirements: string[];
  isCurrentInLadder: boolean;
  missionsCompleted: number;
  missionsTotal: number;
  missionPct: number;
}) {
  const { isMobile } = useIsMobile();
  if (ladder.length === 0) return null;
  const currentIdx = isCurrentInLadder ? ladder.findIndex(p => p.positionId === currentPositionId) : -1;

  const ROW_HEIGHT = isMobile ? 88 : 120;
  const DOT_SIZE = isMobile ? 24 : 28;
  const BADGE_SLOT = isMobile ? 40 : 56;

  // Pixel-based rail math. Each row is ROW_HEIGHT tall and the dot sits at
  // the row's vertical centre, so the rail spans from the first dot centre
  // (y = ROW_HEIGHT/2) down to the last dot centre.
  const railLength = Math.max(0, (ladder.length - 1) * ROW_HEIGHT);

  const currentStage = currentIdx >= 0 ? ladder[currentIdx] : null;
  const nextStage = nextPositionId ? ladder.find(p => p.positionId === nextPositionId) ?? null : null;

  // State per row, derived once and reused for both the dot/badge/text.
  const stateFor = (i: number, p: typeof ladder[number]): StageState => {
    if (currentIdx >= 0 && i < currentIdx) return 'completed';
    if (currentIdx >= 0 && i === currentIdx) return 'current';
    if (p.positionId === nextPositionId) return 'next';
    return 'locked';
  };

  // Fixed grid — guarantees every row's dot, badge, text, and pill
  // sit on the exact same vertical axes regardless of content length.
  const ROW_GRID = `${DOT_SIZE}px ${BADGE_SLOT}px minmax(0, 1fr) auto`;

  return (
    <div style={{ ...s.card, ...(isMobile ? sMobile.card : null) }} className="tcp-card">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      {/* Three-tier composition:
          1. Eyebrow — names the surface
          2. Current rank (large) — the headline answer to "where am I?"
          3. Stage / Level subtext + a dedicated Next Target callout
          We deliberately don't show an overall % — promotion is slow and
          discrete, the timeline below tells that story. */}
      <div style={{ marginBottom: SP.lg }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: C.muted,
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          Career Journey
        </div>
        <div style={{
          marginTop: 4,
          fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.text,
          letterSpacing: '-0.025em', lineHeight: 1.15,
        }}>
          {currentStage ? currentStage.name : `${ladder.length} stage${ladder.length === 1 ? '' : 's'}`}
        </div>
        {currentIdx >= 0 ? (
          <div style={{
            marginTop: 6, fontSize: 12, fontWeight: 500, color: C.muted,
            fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.005em',
            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6,
          }}>
            <span>
              Stage <span style={{ color: C.text, fontWeight: 700 }}>{currentIdx + 1}</span> of {ladder.length}
            </span>
            {currentStage?.maxLevel != null && currentStage.maxLevel > 0 && currentLevel != null && (
              <>
                <span style={{ color: C.divider }}>·</span>
                <span>
                  Level <span style={{ color: C.text, fontWeight: 700 }}>{currentLevel}</span>
                </span>
              </>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 6, fontSize: 12, fontWeight: 500, color: C.muted }}>
            {ladder.length} stage{ladder.length === 1 ? '' : 's'}
          </div>
        )}
      </div>

      {/* ── Timeline ───────────────────────────────────────────────────── */}
      <div style={{ position: 'relative' }}>
        {/* Current-stage card — softly framed background with a blue
            left accent and gentle glow so the active rank reads as the
            single strongest focus on the page (without shouting). Stops
            short of the timeline column so the rail/node stay clean. */}
        {currentIdx >= 0 && (
          <div style={{
            position: 'absolute',
            top: currentIdx * ROW_HEIGHT + 4,
            left: DOT_SIZE + 12,
            right: 0,
            height: ROW_HEIGHT - 8,
            background: `linear-gradient(135deg, ${C.primary}0c, ${C.primary}04)`,
            border: `1px solid ${C.primary}26`,
            borderRadius: 14,
            boxShadow: `0 1px 2px ${C.primary}0d, 0 2px 8px ${C.primary}08`,
            zIndex: 0,
            pointerEvents: 'none',
          }} />
        )}

        {/* Track rail — centred behind the dots in the timeline column. */}
        <div style={{
          position: 'absolute',
          left: DOT_SIZE / 2 - 1,
          top: ROW_HEIGHT / 2,
          width: 2, height: railLength,
          background: C.divider, borderRadius: 999,
          zIndex: 1,
        }} />
        {/* Completed rail — green, covers the segments leading up to the
            current stage (these are stages the teacher has already
            graduated from). */}
        {currentIdx > 0 && (
          <div style={{
            position: 'absolute',
            left: DOT_SIZE / 2 - 1,
            top: ROW_HEIGHT / 2,
            width: 2, height: currentIdx * ROW_HEIGHT,
            background: C.success, borderRadius: 999,
            zIndex: 1,
          }} />
        )}
        {/* Current rail — blue, only as long as the chain of reached
            (blue) beads. Beyond the last reached bead the rail stays
            grey, so the line is only blue where it touches a coloured
            small dot. */}
        {(() => {
          if (!(currentIdx >= 0 && currentIdx < ladder.length - 1)) return null;
          const stage = ladder[currentIdx];
          const maxLv = stage.maxLevel ?? 0;
          const reachedLv = currentLevel ?? 0;
          if (maxLv <= 0 || reachedLv <= 0) return null;
          const BIG_R = DOT_SIZE / 2;
          const SMALL_R = 5;
          const railSpan = ROW_HEIGHT - 2 * BIG_R;
          const beadsHeight = 2 * SMALL_R * maxLv;
          const edgeGap = (railSpan - beadsHeight) / (maxLv + 1);
          const reachedClamped = Math.min(reachedLv, maxLv);
          // Extend through every reached bead AND the rail bit just
          // below it, stopping at the *top* edge of the first grey
          // bead. When all levels are reached this lands on the next
          // big dot's top edge — both cases use the same formula.
          const blueHeight = BIG_R + edgeGap
            + reachedClamped * (2 * SMALL_R + edgeGap);
          return (
            <div style={{
              position: 'absolute',
              left: DOT_SIZE / 2 - 1,
              top: currentIdx * ROW_HEIGHT + ROW_HEIGHT / 2,
              width: 2, height: blueHeight,
              background: C.primary, borderRadius: 999,
              zIndex: 1,
            }} />
          );
        })()}

        {/* Level dots — small beads on the rail between consecutive stage
            dots, one per level of the upper position. Reached levels are
            filled (green for past stages, blue for active stage);
            unreached beads are flat grey, no outline. */}
        {ladder.slice(0, ladder.length - 1).flatMap((stage, i) => {
          const maxLv = stage.maxLevel ?? 0;
          if (maxLv <= 0) return [];
          const isCurrentSegment = i === currentIdx;
          const filledLv = currentIdx >= 0 && i < currentIdx
            ? maxLv
            : (isCurrentSegment && currentLevel != null ? currentLevel : 0);

          // Equal *edge-to-edge* gaps so the visible whitespace between
          // big↔small, small↔small, and small↔next-big all looks identical.
          const SMALL_R = 5; // 10px small dot
          const BIG_R = DOT_SIZE / 2;
          const railSpan = ROW_HEIGHT - 2 * BIG_R;
          const beadsHeight = 2 * SMALL_R * maxLv;
          const edgeGap = (railSpan - beadsHeight) / (maxLv + 1);
          const topBigDotEdge = i * ROW_HEIGHT + ROW_HEIGHT / 2 + BIG_R;

          const isCompletedSegment = currentIdx >= 0 && i < currentIdx;

          // Future-segment beads recede — lighter fill so they don't
          // compete with the active path or the completed chain.
          const isFutureSegment = !isCurrentSegment && !isCompletedSegment;

          return Array.from({ length: maxLv }).map((_, k) => {
            const y = topBigDotEdge + edgeGap + SMALL_R + k * (2 * SMALL_R + edgeGap);
            const reached = k < filledLv;
            let bg: string;
            let halo = 'none';
            if (reached) {
              const color = isCompletedSegment ? C.success : C.primary;
              bg = color;
              halo = `0 0 0 2px ${color}33`;
            } else {
              bg = isFutureSegment ? '#e2e8f0' : '#cbd5e1';
            }
            return (
              <span
                key={`lv-${i}-${k}`}
                style={{
                  position: 'absolute',
                  top: y - SMALL_R, left: DOT_SIZE / 2 - SMALL_R,
                  width: SMALL_R * 2, height: SMALL_R * 2, borderRadius: 999,
                  background: bg,
                  border: 'none',
                  boxSizing: 'border-box',
                  boxShadow: halo,
                  zIndex: 2,
                  transition: 'background 200ms ease, box-shadow 200ms ease',
                }}
              />
            );
          });
        })}

        {ladder.map((p, i) => {
          const state = stateFor(i, p);
          const style = getStageStyle(state);
          const isCurrent = state === 'current';

          return (
            <div key={p.positionId} style={{
              display: 'grid',
              gridTemplateColumns: ROW_GRID,
              alignItems: 'center',
              gap: isMobile ? SP.sm : (isCurrent ? SP.xl : SP.md),
              minHeight: ROW_HEIGHT, position: 'relative',
              transition: TRANSITION,
            }}>
              {/* Column 1 — Timeline node. Centred in its track via the
                  fixed grid column, so every dot sits on the same x axis. */}
              <div style={{
                position: 'relative',
                width: DOT_SIZE, height: DOT_SIZE, borderRadius: 999,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: style.dotBg,
                border: `2px solid ${style.dotBorder}`,
                color: style.dotIconColor,
                zIndex: 2, transition: TRANSITION,
                boxSizing: 'border-box',
                boxShadow: style.dotShadow,
              }}>
                {style.dotIcon === 'check' && (
                  <FontAwesomeIcon icon={faCheck} style={{ fontSize: 11, fontWeight: 900 }} />
                )}
                {style.dotIcon === 'flag' && (
                  <FontAwesomeIcon icon={faFlag} style={{ fontSize: 11 }} />
                )}
                {/* Soft halo on current — paints on white outside the
                    row band, so it never collides with the band's fill. */}
                {state === 'current' && (
                  <span style={{
                    position: 'absolute', inset: -4,
                    borderRadius: '50%',
                    border: `2px solid ${C.primary}26`,
                    pointerEvents: 'none',
                  }} />
                )}
              </div>

              {/* Column 2 — Badge slot, fixed 56px so every row aligns.
                  Sits between the timeline node and the current card —
                  so it's literally "right beside" the big blue dot. */}
              <div style={{
                width: BADGE_SLOT, height: BADGE_SLOT,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', zIndex: 2,
              }}>
                {p.badgeUrl && (
                  <img
                    src={uploadUrl(p.badgeUrl)}
                    alt=""
                    style={{
                      maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
                      filter: style.badgeFilter,
                      opacity: style.badgeOpacity,
                      transition: TRANSITION,
                    }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
              </div>

              {/* Column 3 — Text block. For non-current rows: name +
                  stage label. For the current row: name + level + a
                  small mission progress bar so the active rank carries
                  the most information density. */}
              <div style={{
                minWidth: 0, position: 'relative', zIndex: 1,
              }}>
                {/* Title row — for the current stage we put "Level N"
                    on the same baseline as the rank name so the eye
                    catches the level without dropping a line. */}
                <div style={{
                  display: 'flex', alignItems: 'baseline', gap: 10,
                  minWidth: 0,
                }}>
                  <span style={{
                    fontSize: state === 'current' ? 16 : style.nameSize,
                    fontWeight: state === 'current' ? 800 : style.nameWeight,
                    color: style.nameColor,
                    letterSpacing: '-0.018em',
                    lineHeight: 1.2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}>
                    {p.name}
                  </span>
                  {state === 'current' && p.maxLevel != null && p.maxLevel > 0 && currentLevel != null && (
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: C.primary,
                      fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.005em',
                      flexShrink: 0,
                    }}>
                      Level {currentLevel}
                    </span>
                  )}
                </div>
                {state !== 'current' && (
                  <div style={{
                    marginTop: 3,
                    fontSize: 9, fontWeight: 700,
                    color: style.stageNumColor,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    Stage {i + 1}
                  </div>
                )}
                {state === 'current' && p.maxLevel != null && p.maxLevel > 0 && currentLevel != null && (
                  <div style={{
                    marginTop: 10,
                    display: 'flex', gap: 4,
                  }}>
                    {Array.from({ length: p.maxLevel }).map((_, i) => {
                      const filled = i < currentLevel;
                      const atMax = currentLevel >= p.maxLevel;
                      return (
                        <div key={i} style={{
                          flex: 1, height: 8, borderRadius: 999,
                          background: filled ? (atMax ? C.success : C.primary) : C.divider,
                          transition: 'background 300ms ease',
                        }} />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Column 4 — Status pill. Current = solid primary fill
                  (strongest), Next Target = soft primary outline (visible
                  but subordinate to current). Empty for other rows. */}
              <div style={{
                position: 'relative', zIndex: 1,
                marginRight: state === 'current' ? 12 : 0,
              }}>
                {state === 'current' && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '0 10px', height: 20,
                    fontSize: 9, fontWeight: 800,
                    background: C.primary, color: '#fff',
                    border: `1px solid ${C.primary}`,
                    borderRadius: 999,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    whiteSpace: 'nowrap',
                    boxShadow: `0 1px 2px ${C.primary}26`,
                  }}>Current</span>
                )}
                {state === 'next' && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '0 10px', height: 20,
                    fontSize: 9, fontWeight: 700,
                    background: C.primarySoft, color: C.primary,
                    border: `1px solid ${C.primaryBorder}`,
                    borderRadius: 999,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    whiteSpace: 'nowrap',
                  }}>Next Target</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Journey Map (horizontal — kept for legacy use, no longer rendered) ───────

function CareerJourneyMap({
  ladder, currentPositionId, nextPositionId, nextPositionRequirements, isCurrentInLadder, missionPct,
}: {
  ladder: { positionId: string; name: string; titleWeight: number }[];
  currentPositionId: string | null;
  nextPositionId: string | null;
  nextPositionRequirements: string[];
  isCurrentInLadder: boolean;
  missionPct: number;
}) {
  const [showRequirements, setShowRequirements] = useState(false);

  if (ladder.length === 0) return null;

  const currentIdx = isCurrentInLadder ? ladder.findIndex(p => p.positionId === currentPositionId) : -1;
  const nextPosition = ladder.find(p => p.positionId === nextPositionId);

  // Filled-line width: full segments for completed rungs PLUS a partial
  // segment from the current rung toward the next one, sized by mission
  // progress. So 40% mission progress on Junior EI extends the line 40%
  // of the way toward Senior EI.
  const segmentCount = Math.max(1, ladder.length - 1);
  const baseFill = currentIdx >= 0 ? currentIdx / segmentCount : 0;
  const partialFill = currentIdx >= 0 && currentIdx < ladder.length - 1
    ? (missionPct / 100) * (1 / segmentCount)
    : 0;
  const filledLineWidth = `${(baseFill + partialFill) * 100}%`;

  return (
    <div style={s.card} className="tcp-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12 }}>
        <div>
          <div style={s.cardTitle}>Career Journey</div>
          <div style={s.cardSub}>{ladder.length} stage{ladder.length === 1 ? '' : 's'} · sorted by title weight</div>
        </div>
        {nextPosition && nextPositionRequirements.length > 0 && (
          <button
            type="button"
            onClick={() => setShowRequirements(v => !v)}
            style={{
              padding: '6px 12px', borderRadius: 8,
              border: `1px solid ${C.primaryBorder}`,
              background: showRequirements ? C.primarySoft : '#fff',
              color: C.primary, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <FontAwesomeIcon icon={faFlag} style={{ fontSize: 11 }} />
            {showRequirements ? 'Hide' : 'See'} how to reach {nextPosition.name}
          </button>
        )}
      </div>

      <div style={s.journeyTrack}>
        <div style={s.journeyLine} />
        <div style={{
          ...s.journeyLineFilled,
          width: filledLineWidth,
        }} />
        <div style={s.journeySteps}>
          {ladder.map((p, i) => {
            const isCompleted = currentIdx >= 0 && i < currentIdx;
            const isCurrent = p.positionId === currentPositionId;
            const isNext = p.positionId === nextPositionId;
            const isFuture = currentIdx >= 0 && i > currentIdx && !isNext;

            const dotBg = isCompleted ? C.success
              : isCurrent ? C.primary
              : isNext ? C.primarySoft
              : '#fff';
            const dotBorder = isCurrent ? C.primary
              : isNext ? C.primaryBorder
              : isCompleted ? C.success
              : '#e5e7eb';
            const dotIcon = isCompleted ? faCheck : isNext ? faFlag : null;

            return (
              <div key={p.positionId} style={s.journeyStep}>
                <div
                  style={{
                    ...s.journeyDot,
                    background: dotBg,
                    borderColor: dotBorder,
                    borderWidth: isCurrent ? 3 : 2,
                    // Soft outer glow on the active step; nothing on neutral
                    // steps so the eye lands on "you are here" first.
                    boxShadow: isCurrent
                      ? '0 0 0 6px rgba(90,103,216,0.14), 0 1px 2px rgba(90,103,216,0.18)'
                      : isCompleted
                        ? '0 1px 2px rgba(5,150,105,0.18)'
                        : 'none',
                    color: isCompleted ? '#fff' : isNext ? C.primary : C.primary,
                    opacity: isFuture ? 0.6 : 1,
                  }}
                >
                  {dotIcon && <FontAwesomeIcon icon={dotIcon} style={{ fontSize: 11 }} />}
                </div>
                <div style={{
                  ...s.journeyLabel,
                  color: isCurrent ? C.primaryDeep : isFuture ? C.mutedSoft : C.text,
                  fontWeight: isCurrent ? 700 : 600,
                }}>
                  {p.name}
                </div>
                {isCurrent && <div style={s.journeyBadge}>You are here</div>}
                {isNext && <div style={{ ...s.journeyBadge, background: '#fff', color: C.primary, border: `1px solid ${C.primaryBorder}` }}>Next</div>}
              </div>
            );
          })}
        </div>
      </div>

      {showRequirements && nextPosition && (
        <div style={{
          marginTop: 18, padding: 16, background: C.primarySoft,
          border: `1px solid ${C.primaryBorder}`, borderRadius: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <FontAwesomeIcon icon={faFlag} style={{ color: C.primary, fontSize: 13 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.primaryDeep }}>
              To reach {nextPosition.name}
            </span>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {nextPositionRequirements.map((req, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.textSub }}>
                <span style={{
                  width: 16, height: 16, borderRadius: 999, background: '#fff',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${C.primaryBorder}`, color: C.primary, fontSize: 9, flexShrink: 0,
                }}>{i + 1}</span>
                {req}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Mission Card ─────────────────────────────────────────────────────────────

export function MissionCard({
  mission, onEdit, isTargeted, onToggleTarget,
}: {
  mission: MissionWithProgress;
  onEdit: () => void;
  isTargeted: boolean;
  onToggleTarget: () => void;
}) {
  const { getMeta } = useCategoryMeta();
  const cat = getMeta(mission.category);
  const status = mission.progress?.status ?? 'PENDING';
  const statusMeta = STATUS_META[status];
  const isCompleted = status === 'COMPLETED';
  const isOptional = !mission.required;
  const effort = effortFor(mission);

  // Card chrome — required keeps the standard white card; optional steps
  // back to a soft fill + lighter border so the eye trusts the priority
  // order. Mirrors BoardMissionCard so both surfaces look identical.
  const cardBg = isCompleted ? '#fafbfc' : (isOptional ? '#fafbfc' : '#fff');
  const cardBorder = isCompleted ? '#e9ecf1' : (isOptional ? '#e9ecf1' : '#eceef2');
  const cardShadow = isCompleted || isOptional
    ? 'none'
    : '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)';

  // Mission-priority pill — context-aware label. `MissionCard` is only
  // rendered for missions on the teacher's current position, so the
  // "for-future-position" branch never applies here.
  const requiredPill = mission.required
    ? { bg: C.dangerSoft, color: C.danger, label: 'Required' }
    : { bg: '#f1f5f9', color: C.muted, label: 'Optional' };

  // Always render a progress bar so every card carries the same baseline
  // visual rhythm. Completed reads as fully filled even when count was
  // never logged. Pinned cards use the saturated fill so the focus list
  // visibly carries more weight than browse cards.
  const evidenceTotal = Math.max(1, mission.progress?.evidenceTotal ?? 1);
  const rawCount = mission.progress?.evidenceCount ?? 0;
  const filledCount = isCompleted ? evidenceTotal : rawCount;
  const fillColor = isTargeted
    ? (isCompleted ? C.success : status === 'UNDER_REVIEW' ? C.warning : C.primary)
    : (isCompleted ? C.successBorder : status === 'UNDER_REVIEW' ? C.warningBorder : C.primaryBorder);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 12,
      padding: 16,
      background: cardBg,
      border: `1px solid ${cardBorder}`,
      borderRadius: 14,
      boxShadow: cardShadow,
      opacity: isCompleted ? 0.65 : 1,
      transition: 'box-shadow 200ms ease, transform 200ms ease, opacity 200ms ease',
    }}>
      {/* Header — icon + title + Priority/Required + pin */}
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
              background: '#fffbeb', color: '#d97706',
              border: '1px solid #fde68a',
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

      {/* Metadata row — category · difficulty · duration */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        fontSize: 12, fontWeight: 500, color: C.muted,
      }}>
        <span style={{ color: cat.color, fontWeight: 600 }}>{cat.label}</span>
        <span style={{ color: C.divider }}>·</span>
        <span>{effort.label}</span>
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

      {/* Progress bar — always shown, soft fill colour to stay
          informational not loud. */}
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

      {/* Footer — status pill on the left, CTA on the right */}
      <div style={{
        marginTop: 12,
        paddingTop: 12,
        borderTop: `1px solid ${C.divider}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', height: 24, borderRadius: 999,
          fontSize: 11, fontWeight: 600,
          background: statusMeta.bg, color: statusMeta.color,
          flexShrink: 0,
        }}>
          <FontAwesomeIcon icon={statusMeta.icon} style={{ fontSize: 10 }} />
          {statusMeta.label}
        </span>
        <button
          onClick={onEdit}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            height: 32, padding: '0 14px', borderRadius: 8,
            fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
            background: isCompleted ? '#fff' : C.primary,
            color: isCompleted ? C.success : '#fff',
            border: isCompleted ? `1px solid ${C.successBorder}` : 'none',
            cursor: 'pointer',
            boxShadow: isCompleted ? 'none' : `0 1px 2px ${C.primary}40`,
            transition: 'background 160ms ease, box-shadow 160ms ease',
          }}
        >
          {status === 'PENDING' && (
            <FontAwesomeIcon icon={faPlay} style={{ fontSize: 9, marginRight: 6 }} />
          )}
          {statusMeta.cta}
        </button>
      </div>
    </div>
  );
}

// ── Promotion Checklist Row ──────────────────────────────────────────────────

function ChecklistRow({ item }: { item: { label: string; value: string; met: boolean }; isFirst?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: SP.md,
      minWidth: 0, lineHeight: 1.4,
    }}>
      {/* Status indicator — fixed 16×16 wrapper guarantees both states
          (FontAwesome icon vs CSS circle) occupy the same footprint, so
          labels line up exactly. */}
      <span style={{
        width: 16, height: 16, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {item.met ? (
          <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 16, color: C.success, display: 'block' }} />
        ) : (
          <FontAwesomeIcon icon={faClock} style={{ fontSize: 15, color: C.primary, display: 'block' }} />
        )}
      </span>
      <div style={{
        fontSize: 13, fontWeight: 500,
        color: item.met ? C.textSub : C.text,
        flex: 1, minWidth: 0,
      }}>
        {item.label}
      </div>
      <div style={{
        fontSize: 12, fontWeight: 700, textAlign: 'right',
        color: item.met ? C.success : C.muted,
        fontVariantNumeric: 'tabular-nums', flexShrink: 0,
      }}>
        {item.value}
      </div>
    </div>
  );
}

// ── Recommended Action ───────────────────────────────────────────────────────

export function RecommendedAction({
  missions, readiness, allRequiredComplete, nextPositionName,
}: {
  missions: MissionWithProgress[];
  readiness: TeacherCareerData['readiness'];
  allRequiredComplete: boolean;
  nextPositionName: string | null;
}) {
  // Pick the strongest "next" recommendation. Each branch tags WHY this
  // mission was chosen so the teacher trusts the suggestion.
  type ActionTag = 'Required' | 'In progress' | 'Fastest' | 'High priority' | 'Unlocks capability' | 'Awaiting review';
  type Action = { title: string; reason: string; tags: ActionTag[] };
  let action: Action | null = null;

  const review = missions.find(m => m.required && m.progress?.status === 'UNDER_REVIEW');
  if (review) {
    action = {
      title: `"${review.title}" is under review`,
      reason: 'Submitted — waiting on admin approval. Nothing to do until then.',
      tags: ['Awaiting review'],
    };
  }
  if (!action) {
    const inProg = missions.find(m => m.required && m.progress?.status === 'IN_PROGRESS');
    if (inProg) {
      action = {
        title: `Continue "${inProg.title}"`,
        reason: inProg.whyItMatters
          ?? 'Pick up where you left off and submit your remaining evidence.',
        tags: ['Required', 'In progress'],
      };
    }
  }
  if (!action) {
    const priority = missions.find(m => m.required && m.highPriority && (!m.progress || m.progress.status === 'PENDING'));
    if (priority) {
      const tags: ActionTag[] = ['Required', 'High priority'];
      // Only this priority mission unlocks its category? mark it.
      const sameCatCompleted = missions.filter(m => m.category === priority.category && m.progress?.status === 'COMPLETED').length;
      if (sameCatCompleted === 0) tags.push('Unlocks capability');
      action = {
        title: `Start "${priority.title}"`,
        reason: priority.whyItMatters
          ?? `Marked as high priority. ${nextPositionName ? `Closest path to ${nextPositionName}.` : 'Closest path to your next position.'}`,
        tags,
      };
    }
  }
  if (!action) {
    // Pick the fastest pending required mission so the teacher gets a quick win.
    const pendingRequired = missions
      .filter(m => m.required && (!m.progress || m.progress.status === 'PENDING'))
      .map(m => ({ m, effort: effortFor(m) }))
      .sort((a, b) => {
        const order = { Quick: 0, Medium: 1, Major: 2 } as Record<string, number>;
        return (order[a.effort.label] ?? 9) - (order[b.effort.label] ?? 9);
      });
    const first = pendingRequired[0];
    if (first) {
      const tags: ActionTag[] = ['Required'];
      if (first.effort.label === 'Quick') tags.push('Fastest');
      const sameCatCompleted = missions.filter(m => m.category === first.m.category && m.progress?.status === 'COMPLETED').length;
      if (sameCatCompleted === 0) tags.push('Unlocks capability');
      action = {
        title: `Start "${first.m.title}"`,
        reason: first.m.whyItMatters
          ?? `${first.effort.label === 'Quick' ? 'A quick win that unblocks bigger missions later.' : 'Required for promotion to the next position.'}`,
        tags,
      };
    }
  }
  if (!action && allRequiredComplete) {
    action = {
      title: 'All required missions complete',
      reason: 'Waiting on appraisal and supervisor approval. Nothing more on your end right now.',
      tags: ['Awaiting review'],
    };
  }

  if (!action) return null;

  // Map tag → bullet text. Bullets are clearer than chip pills for prose
  // explanations and read like a documented justification.
  const TAG_TO_BULLET: Record<ActionTag, string> = {
    Required:             'Required for promotion',
    'In progress':        'Already in progress',
    Fastest:              'Fastest to complete',
    'High priority':      'Marked as high priority',
    'Unlocks capability': 'Unlocks a new capability',
    'Awaiting review':    'Already submitted — waiting on admin',
  };

  return (
    <div style={s.actionCard} className="tcp-card">
      <div style={s.actionAccent} />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: SP.lg, flex: 1, minWidth: 0 }}>
        <div style={s.actionIcon}>
          <FontAwesomeIcon icon={faLightbulb} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.actionLabel}>Next Step</div>
          <div style={s.actionTitle}>{action.title}</div>
          {action.tags.length > 0 && (
            <ul style={{
              margin: `${SP.md}px 0 0`, padding: 0, listStyle: 'none',
              display: 'flex', flexWrap: 'wrap', gap: `${SP.xs}px ${SP.lg}px`,
            }}>
              {action.tags.map(t => (
                <li key={t} style={{
                  fontSize: 12, color: C.textSub, fontWeight: 500,
                  display: 'inline-flex', alignItems: 'center', gap: SP.sm,
                }}>
                  <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10, color: C.success }} />
                  {TAG_TO_BULLET[t]}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Mission Detail Modal ─────────────────────────────────────────────────────

export function MissionDetailModal({
  mission, onClose, onSave,
}: {
  mission: MissionWithProgress;
  onClose: () => void;
  onSave: (status: MissionStatus, evidenceCount: number, evidenceTotal: number, notes: string | null) => Promise<void>;
}) {
  const { isMobile } = useIsMobile();
  const { getMeta } = useCategoryMeta();
  const [status, setStatus] = useState<MissionStatus>(mission.progress?.status ?? 'PENDING');
  const [evidenceCount, setEvidenceCount] = useState(mission.progress?.evidenceCount ?? 0);
  const [evidenceTotal, setEvidenceTotal] = useState(
    Math.max(1, mission.progress?.evidenceTotal ?? 1),
  );
  const [notes, setNotes] = useState(mission.progress?.notes ?? '');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (!mission.progress && mission.evidenceRequirements && evidenceTotal === 0) {
      const lines = mission.evidenceRequirements.split('\n').filter(l => l.trim()).length;
      if (lines > 0) setEvidenceTotal(lines);
    }
  }, [mission, evidenceTotal]);

  const cat = getMeta(mission.category);

  const submit = async () => {
    setSaving(true);
    try {
      // Coherence guard for the two contradictions:
      //   • Not Started + count > 0  → promote to In Progress
      //   • In Progress + count = 0  → revert to Not Started
      // (only when the mission tracks evidence). UNDER_REVIEW and
      // COMPLETED are never auto-touched — those are deliberate forward
      // transitions.
      let safeStatus: MissionStatus = status;
      if (safeStatus === 'PENDING' && evidenceCount > 0) safeStatus = 'IN_PROGRESS';
      else if (safeStatus === 'IN_PROGRESS' && evidenceCount === 0 && evidenceTotal > 0) safeStatus = 'PENDING';
      await onSave(safeStatus, evidenceCount, evidenceTotal, notes.trim() || null);
    } finally {
      setSaving(false);
    }
  };

  const dialogStyle: React.CSSProperties = isMobile
    ? { ...mdS.dialog, maxHeight: 'calc(100vh - 16px)', borderRadius: 12 }
    : mdS.dialog;
  const overlayStyle: React.CSSProperties = isMobile
    ? { ...mdS.overlay, padding: 8, alignItems: 'flex-end' }
    : mdS.overlay;
  const headerStyle: React.CSSProperties = isMobile
    ? { ...mdS.header, padding: '14px 16px 12px' }
    : mdS.header;
  const bodyStyle: React.CSSProperties = isMobile
    ? { ...mdS.body, padding: '14px 16px' }
    : mdS.body;
  const footerStyle: React.CSSProperties = isMobile
    ? { ...mdS.footer, padding: '12px 16px 16px' }
    : mdS.footer;

  return ReactDOM.createPortal(
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0, flex: 1 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: cat.bg, color: cat.color, fontSize: 16, flexShrink: 0,
            }}>
              <FontAwesomeIcon icon={cat.icon} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2 style={mdS.title}>{mission.title}</h2>
              <div style={{
                marginTop: 4,
                display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8,
                fontSize: 12, fontWeight: 500, color: C.muted,
              }}>
                <span style={{ color: cat.color, fontWeight: 600 }}>{cat.label}</span>
                <span style={{ color: C.divider }}>·</span>
                <span>{DIFFICULTY_LABEL[mission.difficulty]}</span>
                {/* Priority/Required pills mirror the mission-card header
                    so the modal feels like the same component, just
                    expanded — not a separate language. */}
                {mission.highPriority && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '1px 8px', height: 20, borderRadius: 999,
                    fontSize: 10, fontWeight: 700,
                    background: '#fffbeb', color: '#d97706',
                    border: '1px solid #fde68a',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    <FontAwesomeIcon icon={faStar} style={{ fontSize: 9 }} />
                    Priority
                  </span>
                )}
                <span style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '1px 8px', height: 20, borderRadius: 999,
                  fontSize: 10, fontWeight: 700,
                  background: mission.required ? C.dangerSoft : '#f1f5f9',
                  color: mission.required ? C.danger : C.muted,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {mission.required ? 'Required' : 'Optional'}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={mdS.closeBtn} aria-label="Close">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div style={bodyStyle}>
          {mission.description && (
            <div style={mdS.field}>
              <div style={mdS.label}>Description</div>
              <p style={mdS.staticText}>{mission.description}</p>
            </div>
          )}

          {mission.whyItMatters && (
            <div style={mdS.field}>
              <div style={mdS.label}>Why this matters</div>
              <div style={{
                padding: '10px 12px', background: C.primarySoft,
                border: `1px solid ${C.primaryBorder}`, borderRadius: 8,
                fontSize: 13, color: C.textSub, lineHeight: 1.5,
              }}>
                {mission.whyItMatters}
              </div>
            </div>
          )}

          {mission.evidenceRequirements && (
            <div style={mdS.field}>
              <div style={mdS.label}>Evidence required</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: C.textSub, lineHeight: 1.6 }}>
                {mission.evidenceRequirements.split('\n').filter(l => l.trim()).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={mdS.field}>
            <div style={mdS.label}>Status</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['PENDING', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED'] as MissionStatus[]).map(st => {
                const meta = STATUS_META[st];
                const active = status === st;
                // Status ↔ evidence coherence (only enforced for missions
                // that actually track evidence, i.e. evidenceTotal > 0):
                //   • count > 0 → "Not Started" disabled (logged work
                //                  contradicts the not-started state)
                //   • count = 0 → only "Not Started" is selectable; the
                //                  forward states are gated until at
                //                  least one evidence item is logged
                let disabled = false;
                let disabledHint: string | undefined;
                if (evidenceTotal > 0) {
                  if (st === 'PENDING' && evidenceCount > 0) {
                    disabled = true;
                    disabledHint = 'Clear evidence count to mark as Not Started';
                  } else if (st !== 'PENDING' && evidenceCount === 0) {
                    disabled = true;
                    disabledHint = 'Log at least one evidence item to update status';
                  }
                }
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => { if (!disabled) setStatus(st); }}
                    disabled={disabled}
                    title={disabledHint}
                    style={{
                      ...mdS.statusBtn,
                      background: active ? meta.color : '#fff',
                      color: active ? '#fff' : meta.color,
                      borderColor: meta.color,
                      opacity: disabled ? 0.4 : 1,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <FontAwesomeIcon icon={meta.icon} style={{ marginRight: 5, fontSize: 10 }} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <div style={mdS.field}>
              <div style={mdS.label}>Evidence submitted</div>
              {/* Stepper UI — logging evidence is the highest-frequency
                  action in this modal, so it gets a tactile +/− control
                  with the count as the focal element. The big number
                  reads at a glance; the buttons clamp at the natural
                  bounds (0 and total). */}
              {(() => {
                const setCountWithStatusSync = (next: number) => {
                  const clamped = Math.max(0, Math.min(evidenceTotal, next));
                  setEvidenceCount(clamped);
                  if (clamped > 0 && status === 'PENDING') {
                    setStatus('IN_PROGRESS');
                  } else if (clamped === 0 && status === 'IN_PROGRESS' && evidenceTotal > 0) {
                    setStatus('PENDING');
                  }
                };
                const decDisabled = evidenceCount <= 0;
                const incDisabled = evidenceCount >= evidenceTotal;
                const stepBtn = (disabled: boolean): React.CSSProperties => ({
                  width: 36, height: 36, borderRadius: 8,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${C.cardBorder}`,
                  background: disabled ? '#fafbfc' : '#fff',
                  color: disabled ? C.mutedSoft : C.text,
                  fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                  transition: 'background 160ms ease, border-color 160ms ease',
                });
                return (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '4px 6px',
                    border: `1px solid ${C.cardBorder}`, borderRadius: 10,
                    background: '#fff',
                  }}>
                    <button
                      type="button"
                      aria-label="Decrease evidence count"
                      disabled={decDisabled}
                      onClick={() => setCountWithStatusSync(evidenceCount - 1)}
                      style={stepBtn(decDisabled)}
                    >
                      −
                    </button>
                    <div style={{
                      flex: 1, textAlign: 'center',
                      fontSize: 16, fontWeight: 700, color: C.text,
                      fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
                    }}>
                      {evidenceCount}<span style={{ color: C.mutedSoft, fontWeight: 500 }}> / {evidenceTotal}</span>
                    </div>
                    <button
                      type="button"
                      aria-label="Increase evidence count"
                      disabled={incDisabled}
                      onClick={() => setCountWithStatusSync(evidenceCount + 1)}
                      style={stepBtn(incDisabled)}
                    >
                      +
                    </button>
                  </div>
                );
              })()}
            </div>
            <div style={mdS.field}>
              <div style={mdS.label}>Total required</div>
              <input
                type="number"
                min={1}
                value={evidenceTotal}
                onChange={e => setEvidenceTotal(Math.max(1, parseInt(e.target.value || '1', 10)))}
                style={mdS.input}
              />
            </div>
          </div>

          <div style={mdS.field}>
            <div style={mdS.label}>Notes</div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes from the supervisor or teacher."
              style={{ ...mdS.input, minHeight: 70, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
        </div>

        <div style={footerStyle}>
          <button onClick={onClose} style={mdS.cancelBtn}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ ...mdS.saveBtn, opacity: saving ? 0.6 : 1 }}>
            <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Section + EmptyState helpers ─────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={s.card} className="tcp-card">
      <div style={{ marginBottom: 14 }}>
        <div style={s.cardTitle}>{title}</div>
        {subtitle && <div style={s.cardSub}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ icon, title, hint }: { icon: any; title: string; hint: React.ReactNode }) {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
      <FontAwesomeIcon icon={icon} style={{ fontSize: 22, color: C.mutedSoft, marginBottom: 10 }} />
      <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: C.text }}>{title}</h4>
      <p style={{ margin: 0, fontSize: 12, color: C.muted }}>{hint}</p>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: `${SP.xxxl}px ${SP.xxxl}px ${SP.x5}px`,
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    background: C.bg, minHeight: '100vh', color: C.text,
  },
  inner: { maxWidth: 1440, margin: '0 auto' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: SP.sm, fontSize: 12 },
  crumbLink: { color: C.muted, textDecoration: 'none', fontWeight: 500, transition: TRANSITION },
  crumbCurrent: { color: C.text, fontWeight: 600 },
  backBtn: {
    width: 32, height: 32, borderRadius: RADIUS_SM, border: `1px solid ${C.cardBorder}`,
    background: '#fff', cursor: 'pointer', color: C.muted, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 12,
    transition: TRANSITION,
  },
  heading: { margin: 0, fontSize: 28, fontWeight: 700, color: C.text, letterSpacing: '-0.025em' },
  subheading: { fontSize: 13, color: C.muted, marginTop: 2 },

  hero: {
    padding: `${SP.xxl}px ${SP.xxxl}px`,
    background: `linear-gradient(170deg, #fff 0%, ${C.primarySoft} 100%)`,
    border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS_LG, boxShadow: SHADOW_LG,
    marginBottom: SP.xxl,
  },
  // Hero sections divided by hairline borders for a calm vertical rhythm.
  // Tightened to lg/lg so the Achievements band rises closer to the top
  // of the page — the strip is the visual reward, it shouldn't be buried.
  heroSection: {
    marginTop: SP.lg, paddingTop: SP.lg, borderTop: `1px solid ${C.divider}`,
  },
  // Body grid — Current Targets on the left, vertical Career Journey on the
  // right. Wraps to single column on narrow screens.
  bodyGrid: {
    display: 'grid', gap: SP.xl,
    gridTemplateColumns: 'minmax(0, 1fr) 420px',
    alignItems: 'start',
  },
  // 2-col body inside a section. Left ≈ mission progress, right ≈ the
  // compact promotion requirements list. Top-aligned (start) so the
  // labels of both columns share a baseline and the eye doesn't have
  // to chase a floating progress bar.
  heroBody: {
    display: 'grid', gap: SP.x4,
    gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 400px)',
    alignItems: 'start',
  },
  heroChecklistCol: {
    paddingLeft: SP.x4, borderLeft: `1px solid ${C.divider}`,
    minWidth: 0,
  },
  // Plain three-line list — no container, no row dividers, no chrome.
  // Each requirement reads as a bullet line.
  checklistList: {
    display: 'flex', flexDirection: 'column', gap: SP.sm,
  },
  heroLabel: {
    fontSize: 11, fontWeight: 700, color: C.muted,
    textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  heroPath: {
    fontSize: 26, fontWeight: 700, color: C.text, marginTop: 6,
    letterSpacing: '-0.022em', lineHeight: 1.2,
    display: 'flex', alignItems: 'center', flexWrap: 'wrap',
  },
  heroPathCurr: { color: C.primary },
  heroPathNext: { color: C.text, opacity: 0.42 },
  avatar: {
    width: 48, height: 48, borderRadius: RADIUS_SM, color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: 16, flexShrink: 0, letterSpacing: '0.02em',
    boxShadow: '0 1px 2px rgba(15,23,42,0.06)',
  },
  progressTrack: { height: 8, background: C.divider, borderRadius: 999, overflow: 'hidden' },
  progressFill: {
    height: '100%', borderRadius: 999,
    transition: 'width 600ms cubic-bezier(0.4, 0, 0.2, 1)',
  },

  card: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS,
    padding: `${SP.xxl}px ${SP.xxl}px`, boxShadow: SHADOW, marginBottom: SP.xl,
    transition: TRANSITION,
  },
  cardTitle: { fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '-0.012em' },
  cardSub: { fontSize: 12, color: C.muted, marginTop: 4, fontWeight: 500 },

  // Journey timeline — node spacing increased, line shifted to vertical
  // centre of the dots so it reads as a single rail rather than two parts.
  journeyTrack: { position: 'relative', padding: '12px 8px 8px' },
  journeyLine: {
    position: 'absolute', left: 32, right: 32, top: 26,
    height: 2, background: C.divider,
  },
  journeyLineFilled: {
    position: 'absolute', left: 32, top: 26,
    height: 2, background: C.success,
    transition: 'width 600ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
  journeySteps: {
    position: 'relative', display: 'flex', justifyContent: 'space-between',
    gap: 12, flexWrap: 'wrap',
  },
  journeyStep: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    flex: '1 1 0', minWidth: 96, textAlign: 'center', position: 'relative',
  },
  journeyDot: {
    width: 32, height: 32, borderRadius: 999, border: '2px solid',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#fff', zIndex: 1, transition: TRANSITION,
  },
  journeyLabel: { marginTop: 12, fontSize: 12, lineHeight: 1.35, maxWidth: 120 },
  journeyBadge: {
    marginTop: 6, fontSize: 9, fontWeight: 700, padding: '3px 8px',
    borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.06em',
    background: C.primary, color: '#fff',
    boxShadow: '0 1px 2px rgba(90,103,216,0.25)',
  },

  missionCard: {
    border: '1px solid', borderRadius: 12, padding: 16,
    display: 'flex', flexDirection: 'column',
    transition: 'all 150ms ease',
  },
  missionCatIcon: {
    width: 36, height: 36, borderRadius: 10, display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
  },
  missionPill: {
    padding: '2px 7px', borderRadius: 999, fontSize: 9, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  missionCardDesc: { margin: '0 0 10px', fontSize: 12, color: C.muted, lineHeight: 1.5 },
  whyMatters: {
    padding: '8px 12px', borderRadius: 8, background: C.primarySoft,
    border: `1px solid ${C.primaryBorder}`, marginBottom: 10,
  },
  miniTrack: { height: 6, background: C.divider, borderRadius: 999, overflow: 'hidden' },
  miniFill: { height: '100%', borderRadius: 999, transition: 'width 200ms ease' },
  missionFooter: {
    marginTop: 'auto', display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', gap: 8, paddingTop: 8,
  },
  statusPill: {
    padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
    display: 'inline-flex', alignItems: 'center',
  },
  missionAction: {
    padding: '7px 14px', borderRadius: 8,
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },

  readinessRow: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
    border: `1px solid ${C.cardBorder}`, borderRadius: 10, background: '#fff',
  },
  readinessIcon: {
    width: 32, height: 32, borderRadius: 8, display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0,
  },
  readinessName: { fontSize: 13, fontWeight: 600, color: C.text },
  readinessVal: { fontSize: 11, color: C.muted, marginTop: 2 },

  badge: {
    border: '1px solid', borderRadius: 14, padding: 16,
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
  },
  badgeIcon: {
    width: 44, height: 44, borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
  },

  // Next Step card — feels like a CTA, not just an info card. Subtle
  // primary tint + 3px primary accent bar at the left edge. Hover lifts
  // it slightly so it reads as actionable.
  actionCard: {
    position: 'relative',
    display: 'flex', alignItems: 'flex-start',
    padding: `${SP.xl}px ${SP.xxl}px ${SP.xl}px ${SP.xxl + SP.xs}px`,
    background: `linear-gradient(180deg, ${C.primarySoft} 0%, #fff 60%)`,
    border: `1px solid ${C.primaryBorder}`, borderRadius: RADIUS,
    boxShadow: SHADOW,
    marginBottom: SP.xxl,
    overflow: 'hidden',
    transition: TRANSITION,
  },
  actionAccent: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: 3, background: C.primary,
  },
  actionIcon: {
    width: 40, height: 40, borderRadius: RADIUS_SM,
    background: '#fff', color: C.primary,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, flexShrink: 0,
    border: `1px solid ${C.primaryBorder}`,
    boxShadow: '0 1px 2px rgba(90,103,216,0.12)',
  },
  actionLabel: {
    fontSize: 11, fontWeight: 700, color: C.primary,
    textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  actionTitle: {
    marginTop: 4, fontSize: 18, fontWeight: 700, color: C.text,
    lineHeight: 1.3, letterSpacing: '-0.015em',
  },
};

// Mobile overrides — spread onto the base styles when isMobile is true.
// Reactive (via useIsMobile) so the layout responds to live window resize
// instead of being frozen at module-load time.
const sMobile: Record<string, React.CSSProperties> = {
  page: { padding: `${SP.lg}px ${SP.md}px ${SP.xxl}px` },
  hero: { padding: `${SP.lg}px ${SP.lg}px`, borderRadius: RADIUS, marginBottom: SP.lg },
  heroBody: { gridTemplateColumns: '1fr', gap: SP.lg },
  heroChecklistCol: {
    paddingLeft: 0, borderLeft: 'none',
    paddingTop: SP.lg, borderTop: `1px solid ${C.divider}`,
  },
  bodyGrid: { gridTemplateColumns: '1fr', gap: SP.lg },
  card: { padding: `${SP.lg}px ${SP.lg}px`, marginBottom: SP.lg },
};

const mdS: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.42)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  dialog: {
    background: '#fff', borderRadius: 16, width: '100%', maxWidth: 580,
    boxShadow: '0 24px 60px rgba(15,23,42,0.25)',
    maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '20px 24px 14px', borderBottom: `1px solid ${C.divider}`, gap: 12,
  },
  title: { margin: 0, fontSize: 17, fontWeight: 700, color: C.text },
  subtitle: { fontSize: 12, color: C.muted, marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 8, border: 'none',
    background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 14,
  },
  body: { padding: '20px 24px', overflowY: 'auto', flex: 1 },
  field: { marginBottom: 16 },
  label: { fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  staticText: { margin: 0, fontSize: 13, color: C.textSub, lineHeight: 1.5 },
  input: {
    width: '100%', padding: '10px 12px', fontSize: 13,
    border: `1px solid ${C.cardBorder}`, borderRadius: 8,
    outline: 'none', color: C.text, boxSizing: 'border-box',
  },
  statusBtn: {
    padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    border: '1px solid', cursor: 'pointer',
  },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 10,
    padding: '14px 24px 20px', borderTop: `1px solid ${C.divider}`,
  },
  cancelBtn: {
    padding: '10px 18px', borderRadius: 10, border: `1px solid ${C.cardBorder}`,
    background: '#fff', color: C.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  saveBtn: {
    padding: '10px 18px', borderRadius: 10, border: 'none',
    background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
};
