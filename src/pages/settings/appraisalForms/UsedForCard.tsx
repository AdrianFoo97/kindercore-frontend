import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setAppraisalTemplatePositions } from '../../../api/appraisal-templates.js';
import { useToast } from '../../../components/common/Toast.js';
import type { Position } from '../../../types/index.js';
import PositionChips from './PositionChips.js';
import { C, btn, card, cardHint, cardTitle } from './formTheme.js';

interface Props {
  familyId: string;
  positionIds: string[];
  positions: Position[];
  readOnly: boolean;
}

/**
 * Which positions are appraised with this form. Set for the form as a whole
 * (every version), and saved on its own — it doesn't wait for the draft.
 */
export default function UsedForCard({ familyId, positionIds, positions, readOnly }: Props) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [selected, setSelected] = useState(positionIds);
  const [error, setError] = useState('');
  useEffect(() => setSelected(positionIds), [positionIds]);

  const changed = [...selected].sort().join() !== [...positionIds].sort().join();
  const save = useMutation({
    mutationFn: () => setAppraisalTemplatePositions(familyId, selected),
    onSuccess: () => {
      setError('');
      qc.invalidateQueries({ queryKey: ['appraisal-templates'] });
      qc.invalidateQueries({ queryKey: ['appraisal-template'] });
      showToast('Positions saved');
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <section style={card} aria-labelledby="af-used">
      <h2 id="af-used" style={cardTitle}>Used for</h2>
      <p style={cardHint}>Staff in these positions are appraised with this form. Each position uses one form at a time.</p>
      <PositionChips positions={positions} selected={selected} ariaLabel="Positions that use this form"
        onChange={readOnly ? undefined : ids => { setSelected(ids); setError(''); }} emptyText="No positions yet" />
      {error && <p role="alert" style={{ fontSize: 13, color: C.red, margin: '8px 0 0' }}>{error}</p>}
      {!readOnly && changed && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="button" style={btn('primary', false, save.isPending)} disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save positions'}
          </button>
          <button type="button" style={btn('secondary')} onClick={() => { setSelected(positionIds); setError(''); }}>Undo</button>
        </div>
      )}
    </section>
  );
}
