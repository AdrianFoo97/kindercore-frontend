import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useGoBack } from '../../../hooks/useGoBack.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faCircleCheck, faCircleExclamation, faCircleInfo, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import {
  activateAppraisalTemplate, createAppraisalTemplate, deleteAppraisalTemplate, fetchAppraisalTemplate, newAppraisalTemplateVersion,
  retireAppraisalTemplate, saveAppraisalTemplate, setAppraisalTemplatePositions, type AppraisalTemplate,
} from '../../../api/appraisal-templates.js';
import { fetchPositions } from '../../../api/salary.js';
import ConfirmDialog from '../../../components/common/ConfirmDialog.js';
import { useToast } from '../../../components/common/Toast.js';
import LoadingSpinner from '../../../components/common/LoadingSpinner.js';
import AboutCard from './AboutCard.js';
import ApprovalChainCard from './ApprovalChainCard.js';
import FormTabs from './FormTabs.js';
import SectionsCard from './SectionsCard.js';
import UsedForField from './UsedForCard.js';
import { STATUS_LABEL, draftFromTemplate, overWeightProblems, payloadFromDraft, type FormDraft } from './appraisalFormDraft.js';
import { firstStepToFix, formSteps, saveBlocker, saveStatusText, type SaveState, type StepKey } from './formSteps.js';
import { C, STATUS_TONE, btn, pill } from './formTheme.js';
import { copyName } from './listFilters.js';

const LIST_PATH = '/settings/appraisal-forms';
/** An unsaved copy of a form opens at …/new?from=<id>; it's only created on "Save draft". */
/** The forms list, on a filter — where Save draft, Make live and Retire lead (draft / live / retired). */
export const listAt = (filter: 'draft' | 'live' | 'retired') => `${LIST_PATH}?filter=${filter}`;

export const NEW_COPY_ID = 'new';

/** A brand-new form before it's saved: no sections yet, and the usual chain — score it, sign it off, the staff member confirms. */
const BLANK_FORM: AppraisalTemplate = {
  id: '', familyId: '', name: '', description: null, frequency: 'MONTHLY', status: 'DRAFT', version: 1, missingPolicy: 'REQUIRE_ALL',
  updatedAt: '', sections: [], positionIds: [], problems: [], draftId: null, activeId: null,
  stages: [
    { id: 'new-assess', name: 'Assessed by', kind: 'ASSESS', scope: 'OWN_TEAM', positionIds: [] },
    { id: 'new-sign-off', name: 'Signed off by', kind: 'SIGN_OFF', scope: 'ANYONE', positionIds: [] },
    { id: 'new-acknowledge', name: 'Acknowledged by the staff member', kind: 'ACKNOWLEDGE', scope: 'ANYONE', positionIds: [] },
  ],
};
const MAX_FORM_NAME = 191;
const TAB_KEYS: StepKey[] = ['basics', 'scoring', 'approval'];
type Confirming = 'live' | 'retire' | 'delete' | null;

/**
 * One appraisal form, as three tabs (1 Basics — incl. who it's for · 2 What's
 * scored · 3 Who appraises); the open tab is kept in the address (?tab=).
 * Changes to a draft (incl. who it's for) are kept on the page until "Save
 * draft"; each tab says what it still needs; "Make live" is off until nothing
 * is left, then saves and confirms. Live and retired versions are read-only,
 * except who a live form is for (saved as soon as it's tapped).
 */
