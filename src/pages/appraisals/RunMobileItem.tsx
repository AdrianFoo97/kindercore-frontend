import { useState, type ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComment } from '@fortawesome/free-solid-svg-icons';
import InfoSheetButton from './InfoSheetButton.js';
import type { RunPalette } from './runTheme.js';

interface Props {
  /** "1. Open the gate" — the item's name (with its number, if any). */
  name: string;
  /** What it means (an SOP step's detail, a rubric) — shown from the info icon. */
  description?: string | null;
  /** A small line under the name, e.g. "25% of Care". */
  sub?: string | null;
  score: ReactNode;
  /** The comment box — shown from the comment icon (always, once it has text). */
  comment: ReactNode;
  /** It already has a comment: the box stays open and the icon is filled in. */
  hasComment: boolean;
  /** Read-only: no comment icon (the comment, if any, shows as text). */
  readOnly: boolean;
  palette: RunPalette;
}

const TAP = 44;

/**
 * One item to mark, on a phone: its name with an "i" (its description, in a pop-up) and a
 * comment icon (the comment box) beside it, then the marks — so a long list stays
 * short. Nothing written is ever hidden: an item with a comment shows its box.
 */
export default function RunMobileItem({ name, description, sub, score, comment, hasComment, readOnly, palette: p }: Props) {
  const [showComment, setShowComment] = useState(false);
  const commentOpen = hasComment || showComment;
  const iconBtn = (on: boolean): React.CSSProperties => ({
    width: TAP, height: TAP, flexShrink: 0, margin: '-10px -6px -10px 0', border: 'none', background: 'none', borderRadius: 8,
    color: on ? p.accent : p.muted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  });
  return (
    <div style={{ padding: '10px 16px', display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* The "i" sits right beside the name; the comment icon at the far end. */}
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: p.sub }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%' }}>
            <span style={{ minWidth: 0 }}>{name}</span>
            {description && <InfoSheetButton title={name} label={`What “${name}” means`} palette={p}>{description}</InfoSheetButton>}
          </span>
          {sub && <span style={{ display: 'block', fontSize: 12, fontWeight: 400, color: p.muted, marginTop: 2 }}>{sub}</span>}
        </span>
        {!readOnly && (
          <button type="button" onClick={() => setShowComment(v => !v)} disabled={hasComment} aria-expanded={commentOpen}
            aria-label={hasComment ? `${name} has a comment` : `Add a comment on ${name}`} title={hasComment ? 'Has a comment' : 'Add a comment'}
            style={{ ...iconBtn(commentOpen), cursor: hasComment ? 'default' : 'pointer' }}>
            <FontAwesomeIcon icon={faComment} />
          </button>
        )}
      </div>
      {score}
      {(readOnly ? hasComment : commentOpen) && comment}
    </div>
  );
}
