import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faRotateLeft, faArrowUp, faArrowDown } from '@fortawesome/free-solid-svg-icons';
import { C, SHADOW, MOTION, fmtRMCompact } from './shared.js';

interface StickySaveBarProps {
  visible: boolean;
  changedCount: number;
  deltaTotal: number;      // net change in RM from original values
  isSaving: boolean;
  onDiscard: () => void;
  onSave: () => void;
}

export function StickySaveBar({
  visible, changedCount, deltaTotal, isSaving, onDiscard, onSave,
}: StickySaveBarProps) {
  const deltaIsPositive = deltaTotal > 0;
  const deltaIsNegative = deltaTotal < 0;
  const deltaColor = deltaIsPositive ? C.green : deltaIsNegative ? C.red : C.muted;
  const deltaBg = deltaIsPositive ? C.greenLight : deltaIsNegative ? C.redLight : C.hover;

  return (
    <div
      role="region"
      aria-label="Unsaved changes"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: C.card,
        borderTop: `1px solid ${C.border}`,
        boxShadow: SHADOW.stickyBar,
        padding: '16px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        zIndex: 50,
        transform: visible ? 'translateY(0)' : 'translateY(110%)',
        transition: `transform ${MOTION.panel}`,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {/* Left: count badge + label + delta chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 32,
          height: 32,
          padding: '0 10px',
          borderRadius: 999,
          background: C.primary,
          color: '#fff',
          fontSize: 13,
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          boxShadow: SHADOW.buttonPrimary,
        }}>{changedCount}</span>

        <div>
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            color: C.textStrong,
            lineHeight: 1.2,
            letterSpacing: '-0.01em',
          }}>
            {changedCount === 1 ? 'Unsaved change' : 'Unsaved changes'}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            Your changes are not yet saved
          </div>
        </div>

        {deltaTotal !== 0 && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 10px',
            marginLeft: 4,
            background: deltaBg,
            color: deltaColor,
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}>
            <FontAwesomeIcon
              icon={deltaIsPositive ? faArrowUp : faArrowDown}
              style={{ fontSize: 9 }}
            />
            {fmtRMCompact(Math.abs(deltaTotal))}
          </span>
        )}
      </div>

      {/* Right: discard + save */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          type="button"
          onClick={onDiscard}
          disabled={isSaving}
          className="occ-discard-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '10px 16px',
            background: C.card,
            color: C.textSub,
            border: `1px solid ${C.border}`,
            borderRadius: 9,
            fontSize: 13,
            fontWeight: 600,
            cursor: isSaving ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            transition: `background ${MOTION.fast}, border-color ${MOTION.fast}`,
          }}
        >
          <FontAwesomeIcon icon={faRotateLeft} style={{ fontSize: 11 }} />
          Discard
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="occ-save-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 22px',
            background: isSaving ? C.primaryHover : C.primary,
            color: '#fff',
            border: 'none',
            borderRadius: 9,
            fontSize: 13,
            fontWeight: 700,
            cursor: isSaving ? 'wait' : 'pointer',
            fontFamily: 'inherit',
            boxShadow: SHADOW.buttonPrimary,
            transition: `background ${MOTION.fast}, transform ${MOTION.fast}`,
            letterSpacing: '-0.005em',
          }}
        >
          <FontAwesomeIcon icon={faCheck} style={{ fontSize: 11 }} />
          {isSaving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
