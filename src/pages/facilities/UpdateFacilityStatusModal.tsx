import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { updateFacilityIssueStatus, type FacilityIssue, type FacilityStatus } from '../../api/facilityIssues.js';
import { useToast } from '../../components/common/Toast.js';
import FormModal from '../../components/common/FormModal.js';
import { FACILITY_STATUS_LABEL } from './facilityDisplay.js';
import { STATUS_LOOK } from './facilityLook.js';

// Operation → Facilities: move an issue to In progress / Resolved / back to
// Open, with an optional note — the reporter sees the note in their app.

const ACTION_TITLE: Record<FacilityStatus, string> = {
  OPEN: 'Reopen issue',
  IN_PROGRESS: 'Mark as in progress',
  RESOLVED: 'Mark as resolved',
};
/** Short button label (a sheet's top-trailing button has little room). */
const ACTION_LABEL: Record<FacilityStatus, string> = {
  OPEN: 'Reopen',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolve',
};
const NOTE_HINT: Record<FacilityStatus, string> = {
  OPEN: 'Why is it being reopened?',
  IN_PROGRESS: 'e.g. Called the plumber — coming Friday 9am',
  RESOLVED: 'e.g. Lock replaced',
};
const NOTE_MAX = 1000;

interface Props {
  issue: FacilityIssue;
  to: FacilityStatus;
  onClose: () => void;
}

export default function UpdateFacilityStatusModal({ issue, to, onClose }: Props) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  // Moving on usually means a new update — start blank rather than repeating the old note.
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await updateFacilityIssueStatus(issue.id, { status: to, ...(note.trim() ? { note: note.trim() } : {}) });
      qc.invalidateQueries({ queryKey: ['facility-issues'] });
      qc.invalidateQueries({ queryKey: ['my-facility-issues'] });
      showToast(`Marked ${FACILITY_STATUS_LABEL[to].toLowerCase()}`);
      onClose();
    } catch (e: any) {
      showToast(e?.message ?? 'Could not update the issue', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormModal
      title={ACTION_TITLE[to]}
      subtitle={`${issue.title} · ${issue.location}`}
      onClose={onClose}
      width={460}
      dirty={!!note.trim()}
      primary={{ label: busy ? 'Saving…' : ACTION_LABEL[to], onClick: save, busy, tone: STATUS_LOOK[to].fg }}
    >
      {issue.statusNote && (
        <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 12, lineHeight: 1.5 }}>
          Last update: <span style={{ color: '#334155' }}>“{issue.statusNote}”</span>
        </div>
      )}
      <label htmlFor="fac-note" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
        Note for {issue.reportedByName} <span style={{ fontWeight: 500, color: '#64748b' }}>(optional)</span>
      </label>
      <textarea id="fac-note" autoFocus value={note} maxLength={NOTE_MAX} onChange={e => setNote(e.target.value)}
        placeholder={NOTE_HINT[to]} style={{
          width: '100%', boxSizing: 'border-box', minHeight: 90, padding: '10px 12px', borderRadius: 8, resize: 'vertical',
          border: '1px solid #e2e8f0', fontSize: 14, fontFamily: 'inherit', color: '#0f172a', outline: 'none',
        }} />
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>They’ll see this next to the status in their app.</div>
    </FormModal>
  );
}
