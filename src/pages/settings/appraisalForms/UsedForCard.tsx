import type { Position } from '../../../types/index.js';
import PositionChips from './PositionChips.js';
import { C, label } from './formTheme.js';

interface Props {
  positions: Position[];
  selected: string[];
  /** Omit for read-only. */
  onChange?: (positionIds: string[]) => void;
  /** A line under the chips — e.g. "Saved" on a live form, or why it wasn't. */
  status?: string;
  error?: boolean;
  /** Not required (a scoring form) — says "(optional)". */
  optional?: boolean;
  /** Replaces the line under the label. */
  hint?: string;
}

/**
 * "Who it's for", inside Basics: which positions this form is meant for — offered first when scheduling them
 * (set for the form as a whole — every version). Required to go live. The page
 * decides when it's saved: with "Save draft" on a draft, straight away on a live form.
 */
export default function UsedForField({ positions, selected, onChange, status, error = false, optional = false, hint }: Props) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={label} id="af-used">Who it’s for {optional && <span style={{ fontWeight: 400, color: C.muted }}>(optional)</span>}</div>
      <p style={{ margin: '0 0 8px', fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
        {hint ?? 'When scheduling appraisals, staff in these positions are offered this form first. Each position has one such form.'}
      </p>
      <PositionChips positions={positions} selected={selected} ariaLabel="Positions that use this form"
        onChange={onChange} emptyText="No positions yet" />
      {status && (
        <p role={error ? 'alert' : 'status'} style={{ fontSize: 13, margin: '8px 0 0', color: error ? C.red : C.muted }}>{status}</p>
      )}
    </div>
  );
}
