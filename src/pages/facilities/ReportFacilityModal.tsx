import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { reportFacilityIssue } from '../../api/facilityIssues.js';
import { useToast } from '../../components/common/Toast.js';
import FacilityIssueFields, { ADMIN_FACILITY_THEME } from './FacilityIssueFields.js';
import FormModal from '../../components/common/FormModal.js';
import { emptyFacilityDraft, facilityDraftProblem, facilityDraftToInput, sendingLabel, type FacilityDraft } from './facilityDisplay.js';

// Operation → Facilities → "Report issue" — office staff reporting from the
// admin side (teachers use their app). "Reported by" is whoever is signed in.

export default function ReportFacilityModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [draft, setDraft] = useState<FacilityDraft>(emptyFacilityDraft);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const submit = async () => {
    const p = facilityDraftProblem(draft);
    setProblem(p);
    if (p || busy) return;
    setBusy(true);
    try {
      await reportFacilityIssue(facilityDraftToInput(draft), draft.files, draft.files.length ? setProgress : undefined);
      qc.invalidateQueries({ queryKey: ['facility-issues'] });
      qc.invalidateQueries({ queryKey: ['my-facility-issues'] });
      showToast('Issue reported');
      onClose();
    } catch (e: any) {
      showToast(e?.message ?? 'Could not report that — please try again.', 'error');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <FormModal
      title="Report a facility issue"
      subtitle="Something broken or unsafe in the building. Your name is added automatically."
      onClose={onClose}
      dirty={!!(draft.title || draft.location || draft.description || draft.category || draft.files.length)}
      primary={{ label: sendingLabel(busy, progress, 'Report'), onClick: submit, busy }}
    >
      <FacilityIssueFields value={draft} onChange={d => { setDraft(d); if (problem) setProblem(null); }} theme={ADMIN_FACILITY_THEME} disabled={busy} />
      {problem && <div role="alert" style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: '#b91c1c' }}>{problem}</div>}
    </FormModal>
  );
}
