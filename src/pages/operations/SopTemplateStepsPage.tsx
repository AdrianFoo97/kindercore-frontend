import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faTrash, faPen, faGripVertical, faArrowLeft, faCircleExclamation, faBullseye,
  faCheck, faXmark, faArrowTurnDown, faChevronRight, faChevronDown, faLink, faVideo, faCirclePlay, faDownload,
  faMagnifyingGlass, faEllipsisVertical,
} from '@fortawesome/free-solid-svg-icons';
import { fetchTemplates, updateTemplate, deleteTemplate, setTemplateCategories, SopTemplate } from '../../api/sop-templates.js';
import { fetchSteps, createStep, updateStep, deleteStep, reorderSteps, SopStep, UpsertSopStepPayload } from '../../api/sop-steps.js';
import { fetchCategories } from '../../api/sop-categories.js';
import { fetchSections } from '../../api/sop-sections.js';
import { useToast } from '../../components/common/Toast.js';
import { useDeleteDialog } from '../../components/common/DeleteDialog.js';
import { downloadSopPdf } from '../../utils/sopPdf.js';
import { ALLOWED_SOP_ICONS, resolveSopIcon } from '../../utils/sopTemplateIcons.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { usePermissions } from '../../hooks/usePermissions.js';

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eef0f4',
  divider: '#f1f5f9',
  text: '#0f172a',
  textSub: '#475569',
  // True neutral (no blue undertone) — reserved for step detail body copy,
  // which reads across every row of the table. textSub's slate carries just
  // enough blue that a whole column of it starts to look like link text
  // next to the page's actual indigo accents (buttons, pills, edit icons).
  textBody: '#52525b',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
  primaryBorder: '#c7d2fe',
  danger: '#dc2626',
};
const RADIUS = 14;
const SHADOW = '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)';
const NAVBAR_HEIGHT = 50;

// Cycled per section (by first-appearance order) purely as a scanning aid —
// sections are free-typed by the admin, so there's no fixed meaning to key
// off; a rotating accent just helps the eye separate one block from the next
// in a long document.
const SECTION_ACCENTS = ['#5a67d8', '#0d9488', '#b45309', '#be185d', '#0369a1', '#7c3aed'];

type DrawerState =
  | { mode: 'closed' }
  | { mode: 'new'; section: string; insertAfterId: string | null }
  | { mode: 'edit'; step: SopStep };

// A line only becomes a bullet if the admin actually typed one ("- …") —
// plain multi-line text (e.g. a short paragraph split for readability)
// used to get auto-bulleted just because there was more than one line,
// which put bullet points in front of prose that was never a list.
// Consecutive "-" lines still group into one <ul>; everything else renders
// as its own plain line, in original order.
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

