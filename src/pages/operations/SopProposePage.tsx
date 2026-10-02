import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft, faCheck, faPlus, faChevronRight, faTrash, faGripVertical, faVideo, faPen,
  faXmark, faLayerGroup, faArrowUp, faArrowDown,
} from '@fortawesome/free-solid-svg-icons';
import { fetchTemplates } from '../../api/sop-templates.js';
import { fetchSteps } from '../../api/sop-steps.js';
import { fetchCategories } from '../../api/sop-categories.js';
import { fetchSections } from '../../api/sop-sections.js';
import { createRevision, fetchRevision, updateRevision, approveRevision, ProposedStep } from '../../api/sop-revisions.js';
import { useToast } from '../../components/common/Toast.js';
import { ALLOWED_SOP_ICONS, resolveSopIcon } from '../../utils/sopTemplateIcons.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { TEACHER_CONTENT_TOP } from '../../components/common/TeacherTopBar.js';
import { TEACHER_NAV_SPACE } from '../../components/common/TeacherMobileNav.js';

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eef0f4',
  divider: '#f1f5f9',
  text: '#0f172a',
  textSub: '#475569',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
  primaryBorder: '#c7d2fe',
  danger: '#dc2626',
};
// The teacher app's own accent + font, applied instead of C's indigo/
// system-ui when this page is reached from its Guides tab on mobile (see
// themeIsTeacher below) — matches TeacherHomePage.tsx / TeacherTopBar.tsx.
const TEACHER_ACCENT = { accent: '#7c3aed', soft: '#f5f3ff', border: '#ddd6fe' };
const TEACHER_FONT =
  '"Segoe UI", Roboto, Arial, sans-serif';
const RADIUS = 14;
const SHADOW = '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)';
const NAVBAR_HEIGHT = 50;
const SECTION_ACCENTS = ['#5a67d8', '#0d9488', '#b45309', '#be185d', '#0369a1', '#7c3aed'];

// "faClipboardCheck" → "Clipboard Check" — a real label for screen
// readers on the icon-picker buttons, which otherwise carry no text at
// all (just a glyph), so a name is the only way to tell them apart.
function iconLabel(name: string): string {
  return name.replace(/^fa/, '').replace(/([A-Z])/g, ' $1').trim();
}

// A line only becomes a bullet if it was actually typed as one ("- …") —
// matches the admin's own step table exactly (see SopTemplateStepsPage.tsx).
function renderDetailLines(lines: string[]): React.ReactNode[] {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} style={s.detailList}>
        {bullets.map((line, i) => <li key={i}>{line}</li>)}
      </ul>,
    );
    bullets = [];
  };
  lines.forEach(line => {
    const m = /^-\s*(.*)$/.exec(line);
    if (m) {
      bullets.push(m[1]);
    } else {
      flushBullets();
      blocks.push(<p key={`p-${blocks.length}`} style={s.detailPara}>{line}</p>);
    }
  });
  flushBullets();
  return blocks;
}

interface DraftStep extends ProposedStep {
  key: string;
}
let keySeq = 0;

// Add/edit happens in a side panel, same as the admin's own step editor —
// not inline in the list, so composing one step's wording doesn't visually
// compete with the rest of the (possibly long) list.
type StepDrawerState =
  | { mode: 'closed' }
  | { mode: 'new'; insertAfterKey?: string }
  | { mode: 'edit'; key: string };

