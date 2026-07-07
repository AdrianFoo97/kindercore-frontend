import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronRight, faShieldHalved, faCheck, faClock,
  faFlag, faCircleCheck, faTriangleExclamation,
  faRoad, faArrowRight, faBolt, faStar, faXmark, faLightbulb, faCircle,
} from '@fortawesome/free-solid-svg-icons';
import { fetchTeacherCareer, MissionWithProgress } from '../api/career-missions.js';
import { Position } from '../types/index.js';
import { uploadUrl } from '../api/upload.js';
import { useMissionTargets } from '../hooks/useMissionTargets.js';
import { AchievementStrip } from '../components/career/AchievementStrip.js';
import { useCategoryMeta } from '../utils/missionCategoryIcons.js';

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
  // Light grey page background — white surfaces float on a soft
  // slate canvas, giving each card a quiet "lift" without needing
  // a hard border or shadow. Matches the iOS Settings / native
  // mobile pattern.
  bg: '#f3f5f8',
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
        .tmcar-quick-btn:active { background: ${C.primarySoft} !important; }
        .tmcar-mission { transition: border-color 140ms ease, background 140ms ease; }
        .tmcar-mission:active { background: ${C.slateSoft} !important; }
        /* Static hero badge — no looping animation. Only a brief
           press-in on tap so the touch feedback still registers. */
        .tmcar-badge:active { transform: scale(0.97); transition: transform 120ms ease; }
      `}</style>

      <div style={s.inner}>
        {/* Career Path hero — the single screen that answers "where
            am I, where am I going, and how far". Lays out top-to-
            bottom: status row → identity → stage dots → next target
            arrow → progress block → next-action callout → CTAs. */}
        <div style={s.heroCard}>
          {/* Identity — vertically stacked & centered. Badge is a
              Link to the journey page so the most prominent visual
              becomes the primary CTA. Stage eyebrow above the rank
              name gives instant "where am I in the journey" context
              within the 5-second glance budget. Level pill uses a
              soft gradient + star icon to read as celebratory
              ("you earned this") rather than corporate ("you are
              labeled this"). */}
          <div style={{
            display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
            gap: 4, textAlign: 'center' as const,
          }}>
            <Link
              to={`/teachers/${id}/my-career/journey`}
              aria-label="Open Career Journey"
              className="tmcar-badge"
              style={{
                position: 'relative',
                width: 116, height: 116,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                textDecoration: 'none',
                borderRadius: '50%',
              }}
            >
              {/* Soft silver-tinted halo behind the badge — adds a
                  subtle "this is an earned medallion" feel without
                  applying any filter to the artwork itself. Inner
                  warm cream tint + outer cool silver create depth
                  while staying calm and professional. */}
              <div style={{
                position: 'absolute', inset: 0,
                background: `radial-gradient(circle, #ffffff 0%, #f1f5f9 55%, transparent 75%)`,
                pointerEvents: 'none',
              }} />
              <div style={{
                position: 'absolute', inset: 8,
                background: `radial-gradient(circle, ${C.primary}1f 0%, ${C.primary}0a 50%, transparent 75%)`,
                pointerEvents: 'none',
              }} />
              {currentPosition?.badgeUrl ? (
                <img
                  src={uploadUrl(currentPosition.badgeUrl)}
                  alt={currentPosition.name}
                  style={{
                    position: 'relative',
                    width: 108, height: 108, objectFit: 'contain',
                    // Crisper two-layer shadow gives the silver shield
                    // edge definition without changing its colour.
                    filter: 'drop-shadow(0 1px 1px rgba(15,23,42,0.18)) drop-shadow(0 8px 16px rgba(90,103,216,0.22))',
                  }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div style={{
                  position: 'relative',
                  width: 108, height: 108, borderRadius: 22,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `linear-gradient(135deg, ${C.primarySoft} 0%, #fff 80%)`,
                  color: C.primary,
                  border: `1px solid ${C.primaryBorder}`,
                  fontSize: 44,
                }}>
                  <FontAwesomeIcon icon={faShieldHalved} />
                </div>
              )}
            </Link>
            <div style={{
              display: 'flex', flexDirection: 'column' as const,
              alignItems: 'center', gap: 8,
            }}>
              <h1 style={{
                margin: 0, fontSize: 24, fontWeight: 800, color: C.text,
                letterSpacing: '-0.024em', lineHeight: 1.15,
              }}>
                {currentPosition?.name ?? 'Not assigned'}
              </h1>
              {/* Stats row — Level + Appraisal as two matching pills
                  side by side. Same shape and chrome so they read as
                  one stat block, not two stacked statements. Gold
                  star accents Level; green/grey accents Appraisal
                  depending on whether the threshold is met. */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, flexWrap: 'wrap' as const,
              }}>
                {teacher.level != null && currentPosition?.maxLevel != null && currentPosition.maxLevel > 0 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 12px', borderRadius: 999,
                    background: '#fff',
                    color: C.primaryDeep,
                    border: `1px solid ${C.primaryBorder}`,
                    fontSize: 11, fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                    boxShadow: `0 1px 3px ${C.primary}14`,
                  }}>
                    {/* Gold star icon — warm celebratory accent
                        against the cool primary palette. */}
                    <FontAwesomeIcon icon={faStar} style={{ fontSize: 10, color: '#f59e0b' }} />
                    Level {teacher.level}
                  </span>
                )}
                {/* Appraisal pill — identical chrome to the Level
                    pill (same bg, border, text colour, shadow) so
                    the two stats read as one balanced row. Only the
                    icon shifts: green check when met, muted dot
                    otherwise. Keeps the threshold signal without
                    breaking visual parity. */}
                {readiness.appraisal && readiness.appraisal.value != null && readiness.appraisal.required > 0 && (() => {
                  const aprValue = readiness.appraisal.value;
                  const aprMet = readiness.appraisal.met;
                  return (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '4px 12px', borderRadius: 999,
                      background: '#fff',
                      color: C.primaryDeep,
                      border: `1px solid ${C.primaryBorder}`,
                      fontSize: 11, fontWeight: 800,
                      fontVariantNumeric: 'tabular-nums' as const,
                      boxShadow: `0 1px 3px ${C.primary}14`,
                    }}>
                      <FontAwesomeIcon
                        icon={aprMet ? faCircleCheck : faCircle}
                        style={{
                          fontSize: 10,
                          color: aprMet ? C.success : C.mutedSoft,
                        }}
                      />
                      {Math.round(aprValue)}% Appraisal
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>

        </div>

        {/* Bottom tray — one continuous edge-to-edge white card
            anchored to the bottom of the page. Now hosts three
            stacked sub-sections separated by hairline dividers:
              1. Promotion progress (bar + View Career Map CTA)
              2. Skill Badges
              3. Active Quests
            The card sits below the hero badge so the progress block
            reads as "the next thing to act on" while the identity
            block above answers "where am I right now". */}
        {(missions.length > 0 || focusMissions.length === 0 || (requiredTotal > 0 && !isFinalStage && currentPosition)) && (
          <div style={s.softCard}>
            {/* Promotion progress — single continuous bar with the
                percentage as the headline. The View Career Map CTA
                sits below so the section reads as a self-contained
                "progress + next action" block at the top of the
                tray. */}
            {requiredTotal > 0 && !isFinalStage && currentPosition && (() => {
              const BADGE_THUMB = 44;
              const SEGMENT_HEIGHT = 8;
              // Vertical offset that lifts the segmented bar up to
              // the badge's horizontal centerline.
              const SEG_OFFSET_TOP = (BADGE_THUMB - SEGMENT_HEIGHT) / 2;
              // Fallback to a continuous bar when the mission count
              // is too high for chunky segments to read cleanly.
              const useSegments = requiredTotal <= 14;
              const renderThumb = (badgeUrl: string | null | undefined, alt: string, locked: boolean) => (
                <div style={{
                  width: BADGE_THUMB, height: BADGE_THUMB,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                  opacity: locked ? 0.6 : 1,
                }}>
                  {badgeUrl ? (
                    <img
                      src={uploadUrl(badgeUrl)}
                      alt={alt}
                      style={{
                        width: BADGE_THUMB, height: BADGE_THUMB, objectFit: 'contain',
                        filter: locked ? 'none' : `drop-shadow(0 3px 6px ${C.primary}22)`,
                      }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div style={{
                      width: BADGE_THUMB, height: BADGE_THUMB, borderRadius: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: C.primarySoft,
                      color: C.primary, fontSize: 18,
                      border: `1px solid ${C.primaryBorder}`,
                    }}>
                      <FontAwesomeIcon icon={faShieldHalved} />
                    </div>
                  )}
                </div>
              );
              return (
                <div style={{ marginBottom: 30 }}>
                  {/* Stepped progress — silver current badge → chunky
                      segmented bar (one block per required mission)
                      → gold next badge. Each completed mission visibly
                      fills one segment, so each tick is a satisfying
                      "step" toward the next rank. */}
                  <div style={{
                    display: 'flex', alignItems: 'flex-start',
                    gap: 10, padding: '0 2px',
                  }}>
                    {/* Current rank column — silver. Labelled with
                        a "Current Rank" eyebrow + rank name so it
                        carries parallel structure with the "Next
                        Rank / Supervisor" column on the right. The
                        bare "YOU" felt weaker than the named next
                        rank; matching structure balances them. */}
                    <div style={{
                      display: 'flex', flexDirection: 'column' as const,
                      alignItems: 'center', gap: 6, flexShrink: 0, minWidth: 64,
                    }}>
                      {renderThumb(currentPosition.badgeUrl, currentPosition.name, false)}
                      <div style={{ textAlign: 'center' as const }}>
                        <div style={{
                          fontSize: 9, fontWeight: 700, color: C.mutedSoft,
                          textTransform: 'uppercase' as const, letterSpacing: '0.08em',
                        }}>
                          Current Rank
                        </div>
                        <div style={{
                          marginTop: 2,
                          fontSize: 11, fontWeight: 800, color: C.text,
                          letterSpacing: '-0.005em', lineHeight: 1.2,
                        }}>
                          {currentPosition.name}
                        </div>
                      </div>
                    </div>

                    {/* Segmented bar — chunky blocks for ≤14 missions,
                        smooth gradient bar otherwise. Vertically
                        aligned to the badge centerline. */}
                    <div style={{
                      flex: 1, minWidth: 0,
                      marginTop: SEG_OFFSET_TOP - 18,
                    }}>
                      {/* "Promotion Progress" eyebrow above the bar
                          — muted grey, names what the bar measures. */}
                      <div style={{
                        marginBottom: 6,
                        textAlign: 'center' as const,
                        fontSize: 10, fontWeight: 700, color: C.mutedSoft,
                        textTransform: 'uppercase' as const, letterSpacing: '0.08em',
                      }}>
                        Promotion Progress
                      </div>
                      {useSegments ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          {Array.from({ length: requiredTotal }).map((_, i) => {
                            const filled = i < requiredCompleted;
                            return (
                              <div
                                key={`${requiredTotal}-${i}-${filled}`}
                                style={{
                                  flex: 1, height: SEGMENT_HEIGHT, borderRadius: 4,
                                  background: filled
                                    ? (requiredMet
                                        ? `linear-gradient(180deg, ${C.success}, #15803d)`
                                        : `linear-gradient(180deg, ${C.primary}, ${C.primaryDeep})`)
                                    : `${C.primary}1a`,
                                  boxShadow: filled
                                    ? `inset 0 1px 0 rgba(255,255,255,0.25), 0 1px 2px ${requiredMet ? C.success : C.primary}40`
                                    : 'none',
                                }}
                              />
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{
                          position: 'relative',
                          height: SEGMENT_HEIGHT, borderRadius: 999,
                          background: `${C.primary}1a`,
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            position: 'absolute', insetBlock: 0, left: 0,
                            width: `${missionPct}%`,
                            background: requiredMet
                              ? `linear-gradient(90deg, ${C.success}, #15803d)`
                              : `linear-gradient(90deg, ${C.primary}, ${C.primaryDeep})`,
                            borderRadius: 999,
                          }} />
                        </div>
                      )}
                      {/* Percentage centered below the bar */}
                      <div style={{
                        marginTop: 6,
                        textAlign: 'center' as const,
                        fontSize: 13, fontWeight: 800,
                        color: requiredMet ? C.success : C.primary,
                        fontVariantNumeric: 'tabular-nums' as const,
                        letterSpacing: '-0.012em',
                      }}>
                        {missionPct}%
                      </div>
                    </div>

                    {/* Next rank column — gold, name in primary deep.
                        "Next Rank" eyebrow + name mirrors the
                        "Current Rank" structure on the left so both
                        columns balance visually. */}
                    <div style={{
                      display: 'flex', flexDirection: 'column' as const,
                      alignItems: 'center', gap: 6, flexShrink: 0, minWidth: 64,
                    }}>
                      {renderThumb(nextPosition?.badgeUrl, nextPosition?.name ?? 'Next', false)}
                      <div style={{ textAlign: 'center' as const }}>
                        <div style={{
                          fontSize: 9, fontWeight: 700, color: C.mutedSoft,
                          textTransform: 'uppercase' as const, letterSpacing: '0.08em',
                        }}>
                          Next Rank
                        </div>
                        <div style={{
                          marginTop: 2,
                          fontSize: 11, fontWeight: 800, color: C.primaryDeep,
                          letterSpacing: '-0.005em', lineHeight: 1.2,
                        }}>
                          {nextPosition?.name ?? 'Next rank'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* View Career Map — quiet inline link below */}
                  <div style={{
                    marginTop: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Link
                      to={`/teachers/${id}/my-career/journey`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '8px 16px',
                        borderRadius: 999,
                        background: C.primarySoft,
                        color: C.primary,
                        fontSize: 12, fontWeight: 700,
                        textDecoration: 'none', whiteSpace: 'nowrap' as const,
                        border: `1px solid ${C.primaryBorder}`,
                      }}
                    >
                      <FontAwesomeIcon icon={faRoad} style={{ fontSize: 11 }} />
                      View Career Map
                      <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9 }} />
                    </Link>
                  </div>
                </div>
              );
            })()}

            {/* Divider between progress and skill badges removed —
                generous internal padding + bolder section headings
                carry the separation now. */}

            {missions.length > 0 && (() => {
              const BADGE_TEASER_LIMIT = 3;
              const totalBadges = new Set(missions.map(m => m.category)).size;
              const hasOverflow = totalBadges > BADGE_TEASER_LIMIT;
              return (
                <>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 10, marginBottom: 14,
                  }}>
                    <h3 style={{
                      margin: 0, fontSize: 18, fontWeight: 800, color: C.text,
                      letterSpacing: '-0.018em', lineHeight: 1.2,
                      minWidth: 0, flex: 1,
                    }}>
                      Skill Badges
                    </h3>
                    {hasOverflow && (
                      <Link
                        to={`/teachers/${id}/my-career/skill-badges`}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          flexShrink: 0,
                          padding: '4px 0 4px 10px',
                          fontSize: 12, fontWeight: 500, color: C.muted,
                          textDecoration: 'none', whiteSpace: 'nowrap' as const,
                        }}
                      >
                        View all
                        <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9 }} />
                      </Link>
                    )}
                  </div>
                  {/* Soft tinted tray holding the badge row — uses a
                      gentle primary-tinted gradient so the shelf
                      feels warm and inviting rather than a flat grey
                      box. Matches the rounded-card pattern used by
                      Active Quest cards. */}
                  <div style={{
                    padding: '14px 12px',
                    background: `linear-gradient(135deg, ${C.primary}14 0%, ${C.primary}08 100%)`,
                    borderRadius: 14,
                    border: `1px solid ${C.primary}22`,
                  }}>
                    <AchievementStrip
                      missions={missions}
                      compact
                      limit={BADGE_TEASER_LIMIT}
                    />
                  </div>
                </>
              );
            })()}

            <div style={{
              marginTop: missions.length > 0 ? 34 : 0,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 10, marginBottom: 14,
              }}>
                <h3 style={{
                  margin: 0, fontSize: 18, fontWeight: 800, color: C.text,
                  letterSpacing: '-0.018em', lineHeight: 1.2,
                  minWidth: 0, flex: 1,
                }}>
                  Active Quests
                </h3>
                <Link
                  to={`/teachers/${id}/career/missions`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    flexShrink: 0,
                    padding: '4px 0 4px 10px',
                    fontSize: 12, fontWeight: 500, color: C.muted,
                    textDecoration: 'none', whiteSpace: 'nowrap' as const,
                  }}
                >
                  View all missions
                  <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9 }} />
                </Link>
              </div>

              {focusMissions.length === 0 ? (
                <div style={{
                  padding: '26px 20px', textAlign: 'center' as const,
                  background: `linear-gradient(180deg, ${C.primarySoft} 0%, #ffffff 70%)`,
                  border: `1px solid ${C.cardBorder}`,
                  borderRadius: 16,
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    margin: '0 auto 12px',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: '#fff',
                    color: C.primary,
                    border: `1px solid ${C.primaryBorder}`,
                    boxShadow: `0 4px 12px ${C.primary}1f`,
                  }}>
                    <FontAwesomeIcon icon={faBolt} style={{ fontSize: 18 }} />
                  </div>
                  <div style={{
                    fontSize: 15, fontWeight: 800, color: C.text,
                    letterSpacing: '-0.01em', marginBottom: 4,
                  }}>
                    Pick your next focus
                  </div>
                  <div style={{
                    fontSize: 12, fontWeight: 500, color: C.muted,
                    lineHeight: 1.5, marginBottom: 16,
                    maxWidth: 280, margin: '0 auto 16px',
                  }}>
                    Pin a mission from the board to start growing the skills that unlock your next rank.
                  </div>
                  <Link
                    to={`/teachers/${id}/career/missions`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '10px 18px', borderRadius: 10,
                      background: C.primary, color: '#fff',
                      fontSize: 13, fontWeight: 700,
                      textDecoration: 'none',
                      boxShadow: `0 2px 8px ${C.primary}33`,
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
                      requiredTotal={requiredTotal}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Next Target unlock card removed — the Career Journey page
            (linked from the badge tap / "View career path" entry)
            shows the same unlock conditions inside the next-rank
            detail sheet, so duplicating them on the hub was noise. */}

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
// One pinned mission rendered as a soft card. Lead row is a small
// category pill (icon + skill label in category colour) so the
// teacher reads which capability this mission builds before they
// read the mission title — frames each row as "growing a skill" not
// "checking a box". Below the title: progress bar + a subtle Growth
// Point reward chip so completion feels earned, not assigned.

function FocusMissionCard({ mission, teacherId, requiredTotal }: {
  mission: MissionWithProgress;
  teacherId: string;
  /** Total required missions for the current stage — drives Growth
   *  Points so the full set sums to ≥ 100 across the promotion. */
  requiredTotal: number;
}) {
  const { getMeta } = useCategoryMeta();
  const cat = getMeta(mission.category);
  const status = mission.progress?.status ?? 'PENDING';
  const completed = status === 'COMPLETED';
  const evidenceTotal = Math.max(1, mission.progress?.evidenceTotal ?? 1);
  const rawCount = mission.progress?.evidenceCount ?? 0;
  const filled = completed ? evidenceTotal : rawCount;
  const pct = Math.max(0, Math.min(100, Math.round((filled / evidenceTotal) * 100)));

  // Mirror the Mission Board card exactly: status-driven fill colour,
  // a neutral white surface (soft grey + no shadow once completed),
  // a faint primary-tinted border + soft primary lift while active.
  const fillColor = completed ? C.success : status === 'UNDER_REVIEW' ? C.warning : C.primary;
  const fillEnd = completed ? '#15803d' : status === 'UNDER_REVIEW' ? '#b45309' : C.primaryDeep;
  const cardBg = completed ? C.slateSoft : C.card;
  const cardBorder = completed ? C.cardBorder : `${C.primary}33`;
  const cardShadow = completed ? 'none' : `0 1px 2px ${C.primary}14, 0 4px 12px ${C.primary}0a`;

  const [openSheet, setOpenSheet] = useState(false);

  return (
    <>
    <button
      type="button"
      onClick={() => setOpenSheet(true)}
      className="tmcar-mission"
      style={{
        // Same structure as the Mission Board card: horizontal —
        // left column (title + count-in-bar) and a right category
        // icon tile that stretches the full card height.
        display: 'flex', alignItems: 'stretch', gap: 14,
        width: '100%',
        textAlign: 'left' as const,
        padding: 16,
        font: 'inherit',
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        borderRadius: 14,
        boxShadow: cardShadow,
        color: 'inherit',
        cursor: 'pointer',
        transition: 'box-shadow 200ms ease, transform 200ms ease',
      }}
    >
      {/* Left column — title (top) + progress bar with the X/Y count
          rendered inside the bar (Mission Board layout). */}
      <div style={{
        flex: 1, minWidth: 0,
        display: 'flex', flexDirection: 'column' as const, gap: 12,
      }}>
        <div style={{
          fontSize: 15, fontWeight: 700, color: C.text,
          letterSpacing: '-0.008em', lineHeight: 1.3,
          display: '-webkit-box' as any,
          WebkitLineClamp: 2 as any,
          WebkitBoxOrient: 'vertical' as any,
          overflow: 'hidden',
        }}>
          {mission.title}
        </div>

        <div style={{
          position: 'relative',
          height: 16, borderRadius: 999,
          // Theme-tinted track (~10% of the fill colour) — visible
          // at 0% without reading as already filled.
          background: `${fillColor}1a`,
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', insetBlock: 0, left: 0,
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${fillColor}, ${fillEnd})`,
            borderRadius: 999,
            transition: 'width 400ms cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 600, lineHeight: 1,
            // Grey until the fill crosses halfway, then crisp white
            // with a soft shadow so the count stays legible on colour.
            color: pct >= 50 ? '#fff' : C.mutedSoft,
            fontVariantNumeric: 'tabular-nums' as const,
            letterSpacing: '0.01em',
            textShadow: pct >= 50 ? '0 1px 2px rgba(0,0,0,0.25)' : 'none',
            pointerEvents: 'none',
          }}>
            {filled}/{evidenceTotal}
          </div>
        </div>
      </div>

      {/* Right column — quiet category icon tile (soft 8% tint,
          75%-opacity icon) matching the Mission Board card. */}
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
    {openSheet && (
      <QuestDetailSheet
        mission={mission}
        requiredTotal={requiredTotal}
        onClose={() => setOpenSheet(false)}
      />
    )}
    </>
  );
}

// ─── Quest detail sheet (mobile) ─────────────────────────────────────────────
// Opens from a tap on a FocusMissionCard. Bottom-anchored sheet that
// surfaces the full mission story — description, why-it-matters, and
// progress — as a read-only "tell me more" view. No CTA: tapping the
// backdrop or close button dismisses.

function QuestDetailSheet({ mission, requiredTotal, onClose }: {
  mission: MissionWithProgress;
  requiredTotal: number;
  onClose: () => void;
}) {
  const { getMeta } = useCategoryMeta();
  const cat = getMeta(mission.category);
  const status = mission.progress?.status ?? 'PENDING';
  const completed = status === 'COMPLETED';
  const evidenceTotal = Math.max(1, mission.progress?.evidenceTotal ?? 1);
  const rawCount = mission.progress?.evidenceCount ?? 0;
  const filled = completed ? evidenceTotal : rawCount;
  const pct = Math.max(0, Math.min(100, Math.round((filled / evidenceTotal) * 100)));
  // Same formula as the card — ceil(100 / N) floored at 5 so chips
  // never read as thin at high mission counts.
  const growthPoints = requiredTotal > 0
    ? Math.max(5, Math.ceil(100 / requiredTotal))
    : 10;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15,23,42,0.45)',
        backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'tmcar-sheet-fade 180ms ease',
      }}
    >
      <style>{`
        @keyframes tmcar-sheet-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes tmcar-sheet-slide {
          from { transform: translateY(24px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          width: '100%', maxWidth: 520, maxHeight: '85vh',
          overflowY: 'auto' as const,
          borderRadius: '20px 20px 0 0',
          padding: '14px 20px 28px',
          boxShadow: '0 -8px 32px rgba(15,23,42,0.16)',
          animation: 'tmcar-sheet-slide 220ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Pull handle */}
        <div style={{
          width: 40, height: 4, borderRadius: 999,
          background: '#eceef2',
          margin: '0 auto 16px',
        }} />

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
          }}>
            <FontAwesomeIcon icon={cat.icon} style={{ fontSize: 9 }} />
            {cat.label}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {completed && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 999,
                background: C.successSoft, color: C.success,
                border: `1px solid ${C.successBorder}`,
                fontSize: 9, fontWeight: 800,
                textTransform: 'uppercase' as const, letterSpacing: '0.06em',
              }}>
                <FontAwesomeIcon icon={faCheck} style={{ fontSize: 8 }} />
                Done
              </span>
            )}
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
              <FontAwesomeIcon icon={faXmark} style={{ fontSize: 12 }} />
            </button>
          </div>
        </div>

        {/* Mission title */}
        <h2 style={{
          margin: '0 0 10px', fontSize: 20, fontWeight: 800, color: C.text,
          letterSpacing: '-0.015em', lineHeight: 1.25,
        }}>
          {mission.title}
        </h2>

        {/* Description — the "what is this quest" body copy. */}
        {mission.description && (
          <p style={{
            margin: '0 0 16px',
            fontSize: 13, fontWeight: 500, color: C.textSub,
            lineHeight: 1.55, whiteSpace: 'pre-wrap' as const,
          }}>
            {mission.description}
          </p>
        )}

        {/* Why this matters — separate card so the motivation copy
            reads as a distinct "here's why this is worth your time"
            block, not just more description text. */}
        {mission.whyItMatters && (
          <div style={{
            marginBottom: 16,
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
              <FontAwesomeIcon icon={faLightbulb} style={{ fontSize: 10 }} />
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

        {/* Progress row */}
        <div style={{
          marginBottom: 16,
          padding: '14px 14px',
          background: completed ? C.successSoft : '#f8fafc',
          border: `1px solid ${completed ? C.successBorder : C.divider}`,
          borderRadius: 12,
        }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            gap: 10, marginBottom: 8,
          }}>
            <span style={{
              fontSize: 10, fontWeight: 800,
              color: completed ? C.success : C.muted,
              textTransform: 'uppercase' as const, letterSpacing: '0.1em',
            }}>
              {completed ? 'Completed' : 'Progress'}
            </span>
            <span style={{
              fontSize: 13, fontWeight: 800, color: C.text,
              fontVariantNumeric: 'tabular-nums' as const,
            }}>
              {filled}<span style={{ color: C.mutedSoft, fontWeight: 600 }}>/{evidenceTotal}</span>
              <span style={{ marginLeft: 8, color: C.mutedSoft, fontWeight: 600 }}>·</span>
              <span style={{ marginLeft: 8, color: completed ? C.success : C.primary }}>{pct}%</span>
            </span>
          </div>
          <div style={{
            position: 'relative',
            height: 6, borderRadius: 999,
            background: '#ffffff',
            overflow: 'hidden',
            border: `1px solid ${C.divider}`,
          }}>
            <div style={{
              position: 'absolute', insetBlock: 0, left: 0,
              width: `${pct}%`,
              background: completed
                ? `linear-gradient(90deg, ${C.success}, #15803d)`
                : `linear-gradient(90deg, ${C.primary}, ${C.primaryDeep})`,
              borderRadius: 999,
            }} />
          </div>
        </div>

        {/* Reward chip — the small "what you earn" hint, repeated
            from the card so the teacher sees the prize alongside the
            full description. */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color: C.muted,
          }}>
            Growth Points earned on completion
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 10px', borderRadius: 999,
            background: C.primarySoft,
            color: C.primary,
            fontSize: 11, fontWeight: 800,
            fontVariantNumeric: 'tabular-nums' as const,
          }}>
            <FontAwesomeIcon icon={faBolt} style={{ fontSize: 10 }} />
            +{growthPoints}
          </span>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    // 18px horizontal matches native mobile gutters (iOS/Android both
    // sit around 16-20px). No bottom padding — the white "tray" card
    // flows all the way to the bottom of the viewport so the page
    // feels anchored. A very subtle radial primary tint at the top
    // frames the hero badge without adding visible chrome.
    padding: '18px 18px 0',
    background: `radial-gradient(120% 280px at 50% 0%, ${C.primary}14 0%, ${C.primary}06 40%, ${C.bg} 70%), ${C.bg}`,
    minHeight: '100vh',
    // Rounded/friendly type stack — matches the Mission Board page so
    // the teacher-facing hub reads as one app: Nunito (Google Fonts)
    // primary, then ui-rounded + system fallbacks.
    fontFamily: '"Nunito", ui-rounded, -apple-system, "SF Pro Rounded", "Avenir Next", "Segoe UI", system-ui, sans-serif',
    color: C.text,
  },
  inner: { maxWidth: 640, margin: '0 auto', position: 'relative' as const },

  // Floating back button — sits in the top-left of the page,
  // letting the hero badge dominate the page intro without a
  // breadcrumb stealing visual weight at the top.

  heroCard: {
    // Flush hero — no card chrome at all. Lives on the same white
    // page bg as the rest of the content. Tight vertical padding —
    // the centered badge halo already provides visual breathing room
    // so we don't need much extra space around the block.
    padding: '4px 0 6px',
  },
  quickBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    minHeight: 44, padding: '0 14px', borderRadius: 10,
    background: '#fff', color: C.text,
    border: `1px solid ${C.cardBorder}`,
    fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
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
  // Soft rounded white surface — used for the skill-badges tray
  // under the hero. Negative horizontal margin breaks out of the
  // page padding so the card spans edge-to-edge of the screen.
  // Only the top-left and top-right corners are rounded so the
  // card reads as a "tray" lifting up from the bottom of the page,
  // tucked against the screen edges on the sides.
  softCard: {
    marginTop: 14,
    marginLeft: -18,
    marginRight: -18,
    padding: '22px 18px 56px',
    background: '#ffffff',
    borderRadius: '20px 20px 0 0',
    boxShadow: '0 -2px 12px rgba(15,23,42,0.05)',
  },
};