export default function AppraisalFormEditPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = useGoBack(LIST_PATH);
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();
  // A duplicate: the form it's copied from, shown as an unsaved draft copy until "Save draft" creates it.
  const isCopy = id === NEW_COPY_ID;
  const sourceId = isCopy ? params.get('from') ?? '' : id;
  // "New form": nothing to copy — a blank draft, created when it's first saved.
  const isBlank = isCopy && !sourceId;
  const { data: fetched, isLoading, error } = useQuery({
    queryKey: ['appraisal-template', sourceId],
    queryFn: () => fetchAppraisalTemplate(sourceId),
    enabled: !isBlank,
    // A refetch would overwrite unsaved edits.
    refetchOnWindowFocus: false,
  });
  const loaded = isBlank ? BLANK_FORM : fetched;
  const template = useMemo<AppraisalTemplate | undefined>(() => (isCopy && loaded
    ? {
      ...loaded, id: '', familyId: '', name: isBlank ? '' : copyName(loaded.name, MAX_FORM_NAME), status: 'DRAFT', version: 1,
      positionIds: [], draftId: null, activeId: null,
    }
    : loaded), [isCopy, loaded]);
  const { data: positions = [] } = useQuery({ queryKey: ['salary-positions'], queryFn: fetchPositions });

  const [draft, setDraft] = useState<FormDraft | null>(null);
  /** "Who it's for" as picked on the page (saved with the draft). */
  const [picked, setPicked] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [actionError, setActionError] = useState('');
  const tabParam = params.get('tab') as StepKey | null;
  const tab: StepKey = tabParam && TAB_KEYS.includes(tabParam) ? tabParam : 'basics';
  const openTab = (key: StepKey) => setParams(p => { p.set('tab', key); return p; }, { replace: true });

  // Start the working copy when a different version (or status) arrives — not
  // after a save, which already matches what's on the page.
  useEffect(() => {
    if (!template) return;
    setDraft(draftFromTemplate(template));
    setPicked(template.positionIds);
  }, [template?.id, template?.status]);

  const isDraft = template?.status === 'DRAFT';
  // An unsaved copy is all "changes" until it's saved.
  const saved = useMemo(() => (template && !isCopy ? JSON.stringify(payloadFromDraft(draftFromTemplate(template))) : ''), [template, isCopy]);
  const payload = draft ? payloadFromDraft(draft) : null;
  const payloadJson = payload ? JSON.stringify(payload) : '';
  const positionsChanged = !!template && [...picked].sort().join() !== [...template.positionIds].sort().join();
  const dirty = !!draft && isDraft && (isCopy || payloadJson !== saved || positionsChanged);
  // Weights over 100% are kept as typed but can't be saved; nor can a nameless form.
  const overWeight = isDraft && draft ? overWeightProblems(draft.sections) : [];
  const blocker = isDraft && draft ? saveBlocker(draft.name, overWeight) : null;

  const refreshList = () => qc.invalidateQueries({ queryKey: ['appraisal-templates'] });
  const show = (t: AppraisalTemplate) => { qc.setQueryData(['appraisal-template', t.id], t); refreshList(); };
  const fail = (e: Error) => setActionError(e.message);

  // "Save draft": the form, then who it's for if that changed (then reloaded, so its checks are fresh).
  // An unsaved copy is created now — and the page moves to it.
  const save = useMutation({
    mutationFn: async (): Promise<AppraisalTemplate> => {
      const targetId = isCopy ? (await createAppraisalTemplate({ name: payload!.name })).id : id;
      const t = await saveAppraisalTemplate(targetId, payload!);
      if (!positionsChanged) return t;
      await setAppraisalTemplatePositions(t.familyId, picked);
      return fetchAppraisalTemplate(targetId);
    },
    onSuccess: t => {
      setActionError('');
      show(t);
      if (isCopy) showToast('Copy saved');
    },
  });
  // A live form's "who it's for" has no draft to wait for — it's saved as soon as it's tapped.
  const livePositions = useMutation({
    mutationFn: (ids: string[]) => setAppraisalTemplatePositions(template!.familyId, ids),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appraisal-template', id] }); refreshList(); },
    onError: () => setPicked(template?.positionIds ?? []),
  });

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const makeLive = useMutation({
    mutationFn: async () => {
      const latest = dirty ? await save.mutateAsync() : template!;
      if (latest.problems.length) return latest;
      return activateAppraisalTemplate(id);
    },
    onSuccess: t => {
      setConfirming(null);
      show(t);
      setActionError('');
      if (t.status === 'ACTIVE') { showToast('Form is live'); navigate(listAt('live')); }
    },
    onError: e => { setConfirming(null); fail(e as Error); },
  });
  const editLive = useMutation({
    mutationFn: () => newAppraisalTemplateVersion(id),
    onSuccess: t => { show(t); navigate(`${LIST_PATH}/${t.id}`); },
    onError: fail,
  });
  const retire = useMutation({
    mutationFn: () => retireAppraisalTemplate(id),
    onSuccess: t => { setConfirming(null); show(t); showToast('Form retired'); navigate(listAt('retired')); },
    onError: e => { setConfirming(null); fail(e as Error); },
  });
  const remove = useMutation({
    mutationFn: () => deleteAppraisalTemplate(id),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['appraisal-template', id] });
      refreshList();
      showToast('Draft deleted');
      navigate(template?.activeId ? `${LIST_PATH}/${template.activeId}` : LIST_PATH);
    },
    onError: e => { setConfirming(null); fail(e as Error); },
  });

  if (isLoading) return <Shell><LoadingSpinner /></Shell>;
  if (error || !template || !draft) {
    return (
      <Shell>
        <p role="alert" style={{ color: C.red, fontSize: 14 }}>{(error as Error | null)?.message ?? 'Couldn’t load this form.'}</p>
        <Link to={LIST_PATH} style={{ color: C.primary, fontSize: 14 }}>Back to Appraisal Forms</Link>
      </Shell>
    );
  }

  const patch = (p: Partial<FormDraft>) => setDraft(d => (d ? { ...d, ...p } : d));
  const tone = STATUS_TONE[template.status];
  const busy = save.isPending || makeLive.isPending || editLive.isPending || retire.isPending || remove.isPending;
  const steps = formSteps({ name: draft.name, overWeight, positionCount: picked.length, stages: draft.stages, problemsByArea: template.problemsByArea });
  const issuesOf = (key: StepKey) => (isDraft ? steps.find(s => s.key === key)!.issues : undefined);
  const saveState: SaveState = save.isPending ? 'saving' : save.isError && dirty ? 'error' : dirty ? 'pending' : 'saved';

  // An unsaved copy can go live too: "Make live" saves it (creating it) first, then confirms.
  const ready = isDraft && steps.every(s => s.issues.length === 0);
  // "Make live" is only pressable when nothing is left to fix; it saves the latest changes, then confirms.
  const onMakeLive = async () => {
    if (dirty && !blocker) {
      try {
        const latest = await save.mutateAsync();
        const target = firstStepToFix(formSteps({ name: draft.name, overWeight, positionCount: latest.positionIds.length, stages: draft.stages, problemsByArea: latest.problemsByArea }));
        if (target) { openTab(target.key); return; }
      } catch (e) { fail(e as Error); return; }
    }
    setConfirming('live');
  };
  const onPick = (ids: string[]) => { setPicked(ids); if (!isDraft) livePositions.mutate(ids); };
  const liveStatus = livePositions.isPending ? 'Saving…' : livePositions.isError ? (livePositions.error as Error).message : livePositions.isSuccess ? 'Saved' : undefined;

  return (
    <Shell>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <button className="back-btn" onClick={goBack} style={backBtn} aria-label="Back" title="Back">
          <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 13 }} />
        </button>
        <Link to={LIST_PATH} style={{ fontSize: 13, color: C.muted, textDecoration: 'none' }}>Appraisal Forms</Link>
      </div>

      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0, overflowWrap: 'anywhere' }}>
            {draft.name || 'Untitled form'}
            {/* The version goes with the name: "Junior Teacher Appraisal V6". */}
            {!isCopy && <span title={`Version ${template.version}`} style={{ fontSize: '0.7em', fontWeight: 700, color: C.muted, background: '#f1f5f9', borderRadius: 6, padding: '1px 6px', marginLeft: 8, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>V{template.version}</span>}
          </h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, fontSize: 13, color: C.muted }}>
            <span style={pill(tone.fg, tone.bg)}>{STATUS_LABEL[template.status]}</span>
            {isCopy && <span>Not saved yet — a copy of “{loaded?.name}”</span>}
            {isDraft && (
              <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: saveState === 'error' ? C.red : C.muted }}>
                · {saveState === 'saved' && <FontAwesomeIcon icon={faCircleCheck} style={{ color: C.green }} />}
                {saveState === 'error' && <FontAwesomeIcon icon={faCircleExclamation} />}
                {saveStatusText(saveState, (save.error as Error | null)?.message)}
              </span>
            )}
          </div>
        </div>
        {isDraft ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {isCopy
              ? <button type="button" style={btn('danger', false, busy)} disabled={busy} onClick={() => navigate(LIST_PATH)}>Discard copy</button>
              : <button type="button" style={btn('danger', false, busy)} disabled={busy} onClick={() => setConfirming('delete')}>Delete draft</button>}
            {/* Off when there's nothing new to save, or while it can't be saved (says why). */}
            <button type="button" style={btn('secondary', false, busy || !dirty || !!blocker)} disabled={busy || !dirty || !!blocker}
              title={blocker ? `Can’t save yet — ${blocker}` : !dirty ? 'No changes to save' : undefined} onClick={() => save.mutate(undefined, { onSuccess: () => navigate(listAt('draft')) })}>
              {save.isPending ? 'Saving…' : 'Save draft'}
            </button>
            <button type="button" style={btn('primary', false, busy || !ready)} disabled={busy || !ready} onClick={onMakeLive}
              title={ready ? undefined : 'Fix what the tabs show first'}>
              {makeLive.isPending ? 'Making live…' : 'Make live'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {template.status === 'ACTIVE' && <button type="button" style={btn('secondary', false, busy)} disabled={busy} onClick={() => setConfirming('retire')}>Retire</button>}
            <button type="button" style={btn('primary', false, busy)} disabled={busy} onClick={() => editLive.mutate()}>
              {template.draftId ? 'Open draft' : editLive.isPending ? 'Opening…' : 'Edit as new version'}
            </button>
          </div>
        )}
      </header>

      <StatusNote template={template} />
      {actionError && <Notice tone="error">{actionError}</Notice>}

      <FormTabs steps={steps} current={tab} onSelect={openTab} showStatus={isDraft} />
      <div role="tabpanel" id={`af-panel-${tab}`} aria-labelledby={`af-tab-${tab}`}>
        {tab === 'basics' && (
          <AboutCard draft={draft} onChange={isDraft ? patch : undefined} issues={issuesOf('basics')}>
            <UsedForField positions={positions} selected={picked} onChange={template.status === 'RETIRED' ? undefined : onPick}
              status={isDraft ? undefined : liveStatus} error={livePositions.isError} />
          </AboutCard>
        )}
        {tab === 'scoring' && (
          <SectionsCard sections={draft.sections} onChange={isDraft ? sections => patch({ sections }) : undefined} issues={issuesOf('scoring')} positionIds={picked} />
        )}
        {tab === 'approval' && (
          <ApprovalChainCard stages={draft.stages} positions={positions} onChange={isDraft ? stages => patch({ stages }) : undefined} issues={issuesOf('approval')} />
        )}
      </div>

      {confirming === 'live' && (
        <ConfirmDialog
          title={`Make version ${template.version} live?`}
          message={template.activeId
            ? `New appraisals will use it. Version ${template.version - 1} retires — appraisals already done keep the version they were scored on.`
            : 'New appraisals for its positions will use this form. A live form can’t be changed — later edits open a new version.'}
          confirmLabel={makeLive.isPending ? 'Making live…' : 'Make live'}
          loading={makeLive.isPending}
          onConfirm={() => makeLive.mutate()}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === 'retire' && (
        <ConfirmDialog
          destructive
          title="Retire this form?"
          message="No new appraisals will use it. Appraisals already done keep it, and you can bring it back later as a new version."
          confirmLabel="Retire"
          loading={retire.isPending}
          onConfirm={() => retire.mutate()}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === 'delete' && (
        <ConfirmDialog
          destructive
          title="Delete this draft?"
          message={template.activeId ? `Version ${template.version - 1} stays live.` : 'The form and its positions are removed.'}
          confirmLabel="Delete"
          loading={remove.isPending}
          onConfirm={() => remove.mutate()}
          onCancel={() => setConfirming(null)}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="m-pad" style={{ padding: '24px 32px 48px', background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: C.text }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>{children}</div>
    </div>
  );
}

/** What this version is and how it relates to the form's other versions. */
function StatusNote({ template: t }: { template: AppraisalTemplate }) {
  if (t.status === 'DRAFT') {
    return t.activeId ? (
      <Notice tone="info">
        Version {t.version - 1} is live. This draft replaces it once you make it live. <Link to={`${LIST_PATH}/${t.activeId}`} style={link}>View live version</Link>
      </Notice>
    ) : null;
  }
  if (t.status === 'ACTIVE') {
    return (
      <Notice tone="info">
        Live forms can’t be changed, so finished appraisals keep the form they were scored on.
        {t.draftId ? ' A draft of the next version is in progress.' : ' Editing opens the next version as a draft.'}
      </Notice>
    );
  }
  return (
    <Notice tone="info">
      Retired — not used for new appraisals.
      {t.activeId && <> A newer version is live. <Link to={`${LIST_PATH}/${t.activeId}`} style={link}>View live version</Link></>}
    </Notice>
  );
}

const NOTICE_TONE = {
  info: { fg: C.sub, bg: '#f1f5f9', border: C.border, icon: faCircleInfo },
  error: { fg: C.red, bg: C.redSoft, border: '#fecaca', icon: faTriangleExclamation },
};

function Notice({ tone, children }: { tone: keyof typeof NOTICE_TONE; children: React.ReactNode }) {
  const t = NOTICE_TONE[tone];
  return (
    <div role={tone === 'info' ? undefined : 'alert'} style={{
      display: 'flex', gap: 8, padding: '12px 16px', marginBottom: 16, borderRadius: 10, fontSize: 14, lineHeight: 1.5,
      color: t.fg, background: t.bg, border: `1px solid ${t.border}`,
    }}>
      <FontAwesomeIcon icon={t.icon} style={{ marginTop: 4 }} />
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

const link: React.CSSProperties = { color: C.primary, fontWeight: 600 };
const backBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.sub,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};
