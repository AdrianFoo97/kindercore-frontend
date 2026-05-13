import { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronLeft, faChevronRight, faShieldHalved, faCheck, faClock,
  faFlag, faCircleCheck, faTriangleExclamation, faLock,
  faRoad, faArrowRight, faBolt,
} from '@fortawesome/free-solid-svg-icons';
import { fetchTeacherCareer, MissionWithProgress } from '../api/career-missions.js';
import { Position } from '../types/index.js';
import { uploadUrl } from '../api/upload.js';
import { useMissionTargets } from '../hooks/useMissionTargets.js';

// ─────────────────────────────────────────────────────────────────────────────
// Teacher-facing career hub — mobile-first.
// Answers the five career questions in one screen: where am I now,
// where am I going, how far am I, what should I do next, and what do
// I unlock. The principal view (/teachers/:id/career) stays as the
// wide HR surface; this page is the teacher's phone-first version
// with light gamification (stage dots, unlock cues, next-action
// nudges) but kept premium and professional.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eceef2',
  divider: '#eef0f3',
  text: '#0f172a',
  textSub: '#3f4b5c',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
  primaryBorder: '#c7d2fe',
  primaryDeep: '#4338ca',
  success: '#16a34a',
  successSoft: '#dcfce7',
  successBorder: '#bbf7d0',
  warning: '#d97706',
  warningSoft: '#fffbeb',
  warningBorder: '#fde68a',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  dangerBorder: '#fecaca',
  slateSoft: '#f1f5f9',
};

// Pick the single mission the teacher should work on next. Priority:
// 1) Top focus mission that's incomplete (their pinned target)
// 2) First required, incomplete mission (the gating list)
// 3) First incomplete mission in the position's queue
// Used by the hero's "next action" microcopy to point them somewhere
// concrete the second they land on the page.
function pickNextAction(focus: MissionWithProgress[], all: MissionWithProgress[]) {
  const isIncomplete = (m: MissionWithProgress) => m.progress?.status !== 'COMPLETED';
  const inFocus = focus.find(isIncomplete);
  if (inFocus) return inFocus;
  const required = all.find(m => m.required && isIncomplete(m));
  if (required) return required;
  return all.find(isIncomplete) ?? null;
}

