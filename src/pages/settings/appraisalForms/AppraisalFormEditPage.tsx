import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faCircleExclamation, faCircleInfo, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import {
  activateAppraisalTemplate, deleteAppraisalTemplate, fetchAppraisalTemplate, newAppraisalTemplateVersion,
  retireAppraisalTemplate, saveAppraisalTemplate, type AppraisalTemplate,
} from '../../../api/appraisal-templates.js';
import { fetchPositions } from '../../../api/salary.js';
import ConfirmDialog from '../../../components/common/ConfirmDialog.js';
import { useToast } from '../../../components/common/Toast.js';
import AboutCard from './AboutCard.js';
import ApprovalChainCard from './ApprovalChainCard.js';
import SectionsCard from './SectionsCard.js';
import UsedForCard from './UsedForCard.js';
import { STATUS_LABEL, draftFromTemplate, overWeightProblems, payloadFromDraft, type FormDraft } from './appraisalFormDraft.js';
import { C, STATUS_TONE, btn, pill } from './formTheme.js';

const LIST_PATH = '/settings/appraisal-forms';
type Confirming = 'live' | 'retire' | 'delete' | null;

/** One appraisal form: a draft is edited here; live and retired versions are shown read-only. */
export default function AppraisalFormEditPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { data: template, isLoading, error } = useQuery({
    queryKey: ['appraisal-template', id],
    queryFn: () => fetchAppraisalTemplate(id),
    // A refetch would overwrite unsaved edits.
    refetchOnWindowFocus: false,
  });
  const { data: positions = [] } = useQuery({ queryKey: ['salary-positions'], queryFn: fetchPositions });

  const [draft, setDraft] = useState<FormDraft | null>(null);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [actionError, setActionError] = useState('');

  // Start (or restart) the working copy whenever a different saved version arrives.
  useEffect(() => { if (template) setDraft(draftFromTemplate(template)); }, [template?.id, template?.updatedAt, template?.status]);

  const isDraft = template?.status === 'DRAFT';
  const saved = useMemo(() => (template ? JSON.stringify(payloadFromDraft(draftFromTemplate(template))) : ''), [template]);
  const dirty = !!draft && isDraft && JSON.stringify(payloadFromDraft(draft)) !== saved;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const refreshList = () => qc.invalidateQueries({ queryKey: ['appraisal-templates'] });
  const show = (t: AppraisalTemplate) => { qc.setQueryData(['appraisal-template', t.id], t); refreshList(); };
  const fail = (e: Error) => setActionError(e.message);

  const save = useMutation({
    mutationFn: () => saveAppraisalTemplate(id, payloadFromDraft(draft!)),
    onSuccess: t => { setActionError(''); show(t); showToast('Draft saved'); },
    onError: fail,
  });
  const makeLive = useMutation({
    mutationFn: async () => {
      const latest = dirty ? await saveAppraisalTemplate(id, payloadFromDraft(draft!)) : template!;
      if (latest.problems.length) return latest;
      return activateAppraisalTemplate(id);
    },
    onSuccess: t => {
      setConfirming(null);
      show(t);
      setActionError('');
      if (t.status === 'ACTIVE') showToast('Form is live');
      else window.scrollTo({ top: 0 }); // still a draft: show what's stopping it
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
    onSuccess: t => { setConfirming(null); show(t); showToast('Form retired'); },
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

  if (isLoading) return <Shell><p style={{ color: C.muted, fontSize: 14 }}>Loading…</p></Shell>;
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
  // Weights over 100% are kept as typed but can't be saved — the reason sits beside the buttons.
  const overWeight = isDraft ? overWeightProblems(draft.sections) : [];
  const blocked = busy || overWeight.length > 0;

  return (
    <Shell>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <button className="back-btn" onClick={() => navigate(LIST_PATH)} style={backBtn} aria-label="Back" title="Back">
          <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 13 }} />
        </button>
        <Link to={LIST_PATH} style={{ fontSize: 13, color: C.muted, textDecoration: 'none' }}>Appraisal Forms</Link>
      </div>

      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0, overflowWrap: 'anywhere' }}>{draft.name || 'Untitled form'}</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <span style={pill(tone.fg, tone.bg)}>{STATUS_LABEL[template.status]}</span>
            <span style={{ fontSize: 13, color: C.muted }}>Version {template.version}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isDraft && <button type="button" style={btn('danger', false, busy)} disabled={busy} onClick={() => setConfirming('delete')}>Delete draft</button>}
          {isDraft && (
            <button type="button" style={btn('secondary', false, blocked || !dirty)} disabled={blocked || !dirty} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving…' : dirty ? 'Save draft' : 'Saved'}
            </button>
          )}
          {isDraft && <button type="button" style={btn('primary', false, blocked)} disabled={blocked} onClick={() => setConfirming('live')}>Make live</button>}
          {template.status === 'ACTIVE' && <button type="button" style={btn('secondary', false, busy)} disabled={busy} onClick={() => setConfirming('retire')}>Retire</button>}
          {!isDraft && (
            <button type="button" style={btn('primary', false, busy)} disabled={busy} onClick={() => editLive.mutate()}>
              {template.draftId ? 'Open draft' : editLive.isPending ? 'Opening…' : 'Edit as new version'}
            </button>
          )}
        </div>
      </header>

      <StatusNote template={template} />
      {actionError && <Notice tone="error">{actionError}</Notice>}
      {isDraft && template.problems.length > 0 && (
        <Notice tone="warn" title={dirty ? 'Before it can go live (as last saved)' : 'Before it can go live'}>
          <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>{template.problems.map(p => <li key={p}>{p}</li>)}</ul>
        </Notice>
      )}

      <AboutCard draft={draft} onChange={isDraft ? patch : undefined} />
      <SectionsCard sections={draft.sections} onChange={isDraft ? sections => patch({ sections }) : undefined} />
      <ApprovalChainCard stages={draft.stages} positions={positions} onChange={isDraft ? stages => patch({ stages }) : undefined} />
      <UsedForCard familyId={template.familyId} positionIds={template.positionIds} positions={positions} readOnly={template.status === 'RETIRED'} />

      {(dirty || overWeight.length > 0) && (
        <div style={stickyBar} role="region" aria-label="Unsaved changes">
          {overWeight.length > 0 ? (
            <div role="alert" style={{ flex: '1 1 240px', fontSize: 14, color: C.red, display: 'flex', gap: 8 }}>
              <FontAwesomeIcon icon={faCircleExclamation} style={{ marginTop: 3 }} />
              <div>
                <div style={{ fontWeight: 600 }}>Lower the weights to save</div>
                {overWeight.map(p => <div key={p} style={{ fontSize: 13 }}>{p}</div>)}
              </div>
            </div>
          ) : (
            <span style={{ fontSize: 14, color: C.sub, flex: '1 1 auto' }}>Unsaved changes</span>
          )}
          <button type="button" style={btn('secondary', false, busy)} disabled={busy} onClick={() => setDraft(draftFromTemplate(template))}>Discard</button>
          <button type="button" style={btn('primary', false, blocked)} disabled={blocked} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save draft'}</button>
        </div>
      )}

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
  warn: { fg: C.amber, bg: C.amberSoft, border: '#fde68a', icon: faTriangleExclamation },
  error: { fg: C.red, bg: C.redSoft, border: '#fecaca', icon: faTriangleExclamation },
};

function Notice({ tone, title, children }: { tone: keyof typeof NOTICE_TONE; title?: string; children: React.ReactNode }) {
  const t = NOTICE_TONE[tone];
  return (
    <div role={tone === 'info' ? undefined : 'alert'} style={{
      display: 'flex', gap: 8, padding: '12px 16px', marginBottom: 16, borderRadius: 10, fontSize: 14, lineHeight: 1.5,
      color: t.fg, background: t.bg, border: `1px solid ${t.border}`,
    }}>
      <FontAwesomeIcon icon={t.icon} style={{ marginTop: 4 }} />
      <div style={{ minWidth: 0 }}>
        {title && <div style={{ fontWeight: 600 }}>{title}</div>}
        {children}
      </div>
    </div>
  );
}

const link: React.CSSProperties = { color: C.primary, fontWeight: 600 };
const backBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.sub,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};
const stickyBar: React.CSSProperties = {
  position: 'sticky', bottom: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '12px 16px',
  background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
};
