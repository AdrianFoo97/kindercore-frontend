import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faScrewdriverWrench } from '@fortawesome/free-solid-svg-icons';
import { reportFacilityIssue } from '../../api/facilityIssues.js';
import { TEACHER_CONTENT_TOP } from '../../components/common/TeacherTopBar.js';
import { useToast } from '../../components/common/Toast.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import FacilityIssueFields, { TEACHER_FACILITY_THEME } from './FacilityIssueFields.js';
import { emptyFacilityDraft, facilityDraftProblem, facilityDraftToInput, sendingLabel, type FacilityDraft } from './facilityDisplay.js';

// Teacher app → Report a Facility Issue. The office follows it up at
// Operation → Facilities. "Reported by" is the signed-in teacher.

const C = { bg: '#f8fafc', textStrong: '#334155', muted: '#64748b', pAccent: '#7c3aed', pSoft: '#f5f3ff', pBorder: '#ddd6fe' };

export default function TeacherReportFacilityPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { isMobile } = useIsMobile();
  const { showToast } = useToast();
  const [draft, setDraft] = useState<FacilityDraft>(emptyFacilityDraft);
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /** Upload progress 0–1 while photos / videos are sending; null otherwise. */
  const [progress, setProgress] = useState<number | null>(null);

  const submit = async () => {
    const p = facilityDraftProblem(draft);
    setProblem(p);
    if (p || submitting) return;
    setSubmitting(true);
    try {
      await reportFacilityIssue(facilityDraftToInput(draft), draft.files, draft.files.length ? setProgress : undefined);
      qc.invalidateQueries({ queryKey: ['my-facility-issues'] });
      qc.invalidateQueries({ queryKey: ['facility-issues'] });
      showToast('Problem reported', 'success');
      // Opened from the Facilities list (or Home) — go back to where they
      // were; a cold deep link has nothing to pop, so land on the list.
      if (location.key !== 'default') navigate(-1);
      else navigate(`/teachers/${id}/facilities`, { replace: true });
    } catch (e: any) {
      showToast(e?.message ?? 'Could not send that — please try again.', 'error');
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  };

  return (
    <div style={{
      paddingTop: isMobile ? TEACHER_CONTENT_TOP : 28, paddingRight: isMobile ? 16 : 32,
      paddingBottom: 40, paddingLeft: isMobile ? 16 : 32, minHeight: '100vh',
      fontFamily: '"Nunito", "Segoe UI", Roboto, Arial, sans-serif', color: C.textStrong, background: C.bg,
    }}>
      <div style={{ maxWidth: isMobile ? 640 : 520, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 13, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: C.pSoft, color: C.pAccent, fontSize: 17, border: `1px solid ${C.pBorder}`,
          }}>
            <FontAwesomeIcon icon={faScrewdriverWrench} />
          </div>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em' }}>Report a Facility Issue</h1>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 13.5, color: C.muted, lineHeight: 1.55 }}>
          Something broken or unsafe in the centre? Tell the office. Your name is added automatically.
        </p>

        <FacilityIssueFields value={draft} onChange={d => { setDraft(d); if (problem) setProblem(null); }}
          theme={TEACHER_FACILITY_THEME} disabled={submitting} />

        {problem && <div role="alert" style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: '#b91c1c' }}>{problem}</div>}

        <button type="button" onClick={submit} disabled={submitting} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: 20, padding: 14,
          border: 'none', borderRadius: 12, background: C.pAccent, color: '#fff', fontSize: 15, fontWeight: 700,
          fontFamily: 'inherit', cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1,
        }}>
          {sendingLabel(submitting, progress)}
        </button>
      </div>
    </div>
  );
}
