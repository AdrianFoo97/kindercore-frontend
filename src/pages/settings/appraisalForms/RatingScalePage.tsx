import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck } from '@fortawesome/free-solid-svg-icons';
import {
  RATING_SCALES_KEY, createRatingScale, deleteRatingScale, fetchRatingScales, updateRatingScale, type RatingScaleInput,
} from '../../../api/appraisal-rating-scales.js';
import DeleteDialog from '../../../components/common/DeleteDialog.js';
import LoadingSpinner from '../../../components/common/LoadingSpinner.js';
import { useToast } from '../../../components/common/Toast.js';
import { copyName } from './listFilters.js';
import { SCALE_SIZES, resizeLevels, scaleIssues } from './ratingScales.js';
import { C, btn, card, input, label, pill } from './formTheme.js';

export const RATING_SCALES_PATH = '/settings/rating-scales';
/** A new or copied scale opens unsaved at …/new (?from=<id> for a copy); it's created on "Save". */
export const NEW_SCALE_ID = 'new';
/** Same limit as the server. */
const MAX_NAME = 100;
const BLANK: RatingScaleInput = { name: '', max: 5, levels: resizeLevels([], 5) };

const cleaned = (d: RatingScaleInput): RatingScaleInput => ({
  name: d.name.trim(), max: d.max,
  levels: d.levels.map((l, i) => ({ value: i + 1, label: l.label.trim(), description: (l.description ?? '').trim() })),
});

/**
 * One rating scale, as a page: its name, how many levels, and a name + "what
 * it looks like" for each. Changes are kept on the page until "Save". Forms
 * copy a scale when it's picked, so saving never changes forms already set up.
 */
