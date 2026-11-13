import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { createIncident, fetchIncidents, updateIncident, IncidentReport } from '../api/incidents.js';
import IncidentFormFields, {
  ADMIN_INCIDENT_THEME, emptyIncidentDraft, incidentDraftProblem, incidentDraftToInput, IncidentDraft,
} from '../components/incidents/IncidentFormFields.js';
import { useToast } from '../components/common/Toast.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { useGoBack } from '../hooks/useGoBack.js';

// Operation → Incidents: filing a report (/operations/incidents/new — office
// staff; teachers use the mobile app's own page) and correcting one
// (/operations/incidents/:id/edit — incident managers; the server logs the
// change). Same questions as the teacher form via IncidentFormFields. After
// saving, on to that report's page.

const C = {
  bg: '#f8fafc', card: '#ffffff', border: '#e2e8f0', divider: '#f1f5f9',
  text: '#0f172a', textSub: '#334155', muted: '#64748b', primary: '#5a67d8',
};

const toDraft = (r: IncidentReport): IncidentDraft => ({
  incidentDate: r.incidentDate, incidentTime: r.incidentTime, location: r.location,
  description: r.description, actionsTaken: r.actionsTaken, otherChildren: r.otherChildren ?? '',
  studentIds: r.students.map(s => s.studentId),
  studentNames: Object.fromEntries(r.students.map(s => [s.studentId, s.childName])),
});

export default function IncidentFormPage() {
  const { id } = useParams<{ id?: string }>();
  const { isMobile } = useIsMobile();
  // Editing: load the report from the same list (and cache) the Incidents page uses.
  const { data: reports, isLoading } = useQuery({ queryKey: ['incidents'], queryFn: fetchIncidents, enabled: !!id });
  const existing = id ? reports?.find(r => r.id === id) ?? null : null;
  // Back / Cancel really go back (to the report or the list, as they were);
  // a cold deep link falls back to the report, or the list for a new one.
  const goBack = useGoBack(id ? `/operations/incidents/${id}` : '/operations/incidents');

  return (
    <div style={{
      padding: isMobile ? '14px 16px 32px' : '16px 32px 40px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      background: C.bg, minHeight: '100%', color: C.text,
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <button type="button" className="back-btn" onClick={goBack} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 10,
          background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 11 }} /> Back
        </button>
        <h1 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center' }}>
          <FontAwesomeIcon icon={faTriangleExclamation} style={{ color: C.primary, fontSize: 16, marginRight: 8 }} />
          {id ? 'Edit incident details' : 'Report an incident'}
        </h1>
        <p style={{ margin: '0 0 14px', fontSize: 12.5, color: C.muted }}>
          {id
            ? 'Correct what was reported. The change is recorded in the report’s follow-up log.'
            : 'Write down what happened while it’s fresh. Your name is added as the reporter automatically.'}
        </p>

        {id && isLoading ? (
          <div style={st.empty}>Loading the report…</div>
        ) : id && !existing ? (
          <div style={st.empty}>This report doesn’t exist, or you can’t edit it.</div>
        ) : (
          // Keyed so the form starts from the report once it has loaded.
          <IncidentForm key={existing?.id ?? 'new'} existing={existing} onCancel={goBack} />
        )}
      </div>
    </div>
  );
}

function IncidentForm({ existing, onCancel }: { existing: IncidentReport | null; onCancel: () => void }) {
  const navigate = useNavigate();
  // Opened with "Edit" on the report page → that page is right behind this
  // one, so saving goes back to it rather than stacking a second copy.
  const fromReport = !!(useLocation().state as { fromReport?: boolean } | null)?.fromReport;
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [draft, setDraft] = useState<IncidentDraft>(() => (existing ? toDraft(existing) : emptyIncidentDraft()));
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async () => {
    const p = incidentDraftProblem(draft);
    setProblem(p);
    if (p || saving) return;
    setSaving(true);
    try {
      const saved = existing
        ? await updateIncident(existing.id, incidentDraftToInput(draft))
        : await createIncident(incidentDraftToInput(draft));
      qc.invalidateQueries({ queryKey: ['incidents'] });
      qc.invalidateQueries({ queryKey: ['my-incidents'] });
      showToast(existing ? 'Details updated' : 'Incident reported');
      // Back to the report if we came from it; otherwise this form's history
      // entry becomes the report (list → report, so its Back returns to the list).
      if (existing && fromReport) navigate(-1);
      else navigate(`/operations/incidents/${saved.id}`, { replace: true });
    } catch (e: any) {
      showToast(e?.message ?? 'Could not save the report', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12 }}>
      <div style={{ padding: 20 }}>
        <IncidentFormFields value={draft} onChange={d => { setDraft(d); if (problem) setProblem(null); }}
          theme={ADMIN_INCIDENT_THEME} disabled={saving} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderTop: `1px solid ${C.divider}`, flexWrap: 'wrap' }}>
        <span role="alert" style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: '#b91c1c' }}>{problem}</span>
        <button type="button" onClick={onCancel} style={{
          display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 14px', borderRadius: 8, fontFamily: 'inherit',
          border: `1px solid ${C.border}`, background: '#fff', color: C.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>Cancel</button>
        <button onClick={submit} disabled={saving} style={{
          display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 14px', borderRadius: 8, border: 'none',
          background: saving ? '#a5b4fc' : C.primary, color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
          cursor: saving ? 'default' : 'pointer',
        }}>{saving ? 'Saving…' : existing ? 'Save changes' : 'Submit report'}</button>
      </div>
    </div>
  );
}

const st = {
  empty: { padding: 32, textAlign: 'center', color: C.muted, fontSize: 13, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12 } as React.CSSProperties,
};
