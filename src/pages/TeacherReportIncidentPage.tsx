import { useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { createIncident } from '../api/incidents.js';
import IncidentFormFields, {
  TEACHER_INCIDENT_THEME, emptyIncidentDraft, incidentDraftProblem, incidentDraftToInput, IncidentDraft,
} from '../components/incidents/IncidentFormFields.js';
import { TEACHER_CONTENT_TOP } from '../components/common/TeacherTopBar.js';
import { useToast } from '../components/common/Toast.js';

// Teacher app → Report an Incident. Replaces the Google Form; the office
// follows reports up at Operation → Incidents. "Reported by" is the
// signed-in teacher — never typed in.

const C = {
  bg: '#f8fafc', textStrong: '#334155', muted: '#64748b',
  pAccent: '#7c3aed', pSoft: '#f5f3ff', pBorder: '#ddd6fe',
};

export default function TeacherReportIncidentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { isMobile } = useIsMobile();
  const { showToast } = useToast();
  const [draft, setDraft] = useState<IncidentDraft>(emptyIncidentDraft);
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async () => {
    const p = incidentDraftProblem(draft);
    setProblem(p);
    if (p || submitting) return;
    setSubmitting(true);
    try {
      await createIncident(incidentDraftToInput(draft));
      qc.invalidateQueries({ queryKey: ['my-incidents'] });
      qc.invalidateQueries({ queryKey: ['incidents'] });
      showToast('Incident reported', 'success');
      // This form is opened from My Incident Reports, which is right behind
      // it — go back to it (a forward push/replace would leave a second
      // copy of that list in history, so Back from it would seem stuck).
      // A cold deep link has nothing to pop, so replace with the list.
      if (location.key !== 'default') navigate(-1);
      else navigate(`/teachers/${id}/incidents`, { replace: true });
    } catch (e: any) {
      showToast(e?.message ?? 'Could not send that — please try again.', 'error');
    } finally {
      setSubmitting(false);
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
            <FontAwesomeIcon icon={faTriangleExclamation} />
          </div>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em' }}>Report an Incident</h1>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 13.5, color: C.muted, lineHeight: 1.55 }}>
          Write down what happened while it’s fresh. Your name is added automatically.
        </p>

        <IncidentFormFields value={draft} onChange={d => { setDraft(d); if (problem) setProblem(null); }}
          theme={TEACHER_INCIDENT_THEME} disabled={submitting} />

        {problem && (
          <div role="alert" style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: '#b91c1c' }}>{problem}</div>
        )}

        <button type="button" onClick={submit} disabled={submitting} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: 20, padding: 14,
          border: 'none', borderRadius: 12, background: C.pAccent, color: '#fff', fontSize: 15, fontWeight: 700,
          fontFamily: 'inherit', cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1,
        }}>
          {submitting ? 'Sending…' : 'Submit Report'}
        </button>
      </div>
    </div>
  );
}
