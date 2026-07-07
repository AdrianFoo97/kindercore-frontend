import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faTriangleExclamation, faLock, faCheck } from '@fortawesome/free-solid-svg-icons';
import { fetchTeacherCareer, MissionCategory } from '../api/career-missions.js';
import {
  BadgeDetailSheet,
  BadgeView,
  useBadgeViews,
} from '../components/career/AchievementStrip.js';
import { useIsMobile } from '../hooks/useIsMobile.js';

// ─────────────────────────────────────────────────────────────────────────────
// Teacher-facing Skill Badges gallery — a focused page that shows every
// capability badge as a compact medal-style tile in a flush grid. Lives
// at /teachers/:id/my-career/skill-badges; the My Career hub strip
// links here via "View all".
//
// Design intent: feel like an achievements gallery, not a dashboard.
// No big wrapping card, no horizontal carousels, no heavy chrome —
// each badge tile is the focal unit, and the grid lets the teacher
// scan their collection at a glance.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg: '#f3f5f8',
  card: '#ffffff',
  cardBorder: '#eceef2',
  divider: '#eef0f3',
  text: '#0f172a',
  textSub: '#3f4b5c',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  slateSoft: '#f1f5f9',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
  primaryBorder: '#c7d2fe',
  success: '#16a34a',
  successSoft: '#dcfce7',
  successBorder: '#bbf7d0',
};

export default function TeacherSkillBadgesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isMobile } = useIsMobile();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['teacher-career', id],
    queryFn: () => fetchTeacherCareer(id!),
    enabled: !!id,
  });

  // Tap-to-open badge detail sheet — reuses the existing
  // BadgeDetailSheet from the AchievementStrip so the gallery and
  // strip share one canonical "what is this badge" surface.
  const [openCategory, setOpenCategory] = useState<MissionCategory | null>(null);
  const badges = useBadgeViews(data?.missions ?? []);
  const openBadge = openCategory ? badges.find(b => b.category === openCategory) ?? null : null;
  const openMissions = useMemo(
    () => openCategory ? (data?.missions ?? []).filter(m => m.category === openCategory) : [],
    [openCategory, data?.missions],
  );

  // Roll-up counts used by the small stats line under the title.
  const earnedCount = badges.filter(b => b.state === 'unlocked').length;
  const totalCount = badges.length;

  return (
    <div style={s.page}>
      <style>{`
        .tsb-back-btn:hover { background: #f1f5f9 !important; color: ${C.text} !important; border-color: #cbd5e1 !important; }
        .tsb-tile { transition: transform 140ms ease, box-shadow 140ms ease; }
        .tsb-tile:active { transform: scale(0.97); }
        @keyframes tsb-shine {
          0%   { transform: translateX(-120%) skewX(-20deg); }
          60%  { transform: translateX(220%)  skewX(-20deg); }
          100% { transform: translateX(220%)  skewX(-20deg); }
        }
      `}</style>

      <div style={s.inner}>
        {/* Header row — back button + centered title. The right-side
            spacer balances the back button so the title is optically
            centered between them. */}
        <div style={s.headerRow}>
          <button
            onClick={() => navigate(`/teachers/${id}/my-career`)}
            className="tsb-back-btn"
            style={s.backBtn}
            title="Back"
          >
            <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 12 }} />
          </button>
          <h1 style={s.heading}>Skill Badges</h1>
          <div style={{ width: 36, height: 36, flexShrink: 0 }} />
        </div>

        {/* Quiet subtitle + stats line — short, never dominates. */}
        <div style={s.subheading}>
          Badges you earn by completing teaching milestones.
        </div>
        {totalCount > 0 && (
          <div style={s.statsRow}>
            <span style={{ color: C.text, fontWeight: 800 }}>{earnedCount}</span>
            <span style={{ color: C.mutedSoft, fontWeight: 600 }}> / {totalCount}</span>
            <span style={{ color: C.mutedSoft, margin: '0 6px' }}>·</span>
            <span>{earnedCount === totalCount && totalCount > 0 ? 'all unlocked' : 'unlocked'}</span>
          </div>
        )}

        {isLoading && (
          <div style={s.state}>Loading skill badges…</div>
        )}
        {isError && (
          <div style={{ ...s.state, color: '#b91c1c' }}>
            <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: 6 }} />
            Couldn't load skill badges. Please retry.
          </div>
        )}
        {data && badges.length === 0 && (
          <div style={s.state}>No missions assigned yet.</div>
        )}

        {/* Badge gallery grid — flush on the page (no wrapping card).
            3 columns on mobile, 4 on desktop. Generous tap targets,
            tight spacing so a teacher with many badges can scan
            their whole collection in one screen. */}
        {data && badges.length > 0 && (
          <div
            style={{
              ...s.grid,
              gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)',
            }}
          >
            {badges.map(b => (
              <BadgeCard
                key={b.category}
                badge={b}
                onTap={() => setOpenCategory(b.category)}
              />
            ))}
          </div>
        )}
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