export default function TeacherMyCareerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['teacher-career', id],
    queryFn: () => fetchTeacherCareer(id!),
    enabled: !!id,
  });
  const { isTargeted } = useMissionTargets(id);

  // Targeted missions — what the teacher has explicitly pinned as
  // their focus on the missions board. Sort so incomplete + high-
  // priority + required surface first. Capped at 3 for the hub.
  const focusMissions = useMemo(() => {
    const ms = (data?.missions ?? []).filter(m => isTargeted(m.id));
    return ms.sort((a, b) => {
      const aDone = a.progress?.status === 'COMPLETED' ? 1 : 0;
      const bDone = b.progress?.status === 'COMPLETED' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      const aPri = (a.highPriority ? 0 : 1) + (a.required ? 0 : 2);
      const bPri = (b.highPriority ? 0 : 1) + (b.required ? 0 : 2);
      if (aPri !== bPri) return aPri - bPri;
      return a.displayOrder - b.displayOrder;
    }).slice(0, 3);
  }, [data?.missions, isTargeted]);

  if (isLoading) {
    return <div style={s.page}><div style={s.inner}><p style={{ padding: 40, color: C.mutedSoft }}>Loading…</p></div></div>;
  }
  if (isError || !data) {
    return <div style={s.page}><div style={s.inner}><p style={{ padding: 40, color: C.danger }}>Failed to load.</p></div></div>;
  }

  const { teacher, currentPosition, nextPosition, missions, readiness } = data;
  const ladder = data.ladder ?? data.positions ?? [];
  const isFinalStage = readiness.isFinalStage ?? (!!currentPosition && !nextPosition);
  const isCurrentInLadder = readiness.isCurrentInLadder ?? true;
  const requiredMet = readiness.missions.met;
  const requiredCompleted = readiness.missions.completed;
  const requiredTotal = readiness.missions.total;
  const requiredRemaining = Math.max(0, requiredTotal - requiredCompleted);

  // Stage X of Y framing — only meaningful when on the ladder.
  const ladderIdx = currentPosition && isCurrentInLadder
    ? ladder.findIndex(p => p.positionId === currentPosition.positionId)
    : -1;
  const stageNumber = ladderIdx >= 0 ? ladderIdx + 1 : null;
  const totalStages = ladder.length;

  // Status pill — five flavours: ready for review, in progress,
  // final stage reached, off ladder, or no position assigned.
  const statusPill = (() => {
    if (!currentPosition) {
      return { label: 'No position assigned', icon: faTriangleExclamation, color: C.warning, bg: C.warningSoft, border: C.warningBorder };
    }
    if (!isCurrentInLadder) {
      return { label: 'Off career ladder', icon: faTriangleExclamation, color: C.muted, bg: C.slateSoft, border: '#e2e8f0' };
    }
    if (isFinalStage) {
      return { label: 'Final stage reached', icon: faCircleCheck, color: C.success, bg: C.successSoft, border: C.successBorder };
    }
    if (readiness.overallReady) {
      return { label: 'Ready for review', icon: faCircleCheck, color: C.success, bg: C.successSoft, border: C.successBorder };
    }
    return { label: 'In progress', icon: faClock, color: C.primary, bg: C.primarySoft, border: C.primaryBorder };
  })();

  // Required-missions progress percentage — drives the bar copy
  // "14% toward Senior EI" and the bar fill width.
  const missionPct = requiredTotal > 0
    ? Math.max(0, Math.min(100, Math.round((requiredCompleted / requiredTotal) * 100)))
    : 100;

  const nextAction = !isFinalStage && currentPosition
    ? pickNextAction(focusMissions, missions)
    : null;

  return (
    <div style={s.page}>
      <style>{`
        .tmcar-back-btn:hover { background: #f1f5f9 !important; color: ${C.text} !important; border-color: #cbd5e1 !important; }
        .tmcar-quick-btn:active { background: ${C.primarySoft} !important; }
        .tmcar-mission { transition: border-color 140ms ease, background 140ms ease; }
        .tmcar-mission:active { background: ${C.slateSoft} !important; }
      `}</style>

      <div style={s.inner}>
        <div style={s.breadcrumb}>
          <button onClick={() => navigate(`/teachers/${id}`)} className="tmcar-back-btn" style={s.backBtn} title="Back">
            <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 11 }} />
          </button>
          <Link to="/teachers" style={s.crumbLink}>Teachers</Link>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
          <Link to={`/teachers/${id}`} style={s.crumbLink}>{teacher.name}</Link>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
          <span style={s.crumbCurrent}>My Career</span>
        </div>

        {/* Career Path hero — the single screen that answers "where
            am I, where am I going, and how far". Lays out top-to-
            bottom: status row → identity → stage dots → next target
            arrow → progress block → next-action callout → CTAs. */}
        <div style={s.heroCard}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 10, marginBottom: 14, flexWrap: 'wrap',
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 10, fontWeight: 700, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>
              {teacher.color && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: teacher.color, flexShrink: 0 }} />
              )}
              My Career Path
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 999, flexShrink: 0,
              background: statusPill.bg,
              border: `1px solid ${statusPill.border}`,
              color: statusPill.color,
              fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              <FontAwesomeIcon icon={statusPill.icon} style={{ fontSize: 10 }} />
              {statusPill.label}
            </span>
          </div>

          {/* Identity — bigger badge + bolder rank name. This is the
              "where am I" answer; gets the most visual weight on the
              card. Stage number sits inline beside the level pill. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {currentPosition?.badgeUrl ? (
              <img
                src={uploadUrl(currentPosition.badgeUrl)}
                alt={currentPosition.name}
                style={{
                  width: 64, height: 64, objectFit: 'contain', flexShrink: 0,
                  filter: 'drop-shadow(0 6px 14px rgba(90,103,216,0.22))',
                }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div style={{
                width: 64, height: 64, borderRadius: 14, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `linear-gradient(135deg, ${C.primarySoft} 0%, #fff 80%)`,
                color: C.primary,
                border: `1px solid ${C.primaryBorder}`,
                fontSize: 26,
              }}>
                <FontAwesomeIcon icon={faShieldHalved} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 10, fontWeight: 800, color: C.muted,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                marginBottom: 2,
              }}>
                Current rank
              </div>
              <h1 style={{
                margin: 0, fontSize: 22, fontWeight: 800, color: C.text,
                letterSpacing: '-0.022em', lineHeight: 1.15,
              }}>
                {currentPosition?.name ?? 'Not assigned'}
              </h1>
              <div style={{
                marginTop: 6,
                display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6,
              }}>
                {teacher.level != null && currentPosition?.maxLevel != null && currentPosition.maxLevel > 0 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 999,
                    background: C.primarySoft, color: C.primary,
                    border: `1px solid ${C.primaryBorder}`,
                    fontSize: 10, fontWeight: 800,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    Level {teacher.level}
                  </span>
                )}
                {stageNumber != null && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: C.mutedSoft,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    Stage {stageNumber} of {totalStages}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stage indicator — dot row that mirrors the position
              ladder so the teacher sees "I'm here in the chain".
              Completed stages = green tick, current = solid primary
              with a soft halo, future = hollow grey. A light
              gamification cue without feeling like a game. */}
          {stageNumber != null && ladder.length > 1 && (
            <StageDots ladder={ladder} currentIdx={ladderIdx} />
          )}

          {/* Next-target arrow row — the "where am I going" answer.
              Renders only when a next position exists; final-stage
              teachers see the success pill above instead. */}
          {nextPosition && !isFinalStage && (
            <div style={{
              marginTop: 14,
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px',
              background: C.slateSoft,
              border: `1px solid ${C.divider}`,
              borderRadius: 10,
            }}>
              <span style={{
                fontSize: 9, fontWeight: 800, color: C.mutedSoft,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                flexShrink: 0,
              }}>
                Working toward
              </span>
              <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 10, color: C.mutedSoft, flexShrink: 0 }} />
              <span style={{
                flex: 1, minWidth: 0,
                fontSize: 13, fontWeight: 800, color: C.text,
                letterSpacing: '-0.005em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {nextPosition.name}
              </span>
            </div>
          )}

          {/* Progress block — meaningful copy: "1 of 7 missions
              completed" + "14% toward Senior EI" + a remaining-count
              microcopy that frames the gap as a finite countdown
              rather than an open-ended grind. */}
          {requiredTotal > 0 && !isFinalStage && currentPosition && (
            <div style={{ marginTop: 14 }}>
              <div style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                gap: 10, marginBottom: 6,
              }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: C.text,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {requiredCompleted} of {requiredTotal} missions completed
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 800,
                  color: requiredMet ? C.success : C.primary,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {missionPct}%
                </span>
              </div>
              <div style={{
                position: 'relative',
                height: 10, borderRadius: 999,
                background: C.slateSoft,
                border: `1px solid ${C.divider}`,
                overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', insetBlock: 0, left: 0,
                  width: `${missionPct}%`,
                  background: requiredMet
                    ? `linear-gradient(90deg, ${C.success}, #15803d)`
                    : `linear-gradient(90deg, ${C.primary}, ${C.primaryDeep})`,
                  borderRadius: 999,
                  transition: 'width 600ms cubic-bezier(0.4, 0, 0.2, 1)',
                }} />
              </div>
              <div style={{
                marginTop: 8,
                fontSize: 11, fontWeight: 600, color: C.muted,
                lineHeight: 1.45,
              }}>
                {requiredMet
                  ? <>All required missions complete <span style={{ color: C.success, fontWeight: 800 }}>— ready for review.</span></>
                  : nextPosition
                    ? <>{missionPct}% toward <span style={{ color: C.text, fontWeight: 700 }}>{nextPosition.name}</span> · <span style={{ color: C.textSub, fontWeight: 700 }}>{requiredRemaining}</span> {requiredRemaining === 1 ? 'mission' : 'missions'} to unlock promotion review</>
                    : <>{missionPct}% complete</>}
              </div>
            </div>
          )}

          {/* Next-action callout — the "what should I do next" answer
              points at one concrete mission. Soft primary tint so it
              reads as a friendly nudge, not an alert. */}
          {nextAction && (
            <Link
              to={`/teachers/${id}/career/missions`}
              style={{
                marginTop: 14,
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px',
                background: `linear-gradient(135deg, ${C.primarySoft} 0%, #fff 100%)`,
                border: `1px solid ${C.primaryBorder}`,
                borderRadius: 10,
                textDecoration: 'none', color: 'inherit',
              }}
            >
              <span style={{
                width: 26, height: 26, borderRadius: '50%',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: '#fff', color: C.primary,
                border: `1px solid ${C.primaryBorder}`,
                fontSize: 11,
                flexShrink: 0,
              }}>
                <FontAwesomeIcon icon={faBolt} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 9, fontWeight: 800, color: C.primary,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  marginBottom: 1,
                }}>
                  Next action
                </div>
                <div style={{
                  fontSize: 12, fontWeight: 700, color: C.text,
                  lineHeight: 1.3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  Complete <span style={{ color: C.primaryDeep }}>"{nextAction.title}"</span>
                </div>
              </div>
              <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 11, color: C.primary, flexShrink: 0 }} />
            </Link>
          )}

          {/* Quick-nav — labels expanded to "View Missions" / "Career
              Journey" so the tap target reads as a destination, not a
              category. */}
          <div style={{
            marginTop: 14,
            display: 'grid', gap: 8,
            gridTemplateColumns: '1fr 1fr',
          }}>
            <Link
              to={`/teachers/${id}/career/missions`}
              className="tmcar-quick-btn"
              style={s.quickBtn}
            >
              <FontAwesomeIcon icon={faFlag} style={{ fontSize: 11, color: C.primary }} />
              View Missions
              <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft, marginLeft: 'auto' }} />
            </Link>
            <Link
              to={`/teachers/${id}/career`}
              className="tmcar-quick-btn"
              style={s.quickBtn}
            >
              <FontAwesomeIcon icon={faRoad} style={{ fontSize: 11, color: C.primary }} />
              Career Journey
              <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft, marginLeft: 'auto' }} />
            </Link>
          </div>
        </div>

        {/* My Focus — active quests. Subtitle ties them to the next
            promotion so each card reads as "this gets me to X". */}
        <section style={s.section}>
          <div style={s.sectionCard}>
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              marginBottom: 14,
            }}>
              <span style={{ width: 3, height: 14, borderRadius: 999, background: C.primary, flexShrink: 0, marginTop: 3 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 style={{
                  margin: 0, fontSize: 14, fontWeight: 800, color: C.text,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  My Focus
                </h3>
                <p style={{
                  margin: '4px 0 0', fontSize: 12, fontWeight: 500, color: C.muted,
                  lineHeight: 1.5,
                }}>
                  {nextPosition
                    ? `Complete these first to move closer to ${nextPosition.name}.`
                    : 'Pinned missions you\'re actively working on.'}
                </p>
              </div>
            </div>

            {focusMissions.length === 0 ? (
              <div style={{
                padding: '18px 14px', textAlign: 'center',
                background: C.slateSoft, border: `1px solid ${C.divider}`,
                borderRadius: 10,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.textSub, marginBottom: 4 }}>
                  No missions pinned yet
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, color: C.muted, lineHeight: 1.4, marginBottom: 12 }}>
                  Tap a mission's pin on the Missions page to add it to your focus list.
                </div>
                <Link
                  to={`/teachers/${id}/career/missions`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', borderRadius: 8,
                    background: C.primary, color: '#fff',
                    fontSize: 12, fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  Browse missions
                  <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 10 }} />
                </Link>
              </div>
            ) : (
              <ul style={{
                margin: 0, padding: 0, listStyle: 'none',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                {focusMissions.map(m => (
                  <FocusMissionCard
                    key={m.id}
                    mission={m}
                    teacherId={id!}
                  />
                ))}
                <Link
                  to={`/teachers/${id}/career/missions`}
                  style={{
                    marginTop: 4,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '8px 12px',
                    fontSize: 12, fontWeight: 700, color: C.primary,
                    textDecoration: 'none',
                  }}
                >
                  View all missions ({missions.length})
                  <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 10 }} />
                </Link>
              </ul>
            )}
          </div>
        </section>

        {/* Next Target — aspirational unlock card. Frames promotion
            as something you "unlock" rather than something you're
            forced to chase. Concrete unlock condition + a one-line
            growth outcome so the teacher reads it as a destination,
            not just a higher number. */}
        {nextPosition && !isFinalStage && currentPosition && (
          <section style={s.section}>
            <NextTargetUnlockCard
              teacherId={id!}
              nextPosition={nextPosition}
              requiredCompleted={requiredCompleted}
              requiredTotal={requiredTotal}
              appraisalRequired={readiness.appraisal.required}
            />
          </section>
        )}
      </div>
    </div>
  );
}

