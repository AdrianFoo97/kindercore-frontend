import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import {
  SCORING_FORMS_KEY, createScoringForm, deleteScoringForm, fetchScoringForm, scoringFormKey, updateScoringForm, type ScoringForm,
} from '../../../api/appraisal-scoring-forms.js';
import DeleteDialog from '../../../components/common/DeleteDialog.js';
import LoadingSpinner from '../../../components/common/LoadingSpinner.js';
import { useToast } from '../../../components/common/Toast.js';
import { fetchPositions } from '../../../api/salary.js';
import { fetchTemplates } from '../../../api/sop-templates.js';
import { DEFAULT_SOP_SECTION, fromOldSopShape, isOldSopShape, sopIdsFor } from './scoringForms.js';
import SopChecksCard from './SopChecksCard.js';
import FormTabs from './FormTabs.js';
import SectionsCard from './SectionsCard.js';
import StepHeading from './StepHeading.js';
import UsedForField from './UsedForCard.js';
import { overWeightProblems, sectionsFromSaved, sectionsPayload, type DraftSection } from './appraisalFormDraft.js';
import { NAME_MISSING, saveBlocker, saveStatusText, type FormStep, type SaveState, type StepKey } from './formSteps.js';
import { C, btn, card, input, label } from './formTheme.js';
import { copyName } from './listFilters.js';
import { NEW_SCORING_FORM_ID } from './ScoringFormsPage.js';

const LIST_PATH = '/settings/scoring-forms';
const TAB_KEYS: StepKey[] = ['basics', 'scoring'];
const NEW_NAME = 'Untitled scoring form';
const NEW_SOP_NAME = 'SOP check';
/** Marks a new form as an SOP form until its SOPs are added (replaced on save by the real SOP ids). */
const SOP_FORM_PENDING = 'pending';
const MAX_NAME = 100;
/** A brand-new scoring form, before it's saved. */
const BLANK: ScoringForm = { id: '', name: NEW_NAME, sections: [], positionIds: [], isActive: true, problems: ['Add at least one section.'] };

/**
 * One scoring form, built like an appraisal form without "who appraises" or
 * "how often": tabs 1 Basics (its name) · 2 What's scored (weighted sections
 * and criteria). Changes are kept on the page until "Save". Appraisal forms
 * that use it keep their own copy, so saving never changes them.
 * At …/new (a new one), …/new?from=<id> (a copy) or …/new?sop=<id> (checks an SOP, step by
 * step: pass / fail / N/A) nothing exists until "Save" creates it.
 */