export default function SopTemplateStepsPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { confirm: confirmDelete } = useDeleteDialog();
  const { isMobile } = useIsMobile();

  // Admins, and anyone whose AuthRole grants OPERATION_SOP_APPROVE (the
  // "Supervisor" tier), edit directly — they're the ones who'd otherwise
  // just be approving their own change. Everyone else goes through the
  // propose-then-approve flow (SopProposePage), so their edit affordances
  // are hidden entirely rather than shown-then-blocked.
  const rawUser = localStorage.getItem('user');
  const currentUser = rawUser ? (JSON.parse(rawUser) as { role?: string }) : null;
  const { hasView } = usePermissions();
  const realIsAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPERADMIN' || hasView('OPERATION_SOP_APPROVE');
  // Dev-only preview: ?previewTeacher=1 forces the teacher view for an
  // admin, carried over when navigating in from the library's own
  // teacher-preview link (see SopLibraryPage.tsx) so the two stay in sync.
  const [searchParams] = useSearchParams();
  const isAdmin = import.meta.env.DEV && searchParams.get('previewTeacher') === '1' ? false : realIsAdmin;
  // Only one button in this row should carry marginLeft: auto — whichever
  // is first pushes the rest to the right edge. If both did, the flex row
  // would split the leftover space into two gaps and strand Suggest in the
  // middle instead of sitting next to Download PDF.
  const showSuggestButton = !isAdmin;

  const { data: allTemplates = [] } = useQuery({ queryKey: ['sop-templates'], queryFn: () => fetchTemplates() });
  const template = allTemplates.find(t => t.id === templateId) ?? null;
  const { data: allCategories = [] } = useQuery({ queryKey: ['sop-categories'], queryFn: () => fetchCategories() });
  // Org-wide picker list for "which section does this step belong to" —
  // distinct from `sections` below, which is this one document's own
  // filter-tab list (only sections that actually have a step here).
  const { data: globalSections = [] } = useQuery({ queryKey: ['sop-sections'], queryFn: () => fetchSections() });

  const { data: allSteps = [], isLoading: stepsLoading } = useQuery({
    queryKey: ['sop-steps', templateId],
    queryFn: () => fetchSteps(templateId!),
    enabled: !!templateId,
  });
  const steps = useMemo(
    () => [...allSteps].sort((a, b) => a.displayOrder - b.displayOrder),
    [allSteps],
  );
  // Canonical org-wide order (Pre-shift Preparation → Main Process →
  // Exception Handling, per globalSections' own displayOrder) — not the
  // order sections happened to receive their first step, which would
  // reshuffle the grouped view based on step-creation history rather than
  // staying stable like the printed SOP. Any section not in the global list
  // (a stale/custom one) falls back to first-appearance order, appended
  // after the canonical set.
  const sections = useMemo(() => {
    const present = new Set(steps.map(s => s.section));
    const canonical = globalSections.map(sec => sec.name).filter(name => present.has(name));
    const extras = [...present].filter(name => !canonical.includes(name));
    return [...canonical, ...extras];
  }, [steps, globalSections]);
  const sectionAccent = (section: string) => SECTION_ACCENTS[sections.indexOf(section) % SECTION_ACCENTS.length];

  const [sectionFilter, setSectionFilter] = useState<string>('ALL');

  const sectionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of steps) map.set(s.section, (map.get(s.section) ?? 0) + 1);
    return map;
  }, [steps]);

  // "All sections" clusters steps by section (first-seen order) rather than
  // raw displayOrder — displayOrder can interleave sections after
  // reordering, but a document reads as one section fully, then the next.
  const displaySteps = useMemo(() => {
    if (sectionFilter !== 'ALL') return steps.filter(s => s.section === sectionFilter);
    const bySection = new Map<string, SopStep[]>();
    for (const s of steps) {
      if (!bySection.has(s.section)) bySection.set(s.section, []);
      bySection.get(s.section)!.push(s);
    }
    return sections.flatMap(sec => bySection.get(sec) ?? []);
  }, [steps, sectionFilter, sections]);

  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);

  // Inline edit state for the title + purpose — editing either happens
  // directly on this page (click the text, it becomes an input in place)
  // instead of navigating to a separate form for a two-field correction.
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);
  const [editingVideo, setEditingVideo] = useState(false);
  const [videoDraft, setVideoDraft] = useState('');
  const [savingVideo, setSavingVideo] = useState(false);
  // Categories apply immediately per click (no draft/Save step) — standard
  // for a label-assignment dropdown (GitHub/Linear/Notion all work this
  // way), and simpler than a chip picker with its own save/cancel cycle.
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!categoryMenuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(e.target as Node)) {
        setCategoryMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [categoryMenuOpen]);

  const [iconMenuOpen, setIconMenuOpen] = useState(false);
  const iconMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!iconMenuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (iconMenuRef.current && !iconMenuRef.current.contains(e.target as Node)) {
        setIconMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [iconMenuOpen]);
  const pickIcon = async (name: string) => {
    setIconMenuOpen(false);
    if (!templateId || name === template?.icon) return;
    try {
      await updateTemplate(templateId, { icon: name });
      invalidateTemplates();
    } catch (e: any) {
      showToast(e?.message ?? 'Save failed', 'error');
    }
  };

  // Add/edit step lives in a non-blocking side panel, not a separate page —
  // the whole point is that the rest of the steps table stays visible and
  // scrollable behind it, so the admin can check wording/phrasing against
  // other steps while writing a new one.
  const [drawer, setDrawer] = useState<DrawerState>({ mode: 'closed' });
  // Hiding ≠ closing: hiding slides the panel off-screen without unmounting
  // it, so whatever's half-typed survives — closing (Cancel, Save, or the
  // "discard" action on the resume tab) actually resets `drawer` and loses
  // it. Kept as a separate flag from `drawer.mode` specifically so
  // StepDrawer stays mounted (and its own draft state alive) while hidden.
  const [panelHidden, setPanelHidden] = useState(false);
  const discardDrawer = () => { setDrawer({ mode: 'closed' }); setPanelHidden(false); };

  const invalidateTemplates = () => qc.invalidateQueries({ queryKey: ['sop-templates'] });

  const startEditTitle = () => { setTitleDraft(template!.title); setEditingTitle(true); };
  const saveTitle = async () => {
    if (!editingTitle || !templateId) return;
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === template!.title) { setEditingTitle(false); return; }
    setSavingTitle(true);
    try {
      await updateTemplate(templateId, { title: trimmed });
      invalidateTemplates();
      setEditingTitle(false);
    } catch (e: any) {
      showToast(e?.message ?? 'Save failed', 'error');
    } finally {
      setSavingTitle(false);
    }
  };

  const startEditGoal = () => { setGoalDraft(template!.goal ?? ''); setEditingGoal(true); };
  const saveGoal = async () => {
    if (!templateId) return;
    const trimmed = goalDraft.trim();
    setSavingGoal(true);
    try {
      await updateTemplate(templateId, { goal: trimmed || null });
      invalidateTemplates();
      setEditingGoal(false);
    } catch (e: any) {
      showToast(e?.message ?? 'Save failed', 'error');
    } finally {
      setSavingGoal(false);
    }
  };

  const startEditVideo = () => { setVideoDraft(template!.videoUrl ?? ''); setEditingVideo(true); };
  const saveVideo = async () => {
    if (!templateId) return;
    const trimmed = videoDraft.trim();
    setSavingVideo(true);
    try {
      await updateTemplate(templateId, { videoUrl: trimmed || null });
      invalidateTemplates();
      setEditingVideo(false);
    } catch (e: any) {
      showToast(e?.message ?? 'Save failed — check the URL is valid', 'error');
    } finally {
      setSavingVideo(false);
    }
  };

  const toggleCategory = async (categoryId: string) => {
    if (!templateId) return;
    const current = (template!.categories ?? []).map(c => c.id);
    const next = current.includes(categoryId) ? current.filter(id => id !== categoryId) : [...current, categoryId];
    try {
      await setTemplateCategories(templateId, next);
      invalidateTemplates();
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to update categories', 'error');
    }
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: ['sop-steps', templateId] });

  const openAddDrawer = () => {
    // Only preset a section when the user was already looking at one specific
    // section tab — that's a real, deliberate choice worth honoring. From the
    // "All sections" view there's no such signal, so leave it blank rather
    // than silently guessing the first section (which looked "decided" but
    // wasn't, and left the picker below contradicting it).
    const section = sectionFilter !== 'ALL' ? sectionFilter : '';
    setPanelHidden(false);
    setDrawer({ mode: 'new', section, insertAfterId: null });
  };

  const onDelete = async (st: SopStep) => {
    const ok = await confirmDelete({
      entityType: 'Step',
      entityName: st.title,
      consequence: 'The step will be archived. Past observation checklists that recorded it stay in history (read-only).',
      actionLabel: 'Archive',
      onConfirm: async () => {
        await deleteStep(st.id);
        invalidate();
        showToast('Step archived');
      },
    });
    if (!ok) return;
  };

  // The page opens read-only even for admins — every pencil, Add step,
  // drag handle, and per-step insert/edit/delete icon stays hidden until
  // "Edit" is picked from the "…" menu, so a normal visit (checking a
  // procedure, following along) doesn't present as a big editable form.
  // `canEdit` is the gate every one of those affordances actually checks.
  const [editMode, setEditMode] = useState(false);
  const canEdit = isAdmin && editMode;

  // Deleting the whole guide lives behind a "…" menu, not a standing icon —
  // it's a rare action on a page that's mostly about reading/editing steps,
  // and shouldn't compete with those for attention on every visit.
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!moreMenuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setMoreMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [moreMenuOpen]);
  const onDeleteTemplate = async () => {
    if (!template) return;
    const ok = await confirmDelete({
      entityType: 'How-To Guide',
      entityName: template.title,
      consequence: 'This How-To Guide will be archived. Past observation records against it stay in history (read-only).',
      actionLabel: 'Archive',
      onConfirm: async () => {
        await deleteTemplate(template.id);
        invalidateTemplates();
        showToast('How-To Guide archived');
        navigate('/operations/sops');
      },
    });
    if (!ok) return;
  };

  const onDragStart = (id: string) => (e: React.DragEvent) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (id: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropId !== id) setDropId(id);
  };
  const onDragEnd = () => { setDragId(null); setDropId(null); };
  // Reorders against `displaySteps` — whatever's actually on screen right
  // now, grouped-by-section or filtered to one — never the raw `steps`
  // array, so a drag always lands exactly where it visually appears to,
  // in both the "All sections" and single-section views. Re-grouping by
  // the `section` field on the next render keeps each step inside its own
  // section block regardless of where its displayOrder ends up.
  const onDrop = (targetId: string) => async (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragId || dragId === targetId || !templateId) { onDragEnd(); return; }
    const ids = displaySteps.map(s => s.id);
    const fromIdx = ids.indexOf(dragId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) { onDragEnd(); return; }
    const reordered = [...ids];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    onDragEnd();
    try {
      await reorderSteps(templateId, reordered);
      invalidate();
    } catch (err: any) {
      showToast(err?.message ?? 'Reorder failed', 'error');
    }
  };

  if (!template) {
    return (
      <div style={s.page}>
        <div style={s.inner}>
          <div style={{ ...s.card, textAlign: 'center', padding: '64px 32px' }}>
            <FontAwesomeIcon icon={faCircleExclamation} style={{ fontSize: 28, color: C.mutedSoft, marginBottom: 14 }} />
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: C.text }}>How-To Guide not found</h3>
            <button onClick={() => navigate('/operations/sops')} style={s.primaryBtnGhost}>
              <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: 6 }} />
              Back to How-To Guides
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Running per-section step number (resets whenever the section changes),
  // so a step reads "3rd thing to do in Main Process", not just a bare
  // title — matches how the source document's own numbered sub-lists read.
  let runningIndex = 0;
  let lastSection: string | null = null;

  return (
    <div style={{ ...s.page, ...(isMobile ? sMobile.page : null) }}>
      <style>{`
        .sop-step-row:hover { background: ${C.divider} !important; }
        .sop-step-row:hover .sop-row-action { opacity: 1 !important; }
        .sop-row-action:focus-visible { opacity: 1 !important; }
        .sop-grip:hover { color: ${C.primary} !important; }
        .sop-grip:active { cursor: grabbing !important; }
        .sop-detail-cell > :last-child { margin-bottom: 0 !important; }
        .sop-row-action:last-child { margin-right: 0 !important; }
        .sop-cat-item:hover { background: ${C.divider} !important; }
        .sop-cat-add:hover { border-color: ${C.primary} !important; color: ${C.primary} !important; }
        .sop-download-btn:hover { border-color: ${C.primaryBorder} !important; background: ${C.primarySoft} !important; color: ${C.primary} !important; }
        .sop-more-menu-item:hover { background: ${C.divider} !important; }
        .sop-more-menu-item-danger:hover { background: #fef2f2 !important; }
      `}</style>
      {/* The panel is a floating overlay, not a layout push — it never
          resizes or shifts this content. On a wide viewport it simply has
          room to sit beside the centered table; on a narrower one it
          covers the table's right edge instead. Either way the table
          itself never reflows, so nothing here needs to react to whether
          the panel is open. */}
      <div style={s.inner}>
        <button onClick={() => navigate('/operations/sops')} style={s.backBtn}>
          <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: 6, fontSize: 11 }} />
          How-To Guides
        </button>

        {/* Title, purpose, and steps read as one continuous document — not
            three separate floating pieces — with a divider marking where
            the free-text header ends and the structured step list begins. */}
        <div style={{ ...s.card, ...(isMobile ? sMobile.card : null) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, minHeight: 36, flexWrap: isMobile ? 'wrap' as const : 'nowrap' as const }}>
          {canEdit ? (
            <div style={{ position: 'relative' }} ref={iconMenuRef}>
              <button
                onClick={() => setIconMenuOpen(o => !o)}
                style={s.iconPickBtn}
                aria-label="Change icon"
                title="Change icon"
              >
                <FontAwesomeIcon icon={resolveSopIcon(template.icon)} />
              </button>
              {iconMenuOpen && (
                <div style={s.iconMenu}>
                  {ALLOWED_SOP_ICONS.map(name => {
                    const active = template.icon === name;
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => pickIcon(name)}
                        style={{
                          ...s.iconMenuItem,
                          background: active ? C.primarySoft : '#fff',
                          border: `2px solid ${active ? C.primary : C.cardBorder}`,
                          color: active ? C.primary : C.muted,
                        }}
                      >
                        <FontAwesomeIcon icon={resolveSopIcon(name)} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div style={s.iconPickBtn}>
              <FontAwesomeIcon icon={resolveSopIcon(template.icon)} />
            </div>
          )}
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              disabled={savingTitle}
              onChange={e => setTitleDraft(e.target.value)}
              onFocus={e => e.currentTarget.select()}
              onKeyDown={e => {
                if (e.key === 'Enter') saveTitle();
                if (e.key === 'Escape') setEditingTitle(false);
              }}
              onBlur={saveTitle}
              style={s.headingInput}
            />
          ) : (
            <>
              <h1 style={s.heading}>{template.title}</h1>
              <span style={s.versionBadge} title={`Current version — bumps only when a proposed revision is approved`}>
                v{template.currentVersion}
              </span>
              {canEdit && (
                <button onClick={startEditTitle} style={s.editIconBtn} aria-label="Edit title" title="Edit title">
                  <FontAwesomeIcon icon={faPen} style={{ fontSize: 11 }} />
                </button>
              )}
              {isAdmin && (
                <div style={{ position: 'relative' }} ref={moreMenuRef}>
                  <button
                    type="button"
                    onClick={() => setMoreMenuOpen(o => !o)}
                    style={s.moreBtn}
                    aria-label="More actions"
                  >
                    <FontAwesomeIcon icon={faEllipsisVertical} />
                  </button>
                  {moreMenuOpen && (
                    <div style={s.moreMenu}>
                      <button
                        type="button"
                        className="sop-more-menu-item"
                        onClick={() => { setMoreMenuOpen(false); setEditMode(m => !m); }}
                        style={s.moreMenuItem}
                      >
                        <FontAwesomeIcon icon={faPen} style={{ fontSize: 11, marginRight: 8 }} />
                        {editMode ? 'Done Editing' : 'Edit'}
                      </button>
                      <button
                        type="button"
                        className="sop-more-menu-item-danger"
                        onClick={() => { setMoreMenuOpen(false); onDeleteTemplate(); }}
                        style={s.moreMenuDeleteItem}
                      >
                        <FontAwesomeIcon icon={faTrash} style={{ fontSize: 11, marginRight: 8 }} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {showSuggestButton && (
            <button
              onClick={() => navigate(`/operations/sops/${templateId}/propose`)}
              style={{
                ...s.secondaryBtn, marginLeft: 'auto', color: C.primary, borderColor: C.primaryBorder,
                ...(isMobile ? { width: '100%', justifyContent: 'center' } : null),
              }}
            >
              <FontAwesomeIcon icon={faPen} style={{ marginRight: 6, fontSize: 11 }} />
              Suggest an Improvement
            </button>
          )}
          <button
            className="sop-download-btn"
            onClick={() => downloadSopPdf(template, steps)}
            style={{
              ...s.secondaryBtn, ...(!showSuggestButton && isAdmin ? { marginLeft: 'auto' } : {}),
              ...(isMobile ? { width: '100%', justifyContent: 'center' } : null),
            }}
          >
            <FontAwesomeIcon icon={faDownload} style={{ marginRight: 6 }} />
            Download PDF
          </button>
        </div>

        <div style={s.categorySection} ref={categoryMenuRef}>
          <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap' as const, alignItems: 'center', gap: 7 }}>
            {template.categories?.map(c => (
              <span key={c.id} style={{ ...s.categoryChip, background: `${c.color}1a`, color: c.color, border: `1px solid ${c.color}40` }}>
                {c.name}
              </span>
            ))}
            {canEdit && (
              <button
                type="button"
                className="sop-cat-add"
                onClick={() => setCategoryMenuOpen(o => !o)}
                style={s.categoryAddChip}
                aria-label="Add label"
                title="Add label"
              >
                <FontAwesomeIcon icon={faPlus} style={{ fontSize: 9, marginRight: 5 }} />
                Label
              </button>
            )}

            {categoryMenuOpen && (
              <div style={s.categoryMenu}>
                <div style={s.categoryMenuList}>
                  {allCategories.length === 0 ? (
                    <div style={{ padding: '10px 12px', fontSize: 12, color: C.mutedSoft }}>No categories yet.</div>
                  ) : (
                    allCategories.map(c => {
                      const active = (template.categories ?? []).some(x => x.id === c.id);
                      return (
                        <button key={c.id} type="button" className="sop-cat-item" onClick={() => toggleCategory(c.id)} style={s.categoryMenuItem}>
                          <span style={{ ...s.categoryCheckbox, ...(active ? { background: c.color, borderColor: c.color } : {}) }}>
                            {active && <FontAwesomeIcon icon={faCheck} style={{ fontSize: 8, color: '#fff' }} />}
                          </span>
                          <span style={{ ...s.categoryDot, background: c.color }} />
                          <span style={{ flex: 1, textAlign: 'left' as const }}>{c.name}</span>
                        </button>
                      );
                    })
                  )}
                </div>
                {/* Creating new labels lives in Settings, not scattered
                    across every SOP — this menu only assigns from the
                    existing set. */}
                <Link to="/settings/sop-categories" style={s.categoryManageLink} onClick={() => setCategoryMenuOpen(false)}>
                  Manage categories
                  <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, marginLeft: 6 }} />
                </Link>
              </div>
            )}
          </div>
        </div>

        <div style={s.goalCallout}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={s.goalLabel}>
                <FontAwesomeIcon icon={faBullseye} style={{ fontSize: 11, marginRight: 6 }} />
                Purpose
              </div>
              {editingGoal ? (
                <textarea
                  autoFocus
                  value={goalDraft}
                  disabled={savingGoal}
                  onChange={e => setGoalDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') setEditingGoal(false); }}
                  placeholder="What does this procedure exist to ensure?"
                  style={s.goalTextarea}
                />
              ) : template.goal ? (
                <p style={s.goalText}>{template.goal}</p>
              ) : (
                <p style={{ ...s.goalText, color: C.mutedSoft, fontStyle: 'italic' }}>
                  {isAdmin ? 'No purpose statement yet — click Edit to add one.' : 'No purpose statement yet.'}
                </p>
              )}
            </div>
            {canEdit && !editingGoal && (
              <button onClick={startEditGoal} style={s.editIconBtn} aria-label="Edit purpose" title="Edit purpose">
                <FontAwesomeIcon icon={faPen} style={{ fontSize: 11 }} />
              </button>
            )}
          </div>
          {editingGoal && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <button onClick={saveGoal} disabled={savingGoal} style={s.goalSaveBtn}>
                <FontAwesomeIcon icon={faCheck} style={{ marginRight: 5, fontSize: 10 }} />
                {savingGoal ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditingGoal(false)} disabled={savingGoal} style={s.goalCancelBtn}>
                <FontAwesomeIcon icon={faXmark} style={{ marginRight: 5, fontSize: 10 }} />
                Cancel
              </button>
            </div>
          )}
        </div>

        <div style={s.videoRow}>
          <FontAwesomeIcon icon={faVideo} style={{ fontSize: 11, color: C.mutedSoft, flexShrink: 0 }} />
          {editingVideo ? (
            <>
              <input
                autoFocus
                type="text"
                value={videoDraft}
                disabled={savingVideo}
                onChange={e => setVideoDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveVideo(); if (e.key === 'Escape') setEditingVideo(false); }}
                placeholder="https://youtube.com/watch?v=…"
                style={s.videoInput}
              />
              <button onClick={saveVideo} disabled={savingVideo} style={s.goalSaveBtn}>
                {savingVideo ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditingVideo(false)} disabled={savingVideo} style={s.goalCancelBtn}>
                Cancel
              </button>
            </>
          ) : template.videoUrl ? (
            <a href={template.videoUrl} target="_blank" rel="noopener noreferrer" style={s.videoLink}>
              <FontAwesomeIcon icon={faCirclePlay} style={{ marginRight: 5 }} />
              Watch video
            </a>
          ) : (
            <span style={{ fontSize: 12.5, color: C.mutedSoft, fontStyle: 'italic' }}>
              {isAdmin ? 'No video yet' : 'No video'}
            </span>
          )}
          {canEdit && !editingVideo && (
            <button onClick={startEditVideo} style={{ ...s.editIconBtn, marginLeft: 'auto' }} aria-label="Edit video link" title="Edit video link">
              <FontAwesomeIcon icon={faPen} style={{ fontSize: 10.5 }} />
            </button>
          )}
        </div>

        <div style={s.docDivider} />

          <div style={s.cardHeader}>
            <div>
              <h3 style={s.cardTitle}>Steps</h3>
              <div style={s.cardSub}>
                {`${steps.length} step${steps.length === 1 ? '' : 's'} across ${sections.length} section${sections.length === 1 ? '' : 's'}`}
                {canEdit ? ' · Drag to reorder' : ''}
              </div>
            </div>
            {canEdit && (
              <button
                onClick={openAddDrawer}
                style={{ ...s.primaryBtn, ...(isMobile ? { width: '100%', display: 'flex', justifyContent: 'center' } : null) }}
              >
                <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
                Add step
              </button>
            )}
          </div>

          {steps.length > 0 && (
            <div style={s.pillRow}>
              <button
                onClick={() => setSectionFilter('ALL')}
                style={{ ...s.pill, ...(sectionFilter === 'ALL' ? s.pillActive : {}) }}
              >
                All sections
                <span style={{ ...s.pillCount, ...(sectionFilter === 'ALL' ? s.pillCountActive : {}) }}>{steps.length}</span>
              </button>
              {sections.map(sec => {
                const active = sectionFilter === sec;
                const accent = sectionAccent(sec);
                return (
                  <button
                    key={sec}
                    onClick={() => setSectionFilter(sec)}
                    style={{
                      ...s.pill,
                      ...(active ? { background: accent, borderColor: accent, color: '#fff' } : {}),
                    }}
                  >
                    {sec}
                    <span style={{ ...s.pillCount, ...(active ? s.pillCountActive : {}) }}>{sectionCounts.get(sec)}</span>
                  </button>
                );
              })}
            </div>
          )}

          {stepsLoading ? (
            <p style={{ padding: 32, textAlign: 'center', color: C.mutedSoft }}>Loading…</p>
          ) : displaySteps.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: C.muted }}>
                {steps.length === 0 ? 'No steps configured for this How-To Guide yet.' : 'No steps in this section yet.'}
              </p>
              {canEdit && (
                <button onClick={openAddDrawer} style={s.primaryBtnGhost}>
                  <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
                  {steps.length === 0 ? 'Add the first step' : 'Add a step'}
                </button>
              )}
            </div>
          ) : (() => {
            const rows = displaySteps.map(st => {
              const isDrag = dragId === st.id;
              const isDrop = dropId === st.id && dragId !== st.id;
              const showHeader = sectionFilter === 'ALL' && st.section !== lastSection;
              if (showHeader) { lastSection = st.section; runningIndex = 0; }
              runningIndex += 1;
              const stepNumber = runningIndex;
              const accent = sectionAccent(st.section);
              const detailLines = (st.detail ?? '').split('\n').map(l => l.trim()).filter(Boolean);
              // Loose FK — only render the link once it actually resolves to
              // a live template, so a deleted target quietly disappears
              // instead of dead-ending the click.
              const linkedTemplate = st.linkedTemplateId
                ? allTemplates.find(t => t.id === st.linkedTemplateId)
                : undefined;
              return { st, isDrag, isDrop, showHeader, stepNumber, accent, detailLines, linkedTemplate };
            });

            // A table with a "read the detail column" job doesn't survive a
            // phone screen — shrinking columns to fit just makes the detail
            // text a couple of characters wide, and a horizontal-scroll
            // fallback means scrolling right, reading a fragment, scrolling
            // back left for the next row, over and over. Stacked cards read
            // top-to-bottom instead, at full width, no sideways scrolling.
            return isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {rows.map(({ st, isDrag, isDrop, showHeader, stepNumber, accent, detailLines, linkedTemplate }) => (
                  <React.Fragment key={st.id}>
                    {showHeader && (
                      <div style={{ ...sMobile.sectionHeader, borderLeftColor: accent }}>
                        <span style={{ color: accent }}>{st.section}</span>
                        <span style={s.sectionGroupCount}>{sectionCounts.get(st.section) ?? 0}</span>
                      </div>
                    )}
                    <div
                      style={{ ...sMobile.stepCard, opacity: isDrag ? 0.45 : 1, background: isDrop ? C.primarySoft : '#fff' }}
                      onDragOver={onDragOver(st.id)}
                      onDrop={onDrop(st.id)}
                    >
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        {canEdit && (
                          <span
                            className="sop-grip"
                            draggable
                            onDragStart={onDragStart(st.id)}
                            onDragEnd={onDragEnd}
                            style={{ ...s.dragHandle, color: C.mutedSoft }}
                            title="Drag to reorder"
                          >
                            <FontAwesomeIcon icon={faGripVertical} />
                          </span>
                        )}
                        <span style={{ ...s.stepNumber, background: `${accent}1c`, color: accent, marginTop: 1 }}>{stepNumber}</span>
                        <span style={{ flex: 1, fontWeight: 600, color: C.text }}>{st.title}</span>
                      </div>
                      {(detailLines.length > 0 || linkedTemplate) && (
                        <div style={sMobile.stepCardDetail}>
                          {renderDetailLines(detailLines)}
                          {linkedTemplate && (
                            <Link to={`/operations/sops/${linkedTemplate.id}`} style={s.linkedChip}>
                              <FontAwesomeIcon icon={faLink} style={{ fontSize: 9, marginRight: 5 }} />
                              See: {linkedTemplate.title}
                            </Link>
                          )}
                        </div>
                      )}
                      {canEdit && (
                        <div style={sMobile.stepCardActions}>
                          <button
                            onClick={() => { setPanelHidden(false); setDrawer({ mode: 'new', section: st.section, insertAfterId: st.id }); }}
                            style={{ ...s.iconBtn, opacity: 1 }}
                            aria-label="Insert step after this one"
                            title="Insert step after this one"
                          >
                            <FontAwesomeIcon icon={faPlus} />
                          </button>
                          <button
                            onClick={() => { setPanelHidden(false); setDrawer({ mode: 'edit', step: st }); }}
                            style={{ ...s.iconBtn, opacity: 1 }}
                            aria-label="Edit step"
                            title="Edit step"
                          >
                            <FontAwesomeIcon icon={faPen} />
                          </button>
                          <button
                            onClick={() => onDelete(st)}
                            style={{ ...s.iconBtn, color: C.danger, opacity: 1 }}
                            aria-label="Archive step"
                            title="Archive step"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            ) : (
              // Two-column layout — Step / Operation details and standard —
              // mirrors the source document's table (步骤 / 操作细节和标准)
              // exactly, so a trainer reading this on-screen sees the same
              // shape they'd recognise from the printed SOP.
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={{ ...s.th, width: '30%' }}>Step</th>
                      <th style={s.th}>Operation Details &amp; Standard</th>
                      {canEdit && <th style={{ ...s.th, width: 118 }} />}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ st, isDrag, isDrop, showHeader, stepNumber, accent, detailLines, linkedTemplate }) => (
                      <React.Fragment key={st.id}>
                        {showHeader && (
                          <tr>
                            <td colSpan={canEdit ? 3 : 2} style={{ ...s.sectionHeaderCell, borderLeftColor: accent }}>
                              <span style={{ color: accent }}>{st.section}</span>
                              <span style={s.sectionGroupCount}>{sectionCounts.get(st.section) ?? 0}</span>
                            </td>
                          </tr>
                        )}
                        <tr
                          className="sop-step-row"
                          onDragOver={onDragOver(st.id)}
                          onDrop={onDrop(st.id)}
                          style={{
                            opacity: isDrag ? 0.45 : 1,
                            background: isDrop ? C.primarySoft : undefined,
                          }}
                        >
                          <td style={s.tdStep}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                              {canEdit && (
                                <span
                                  className="sop-grip"
                                  draggable
                                  onDragStart={onDragStart(st.id)}
                                  onDragEnd={onDragEnd}
                                  style={{ ...s.dragHandle, color: C.mutedSoft }}
                                  title="Drag to reorder"
                                >
                                  <FontAwesomeIcon icon={faGripVertical} />
                                </span>
                              )}
                              <span style={{ ...s.stepNumber, background: `${accent}1c`, color: accent }}>{stepNumber}</span>
                              <span style={{ fontWeight: 600, color: C.text, paddingTop: 2 }}>{st.title}</span>
                            </div>
                          </td>
                          <td className="sop-detail-cell" style={s.tdDetail}>
                            {renderDetailLines(detailLines)}
                            {linkedTemplate && (
                              <Link to={`/operations/sops/${linkedTemplate.id}`} style={s.linkedChip}>
                                <FontAwesomeIcon icon={faLink} style={{ fontSize: 9, marginRight: 5 }} />
                                See: {linkedTemplate.title}
                              </Link>
                            )}
                          </td>
                          {canEdit && (
                            <td style={s.tdActions}>
                              <button
                                className="sop-row-action"
                                onClick={() => { setPanelHidden(false); setDrawer({ mode: 'new', section: st.section, insertAfterId: st.id }); }}
                                style={s.iconBtn}
                                aria-label="Insert step after this one"
                                title="Insert step after this one"
                              >
                                <FontAwesomeIcon icon={faPlus} />
                              </button>
                              <button
                                className="sop-row-action"
                                onClick={() => { setPanelHidden(false); setDrawer({ mode: 'edit', step: st }); }}
                                style={s.iconBtn}
                                aria-label="Edit step"
                                title="Edit step"
                              >
                                <FontAwesomeIcon icon={faPen} />
                              </button>
                              <button
                                className="sop-row-action"
                                onClick={() => onDelete(st)}
                                style={{ ...s.iconBtn, color: C.danger }}
                                aria-label="Archive step"
                                title="Archive step"
                              >
                                <FontAwesomeIcon icon={faTrash} />
                              </button>
                            </td>
                          )}
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      </div>

      {drawer.mode !== 'closed' && (
        <StepDrawer
          // Forces a remount (fresh title/detail/section state) whenever
          // *what* the drawer is editing actually changes — e.g. clicking
          // Edit on a different row while a hidden draft from another step
          // is still mounted. Without this, StepDrawer's useState fields
          // only seed once on mount and silently keep showing whatever the
          // previous target had (including a blank "new step" draft) since
          // React reuses the same instance across a prop change alone.
          // Same target reopened (e.g. resuming a hidden draft) keeps the
          // same key, so the mounted instance — and its draft — survives.
          key={drawer.mode === 'edit' ? `edit-${drawer.step.id}` : `new-${drawer.insertAfterId ?? drawer.section}`}
          drawer={drawer}
          templateId={templateId!}
          steps={steps}
          sections={globalSections.map(s => s.name)}
          allTemplates={allTemplates}
          hidden={panelHidden}
          onHide={() => setPanelHidden(true)}
          onCancel={discardDrawer}
          onSaved={() => { invalidate(); discardDrawer(); }}
        />
      )}

      {drawer.mode !== 'closed' && panelHidden && (
        <button
          onClick={() => setPanelHidden(false)}
          style={s.resumeTab}
          aria-label={drawer.mode === 'edit' ? 'Resume editing step' : 'Resume new step draft'}
          title={drawer.mode === 'edit' ? 'Resume editing step' : 'Resume new step draft'}
        >
          <FontAwesomeIcon icon={faPen} style={{ fontSize: 13 }} />
        </button>
      )}
    </div>
  );
}

// ── Add/edit step side panel ─────────────────────────────────────────────────
// Deliberately not a full page and not a blocking modal — it's a fixed panel
// docked to the right, with the steps table still fully visible and
// scrollable to its left, so the admin can check other steps' wording while
// composing this one.

function StepDrawer({ drawer, templateId, steps, sections, allTemplates, hidden, onHide, onCancel, onSaved }: {
  drawer: Extract<DrawerState, { mode: 'new' } | { mode: 'edit' }>;
  templateId: string;
  steps: SopStep[];
  sections: string[];
  allTemplates: SopTemplate[];
  /** Slides the panel off-screen without unmounting it — the component
   *  (and its draft state below) stays alive so nothing typed is lost. */
  hidden: boolean;
  onHide: () => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const { isMobile } = useIsMobile();
  const isEditing = drawer.mode === 'edit';
  const editingStep = isEditing ? drawer.step : null;
  const initialSection = isEditing ? editingStep!.section : drawer.section;

  const [section, setSection] = useState(initialSection);
  const [title, setTitle] = useState(editingStep?.title ?? '');
  const [detail, setDetail] = useState(editingStep?.detail ?? '');
  const [linkedTemplateId, setLinkedTemplateId] = useState(editingStep?.linkedTemplateId ?? '');
  const [saving, setSaving] = useState(false);
  const linkableTemplates = allTemplates.filter(t => t.id !== templateId);
  const linkedTemplate = linkableTemplates.find(t => t.id === linkedTemplateId) ?? null;

  // Search + filter-by-label picker for "Linked How-To Guide" — a plain
  // <select> stops scaling once the library has more than a handful of
  // guides. Category options are derived from linkableTemplates itself
  // (not a separate org-wide fetch) so the filter never offers a label that
  // would filter everything out.
  const [linkMenuOpen, setLinkMenuOpen] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkCategoryFilter, setLinkCategoryFilter] = useState<string>('ALL');
  const linkMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!linkMenuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (linkMenuRef.current && !linkMenuRef.current.contains(e.target as Node)) setLinkMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [linkMenuOpen]);
  const linkableCategories = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>();
    for (const t of linkableTemplates) for (const c of t.categories ?? []) map.set(c.id, c);
    return [...map.values()];
  }, [linkableTemplates]);
  const filteredLinkableTemplates = linkableTemplates.filter(t => {
    const matchesSearch = !linkSearch.trim() || t.title.toLowerCase().includes(linkSearch.trim().toLowerCase());
    const matchesCategory = linkCategoryFilter === 'ALL' || (t.categories ?? []).some(c => c.id === linkCategoryFilter);
    return matchesSearch && matchesCategory;
  });

  const insertAfterStep = !isEditing && drawer.insertAfterId ? steps.find(st => st.id === drawer.insertAfterId) : null;
  // Fixed = the section is already implied by context (inserting after a
  // specific step, or the user was already on a single-section tab when
  // they hit "Add step") — in either case, showing an editable picker below
  // would just contradict what the text above already says. Editing an
  // existing step is always fixed too — it already has a section, and
  // moving it between sections isn't something this form does. Only when
  // there's no such anchor (opened from "All sections") is the section
  // genuinely undecided, so that's the only time the picker is needed.
  const sectionIsFixed = !!insertAfterStep || !!initialSection;
  const contextText = isEditing
    ? `Editing a step in ${editingStep!.section}`
    : insertAfterStep
      ? `Inserting right after "${insertAfterStep.title}" in ${insertAfterStep.section}`
      : initialSection
        ? `Adding to the end of ${initialSection}`
        : sections.length > 0
          ? 'Choose a section for this step'
          : 'Adding the first step of this How-To Guide';

  const submit = async () => {
    if (!title.trim() || !section.trim()) return;
    setSaving(true);
    try {
      const payload: UpsertSopStepPayload = {
        sopTemplateId: templateId, section: section.trim(), title: title.trim(), detail: detail.trim() || null,
        linkedTemplateId: linkedTemplateId || null,
      };
      if (isEditing) {
        await updateStep(editingStep!.id, payload);
        showToast('Step updated');
      } else {
        const created = await createStep(payload);
        // New steps land at the end by default (backend auto-appends) — if
        // this was "insert after X", splice it into place using the same
        // reorder endpoint drag-and-drop already relies on.
        if (drawer.insertAfterId) {
          const ids = steps.map(st => st.id);
          const idx = ids.indexOf(drawer.insertAfterId);
          if (idx >= 0) {
            ids.splice(idx + 1, 0, created.id);
            await reorderSteps(templateId, ids);
          }
        }
        showToast('Step added');
      }
      onSaved();
    } catch (e: any) {
      showToast(e?.message ?? 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ ...drawerS.panel, ...(isMobile ? { width: 'auto', left: 0 } : null), transform: hidden ? 'translateX(100%)' : 'translateX(0)' }}>
      <div style={drawerS.header}>
        <div style={{ minWidth: 0 }}>
          <h2 style={drawerS.title}>{isEditing ? 'Edit step' : 'New step'}</h2>
          <div style={drawerS.context}>
            <FontAwesomeIcon icon={faArrowTurnDown} style={{ fontSize: 10, marginRight: 6, transform: 'scaleX(-1)' }} />
            {contextText}
          </div>
        </div>
        <button onClick={onHide} style={drawerS.closeBtn} aria-label="Hide" title="Hide — your draft is kept">
          <FontAwesomeIcon icon={faChevronRight} />
        </button>
      </div>

      <div style={drawerS.body}>
        {/* Sections are an org-wide list (Settings → Operation → How-To Guide
            Sections), not invented per-document — the same "Main Process"
            means the same thing on every guide. The free-text fallback
            only fires if that list is somehow completely empty (e.g. an
            admin deleted every section), so there's still a way to start. */}
        {!sectionIsFixed && (
          <div style={drawerS.field}>
            <label style={drawerS.label}>Section</label>
            {sections.length > 0 ? (
              <>
                <div style={drawerS.chipRow}>
                  {sections.map(sec => {
                    const active = section === sec;
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setSection(sec)}
                        style={{ ...drawerS.chip, ...(active ? drawerS.chipActive : {}) }}
                      >
                        {sec}
                      </button>
                    );
                  })}
                </div>
                <Link to="/settings/sop-sections" style={drawerS.manageLink}>
                  Manage sections
                  <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, marginLeft: 6 }} />
                </Link>
              </>
            ) : (
              <input
                autoFocus
                type="text"
                value={section}
                onChange={e => setSection(e.target.value)}
                placeholder="e.g. Main Process"
                style={drawerS.input}
              />
            )}
          </div>
        )}

        <div style={drawerS.field}>
          <label style={drawerS.label}>Step title</label>
          <input
            autoFocus={sectionIsFixed || sections.length > 0}
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Scan the Picking Task Sheet"
            style={drawerS.input}
          />
        </div>

        <div style={drawerS.field}>
          <label style={drawerS.label}>
            Operation details and standard
            <span style={drawerS.labelHint}>One line each. Start a line with "-" for a bullet point — plain lines stay plain text.</span>
          </label>
          <textarea
            value={detail}
            onChange={e => setDetail(e.target.value)}
            placeholder={'e.g.\nLog into PDA system → Picking.\n- Scan the Picking Task Sheet.\n- Multiple sheets can be scanned together.'}
            style={drawerS.textarea}
          />
        </div>

        {linkableTemplates.length > 0 && (
          <div style={{ ...drawerS.field, marginBottom: 0, position: 'relative' }} ref={linkMenuRef}>
            <label style={drawerS.label}>
              Linked How-To Guide
              <span style={drawerS.labelHint}>Optional — if this step hands off to another procedure, link it here.</span>
            </label>
            <button
              type="button"
              onClick={() => setLinkMenuOpen(o => !o)}
              style={{ ...drawerS.input, display: 'flex', alignItems: 'center', textAlign: 'left' as const, cursor: 'pointer', color: linkedTemplate ? C.text : C.mutedSoft }}
            >
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                {linkedTemplate ? linkedTemplate.title : 'No linked How-To Guide'}
              </span>
              <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 10, color: C.mutedSoft, marginLeft: 8, flexShrink: 0 }} />
            </button>

            {linkMenuOpen && (
              <div style={drawerS.linkMenu}>
                <div style={{ position: 'relative', padding: 8, borderBottom: `1px solid ${C.divider}` }}>
                  <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: C.mutedSoft }} />
                  <input
                    autoFocus
                    type="text"
                    value={linkSearch}
                    onChange={e => setLinkSearch(e.target.value)}
                    placeholder="Search by title…"
                    style={{ ...drawerS.input, paddingLeft: 28 }}
                  />
                </div>

                {linkableCategories.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5, padding: '8px 8px 0' }}>
                    <button
                      type="button"
                      onClick={() => setLinkCategoryFilter('ALL')}
                      style={{ ...drawerS.filterChip, ...(linkCategoryFilter === 'ALL' ? drawerS.filterChipActive : {}) }}
                    >
                      All labels
                    </button>
                    {linkableCategories.map(c => {
                      const active = linkCategoryFilter === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setLinkCategoryFilter(c.id)}
                          style={{ ...drawerS.filterChip, ...(active ? { background: c.color, borderColor: c.color, color: '#fff' } : {}) }}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div style={drawerS.linkMenuList}>
                  <button
                    type="button"
                    onClick={() => { setLinkedTemplateId(''); setLinkMenuOpen(false); }}
                    style={{ ...drawerS.linkMenuItem, ...(linkedTemplateId === '' ? drawerS.linkMenuItemActive : {}) }}
                  >
                    No linked How-To Guide
                  </button>
                  {filteredLinkableTemplates.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { setLinkedTemplateId(t.id); setLinkMenuOpen(false); }}
                      style={{ ...drawerS.linkMenuItem, ...(linkedTemplateId === t.id ? drawerS.linkMenuItemActive : {}) }}
                    >
                      <span style={{ display: 'block' }}>{t.title}</span>
                      {(t.categories ?? []).length > 0 && (
                        <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const, marginTop: 4 }}>
                          {t.categories!.map(c => (
                            <span key={c.id} style={{ ...drawerS.linkMenuChip, background: `${c.color}1a`, color: c.color }}>{c.name}</span>
                          ))}
                        </span>
                      )}
                    </button>
                  ))}
                  {filteredLinkableTemplates.length === 0 && (
                    <div style={{ padding: '10px 12px', fontSize: 12, color: C.mutedSoft }}>No guides match.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={drawerS.footer}>
        <button onClick={onCancel} style={drawerS.cancelBtn}>Cancel</button>
        <button
          onClick={submit}
          disabled={!title.trim() || !section.trim() || saving}
          style={{ ...drawerS.saveBtn, opacity: !title.trim() || !section.trim() || saving ? 0.5 : 1 }}
        >
          <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />
          {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Create step'}
        </button>
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', background: C.bg, minHeight: '100vh', color: C.text },
  // Longhand margins (not the `margin` shorthand) — the page toggles
  // marginRight based on drawer state below, and mixing a shorthand with a
  // later longhand override of one of its sub-properties is exactly the
  // pattern that breaks on re-render (React can't cleanly "unset" one piece
  // of a shorthand-authored value, so it falls back to marginRight:0
  // instead of restoring `auto`, wrecking the centering).
  inner: { maxWidth: 1100, marginTop: 0, marginBottom: 0, marginLeft: 'auto', marginRight: 'auto' },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', padding: '6px 10px', marginBottom: 14,
    border: 'none', background: 'transparent', color: C.muted, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  },
  heading: { margin: 0, fontSize: 26, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' },
  // Matches `heading`'s type scale exactly so swapping the <h1> for this
  // <input> doesn't visibly reflow the page.
  headingInput: {
    margin: 0, fontSize: 26, fontWeight: 700, color: C.text, letterSpacing: '-0.02em',
    border: `1px solid ${C.primaryBorder}`, borderRadius: 8, padding: '2px 8px',
    outline: 'none', fontFamily: 'inherit', background: '#fff', flex: 1, maxWidth: 480,
  },
  iconPickBtn: {
    width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.cardBorder}`,
    background: C.primarySoft, color: C.primary, cursor: 'pointer', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 15,
  },
  iconMenu: {
    position: 'absolute' as const, top: '100%', left: 0, marginTop: 6, width: 232,
    background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: 10,
    boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 25, padding: 10,
    display: 'flex', flexWrap: 'wrap' as const, gap: 8,
  },
  iconMenuItem: {
    width: 36, height: 36, borderRadius: 9, display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 14, cursor: 'pointer', transition: 'all 150ms ease',
  },
  editIconBtn: {
    width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.cardBorder}`,
    background: '#fff', cursor: 'pointer', color: C.mutedSoft, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  categorySection: { marginBottom: 12 },
  categoryChip: {
    display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
    borderRadius: 999, fontSize: 11.5, fontWeight: 700, lineHeight: 1.5,
  },
  categoryAddChip: {
    display: 'inline-flex', alignItems: 'center', padding: '3px 11px 3px 9px',
    border: `1.5px dashed ${C.cardBorder}`, borderRadius: 999, background: 'transparent',
    color: C.mutedSoft, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
    transition: 'border-color 120ms ease, color 120ms ease',
  },
  categoryMenu: {
    position: 'absolute' as const, top: '100%', left: 0, marginTop: 6, width: 260,
    background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: 10,
    boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 25, overflow: 'hidden',
  },
  categoryMenuList: { maxHeight: 220, overflowY: 'auto' as const, padding: 6 },
  categoryMenuItem: {
    display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 8px',
    border: 'none', background: 'transparent', borderRadius: 7, cursor: 'pointer',
    fontSize: 13, color: C.text, textAlign: 'left' as const,
  },
  categoryCheckbox: {
    width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${C.cardBorder}`,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  categoryDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  categoryManageLink: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    padding: '9px 8px', borderTop: `1px solid ${C.divider}`, background: C.bg,
    fontSize: 12, fontWeight: 600, color: C.primary, textDecoration: 'none',
  },
  goalCallout: {
    background: C.primarySoft, borderLeft: `4px solid ${C.primary}`, borderRadius: 10,
    padding: '12px 16px',
  },
  docDivider: { height: 1, background: C.divider, margin: '16px 0' },
  videoRow: {
    display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, minHeight: 26,
  },
  videoInput: {
    flex: 1, minWidth: 0, padding: '6px 10px', fontSize: 13,
    border: `1px solid ${C.primaryBorder}`, borderRadius: 8, outline: 'none',
    color: C.text, boxSizing: 'border-box' as const, fontFamily: 'inherit', background: '#fff',
  },
  videoLink: {
    display: 'inline-flex', alignItems: 'center', fontSize: 12.5, fontWeight: 600,
    color: C.primary, textDecoration: 'none',
  },
  goalLabel: {
    display: 'flex', alignItems: 'center', fontSize: 10.5, fontWeight: 700, color: C.primary,
    textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4,
  },
  goalText: { margin: 0, fontSize: 13.5, color: C.textSub, lineHeight: 1.6 },
  goalTextarea: {
    width: '100%', minHeight: 80, padding: '8px 10px', fontSize: 13.5,
    border: `1px solid ${C.primaryBorder}`, borderRadius: 8, outline: 'none',
    color: C.text, boxSizing: 'border-box' as const, fontFamily: 'inherit',
    lineHeight: 1.6, resize: 'vertical' as const, background: '#fff',
  },
  goalSaveBtn: {
    padding: '5px 12px', borderRadius: 7, border: 'none', background: C.primary,
    color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  goalCancelBtn: {
    padding: '5px 12px', borderRadius: 7, border: `1px solid ${C.cardBorder}`, background: '#fff',
    color: C.textSub, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  card: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS,
    padding: '22px 26px', boxShadow: SHADOW, marginBottom: 20,
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16, gap: 10, flexWrap: 'wrap',
  },
  cardTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' },
  cardSub: { fontSize: 11, color: C.mutedSoft, marginTop: 2 },
  primaryBtn: {
    padding: '8px 16px', borderRadius: 10, border: 'none',
    background: C.primary, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  primaryBtnGhost: {
    padding: '8px 16px', borderRadius: 10, border: `1px dashed ${C.primaryBorder}`,
    background: C.primarySoft, color: C.primary, fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  // Solid border, not dashed — dashed reads as "add something new" (the
  // empty-state CTAs above), which is the wrong signal for a real,
  // always-available action like exporting the document.
  secondaryBtn: {
    padding: '8px 16px', borderRadius: 10, border: `1px solid ${C.cardBorder}`,
    background: '#fff', color: C.textSub, fontWeight: 600, fontSize: 13, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center',
  },
  versionBadge: {
    display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999,
    fontSize: 11, fontWeight: 700, background: C.divider, color: C.muted, flexShrink: 0,
  },
  moreBtn: {
    width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.cardBorder}`,
    background: '#fff', cursor: 'pointer', color: C.mutedSoft, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0,
  },
  moreMenu: {
    position: 'absolute' as const, top: '100%', right: 0, marginTop: 6, width: 150,
    background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: 10,
    boxShadow: '0 8px 24px rgba(15,23,42,0.14)', zIndex: 20, overflow: 'hidden', padding: 4,
  },
  moreMenuItem: {
    display: 'flex', alignItems: 'center', width: '100%', padding: '8px 10px',
    border: 'none', borderRadius: 7, background: 'transparent', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, color: C.textSub, textAlign: 'left' as const, fontFamily: 'inherit',
  },
  moreMenuDeleteItem: {
    display: 'flex', alignItems: 'center', width: '100%', padding: '8px 10px',
    border: 'none', borderRadius: 7, background: 'transparent', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, color: C.danger, textAlign: 'left' as const, fontFamily: 'inherit',
  },
  pillRow: { display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 18 },
  // Longhand border props (not the `border` shorthand) so variants below
  // can override just borderColor without React warning about mixing
  // shorthand/longhand across renders.
  pill: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px 6px 14px',
    fontSize: 12.5, fontWeight: 600, borderRadius: 20,
    borderWidth: 1, borderStyle: 'solid' as const, borderColor: C.cardBorder,
    background: '#fff', color: C.textSub, cursor: 'pointer', whiteSpace: 'nowrap' as const,
  },
  pillActive: { borderColor: C.primary, background: C.primary, color: '#fff' },
  pillCount: {
    padding: '1px 6px', borderRadius: 999, fontSize: 10.5, fontWeight: 700,
    background: C.divider, color: C.mutedSoft,
  },
  pillCountActive: { background: 'rgba(255,255,255,0.25)', color: '#fff' },
  // minWidth matters on narrow viewports — without it, `width:100%` +
  // tableLayout:fixed just shrinks every column to fit the screen instead
  // of triggering the wrapper's horizontal scroll, squeezing the detail
  // column down to a couple of characters per line.
  table: {
    width: '100%', minWidth: 640, borderCollapse: 'collapse' as const, tableLayout: 'fixed' as const,
  },
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
    verticalAlign: 'top' as const, padding: '13px 10px', fontSize: 12.5, color: C.textBody,
    borderBottom: `1px solid ${C.divider}`, lineHeight: 1.6,
  },
  tdActions: {
    verticalAlign: 'top' as const, padding: '13px 10px', borderBottom: `1px solid ${C.divider}`,
    whiteSpace: 'nowrap' as const,
  },
  // Detail text can mix plain lines and "-" bullets (see renderDetailLines)
  // — both get a small bottom margin so consecutive blocks read as
  // separate lines/points rather than running together, with the last
  // block's margin trimmed via :last-child in the page-level <style> block.
  detailList: { margin: '0 0 4px', paddingLeft: 16 },
  detailPara: { margin: '0 0 4px' },
  linkedChip: {
    display: 'inline-flex', alignItems: 'center', marginTop: 4, padding: '3px 9px',
    borderRadius: 999, fontSize: 11, fontWeight: 600, background: C.primarySoft,
    color: C.primary, textDecoration: 'none', border: `1px solid ${C.primaryBorder}`,
  },
  // userSelect:none matters here — a draggable element that contains/sits
  // near text otherwise shows the browser's text-selection (I-beam) cursor
  // instead of the custom grab cursor on hover in most browsers.
  dragHandle: {
    cursor: 'grab', fontSize: 13, flexShrink: 0, marginTop: 3, padding: '2px 4px',
    userSelect: 'none' as const, WebkitUserSelect: 'none' as const,
  },
  stepNumber: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 20, height: 20, borderRadius: '50%', fontSize: 10.5, fontWeight: 700,
    flexShrink: 0, marginTop: 1,
  },
  // Hidden until the row is hovered/focused (see .sop-row-action in the
  // <style> block) — with all three always on, a 13-row document reads as
  // a wall of icons before you've asked to edit anything. Revealing them
  // on hover keeps the page looking like the document it is until you
  // actually mean to act on a step.
  iconBtn: {
    width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.cardBorder}`,
    background: '#fff', cursor: 'pointer', color: C.muted, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 11.5, marginRight: 4,
    opacity: 0, transition: 'opacity 120ms ease',
  },
  // Deliberately icon-only: it sits right where the panel was, so a label
  // would only repeat what's already obvious from position. Discarding the
  // draft happens after resuming (the panel's own Cancel), not from here —
  // one control, one job.
  resumeTab: {
    position: 'fixed' as const, top: NAVBAR_HEIGHT + 24, right: 0, zIndex: 20,
    width: 40, height: 40, border: 'none', borderRadius: '10px 0 0 10px',
    background: C.primary, color: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(15,23,42,0.18)',
  },
};

const drawerS: Record<string, React.CSSProperties> = {
  panel: {
    position: 'fixed', top: NAVBAR_HEIGHT, right: 0, bottom: 0, width: 440,
    background: '#fff', borderLeft: `1px solid ${C.cardBorder}`,
    boxShadow: '-8px 0 28px rgba(15,23,42,0.08)', zIndex: 30,
    display: 'flex', flexDirection: 'column',
    transition: 'transform 200ms ease',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '18px 20px 14px', borderBottom: `1px solid ${C.divider}`, gap: 10, flexShrink: 0,
  },
  title: { margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: C.text },
  context: {
    display: 'flex', alignItems: 'center', fontSize: 11.5, color: C.primary, fontWeight: 600,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
  },
  closeBtn: {
    width: 28, height: 28, borderRadius: 8, border: 'none', flexShrink: 0,
    background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 13,
  },
  body: { padding: '18px 20px', overflowY: 'auto' as const, flex: 1 },
  field: { marginBottom: 18 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: C.textSub, marginBottom: 6, letterSpacing: '0.01em' },
  labelHint: { display: 'block', fontSize: 11, fontWeight: 400, color: C.mutedSoft, marginTop: 2 },
  chipRow: { display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 8 },
  chip: {
    padding: '6px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600,
    border: `1px solid ${C.cardBorder}`, background: '#fff', color: C.textSub, cursor: 'pointer',
  },
  chipActive: { borderColor: C.primary, background: C.primary, color: '#fff' },
  manageLink: {
    display: 'inline-flex', alignItems: 'center', marginTop: 8,
    fontSize: 11.5, fontWeight: 600, color: C.primary, textDecoration: 'none',
  },
  input: {
    width: '100%', padding: '9px 11px', fontSize: 13,
    border: `1px solid ${C.cardBorder}`, borderRadius: 8,
    outline: 'none', color: C.text, boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%', padding: '9px 11px', fontSize: 13, minHeight: 160,
    border: `1px solid ${C.cardBorder}`, borderRadius: 8, resize: 'vertical' as const,
    outline: 'none', color: C.text, boxSizing: 'border-box' as const, fontFamily: 'inherit',
  },
  linkMenu: {
    position: 'absolute' as const, top: '100%', left: 0, right: 0, marginTop: 6,
    background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: 10,
    boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 35, overflow: 'hidden',
  },
  filterChip: {
    padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600,
    border: `1px solid ${C.cardBorder}`, background: '#fff', color: C.textSub, cursor: 'pointer',
  },
  filterChipActive: { borderColor: C.primary, background: C.primary, color: '#fff' },
  linkMenuList: { maxHeight: 220, overflowY: 'auto' as const, padding: 6 },
  linkMenuItem: {
    display: 'block', width: '100%', padding: '8px 10px', marginTop: 2,
    border: 'none', borderRadius: 7, background: 'transparent', cursor: 'pointer',
    fontSize: 13, color: C.text, textAlign: 'left' as const,
  },
  linkMenuItemActive: { background: C.primarySoft, color: C.primary, fontWeight: 700 },
  linkMenuChip: {
    display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
    borderRadius: 999, fontSize: 10.5, fontWeight: 700,
  },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 10,
    padding: '14px 20px 18px', borderTop: `1px solid ${C.divider}`, flexShrink: 0,
  },
  cancelBtn: {
    padding: '10px 18px', borderRadius: 10, border: `1px solid ${C.cardBorder}`,
    background: '#fff', color: C.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  saveBtn: {
    padding: '10px 18px', borderRadius: 10, border: 'none',
    background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
};

// Mobile overrides, merged onto the base styles via useIsMobile (see
// TeacherMissionBoardPage.tsx for the same pattern). The table itself isn't
// restructured — it keeps its horizontal scroll wrapper (see `table`'s
// minWidth above) rather than becoming a card list, so the document still
// reads as the same table a trainer would recognise from a printed SOP.
const sMobile: Record<string, React.CSSProperties> = {
  page: { padding: '16px 12px' },
  card: { padding: '16px 14px' },
  sectionHeader: {
    padding: '14px 4px 4px', fontSize: 12.5, fontWeight: 700,
    textTransform: 'uppercase' as const, letterSpacing: '0.05em',
    borderLeft: '3px solid transparent',
  },
  stepCard: {
    border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '12px 12px 10px',
  },
  stepCardDetail: {
    marginTop: 8, fontSize: 12.5, color: C.textBody, lineHeight: 1.6,
  },
  stepCardActions: {
    display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10,
    paddingTop: 10, borderTop: `1px solid ${C.divider}`,
  },
};
