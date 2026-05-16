import { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faXmark, faCheck, faCircle } from '@fortawesome/free-solid-svg-icons';
import { MissionWithProgress, MissionCategory } from '../../api/career-missions.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { useCategoryMeta } from '../../utils/missionCategoryIcons.js';

// Skill Badges — capability identities the teacher earns by completing
// real missions, not decorative points. Shared between the HR career
// view and the teacher-facing My Career hub so both surfaces agree on
// "unlocked / in progress / locked" framing.
//
// Mobile: horizontal scroll row of compact tappable cards + bottom
// sheet detail. Desktop: wrapped grid with the same card design + a
// centered modal on tap.

const C = {
  text:      '#0f172a',
  textSub:   '#3f4b5c',
  muted:     '#64748b',
  mutedSoft: '#94a3b8',
  card:      '#ffffff',
  cardBorder:'#eceef2',
  divider:   '#eef0f3',
  slateSoft: '#f1f5f9',
};
const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };
const TRANSITION = 'all 160ms cubic-bezier(0.4, 0, 0.2, 1)';

export type BadgeState = 'unlocked' | 'in_progress' | 'locked';

// Compact mode label tightener — applied only to skill-badge cards
// rendered in the My Career hub strip, where horizontal space is
// tight. Always strips trailing fluff suffixes ("Ready", "Reliable",
// "Capable", "Skills", "Mastery") because they read as filler to a
// mobile glance; abbreviates common long words on top. Combined,
// "Parent Communication Ready" → "Parent Comms" cleanly fits one
// line in the strip card's width.
export function shortenLabel(name: string): string {
  if (!name) return name;
  // Step 1 — drop trailing fluff suffix regardless of length. These
  // words describe state, not capability, so the badge name reads
  // better without them ("Classroom Leader Ready" → "Classroom
  // Leader").
  let out = name.replace(/\s+(Ready|Reliable|Capable|Skills?|Mastery)$/i, '');
  if (out.length <= 18) return out;
  // Step 2 — abbreviate long words if still wide.
  out = out
    .replace(/\bCommunication\b/gi, 'Comms')
    .replace(/\bManagement\b/gi, 'Mgmt')
    .replace(/\bAdministration\b/gi, 'Admin')
    .replace(/\bEducation\b/gi, 'Edu');
  return out;
}

export interface BadgeView {
  category: MissionCategory;
  total: number;
  completed: number;
  state: BadgeState;
  meta: ReturnType<ReturnType<typeof useCategoryMeta>['getMeta']>;
}

// Shared hook — computes the sorted list of badge views from a
// teacher's missions. Used by the My Career strip and the dedicated
// Skill Badges gallery page. Centralises the unlocked / in-progress
// / locked tiering + sort logic so both surfaces show the same
// ordering.
export function useBadgeViews(missions: MissionWithProgress[]): BadgeView[] {
  const { categories, getMeta } = useCategoryMeta();
  return useMemo<BadgeView[]>(() => {
    const byCategory = new Map<MissionCategory, { total: number; completed: number }>();
    for (const m of missions) {
      const slot = byCategory.get(m.category) ?? { total: 0, completed: 0 };
      slot.total++;
      if (m.progress?.status === 'COMPLETED') slot.completed++;
      byCategory.set(m.category, slot);
    }
    return categories
      .filter(c => byCategory.has(c.code))
      .map<BadgeView>(c => {
        const { total, completed } = byCategory.get(c.code)!;
        const state: BadgeState =
          total > 0 && completed === total ? 'unlocked'
          : completed > 0 ? 'in_progress'
          : 'locked';
        return { category: c.code, total, completed, state, meta: getMeta(c.code) };
      })
      .sort((a, b) => {
        const tier = (s: BadgeState) => s === 'unlocked' ? 0 : s === 'in_progress' ? 1 : 2;
        const ta = tier(a.state), tb = tier(b.state);
        if (ta !== tb) return ta - tb;
        if (ta === 1) {
          const pa = a.completed / a.total, pb = b.completed / b.total;
          if (pa !== pb) return pb - pa;
        }
        return 0;
      });
  }, [missions, categories, getMeta]);
}

