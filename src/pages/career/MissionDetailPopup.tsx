import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle, faCircleCheck, faCircleInfo, faClock, faPaperPlane, faThumbtack, faXmark } from '@fortawesome/free-solid-svg-icons';
import type { MissionStatus, MissionWithProgress } from '../../api/career-missions.js';
import { useCategoryMeta } from '../../utils/missionCategoryIcons.js';
import { FOCUS_FULL_MESSAGE } from '../../utils/focusMissions.js';

// A quest's details in a centred pop-up over a blurred page — opened from the
// quest board and from Home's Current Focus, so looking at a quest never
// switches tabs.

const C = {
  text: '#475569', textSub: '#64748b', muted: '#64748b', mutedSoft: '#64748b', divider: '#eef0f3',
  primary: '#5a67d8', primarySoft: '#eef2ff',
  success: '#059669', successSoft: '#ecfdf5', successBorder: '#a7f3d0',
  warning: '#d97706', warningSoft: '#fffbeb',
  slate: '#475569', slateSoft: '#f1f5f9',
};

const STATUS_META: Record<MissionStatus, {
  label: string; bg: string; color: string; icon: any; cta: string;
}> = {
  PENDING:      { label: 'Not Started',     bg: C.slateSoft,    color: C.slate,   icon: faCircle,       cta: 'Start Mission' },
  IN_PROGRESS:  { label: 'In Progress',     bg: C.primarySoft,  color: C.primary, icon: faClock,        cta: 'Continue' },
  UNDER_REVIEW: { label: 'Awaiting Review', bg: C.warningSoft,  color: C.warning, icon: faPaperPlane,   cta: 'View' },
  COMPLETED:    { label: 'Completed',       bg: C.successSoft,  color: C.success, icon: faCircleCheck,  cta: 'View' },
};

// ── Teacher mission detail view ──────────────────────────────────────────────
// Read-only viewer for teachers — replaces the editable
// MissionDetailModal (status / evidence count / notes inputs are
// supervisor-only territory). Shows title, category, description, and
// "why this matters" — nothing the teacher can change.
//
// Always a centered popup, mobile included — a bottom-anchored sheet
// (the original shape here) pinned the description at the very bottom
// of the screen, below natural reading position; a page-per-mission
// was tried after that, but a mission is a quick look-up, not a
// destination worth its own URL/back-navigation — a centered popup is
// the right weight for it.

export default function MissionDetailPopup({
  mission, onClose, isTargeted, onToggleTarget, canPinMore = true,
}: {
  /** False once three quests are in focus — pinning another is blocked (with the reason shown). */
  canPinMore?: boolean;
  mission: MissionWithProgress;
  onClose: () => void;
  /** Undefined (not just false) in HR's read-only browse — omits the
   *  pin button entirely there instead of rendering it always-off. */
  isTargeted?: boolean;
  onToggleTarget?: () => void;
}) {
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
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, boxSizing: 'border-box' as const,
        animation: 'tmbv-fade 180ms ease',
      }}
    >
      <style>{`
        @keyframes tmbv-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes tmbv-pop-in {
          from { transform: scale(0.96); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          width: '100%', maxWidth: 480, maxHeight: '85vh',
          overflowY: 'auto' as const,
          borderRadius: 20,
          padding: '20px 20px 24px',
          boxShadow: '0 12px 40px rgba(15,23,42,0.22)',
          animation: 'tmbv-pop-in 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Top row — category pill (left) + close button (right) */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, marginBottom: 12,
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 999,
            background: cat.bg, color: cat.color,
            fontSize: 11, fontWeight: 700,
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
              fontSize: 11, fontWeight: 700,
              textTransform: 'uppercase' as const, letterSpacing: '0.06em',
            }}>
              <FontAwesomeIcon icon={sm.icon} style={{ fontSize: 9 }} />
              {sm.label}
            </span>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 44, height: 44, borderRadius: 12,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: '#f1f5f9', color: C.muted,
                border: `1px solid ${C.divider}`,
                cursor: 'pointer', flexShrink: 0,
              }}
              aria-label="Close" title="Close"
            >
              <FontAwesomeIcon icon={faXmark} style={{ fontSize: 15 }} />
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
              fontSize: 11, fontWeight: 800,
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
                fontSize: 11, fontWeight: 800,
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

        {/* Pin as Focus — the actual missing piece Home's "Active
            Quests" empty state pointed at ("Browse missions" led here,
            but nothing here could set one as your focus). Hidden
            entirely once completed — nothing left to focus on. */}
        {onToggleTarget && !isCompleted && (() => {
          const full = !isTargeted && !canPinMore;
          return (<>
          <button
            type="button"
            onClick={onToggleTarget}
            aria-pressed={isTargeted}
            disabled={full}
            aria-describedby={full ? 'focus-full-note' : undefined}
            style={{
              ...(full ? { opacity: 0.5, cursor: 'default' } : null),
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', marginTop: 16, padding: '12px', border: 'none',
              borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13.5, fontWeight: 700,
              background: isTargeted ? C.primarySoft : C.primary,
              color: isTargeted ? C.primary : '#fff',
            }}
          >
            <FontAwesomeIcon
              icon={faThumbtack}
              style={{ fontSize: 12, transform: isTargeted ? 'rotate(0deg)' : 'rotate(45deg)', transition: 'transform 200ms ease' }}
            />
            {isTargeted ? 'Remove as Focus' : 'Pin as Focus'}
          </button>
          {full && <p id="focus-full-note" style={{ margin: '8px 0 0', fontSize: 12.5, color: C.muted, textAlign: 'center' }}>{FOCUS_FULL_MESSAGE}</p>}
          </>);
        })()}
      </div>
    </div>
  );
}