// Proposing a change never touches the live SOP directly — everything here
// is local state until submit, which posts one full snapshot as a
// SopTemplateRevision. A supervisor approving it is what actually creates/
// updates the real SopTemplate + SopStep rows (see sop-revisions.controller.ts).
export default function SopProposePage() {
  const { templateId } = useParams<{ templateId?: string }>();
  const isEditingExisting = !!templateId;
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { isMobile } = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  // Reached via the teacher app's Guides tab (see TeacherMobileNav.tsx and
  // SopLibraryPage.tsx / SopTemplateStepsPage.tsx's context propagation) —
  // keeps the floating TeacherTopBar/TeacherMobileNav showing here too
  // instead of the admin Navbar (App.tsx's isTeacherSurface).
  const fromTeacherApp = searchParams.get('app') === 'teacher';
  const previewingTeacher = import.meta.env.DEV && searchParams.get('previewTeacher') === '1';
  const contextParams = new URLSearchParams();
  if (previewingTeacher) contextParams.set('previewTeacher', '1');
  if (fromTeacherApp) contextParams.set('app', 'teacher');
  const contextSuffix = contextParams.size > 0 ? `?${contextParams.toString()}` : '';

  // "Duplicate this guide" (SopTemplateStepsPage.tsx) and "Copy into my own
  // draft" (HrSopRevisionReviewPage.tsx) / "My Drafts → continue editing"
  // (HrSopRevisionsPage.tsx) all land here via query param, never the
  // :templateId route param — that param always means "edit this guide
  // in place" (isEditingExisting above), which is the one thing neither
  // of these should do.
  const duplicateFrom = searchParams.get('duplicateFrom');
  const fromRevisionId = searchParams.get('fromRevision');
  const rawUser = localStorage.getItem('user');
  const currentUser = rawUser ? (JSON.parse(rawUser) as { id?: string }) : null;
  const { isAdmin, hasView } = usePermissions();
  // A supervisor already holds the approval permission this whole flow's
  // decisions are gated on — Save Draft / Publish Now (see the footer
  // below) replace the plain teacher's single "Submit for approval" for
  // exactly this reason. ADMIN/SUPERADMIN roles bypass OPERATION_SOP_APPROVE
  // entirely on the backend (requireView short-circuits for them — see
  // auth.middleware.ts), so they need the same OR here, or a platform admin
  // using "Add How-To Guide" would fall through to "Submit for approval"
  // and need to approve their own submission as a separate step.
  const canSelfPublish = isAdmin || hasView('OPERATION_SOP_APPROVE');

  const { data: allTemplates = [] } = useQuery({ queryKey: ['sop-templates'], queryFn: () => fetchTemplates() });
  const target = isEditingExisting ? allTemplates.find(t => t.id === templateId) : null;
  const { data: liveSteps = [], isLoading: stepsLoading } = useQuery({
    queryKey: ['sop-steps', templateId],
    queryFn: () => fetchSteps(templateId!),
    enabled: isEditingExisting,
  });
  const duplicateSource = duplicateFrom ? allTemplates.find(t => t.id === duplicateFrom) : null;
  const { data: duplicateSourceSteps = [], isLoading: duplicateStepsLoading } = useQuery({
    queryKey: ['sop-steps', duplicateFrom],
    queryFn: () => fetchSteps(duplicateFrom!),
    enabled: !!duplicateFrom,
  });
  const { data: sourceRevision, isLoading: sourceRevisionLoading } = useQuery({
    queryKey: ['sop-revision', fromRevisionId],
    queryFn: () => fetchRevision(fromRevisionId!),
    enabled: !!fromRevisionId,
  });
  const { data: allCategories = [] } = useQuery({ queryKey: ['sop-categories'], queryFn: () => fetchCategories() });
  const { data: globalSections = [] } = useQuery({ queryKey: ['sop-sections'], queryFn: () => fetchSections() });

  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [icon, setIcon] = useState<string>(ALLOWED_SOP_ICONS[0]);
  // Teacher mobile only — the icon picker moved from a cramped inline
  // scroll row into a proper full-grid bottom sheet (see the redesigned
  // Title+Icon row below).
  const [iconSheetOpen, setIconSheetOpen] = useState(false);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [saving, setSaving] = useState(false);
  // Set only when resuming the supervisor's OWN unpublished DRAFT (see the
  // fromRevision prefill effect below) — every subsequent Save Draft then
  // updates this same row instead of creating a new one each time.
  // Staying null (duplicating a live guide, copying someone else's pending
  // submission, or a plain teacher's proposal) means the first save always
  // creates a brand-new revision, leaving whatever was copied from untouched.
  const [workingRevisionId, setWorkingRevisionId] = useState<string | null>(null);
  // Improving an existing How-To Guide only ever touches Steps — title,
  // goal, video, and labels are the admin's to own, not part of what a
  // teacher is proposing here (they're carried through unchanged in the
  // submitted snapshot). A brand-new proposal is the only flow that still
  // needs the Basic info step, since there's nothing to carry through yet.
  const [wizardStep, setWizardStep] = useState<1 | 2>(isEditingExisting ? 2 : 1);
  const showBasicInfo = !isEditingExisting && wizardStep === 1;
  const showSteps = isEditingExisting || wizardStep === 2;
  // App.tsx's ProtectedLayout resets its scroll container to the top on
  // every `pathname` change — but Next/Back here only ever change this
  // component's own wizardStep, same pathname throughout, so that reset
  // never fires. Whatever scroll position Basic info was left at (e.g.
  // from filling in the bottom fields of a tall form) was carrying
  // straight over into Steps unchanged — on a page this much shorter,
  // that was enough to land Steps already scrolled, with its first
  // section heading passing right under the floating collapsed-title
  // pill on the very first render. `scrollIntoView` finds and resets
  // whichever ancestor is actually the real scroll container without
  // this component needing a ref to it (it doesn't own that div).
  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' });
  }, [wizardStep]);
  // Mirrored into the URL (replacing history, not pushing) purely so
  // TeacherTopBar.tsx's title resolver — which only ever sees pathname
  // and search, not this component's own state — can show "Basic
  // info"/"Steps" instead of the generic "Suggest a Guide" once you're
  // actually past the title screen.
  useEffect(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (wizardStep === 2) next.set('step', '2'); else next.delete('step');
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardStep]);
  // The other direction of that same mirror: TeacherTopBar's own back
  // chevron, while on Steps, now navigates to this same route with the
  // `step` param dropped (see teacherSopTopBar) instead of leaving the
  // wizard entirely — that's a real navigation into this already-mounted
  // page, not a remount, so wizardStep needs to notice the URL changed
  // out from under it and step back down. A no-op the rest of the time
  // (Next/Back already keep wizardStep and the URL in lockstep via the
  // effect above), so this never fights it.
  useEffect(() => {
    if (isEditingExisting) return;
    const paramStep = searchParams.get('step') === '2' ? 2 : 1;
    setWizardStep(prev => (prev === paramStep ? prev : paramStep));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const hasPrefillSource = isEditingExisting || !!duplicateFrom || !!fromRevisionId;
  const [prefilled, setPrefilled] = useState(!hasPrefillSource);

  // Seed the draft from the live SOP exactly once, as soon as both the
  // template and its steps have loaded — editing after that is purely
  // local state, never touching live data again until submit.
  useEffect(() => {
    if (prefilled || !isEditingExisting || !target || stepsLoading) return;
    setTitle(target.title);
    setGoal(target.goal ?? '');
    setVideoUrl(target.videoUrl ?? '');
    setIcon(target.icon);
    setCategoryIds((target.categories ?? []).map(c => c.id));
    setSteps(
      liveSteps.length > 0
        ? [...liveSteps].sort((a, b) => a.displayOrder - b.displayOrder).map(st => ({
            key: st.id, section: st.section, title: st.title, detail: st.detail ?? '',
          }))
        : [],
    );
    setPrefilled(true);
  }, [prefilled, isEditingExisting, target, stepsLoading, liveSteps]);

  // "Duplicate this guide" — seed from an existing LIVE guide's content,
  // but deliberately never touch sopTemplateId/isEditingExisting: submit
  // always creates an independent new guide, the source is left alone.
  useEffect(() => {
    if (prefilled || !duplicateFrom || !duplicateSource || duplicateStepsLoading) return;
    setTitle(`Copy of ${duplicateSource.title}`);
    setGoal(duplicateSource.goal ?? '');
    setVideoUrl(duplicateSource.videoUrl ?? '');
    setIcon(duplicateSource.icon);
    setCategoryIds((duplicateSource.categories ?? []).map(c => c.id));
    setSteps(
      duplicateSourceSteps.length > 0
        ? [...duplicateSourceSteps].sort((a, b) => a.displayOrder - b.displayOrder).map(st => ({
            key: `k${keySeq++}`, section: st.section, title: st.title, detail: st.detail ?? '',
          }))
        : [],
    );
    setPrefilled(true);
  }, [prefilled, duplicateFrom, duplicateSource, duplicateStepsLoading, duplicateSourceSteps]);

  // "Copy into my own draft" (a pending teacher submission on the review
  // page) and "My Drafts → continue editing" both land here the same way —
  // seed from an existing SopTemplateRevision's stored content. Which one
  // this actually is gets decided purely by ownership + status, not a
  // separate mode flag: my own still-unpublished DRAFT is a real resume
  // (workingRevisionId tracks it so Save Draft updates the same row);
  // anything else (someone else's proposal, or any non-draft) is just a
  // content seed — the first save creates a brand-new revision instead.
  useEffect(() => {
    if (prefilled || !fromRevisionId || !sourceRevision) return;
    setTitle(sourceRevision.title);
    setGoal(sourceRevision.goal ?? '');
    setVideoUrl(sourceRevision.videoUrl ?? '');
    setIcon(sourceRevision.icon ?? ALLOWED_SOP_ICONS[0]);
    setCategoryIds(sourceRevision.categoryIdsJson ?? []);
    setSteps(
      sourceRevision.stepsJson.map(st => ({
        key: `k${keySeq++}`, section: st.section, title: st.title, detail: st.detail ?? '',
      })),
    );
    if (currentUser?.id && sourceRevision.proposedByUserId === currentUser.id && sourceRevision.status === 'DRAFT') {
      setWorkingRevisionId(sourceRevision.id);
    }
    setPrefilled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilled, fromRevisionId, sourceRevision]);

  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!categoryMenuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(e.target as Node)) setCategoryMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [categoryMenuOpen]);
  const toggleCategory = (id: string) => {
    setCategoryIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Org-wide picker list (Settings → Operation → How-To Guide Sections) — same
  // rule as the admin's own add-step panel, not invented per-proposal.
  const existingSections = globalSections.map(s => s.name);

  const removeStep = (key: string) => setSteps(prev => prev.filter(s => s.key !== key));

  // Canonical org-wide order (Pre-shift Preparation → Main Process →
  // Exception Handling, per globalSections' own displayOrder) — NOT the
  // order sections happened to receive their first step, which would make
  // the grouped view reshuffle every time a proposal adds steps in a
  // different sequence. Any section not in the global list (a stale/custom
  // one) falls back to first-appearance order, appended after the canonical set.
  const usedSections = useMemo(() => {
    const present = new Set(steps.map(st => st.section));
    const canonical = globalSections.map(sec => sec.name).filter(name => present.has(name));
    const extras = [...present].filter(name => !canonical.includes(name));
    return [...canonical, ...extras];
  }, [steps, globalSections]);
  const sectionAccent = (section: string) => SECTION_ACCENTS[usedSections.indexOf(section) % SECTION_ACCENTS.length];
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const sectionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const st of steps) map.set(st.section, (map.get(st.section) ?? 0) + 1);
    return map;
  }, [steps]);
  // "All sections" clusters steps by section (matching the admin's own
  // grouped view) rather than raw insertion order, so the list always reads
  // as one section fully, then the next.
  const displaySteps = useMemo(() => {
    if (sectionFilter !== 'ALL') return steps.filter(st => st.section === sectionFilter);
    const bySection = new Map<string, DraftStep[]>();
    for (const st of steps) {
      if (!bySection.has(st.section)) bySection.set(st.section, []);
      bySection.get(st.section)!.push(st);
    }
    return usedSections.flatMap(sec => bySection.get(sec) ?? []);
  }, [steps, sectionFilter, usedSections]);

  // Drag-to-reorder, same interaction as the admin's own steps table
  // (grip handle, not up/down buttons). Reorders against displaySteps —
  // whatever's actually on screen — never the raw steps array, so a drag
  // always lands exactly where it visually appears to. Local state only;
  // nothing is persisted until the whole proposal is submitted.
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const onDragStart = (key: string) => (e: React.DragEvent) => {
    setDragKey(key);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (key: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropKey !== key) setDropKey(key);
  };
  const onDragEnd = () => { setDragKey(null); setDropKey(null); };
  const onDrop = (targetKey: string) => (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragKey || dragKey === targetKey) { onDragEnd(); return; }
    const displayKeys = displaySteps.map(s => s.key);
    const fromIdx = displayKeys.indexOf(dragKey);
    const toIdx = displayKeys.indexOf(targetKey);
    onDragEnd();
    if (fromIdx < 0 || toIdx < 0) return;
    const reordered = [...displayKeys];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    // Substitute back into the same slots the display subset originally
    // occupied in the full array — anything outside the current filter
    // (a different section) keeps its exact position untouched.
    const displaySet = new Set(displayKeys);
    const byKey = new Map(steps.map(s => [s.key, s]));
    let cursor = 0;
    setSteps(prev => prev.map(s => (displaySet.has(s.key) ? byKey.get(reordered[cursor++])! : s)));
  };

  // HTML5 drag-and-drop (the grip handle above) never fires from a touch
  // gesture — there's no mobile equivalent without a gesture polyfill —
  // so the mobile card list gets explicit Move up/down buttons instead.
  // Same "splice within displayKeys, substitute back into the full
  // array" logic as onDrop, just with the target computed from direction
  // instead of a drop event.
  const moveStep = (key: string, direction: -1 | 1) => {
    const displayKeys = displaySteps.map(s => s.key);
    const fromIdx = displayKeys.indexOf(key);
    const toIdx = fromIdx + direction;
    if (fromIdx < 0 || toIdx < 0 || toIdx >= displayKeys.length) return;
    const reordered = [...displayKeys];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const displaySet = new Set(displayKeys);
    const byKey = new Map(steps.map(s => [s.key, s]));
    let cursor = 0;
    setSteps(prev => prev.map(s => (displaySet.has(s.key) ? byKey.get(reordered[cursor++])! : s)));
  };

  const [drawer, setDrawer] = useState<StepDrawerState>({ mode: 'closed' });
  const editingStep = drawer.mode === 'edit' ? steps.find(s => s.key === drawer.key) ?? null : null;
  const closeDrawer = () => setDrawer({ mode: 'closed' });
  const saveDrawerStep = (section: string, title: string, detail: string) => {
    if (drawer.mode === 'edit') {
      const key = drawer.key;
      setSteps(prev => prev.map(s => s.key === key ? { ...s, section, title, detail } : s));
    } else {
      const newStep: DraftStep = { key: `k${keySeq++}`, section, title, detail };
      const insertAfterKey = drawer.mode === 'new' ? drawer.insertAfterKey : undefined;
      setSteps(prev => {
        const idx = insertAfterKey ? prev.findIndex(s => s.key === insertAfterKey) : -1;
        if (idx === -1) return [...prev, newStep];
        const next = [...prev];
        next.splice(idx + 1, 0, newStep);
        return next;
      });
    }
    closeDrawer();
  };

  const backTo = () => navigate(isEditingExisting ? `/operations/sops/${templateId}${contextSuffix}` : `/operations/sops${contextSuffix}`);
  // "Cancel"/back-arrow, unlike a post-submit redirect, needs real history:
  // this page is now reachable from more places than just the Guides list
  // (the Author Guides hub's "Start a new guide" and "Improve an existing
  // guide", plus duplicateFrom/fromRevision entry points) — hardcoding the
  // list as "back" stranded anyone who arrived from one of those instead.
  // Same bug class already fixed on SopTemplateFormPage.tsx and across the
  // teacher app's TeacherTopBar spokes. `location.key === 'default'` means
  // this is the first entry in the tab's history (fresh load/deep link),
  // where there's nothing to go back to.
  const goBack = () => {
    if (location.key !== 'default') navigate(-1);
    else backTo();
  };

  const cleanSteps: ProposedStep[] = steps
    .filter(s => s.title.trim())
    .map(s => ({ section: s.section.trim() || 'General', title: s.title.trim(), detail: (s.detail ?? '').trim() || null }));

  const submit = async () => {
    if (!title.trim() || !goal.trim() || cleanSteps.length === 0) return;
    setSaving(true);
    try {
      await createRevision({
        sopTemplateId: templateId ?? null,
        title: title.trim(),
        goal: goal.trim() || null,
        videoUrl: videoUrl.trim() || null,
        icon,
        steps: cleanSteps,
        categoryIds,
      });
      qc.invalidateQueries({ queryKey: ['sop-revisions'] });
      showToast('Submitted for supervisor approval');
      backTo();
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to submit', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Create-or-update depending on whether a working revision already
  // exists (resuming a draft, or a second Save Draft click within the
  // same visit after the first one created it) — returns the id either
  // way. Shared by both Save Draft and Publish Now below.
  const persistDraft = async (asDraft: boolean): Promise<string> => {
    const payload = {
      title: title.trim(),
      goal: goal.trim() || null,
      videoUrl: videoUrl.trim() || null,
      icon,
      steps: cleanSteps,
      categoryIds,
    };
    if (workingRevisionId) {
      await updateRevision(workingRevisionId, payload);
      return workingRevisionId;
    }
    const created = await createRevision({ ...payload, sopTemplateId: templateId ?? null, asDraft });
    setWorkingRevisionId(created.id);
    return created.id;
  };

  const doSaveDraft = async () => {
    if (!title.trim() || cleanSteps.length === 0) return;
    setSaving(true);
    try {
      await persistDraft(true);
      qc.invalidateQueries({ queryKey: ['sop-revisions'] });
      showToast('Draft saved');
      navigate(`/operations/sops/author${contextSuffix}`);
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to save draft', 'error');
    } finally {
      setSaving(false);
    }
  };

  const doPublishNow = async () => {
    if (!title.trim() || !goal.trim() || cleanSteps.length === 0) return;
    setSaving(true);
    try {
      const id = await persistDraft(false);
      const approved = await approveRevision(id);
      qc.invalidateQueries({ queryKey: ['sop-revisions'] });
      qc.invalidateQueries({ queryKey: ['sop-templates'] });
      qc.invalidateQueries({ queryKey: ['sop-steps'] });
      showToast(isEditingExisting ? 'Published — now live' : 'Guide published');
      navigate(`/operations/sops/${approved.sopTemplateId}${contextSuffix}`);
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to publish', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Longhand only when mobile — never mix the `padding` shorthand with a
  // `paddingTop` override in the same style object (React can drop the
  // longhand on re-render). Desktop keeps s.page's shorthand untouched;
  // fromTeacherApp only matters on mobile, since desktop always shows the
  // normal admin chrome regardless (see App.tsx's isTeacherSurface).
  // Reached from the teacher app's Guides tab, on the phone-sized surface
  // where that app's own chrome is showing (see App.tsx's isTeacherSurface)
  // — the only case where this shared page should also pick up the teacher
  // app's violet look instead of its own admin indigo one.
  const themeIsTeacher = fromTeacherApp && isMobile;
  const sopAccentVars = {
    '--sop-accent': themeIsTeacher ? TEACHER_ACCENT.accent : C.primary,
    '--sop-accent-soft': themeIsTeacher ? TEACHER_ACCENT.soft : C.primarySoft,
    '--sop-accent-border': themeIsTeacher ? TEACHER_ACCENT.border : C.primaryBorder,
  } as React.CSSProperties;
  // s.input's 13px font-size is fine on desktop, but iOS Safari auto-
  // zooms the whole page on focus for any text input under 16px — a
  // jarring, well-known mobile bug. Bumped to 16px here (plus a bit
  // more breathing room to match) for every text field/textarea a
  // teacher can actually type into, on this page and the step drawer.
  const inputStyle: React.CSSProperties = themeIsTeacher
    ? { ...s.input, fontSize: 16, padding: '11px 14px', borderRadius: 12 }
    : s.input;

  const pageStyle: React.CSSProperties = isMobile
    ? {
        paddingTop: fromTeacherApp ? TEACHER_CONTENT_TOP : 16,
        paddingRight: 12,
        paddingBottom: 16,
        paddingLeft: 12,
        fontFamily: themeIsTeacher ? TEACHER_FONT : 'system-ui, -apple-system, "Segoe UI", sans-serif',
        // No minHeight:100vh here — the ancestor scroll container
        // (App.tsx's ProtectedLayout) already wraps this page in its
        // own flex:1, background:#f8fafc box, so the gray fill is
        // already guaranteed full-height. Forcing this page to ALSO
        // be 100vh tall just stretched a short form (like Basic info)
        // into a large dead gap between its buttons and the floating
        // bottom nav — the fill was never this page's job to begin with.
        color: C.text,
        ...sopAccentVars,
      }
    : { ...s.page, ...sopAccentVars };
  // The side drawer below is `position: fixed` from a fixed top offset —
  // normally the admin Navbar's height, but the floating TeacherTopBar
  // doesn't reserve real layout space, so the drawer can safely start at
  // the very top there instead.
  const drawerTopOffset = fromTeacherApp && isMobile ? 0 : NAVBAR_HEIGHT;

  return (
    <div style={pageStyle} ref={topRef}>
      {/* hover-only guard — without it, tapping on a touchscreen triggers
          :hover with no mouse ever "leaving" to clear it, leaving the
          last-tapped element stuck highlighted. */}
      <style>{`
        .sop-pill-scroll::-webkit-scrollbar { display: none; }
        @media (hover: hover) { .sop-propose-cat:hover { border-color: ${'var(--sop-accent)'} !important; color: ${'var(--sop-accent)'} !important; } }
      `}</style>
      {/* Basic info is a compact form and stays narrow/centered like one —
          Steps is the same grouped table the admin's real page renders, so
          it gets that page's exact width instead of being squeezed into the
          form's column. */}
      <div style={{ ...s.inner, ...(showSteps ? s.innerWide : {}) }}>
        {/* Reached from the teacher app, the floating TeacherTopBar
            already shows a back chevron + "Suggest an Edit"/"Suggest a
            Guide" as the page title — this in-page back link and H1
            would just repeat both right underneath. The explanatory
            line stays (real, non-redundant information), just without
            the heading floating above it. */}
        {!themeIsTeacher && (
          <button onClick={goBack} style={s.backBtn}>
            <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: 6, fontSize: 11 }} />
            {isEditingExisting ? target?.title ?? 'Back' : 'Back'}
          </button>
        )}

        <div style={{ marginBottom: 20 }}>
          {/* Teacher mode used to drop this whole block — the floating
              TeacherTopBar's own small title ("Basic info"/"Steps") was
              judged enough on its own. It isn't: that title only shows
              once scrolled (titleMovedToPage suppresses it at rest, same
              as every other teacher page), so at rest — exactly when you
              land here — there was no title at all. Same content as
              admin now, just the app's own left-aligned magazine-style
              H1 instead of the desktop heading. */}
          <h1 style={themeIsTeacher ? sTeacher.heading : s.heading}>
            {themeIsTeacher
              ? (isEditingExisting ? (canSelfPublish ? 'Edit This Guide' : 'Suggest an Edit') : (canSelfPublish ? 'Add a Guide' : 'Suggest a Guide'))
              : (isEditingExisting ? (canSelfPublish ? 'Edit How-To Guide' : 'Suggest an Improvement') : (canSelfPublish ? 'Add a New How-To Guide' : 'Suggest a New How-To Guide'))}
          </h1>
          {/* Dropped entirely for the teacher new-guide wizard (both
              steps) — the H1 + "STEP X OF 2" caption already carry
              enough orientation on a screen this tight on room; this
              line was just extra text between the title and the first
              real field. Suggest-an-Edit keeps it (single step, and the
              "improve together" framing there isn't said anywhere
              else). Admin/desktop is untouched — plenty of width to
              spare, not what was asked about. */}
          {(!themeIsTeacher || isEditingExisting) && (
            <p style={themeIsTeacher ? sTeacher.subheading : s.subheading}>
              {isEditingExisting
                ? (canSelfPublish
                  ? 'Save a draft to keep working, or publish to update the live guide immediately.'
                  : "Improve it together, follow it together — this won't change the current How-To Guide until a supervisor reviews and approves it.")
                : (canSelfPublish
                  ? 'Save a draft to keep working, or publish to add it to How-To Guides immediately.'
                  : 'A supervisor reviews and approves this before it appears in How-To Guides.')}
            </p>
          )}
          {!isEditingExisting && (
            <p style={themeIsTeacher ? sTeacher.stepCaption : {
              margin: '8px 0 0', fontSize: 11.5, fontWeight: 700, color: 'var(--sop-accent)',
              textTransform: 'uppercase' as const, letterSpacing: '0.04em',
            }}>
              Step {wizardStep} of 2 — {wizardStep === 1 ? 'Basic info' : 'Steps'}
            </p>
          )}
        </div>

        {isEditingExisting && !prefilled ? (
          <p style={{ color: C.mutedSoft, fontSize: 13 }}>Loading current version…</p>
        ) : (
          <>
            {showBasicInfo && (
            // Teacher mobile drops the bordered/shadowed card wrapper
            // entirely — every field inside it (input, textarea) already
            // has its own white background + border, so wrapping the
            // whole group in a second white box was a literal card
            // nested inside another card. Flat instead: fields sit
            // directly on the page background, separated by a plain
            // divider line (last field omits it). Admin/desktop keeps
            // the original card — no topbar/nav chrome there competing
            // for the same "boxed section" visual language.
            <div style={themeIsTeacher ? undefined : { ...s.card, ...(isMobile ? sMobile.card : null) }}>
              {themeIsTeacher ? (
                // Redesigned: Title + Icon as one row instead of two
                // stacked fields. The icon tile uses the exact same
                // size/colors as a real row in the Guides list
                // (SopLibraryPage.tsx's catIconWrap) — so this isn't
                // just an input, it's a live preview of how the guide
                // will actually look once it's published. The old
                // inline icon-scroll row (7 cramped 44px squares, most
                // of the 50 options never seen without scrolling) moves
                // into a proper full-grid bottom sheet, tapped open via
                // the pencil badge on the tile.
                <div style={sTeacher.field}>
                  <label style={s.label}>Title<span style={s.requiredMark}>*</span></label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => setIconSheetOpen(true)}
                      aria-label={`Change icon — currently ${iconLabel(icon)}`}
                      style={{
                        position: 'relative', width: 52, height: 52, borderRadius: 15,
                        border: 'none', padding: 0, flexShrink: 0, cursor: 'pointer',
                        background: 'var(--sop-accent-soft)', color: 'var(--sop-accent)', fontSize: 20,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <FontAwesomeIcon icon={resolveSopIcon(icon)} />
                      <span style={{
                        position: 'absolute', bottom: -3, right: -3, width: 21, height: 21, borderRadius: '50%',
                        background: '#fff', border: `1.5px solid ${C.cardBorder}`, color: C.muted, fontSize: 9,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 1px 2px rgba(15,23,42,0.08)',
                      }}>
                        <FontAwesomeIcon icon={faPen} />
                      </span>
                    </button>
                    <input
                      type="text" value={title} onChange={e => setTitle(e.target.value)}
                      placeholder="e.g. Picking" style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div style={s.field}>
                    <label style={s.label}>Title<span style={s.requiredMark}>*</span></label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Picking" style={inputStyle} />
                  </div>

                  <div style={s.field}>
                    <label style={s.label}>Icon</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                      {ALLOWED_SOP_ICONS.map(name => {
                        const ic = resolveSopIcon(name);
                        const active = icon === name;
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => setIcon(name)}
                            aria-label={iconLabel(name)}
                            aria-pressed={active}
                            style={{
                              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: active ? 'var(--sop-accent-soft)' : '#fff',
                              border: `2px solid ${active ? 'var(--sop-accent)' : C.cardBorder}`,
                              color: active ? 'var(--sop-accent)' : C.muted,
                              fontSize: 16, cursor: 'pointer',
                              transition: 'all 150ms ease',
                            }}
                          >
                            <FontAwesomeIcon icon={ic} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              <div style={themeIsTeacher ? sTeacher.field : s.field}>
                <label style={s.label}>
                  Goal<span style={s.requiredMark}>*</span>
                  <span style={s.labelHint}>What does this procedure exist to ensure?</span>
                </label>
                <textarea
                  value={goal}
                  onChange={e => setGoal(e.target.value)}
                  placeholder="e.g. Every picked item matches the order exactly, every time."
                  style={{ ...inputStyle, minHeight: 90, resize: 'vertical' as const }}
                />
              </div>

              <div style={themeIsTeacher ? sTeacher.field : s.field}>
                <label style={s.label}>
                  <FontAwesomeIcon icon={faVideo} style={{ marginRight: 5, fontSize: 11 }} />
                  Video
                  <span style={s.labelHint}>Optional link to a training video.</span>
                </label>
                <input type="text" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" style={inputStyle} />
              </div>

              <div style={themeIsTeacher ? sTeacher.lastField : { ...s.field, marginBottom: 0 }} ref={categoryMenuRef}>
                <label style={s.label}>
                  Categories
                  <span style={s.labelHint}>Optional — helps teachers find this guide later.</span>
                </label>
                <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap' as const, alignItems: 'center', gap: 7 }}>
                  {allCategories.filter(c => categoryIds.includes(c.id)).map(c => (
                    <span key={c.id} style={{ ...s.categoryChip, background: `${c.color}1a`, color: c.color, border: `1px solid ${c.color}40` }}>{c.name}</span>
                  ))}
                  <button type="button" className="sop-propose-cat" onClick={() => setCategoryMenuOpen(o => !o)} style={s.categoryAddChip}>
                    <FontAwesomeIcon icon={faPlus} style={{ fontSize: 9, marginRight: 5 }} />
                    Label
                  </button>
                  {categoryMenuOpen && (
                    <div style={s.categoryMenu}>
                      {allCategories.length === 0 ? (
                        <div style={{ padding: '10px 12px', fontSize: 12, color: C.mutedSoft }}>No categories yet.</div>
                      ) : (
                        allCategories.map(c => {
                          const active = categoryIds.includes(c.id);
                          return (
                            <button key={c.id} type="button" onClick={() => toggleCategory(c.id)} style={s.categoryMenuItem}>
                              <span style={{ ...s.categoryCheckbox, ...(active ? { background: c.color, borderColor: c.color } : {}) }}>
                                {active && <FontAwesomeIcon icon={faCheck} style={{ fontSize: 8, color: '#fff' }} />}
                              </span>
                              <span style={{ ...s.categoryDot, background: c.color }} />
                              <span>{c.name}</span>
                            </button>
                          );
                        })
                      )}
                      {/* Admin-only destination — same reasoning as
                          "Manage sections" below: a plain teacher
                          proposing a guide has no reason (or access) to
                          manage the org-wide category list. */}
                      {!themeIsTeacher && (
                        <Link to="/settings/sop-categories" style={s.categoryManageLink} onClick={() => setCategoryMenuOpen(false)}>
                          Manage categories
                          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, marginLeft: 6 }} />
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            )}

            {/* Recap of step 1 — title/icon/labels/purpose stay visible
                while working on steps, same as the admin's real detail page
                keeps them above its own Steps section. Only for a brand-new
                proposal, where the pencil can jump back to step 1 to change
                them — an improvement to an existing guide never edits this
                (it's carried through unchanged), so there's nothing to
                recap or an edit affordance to offer. Teacher mobile skips
                it too — on a screen this short on room it's a full card
                just to repeat what you typed a moment ago; "Back" (in the
                footer) still gets you to step 1 to change any of it. */}
            {!themeIsTeacher && !isEditingExisting && wizardStep === 2 && (
              <div style={{ ...s.card, ...(isMobile ? sMobile.card : null), display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={s.recapIcon}>
                  <FontAwesomeIcon icon={resolveSopIcon(icon)} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{title}</div>
                  {allCategories.filter(c => categoryIds.includes(c.id)).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginTop: 6 }}>
                      {allCategories.filter(c => categoryIds.includes(c.id)).map(c => (
                        <span key={c.id} style={{ ...s.categoryChip, background: `${c.color}1a`, color: c.color, border: `1px solid ${c.color}40` }}>{c.name}</span>
                      ))}
                    </div>
                  )}
                  {goal.trim() && <p style={{ margin: '8px 0 0', fontSize: 12.5, color: C.textSub, lineHeight: 1.5 }}>{goal}</p>}
                  <div style={{ marginTop: 8, fontSize: 12, color: C.mutedSoft }}>
                    <FontAwesomeIcon icon={faVideo} style={{ marginRight: 6, fontSize: 11 }} />
                    {videoUrl.trim() ? 'Video linked' : 'No video'}
                  </div>
                </div>
                <button
                  onClick={() => setWizardStep(1)}
                  style={s.recapEditBtn}
                  aria-label="Edit title, purpose, and other basic info"
                  title="Edit title, purpose, and other basic info"
                >
                  <FontAwesomeIcon icon={faPen} style={{ fontSize: 11 }} />
                </button>
              </div>
            )}

            {showSteps && (
            <>
            {/* Teacher mode drops this whole header — the floating
                TeacherTopBar's own title already says "Steps" (same fix
                as the "Basic info" caption above), and every other piece
                of it (count caption, Manage sections link, the Add step
                button here) is admin-only anyway — nothing teacher-
                relevant would've been left in it. */}
            {!themeIsTeacher && (
            <div style={s.stepsCardHeader}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>Steps</h3>
                <div style={s.cardSub}>
                  {`${steps.length} step${steps.length === 1 ? '' : 's'} across ${usedSections.length} section${usedSections.length === 1 ? '' : 's'}`}
                </div>
                {/* Admin-only destination — a plain teacher proposing an
                    edit has no reason (or access) to manage the org-wide
                    section list. */}
                <Link to="/settings/sop-sections" style={s.sectionManageLink}>
                  Manage sections
                  <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, marginLeft: 5 }} />
                </Link>
              </div>
              <button
                onClick={() => setDrawer({ mode: 'new' })}
                style={{ ...s.addStepBtn, ...(isMobile ? { width: '100%', display: 'flex', justifyContent: 'center' } : null) }}
              >
                <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
                Add step
              </button>
            </div>
            )}

            {!themeIsTeacher && steps.length > 0 && (
              <div
                className={isMobile ? 'sop-pill-scroll' : undefined}
                style={{
                  ...s.pillRow,
                  ...(isMobile ? { flexWrap: 'nowrap' as const, overflowX: 'auto' as const, WebkitOverflowScrolling: 'touch' as const, scrollbarWidth: 'none' as const, msOverflowStyle: 'none' as const } : null),
                }}
              >
                {/* "All sections" sits last — a teacher filtering by
                    section reaches for a specific one far more often
                    than the reset-to-everything option. */}
                {usedSections.map(sec => {
                  const active = sectionFilter === sec;
                  const accent = sectionAccent(sec);
                  return (
                    <button
                      key={sec}
                      onClick={() => setSectionFilter(sec)}
                      style={{ ...s.pill, ...(active ? { background: accent, borderColor: accent, color: '#fff' } : {}) }}
                    >
                      {sec}
                      <span style={{ ...s.pillCount, ...(active ? s.pillCountActive : {}) }}>{sectionCounts.get(sec)}</span>
                    </button>
                  );
                })}
                <button
                  onClick={() => setSectionFilter('ALL')}
                  style={{ ...s.pill, ...(sectionFilter === 'ALL' ? s.pillActive : {}) }}
                >
                  All sections
                  <span style={{ ...s.pillCount, ...(sectionFilter === 'ALL' ? s.pillCountActive : {}) }}>{steps.length}</span>
                </button>
              </div>
            )}

            {displaySteps.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS }}>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: C.muted }}>
                  {steps.length === 0 ? 'No steps configured for this How-To Guide yet.' : 'No steps in this section yet.'}
                </p>
                <button onClick={() => setDrawer({ mode: 'new' })} style={s.primaryBtnGhost}>
                  <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
                  {steps.length === 0 ? 'Add the first step' : 'Add a step'}
                </button>
              </div>
            ) : (() => {
              let lastSection = '';
              let posInGroup = 0;
              const rows = displaySteps.map((st, i) => {
                const showHeader = sectionFilter === 'ALL' && st.section !== lastSection;
                if (showHeader) { lastSection = st.section; posInGroup = 0; }
                const stepNumber = posInGroup + 1;
                posInGroup += 1;
                const accent = sectionAccent(st.section);
                const detailLines = (st.detail ?? '').split('\n').map(l => l.trim()).filter(Boolean);
                const isDrag = dragKey === st.key;
                const isDrop = dropKey === st.key && dragKey !== st.key;
                const isFirst = i === 0;
                const isLast = i === displaySteps.length - 1;
                return { st, showHeader, stepNumber, accent, detailLines, isDrag, isDrop, isFirst, isLast };
              });

              // Same reasoning as SopTemplateStepsPage.tsx: a table's detail
              // column becomes unreadable once it's squeezed to phone width
              // (or forces awful side-scroll-and-back reading) — stacked
              // cards read top-to-bottom at full width instead.
              return isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <style>{`
                    .propose-grip:active { cursor: grabbing !important; }
                  `}</style>
                  {rows.map(({ st, showHeader, stepNumber, accent, detailLines, isDrag, isDrop, isFirst, isLast }) => (
                    <React.Fragment key={st.key}>
                      {showHeader && (
                        <div style={{
                          ...sMobile.sectionHeader,
                          // More generous gap before a section title than
                          // between a title and its own first step —
                          // matches Career's "Skill Badges"/"Active
                          // Quests" spacing. Skipped on the very first
                          // section heading: with the "Steps" header
                          // block above removed for teacher mode, this
                          // is now the first thing on the page besides
                          // the floating topbar's own clearance — adding
                          // 28px on top of that was compounding into a
                          // gap that read as broken, not generous.
                          ...(themeIsTeacher && !isFirst ? { paddingTop: 28 } : null),
                        }}>
                          {themeIsTeacher ? (
                            // Same title treatment as the Career tab —
                            // plain bold heading, no small-caps/colour.
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                              <h3 style={{
                                margin: 0, fontSize: 17, fontWeight: 800, color: C.text,
                                letterSpacing: '-0.018em', lineHeight: 1.2,
                                textTransform: 'none', // override sMobile.sectionHeader's inherited uppercase
                              }}>
                                {st.section}
                              </h3>
                              <span style={s.sectionGroupCount}>{sectionCounts.get(st.section) ?? 0}</span>
                            </div>
                          ) : (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderLeft: `3px solid ${accent}`, paddingLeft: 10 }}>
                              <span style={{ color: accent }}>{st.section}</span>
                              <span style={s.sectionGroupCount}>{sectionCounts.get(st.section) ?? 0}</span>
                            </div>
                          )}
                        </div>
                      )}
                      <div style={{ ...sMobile.stepCard, background: '#fff' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          {/* HTML5 drag (the desktop table's grip handle)
                              never fires from a touch gesture, so mobile
                              gets explicit Move up/down buttons instead —
                              stacked in the same slot the grip occupied. */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 1 }}>
                            <button
                              type="button"
                              onClick={() => moveStep(st.key, -1)}
                              disabled={isFirst}
                              aria-label="Move step up"
                              title="Move step up"
                              style={{ ...s.stepIconBtn, width: 20, height: 16, fontSize: 9, opacity: isFirst ? 0.35 : 1, cursor: isFirst ? 'default' : 'pointer' }}
                            >
                              <FontAwesomeIcon icon={faArrowUp} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveStep(st.key, 1)}
                              disabled={isLast}
                              aria-label="Move step down"
                              title="Move step down"
                              style={{ ...s.stepIconBtn, width: 20, height: 16, fontSize: 9, opacity: isLast ? 0.35 : 1, cursor: isLast ? 'default' : 'pointer' }}
                            >
                              <FontAwesomeIcon icon={faArrowDown} />
                            </button>
                          </div>
                          <span style={{ ...s.stepNumber, background: `${accent}1c`, color: accent, marginTop: 1 }}>{stepNumber}</span>
                          <span style={{ flex: 1, fontWeight: 600, color: C.text }}>
                            {st.title || <span style={{ color: C.mutedSoft, fontWeight: 500, fontStyle: 'italic' }}>Untitled step</span>}
                          </span>
                        </div>
                        {detailLines.length > 0 && (
                          <div style={sMobile.stepCardDetail}>{renderDetailLines(detailLines)}</div>
                        )}
                        <div style={sMobile.stepCardActions}>
                          <button onClick={() => setDrawer({ mode: 'new', insertAfterKey: st.key })} style={s.stepIconBtn} aria-label="Insert step after this one" title="Insert step after this one">
                            <FontAwesomeIcon icon={faPlus} />
                          </button>
                          <button onClick={() => setDrawer({ mode: 'edit', key: st.key })} style={s.stepIconBtn} aria-label="Edit step">
                            <FontAwesomeIcon icon={faPen} />
                          </button>
                          <button onClick={() => removeStep(st.key)} style={{ ...s.stepIconBtn, color: C.danger }} aria-label="Remove step">
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS, padding: '4px 14px', overflowX: 'auto' as const }}>
                  <style>{`
                    @media (hover: hover) {
                      .propose-step-row:hover { background: ${C.divider}; }
                      .propose-grip:hover { color: ${'var(--sop-accent)'} !important; }
                    }
                    .propose-grip:active { cursor: grabbing !important; }
                  `}</style>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={{ ...s.th, width: '30%' }}>Step</th>
                        <th style={s.th}>Operation Details &amp; Standard</th>
                        <th style={{ ...s.th, width: 118 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ st, showHeader, stepNumber, accent, detailLines, isDrag, isDrop }) => (
                        <React.Fragment key={st.key}>
                          {showHeader && (
                            <tr>
                              <td colSpan={3} style={{ ...s.sectionHeaderCell, borderLeftColor: accent }}>
                                <span style={{ color: accent }}>{st.section}</span>
                                <span style={s.sectionGroupCount}>{sectionCounts.get(st.section) ?? 0}</span>
                              </td>
                            </tr>
                          )}
                          <tr
                            className="propose-step-row"
                            onDragOver={onDragOver(st.key)}
                            onDrop={onDrop(st.key)}
                            style={{ opacity: isDrag ? 0.45 : 1, background: isDrop ? 'var(--sop-accent-soft)' : undefined }}
                          >
                            <td style={s.tdStep}>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                <span
                                  className="propose-grip"
                                  draggable
                                  onDragStart={onDragStart(st.key)}
                                  onDragEnd={onDragEnd}
                                  style={s.dragHandle}
                                  title="Drag to reorder"
                                >
                                  <FontAwesomeIcon icon={faGripVertical} />
                                </span>
                                <span style={{ ...s.stepNumber, background: `${accent}1c`, color: accent }}>{stepNumber}</span>
                                <span style={{ fontWeight: 600, color: C.text, paddingTop: 2 }}>
                                  {st.title || <span style={{ color: C.mutedSoft, fontWeight: 500, fontStyle: 'italic' }}>Untitled step</span>}
                                </span>
                              </div>
                            </td>
                            <td style={s.tdDetail}>{renderDetailLines(detailLines)}</td>
                            <td style={s.tdActions}>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                <button onClick={() => setDrawer({ mode: 'new', insertAfterKey: st.key })} style={s.stepIconBtn} aria-label="Insert step after this one" title="Insert step after this one">
                                  <FontAwesomeIcon icon={faPlus} />
                                </button>
                                <button onClick={() => setDrawer({ mode: 'edit', key: st.key })} style={s.stepIconBtn} aria-label="Edit step">
                                  <FontAwesomeIcon icon={faPen} />
                                </button>
                                <button onClick={() => removeStep(st.key)} style={{ ...s.stepIconBtn, color: C.danger }} aria-label="Remove step">
                                  <FontAwesomeIcon icon={faTrash} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {!themeIsTeacher && steps.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                <button
                  onClick={() => setDrawer({ mode: 'new' })}
                  style={{ ...s.addStepBtn, ...(isMobile ? { width: '100%', display: 'flex', justifyContent: 'center' } : null) }}
                >
                  <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
                  Add step
                </button>
              </div>
            )}
            </>
            )}

            <div style={themeIsTeacher ? sTeacher.footer : s.footer}>
              {wizardStep === 1 ? (
                <>
                  <button onClick={goBack} style={{ ...s.cancelBtn, ...(themeIsTeacher ? sTeacher.footerBtn : null) }}>Cancel</button>
                  <button
                    onClick={() => setWizardStep(2)}
                    disabled={!title.trim() || !goal.trim()}
                    style={{ ...s.saveBtn, ...(themeIsTeacher ? sTeacher.footerBtn : null), opacity: !title.trim() || !goal.trim() ? 0.5 : 1 }}
                  >
                    Next
                    <FontAwesomeIcon icon={faChevronRight} style={{ marginLeft: 6, fontSize: 11 }} />
                  </button>
                </>
              ) : canSelfPublish ? (
                // A supervisor already holds approval rights — Save Draft/
                // Publish Now replace the single "Submit for approval",
                // for both a new guide and a direct edit to an existing
                // one. No separate Cancel/Back here (the shared topbar's
                // own back chevron already covers leaving without saving);
                // two buttons matches the plain-teacher branch's own
                // footer weight instead of a cramped third button.
                <>
                  <button
                    onClick={doSaveDraft}
                    disabled={!title.trim() || cleanSteps.length === 0 || saving}
                    style={{ ...s.cancelBtn, ...(themeIsTeacher ? sTeacher.footerBtn : null), opacity: !title.trim() || cleanSteps.length === 0 || saving ? 0.5 : 1 }}
                  >
                    {saving ? 'Saving…' : 'Save Draft'}
                  </button>
                  <button
                    onClick={doPublishNow}
                    disabled={!title.trim() || !goal.trim() || cleanSteps.length === 0 || saving}
                    style={{ ...s.saveBtn, ...(themeIsTeacher ? sTeacher.footerBtn : null), opacity: !title.trim() || !goal.trim() || cleanSteps.length === 0 || saving ? 0.5 : 1 }}
                  >
                    <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />
                    {saving ? 'Publishing…' : 'Publish Now'}
                  </button>
                </>
              ) : (
                <>
                  {isEditingExisting ? (
                    <button onClick={backTo} style={{ ...s.cancelBtn, ...(themeIsTeacher ? sTeacher.footerBtn : null) }}>Cancel</button>
                  ) : (
                    <button onClick={() => setWizardStep(1)} style={{ ...s.cancelBtn, ...(themeIsTeacher ? sTeacher.footerBtn : null) }}>Back</button>
                  )}
                  <button
                    onClick={submit}
                    disabled={!title.trim() || !goal.trim() || cleanSteps.length === 0 || saving}
                    style={{ ...s.saveBtn, ...(themeIsTeacher ? sTeacher.footerBtn : null), opacity: !title.trim() || !goal.trim() || cleanSteps.length === 0 || saving ? 0.5 : 1 }}
                  >
                    <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />
                    {/* Shorter label on teacher mobile — at flex:1 width
                        next to "Back", "Submit for approval" wrapped to
                        two lines, which is what made the button read as
                        oversized (the extra height came from the wrap,
                        not the padding). Desktop keeps the full phrase —
                        plenty of width there for it to sit on one line. */}
                    {saving ? 'Submitting…' : (themeIsTeacher ? 'Submit' : 'Submit for approval')}
                  </button>
                </>
              )}
            </div>
            {/* The FAB below stays pinned to a fixed spot in the bottom
                right corner — this trailing space is what keeps Cancel/
                Submit from ever scrolling up underneath it. */}
            {themeIsTeacher && showSteps && drawer.mode === 'closed' && <div style={{ height: 94 }} />}
          </>
        )}
      </div>

      {/* Floating "Add step" button — solid, pinned to the bottom right
          corner. Portaled straight to <body> rather than left nested
          inside the page's own scroll container: some mobile browsers
          don't keep a `position: fixed` element reliably pinned to the
          viewport when one of its ancestors is itself a scrolling div
          (only the true root scroller is guaranteed safe) — it can
          appear to drift up the page as you scroll, riding along with
          the content instead of staying put. TeacherMobileNav avoids
          this the same way, by rendering as a top-level sibling outside
          the scroll container. Hidden while the step drawer is open —
          on mobile it covers the full width. */}
      {themeIsTeacher && showSteps && drawer.mode === 'closed' && createPortal(
        <button
          onClick={() => setDrawer({ mode: 'new' })}
          aria-label="Add step"
          title="Add step"
          style={{
            position: 'fixed',
            right: 20,
            bottom: `calc(${TEACHER_NAV_SPACE} + 26px)`,
            width: 54, height: 54, borderRadius: '50%',
            border: 'none',
            // Not the `--sop-accent` CSS var here — portaled outside the
            // page's own root div, so it'd be outside where that var is
            // declared and wouldn't resolve.
            background: TEACHER_ACCENT.accent,
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, cursor: 'pointer', zIndex: 60,
            boxShadow: '0 4px 12px rgba(15,23,42,0.20), 0 1px 4px rgba(15,23,42,0.12)',
          }}
        >
          <FontAwesomeIcon icon={faPlus} />
        </button>,
        document.body,
      )}

      {/* Icon picker — full grid in a bottom sheet, replacing the old
          cramped inline scroll row so all 50 options are actually
          browsable instead of mostly hidden off-screen. Same sheet
          language (rounded top, slide-up, backdrop) as TeacherTopBar's
          own info sheet. */}
      {themeIsTeacher && iconSheetOpen && createPortal(
        <>
          <div
            onClick={() => setIconSheetOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.32)', zIndex: 200 }}
          />
          <div
            role="dialog"
            aria-label="Choose an icon"
            style={{
              position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201,
              background: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22,
              boxShadow: '0 -10px 30px rgba(15,23,42,0.18)',
              maxHeight: '72vh', display: 'flex', flexDirection: 'column' as const,
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            <div style={{ width: 40, height: 4, borderRadius: 999, background: '#e2e8f0', margin: '10px auto 2px', flexShrink: 0 }} />
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 18px 14px', flexShrink: 0,
            }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Choose an icon</span>
              <button
                type="button" onClick={() => setIconSheetOpen(false)} aria-label="Close"
                style={{
                  width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.cardBorder}`,
                  background: '#fff', color: C.muted, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            <div style={{
              overflowY: 'auto' as const, padding: '0 18px 22px',
              display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10,
            }}>
              {ALLOWED_SOP_ICONS.map(name => {
                const ic = resolveSopIcon(name);
                const active = icon === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => { setIcon(name); setIconSheetOpen(false); }}
                    aria-label={iconLabel(name)}
                    aria-pressed={active}
                    style={{
                      aspectRatio: '1', borderRadius: 14, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      // Concrete values, not the `--sop-accent` CSS var —
                      // this sheet is portaled to document.body (same as
                      // the FAB above), outside the page root div where
                      // that var is declared, so it wouldn't resolve.
                      background: active ? TEACHER_ACCENT.soft : C.bg,
                      border: `2px solid ${active ? TEACHER_ACCENT.accent : C.cardBorder}`,
                      color: active ? TEACHER_ACCENT.accent : C.muted,
                      fontSize: 19,
                    }}
                  >
                    <FontAwesomeIcon icon={ic} />
                  </button>
                );
              })}
            </div>
          </div>
        </>,
        document.body,
      )}

      {drawer.mode !== 'closed' && (
        <ProposeStepDrawer
          // Forces a fresh mount whenever the target step changes — its
          // title/detail fields start from `initial` via useState, which
          // only runs once per mount. Clicking a different step's pencil
          // while this drawer was already open for another step (the
          // list stays clickable behind it) changed `drawer.key` without
          // ever passing through 'closed' in between, so the old
          // instance stuck around and kept showing the previous step's
          // text — same trap for "new" vs "new insert-after-X" too.
          key={drawer.mode === 'edit' ? `edit-${drawer.key}` : `new-${drawer.insertAfterKey ?? 'end'}`}
          mode={drawer.mode}
          initial={editingStep}
          insertAfterStep={drawer.mode === 'new' && drawer.insertAfterKey ? steps.find(s => s.key === drawer.insertAfterKey) ?? null : null}
          sections={existingSections}
          topOffset={drawerTopOffset}
          themeIsTeacher={themeIsTeacher}
          onCancel={closeDrawer}
          onSave={saveDrawerStep}
        />
      )}
    </div>
  );
}

// Local-only editor — nothing here is saved until the whole proposal is
// submitted, so unlike the admin's StepDrawer this never calls an API.
function ProposeStepDrawer({
  mode, initial, insertAfterStep, sections, topOffset, themeIsTeacher, onCancel, onSave,
}: {
  mode: 'new' | 'edit';
  initial: DraftStep | null;
  insertAfterStep: DraftStep | null;
  sections: string[];
  /** Fixed top offset for the overlay/panel — see SopProposePage's
   *  drawerTopOffset comment. Defaults to the admin Navbar's height. */
  topOffset?: number;
  /** Everything below only matters for teacher mobile — the parent
   *  page's own inputStyle/font-size-16 fix (avoids iOS auto-zoom on
   *  focus) and rounder corners never reached this drawer, since it's a
   *  separate component that was never touched when that pass landed. */
  themeIsTeacher?: boolean;
  onCancel: () => void;
  onSave: (section: string, title: string, detail: string) => void;
}) {
  const { isMobile } = useIsMobile();
  const [section, setSection] = useState(initial?.section ?? insertAfterStep?.section ?? sections[0] ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [detail, setDetail] = useState(initial?.detail ?? '');
  const contextText = mode === 'edit'
    ? 'Local to this proposal until submitted'
    : insertAfterStep
      ? `Inserting right after "${insertAfterStep.title}" in ${insertAfterStep.section}`
      : 'Local to this proposal until submitted';
  const inputStyle: React.CSSProperties = themeIsTeacher
    ? { ...s.input, fontSize: 16, padding: '11px 14px', borderRadius: 12 }
    : s.input;
  // Several styles below (chipActive, saveBtn, ...) read `var(--sop-
  // accent...)`, normally defined once on the page's own root div (see
  // SopProposePage's sopAccentVars). Portaling this drawer out to
  // <body> moves it outside that div's DOM subtree, so those custom
  // properties would no longer resolve to anything — redefined here,
  // on the portal's own root elements, for the same reason.
  const sopAccentVars = {
    '--sop-accent': themeIsTeacher ? TEACHER_ACCENT.accent : C.primary,
    '--sop-accent-soft': themeIsTeacher ? TEACHER_ACCENT.soft : C.primarySoft,
    '--sop-accent-border': themeIsTeacher ? TEACHER_ACCENT.border : C.primaryBorder,
  } as React.CSSProperties;

  // Portaled to <body> — unlike the FAB and every other floating piece
  // of teacher chrome in this app, this drawer used to render inline,
  // nested inside the page's own scrolling container. `position: fixed`
  // still visually pinned it correctly, but its autoFocus'd "Step
  // title" input was enough to make some browsers scroll that
  // *ancestor* container to "bring it into view" anyway — invisibly
  // shifting the real page underneath the drawer, so closing it landed
  // you mid-scroll instead of at the top, with the first section
  // heading now passing right under the floating collapsed-title pill.
  return createPortal(
    <>
      <div style={{ ...drawerS.overlay, top: topOffset ?? NAVBAR_HEIGHT }} onClick={onCancel} />
      <div
        style={{
          ...drawerS.panel,
          ...sopAccentVars,
          top: topOffset ?? NAVBAR_HEIGHT,
          ...(isMobile ? { width: 'auto', left: 0 } : null),
          // Teacher mode: a full-screen takeover, same top-to-bottom
          // panel as admin's drawer (drawerS.panel already sets
          // bottom: 0 — nothing to override here), just without a side
          // panel's chrome (no left border/shadow, edge-to-edge width
          // from the isMobile override above) or a floating card's
          // (no rounded corners — those only read as "a card" when
          // there's dimmed backdrop showing around it to contrast
          // against, and a full-bleed screen has none). Cancel/Save
          // still aren't pinned to the very bottom regardless of
          // content length, though — `body`'s flex: 'none' override
          // below means they sit right after the content in normal
          // flow, with the panel's own solid white background (not the
          // dimmed overlay) filling whatever's left underneath.
          ...(themeIsTeacher
            ? { overflowY: 'auto' as const, paddingBottom: 'env(safe-area-inset-bottom)' }
            : null),
        }}
      >
        <div style={drawerS.header}>
          <div>
            <div style={{ ...drawerS.title, ...(themeIsTeacher ? { fontSize: 17, fontWeight: 800 } : null) }}>
              {mode === 'edit' ? 'Edit step' : 'Add step'}
            </div>
            <div style={drawerS.context}>
              <FontAwesomeIcon icon={faLayerGroup} style={{ marginRight: 5, fontSize: 10 }} />
              {contextText}
            </div>
          </div>
          {/* Teacher mode drops this — Cancel/Save at the end of the
              content are the only way to leave, one less redundant exit
              next to those two. Admin's drawer keeps it (round, not a
              square, to begin with — see the old comment this replaced). */}
          {!themeIsTeacher && (
            <button onClick={onCancel} style={drawerS.closeBtn} aria-label="Close">
              <FontAwesomeIcon icon={faXmark} />
            </button>
          )}
        </div>

        <div style={{ ...drawerS.body, ...(themeIsTeacher ? { flex: 'none' as const, overflowY: 'visible' as const } : null) }}>
          <div style={s.field}>
            <label style={s.label}>Section</label>
            {sections.length > 0 ? (
              <div style={s.chipRow}>
                {sections.map(sec => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setSection(sec)}
                    style={{ ...s.chip, ...(section === sec ? s.chipActive : {}) }}
                  >
                    {sec}
                  </button>
                ))}
              </div>
            ) : (
              <input type="text" value={section} onChange={e => setSection(e.target.value)} placeholder="e.g. Main Process" style={inputStyle} />
            )}
          </div>

          <div style={s.field}>
            <label style={s.label}>Step title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Confirm the pick list" style={inputStyle} autoFocus />
          </div>

          <div style={{ ...s.field, marginBottom: 0 }}>
            <label style={s.label}>
              Operation details
              <span style={s.labelHint}>One point per line. Start a line with "-" for a bullet point.</span>
            </label>
            <textarea value={detail} onChange={e => setDetail(e.target.value)} style={{ ...inputStyle, minHeight: 140, resize: 'vertical' as const }} />
          </div>
        </div>

        <div style={drawerS.footer}>
          <button onClick={onCancel} style={s.cancelBtn}>Cancel</button>
          <button
            onClick={() => onSave(section.trim() || 'General', title.trim(), detail)}
            disabled={!title.trim()}
            style={{ ...s.saveBtn, opacity: !title.trim() ? 0.5 : 1 }}
          >
            {mode === 'edit' ? 'Save step' : 'Add step'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', background: C.bg, minHeight: '100vh', color: C.text },
  inner: { maxWidth: 780, margin: '0 auto' },
  // Matches SopTemplateStepsPage.tsx's own `inner` exactly, so the Steps
  // table reads at the same width whether it's the admin's real page or a
  // teacher's improvement proposal for it.
  innerWide: { maxWidth: 1100, margin: '0 auto' },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', padding: '6px 10px', marginBottom: 14,
    border: 'none', background: 'transparent', color: C.muted, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  },
  heading: { margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' },
  subheading: { margin: 0, fontSize: 12.5, color: C.muted },
  card: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS,
    padding: '22px 24px', boxShadow: SHADOW, marginBottom: 22,
  },
  recapIcon: {
    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--sop-accent-soft)', color: 'var(--sop-accent)', fontSize: 16,
  },
  recapEditBtn: {
    width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.cardBorder}`,
    background: '#fff', cursor: 'pointer', color: C.mutedSoft, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  field: { marginBottom: 18 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: C.textSub, marginBottom: 6, letterSpacing: '0.01em' },
  labelHint: { display: 'block', fontSize: 11, fontWeight: 400, color: C.mutedSoft, marginTop: 2 },
  // Title/Goal are the two fields "Next"/"Submit" actually stay
  // disabled for when empty — this is the only visual cue of that
  // besides the button itself quietly refusing to do anything.
  requiredMark: { color: C.danger, marginLeft: 3 },
  input: {
    width: '100%', padding: '9px 11px', fontSize: 13,
    border: `1px solid ${C.cardBorder}`, borderRadius: 8,
    outline: 'none', color: C.text, boxSizing: 'border-box' as const, fontFamily: 'inherit', background: '#fff',
  },
  stepsCardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10, flexWrap: 'wrap' as const },
  cardSub: { fontSize: 11, color: C.mutedSoft, marginTop: 2 },
  pillRow: { display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 14 },
  pill: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px 6px 14px',
    fontSize: 12.5, fontWeight: 600, borderRadius: 20,
    borderWidth: 1, borderStyle: 'solid' as const, borderColor: C.cardBorder,
    background: '#fff', color: C.textSub, cursor: 'pointer', whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
  pillActive: { borderColor: 'var(--sop-accent)', background: 'var(--sop-accent)', color: '#fff' },
  pillCount: {
    padding: '1px 6px', borderRadius: 999, fontSize: 10.5, fontWeight: 700,
    background: C.divider, color: C.mutedSoft,
  },
  pillCountActive: { background: 'rgba(255,255,255,0.25)', color: '#fff' },
  // minWidth matters on narrow viewports — without it, `width:100%` +
  // tableLayout:fixed just shrinks every column to fit the screen instead
  // of triggering the wrapper's horizontal scroll (see SopTemplateStepsPage.tsx).
  table: { width: '100%', minWidth: 640, borderCollapse: 'collapse' as const, tableLayout: 'fixed' as const },
  th: {
    textAlign: 'left' as const, padding: '8px 10px', fontSize: 11, fontWeight: 700,
    color: C.mutedSoft, textTransform: 'uppercase' as const, letterSpacing: '0.04em',
    borderBottom: `2px solid ${C.divider}`,
  },
  sectionHeaderCell: {
    padding: '18px 10px 8px 14px', fontSize: 12.5, fontWeight: 700,
    textTransform: 'uppercase' as const, letterSpacing: '0.05em',
    borderLeft: '3px solid transparent',
  },
  sectionGroupCount: {
    marginLeft: 8, padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700,
    background: C.divider, color: C.mutedSoft, textTransform: 'none' as const, letterSpacing: 'normal',
  },
  tdStep: {
    verticalAlign: 'top' as const, padding: '13px 10px', fontSize: 13.5,
    borderBottom: `1px solid ${C.divider}`, wordBreak: 'break-word' as const,
  },
  tdDetail: {
    verticalAlign: 'top' as const, padding: '13px 10px', fontSize: 12.5, color: C.textSub,
    borderBottom: `1px solid ${C.divider}`, lineHeight: 1.6,
  },
  tdActions: {
    verticalAlign: 'top' as const, padding: '13px 10px', borderBottom: `1px solid ${C.divider}`,
    whiteSpace: 'nowrap' as const,
  },
  detailList: { margin: '0 0 4px', paddingLeft: 16 },
  detailPara: { margin: '0 0 4px' },
  addStepBtn: {
    padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--sop-accent)',
    color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  },
  primaryBtnGhost: {
    padding: '8px 16px', borderRadius: 10, border: `1px dashed ${'var(--sop-accent-border)'}`,
    background: 'var(--sop-accent-soft)', color: 'var(--sop-accent)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  chipRow: { display: 'flex', flexWrap: 'wrap' as const, gap: 6 },
  chip: {
    padding: '6px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600,
    border: `1px solid ${C.cardBorder}`, background: '#fff', color: C.textSub, cursor: 'pointer',
  },
  chipActive: { borderColor: 'var(--sop-accent)', background: 'var(--sop-accent)', color: '#fff' },
  sectionManageLink: {
    display: 'inline-flex', alignItems: 'center', marginTop: 4,
    fontSize: 11.5, fontWeight: 600, color: 'var(--sop-accent)', textDecoration: 'none',
  },
  dragHandle: {
    cursor: 'grab', fontSize: 13, flexShrink: 0, marginTop: 3, padding: '2px 4px', color: C.mutedSoft,
    userSelect: 'none' as const, WebkitUserSelect: 'none' as const,
  },
  stepNumber: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22,
    borderRadius: '50%', background: 'var(--sop-accent-soft)', color: 'var(--sop-accent)', fontSize: 11, fontWeight: 700, flexShrink: 0,
  },
  stepIconBtn: {
    width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.cardBorder}`,
    background: '#fff', cursor: 'pointer', color: C.muted, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 11,
  },
  categoryChip: { display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700 },
  categoryAddChip: {
    display: 'inline-flex', alignItems: 'center', padding: '3px 11px 3px 9px',
    border: `1.5px dashed ${C.cardBorder}`, borderRadius: 999, background: 'transparent',
    color: C.mutedSoft, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
  },
  categoryMenu: {
    position: 'absolute' as const, top: '100%', left: 0, marginTop: 6, width: 260,
    background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: 10,
    boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 25, overflow: 'hidden',
  },
  categoryMenuItem: {
    display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px',
    border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: C.text, textAlign: 'left' as const,
  },
  categoryCheckbox: {
    width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${C.cardBorder}`,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  categoryDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  categoryManageLink: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    padding: '9px 8px', borderTop: `1px solid ${C.divider}`, background: C.bg,
    fontSize: 12, fontWeight: 600, color: 'var(--sop-accent)', textDecoration: 'none',
  },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  cancelBtn: {
    padding: '10px 18px', borderRadius: 10, border: `1px solid ${C.cardBorder}`,
    background: '#fff', color: C.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  saveBtn: {
    padding: '10px 18px', borderRadius: 10, border: 'none',
    background: 'var(--sop-accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
};

// Mobile overrides, merged onto the base styles via useIsMobile.
const sMobile: Record<string, React.CSSProperties> = {
  // page's mobile padding is computed inline above (pageStyle) since it
  // depends on fromTeacherApp — this object no longer carries it.
  card: { padding: '16px 14px' },
  sectionHeader: {
    padding: '14px 4px 4px', fontSize: 12.5, fontWeight: 700,
    textTransform: 'uppercase' as const, letterSpacing: '0.05em',
  },
  stepCard: {
    border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '12px 12px 10px',
  },
  stepCardDetail: {
    marginTop: 8, fontSize: 12.5, color: C.textSub, lineHeight: 1.6,
  },
  stepCardActions: {
    display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10,
    paddingTop: 10, borderTop: `1px solid ${C.divider}`,
  },
};

// Teacher-mobile-only overrides for the flat (no card-in-card) Basic
// info layout — a plain divider between fields instead of the desktop
// card's marginBottom-only spacing.
const sTeacher: Record<string, React.CSSProperties> = {
  // Same left-aligned magazine-style H1 every other teacher page uses
  // (Home, Pay Breakdown, Guides list) — real page content, not the
  // shared bar's job at rest.
  heading: { margin: '0 0 6px', fontSize: 30, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' },
  subheading: { margin: 0, fontSize: 13, color: C.textSub, lineHeight: 1.5 },
  stepCaption: {
    margin: '10px 0 0', fontSize: 11.5, fontWeight: 700, color: 'var(--sop-accent)',
    textTransform: 'uppercase' as const, letterSpacing: '0.04em',
  },
  field: { paddingBottom: 18, marginBottom: 18, borderBottom: `1px solid ${C.divider}` },
  lastField: { marginBottom: 0 },
  // Full-width, thumb-sized footer buttons instead of the desktop
  // pair's small flex-end row — a phone screen has the width to spare,
  // and a wide tap target matters more here than on a mouse-driven form.
  footer: { display: 'flex', gap: 10, marginTop: 24 },
  footerBtn: {
    flex: 1, padding: '14px 16px', fontSize: 14.5, borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
};

const drawerS: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', top: NAVBAR_HEIGHT, left: 0, right: 0, bottom: 0,
    // Above TeacherMobileNav's floating capsule (zIndex 50) — this panel
    // reaches all the way to the bottom of the screen, and without this
    // the nav sat on top of its own footer buttons, blocking taps on
    // "Add step"/"Save step" in teacher mode.
    background: 'rgba(15,23,42,0.28)', zIndex: 55,
  },
  panel: {
    position: 'fixed', top: NAVBAR_HEIGHT, right: 0, bottom: 0, width: 440,
    background: '#fff', borderLeft: `1px solid ${C.cardBorder}`,
    boxShadow: '-8px 0 28px rgba(15,23,42,0.08)', zIndex: 56,
    display: 'flex', flexDirection: 'column' as const,
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '18px 20px', borderBottom: `1px solid ${C.divider}`,
  },
  title: { fontSize: 15, fontWeight: 700, color: C.text },
  context: { marginTop: 3, fontSize: 11.5, color: C.mutedSoft },
  closeBtn: {
    width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.cardBorder}`,
    background: '#fff', cursor: 'pointer', color: C.muted, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  body: { padding: '18px 20px', overflowY: 'auto' as const, flex: 1 },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 10,
    padding: '14px 20px', borderTop: `1px solid ${C.divider}`,
  },
};