export function AchievementStrip({ missions, compact = false, limit }: {
  missions: MissionWithProgress[];
  /** Compact mode skips the section title/subtitle, drops the status
   *  pill from each card, and renders smaller medallions so the strip
   *  can ride inside a hero card without dominating it. */
  compact?: boolean;
  /** Cap the number of badges rendered. Useful for the My Career
   *  hub where the strip acts as a teaser and the rest live behind
   *  a "View all" toggle. Omit to show every badge. */
  limit?: number;
}) {
  const { isMobile } = useIsMobile();
  const [openCategory, setOpenCategory] = useState<MissionCategory | null>(null);
  const badges = useBadgeViews(missions);

  if (badges.length === 0) return null;

  // Cap the rendered list when a limit is set. Sort already pushes
  // unlocked → in-progress → locked, so the first N are the most
  // meaningful badges to surface as a teaser.
  const visibleBadges = limit != null ? badges.slice(0, limit) : badges;

  const openBadge = openCategory ? badges.find(b => b.category === openCategory) ?? null : null;
  const openMissions = openCategory ? missions.filter(m => m.category === openCategory) : [];

  return (
    <div>
      {!compact && (
        <div style={{ marginBottom: SP.md }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: C.muted,
            textTransform: 'uppercase' as const, letterSpacing: '0.08em',
            marginBottom: 4,
          }}>Skill Badges</div>
          <div style={{
            fontSize: 12, fontWeight: 500, color: C.mutedSoft, lineHeight: 1.45,
          }}>
            Earn badges by completing real teaching milestones.
          </div>
        </div>
      )}

      {/* Mobile = horizontal scroll, desktop = wrap grid. The negative
          horizontal margin on mobile lets cards run to the screen edge
          for a "swipeable shelf" feel while the title above stays in
          the section's padding. */}
      <div
        className="kc-skill-strip"
        style={isMobile ? {
          display: 'flex', gap: SP.sm,
          overflowX: 'auto' as const, overflowY: 'hidden' as const,
          scrollSnapType: 'x mandatory' as any,
          WebkitOverflowScrolling: 'touch' as any,
          margin: `0 -${SP.md}px`,
          padding: `4px ${SP.md}px ${SP.sm}px`,
        } : {
          display: 'flex', gap: SP.lg,
          flexWrap: 'wrap', justifyContent: 'flex-start',
        }}
      >
        <style>{`
          .kc-skill-strip::-webkit-scrollbar { display: none; }
          .kc-skill-strip { scrollbar-width: none; }
          .kc-badge-card:active { transform: scale(0.97); }
        `}</style>
        {visibleBadges.map(b => (
          <BadgeCard
            key={b.category}
            badge={b}
            onTap={() => setOpenCategory(b.category)}
            isMobile={isMobile}
            compact={compact}
          />
        ))}
      </div>

      {openBadge && (
        <BadgeDetailSheet
          badge={openBadge}
          relatedMissions={openMissions}
          onClose={() => setOpenCategory(null)}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}

// ── Badge card ───────────────────────────────────────────────────────────────
// Compact tappable tile. Three visual states keep status legible
// without dense text inside the card itself.

function BadgeCard({ badge, onTap, isMobile, compact = false }: {
  badge: BadgeView;
  onTap: () => void;
  isMobile: boolean;
  compact?: boolean;
}) {
  const { meta, total, completed, state } = badge;
  const cardWidth = compact ? (isMobile ? 104 : 116) : (isMobile ? 130 : 144);
  const iconSize = compact ? (isMobile ? 48 : 56) : (isMobile ? 56 : 64);
  const pct = total > 0 ? completed / total : 0;
  const ringDeg = Math.max(0.001, pct * 360);

  // State-driven visuals
  const isUnlocked = state === 'unlocked';
  const isLocked   = state === 'locked';
  const isInProgress = state === 'in_progress';

  const ringFill = isUnlocked
    ? meta.color
    : isInProgress
      ? `conic-gradient(${meta.color} 0deg ${ringDeg}deg, ${C.cardBorder} ${ringDeg}deg 360deg)`
      : C.cardBorder;
  const innerBg = isUnlocked
    ? `radial-gradient(circle at 30% 28%, color-mix(in srgb, ${meta.color} 22%, #fff) 0%, color-mix(in srgb, ${meta.color} 10%, #fff) 100%)`
    : isInProgress
      ? `color-mix(in srgb, ${meta.color} 12%, #fff)`
      : '#fff';
  const iconColor = isUnlocked || isInProgress ? meta.color : C.mutedSoft;
  const cardShadow = isUnlocked
    ? `0 4px 14px ${meta.color}33, 0 1px 2px rgba(15,23,42,0.04)`
    : isInProgress
      ? `0 2px 8px ${meta.color}1f, 0 1px 2px rgba(15,23,42,0.03)`
      : '0 1px 2px rgba(15,23,42,0.03)';

  const statusLabel = isUnlocked
    ? 'Unlocked'
    : isInProgress
      ? 'In Progress'
      : 'Locked';
  const statusColor = isUnlocked
    ? meta.color
    : isInProgress
      ? meta.color
      : C.mutedSoft;
  const statusBg = isUnlocked
    ? `color-mix(in srgb, ${meta.color} 12%, #fff)`
    : isInProgress
      ? `color-mix(in srgb, ${meta.color} 8%, #fff)`
      : C.slateSoft;

  return (
    <button
      type="button"
      onClick={onTap}
      className="kc-badge-card"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        flexShrink: 0,
        width: cardWidth,
        scrollSnapAlign: 'start' as any,
        // Compact mode drops the card chrome (border/background/
        // shadow) so the medallions sit flat on the hero card's
        // surface. Full mode keeps the framed card for the
        // standalone Skill Badges section.
        padding: compact ? '6px 4px' : '14px 10px 12px',
        background: compact ? 'transparent' : C.card,
        border: compact
          ? 'none'
          : `1px solid ${isUnlocked
              ? `color-mix(in srgb, ${meta.color} 30%, ${C.cardBorder})`
              : C.cardBorder}`,
        borderRadius: compact ? 0 : 14,
        boxShadow: compact ? 'none' : cardShadow,
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'center' as const,
        opacity: isLocked ? 0.78 : 1,
        transition: TRANSITION,
      }}
    >
      {/* Icon medallion */}
      <div style={{
        position: 'relative',
        width: iconSize, height: iconSize, borderRadius: '50%',
        background: ringFill,
        padding: 3, boxSizing: 'border-box',
        marginBottom: SP.sm,
        boxShadow: isUnlocked ? 'inset 0 0 0 1px rgba(255,255,255,0.4)' : 'none',
      }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: innerBg,
          color: iconColor,
          fontSize: isMobile ? 18 : 22,
          filter: isLocked ? 'grayscale(0.4)' : undefined,
        }}>
          <FontAwesomeIcon icon={meta.icon} />
        </div>
        {/* Mastered = star pip; Locked = lock pip */}
        {isUnlocked && (
          <span style={{
            position: 'absolute', top: -3, right: -3,
            width: 20, height: 20, borderRadius: '50%',
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700,
            border: '2px solid #fff',
            boxShadow: '0 2px 4px rgba(245,158,11,0.35)',
          }}>★</span>
        )}
        {isLocked && (
          <span style={{
            position: 'absolute', top: -3, right: -3,
            width: 20, height: 20, borderRadius: '50%',
            background: '#fff',
            color: C.mutedSoft,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9,
            border: `1px solid ${C.cardBorder}`,
            boxShadow: '0 1px 2px rgba(15,23,42,0.06)',
          }}>
            <FontAwesomeIcon icon={faLock} />
          </span>
        )}
      </div>

      {/* Identity — fixed min-height so 2-line and 3-line names land
          on the same baseline across the strip. In compact mode the
          name is clamped to 2 lines + ellipsis so long titles
          ("Parent Communication Ready") don't break the row's
          visual rhythm. */}
      <div style={{
        fontSize: compact ? 11 : 12, fontWeight: 700,
        color: isLocked ? C.muted : C.text,
        lineHeight: 1.3,
        letterSpacing: '-0.005em',
        minHeight: compact ? 30 : 32,
        textAlign: 'center' as const,
        display: '-webkit-box' as any,
        WebkitLineClamp: 2 as any,
        WebkitBoxOrient: 'vertical' as any,
        overflow: 'hidden',
        wordBreak: 'normal' as const,
      }}>
        {compact ? shortenLabel(meta.achievementName) : meta.achievementName}
      </div>

      {/* Status pill — colour-coded. Hidden in compact mode where the
          conic ring around the medallion already carries the state. */}
      {!compact && (
        <span style={{
          marginTop: 6,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 999,
          background: statusBg, color: statusColor,
          fontSize: 10, fontWeight: 800,
          textTransform: 'uppercase' as const, letterSpacing: '0.05em',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {statusLabel}
          {isInProgress && (
            <>
              <span aria-hidden style={{ opacity: 0.5 }}>·</span>
              <span>{completed}/{total}</span>
            </>
          )}
        </span>
      )}
    </button>
  );
}

// ── Detail sheet ─────────────────────────────────────────────────────────────
// Mobile = bottom sheet anchored to bottom edge with rounded top.
// Desktop = centered modal. Same content: name, status, progress,
// requirement, why-it-matters, and the list of related missions with
// completion ticks.

export function BadgeDetailSheet({ badge, relatedMissions, onClose, isMobile }: {
  badge: BadgeView;
  relatedMissions: MissionWithProgress[];
  onClose: () => void;
  isMobile: boolean;
}) {
  const { meta, total, completed, state } = badge;
  const isUnlocked = state === 'unlocked';
  const isLocked = state === 'locked';
  const isInProgress = state === 'in_progress';
  const remaining = total - completed;
  const statusLabel = isUnlocked ? 'Unlocked' : isInProgress ? 'In Progress' : 'Locked';
  const statusColor = isLocked ? C.muted : meta.color;
  const statusBg = isLocked ? C.slateSoft : `color-mix(in srgb, ${meta.color} 12%, #fff)`;

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
        padding: isMobile ? 0 : 16,
        animation: 'kc-sheet-fade 180ms ease',
      }}
    >
      <style>{`
        @keyframes kc-sheet-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes kc-sheet-slide {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.card,
          width: '100%',
          maxWidth: isMobile ? '100%' : 460,
          maxHeight: isMobile ? '85vh' : '90vh',
          overflowY: 'auto' as const,
          borderRadius: isMobile ? '20px 20px 0 0' : 18,
          padding: isMobile ? '16px 18px 24px' : '22px 24px',
          boxShadow: '0 -8px 32px rgba(15,23,42,0.16)',
          animation: 'kc-sheet-slide 220ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Mobile pull handle */}
        {isMobile && (
          <div style={{
            width: 40, height: 4, borderRadius: 999,
            background: C.cardBorder,
            margin: '0 auto 14px',
          }} />
        )}

        {/* Header — icon + name + close */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 14,
          marginBottom: 16,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isLocked ? C.slateSoft : `color-mix(in srgb, ${meta.color} 14%, #fff)`,
            color: isLocked ? C.mutedSoft : meta.color,
            fontSize: 22,
            flexShrink: 0,
            boxShadow: isUnlocked
              ? `0 4px 14px ${meta.color}33`
              : isInProgress
                ? `0 2px 8px ${meta.color}1f`
                : 'none',
          }}>
            <FontAwesomeIcon icon={isLocked ? faLock : meta.icon} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 10, fontWeight: 800, color: C.muted,
              textTransform: 'uppercase' as const, letterSpacing: '0.08em',
              marginBottom: 2,
            }}>
              Skill Badge
            </div>
            <h2 style={{
              margin: 0, fontSize: 18, fontWeight: 800, color: C.text,
              letterSpacing: '-0.012em', lineHeight: 1.2,
            }}>
              {meta.achievementName}
            </h2>
            <span style={{
              marginTop: 6,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '3px 10px', borderRadius: 999,
              background: statusBg, color: statusColor,
              fontSize: 10, fontWeight: 800,
              textTransform: 'uppercase' as const, letterSpacing: '0.06em',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {statusLabel}
              {isInProgress && (
                <>
                  <span aria-hidden style={{ opacity: 0.5 }}>·</span>
                  <span>{completed}/{total}</span>
                </>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: C.slateSoft, color: C.muted,
              border: `1px solid ${C.cardBorder}`,
              cursor: 'pointer',
              flexShrink: 0,
            }}
            aria-label="Close"
          >
            <FontAwesomeIcon icon={faXmark} style={{ fontSize: 12 }} />
          </button>
        </div>

        {/* Progress bar (only when not locked) */}
        {!isLocked && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              position: 'relative',
              height: 8, borderRadius: 999,
              background: C.slateSoft,
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', insetBlock: 0, left: 0,
                width: `${total > 0 ? (completed / total) * 100 : 0}%`,
                background: meta.color,
                borderRadius: 999,
                transition: 'width 500ms cubic-bezier(0.4, 0, 0.2, 1)',
              }} />
            </div>
            <div style={{
              marginTop: 8,
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              fontSize: 12, fontWeight: 600, color: C.muted,
              fontVariantNumeric: 'tabular-nums',
            }}>
              <span><span style={{ color: C.text, fontWeight: 800 }}>{completed}</span> of {total} completed</span>
              {isInProgress && remaining > 0 && (
                <span>{remaining} to unlock</span>
              )}
              {isUnlocked && (
                <span style={{ color: meta.color, fontWeight: 800 }}>Mastered ★</span>
              )}
            </div>
          </div>
        )}

        {/* Requirement */}
        <DetailSection title="Requirement">
          {isUnlocked
            ? `All ${total} ${meta.label.toLowerCase()} missions complete.`
            : `Complete ${total} ${meta.label.toLowerCase()} mission${total === 1 ? '' : 's'} to unlock this badge.`}
        </DetailSection>

        {/* Why it matters */}
        {meta.description && (
          <DetailSection title="Why it matters">
            {meta.description}
          </DetailSection>
        )}

        {/* Related missions */}
        {relatedMissions.length > 0 && (
          <DetailSection title={`Related Missions (${relatedMissions.length})`}>
            <ul style={{
              margin: '4px 0 0', padding: 0, listStyle: 'none',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              {relatedMissions.map(m => {
                const done = m.progress?.status === 'COMPLETED';
                return (
                  <li key={m.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '8px 10px',
                    background: done
                      ? `color-mix(in srgb, ${meta.color} 6%, #fff)`
                      : C.slateSoft,
                    border: `1px solid ${done
                      ? `color-mix(in srgb, ${meta.color} 22%, ${C.cardBorder})`
                      : C.cardBorder}`,
                    borderRadius: 10,
                  }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: '50%',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      background: done ? meta.color : '#fff',
                      color: done ? '#fff' : C.mutedSoft,
                      border: `1px solid ${done ? meta.color : C.cardBorder}`,
                      fontSize: 8,
                      flexShrink: 0,
                      marginTop: 1,
                    }}>
                      <FontAwesomeIcon icon={done ? faCheck : faCircle} />
                    </span>
                    <span style={{
                      fontSize: 13, fontWeight: 600,
                      color: done ? C.text : C.textSub,
                      lineHeight: 1.4,
                      textDecoration: done ? 'line-through' : undefined,
                      textDecorationColor: done ? C.mutedSoft : undefined,
                    }}>
                      {m.title}
                    </span>
                  </li>
                );
              })}
            </ul>
          </DetailSection>
        )}
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 10, fontWeight: 800, color: C.muted,
        textTransform: 'uppercase' as const, letterSpacing: '0.08em',
        marginBottom: 6,
      }}>
        {title}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 500, color: C.textSub,
        lineHeight: 1.55, letterSpacing: '-0.003em',
      }}>
        {children}
      </div>
    </div>
  );
}
