import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faXmark } from '@fortawesome/free-solid-svg-icons';
import { cancelAppraisal } from '../../api/appraisal-runs.js';
import ConfirmDialog from '../../components/common/ConfirmDialog.js';
import { useToast } from '../../components/common/Toast.js';
import { bulkSummary, runEach } from './appraisalBulk.js';

// HRMS → Appraisals → several ticked: cancel them together. Asks first (it
// removes them and their scores); each is cancelled through its own request,
// so the server's rules apply to every one, and any that couldn't be are named.

interface Props {
  /** The ticked appraisals (only unfinished ones can be ticked). */
  picked: { id: string; name: string }[];
  onClear: () => void;
}

export default function BulkCancelBar({ picked, onClear }: Props) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const n = picked.length;

  const cancelAll = async () => {
    setBusy(true);
    const { done, failed } = await runEach(picked, async p => { await cancelAppraisal(p.id); return p.id; });
    setBusy(false);
    setAsking(false);
    await qc.invalidateQueries({ queryKey: ['appraisal-overview'] });
    showToast(failed.length
      ? `${bulkSummary('Cancelled', done.length, failed.length)}: ${failed.map(f => `${f.item.name} (${f.message})`).join('; ')}`
      : bulkSummary('Cancelled', done.length, 0), failed.length ? 'error' : 'success');
    onClear();
  };

  return (
    <>
      <div role="region" aria-label="Selected appraisals" style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 14px', marginTop: 12,
        background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 10, position: 'sticky', top: 8, zIndex: 2,
      }}>
        <strong style={{ fontSize: 14, color: '#0f172a' }}>{n} selected</strong>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setAsking(true)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, padding: '0 12px', borderRadius: 8,
          border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
        }}>
          <FontAwesomeIcon icon={faTrash} /> Cancel {n === 1 ? 'appraisal' : `${n} appraisals`}
        </button>
        <button type="button" onClick={onClear} aria-label="Clear selection" title="Clear selection" style={{
          width: 32, height: 32, border: 'none', borderRadius: 8, background: 'transparent', color: '#64748b', cursor: 'pointer',
        }}>
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>
      {asking && (
        <ConfirmDialog destructive title={n === 1 ? 'Cancel this appraisal?' : `Cancel ${n} appraisals?`}
          confirmLabel={n === 1 ? 'Cancel appraisal' : `Cancel ${n} appraisals`} cancelLabel="Keep them"
          message={`${picked.map(p => p.name).join(', ')} — these appraisals and any scores already given will be removed. Their schedules, if any, carry on.`}
          loading={busy} onConfirm={() => void cancelAll()} onCancel={() => setAsking(false)} />
      )}
    </>
  );
}