export default function RatingScalePage() {
  const { id = '' } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const isNew = id === NEW_SCALE_ID;
  const fromId = isNew ? params.get('from') : null;
  const { data: scales = [], isLoading, error } = useQuery({ queryKey: RATING_SCALES_KEY, queryFn: fetchRatingScales, refetchOnWindowFocus: false });
  const existing = scales.find(s => s.id === (isNew ? fromId : id));

  // Where the page starts: blank, a copy ("… (copy)"), or the scale as saved.
  const start = useMemo<RatingScaleInput | null>(() => {
    if (isNew && !fromId) return BLANK;
    if (!existing) return null;
    const base = { name: existing.name, max: existing.max, levels: resizeLevels(existing.levels, existing.max) };
    return isNew ? { ...base, name: copyName(existing.name, MAX_NAME) } : base;
  }, [isNew, fromId, existing]);

  const [draft, setDraft] = useState<RatingScaleInput | null>(null);
  const [removing, setRemoving] = useState(false);
  useEffect(() => { if (start) setDraft(start); }, [start === null, id, fromId]);

  const dirty = !!draft && (isNew || JSON.stringify(cleaned(draft)) !== JSON.stringify(start && cleaned(start)));
  // What's still missing — Save stays off until it's done (and says why).
  const issues = draft ? scaleIssues(draft) : {};
  const missing = issues.name ?? issues.levels;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = useMutation({
    mutationFn: () => (isNew ? createRatingScale(cleaned(draft!)) : updateRatingScale(id, cleaned(draft!))),
    onSuccess: s => {
      qc.invalidateQueries({ queryKey: RATING_SCALES_KEY });
      showToast(isNew ? 'Rating scale saved' : 'Saved');
      if (isNew) navigate(`${RATING_SCALES_PATH}/${s.id}`, { replace: true });
    },
  });
  const remove = async () => {
    await deleteRatingScale(id);
    qc.invalidateQueries({ queryKey: RATING_SCALES_KEY });
    showToast('Rating scale deleted');
    navigate(RATING_SCALES_PATH);
  };

  if (isLoading) return <LoadingSpinner />;
  if (error || !draft) {
    return (
      <div>
        <p role="alert" style={{ color: C.red, fontSize: 14 }}>{(error as Error | null)?.message ?? 'This rating scale doesn’t exist any more.'}</p>
        <Link to={RATING_SCALES_PATH} style={{ color: C.primary, fontSize: 14 }}>Back to Rating scales</Link>
      </div>
    );
  }
  const setLevel = (i: number, patch: Partial<RatingScaleInput['levels'][number]>) =>
    setDraft(d => (d ? { ...d, levels: d.levels.map((l, j) => (j === i ? { ...l, ...patch } : l)) } : d));
  const status = isNew
    ? (fromId ? `Not saved yet — a copy of “${existing?.name ?? ''}”` : 'Not saved yet')
    : save.isPending ? 'Saving…' : dirty ? 'Unsaved changes' : 'All changes saved';

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, overflowWrap: 'anywhere' }}>{draft.name.trim() || 'New rating scale'}</h1>
            {!isNew && existing?.isDefault && <span style={pill(C.primary, C.primarySoft)}>Default</span>}
          </div>
          <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13, color: C.muted }}>
            {!isNew && !dirty && !save.isPending && <FontAwesomeIcon icon={faCircleCheck} style={{ color: C.green }} />}
            {status}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {isNew
            ? <button type="button" style={btn('danger')} onClick={() => navigate(RATING_SCALES_PATH)}>Discard</button>
            : (
              <button type="button" style={btn('danger', false, !!existing?.isDefault)} disabled={!!existing?.isDefault} onClick={() => setRemoving(true)}
                title={existing?.isDefault ? 'The default can’t be deleted — make another one the default first' : undefined}>Delete</button>
            )}
          {/* Off when there's nothing new to save, or while something's missing (says what). */}
          <button type="button" style={btn('primary', false, save.isPending || !dirty || !!missing)} disabled={save.isPending || !dirty || !!missing}
            title={missing ?? (!dirty ? 'No changes to save' : undefined)} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>
      {save.error && <p role="alert" style={{ color: C.red, fontSize: 14 }}>{(save.error as Error).message}</p>}

      <section style={card} aria-label="Rating scale">
        <p style={{ fontSize: 13, color: C.muted, margin: '0 0 16px', lineHeight: 1.5 }}>
          Forms copy a scale when it’s picked, so changing it here won’t change forms already set up.
        </p>
        <label style={label} htmlFor="rs-name">Name</label>
        <input id="rs-name" autoFocus={isNew} style={input} maxLength={MAX_NAME} value={draft.name} placeholder="e.g. Standard 1–5"
          aria-required onChange={e => setDraft(d => (d ? { ...d, name: e.target.value } : d))} />

        <label style={{ ...label, marginTop: 16 }} htmlFor="rs-size">Levels</label>
        <select id="rs-size" style={{ ...input, width: 'auto' }} value={draft.max}
          onChange={e => { const max = Number(e.target.value); setDraft(d => (d ? { ...d, max, levels: resizeLevels(d.levels, max) } : d)); }}>
          {SCALE_SIZES.map(n => <option key={n} value={n}>1 to {n}</option>)}
        </select>

        <ol aria-label="Levels" style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'grid', gap: 8 }}>
          {draft.levels.map((l, i) => (
            <li key={i} style={{ display: 'flex', gap: 12, padding: 12, border: `1px solid ${C.border}`, borderRadius: 8 }}>
              <span style={levelBadge}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 6 }}>
                <input aria-label={`Name for level ${i + 1}`} style={input} maxLength={60} value={l.label} aria-required
                  placeholder={i === 0 ? 'Name, e.g. Needs improvement' : i === draft.max - 1 ? 'Name, e.g. Outstanding' : 'Name'}
                  onChange={e => setLevel(i, { label: e.target.value })} />
                <textarea aria-label={`What level ${i + 1} looks like`} style={{ ...input, minHeight: 40, resize: 'vertical', fontSize: 13 }}
                  maxLength={300} rows={1} value={l.description ?? ''} placeholder="What it looks like (optional)"
                  onChange={e => setLevel(i, { description: e.target.value })} />
              </div>
            </li>
          ))}
        </ol>
        <p style={{ fontSize: 13, color: C.muted, margin: '8px 0 0' }}>Every level needs a name; what it looks like is optional.</p>
      </section>

      {removing && existing && (
        <DeleteDialog entityType="Rating scale" entityName={existing.name}
          consequence="Forms that already use it keep their own copy of its levels."
          onConfirm={remove} onCancel={() => setRemoving(false)} />
      )}
    </div>
  );
}

const levelBadge: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 999, background: C.primarySoft, color: C.primary, fontSize: 13, fontWeight: 700,
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4,
};