// ─── Stage dots ──────────────────────────────────────────────────────────────
// Compact horizontal indicator of where the teacher sits in the
// ladder. Past stages get a tick, the current stage is a solid
// primary blob with a soft halo, future stages are hollow muted dots.
// Keeps the dot row scannable in a single glance.

function StageDots({ ladder, currentIdx }: {
  ladder: Position[];
  currentIdx: number;
}) {
  return (
    <div style={{
      marginTop: 14,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {ladder.map((stage, i) => {
        const isPast = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div
            key={stage.positionId}
            title={`${i + 1}. ${stage.name}`}
            style={{
              flex: 1, minWidth: 0,
              height: 10, borderRadius: 999,
              background: isPast
                ? C.success
                : isCurrent
                  ? `linear-gradient(90deg, ${C.primary}, ${C.primaryDeep})`
                  : C.slateSoft,
              border: `1px solid ${isPast ? C.successBorder : isCurrent ? C.primary : C.divider}`,
              boxShadow: isCurrent ? `0 0 0 3px ${C.primary}1f` : 'none',
              transition: 'background 300ms ease, box-shadow 300ms ease',
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Focus mission card ──────────────────────────────────────────────────────
// One pinned mission rendered as a soft card with title, progress
// count, gradient progress bar, and a small capability label
// underneath (pulled from `whyItMatters`). Completed near-100% reads
// as visually satisfying via a fully-filled green bar + Done pill.

function FocusMissionCard({ mission, teacherId }: {
  mission: MissionWithProgress;
  teacherId: string;
}) {
  const status = mission.progress?.status ?? 'PENDING';
  const completed = status === 'COMPLETED';
  const evidenceTotal = Math.max(1, mission.progress?.evidenceTotal ?? 1);
  const rawCount = mission.progress?.evidenceCount ?? 0;
  const filled = completed ? evidenceTotal : rawCount;
  const pct = Math.max(0, Math.min(100, Math.round((filled / evidenceTotal) * 100)));
  // Near-completion shines: a thin amber bar appears when the
  // teacher is one evidence away from done, so the visual nudges
  // them to finish it.
  const nearDone = !completed && evidenceTotal - rawCount === 1 && rawCount > 0;

  return (
    <Link
      to={`/teachers/${teacherId}/career/missions`}
      className="tmcar-mission"
      style={{
        display: 'block',
        padding: 12,
        background: completed ? '#fafbfc' : C.card,
        border: `1px solid ${completed ? '#e9ecf1' : nearDone ? C.warningBorder : C.cardBorder}`,
        borderRadius: 12,
        textDecoration: 'none', color: 'inherit',
        boxShadow: completed ? 'none' : '0 1px 2px rgba(15,23,42,0.03)',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 8, marginBottom: 8,
      }}>
        <div style={{
          fontSize: 14, fontWeight: 700, color: C.text,
          letterSpacing: '-0.005em', lineHeight: 1.3, minWidth: 0, flex: 1,
        }}>
          {mission.title}
        </div>
        {completed ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 999,
            background: C.successSoft, color: C.success,
            border: `1px solid ${C.successBorder}`,
            fontSize: 9, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            flexShrink: 0,
          }}>
            <FontAwesomeIcon icon={faCheck} style={{ fontSize: 8 }} />
            Done
          </span>
        ) : (
          <span style={{
            fontSize: 12, fontWeight: 800, color: C.text,
            fontVariantNumeric: 'tabular-nums', flexShrink: 0,
          }}>
            {filled}<span style={{ color: C.mutedSoft, fontWeight: 600 }}>/{evidenceTotal}</span>
          </span>
        )}
      </div>
      <div style={{
        position: 'relative',
        height: 6, borderRadius: 999,
        background: C.slateSoft,
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', insetBlock: 0, left: 0,
          width: `${pct}%`,
          background: completed
            ? `linear-gradient(90deg, ${C.success}, #15803d)`
            : nearDone
              ? `linear-gradient(90deg, ${C.warning}, #b45309)`
              : `linear-gradient(90deg, ${C.primary}, ${C.primaryDeep})`,
          borderRadius: 999,
          transition: 'width 500ms cubic-bezier(0.4, 0, 0.2, 1)',
        }} />
      </div>
      {mission.whyItMatters && (
        <div style={{
          marginTop: 8,
          fontSize: 11, fontWeight: 500, color: C.muted,
          lineHeight: 1.4,
          overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box' as any,
          WebkitLineClamp: 2 as any,
          WebkitBoxOrient: 'vertical' as any,
        }}>
          {mission.whyItMatters}
        </div>
      )}
    </Link>
  );
}

// ─── Next Target unlock card ─────────────────────────────────────────────────
// Framed as an unlockable achievement: lock icon eyebrow, badge +
// name + salary up top, then a divided list of "unlock conditions"
// (concrete, gating) and "growth outcome" (aspirational, qualitative).
// Premium tone — soft violet gradient, no game graphics.

function NextTargetUnlockCard({
  teacherId, nextPosition, requiredCompleted, requiredTotal, appraisalRequired,
}: {
  teacherId: string;
  nextPosition: Position;
  requiredCompleted: number;
  requiredTotal: number;
  appraisalRequired: number;
}) {
  const conditions = [
    requiredTotal > 0
      ? `Complete all ${requiredTotal} required missions (${requiredCompleted}/${requiredTotal})`
      : 'Complete all required missions',
    `Reach an appraisal score of ${appraisalRequired}% or above`,
    'Receive supervisor approval',
  ];

  return (
    <Link
      to={`/teachers/${teacherId}/career`}
      style={{
        ...s.sectionCard,
        display: 'block',
        textDecoration: 'none', color: 'inherit',
        background: `linear-gradient(135deg, ${C.primarySoft} 0%, #fff 75%)`,
        border: `1px solid ${C.primaryBorder}`,
      }}
    >
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 10, fontWeight: 800, color: C.primaryDeep,
        textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>
        <FontAwesomeIcon icon={faLock} style={{ fontSize: 10 }} />
        Next target
      </div>

      <div style={{
        marginTop: 10,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        {nextPosition.badgeUrl ? (
          <img
            src={uploadUrl(nextPosition.badgeUrl)}
            alt={nextPosition.name}
            style={{
              width: 56, height: 56, objectFit: 'contain', flexShrink: 0,
              filter: 'drop-shadow(0 6px 14px rgba(90,103,216,0.22))',
              opacity: 0.92,
            }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div style={{
            width: 56, height: 56, borderRadius: 14, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#fff', color: C.primary,
            border: `1px solid ${C.primaryBorder}`,
            fontSize: 22,
          }}>
            <FontAwesomeIcon icon={faShieldHalved} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 18, fontWeight: 800, color: C.text,
            letterSpacing: '-0.015em', lineHeight: 1.2,
          }}>
            {nextPosition.name}
          </div>
          {nextPosition.basicSalary > 0 && (
            <div style={{
              marginTop: 4,
              display: 'inline-flex', alignItems: 'baseline', gap: 4,
              fontVariantNumeric: 'tabular-nums',
            }}>
              <span style={{
                fontSize: 11, fontWeight: 700, color: C.muted,
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                Basic salary
              </span>
              <span style={{
                fontSize: 14, fontWeight: 800, color: C.text,
                letterSpacing: '-0.008em',
              }}>
                RM {nextPosition.basicSalary.toLocaleString('en-MY')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Divided sections: Unlock condition (gating) + Growth outcome
          (qualitative). Same visual rhythm, just different framings. */}
      <div style={{
        marginTop: 14, paddingTop: 14,
        borderTop: `1px solid ${C.primaryBorder}`,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 800, color: C.primaryDeep,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          marginBottom: 8,
        }}>
          Unlock condition
        </div>
        <ul style={{
          margin: 0, padding: 0, listStyle: 'none',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {conditions.map((c, i) => (
            <li key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              fontSize: 12, fontWeight: 500, color: C.textSub,
              lineHeight: 1.45,
            }}>
              <span style={{
                width: 14, height: 14, borderRadius: '50%',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: '#fff', color: C.primary,
                border: `1px solid ${C.primaryBorder}`,
                fontSize: 6,
                flexShrink: 0, marginTop: 3,
              }}>
                <FontAwesomeIcon icon={faLock} />
              </span>
              {c}
            </li>
          ))}
        </ul>
      </div>

      <div style={{
        marginTop: 14, paddingTop: 14,
        borderTop: `1px solid ${C.primaryBorder}`,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 800, color: C.primaryDeep,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          marginBottom: 6,
        }}>
          Growth outcome
        </div>
        <p style={{
          margin: 0, fontSize: 12, fontWeight: 500, color: C.textSub,
          lineHeight: 1.55,
        }}>
          Take on broader teaching responsibilities, mentor newer staff, and grow your impact in the classroom.
        </p>
      </div>
    </Link>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: '16px 12px',
    background: C.bg, minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    color: C.text,
  },
  inner: { maxWidth: 640, margin: '0 auto' },

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
  },

  heroCard: {
    padding: '18px 16px',
    background: C.card,
    border: `1px solid ${C.cardBorder}`,
    borderRadius: 16,
    boxShadow: '0 1px 3px rgba(15,23,42,0.05), 0 6px 18px rgba(15,23,42,0.04)',
  },
  quickBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '10px 12px', borderRadius: 10,
    background: '#fff', color: C.text,
    border: `1px solid ${C.cardBorder}`,
    fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
    cursor: 'pointer',
    textAlign: 'left',
    textDecoration: 'none',
  },

  section: { marginTop: 14, marginBottom: 14 },
  sectionCard: {
    background: C.card,
    border: `1px solid ${C.cardBorder}`,
    borderRadius: 16,
    padding: '18px 14px 20px',
    boxShadow: '0 1px 3px rgba(15,23,42,0.05), 0 6px 18px rgba(15,23,42,0.04)',
  },
};