export default function ScoringFormPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();
  const isNew = id === NEW_SCORING_FORM_ID;
  const fromId = isNew ? params.get('from') : null;
  // A new SOP scoring form (?kind=sop): built here like any scoring form, its SOPs added in step 2.
  const fromSops = isNew && !fromId && params.get('kind') === 'sop';
  const sourceId = isNew ? fromId : id;
  const { data: loaded, isLoading, error } = useQuery({
    queryKey: scoringFormKey(sourceId ?? ''), queryFn: () => fetchScoringForm(sourceId!),
    enabled: !!sourceId,
    // A refetch would overwrite unsaved edits.
    refetchOnWindowFocus: false,
  });
  // New: blank. Copy: the source's contents, named "… (copy)". Either way unsaved until "Save".
  const form = useMemo<ScoringForm | undefined>(() => {
    // An SOP form saved in the old shape (each SOP a section) opens as sections → SOPs → steps.
    if (!isNew) return loaded && loaded.sopTemplateIds?.length && isOldSopShape(loaded.sections) ? { ...loaded, sections: fromOldSopShape(loaded.sections) } : loaded;
    if (fromSops) return { ...BLANK, name: NEW_SOP_NAME, sections: [{ name: DEFAULT_SOP_SECTION, weight: 100, criteria: [] }], sopTemplateIds: [SOP_FORM_PENDING] };
    if (!fromId) return BLANK;
    return loaded ? { ...loaded, id: '', name: copyName(loaded.name, MAX_NAME), isActive: true } : undefined;
  }, [isNew, fromId, loaded, fromSops]);

  const { data: positions = [] } = useQuery({ queryKey: ['salary-positions'], queryFn: fetchPositions });
  const [name, setName] = useState('');
  /** Optional: which positions it's meant for. */
  const [picked, setPicked] = useState<string[]>([]);
  const [sections, setSections] = useState<DraftSection[] | null>(null);
  const [removing, setRemoving] = useState(false);
  const tabParam = params.get('tab') as StepKey | null;
  const tab: StepKey = tabParam && TAB_KEYS.includes(tabParam) ? tabParam : 'basics';
  const openTab = (key: StepKey) => setParams(p => { p.set('tab', key); return p; }, { replace: true });

  // Start the working copy when a different form arrives — not after a save, which already matches.
  useEffect(() => {
    if (!form) return;
    setName(form.name);
    setPicked(form.positionIds);
    setSections(sectionsFromSaved(form.sections));
  }, [form?.id, form?.name]);

  const sortIds = (ids: string[]) => [...ids].sort();
  // An unsaved new one / copy is all "changes" until it's saved.
  const saved = useMemo(() => (form && !isNew
    ? JSON.stringify({ name: form.name, sections: sectionsPayload(sectionsFromSaved(form.sections)), positionIds: sortIds(form.positionIds), sopTemplateIds: form.sopTemplateIds ?? [] })
    : ''), [form, isNew]);
  // Made from SOPs: step 2 is the SOPs' shares (SopChecksCard), not editable criteria.
  const sopMode = fromSops || (form?.sopTemplateIds?.length ?? 0) > 0;
  const [sharesProblem, setSharesProblem] = useState<string | null>(null);
  const sops = useQuery({ queryKey: ['sop-templates'], queryFn: fetchTemplates, enabled: sopMode });
  const sopIdsNow = sopMode && sections ? sopIdsFor(sections.flatMap(s => s.criteria.map(c => c.name)), sops.data ?? []) : [];
  const payload = sections ? { name: name.trim(), sections: sectionsPayload(sections), positionIds: sortIds(picked), sopTemplateIds: sopMode ? sopIdsNow : form?.sopTemplateIds ?? [] } : null;
  const dirty = !!payload && JSON.stringify(payload) !== saved;
  const overWeight = sections ? overWeightProblems(sections) : [];
  const blocker = saveBlocker(name, overWeight) ?? (sopMode ? sharesProblem : null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // An unsaved new one / copy is created now — and the page moves to it.
  const save = useMutation({
    mutationFn: async () => updateScoringForm(isNew ? (await createScoringForm(payload!.name)).id : id, payload!),
    onSuccess: (f: ScoringForm) => {
      qc.setQueryData(scoringFormKey(f.id), f);
      qc.invalidateQueries({ queryKey: SCORING_FORMS_KEY });
      if (isNew) { showToast(fromId ? 'Copy saved' : fromSops ? 'SOP scoring form saved' : 'Scoring form saved'); navigate(`${LIST_PATH}/${f.id}?tab=${tab}`, { replace: true }); }
    },
  });
  const remove = async () => {
    await deleteScoringForm(id);
    qc.invalidateQueries({ queryKey: SCORING_FORMS_KEY });
    showToast('Scoring form deleted');
    navigate(LIST_PATH);
  };

  if ((isLoading && !!sourceId) || (sopMode && sops.isPending)) return <LoadingSpinner />;
  if (error || !form || !sections) {
    return (
      <div>
        <p role="alert" style={{ color: C.red, fontSize: 14 }}>{(error as Error | null)?.message ?? 'Couldn’t load this scoring form.'}</p>
        <Link to={LIST_PATH} style={{ color: C.primary, fontSize: 14 }}>Back to Scoring forms</Link>
      </div>
    );
  }

  // The server's checks are for the last save; weights over 100% show as you type.
  const steps: FormStep[] = [
    { key: 'basics', number: 1, title: 'Basics', issues: name.trim() ? [] : [NAME_MISSING] },
    { key: 'scoring', number: 2, title: sopMode ? 'Score' : 'What’s scored', issues: [...new Set([...overWeight, ...(sopMode && sharesProblem ? [sharesProblem] : []), ...form.problems])] },
  ];
  const saveState: SaveState = save.isPending ? 'saving' : save.isError && dirty ? 'error' : dirty ? 'pending' : 'saved';
  const issuesOf = (key: StepKey) => steps.find(s => s.key === key)!.issues;

  return (
    <div>

      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, overflowWrap: 'anywhere' }}>{name.trim() || 'Untitled scoring form'}</h1>
          <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13, color: saveState === 'error' ? C.red : C.muted }}>
            {saveState === 'saved' && <FontAwesomeIcon icon={faCircleCheck} style={{ color: C.green }} />}
            {saveState === 'error' && <FontAwesomeIcon icon={faCircleExclamation} />}
            {isNew ? (fromId ? `Not saved yet — a copy of “${loaded?.name ?? ''}”` : fromSops ? 'Not saved yet — an SOP scoring form' : 'Not saved yet') : saveStatusText(saveState, (save.error as Error | null)?.message)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {isNew
            ? <button type="button" style={btn('danger', false, save.isPending)} disabled={save.isPending} onClick={() => navigate(LIST_PATH)}>Discard</button>
            : <button type="button" style={btn('danger', false, save.isPending)} disabled={save.isPending} onClick={() => setRemoving(true)}>Delete</button>}
          {/* Off when there's nothing new to save, or while it can't be saved (says why). */}
          <button type="button" style={btn('primary', false, save.isPending || !dirty || !!blocker)} disabled={save.isPending || !dirty || !!blocker}
            title={blocker ? `Can’t save yet — ${blocker}` : !dirty ? 'No changes to save' : undefined} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      <FormTabs steps={steps} current={tab} onSelect={openTab} showStatus />
      <div role="tabpanel" id={`af-panel-${tab}`} aria-labelledby={`af-tab-${tab}`}>
        {tab === 'basics' && (
          <section style={card} aria-labelledby="sf-basics">
            <StepHeading id="sf-basics" title="Basics" issues={issuesOf('basics')}
              hint="A criterion on any appraisal form can be scored from this form, as its weighted total." />
            <label style={label} htmlFor="sf-name">Name</label>
            {/* A just-created form opens with its placeholder name selected, ready to type over. */}
            <input id="sf-name" style={input} maxLength={100} value={name} placeholder="e.g. Classroom care" aria-required
              autoFocus={isNew} onFocus={e => { if (isNew) e.currentTarget.select(); }}
              onChange={e => setName(e.target.value)} />
            <UsedForField positions={positions} selected={picked} onChange={setPicked} optional
              hint="Which positions it’s meant for — shown when picking it. Any appraisal form can still use it." />
          </section>
        )}
        {tab === 'scoring' && (
          sopMode
            ? <SopChecksCard sections={sections} onChange={setSections} onProblem={setSharesProblem} />
            : <SectionsCard sections={sections} onChange={setSections} issues={issuesOf('scoring')} inScoringForm />
        )}
      </div>

      {removing && (
        <DeleteDialog entityType="Scoring form" entityName={form.name}
          consequence="Appraisal forms that already use it keep their own copy."
          onConfirm={remove} onCancel={() => setRemoving(false)} />
      )}
    </div>
  );
}
