import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFaceAngry, faFaceFrown, faFaceMeh, faFaceSmile } from '@fortawesome/free-solid-svg-icons';
import { PARENT_REACTION_LABEL, ParentReaction } from '../../api/incidents.js';

// How a parent took an incident — one look everywhere it shows (the
// incident page, the Incidents list, the teacher's own reports), so a
// worsening trend reads the same wherever you spot it.

export const PARENT_REACTION_LOOK: Record<ParentReaction, { fg: string; bg: string; border: string; icon: typeof faFaceSmile }> = {
  SATISFIED: { fg: '#047857', bg: '#ecfdf5', border: '#a7f3d0', icon: faFaceSmile },
  NEUTRAL: { fg: '#475569', bg: '#f1f5f9', border: '#e2e8f0', icon: faFaceMeh },
  CONCERNED: { fg: '#b45309', bg: '#fffbeb', border: '#fde68a', icon: faFaceFrown },
  UPSET: { fg: '#b91c1c', bg: '#fef2f2', border: '#fecaca', icon: faFaceAngry },
};

export default function ParentReactionPill({ reaction }: { reaction: ParentReaction }) {
  const l = PARENT_REACTION_LOOK[reaction];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 999, fontSize: 11.5,
      fontWeight: 700, whiteSpace: 'nowrap', color: l.fg, background: l.bg, border: `1px solid ${l.border}`,
    }}>
      <FontAwesomeIcon icon={l.icon} style={{ fontSize: 11 }} />{PARENT_REACTION_LABEL[reaction]}
    </span>
  );
}
