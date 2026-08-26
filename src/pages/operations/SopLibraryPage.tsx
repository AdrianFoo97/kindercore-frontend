import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faMagnifyingGlass,
  faClipboardCheck, faChevronRight, faChevronDown, faCheck, faListCheck, faLayerGroup, faClockRotateLeft,
} from '@fortawesome/free-solid-svg-icons';
import { fetchTemplates } from '../../api/sop-templates.js';
import { fetchSteps } from '../../api/sop-steps.js';
import { fetchCategories } from '../../api/sop-categories.js';
import { resolveSopIcon } from '../../utils/sopTemplateIcons.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { usePermissions } from '../../hooks/usePermissions.js';

// ── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eef0f4',
  divider: '#f1f5f9',
  text: '#0f172a',
  textSub: '#475569',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  // True neutral, no blue undertone — reserved for the goal preview text on
  // each card, which otherwise reads like link text next to the page's
  // actual indigo accents (same fix as SopTemplateStepsPage's textBody).
  textBody: '#52525b',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
  primaryBorder: '#c7d2fe',
  danger: '#dc2626',
};
const RADIUS = 14;
const SHADOW = '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)';
const PAGE_SIZE = 10;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

const PRINCIPLES = [
  { key: 'learn', label: 'Learn', color: '#5a67d8', bg: '#eef2ff', text: 'See our current best-known way.' },
  { key: 'follow', label: 'Follow', color: '#0d9488', bg: '#f0fdfa', text: 'Work consistently as one team.' },
  { key: 'improve', label: 'Improve', color: '#b45309', bg: '#fffbeb', text: 'See a better way? Help us improve it.' },
];

