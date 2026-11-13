import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faClipboardList, faPlus, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { createAppraisalTemplate, fetchAppraisalTemplates, type AppraisalTemplateSummary } from '../../../api/appraisal-templates.js';
import { fetchPositions } from '../../../api/salary.js';
import FormModal from '../../../components/common/FormModal.js';
import type { Position } from '../../../types/index.js';
import { FREQUENCY_LABEL, STATUS_LABEL } from './appraisalFormDraft.js';
import { C, STATUS_TONE, btn, input, label, pill } from './formTheme.js';
import SettingsNote from '../SettingsNote.js';

const EDIT_PATH = '/settings/appraisal-forms';

/** Settings → HR & Payroll → Appraisal Forms: every form, live ones first. */
export default function AppraisalFormsPage() {
  const { data: forms = [], isLoading, error } = useQuery({ queryKey: ['appraisal-templates'], queryFn: fetchAppraisalTemplates });
  const { data: positions = [] } = useQuery({ queryKey: ['salary-positions'], queryFn: fetchPositions });
  const [creating, setCreating] = useState(false);

  return (
    <div className="m-pad" style={{ padding: '24px 32px 48px', background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: C.text }}>
      <style>{`.af-row:hover { background: ${C.bg}; }`}</style>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <div style={{ minWidth: 0, flex: '1 1 320px' }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Appraisal Forms</h1>
          </div>
          {forms.length > 0 && (
            <button type="button" style={btn('primary')} onClick={() => setCreating(true)}>
              <FontAwesomeIcon icon={faPlus} /> New form
            </button>
          )}
        </header>
        <SettingsNote>Appraisals are still recorded as one overall score until scoring with forms is switched on.</SettingsNote>

        {isLoading && <p style={{ color: C.muted, fontSize: 14 }}>Loading…</p>}
        {error && <p role="alert" style={{ color: C.red, fontSize: 14 }}>{(error as Error).message}</p>}

        {!isLoading && !error && forms.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12 }}>
            <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: 28, color: C.primary }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '16px 0 4px' }}>No appraisal forms yet</h2>
            <p style={{ fontSize: 14, color: C.muted, margin: '0 auto 16px', maxWidth: 420, lineHeight: 1.5 }}>
              A form says what’s scored, how much each part counts, and who assesses and signs off.
            </p>
            <button type="button" style={btn('primary')} onClick={() => setCreating(true)}>
              <FontAwesomeIcon icon={faPlus} /> New form
            </button>
          </div>
        )}

        {forms.length > 0 && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            {forms.map((f, i) => <FormRow key={f.familyId} form={f} positions={positions} first={i === 0} />)}
          </ul>
        )}
      </div>
      {creating && <NewFormModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function FormRow({ form: f, positions, first }: { form: AppraisalTemplateSummary; positions: Position[]; first: boolean }) {
  const tone = STATUS_TONE[f.status];
  const used = positions.filter(p => f.positionIds.includes(p.positionId)).map(p => p.name);
  return (
    <li style={{ borderTop: first ? 'none' : `1px solid ${C.border}` }}>
      <Link to={`${EDIT_PATH}/${f.id}`} className="af-row" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px', textDecoration: 'none', color: 'inherit' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{f.name}</span>
            <span style={pill(tone.fg, tone.bg)}>{STATUS_LABEL[f.status]}</span>
            {f.draftId && <span style={pill(STATUS_TONE.DRAFT.fg, STATUS_TONE.DRAFT.bg)}>Next version in draft</span>}
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            Version {f.version} · {FREQUENCY_LABEL[f.frequency]} · {f.sectionCount} {f.sectionCount === 1 ? 'section' : 'sections'} · {f.criterionCount} {f.criterionCount === 1 ? 'criterion' : 'criteria'}
          </div>
          <div style={{ fontSize: 13, marginTop: 4, color: used.length || f.status === 'RETIRED' ? C.sub : C.amber }}>
            {used.length
              ? `Used for ${used.join(', ')}`
              : f.status === 'RETIRED' ? 'Not used' : <><FontAwesomeIcon icon={faTriangleExclamation} /> Not used by any position yet</>}
          </div>
        </div>
        <FontAwesomeIcon icon={faChevronRight} style={{ color: C.muted, fontSize: 13 }} aria-hidden />
      </Link>
    </li>
  );
}

function NewFormModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [tried, setTried] = useState(false);
  const create = useMutation({
    mutationFn: () => createAppraisalTemplate({ name: name.trim() }),
    onSuccess: t => {
      qc.invalidateQueries({ queryKey: ['appraisal-templates'] });
      qc.setQueryData(['appraisal-template', t.id], t);
      navigate(`${EDIT_PATH}/${t.id}`);
    },
  });
  const submit = () => { setTried(true); if (name.trim()) create.mutate(); };

  return (
    <FormModal
      title="New appraisal form"
      subtitle="It starts as a draft. Nothing changes for staff until you make it live."
      onClose={onClose}
      dirty={!!name.trim()}
      primary={{ label: create.isPending ? 'Creating…' : 'Create', onClick: submit, busy: create.isPending }}
    >
      <label style={label} htmlFor="af-new-name">Name</label>
      <input id="af-new-name" autoFocus style={input} value={name} maxLength={191} placeholder="e.g. Monthly teacher appraisal"
        onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
      {tried && !name.trim() && <p role="alert" style={{ fontSize: 13, color: C.red, margin: '4px 0 0' }}>Give it a name.</p>}
      {create.error && <p role="alert" style={{ fontSize: 13, color: C.red, margin: '8px 0 0' }}>{(create.error as Error).message}</p>}
    </FormModal>
  );
}
