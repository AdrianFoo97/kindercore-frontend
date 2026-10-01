import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faPenToSquare, faEllipsisVertical, faMagnifyingGlass, faGear,
  faClipboardCheck, faChevronRight, faChevronDown, faCheck, faListCheck, faLayerGroup, faClockRotateLeft,
} from '@fortawesome/free-solid-svg-icons';
import { fetchTemplates } from '../../api/sop-templates.js';
import { fetchSteps } from '../../api/sop-steps.js';
import { fetchCategories } from '../../api/sop-categories.js';
import { resolveSopIcon } from '../../utils/sopTemplateIcons.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useScrolledPast } from '../../hooks/useScrolledPast.js';
import { TEACHER_TOPBAR_SPACE } from '../../components/common/TeacherTopBar.js';

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
// The teacher app's own accent + font, applied instead of C's indigo/
// system-ui when this page is reached from its Guides tab on mobile (see
// themeIsTeacher below) — matches TeacherHomePage.tsx / TeacherTopBar.tsx.
const TEACHER_ACCENT = { accent: '#7c3aed', soft: '#f5f3ff', border: '#ddd6fe' };
const TEACHER_FONT =
  '"Segoe UI", Roboto, Arial, sans-serif';
// Same violet wash TeacherHomePage.tsx uses behind its identity hero —
// holds solid behind the Learn/Follow/Improve strip, then fades to the
// calm page base, instead of flat gray top to bottom.
const TEACHER_HERO_BG = '#ede9fe';
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
  const currentUser = rawUser ? (JSON.parse(rawUser) as { role?: string; teacherId?: string | null }) : null;
  // Only actually rendered/reachable for themeIsTeacher — see the "⋯"
  // menu below. Guides is one of the floating teacher chrome's 4 tab-
  // root pages, all of which need a way into Settings (TeacherTopBar.tsx
  // renders its own top-right "⋯" with that same item on the other 3 —
  // Home/Career/Pay — but skips doing that here specifically, since this
  // page already portals its own "⋯" into that identical spot for
  // "Suggest a new guide"; adding a second button next to it would've
  // been a worse redundant-looking pair of dots than just adding this as
  // one more item in the one that's already there).
  const settingsPath = currentUser?.teacherId ? `/teachers/${currentUser.teacherId}/settings` : null;
  const { hasView } = usePermissions();
  const realIsAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPERADMIN' || hasView('OPERATION_SOP_APPROVE');
  // Dev-only preview: ?previewTeacher=1 forces the teacher view for an
  // admin so they can check it without a separate USER login. Query-param
  // read is gated on import.meta.env.DEV so it's inert in production even
  // if someone guesses the param.
  const [searchParams] = useSearchParams();
  const previewingTeacher = import.meta.env.DEV && searchParams.get('previewTeacher') === '1';
  // Reached via the teacher app's own Guides tab (see TeacherMobileNav.tsx)
  // rather than the admin Navbar's Operation menu — keeps the floating
  // TeacherTopBar/TeacherMobileNav showing instead of switching to the
  // admin chrome (App.tsx's isTeacherSurface, TeacherTopBar.tsx's
  // teacherSopTopBar) and, below, reserves top padding to clear that bar.
  const fromTeacherApp = searchParams.get('app') === 'teacher';
  const isAdmin = previewingTeacher ? false : realIsAdmin;
  const addSopPath = isAdmin ? '/operations/sops/new' : '/operations/sops/propose';
  // Carried through so clicking into a guide keeps the same context on
  // the next page — the DEV-only teacher preview and/or the real teacher
  // app's chrome (see SopTemplateStepsPage.tsx / SopProposePage.tsx).
  const contextParams = new URLSearchParams();
  if (previewingTeacher) contextParams.set('previewTeacher', '1');
  if (fromTeacherApp) contextParams.set('app', 'teacher');
  const detailPathSuffix = contextParams.size > 0 ? `?${contextParams.toString()}` : '';
  // "Add" implies it goes live immediately — true for an admin, not for a
  // teacher, whose submission just starts a review. Label it honestly.
  const addSopLabel = isAdmin ? 'Add How-To Guide' : 'Suggest a new guide';

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

  // Teacher mobile: "Add/Suggest a How-To Guide" lives behind the "⋯" in
  // the floating top bar rather than a floating "+" button — a bare "+"
  // read as "this adds it now", which for most teachers isn't true (it
  // goes to a supervisor for approval). Portaled into the top bar's own
  // action slot, same technique as SopTemplateStepsPage.tsx's "⋯" menu.
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
  const [topbarSlot, setTopbarSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (themeIsTeacher) setTopbarSlot(document.getElementById('teacher-topbar-right-slot'));
  }, [themeIsTeacher]);
  // Anchored to this page's own root div (rather than the portaled "⋯"
  // button itself) purely so the ref attaches on the very first render
  // no matter what — see useScrolledPast's own comment for why that
  // matters on SopTemplateStepsPage.tsx specifically. `scrolled` itself
  // is unused now that the "⋯" button is always liquid glass — kept
  // only for the `pageRootRef` it also returns.
  const { ref: pageRootRef } = useScrolledPast(4, themeIsTeacher);

  // The other teacher tabs (Home, Leaderboard) never nest a card inside
  // another card — individually-bordered cards sit flat on the page
  // background under a small uppercase caption. Match that here instead
  // of this page's own admin convention (everything inside one white
  // sheet with a plain-text counter), which only applies outside the
  // teacher app now.
  const listWrapStyle: React.CSSProperties = themeIsTeacher ? {} : { ...s.card, ...(isMobile ? sMobile.card : null) };
  const countLabelStyle: React.CSSProperties = themeIsTeacher
    ? { fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }
    : s.cardSub;
  const rowStyle: React.CSSProperties = themeIsTeacher
    ? {
        display: 'flex', gap: 14, alignItems: 'center', padding: 16,
        border: `1px solid ${C.cardBorder}`, borderRadius: 16, background: C.card,
        cursor: 'pointer', boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
      }
    : { ...s.templateRow, ...(isMobile ? sMobile.templateRow : null) };
  const emptyBoxStyle = (padding: string): React.CSSProperties => themeIsTeacher
    ? { padding, textAlign: 'center', background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16 }
    : { padding, textAlign: 'center' };

  // Search + category filter: the admin/plain-mobile layout stacks them
  // as two full-width bars (sMobile.toolbar). In the teacher app that
  // wastes vertical space above the fold — put them in one row instead,
  // search taking the width and the filter as a compact trigger next to
  // it, same footprint as a typical mobile search-and-filter bar.
  const filterRowStyle: React.CSSProperties = themeIsTeacher
    ? { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'nowrap' }
    : { ...s.toolbar, ...(isMobile ? sMobile.toolbar : null) };
  const searchWrapStyle: React.CSSProperties = themeIsTeacher
    ? { position: 'relative', flex: 1, minWidth: 0 }
    : { ...s.searchWrap, ...(isMobile ? sMobile.searchWrap : null) };
  const catFilterWrapStyle: React.CSSProperties = themeIsTeacher
    ? { position: 'relative', flexShrink: 0, width: 132 }
    : { position: 'relative', ...(isMobile ? { width: '100%' } : null) };
  const catFilterTriggerStyle: React.CSSProperties = themeIsTeacher
    ? { ...s.categoryFilterTrigger, width: '100%', minWidth: 0, padding: '8px 10px' }
    : { ...s.categoryFilterTrigger, ...(isMobile ? { width: '100%' } : null) };
  const catFilterMenuStyle: React.CSSProperties = themeIsTeacher
    ? { ...s.categoryFilterMenu, width: 220, left: 'auto', right: 0 }
    : { ...s.categoryFilterMenu, ...(isMobile ? { width: '100%' } : null) };

  // With the in-page heading/subheading hidden (themeIsTeacher — the
  // floating TeacherTopBar already carries the title), this strip is the
  // very first thing on the page instead of the third — give it real
  // breathing room below the floating bar and a bit more presence
  // (bigger pills, bigger number badges) instead of the tight, purely
  // decorative treatment it had underneath a full heading+subheading.
  const principlesStripStyle: React.CSSProperties = themeIsTeacher
    ? { ...sMobile.principlesStrip, marginTop: 4, marginBottom: 20, gap: 8 }
    : sMobile.principlesStrip;
  const principleChipStyle: React.CSSProperties = themeIsTeacher
    ? { ...sMobile.principleChip, padding: '7px 14px', fontSize: 12 }
    : sMobile.principleChip;
  const principleStepNumberStyle: React.CSSProperties = themeIsTeacher
    ? { ...sMobile.principleStepNumber, width: 19, height: 19, fontSize: 10.5 }
    : sMobile.principleStepNumber;

  // Longhand only when mobile — never mix the `padding` shorthand with a
  // `paddingTop` override in the same style object (React can drop the
  // longhand on re-render). Desktop keeps s.page's shorthand untouched;
  // fromTeacherApp only matters on mobile, since desktop always shows the
  // normal admin chrome regardless (see App.tsx's isTeacherSurface).
  const pageStyle: React.CSSProperties = isMobile
    ? {
        // Clears just the back/"⋯" row (TEACHER_TOPBAR_SPACE), not the
        // full TEACHER_CONTENT_TOP reservation — the page's own <h1>
        // below is the title now for the teacher-app case (see
        // titleMovedToPage in TeacherTopBar.tsx), so there's no
        // separate title row to also clear.
        paddingTop: fromTeacherApp ? TEACHER_TOPBAR_SPACE : 18,
        paddingRight: 14,
        paddingBottom: 14,
        paddingLeft: 14,
        fontFamily: themeIsTeacher ? TEACHER_FONT : 'system-ui, -apple-system, "Segoe UI", sans-serif',
        // Same violet-wash-fading-to-base treatment as Home, instead of
        // flat gray — holds solid behind the Learn/Follow/Improve strip
        // then fades out before the guide list starts. Ramps up
        // gradually from 0, not a hard C.bg→TEACHER_HERO_BG step at the
        // title's edge — two stops at the same position is an instant
        // colour jump, which reads as a hard line under the title no
        // matter how well the colours either side "match" at that
        // single point (same fix as TeacherHomePage.tsx).
        background: themeIsTeacher
          ? `linear-gradient(to bottom,
               ${C.bg}             0,
               ${TEACHER_HERO_BG} calc(90px + env(safe-area-inset-top)),
               ${TEACHER_HERO_BG} calc(120px + env(safe-area-inset-top)),
               ${C.bg}             calc(190px + env(safe-area-inset-top)),
               ${C.bg}             100%)`
          : C.bg,
        minHeight: '100vh', color: C.text,
        ...sopAccentVars,
      }
    : { ...s.page, ...sopAccentVars };

  return (
    <div ref={pageRootRef} style={pageStyle}>
      <style>{`
        /* hover-only guard — without it, tapping a card on a touchscreen
           triggers :hover with no mouse ever "leaving" to clear it, so
           the last-tapped card stays stuck with a violet border/shadow
           until something else is tapped. Real hover-capable devices
           (mouse/trackpad) still get the effect on actual mouseover. */
        @media (hover: hover) {
          .sop-tpl-row:hover { border-color: ${'var(--sop-accent-border)'} !important; box-shadow: 0 1px 2px rgba(15,23,42,0.04), 0 4px 16px rgba(90,103,216,0.08) !important; }
          .sop-catfilter-trigger:hover { border-color: ${'var(--sop-accent-border)'} !important; background: ${'var(--sop-accent-soft)'} !important; }
          .sop-catfilter-item:hover { background: ${C.divider} !important; }
          .sop-more-menu-item:hover { background: ${C.divider} !important; }
        }
      `}</style>
      <div style={s.inner}>
        {themeIsTeacher ? (
          // Page title lives here as plain content (same left margin as
          // every card below it), not in the shared floating bar.
          // TeacherTopBar suppresses its own at-rest title for this
          // route to match; it still shows a small centered version
          // once scrolled (see TeacherTopBar.tsx's titleMovedToPage).
          <h1 style={{
            margin: '0 0 16px', paddingLeft: 4, fontSize: 30, fontWeight: 800,
            color: '#334155', letterSpacing: '-0.02em',
          }}>
            Guides
          </h1>
        ) : (
          <div style={{ marginBottom: isMobile ? 16 : 18 }}>
            <h1 style={{ ...s.heading, ...(isMobile ? sMobile.heading : null) }}>How-To Guides</h1>
            {!isMobile && (
              <p style={s.subheading}>Simple, shared ways to help us work well, stay consistent, and keep improving together.</p>
            )}
          </div>
        )}

        {isMobile ? (
          // The three-row card was still a lot of vertical real estate to
          // spend before the actual guide list appears — the guides are
          // what someone opened this page for. The subheading above
          // already carries the same "learn/follow/improve" idea in one
          // sentence, so this only needs to be a quiet one-line reminder
          // of the three words, not a restatement of their descriptions.
          <div style={principlesStripStyle}>
            {PRINCIPLES.map((p, i) => (
              <span key={p.key} style={principleChipStyle}>
                <span style={{ ...principleStepNumberStyle, background: p.color }}>{i + 1}</span>
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

        <div style={filterRowStyle}>
          {templates.length > 0 && (
            <div style={searchWrapStyle}>
              <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12.5, color: C.mutedSoft }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search guides…"
                style={s.searchInput}
              />
            </div>
          )}

          {categories.length > 0 && (
            <div style={catFilterWrapStyle} ref={categoryFilterRef}>
              <button
                type="button"
                className="sop-catfilter-trigger"
                onClick={() => setCategoryFilterOpen(o => !o)}
                style={catFilterTriggerStyle}
              >
                {selectedCategory ? (
                  <>
                    <span style={{ ...s.categoryFilterDot, background: selectedCategory.color }} />
                    <span style={themeIsTeacher ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 } : undefined}>
                      {selectedCategory.name}
                    </span>
                  </>
                ) : (
                  <span style={themeIsTeacher ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 } : undefined}>
                    All categories
                  </span>
                )}
                <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 9, color: C.mutedSoft, marginLeft: 'auto', paddingLeft: 6, flexShrink: 0 }} />
              </button>

              {categoryFilterOpen && (
                <div style={catFilterMenuStyle}>
                  <button
                    type="button"
                    className="sop-catfilter-item"
                    onClick={() => { setCategoryFilter('ALL'); setCategoryFilterOpen(false); }}
                    style={s.categoryFilterItem}
                  >
                    <span style={{ width: 14 }}>{categoryFilter === 'ALL' && <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10, color: 'var(--sop-accent)' }} />}</span>
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
                      <span style={{ width: 14 }}>{categoryFilter === c.id && <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10, color: 'var(--sop-accent)' }} />}</span>
                      <span style={{ ...s.categoryFilterDot, background: c.color }} />
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Desktop/admin surface only — restricted to roles actually
              granted OPERATION_SOP_APPROVE (or ADMIN/SUPERADMIN), same
              `isAdmin` check that gates direct-edit affordances
              everywhere else on this page. The teacher app's equivalent
              (the floating circular button below) is open to everyone,
              not just isAdmin — see the comment there. */}
          {!themeIsTeacher && isAdmin && (
            <button onClick={() => navigate(`${addSopPath}${detailPathSuffix}`)} style={{ ...s.primaryBtn, marginLeft: isMobile ? 0 : 'auto', ...(isMobile ? { width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } : null) }}>
              <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
              {addSopLabel}
            </button>
          )}
        </div>

        {/* Every teacher app user gets this, not just isAdmin —
            addSopPath/addSopLabel already route each role correctly:
            isAdmin lands on the direct-create form, everyone else on
            SopProposePage's "Suggest a New How-To Guide" flow, which
            submits a revision for supervisor approval (identical
            mechanism to the per-guide "Suggest an Edit" button). Tucked
            into a "⋯" in the floating top bar instead of a floating "+"
            button — an icon-only "+" read as "this adds it now", which
            for most teachers isn't true, and matches the "⋯" already
            used for Download/Suggest-an-edit on the guide detail page.
            Portaled into the top bar's own action slot. */}
        {themeIsTeacher && topbarSlot && createPortal(
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
                  onClick={() => { setMoreMenuOpen(false); navigate(`${addSopPath}${detailPathSuffix}`); }}
                  style={s.moreMenuItem}
                >
                  <FontAwesomeIcon icon={isAdmin ? faPlus : faPenToSquare} style={{ width: 14, marginRight: 8, color: '#7c3aed' }} />
                  {addSopLabel}
                </button>
                {settingsPath && (
                  <>
                    <div style={{ height: 1, background: C.divider, margin: '4px 0' }} />
                    <button
                      type="button"
                      className="sop-more-menu-item"
                      onClick={() => { setMoreMenuOpen(false); navigate(settingsPath); }}
                      style={s.moreMenuItem}
                    >
                      <FontAwesomeIcon icon={faGear} style={{ width: 14, marginRight: 8, color: '#7c3aed' }} />
                      Settings
                    </button>
                  </>
                )}
              </div>
            )}
          </div>,
          topbarSlot,
        )}

        <div style={listWrapStyle}>
          {templatesLoading ? (
            <p style={{ padding: 32, textAlign: 'center', color: C.mutedSoft }}>Loading…</p>
          ) : templates.length === 0 ? (
            <div style={emptyBoxStyle('56px 20px')}>
              <div style={s.emptyIconWrap}>
                <FontAwesomeIcon icon={faClipboardCheck} style={{ fontSize: 20, color: 'var(--sop-accent)' }} />
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: C.text }}>No How-To Guides yet</h3>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: C.muted, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
                Capture the first one — a simple, shared way for the team to do a task well and consistently.
              </p>
              <button onClick={() => navigate(`${addSopPath}${detailPathSuffix}`)} style={s.primaryBtnGhost}>
                <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
                {isAdmin ? 'Add the first How-To Guide' : 'Suggest the first How-To Guide'}
              </button>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div style={emptyBoxStyle('48px 20px')}>
              <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
                {search ? `No How-To Guides match "${search}".` : 'No How-To Guides in this category.'}
              </p>
            </div>
          ) : (
            <>
              {!themeIsTeacher && (
                <div style={countLabelStyle}>
                  {filteredTemplates.length} How-To Guide{filteredTemplates.length === 1 ? '' : 's'}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: themeIsTeacher ? 0 : 12 }}>
                {pagedTemplates.map(t => {
                  const tMeta = meta[t.id];
                  return (
                    <div
                      key={t.id}
                      className="sop-tpl-row"
                      onClick={() => navigate(`/operations/sops/${t.id}${detailPathSuffix}`)}
                      style={rowStyle}
                    >
                      <div style={{
                        ...s.catIconWrap,
                        // A bigger square tile + glyph reads clearer as
                        // the card's visual anchor than the admin
                        // table's smaller 36px version — matches the
                        // icon tiles on Home's own cards (42px).
                        // Square, not stretched to the content column's
                        // height — that made it a tall rectangle instead.
                        ...(themeIsTeacher ? { width: 44, height: 44, fontSize: 17 } : null),
                      }}>
                        <FontAwesomeIcon icon={resolveSopIcon(t.icon)} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {themeIsTeacher ? (
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' as const, gap: 8 }}>
                            <span style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>{t.title}</span>
                            {(t.categories ?? []).length > 0 && (() => {
                              const visibleCats = t.categories!.slice(0, 3);
                              const extra = t.categories!.length - visibleCats.length;
                              return (
                                <div style={{ ...s.categoryChipRow, marginTop: 0 }}>
                                  {visibleCats.map(c => (
                                    <span key={c.id} style={{ ...s.categoryChip, background: `${c.color}1c`, color: c.color }}>
                                      {c.name}
                                    </span>
                                  ))}
                                  {extra > 0 && (
                                    <span style={{ ...s.categoryChip, background: C.divider, color: C.mutedSoft }}>
                                      +{extra}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                          <span style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>{t.title}</span>
                        )}
                        {t.goal && (
                          <p style={{
                            ...s.templateGoal,
                            // Reserves the full 2-line height (12px * 1.5
                            // line-height * 2) even when the goal is only
                            // one line, so the icon tile — vertically
                            // centered against this whole block — sits at
                            // the same height on every card, not shifting
                            // per how long each guide's goal happens to be.
                            ...(themeIsTeacher ? { minHeight: 36 } : null),
                          }}>
                            {t.goal}
                          </p>
                        )}
                        {!themeIsTeacher && (t.categories ?? []).length > 0 && (
                          <div style={s.categoryChipRow}>
                            {t.categories!.map(c => (
                              <span key={c.id} style={{ ...s.categoryChip, background: `${c.color}1c`, color: c.color }}>
                                {c.name}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Sections/steps/updated-date is card-back-of-
                            house bookkeeping, not something a teacher
                            deciding "is this the guide I need" reads —
                            keep it for admins scanning the library for
                            gaps to fill. */}
                        {!themeIsTeacher && (
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
                              {/* "Improved" implies an edit happened — true from v2
                                  onward, but a v1 guide (however it was created —
                                  direct add, or an approved "New How-To Guide"
                                  proposal) has never actually been revised yet.
                                  Saying "Improved {today}" for a guide that was
                                  simply just added today is misleading. */}
                              {t.currentVersion > 1 ? `Improved ${fmtDate(t.updatedAt)}` : `Added ${fmtDate(t.createdAt)}`}
                            </span>
                          </div>
                        )}
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
          fontSize: 12, fontWeight: 700, color: 'var(--sop-accent)', padding: '5px 14px',
          background: 'var(--sop-accent-soft)', borderRadius: 7, fontVariantNumeric: 'tabular-nums',
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
    background: 'var(--sop-accent)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  primaryBtnGhost: {
    padding: '8px 16px', borderRadius: 10, border: `1px dashed ${'var(--sop-accent-border)'}`,
    background: 'var(--sop-accent-soft)', color: 'var(--sop-accent)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  // Same size + always-on liquid glass as the shared TeacherTopBar's
  // own "⋯" (TeacherTopBar.tsx) — this is a second, page-specific "⋯"
  // portaled into the same slot (different menu contents: "Suggest a
  // new guide" here vs. Settings/admin links there), but the button
  // chrome itself should read as identical, not a visibly different
  // control in the same spot depending on which page you're on.
  moreBtn: {
    width: 32, height: 32, borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.32)', boxSizing: 'border-box' as const,
    background: 'rgba(255,255,255,0.22)',
    backdropFilter: 'blur(22px) saturate(180%)',
    WebkitBackdropFilter: 'blur(22px) saturate(180%)',
    boxShadow: '0 2px 10px rgba(15,23,42,0.12)',
    cursor: 'pointer', color: '#334155', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0,
    transition: 'background 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
  },
  moreMenu: {
    position: 'absolute' as const, top: '100%', right: 0, marginTop: 6, width: 200,
    background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: 10,
    boxShadow: '0 8px 24px rgba(15,23,42,0.14)', zIndex: 20, overflow: 'hidden', padding: 4,
  },
  moreMenuItem: {
    display: 'flex', alignItems: 'center', width: '100%', padding: '8px 10px',
    border: 'none', borderRadius: 7, background: 'transparent', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, color: C.textSub, textAlign: 'left' as const, fontFamily: 'inherit',
  },
  emptyIconWrap: {
    width: 44, height: 44, borderRadius: 12, background: 'var(--sop-accent-soft)',
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
    background: 'var(--sop-accent-soft)', color: 'var(--sop-accent)',
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
  // page's mobile padding is computed inline above (pageStyle) since it
  // depends on fromTeacherApp — this object no longer carries it.
  heading: { fontSize: 20 },
  // Single row, no wrap — the three chips split the full row width
  // evenly (each flex: 1) instead of sizing to their own content and
  // leaving empty space on the right.
  principlesStrip: { display: 'flex', gap: 10, marginBottom: 16 },
  // Rounded card, same chrome as every other surface on this page
  // (white background, cardBorder, RADIUS-scaled corners) instead of a
  // saturated pill — only the step-number circle keeps its accent
  // colour now, so the three still read as distinct steps without the
  // whole chip competing with the page's other cards for attention.
  // Symmetric padding — asymmetric (tight-left, loose-right) made each
  // chip's own edges uneven, which read as inconsistent gaps between
  // chips even though the flex `gap` between them is a uniform 10px.
  principleChip: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    flex: 1, minWidth: 0, padding: '7px 12px',
    background: '#fff', border: `1px solid ${C.cardBorder}`,
    borderRadius: 10, fontSize: 11, fontWeight: 700, color: C.text,
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
