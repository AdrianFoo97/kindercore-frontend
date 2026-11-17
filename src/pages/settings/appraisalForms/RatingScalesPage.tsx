import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faCopy, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import {
  RATING_SCALES_KEY, deleteRatingScale, fetchRatingScales, setDefaultRatingScale, setRatingScaleActive, type RatingScaleTemplate,
} from '../../../api/appraisal-rating-scales.js';
import DeleteDialog from '../../../components/common/DeleteDialog.js';
import LoadingSpinner from '../../../components/common/LoadingSpinner.js';
import SegmentedControl from '../../../components/common/SegmentedControl.js';
import { NEW_SCALE_ID, RATING_SCALES_PATH } from './RatingScalePage.js';
import { applyFilter, scaleFilterOf, type ScaleFilter } from './listFilters.js';
import { scaleDeleteBlocker, scaleSummary } from './ratingScales.js';
import { C, btn, iconBtn, pill } from './formTheme.js';
import { DeleteButton } from './DeleteButton.js';

/**
 * Settings → Rating scales: the scales a criterion can pick when it's scored
 * on a rating. A row opens the scale's page; "New scale" and "Duplicate" open
 * an unsaved one there (created only on Save). The default is preselected for
 * new criteria; it can't be deleted or made inactive.
 */
export default function RatingScalesPage() {
  const qc = useQueryClient();
  const { data: scales = [], isLoading, error } = useQuery({ queryKey: RATING_SCALES_KEY, queryFn: fetchRatingScales });
  const navigate = useNavigate();
  const [removing, setRemoving] = useState<RatingScaleTemplate | null>(null);
  const makeDefault = useMutation({
    mutationFn: setDefaultRatingScale,
    onSuccess: list => qc.setQueryData(RATING_SCALES_KEY, list),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: RATING_SCALES_KEY });
  const remove = async (s: RatingScaleTemplate) => { await deleteRatingScale(s.id); refresh(); };
  const [filter, setFilter] = useState<ScaleFilter>('all');
  const toggle = useMutation({ mutationFn: (s: RatingScaleTemplate) => setRatingScaleActive(s.id, !s.isActive), onSuccess: refresh });
  const { shown, counts } = applyFilter<RatingScaleTemplate, Exclude<ScaleFilter, 'all'>>(scales, filter, scaleFilterOf);
  const actionError = toggle.error as Error | null;

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <h1>Rating scales</h1>
        <button type="button" style={btn('primary')} onClick={() => navigate(`${RATING_SCALES_PATH}/${NEW_SCALE_ID}`)}>
          <FontAwesomeIcon icon={faPlus} /> New scale
        </button>
      </header>

      {isLoading && <LoadingSpinner />}
      {error && <p role="alert" style={{ color: C.red, fontSize: 14 }}>{(error as Error).message}</p>}
      {makeDefault.error && <p role="alert" style={{ color: C.red, fontSize: 14 }}>{(makeDefault.error as Error).message}</p>}
      {actionError && <p role="alert" style={{ color: C.red, fontSize: 14 }}>{actionError.message}</p>}
      {scales.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SegmentedControl<ScaleFilter> ariaLabel="Show" accent={C.primary} value={filter} onChange={setFilter} segments={[
            { key: 'active', label: `Active ${counts.active ?? 0}` },
            { key: 'inactive', label: `Inactive ${counts.inactive ?? 0}` },
            { key: 'all', label: `All ${counts.all}` },
          ]} />
        </div>
      )}
      {scales.length > 0 && shown.length === 0 && <p style={{ fontSize: 14, color: C.muted }}>None here.</p>}

      {shown.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {/* The whole row highlights together; the name side opens the scale's page. */}
          <style>{`.rs-row:hover { background: ${C.bg}; }`}</style>
          {shown.map((s, i) => (
            <li key={s.id} className="rs-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '0 16px 0 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
              <Link to={`${RATING_SCALES_PATH}/${s.id}`} style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 16, padding: '16px 8px 16px 24px', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: s.isActive ? C.text : C.muted }}>{s.name}</span>
                  {s.isDefault && <span style={pill(C.primary, C.primarySoft)}>Default</span>}
                  {!s.isActive && <span style={pill(C.muted, '#f1f5f9')}>Inactive</span>}
                  {s.inUse && <span style={pill(C.muted, '#f1f5f9')} title="Appraisal forms have used it">In use</span>}
                </div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>{scaleSummary(s)}</div>
              </div>
              <FontAwesomeIcon icon={faChevronRight} style={{ color: C.muted, fontSize: 13 }} aria-hidden />
              </Link>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {!s.isDefault && (
                  <button type="button" style={btn('ghost', true)} disabled={toggle.isPending} onClick={() => toggle.mutate(s)}
                    title={s.isActive ? 'Stop offering it when picking a scale' : 'Offer it again when picking a scale'}>
                    {s.isActive ? 'Make inactive' : 'Make active'}
                  </button>
                )}
                {!s.isDefault && (
                  <button type="button" style={btn('ghost', true)} disabled={makeDefault.isPending} onClick={() => makeDefault.mutate(s.id)}>
                    Make default
                  </button>
                )}
                <button type="button" style={iconBtn} aria-label={`Duplicate ${s.name}`} title="Duplicate — opens a copy; it's only kept if you save it"
                  onClick={() => navigate(`${RATING_SCALES_PATH}/${NEW_SCALE_ID}?from=${s.id}`)}>
                  <FontAwesomeIcon icon={faCopy} />
                </button>
                <DeleteButton name={s.name} blockedReason={scaleDeleteBlocker(s)} onClick={() => setRemoving(s)} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {removing && (
        <DeleteDialog entityType="Rating scale" entityName={removing.name}
          consequence="Forms that already use it keep their own copy of its levels."
          onConfirm={() => remove(removing)} onCancel={() => setRemoving(null)} />
      )}
    </div>
  );
}
