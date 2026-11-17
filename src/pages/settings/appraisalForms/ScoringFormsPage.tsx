import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faClipboardCheck, faCopy, faListCheck, faPlus, faTrash, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import {
  SCORING_FORMS_KEY, deleteScoringForm, fetchScoringForms, setScoringFormActive, type ScoringForm,
} from '../../../api/appraisal-scoring-forms.js';
import SegmentedControl from '../../../components/common/SegmentedControl.js';
import { applyFilter, scoringFormFilterOf, type ScoringFormFilter } from './listFilters.js';
import DeleteDialog from '../../../components/common/DeleteDialog.js';
import LoadingSpinner from '../../../components/common/LoadingSpinner.js';
import { fetchPositions } from '../../../api/salary.js';
import { isUsable, scoringFormFor, scoringFormSummary } from './scoringForms.js';
import { C, btn, iconBtn, pill } from './formTheme.js';
import { DeleteButton, IN_USE_REASON } from './DeleteButton.js';

export const SCORING_FORMS_PATH = '/settings/scoring-forms';
/** A new or copied scoring form opens unsaved at …/new (?from=<id> for a copy); it's created on "Save". */
export const NEW_SCORING_FORM_ID = 'new';

/**
 * Settings → Scoring forms: the list of reusable "What's scored" bodies —
 * weighted sections and criteria — that an appraisal criterion can be scored
 * from. A row opens its editor (like an appraisal form's, without who
 * appraises or how often).
 */
export default function ScoringFormsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: forms = [], isLoading, error } = useQuery({ queryKey: SCORING_FORMS_KEY, queryFn: fetchScoringForms });
  const { data: positions = [] } = useQuery({ queryKey: ['salary-positions'], queryFn: fetchPositions });
  // "New scoring form" and "Duplicate" open the editor straight away; nothing is created until it's saved.
  const openNew = () => navigate(`${SCORING_FORMS_PATH}/${NEW_SCORING_FORM_ID}?tab=basics`);
  const duplicate = (id: string) => navigate(`${SCORING_FORMS_PATH}/${NEW_SCORING_FORM_ID}?tab=basics&from=${id}`);
  const [removing, setRemoving] = useState<ScoringForm | null>(null);
  // Active ones by default — the inactive and the rest are a tap away.
  const [filter, setFilter] = useState<ScoringFormFilter>('active');
  const refresh = () => qc.invalidateQueries({ queryKey: SCORING_FORMS_KEY });
  const remove = async (f: ScoringForm) => { await deleteScoringForm(f.id); refresh(); };
  const toggle = useMutation({ mutationFn: (f: ScoringForm) => setScoringFormActive(f.id, !f.isActive), onSuccess: refresh });
  const { shown, counts } = applyFilter<ScoringForm, Exclude<ScoringFormFilter, 'all'>>(forms, filter, scoringFormFilterOf);
  const actionError = toggle.error as Error | null;

  return (
    <div>
      {/* The whole row (link and its buttons) highlights together. */}
      <style>{`.sf-row:hover { background: ${C.bg}; }`}</style>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <h1>Scoring forms</h1>
        {forms.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={btn('secondary')} onClick={() => navigate(`${SCORING_FORMS_PATH}/${NEW_SCORING_FORM_ID}?tab=basics&kind=sop`)}>
              <FontAwesomeIcon icon={faClipboardCheck} /> From SOPs
            </button>
            <button type="button" style={btn('primary')} onClick={openNew}>
              <FontAwesomeIcon icon={faPlus} /> New scoring form
            </button>
          </div>
        )}
      </header>

      {isLoading && <LoadingSpinner />}
      {error && <p role="alert" style={{ color: C.red, fontSize: 14 }}>{(error as Error).message}</p>}
      {actionError && <p role="alert" style={{ color: C.red, fontSize: 14 }}>{actionError.message}</p>}
      {forms.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SegmentedControl<ScoringFormFilter> ariaLabel="Show" accent={C.primary} value={filter} onChange={setFilter} segments={[
            { key: 'active', label: `Active ${counts.active ?? 0}` },
            { key: 'incomplete', label: `Incomplete ${counts.incomplete ?? 0}` },
            { key: 'inactive', label: `Inactive ${counts.inactive ?? 0}` },
            { key: 'all', label: `All ${counts.all}` },
          ]} />
        </div>
      )}
      {forms.length > 0 && shown.length === 0 && <p style={{ fontSize: 14, color: C.muted }}>None here.</p>}

      {!isLoading && !error && forms.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12 }}>
          <FontAwesomeIcon icon={faListCheck} style={{ fontSize: 28, color: C.primary }} />
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '16px 0 4px' }}>No scoring forms yet</h2>
          <p style={{ fontSize: 14, color: C.muted, margin: '0 auto 16px', maxWidth: 440, lineHeight: 1.5 }}>
            A scoring form is a set of weighted sections and criteria you score on again and again, e.g. “Classroom care”. A criterion on any appraisal form can be scored from it.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" style={btn('secondary')} onClick={() => navigate(`${SCORING_FORMS_PATH}/${NEW_SCORING_FORM_ID}?tab=basics&kind=sop`)}>
              <FontAwesomeIcon icon={faClipboardCheck} /> From SOPs
            </button>
            <button type="button" style={btn('primary')} onClick={openNew}>
              <FontAwesomeIcon icon={faPlus} /> New scoring form
            </button>
          </div>
        </div>
      )}

      {shown.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {shown.map((f, i) => (
            <li key={f.id} className="sf-row" style={{ display: 'flex', alignItems: 'center', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
              <Link to={`${SCORING_FORMS_PATH}/${f.id}`} style={{
                flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 16, padding: '16px 8px 16px 24px', textDecoration: 'none', color: 'inherit',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: f.isActive ? C.text : C.muted }}>{f.name}</span>
                    {!f.isActive && <span style={pill(C.muted, '#f1f5f9')}>Inactive</span>}
                    {f.inUse && <span style={pill(C.muted, '#f1f5f9')} title="Appraisal forms have used it">In use</span>}
                  </div>
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>
                    {[scoringFormSummary(f), scoringFormFor(f, positions)].filter(Boolean).join(' · ')}
                  </div>
                  {f.isActive && !isUsable(f) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.amber, marginTop: 4 }}>
                      <FontAwesomeIcon icon={faTriangleExclamation} /> Not complete yet — can’t be picked until fixed
                    </div>
                  )}
                </div>
                <FontAwesomeIcon icon={faChevronRight} style={{ color: C.muted, fontSize: 13 }} aria-hidden />
              </Link>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, margin: '0 16px 0 8px' }}>
                <button type="button" style={btn('ghost', true)} disabled={toggle.isPending} onClick={() => toggle.mutate(f)}
                  title={f.isActive ? 'Stop offering it when picking a scoring form' : 'Offer it again when picking a scoring form'}>
                  {f.isActive ? 'Make inactive' : 'Make active'}
                </button>
                <button type="button" style={iconBtn} aria-label={`Duplicate ${f.name}`} title="Duplicate — opens a copy; it's only kept if you save it" onClick={() => duplicate(f.id)}>
                  <FontAwesomeIcon icon={faCopy} />
                </button>
                <DeleteButton name={f.name} blockedReason={f.inUse ? IN_USE_REASON : null} onClick={() => setRemoving(f)} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {removing && (
        <DeleteDialog entityType="Scoring form" entityName={removing.name}
          consequence="Appraisal forms that already use it keep their own copy."
          onConfirm={() => remove(removing)} onCancel={() => setRemoving(null)} />
      )}
    </div>
  );
}
