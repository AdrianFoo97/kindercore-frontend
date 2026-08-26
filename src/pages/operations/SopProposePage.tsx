import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft, faCheck, faPlus, faChevronRight, faTrash, faGripVertical, faVideo, faPen,
  faXmark, faLayerGroup,
} from '@fortawesome/free-solid-svg-icons';
import { fetchTemplates } from '../../api/sop-templates.js';
import { fetchSteps } from '../../api/sop-steps.js';
import { fetchCategories } from '../../api/sop-categories.js';
import { fetchSections } from '../../api/sop-sections.js';
import { createRevision, ProposedStep } from '../../api/sop-revisions.js';
import { useToast } from '../../components/common/Toast.js';
import { ALLOWED_SOP_ICONS, resolveSopIcon } from '../../utils/sopTemplateIcons.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';

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
const RADIUS = 14;
const SHADOW = '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)';
const NAVBAR_HEIGHT = 50;
const SECTION_ACCENTS = ['#5a67d8', '#0d9488', '#b45309', '#be185d', '#0369a1', '#7c3aed'];

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
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { isMobile } = useIsMobile();

  const { data: allTemplates = [] } = useQuery({ queryKey: ['sop-templates'], queryFn: () => fetchTemplates() });
  const target = isEditingExisting ? allTemplates.find(t => t.id === templateId) : null;
  const { data: liveSteps = [], isLoading: stepsLoading } = useQuery({
    queryKey: ['sop-steps', templateId],
    queryFn: () => fetchSteps(templateId!),
    enabled: isEditingExisting,
  });
  const { data: allCategories = [] } = useQuery({ queryKey: ['sop-categories'], queryFn: () => fetchCategories() });
  const { data: globalSections = [] } = useQuery({ queryKey: ['sop-sections'], queryFn: () => fetchSections() });

  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [icon, setIcon] = useState<string>(ALLOWED_SOP_ICONS[0]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [saving, setSaving] = useState(false);
  // Improving an existing How-To Guide only ever touches Steps — title,
  // goal, video, and labels are the admin's to own, not part of what a
  // teacher is proposing here (they're carried through unchanged in the
  // submitted snapshot). A brand-new proposal is the only flow that still
  // needs the Basic info step, since there's nothing to carry through yet.
  const [wizardStep, setWizardStep] = useState<1 | 2>(isEditingExisting ? 2 : 1);
  const showBasicInfo = !isEditingExisting && wizardStep === 1;
  const showSteps = isEditingExisting || wizardStep === 2;
  const [prefilled, setPrefilled] = useState(!isEditingExisting);

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

  const backTo = () => navigate(isEditingExisting ? `/operations/sops/${templateId}` : '/operations/sops');

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

  return (
    <div style={{ ...s.page, ...(isMobile ? sMobile.page : null) }}>
      <style>{`.sop-propose-cat:hover { border-color: ${C.primary} !important; color: ${C.primary} !important; }`}</style>
      {/* Basic info is a compact form and stays narrow/centered like one —
          Steps is the same grouped table the admin's real page renders, so
          it gets that page's exact width instead of being squeezed into the
          form's column. */}
      <div style={{ ...s.inner, ...(showSteps ? s.innerWide : {}) }}>
        <button onClick={backTo} style={s.backBtn}>
          <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: 6, fontSize: 11 }} />
          {isEditingExisting ? target?.title ?? 'Back' : 'How-To Guides'}
        </button>

        <div style={{ marginBottom: 20 }}>
          <h1 style={s.heading}>{isEditingExisting ? 'Suggest an Improvement' : 'Suggest a New How-To Guide'}</h1>
          <p style={s.subheading}>
            {isEditingExisting
              ? "Improve it together, follow it together — this won't change the current How-To Guide until a supervisor reviews and approves it."
              : 'A supervisor reviews and approves this before it appears in How-To Guides.'}
          </p>
          {!isEditingExisting && (
            <p style={{ margin: '8px 0 0', fontSize: 11.5, fontWeight: 700, color: C.primary, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>
              Step {wizardStep} of 2 — {wizardStep === 1 ? 'Basic info' : 'Steps'}
            </p>
          )}
        </div>

        {isEditingExisting && !prefilled ? (
          <p style={{ color: C.mutedSoft, fontSize: 13 }}>Loading current version…</p>
        ) : (
          <>
            {showBasicInfo && (
            <div style={{ ...s.card, ...(isMobile ? sMobile.card : null) }}>
              <div style={s.field}>
                <label style={s.label}>Title</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Picking" style={s.input} />
              </div>

              <div style={s.field}>
                <label style={s.label}>Icon</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ALLOWED_SOP_ICONS.map(name => {
                    const ic = resolveSopIcon(name);
                    const active = icon === name;
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setIcon(name)}
                        style={{
                          width: 40, height: 40, borderRadius: 10,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: active ? C.primarySoft : '#fff',
                          border: `2px solid ${active ? C.primary : C.cardBorder}`,
                          color: active ? C.primary : C.muted,
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

              <div style={s.field}>
                <label style={s.label}>
                  Goal
                  <span style={s.labelHint}>What does this procedure exist to ensure?</span>
                </label>
                <textarea value={goal} onChange={e => setGoal(e.target.value)} style={{ ...s.input, minHeight: 90, resize: 'vertical' as const }} />
              </div>

              <div style={s.field}>
                <label style={s.label}>
                  <FontAwesomeIcon icon={faVideo} style={{ marginRight: 5, fontSize: 11 }} />
                  Video
                  <span style={s.labelHint}>Optional link to a training video.</span>
                </label>
                <input type="text" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" style={s.input} />
              </div>

              <div style={{ ...s.field, marginBottom: 0 }} ref={categoryMenuRef}>
                <label style={s.label}>Categories</label>
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
                      <Link to="/settings/sop-categories" style={s.categoryManageLink} onClick={() => setCategoryMenuOpen(false)}>
                        Manage categories
                        <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, marginLeft: 6 }} />
                      </Link>
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
                recap or an edit affordance to offer. */}
            {!isEditingExisting && wizardStep === 2 && (
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
            <div style={s.stepsCardHeader}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>Steps</h3>
                <div style={s.cardSub}>
                  {`${steps.length} step${steps.length === 1 ? '' : 's'} across ${usedSections.length} section${usedSections.length === 1 ? '' : 's'}`}
                </div>
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

            {steps.length > 0 && (
              <div style={s.pillRow}>
                <button
                  onClick={() => setSectionFilter('ALL')}
                  style={{ ...s.pill, ...(sectionFilter === 'ALL' ? s.pillActive : {}) }}
                >
                  All sections
                  <span style={{ ...s.pillCount, ...(sectionFilter === 'ALL' ? s.pillCountActive : {}) }}>{steps.length}</span>
                </button>
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
              const rows = displaySteps.map(st => {
                const showHeader = sectionFilter === 'ALL' && st.section !== lastSection;
                if (showHeader) { lastSection = st.section; posInGroup = 0; }
                const stepNumber = posInGroup + 1;
                posInGroup += 1;
                const accent = sectionAccent(st.section);
                const detailLines = (st.detail ?? '').split('\n').map(l => l.trim()).filter(Boolean);
                const isDrag = dragKey === st.key;
                const isDrop = dropKey === st.key && dragKey !== st.key;
                return { st, showHeader, stepNumber, accent, detailLines, isDrag, isDrop };
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
                  {rows.map(({ st, showHeader, stepNumber, accent, detailLines, isDrag, isDrop }) => (
                    <React.Fragment key={st.key}>
                      {showHeader && (
                        <div style={{ ...sMobile.sectionHeader, borderLeftColor: accent }}>
                          <span style={{ color: accent }}>{st.section}</span>
                          <span style={s.sectionGroupCount}>{sectionCounts.get(st.section) ?? 0}</span>
                        </div>
                      )}
                      <div
                        style={{ ...sMobile.stepCard, opacity: isDrag ? 0.45 : 1, background: isDrop ? C.primarySoft : '#fff' }}
                        onDragOver={onDragOver(st.key)}
                        onDrop={onDrop(st.key)}
                      >
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
                    .propose-step-row:hover { background: ${C.divider}; }
                    .propose-grip:hover { color: ${C.primary} !important; }
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
                            style={{ opacity: isDrag ? 0.45 : 1, background: isDrop ? C.primarySoft : undefined }}
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

            {steps.length > 0 && (
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

            <div style={s.footer}>
              {wizardStep === 1 ? (
                <>
                  <button onClick={backTo} style={s.cancelBtn}>Cancel</button>
                  <button onClick={() => setWizardStep(2)} disabled={!title.trim() || !goal.trim()} style={{ ...s.saveBtn, opacity: !title.trim() || !goal.trim() ? 0.5 : 1 }}>
                    Next
                    <FontAwesomeIcon icon={faChevronRight} style={{ marginLeft: 6, fontSize: 11 }} />
                  </button>
                </>
              ) : (
                <>
                  {isEditingExisting ? (
                    <button onClick={backTo} style={s.cancelBtn}>Cancel</button>
                  ) : (
                    <button onClick={() => setWizardStep(1)} style={s.cancelBtn}>Back</button>
                  )}
                  <button onClick={submit} disabled={!title.trim() || !goal.trim() || cleanSteps.length === 0 || saving} style={{ ...s.saveBtn, opacity: !title.trim() || !goal.trim() || cleanSteps.length === 0 || saving ? 0.5 : 1 }}>
                    <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />
                    {saving ? 'Submitting…' : 'Submit for approval'}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {drawer.mode !== 'closed' && (
        <ProposeStepDrawer
          mode={drawer.mode}
          initial={editingStep}
          insertAfterStep={drawer.mode === 'new' && drawer.insertAfterKey ? steps.find(s => s.key === drawer.insertAfterKey) ?? null : null}
          sections={existingSections}
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
  mode, initial, insertAfterStep, sections, onCancel, onSave,
}: {
  mode: 'new' | 'edit';
  initial: DraftStep | null;
  insertAfterStep: DraftStep | null;
  sections: string[];
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

  return (
    <>
      <div style={drawerS.overlay} onClick={onCancel} />
      <div style={{ ...drawerS.panel, ...(isMobile ? { width: 'auto', left: 0 } : null) }}>
        <div style={drawerS.header}>
          <div>
            <div style={drawerS.title}>{mode === 'edit' ? 'Edit step' : 'Add step'}</div>
            <div style={drawerS.context}>
              <FontAwesomeIcon icon={faLayerGroup} style={{ marginRight: 5, fontSize: 10 }} />
              {contextText}
            </div>
          </div>
          <button onClick={onCancel} style={drawerS.closeBtn} aria-label="Close">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div style={drawerS.body}>
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
              <input type="text" value={section} onChange={e => setSection(e.target.value)} placeholder="e.g. Main Process" style={s.input} />
            )}
          </div>

          <div style={s.field}>
            <label style={s.label}>Step title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Confirm the pick list" style={s.input} autoFocus />
          </div>

          <div style={{ ...s.field, marginBottom: 0 }}>
            <label style={s.label}>
              Operation details
              <span style={s.labelHint}>One point per line. Start a line with "-" for a bullet point.</span>
            </label>
            <textarea value={detail} onChange={e => setDetail(e.target.value)} style={{ ...s.input, minHeight: 140, resize: 'vertical' as const }} />
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
    </>
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
    background: C.primarySoft, color: C.primary, fontSize: 16,
  },
  recapEditBtn: {
    width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.cardBorder}`,
    background: '#fff', cursor: 'pointer', color: C.mutedSoft, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  field: { marginBottom: 18 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: C.textSub, marginBottom: 6, letterSpacing: '0.01em' },
  labelHint: { display: 'block', fontSize: 11, fontWeight: 400, color: C.mutedSoft, marginTop: 2 },
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
  },
  pillActive: { borderColor: C.primary, background: C.primary, color: '#fff' },
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
    padding: '7px 14px', borderRadius: 8, border: 'none', background: C.primary,
    color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  },
  primaryBtnGhost: {
    padding: '8px 16px', borderRadius: 10, border: `1px dashed ${C.primaryBorder}`,
    background: C.primarySoft, color: C.primary, fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  chipRow: { display: 'flex', flexWrap: 'wrap' as const, gap: 6 },
  chip: {
    padding: '6px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600,
    border: `1px solid ${C.cardBorder}`, background: '#fff', color: C.textSub, cursor: 'pointer',
  },
  chipActive: { borderColor: C.primary, background: C.primary, color: '#fff' },
  sectionManageLink: {
    display: 'inline-flex', alignItems: 'center', marginTop: 4,
    fontSize: 11.5, fontWeight: 600, color: C.primary, textDecoration: 'none',
  },
  dragHandle: {
    cursor: 'grab', fontSize: 13, flexShrink: 0, marginTop: 3, padding: '2px 4px', color: C.mutedSoft,
    userSelect: 'none' as const, WebkitUserSelect: 'none' as const,
  },
  stepNumber: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22,
    borderRadius: '50%', background: C.primarySoft, color: C.primary, fontSize: 11, fontWeight: 700, flexShrink: 0,
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
    fontSize: 12, fontWeight: 600, color: C.primary, textDecoration: 'none',
  },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  cancelBtn: {
    padding: '10px 18px', borderRadius: 10, border: `1px solid ${C.cardBorder}`,
    background: '#fff', color: C.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  saveBtn: {
    padding: '10px 18px', borderRadius: 10, border: 'none',
    background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
};

// Mobile overrides, merged onto the base styles via useIsMobile.
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
    marginTop: 8, fontSize: 12.5, color: C.textSub, lineHeight: 1.6,
  },
  stepCardActions: {
    display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10,
    paddingTop: 10, borderTop: `1px solid ${C.divider}`,
  },
};

const drawerS: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', top: NAVBAR_HEIGHT, left: 0, right: 0, bottom: 0,
    background: 'rgba(15,23,42,0.28)', zIndex: 29,
  },
  panel: {
    position: 'fixed', top: NAVBAR_HEIGHT, right: 0, bottom: 0, width: 440,
    background: '#fff', borderLeft: `1px solid ${C.cardBorder}`,
    boxShadow: '-8px 0 28px rgba(15,23,42,0.08)', zIndex: 30,
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