export default function SopLibraryPage() {
  const navigate = useNavigate();
  const { isMobile } = useIsMobile();

  // Admins, and anyone whose AuthRole grants OPERATION_SOP_APPROVE (the
  // "Supervisor" tier — same view that unlocks Approve/Reject on the
  // Improvement Inbox), add a How-To Guide directly. Everyone else drafts a
  // suggestion that has to be reviewed first — same starting intent,
  // different landing page and honest button label.
  const rawUser = localStorage.getItem('user');
  const currentUser = rawUser ? (JSON.parse(rawUser) as { role?: string }) : null;
  const { hasView } = usePermissions();
  const realIsAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPERADMIN' || hasView('OPERATION_SOP_APPROVE');
  // Dev-only preview: ?previewTeacher=1 forces the teacher view for an
  // admin so they can check it without a separate USER login. Query-param
  // read is gated on import.meta.env.DEV so it's inert in production even
  // if someone guesses the param.
  const [searchParams] = useSearchParams();
  const previewingTeacher = import.meta.env.DEV && searchParams.get('previewTeacher') === '1';
  const isAdmin = previewingTeacher ? false : realIsAdmin;
  const addSopPath = isAdmin ? '/operations/sops/new' : '/operations/sops/propose';
  // Carried through so clicking into a guide from the teacher preview
  // keeps showing the teacher view there too (see SopTemplateStepsPage.tsx).
  const detailPathSuffix = previewingTeacher ? '?previewTeacher=1' : '';
  // "Add" implies it goes live immediately — true for an admin, not for a
  // teacher, whose submission just starts a review. Label it honestly.
  const addSopLabel = isAdmin ? 'Add How-To Guide' : 'Suggest a New How-To Guide';

  const { data: allTemplates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['sop-templates'],
    queryFn: () => fetchTemplates(),
  });
  const templates = useMemo(
    () => [...allTemplates].sort((a, b) => a.title.localeCompare(b.title)),
    [allTemplates],
  );

  const { data: categories = [] } = useQuery({ queryKey: ['sop-categories'], queryFn: () => fetchCategories() });

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const selectedCategory = categories.find(c => c.id === categoryFilter);
  // A flat pill row breaks down once the category list grows past a
  // handful (imagine 20+ labels wrapping across the top of the page) —
  // a dropdown stays a fixed size and scrolls internally regardless of
  // how many categories exist.
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const categoryFilterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!categoryFilterOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (categoryFilterRef.current && !categoryFilterRef.current.contains(e.target as Node)) {
        setCategoryFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [categoryFilterOpen]);
  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter(t => {
      const matchesSearch = !q || t.title.toLowerCase().includes(q) || (t.goal ?? '').toLowerCase().includes(q);
      const matchesCategory = categoryFilter === 'ALL' || (t.categories ?? []).some(c => c.id === categoryFilter);
      return matchesSearch && matchesCategory;
    });
  }, [templates, search, categoryFilter]);

  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search, categoryFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredTemplates.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pagedTemplates = filteredTemplates.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Each template's step + section counts, fetched once so the card can
  // show real document scope ("3 sections · 13 steps") without a click-through.
  const { data: meta = {} } = useQuery({
    queryKey: ['sop-step-meta', templates.map(t => t.id).join(',')],
    queryFn: async () => {
      const out: Record<string, { steps: number; sections: number }> = {};
      await Promise.all(templates.map(async t => {
        const steps = await fetchSteps(t.id);
        out[t.id] = { steps: steps.length, sections: new Set(steps.map(s => s.section)).size };
      }));
      return out;
    },
    enabled: templates.length > 0,
  });

  return (
    <div style={{ ...s.page, ...(isMobile ? sMobile.page : null) }}>
      <style>{`
        .sop-tpl-row:hover { border-color: ${C.primaryBorder} !important; box-shadow: 0 1px 2px rgba(15,23,42,0.04), 0 4px 16px rgba(90,103,216,0.08) !important; }
        .sop-catfilter-trigger:hover { border-color: ${C.primaryBorder} !important; background: ${C.primarySoft} !important; }
        .sop-catfilter-item:hover { background: ${C.divider} !important; }
      `}</style>
      <div style={s.inner}>
        <div style={{ marginBottom: isMobile ? 16 : 18 }}>
          <h1 style={{ ...s.heading, ...(isMobile ? sMobile.heading : null) }}>How-To Guides</h1>
          <p style={s.subheading}>Simple, shared ways to help us work well, stay consistent, and keep improving together.</p>
        </div>

        {isMobile ? (
          // The three-row card was still a lot of vertical real estate to
          // spend before the actual guide list appears — the guides are
          // what someone opened this page for. The subheading above
          // already carries the same "learn/follow/improve" idea in one
          // sentence, so this only needs to be a quiet one-line reminder
          // of the three words, not a restatement of their descriptions.
          <div style={sMobile.principlesStrip}>
            {PRINCIPLES.map((p, i) => (
              <span key={p.key} style={{ ...sMobile.principleChip, background: p.bg, color: p.color }}>
                <span style={{ ...sMobile.principleStepNumber, background: p.color }}>{i + 1}</span>
                {p.label}
              </span>
            ))}
          </div>
        ) : (
          <div style={s.principlesRow}>
            {PRINCIPLES.map(p => (
              <div key={p.key} style={s.principleItem}>
                <span style={{ ...s.principleBadge, background: p.bg, color: p.color }}>{p.label.toUpperCase()}</span>
                <span style={s.principleText}>{p.text}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ ...s.toolbar, ...(isMobile ? sMobile.toolbar : null) }}>
          {templates.length > 0 && (
            <div style={{ ...s.searchWrap, ...(isMobile ? sMobile.searchWrap : null) }}>
              <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12.5, color: C.mutedSoft }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="What do you need help with?"
                style={s.searchInput}
              />
            </div>
          )}

          {categories.length > 0 && (
            <div style={{ position: 'relative', ...(isMobile ? { width: '100%' } : null) }} ref={categoryFilterRef}>
              <button
                type="button"
                className="sop-catfilter-trigger"
                onClick={() => setCategoryFilterOpen(o => !o)}
                style={{ ...s.categoryFilterTrigger, ...(isMobile ? { width: '100%' } : null) }}
              >
                {selectedCategory ? (
                  <>
                    <span style={{ ...s.categoryFilterDot, background: selectedCategory.color }} />
                    {selectedCategory.name}
                  </>
                ) : 'All categories'}
                <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 9, color: C.mutedSoft, marginLeft: 'auto', paddingLeft: 10 }} />
              </button>

              {categoryFilterOpen && (
                <div style={s.categoryFilterMenu}>
                  <button
                    type="button"
                    className="sop-catfilter-item"
                    onClick={() => { setCategoryFilter('ALL'); setCategoryFilterOpen(false); }}
                    style={s.categoryFilterItem}
                  >
                    <span style={{ width: 14 }}>{categoryFilter === 'ALL' && <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10, color: C.primary }} />}</span>
                    All categories
                  </button>
                  {categories.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className="sop-catfilter-item"
                      onClick={() => { setCategoryFilter(c.id); setCategoryFilterOpen(false); }}
                      style={s.categoryFilterItem}
                    >
                      <span style={{ width: 14 }}>{categoryFilter === c.id && <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10, color: C.primary }} />}</span>
                      <span style={{ ...s.categoryFilterDot, background: c.color }} />
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button onClick={() => navigate(addSopPath)} style={{ ...s.primaryBtn, marginLeft: isMobile ? 0 : 'auto', ...(isMobile ? { width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } : null) }}>
            <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
            {addSopLabel}
          </button>
        </div>

        <div style={{ ...s.card, ...(isMobile ? sMobile.card : null) }}>
          {templatesLoading ? (
            <p style={{ padding: 32, textAlign: 'center', color: C.mutedSoft }}>Loading…</p>
          ) : templates.length === 0 ? (
            <div style={{ padding: '56px 20px', textAlign: 'center' }}>
              <div style={s.emptyIconWrap}>
                <FontAwesomeIcon icon={faClipboardCheck} style={{ fontSize: 20, color: C.primary }} />
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: C.text }}>No How-To Guides yet</h3>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: C.muted, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
                Capture the first one — a simple, shared way for the team to do a task well and consistently.
              </p>
              <button onClick={() => navigate(addSopPath)} style={s.primaryBtnGhost}>
                <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
                {isAdmin ? 'Add the first How-To Guide' : 'Suggest the first How-To Guide'}
              </button>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
                {search ? `No How-To Guides match "${search}".` : 'No How-To Guides in this category.'}
              </p>
            </div>
          ) : (
            <>
              <div style={s.cardSub}>
                {filteredTemplates.length} How-To Guide{filteredTemplates.length === 1 ? '' : 's'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {pagedTemplates.map(t => {
                  const tMeta = meta[t.id];
                  return (
                    <div
                      key={t.id}
                      className="sop-tpl-row"
                      onClick={() => navigate(`/operations/sops/${t.id}${detailPathSuffix}`)}
                      style={{ ...s.templateRow, ...(isMobile ? sMobile.templateRow : null) }}
                    >
                      <div style={s.catIconWrap}>
                        <FontAwesomeIcon icon={resolveSopIcon(t.icon)} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>{t.title}</span>
                        {t.goal && <p style={s.templateGoal}>{t.goal}</p>}
                        {(t.categories ?? []).length > 0 && (
                          <div style={s.categoryChipRow}>
                            {t.categories!.map(c => (
                              <span key={c.id} style={{ ...s.categoryChip, background: `${c.color}1c`, color: c.color }}>
                                {c.name}
                              </span>
                            ))}
                          </div>
                        )}
                        <div style={s.metaRow}>
                          <span style={s.metaItem}>
                            <FontAwesomeIcon icon={faLayerGroup} style={{ fontSize: 10.5 }} />
                            {tMeta ? `${tMeta.sections} section${tMeta.sections === 1 ? '' : 's'}` : '…'}
                          </span>
                          <span style={s.metaDot} />
                          <span style={s.metaItem}>
                            <FontAwesomeIcon icon={faListCheck} style={{ fontSize: 10.5 }} />
                            {tMeta ? `${tMeta.steps} step${tMeta.steps === 1 ? '' : 's'}` : '…'}
                          </span>
                          <span style={s.metaDot} />
                          <span style={s.metaItem}>
                            <FontAwesomeIcon icon={faClockRotateLeft} style={{ fontSize: 10.5 }} />
                            Improved {fmtDate(t.updatedAt)}
                          </span>
                        </div>
                      </div>
                      <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 12, color: C.mutedSoft, marginLeft: 4, flexShrink: 0 }} />
                    </div>
                  );
                })}
              </div>
              <SopPagination page={safePage} pageCount={pageCount} totalCount={filteredTemplates.length} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SopPagination({ page, pageCount, totalCount, onPageChange }: {
  page: number;
  pageCount: number;
  totalCount: number;
  onPageChange: (p: number) => void;
}) {
  if (totalCount <= PAGE_SIZE) return null;
  const btn: React.CSSProperties = {
    background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: 7,
    padding: '5px 11px', fontSize: 12, fontWeight: 600, color: C.muted,
    cursor: 'pointer', minWidth: 30,
  };
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      padding: '16px 4px 4px', marginTop: 6, borderTop: `1px solid ${C.divider}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button type="button" onClick={() => onPageChange(1)} disabled={page === 1} style={btn}>«</button>
        <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} style={btn}>‹</button>
        <span style={{
          fontSize: 12, fontWeight: 700, color: C.primary, padding: '5px 14px',
          background: C.primarySoft, borderRadius: 7, fontVariantNumeric: 'tabular-nums',
          minWidth: 52, textAlign: 'center',
        }}>{page} / {pageCount}</span>
        <button type="button" onClick={() => onPageChange(Math.min(pageCount, page + 1))} disabled={page >= pageCount} style={btn}>›</button>
        <button type="button" onClick={() => onPageChange(pageCount)} disabled={page >= pageCount} style={btn}>»</button>
      </div>
      <span style={{ fontSize: 11, color: C.mutedSoft, fontVariantNumeric: 'tabular-nums' }}>
        {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
      </span>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', background: C.bg, minHeight: '100vh', color: C.text },
  inner: { maxWidth: 1100, margin: '0 auto' },
  heading: { margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' },
  subheading: { margin: 0, fontSize: 13, color: C.muted, maxWidth: 620 },
  principlesRow: { display: 'flex', gap: 20, flexWrap: 'wrap' as const, marginBottom: 20 },
  principleItem: { display: 'flex', alignItems: 'center', gap: 8 },
  principleBadge: {
    display: 'inline-flex', padding: '3px 9px', borderRadius: 999,
    fontSize: 10, fontWeight: 800, letterSpacing: '0.05em', flexShrink: 0,
  },
  principleText: { fontSize: 12.5, color: C.textSub },
  toolbar: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const, marginBottom: 20 },
  searchWrap: { position: 'relative', flex: '1 1 320px', maxWidth: 420, minWidth: 220 },
  searchInput: {
    width: '100%', padding: '9px 12px 9px 36px', fontSize: 13,
    border: `1px solid ${C.cardBorder}`, borderRadius: 10,
    outline: 'none', color: C.text, boxSizing: 'border-box', background: '#fff',
  },
  card: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS,
    padding: '22px 26px', boxShadow: SHADOW,
  },
  cardSub: { fontSize: 11, color: C.mutedSoft },
  primaryBtn: {
    padding: '9px 16px', borderRadius: 10, border: 'none',
    background: C.primary, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  primaryBtnGhost: {
    padding: '8px 16px', borderRadius: 10, border: `1px dashed ${C.primaryBorder}`,
    background: C.primarySoft, color: C.primary, fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  emptyIconWrap: {
    width: 44, height: 44, borderRadius: 12, background: C.primarySoft,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 14px',
  },
  templateRow: {
    display: 'flex', gap: 14, alignItems: 'center', padding: '14px 16px',
    border: `1px solid ${C.cardBorder}`, borderRadius: 12, background: '#fff',
    cursor: 'pointer', transition: 'box-shadow 120ms ease, border-color 120ms ease',
  },
  catIconWrap: {
    width: 36, height: 36, borderRadius: 10, display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
    background: C.primarySoft, color: C.primary,
  },
  templateGoal: {
    margin: '4px 0 0', fontSize: 12, color: C.textBody, lineHeight: 1.5,
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
  },
  categoryChipRow: { display: 'flex', gap: 5, flexWrap: 'wrap' as const, marginTop: 6 },
  categoryChip: {
    display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
    borderRadius: 999, fontSize: 10.5, fontWeight: 700,
  },
  categoryFilterTrigger: {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px',
    border: `1px solid ${C.cardBorder}`, borderRadius: 10, background: '#fff',
    cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.textSub,
    minWidth: 180, transition: 'border-color 120ms ease, background 120ms ease',
  },
  categoryFilterDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  categoryFilterMenu: {
    position: 'absolute' as const, top: '100%', left: 0, marginTop: 6, width: 240,
    background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: 10,
    boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 25, overflow: 'hidden',
    maxHeight: 280, overflowY: 'auto' as const, padding: 6,
  },
  categoryFilterItem: {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 8px',
    border: 'none', background: 'transparent', borderRadius: 7, cursor: 'pointer',
    fontSize: 13, color: C.text, textAlign: 'left' as const,
  },
  metaRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' as const },
  metaItem: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.mutedSoft, fontWeight: 500 },
  metaDot: { width: 3, height: 3, borderRadius: '50%', background: C.mutedSoft, flexShrink: 0 },
};

// Mobile overrides, merged onto the base styles via useIsMobile so the
// layout reacts to live window resize (see TeacherMissionBoardPage.tsx for
// the same pattern).
const sMobile: Record<string, React.CSSProperties> = {
  page: { padding: '18px 14px' },
  heading: { fontSize: 20 },
  principlesStrip: { display: 'flex', flexWrap: 'wrap' as const, justifyContent: 'center' as const, gap: 10, marginBottom: 16 },
  // Symmetric padding — asymmetric (tight-left, loose-right) made each
  // chip's own edges uneven, which read as inconsistent gaps between
  // chips even though the flex `gap` between them is a uniform 10px.
  principleChip: {
    display: 'inline-flex', alignItems: 'center', padding: '5px 12px',
    borderRadius: 999, fontSize: 11, fontWeight: 700,
  },
  principleStepNumber: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 17, height: 17, borderRadius: '50%', color: '#fff',
    fontSize: 9.5, fontWeight: 800, marginRight: 6, flexShrink: 0,
  },
  toolbar: { flexDirection: 'column' as const, alignItems: 'stretch' },
  searchWrap: { flex: '1 1 auto', maxWidth: 'none', minWidth: 0 },
  card: { padding: '16px 14px' },
  templateRow: { padding: '12px 12px' },
};
