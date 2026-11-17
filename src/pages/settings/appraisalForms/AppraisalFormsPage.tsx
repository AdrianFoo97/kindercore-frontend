import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faClipboardList, faCopy, faPlus, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { fetchAppraisalTemplates, type AppraisalTemplateSummary } from '../../../api/appraisal-templates.js';
import { NEW_COPY_ID } from './AppraisalFormEditPage.js';
import SegmentedControl from '../../../components/common/SegmentedControl.js';
import { applyFilter, formFilterFrom, formFilterOf, type FormFilter } from './listFilters.js';
import { fetchPositions } from '../../../api/salary.js';
import type { Position } from '../../../types/index.js';
import { STATUS_LABEL } from './appraisalFormDraft.js';
import { C, STATUS_TONE, btn, iconBtn, input, label, pill } from './formTheme.js';
import LoadingSpinner from '../../../components/common/LoadingSpinner.js';

const EDIT_PATH = '/settings/appraisal-forms';

/** Settings → Appraisals → Appraisal forms: every form, live ones first; filter by live / draft / retired; duplicate any. */
export default function AppraisalFormsPage() {
  const { data: forms = [], isLoading, error } = useQuery({ queryKey: ['appraisal-templates'], queryFn: fetchAppraisalTemplates });
  const { data: positions = [] } = useQuery({ queryKey: ['salary-positions'], queryFn: fetchPositions });
  // Opened after Save draft / Make live / Retire: on that filter (?filter=draft|live|retired).
  const [params] = useSearchParams();
  const [filter, setFilter] = useState<FormFilter>(() => formFilterFrom(params.get('filter')));
  const navigate = useNavigate();
  // Duplicate opens an unsaved copy — it's only created if it's saved.
  const duplicate = (id: string) => navigate(`${EDIT_PATH}/${NEW_COPY_ID}?from=${id}`);
  const { shown, counts } = applyFilter<AppraisalTemplateSummary, Exclude<FormFilter, 'all'>>(forms, filter, formFilterOf);

  return (
    <div className="m-pad" style={{ padding: '24px 32px 48px', background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: C.text }}>
      <style>{`.af-row:hover { background: ${C.bg}; }`}</style>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <div style={{ minWidth: 0, flex: '1 1 320px' }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Appraisal Forms</h1>
          </div>
          {forms.length > 0 && (
            <button type="button" style={btn('primary')} onClick={() => navigate(`${EDIT_PATH}/${NEW_COPY_ID}`)}>
              <FontAwesomeIcon icon={faPlus} /> New form
            </button>
          )}
        </header>

        {isLoading && <p style={{ color: C.muted, fontSize: 14 }}><LoadingSpinner /></p>}
        {error && <p role="alert" style={{ color: C.red, fontSize: 14 }}>{(error as Error).message}</p>}
        {forms.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SegmentedControl<FormFilter> ariaLabel="Show" accent={C.primary} value={filter} onChange={setFilter} segments={[
              { key: 'live', label: `Live ${counts.live ?? 0}` },
              { key: 'draft', label: `Draft ${counts.draft ?? 0}` },
              { key: 'retired', label: `Retired ${counts.retired ?? 0}` },
              { key: 'all', label: `All ${counts.all}` },
            ]} />
          </div>
        )}
        {forms.length > 0 && shown.length === 0 && <p style={{ fontSize: 14, color: C.muted }}>None here.</p>}

        {!isLoading && !error && forms.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12 }}>
            <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: 28, color: C.primary }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '16px 0 4px' }}>No appraisal forms yet</h2>
            <p style={{ fontSize: 14, color: C.muted, margin: '0 auto 16px', maxWidth: 420, lineHeight: 1.5 }}>
              A form says what’s scored, how much each part counts, and who assesses and signs off.
            </p>
            <button type="button" style={btn('primary')} onClick={() => navigate(`${EDIT_PATH}/${NEW_COPY_ID}`)}>
              <FontAwesomeIcon icon={faPlus} /> New form
            </button>
          </div>
        )}

        {shown.length > 0 && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            {shown.map((f, i) => (
              <FormRow key={f.familyId} form={f} positions={positions} first={i === 0}
                onDuplicate={() => duplicate(f.id)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FormRow({ form: f, positions, first, onDuplicate }: {
  form: AppraisalTemplateSummary; positions: Position[]; first: boolean; onDuplicate: () => void;
}) {
  const tone = STATUS_TONE[f.status];
  const used = positions.filter(p => f.positionIds.includes(p.positionId)).map(p => p.name);
  return (
    // The whole row (link and its button) highlights together.
    <li className="af-row" style={{ display: 'flex', alignItems: 'center', borderTop: first ? 'none' : `1px solid ${C.border}` }}>
      <Link to={`${EDIT_PATH}/${f.id}`} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 16, padding: '16px 8px 16px 24px', textDecoration: 'none', color: 'inherit' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{f.name}<span title={`Version ${f.version}`} style={{ fontSize: '0.7em', fontWeight: 700, color: C.muted, background: '#f1f5f9', borderRadius: 6, padding: '1px 6px', marginLeft: 8, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>V{f.version}</span></span>
            <span style={pill(tone.fg, tone.bg)}>{STATUS_LABEL[f.status]}</span>
            {f.draftId && <span style={pill(STATUS_TONE.DRAFT.fg, STATUS_TONE.DRAFT.bg)}>Next version in draft</span>}
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            {f.sectionCount} {f.sectionCount === 1 ? 'section' : 'sections'} · {f.criterionCount} {f.criterionCount === 1 ? 'criterion' : 'criteria'}
          </div>
          <div style={{ fontSize: 13, marginTop: 4, color: used.length || f.status === 'RETIRED' ? C.sub : C.amber }}>
            {used.length
              ? `Used for ${used.join(', ')}`
              : f.status === 'RETIRED' ? 'Not used' : <><FontAwesomeIcon icon={faTriangleExclamation} /> Not used by any position yet</>}
          </div>
        </div>
        <FontAwesomeIcon icon={faChevronRight} style={{ color: C.muted, fontSize: 13 }} aria-hidden />
      </Link>
      <button type="button" style={{ ...iconBtn, margin: '0 16px 0 8px' }} aria-label={`Duplicate ${f.name}`}
        title="Duplicate — opens a copy; it's only kept if you save it" onClick={onDuplicate}>
        <FontAwesomeIcon icon={faCopy} />
      </button>
    </li>
  );
}