// ─── BadgeCard ───────────────────────────────────────────────────────────────
// Single badge tile rendered in the gallery grid. Designed as a
// medal/crest, not a plain icon card: a rounded shield that fills
// with the category's colour when earned, shows a soft tint while
// in progress, and greys to a flat plate when locked. Label + small
// progress text sit below the medal.
//
// States the tile understands (BadgeState from AchievementStrip):
//   • unlocked    → vibrant gradient medal, ✓ stamp, one-shot shine
//   • in_progress → soft category-tinted medal, "X of Y" progress
//   • locked      → grey plate with lock overlay
//
// "NEW" pill: set when the badge was unlocked recently. We don't
// have a `lastUnlocked` timestamp on the backend yet, so the prop
// is plumbed but unused — when the API ships that field, callers
// can opt in by passing `isNew`.

export function BadgeCard({
  badge,
  onTap,
  isNew = false,
}: {
  badge: BadgeView;
  onTap?: () => void;
  isNew?: boolean;
}) {
  const { meta, total, completed, state } = badge;
  const unlocked = state === 'unlocked';
  const inProgress = state === 'in_progress';
  const locked = state === 'locked';
  const pct = total > 0 ? Math.min(1, completed / total) : 0;
  const progressDeg = pct * 360;

  // Achievement medal — a layered structure:
  //   1. Outer halo (only earned)   — radial glow behind the medal
  //   2. Outer ring   — colored rim that doubles as a progress arc
  //                     when in-progress (conic gradient sweep)
  //   3. Inner disc   — coloured emblem for the icon (gold/metal
  //                     gradient for earned, soft tint for in-prog)
  //   4. Glints       — small inset highlights for a metallic feel
  //   5. ✓ stamp      — bottom-right when earned
  //   6. Lock plate   — engraved inset for locked badges
  //
  // The whole thing reads as a collectible medal, not a flat tile.
  const medalSize = 80;
  const ringThickness = 5;
  const innerSize = medalSize - ringThickness * 2;

  // Outer ring background — solid colour for earned, conic-arc for
  // in-progress (shows partial progress around the rim), flat grey
  // for locked.
  const ringBg = unlocked
    ? `conic-gradient(from -90deg, color-mix(in srgb, ${meta.color} 75%, #fff) 0deg, ${meta.color} 180deg, color-mix(in srgb, ${meta.color} 60%, #000) 360deg)`
    : inProgress
      ? `conic-gradient(from -90deg, ${meta.color} 0deg, ${meta.color} ${progressDeg}deg, #e6eaf0 ${progressDeg}deg, #e6eaf0 360deg)`
      : 'linear-gradient(135deg, #cbd3dd, #aab3c0)';

  // Inner disc — the coloured "stamp" that holds the category icon.
  const discBg = unlocked
    ? `radial-gradient(circle at 30% 25%, color-mix(in srgb, ${meta.color} 60%, #fff) 0%, ${meta.color} 45%, color-mix(in srgb, ${meta.color} 70%, #000) 100%)`
    : inProgress
      ? `radial-gradient(circle at 30% 25%, #ffffff 0%, color-mix(in srgb, ${meta.color} 14%, #fff) 100%)`
      : `linear-gradient(160deg, #eef0f4 0%, #d8dde6 100%)`;
  const iconColor = unlocked
    ? '#fff'
    : inProgress
      ? meta.color
      : C.mutedSoft;

  return (
    <button
      type="button"
      onClick={onTap}
      className="tsb-tile"
      style={{
        position: 'relative',
        background: 'transparent',
        border: 'none',
        padding: 0,
        display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
        cursor: onTap ? 'pointer' : 'default',
        font: 'inherit',
        color: 'inherit',
      }}
    >
      {/* NEW pill — top-right of the medal. Renders only when the
          parent says this badge was recently earned. */}
      {isNew && unlocked && (
        <span style={{
          position: 'absolute', top: -4, right: 'calc(50% - 48px)',
          padding: '2px 7px', borderRadius: 999,
          background: '#f59e0b',
          color: '#fff',
          fontSize: 8, fontWeight: 800,
          textTransform: 'uppercase' as const, letterSpacing: '0.08em',
          boxShadow: '0 2px 6px rgba(245,158,11,0.4)',
          zIndex: 3,
        }}>
          New
        </span>
      )}

      {/* Medal wrapper — adds the outer halo behind earned medals. */}
      <div style={{
        position: 'relative',
        width: medalSize, height: medalSize,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Outer halo glow — only when earned. Soft radial colour
            spread that makes the badge feel like it's "shining". */}
        {unlocked && (
          <div style={{
            position: 'absolute', inset: -10,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${meta.color}44 0%, ${meta.color}14 45%, transparent 70%)`,
            pointerEvents: 'none',
          }} />
        )}

        {/* Outer ring (the medal rim) */}
        <div style={{
          position: 'relative',
          width: medalSize, height: medalSize,
          borderRadius: '50%',
          background: ringBg,
          padding: ringThickness,
          boxShadow: unlocked
            ? `0 8px 18px ${meta.color}45, 0 2px 6px ${meta.color}33, inset 0 1px 1px rgba(255,255,255,0.5)`
            : inProgress
              ? `0 4px 10px ${meta.color}22, inset 0 1px 1px rgba(255,255,255,0.4)`
              : `inset 0 2px 4px rgba(15,23,42,0.12), 0 1px 1px rgba(255,255,255,0.6)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: locked ? 0.85 : 1,
        }}>
          {/* Inner disc — the stamped emblem */}
          <div style={{
            width: innerSize, height: innerSize,
            borderRadius: '50%',
            background: discBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: iconColor,
            fontSize: 24,
            position: 'relative',
            boxShadow: unlocked
              ? `inset 0 1px 2px rgba(255,255,255,0.55), inset 0 -2px 4px ${meta.color}66, 0 1px 3px ${meta.color}55`
              : inProgress
                ? `inset 0 1px 1px rgba(255,255,255,0.6), 0 1px 2px ${meta.color}1f`
                : `inset 0 1px 2px rgba(255,255,255,0.6), inset 0 -1px 2px rgba(15,23,42,0.08)`,
            overflow: 'hidden',
          }}>
            <FontAwesomeIcon
              icon={locked ? faLock : meta.icon}
              style={{
                filter: unlocked ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))' : 'none',
              }}
            />

            {/* Glint — small specular highlight on the disc to sell
                the metallic feel for earned medals. */}
            {unlocked && (
              <span style={{
                position: 'absolute', top: 6, left: 10,
                width: 14, height: 6,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.45)',
                filter: 'blur(2px)',
                pointerEvents: 'none',
              }} />
            )}

            {/* Shine sweep — one-shot diagonal highlight on earned
                discs for an "earned" feel without continuous motion. */}
            {unlocked && (
              <span style={{
                position: 'absolute', top: 0, bottom: 0, width: '50%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
                transform: 'translateX(-120%) skewX(-20deg)',
                animation: 'tsb-shine 1400ms ease-out 200ms 1 forwards',
                pointerEvents: 'none',
              }} />
            )}
          </div>
        </div>

        {/* Earned tick stamp — small green check pinned to the
            bottom-right of an unlocked medal. */}
        {unlocked && (
          <div style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 22, height: 22, borderRadius: '50%',
            background: C.success,
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10,
            border: '2.5px solid #fff',
            boxShadow: `0 2px 5px ${C.success}66`,
            zIndex: 2,
          }}>
            <FontAwesomeIcon icon={faCheck} />
          </div>
        )}

        {/* In-progress count chip — small primary chip at the
            bottom-right showing remaining steps. */}
        {inProgress && (
          <div style={{
            position: 'absolute', bottom: -2, right: -4,
            padding: '2px 7px', borderRadius: 999,
            background: '#fff',
            color: meta.color,
            border: `2px solid #fff`,
            fontSize: 9, fontWeight: 800,
            fontVariantNumeric: 'tabular-nums' as const,
            boxShadow: `0 2px 6px ${meta.color}40, 0 0 0 1px ${meta.color}55 inset`,
            zIndex: 2,
          }}>
            {completed}/{total}
          </div>
        )}
      </div>

      {/* Label + status text */}
      <div style={{
        marginTop: 12,
        width: '100%',
        textAlign: 'center' as const,
        fontSize: 12, fontWeight: 800,
        color: locked ? C.muted : C.text,
        lineHeight: 1.25,
        letterSpacing: '-0.008em',
        display: '-webkit-box' as any,
        WebkitLineClamp: 2 as any,
        WebkitBoxOrient: 'vertical' as any,
        overflow: 'hidden',
        minHeight: 30,
      }}>
        {meta.achievementName || meta.label}
      </div>
      <div style={{
        marginTop: 3,
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 10, fontWeight: 700,
        color: unlocked ? C.success : locked ? C.mutedSoft : meta.color,
        fontVariantNumeric: 'tabular-nums' as const,
        letterSpacing: '0.02em',
        textTransform: 'uppercase' as const,
      }}>
        {unlocked ? (
          <>
            <FontAwesomeIcon icon={faCheck} style={{ fontSize: 8 }} />
            Earned
          </>
        ) : locked ? (
          <>
            <FontAwesomeIcon icon={faLock} style={{ fontSize: 8 }} />
            Locked
          </>
        ) : (
          <span style={{ fontFamily: 'inherit' }}>{completed} / {total}</span>
        )}
      </div>
    </button>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: '18px 18px 40px',
    background: C.bg, minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    color: C.text,
  },
  inner: { maxWidth: 640, margin: '0 auto' },

  headerRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, marginBottom: 4,
  },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 36, height: 36, borderRadius: 10,
    border: `1px solid ${C.cardBorder}`,
    background: C.card, color: C.muted,
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
    flexShrink: 0,
  },
  heading: {
    margin: 0, fontSize: 18, fontWeight: 800, color: C.text,
    letterSpacing: '-0.018em', lineHeight: 1.2,
  },
  subheading: {
    marginTop: 14,
    fontSize: 12, fontWeight: 500, color: C.muted,
    lineHeight: 1.45,
  },
  statsRow: {
    marginTop: 4,
    fontSize: 11, fontWeight: 600, color: C.muted,
    fontVariantNumeric: 'tabular-nums' as const,
    letterSpacing: '0.01em',
  },

  state: {
    marginTop: 18,
    background: C.card,
    border: `1px solid ${C.cardBorder}`,
    borderRadius: 14,
    padding: '24px 18px',
    textAlign: 'center',
    fontSize: 13,
    color: C.muted,
  },

  grid: {
    marginTop: 24,
    display: 'grid',
    gap: '26px 12px',
  },
};
