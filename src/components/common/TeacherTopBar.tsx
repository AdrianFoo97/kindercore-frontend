import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronLeft, faCircleExclamation, faCircleInfo, faEllipsisVertical,
  faBullhorn, faGraduationCap, faUsers, faMoneyBillTrendUp, faChartLine,
  faGear,
} from '@fortawesome/free-solid-svg-icons';
import { useScrolledPast } from '../../hooks/useScrolledPast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { MODULES } from '../../constants/authModules.js';

// Entry points into the wider admin app — a teacher account that's also
// been granted admin modules had no way to reach any of them from mobile
// at all: the floating teacher chrome replaces the real Navbar entirely
// on a phone-width screen (see App.tsx's showTeacherChrome), and that
// Navbar is the only place these otherwise live. Deliberately a flat
// list of single entry links, not a full copy of the Navbar's nested
// per-module dropdowns (Students/HR/Analysis etc. each have several sub-
// pages there) — tapping one hands off to the real admin Navbar, which
// already has its own complete nav (including its own hamburger on a
// narrow screen) once you land outside a teacher-surface route.
const ADMIN_MENU_LINKS = [
  { module: MODULES.LEADS, to: '/leads', label: 'Leads', icon: faBullhorn },
  { module: MODULES.STUDENTS, to: '/students', label: 'Students', icon: faGraduationCap },
  { module: MODULES.HR, to: '/teachers', label: 'HR', icon: faUsers },
  { module: MODULES.FINANCE, to: '/operations/operating-costs', label: 'Finance', icon: faMoneyBillTrendUp },
  { module: MODULES.ANALYSIS, to: '/analysis/sales-marketing', label: 'Analysis', icon: faChartLine },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Teacher top bar — the single app header for the whole gamified
// teacher experience. Fixed to the top, centered title. The back
// chevron is hidden on Home plus the four "main" pages that map to a
// bottom-nav tab (My Career / My Pay / Rewards / Leaderboard) since
// you switch those via the tab bar. Every spoke shows the chevron and
// it goes deterministically to that section's hub (no history-stack
// guessing).
//
// Mounted once in ProtectedLayout; the layout reserves an equal strip
// of top padding so page content never sits under the bar. Pages no
// longer render their own header.
// ─────────────────────────────────────────────────────────────────────────────

const FONT =
  '"Segoe UI", Roboto, Arial, sans-serif';

export const TEACHER_TOPBAR_HEIGHT = 52;
export const TEACHER_TOPBAR_SPACE = `calc(${TEACHER_TOPBAR_HEIGHT}px + env(safe-area-inset-top))`;
// The bar is transparent and floats over each page's own background
// (so it always matches the content behind it). Pages therefore can't
// rely on the layout reserving space — instead each teacher page sets
// its root paddingTop to this so its CONTENT clears the floating bar
// while its BACKGROUND still paints up behind it. 10px breathing room
// below the bar before content begins.
//
// Reads a CSS variable (with this same value as the fallback) rather
// than a bare literal so App.tsx's ProtectedLayout can collapse it to
// 0 on desktop, where this bar isn't mounted at all — the normal
// admin Navbar (in-flow, not floating) already pushes content down,
// so no reserved top padding is needed there. Every teacher page just
// imports this one constant; none of them need to know which chrome
// is showing.
export const TEACHER_CONTENT_TOP =
  `var(--teacher-content-top, calc(${TEACHER_TOPBAR_HEIGHT}px + env(safe-area-inset-top) + 10px))`;

const TEACHER_PATH = /^\/teachers\/([^/]+)\/(.+?)\/?$/;

// Exact route tail → display title. Routes are fixed, so this is a
// closed set; a section fallback covers anything unmapped.
const TITLES: Record<string, string> = {
  'home': 'Home',
  'my-career': 'My Career',
  'my-career/journey': 'Career Journey',
  'my-career/skill-badges': 'Skill Badges',
  'career/missions': 'Mission Board',
  'my-compensation': 'My Pay',
  'my-compensation/breakdown': 'Pay Breakdown',
  'my-compensation/earn-more': 'Grow My Pay',
  'my-compensation/benefits': 'Benefits & Perks',
  'my-compensation/appraisal': 'My Appraisal',
  'my-compensation/pools': 'Profit Sharing Pool',
  'my-compensation/annual-bonus': 'Annual Bonus',
  'rewards': 'Rewards',
  'rewards/catalog': 'Redeem Rewards',
  'rewards/earn': 'How to Earn Points',
  'leaderboard': 'Leaderboard',
  'settings': 'Settings',
  'settings/report-bug': 'Report a Bug',
};

// Tails that ARE a bottom-nav tab destination → no back chevron.
const MAIN_PAGES = new Set(['my-career', 'my-compensation', 'rewards', 'leaderboard']);

// Sentinel backTo value meaning "real browser-history back" rather than
// a deterministic route — for spokes reachable from more than one hub,
// where no single fixed destination is correct.
const GO_BACK = '__history_back__';

interface TopBarState {
  title: string;
  showBack: boolean;
  backTo: string;
}

// Guides (How-To Guide library) lives outside /teachers/:id — it's a
// shared admin/HR page (src/pages/operations/SopLibraryPage.tsx) that
// the teacher app also links into, tagged with ?app=teacher so this
// bar only takes over when reached from the Guides tab (see App.tsx's
// isTeacherSurface — the actual gate; this function trusts it already
// ran). The admin entry point via the Navbar's Operation menu is
// untouched: no ?app=teacher there, so the real admin Navbar shows
// instead, same as before.
function teacherSopTopBar(pathname: string, search: string): TopBarState | null {
  if (pathname === '/operations/sops' || pathname === '/operations/sops/') {
    return { title: 'Guides', showBack: false, backTo: '/operations/sops?app=teacher' };
  }
  if (pathname === '/operations/sops/propose') {
    // SopProposePage.tsx mirrors its own wizardStep into this same
    // `step` param (replacing history, not pushing) purely so this
    // resolver — which only ever sees pathname/search, not that
    // component's own state — can track which screen is actually
    // showing instead of a generic title the whole time.
    const onSteps = new URLSearchParams(search).get('step') === '2';
    // On Steps, back means "the previous step of this wizard" (Basic
    // info), not "leave the wizard" — SopProposePage.tsx reads this same
    // `step` param back into its own wizardStep state (see the comment
    // above), so landing here without it is enough to flip it back to 1.
    // Only Basic info's own back chevron actually exits to Guides.
    return {
      // Same "Name - Detail" dash format as the guide detail title
      // ("Picking - Main Process") — "Suggest a Guide" up front so the
      // collapsed bar still says what flow you're in, then the step
      // number so tapping Next and scrolling makes the advance obvious.
      title: `Suggest a Guide - Step ${onSteps ? 2 : 1}`,
      showBack: true,
      backTo: onSteps ? '/operations/sops/propose?app=teacher' : '/operations/sops?app=teacher',
    };
  }
  const proposeMatch = pathname.match(/^\/operations\/sops\/([^/]+)\/propose$/);
  if (proposeMatch) {
    return { title: 'Suggest an Edit', showBack: true, backTo: `/operations/sops/${proposeMatch[1]}?app=teacher` };
  }
  const detailMatch = pathname.match(/^\/operations\/sops\/([^/]+)$/);
  if (detailMatch) {
    // SopTemplateStepsPage.tsx mirrors the guide's own name and
    // whichever section header the teacher has scrolled to into these
    // same `guide`/`section` params (via useScrollSpySection, replacing
    // history — same technique as the wizard `step` param above) so
    // this resolver can show "Picking - Main Process" instead of a
    // generic "Guide" label — the guide name alone stays visible even
    // before any section has scrolled past the top yet, so a teacher
    // always knows which guide they're in.
    const params = new URLSearchParams(search);
    const guideName = params.get('guide');
    const currentSection = params.get('section');
    const title = guideName
      ? (currentSection ? `${guideName} - ${currentSection}` : guideName)
      : 'Guide';
    // Real history, not a hardcoded jump to the Guides list — a guide
    // can link to another guide (e.g. Picking → Packing), so "back"
    // must return to wherever the teacher actually came from, same
    // reasoning as every other spoke's GO_BACK below.
    return { title, showBack: true, backTo: GO_BACK };
  }
  return null;
}

/**
 * Resolve the top bar for a teacher path. Returns null when the path
 * is not a teacher gamified surface (the admin Navbar handles those).
 */
export function teacherTopBar(pathname: string, search: string = ''): TopBarState | null {
  if (pathname.startsWith('/operations/sops')) return teacherSopTopBar(pathname, search);
  const m = pathname.match(TEACHER_PATH);
  if (!m) return null;
  const [, teacherId, rawTail] = m;
  const tail = rawTail.replace(/\/$/, '');

  if (tail === 'settings') {
    // Reachable from the "⋯" on any of the 4 main tabs (Home/Career/
    // Pay/Guides), not just Home — a fixed backTo would be wrong for at
    // least 3 of those 4. Real browser-history back instead, same as
    // every other "opened from wherever you were" surface.
    return { title: 'Settings', showBack: true, backTo: GO_BACK };
  }
  if (tail.startsWith('settings/')) {
    // A spoke off Settings (e.g. Report a Bug) is only ever reached by
    // pushing forward from it — Settings is already the adjacent
    // history entry, so this is real browser-history back too, same as
    // Settings' own back button above. A deterministic backTo here
    // still *worked* (Settings did show), but as a forward push, not an
    // undo — leaving a second Settings entry sitting behind it, which
    // is exactly what made Settings' own back button (real history
    // back) pop to this spoke again instead of wherever you'd actually
    // been before Settings.
    return {
      title: TITLES[tail] ?? 'Settings',
      showBack: true,
      backTo: GO_BACK,
    };
  }
  // Which section this tail belongs to (drives the back target).
  const section: 'my-career' | 'my-compensation' | 'rewards' | 'home' | 'leaderboard' | null =
    tail === 'home' ? 'home'
    : tail === 'leaderboard' ? 'leaderboard'
    : tail.startsWith('my-compensation') ? 'my-compensation'
    : tail.startsWith('rewards') ? 'rewards'
    : (tail.startsWith('my-career') || tail === 'career/missions')
      ? 'my-career'
    : null;
  if (!section) return null;

  // Title: exact map, then dynamic detail pages, then section default.
  const title =
    TITLES[tail] ??
    (tail.startsWith('rewards/catalog/') ? 'Reward'
      : tail.startsWith('rewards/my/') ? 'My Reward'
      : section === 'home' ? 'Home'
      : section === 'leaderboard' ? 'Leaderboard'
      : section === 'my-compensation' ? 'My Pay'
      : section === 'rewards' ? 'Rewards'
      : 'My Career');

  if (tail === 'home') {
    // Home is the teacher's landing — no back chevron, ever. It's a
    // bottom-nav tab destination like the other MAIN_PAGES.
    return { title, showBack: false, backTo: '/teachers' };
  }
  if (MAIN_PAGES.has(tail)) {
    return { title, showBack: false, backTo: `/teachers/${teacherId}/${section}` };
  }
  // Spoke → real browser history, same as Settings above. Used to be a
  // deterministic backTo of the section hub, but spokes increasingly
  // have more than one real entry point (Team Pool from Home's "Team
  // this month" card, not just the Pay hub; Annual Bonus from Pay
  // Breakdown; more likely as the app grows) — a fixed destination is
  // only correct for however many of those entry points happen to
  // match it, and silently wrong for the rest. Real history always
  // goes back to wherever the teacher actually came from.
  return { title, showBack: true, backTo: GO_BACK };
}

// Routes that get a top-right "!" info button in the bar — page-
// specific orientation that would otherwise clutter the body. The
// bottom sheet bundles the pool's mission plus the honest caveats, so
// neither pool page needs to also spell this out again in its own body.
const INFO_ROUTES = /^\/teachers\/[^/]+\/my-compensation\/(pools|annual-bonus)\/?$/;
const INFO_CONTENT = {
  pools: {
    levers: ['Enrolment growth', 'Cost control'],
    caveats: [
      'This is a team reward pool, not your personal payout.',
      'The pool grows when the school achieves its monthly targets.',
      'Your final share is based on your weight during payout.',
    ],
  },
  annualBonus: {
    levers: ['Enrolment growth', 'Cost control'],
    caveats: [
      'This is a team reward pool, not your personal payout.',
      'The pool only grows in months the school hits its targets.',
      'Your final share is based on your weight and average appraisal score at actual payout — this page is an estimate, not a guarantee.',
    ],
  },
} as const;

export default function TeacherTopBar() {
  const { pathname, search, key: locationKey } = useLocation();
  const navigate = useNavigate();
  const bar = teacherTopBar(pathname, search);
  // My Career's hero (badge + centered identity block) already reads as
  // a centered masthead directly under the bar — a left-aligned title
  // above it would fight that layout. Every other page gets the
  // magazine-style left-aligned title at rest.
  const isCareerHub = /^\/teachers\/[^/]+\/my-career\/?$/.test(pathname);
  // Every page except Career hub suppresses this bar's at-rest title —
  // Home/Pay hub/Guides render their own in-content <h1> instead (same
  // left margin as their cards); every other spoke either already
  // carries its own in-page heading (e.g. Career Journey's "Your
  // Career Journey") or simply shows no title until scrolled, same as
  // those three. The small centered collapsed-on-scroll title still
  // applies everywhere, Career included — this only suppresses the
  // big at-rest version.
  const titleMovedToPage = !isCareerHub;
  const showInfo = INFO_ROUTES.test(pathname);
  const info = showInfo
    ? (pathname.includes('/annual-bonus') ? INFO_CONTENT.annualBonus : INFO_CONTENT.pools)
    : null;
  const [infoOpen, setInfoOpen] = useState(false);

  // Reset the popover whenever the route changes away from an info-eligible
  // page, so coming back later starts closed.
  useEffect(() => {
    if (!showInfo && infoOpen) setInfoOpen(false);
  }, [showInfo, infoOpen]);

  // Escape closes the popover — small but expected affordance.
  useEffect(() => {
    if (!infoOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setInfoOpen(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [infoOpen]);

  // Routes long enough to scroll a real way down (a multi-section step
  // list, a whole career map) — losing the title/back chevron/"⋯" menu
  // off the top defeats them right when they're most useful. Only those
  // three individually go `position: fixed` once scrolled — the row
  // itself (its background/layout) stays exactly the in-flow, scroll-
  // away, transparent element it always was; it's never the thing
  // that's actually fixed or tinted. Opt-in per route (not every teacher
  // page needs this — most are short), extend this list as more come up.
  const collapsesOnScroll = pathname.startsWith('/operations/sops')
    || pathname.endsWith('/my-career/journey')
    // Home/Career/Pay tab roots — same collapse-to-pill title treatment
    // Guides already has, so scrolling down on any of the 4 main tabs
    // now behaves consistently instead of only Guides doing it.
    || /^\/teachers\/[^/]+\/(home|my-career)\/?$/.test(pathname)
    // My Pay hub + its spokes — Pay Breakdown and Benefits & Perks in
    // particular grew long enough (hero total + full itemized table;
    // three benefit tiers) to lose the title off the top on scroll,
    // same problem the tab roots above already solved for.
    || /^\/teachers\/[^/]+\/my-compensation(\/(breakdown|earn-more|benefits|appraisal|pools|annual-bonus))?\/?$/.test(pathname)
    // Mission Board — can run long (many missions across categories);
    // same reasoning as the routes above.
    || /^\/teachers\/[^/]+\/career\/missions\/?$/.test(pathname);
  const { ref: headerRef, scrolled } = useScrolledPast(4, collapsesOnScroll);
  const collapsed = collapsesOnScroll && scrolled;

  const { hasModule } = usePermissions();
  const [menuOpen, setMenuOpen] = useState(false);
  // Two separate refs (not one wrapping element) because the trigger
  // button lives in-flow in the header while the dropdown itself is
  // portaled to <body> — a click-outside check needs both DOM nodes.
  const menuBtnElRef = useRef<HTMLButtonElement | null>(null);
  const menuDropdownRef = useRef<HTMLDivElement>(null);
  const visibleAdminLinks = ADMIN_MENU_LINKS.filter(l => hasModule(l.module));
  // Settings lives at /teachers/:id/settings — same :id this bar is
  // already showing chrome for, so pull it straight off the pathname
  // rather than threading it through TopBarState.
  const teacherIdMatch = pathname.match(/^\/teachers\/([^/]+)\//);
  const settingsPath = teacherIdMatch ? `/teachers/${teacherIdMatch[1]}/settings` : null;
  // Top-right "⋯", account menu (Settings, plus admin-module entry links
  // if any) — only on the 5 tab-root pages that don't already have
  // something of their own living in that exact spot: the Guides list
  // (SopLibraryPage.tsx) already portals its own "⋯" into this same
  // right-side slot for "Suggest a new guide", so its menu carries
  // Settings too instead of a second, competing button stacking on top
  // of the first. Always shown here, even for a plain teacher with no
  // admin module grants — TeacherMySettingsPage (which this links to)
  // carries the actual Logout button; this floating chrome otherwise had
  // no account affordance anywhere (the real Navbar's Logout never
  // renders here), so this is the account entry point for everyone now,
  // not just an admin escape hatch for the few who also have module
  // grants.
  const showMoreMenu = !!bar && !bar.showBack && !pathname.startsWith('/operations/sops');
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuBtnElRef.current?.contains(target)) return;
      if (menuDropdownRef.current && !menuDropdownRef.current.contains(target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  if (!bar) return null;

  return (
    <>
      {/* Continuous blurred bar, behind the back chevron/title/"⋯" —
          those were each getting their own small floating glass pill on
          scroll, but nothing tied them together into one bar, so the
          strip between them just went fully transparent, showing
          whatever content had scrolled up underneath with no blur at
          all (most noticeable over a plain white card, where a 55%-
          white pill is nearly invisible against 100%-white anyway).
          This sits low z-index, full width, fixed — a real "liquid
          glass nav bar" the pills now sit on top of, not isolated
          islands with dead transparent space between them. */}
      {collapsesOnScroll && (
        <div style={{
          // Below 5, not 44: <header> below sets `position: relative` +
          // `zIndex: 5`, which makes it establish its own stacking
          // context — everything inside it, title/back/"⋯" included,
          // stacks *within* that context and never actually competes
          // with a z-index on a sibling of <header> itself. At 44 this
          // sat in front of the entire header (title and all), the
          // opposite of "behind the pills" the comment above claims;
          // header's own z-index (5) is what this needs to lose to.
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 3,
          height: `calc(${TEACHER_TOPBAR_HEIGHT}px + env(safe-area-inset-top))`,
          background: collapsed ? 'rgba(255,255,255,0.04)' : 'transparent',
          backdropFilter: collapsed ? 'blur(26px) saturate(180%)' : undefined,
          WebkitBackdropFilter: collapsed ? 'blur(26px) saturate(180%)' : undefined,
          borderBottom: collapsed ? '1px solid rgba(255,255,255,0.14)' : '1px solid transparent',
          boxShadow: collapsed ? '0 2px 6px rgba(15,23,42,0.04)' : 'none',
          transition: 'background 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
          pointerEvents: 'none',
        }} />
      )}
      <header
      ref={headerRef}
      style={{
        // In-flow first child of the scroll container, so it scrolls
        // away WITH the page (not fixed, not sticky). The negative
        // margin cancels its flow space so the page root (with its own
        // background) reaches the very top and paints up behind this
        // transparent bar — the title shares the page's colour. Pages
        // reserve TEACHER_CONTENT_TOP padding so content clears it.
        position: 'relative',
        zIndex: 5,
        flexShrink: 0,
        height: TEACHER_TOPBAR_SPACE,
        marginBottom: `calc(-${TEACHER_TOPBAR_HEIGHT}px - env(safe-area-inset-top))`,
        paddingTop: 'env(safe-area-inset-top)',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Transparent so it shows the page's own background colour
        // (the bar overlays it). No shadow/elevation — the title is
        // meant to read as plain page content (see the pageStyle
        // gradient fixes on Home/Pay/Guides), not a separate nav bar
        // floating above it; a drop shadow here would recreate exactly
        // that "title lives in its own bar" look regardless of the
        // background colour matching underneath.
        background: 'transparent',
        boxShadow: 'none',
        fontFamily: FONT,
      }}
    >
      {/* Generic anchor a page can portal its own right-side action into
          (e.g. SopTemplateStepsPage's "⋯" menu) — this bar is mounted
          once in ProtectedLayout, outside every page's own component
          tree, so a page can't just render a button here directly. Only
          one page-owned slot is ever visible at a time in practice
          (routes needing it don't overlap the INFO_ROUTES "!" button
          below), so sharing the same right:8 position is safe.
          `position: fixed` on the SOP routes (rather than absolute,
          which would just scroll away with the in-flow header above) so
          whatever's portaled in here — the "⋯" menu — stays reachable
          the whole way down a long guide; harmless elsewhere since
          nothing else portals into this slot. */}
      <div
        id="teacher-topbar-right-slot"
        style={{
          position: collapsesOnScroll ? 'fixed' : 'absolute',
          right: 8, top: 'env(safe-area-inset-top)',
          height: TEACHER_TOPBAR_HEIGHT, display: 'flex', alignItems: 'center',
          zIndex: collapsesOnScroll ? 45 : undefined,
        }}
      />
      {showMoreMenu && (
        <button
          ref={menuBtnElRef}
          type="button"
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          style={{
            position: 'fixed',
            right: 8,
            top: `calc(env(safe-area-inset-top) + ${(TEACHER_TOPBAR_HEIGHT - 32) / 2}px)`,
            zIndex: 45,
            width: 32, height: 32, borderRadius: '50%',
            boxSizing: 'border-box' as const,
            // Always liquid-glass, on every page, regardless of scroll
            // position — was conditional on `moreMenuScrolled` before.
            border: '1px solid rgba(255,255,255,0.32)',
            background: 'rgba(255,255,255,0.22)',
            backdropFilter: 'blur(22px) saturate(180%)',
            WebkitBackdropFilter: 'blur(22px) saturate(180%)',
            boxShadow: '0 2px 10px rgba(15,23,42,0.12)',
            transition: 'background 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, cursor: 'pointer', padding: 0, outline: 'none',
            color: '#334155',
            WebkitAppearance: 'none' as const,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <FontAwesomeIcon icon={faEllipsisVertical} />
        </button>
      )}
      {bar.showBack && (
        <button
          type="button"
          onClick={() => {
            // replace, not push: "back" is an undo, and pushing a new
            // entry for it left a duplicate hub entry sitting in
            // history. Invisible for most spokes (their hub is a
            // MAIN_PAGES tab with no back button of its own to expose
            // it), but Settings' own back button reads real browser
            // history (GO_BACK below — it's reachable from several
            // tabs, so it can't have one fixed destination), and that
            // duplicate entry made it pop straight back to whichever
            // spoke you'd just left instead of wherever you'd actually
            // been before Settings.
            if (bar.backTo !== GO_BACK) { navigate(bar.backTo, { replace: true }); return; }
            // `key` is 'default' only when this is the first in-app entry
            // (deep link / refresh) — no history to pop then, so fall
            // back to Home rather than leaving the app entirely.
            if (locationKey !== 'default') navigate(-1);
            else navigate(teacherIdMatch ? `/teachers/${teacherIdMatch[1]}/home` : '/teachers');
          }}
          aria-label="Back"
          style={{
            // Always the liquid-glass circle, on every page, regardless
            // of scroll position — was conditional on `scrolled` before
            // (plain glyph at rest, glass only once there was content
            // sliding underneath it), but that read as inconsistent
            // page to page. Fixed + glass unconditionally now, same as
            // the "⋯"/"!" buttons.
            position: 'fixed' as const,
            left: 8,
            top: `calc(env(safe-area-inset-top) + ${(TEACHER_TOPBAR_HEIGHT - 32) / 2}px)`,
            width: 32, height: 32, borderRadius: '50%',
            boxSizing: 'border-box' as const,
            border: '1px solid rgba(255,255,255,0.32)',
            background: 'rgba(255,255,255,0.22)',
            backdropFilter: 'blur(22px) saturate(180%)',
            WebkitBackdropFilter: 'blur(22px) saturate(180%)',
            boxShadow: '0 2px 10px rgba(15,23,42,0.12)',
            fontSize: 15,
            zIndex: 45,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            outline: 'none',
            pointerEvents: 'auto',
            color: '#334155',
            transition: 'background 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
            WebkitAppearance: 'none' as const,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>
      )}
      {(!titleMovedToPage || collapsed) && (
      <h1
        style={{
          margin: 0,
          color: '#334155',
          letterSpacing: '-0.02em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          boxSizing: 'border-box',
          transition: 'font-size 180ms ease, font-weight 180ms ease, background 180ms ease, box-shadow 180ms ease',
          // Collapsed: always a small centered label, plain text (no
          // pill chrome — see the comment below), same for every page
          // including Career. At rest: Career keeps its original
          // centered title (its hero directly underneath is already a
          // centered badge + identity block, so a left-aligned title
          // above it would fight that layout) — every other page gets a
          // magazine-style masthead instead: bigger, bold, left-aligned,
          // like iOS's large-title pattern collapsing to a compact
          // centered bar title on scroll.
          ...(collapsed
            ? {
                // Fixed to the full bar (0 → TEACHER_TOPBAR_SPACE, its own
                // layer above the scrolled-away page — independent of the
                // translucent glass strip below, which is a separate
                // background-only element), then flex-centered on both
                // axes. A manual `top` offset assuming a fixed line-height
                // (the previous approach) drifts off-center any time the
                // real rendered line-height doesn't match the guess —
                // flexbox centers correctly regardless.
                position: 'fixed' as const,
                top: 0,
                left: 0,
                right: 0,
                height: TEACHER_TOPBAR_SPACE,
                paddingTop: 'env(safe-area-inset-top)',
                display: 'flex' as const,
                alignItems: 'center' as const,
                justifyContent: 'center' as const,
                // The box spans the full bar width, but only its centered
                // text is visible/interactive — pointer-events: none lets
                // taps on the back chevron / "⋯" (same z-index, painted
                // after this in DOM order) pass through instead of being
                // captured by this element's empty flex space.
                pointerEvents: 'none' as const,
                textAlign: 'center' as const,
                zIndex: 45,
                maxWidth: 'calc(100vw - 140px)',
                margin: '0 auto',
                fontSize: 15,
                fontWeight: 700,
                textShadow: '0 1px 2px rgba(255,255,255,0.6)',
              }
            : isCareerHub
              ? {
                  position: 'static' as const,
                  textAlign: 'center' as const,
                  padding: '0 52px',
                  maxWidth: '100%',
                  fontSize: 17,
                  fontWeight: 800,
                  textShadow: '0 1px 2px rgba(255,255,255,0.6)',
                }
              : {
                  position: 'static' as const,
                  textAlign: 'left' as const,
                  width: '100%',
                  // Clears the back chevron on spokes; matches the page's
                  // own left inset on tab roots (Home/Pay/Guides have no
                  // back button to clear).
                  paddingLeft: bar?.showBack ? 52 : 18,
                  paddingRight: 52,
                  maxWidth: '100%',
                  // iOS large-title sizing (e.g. Settings' masthead) — big
                  // and bold enough to read as a real magazine-style
                  // headline, not just a left-shifted version of the old
                  // compact title.
                  fontSize: 30,
                  fontWeight: 800,
                  textShadow: '0 1px 2px rgba(255,255,255,0.6)',
                }),
        }}
      >
        {bar.title}
      </h1>
      )}

      {showInfo && info && (
        <>
          {/* Quiet top-right "!" — icon only, slate so it doesn't
              compete with the page's violet accents. Always fixed +
              liquid-glass, same as the back chevron/"⋯", on every page
              regardless of scroll position. */}
          <button
            type="button"
            aria-label="What this means"
            aria-expanded={infoOpen}
            onClick={() => setInfoOpen(o => !o)}
            style={{
              position: 'fixed',
              right: 8,
              top: `calc(env(safe-area-inset-top) + ${(TEACHER_TOPBAR_HEIGHT - 32) / 2}px)`,
              zIndex: 45,
              width: 32, height: 32, borderRadius: '50%',
              boxSizing: 'border-box' as const,
              border: '1px solid rgba(255,255,255,0.32)',
              background: 'rgba(255,255,255,0.22)',
              backdropFilter: 'blur(22px) saturate(180%)',
              WebkitBackdropFilter: 'blur(22px) saturate(180%)',
              boxShadow: '0 2px 10px rgba(15,23,42,0.12)',
              transition: 'background 180ms ease, box-shadow 180ms ease, border-color 180ms ease, color 160ms ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 17,
              padding: 0,
              outline: 'none',
              pointerEvents: 'auto',
              color: infoOpen ? '#475569' : '#94a3b8',
              WebkitAppearance: 'none' as const,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <FontAwesomeIcon icon={faCircleExclamation} />
          </button>

          {infoOpen && createPortal(
            <>
              {/* Dimmed backdrop — tap to dismiss. Portaled to <body> so
                  it escapes the header's stacking context and sits above
                  the floating bottom nav (zIndex 50). */}
              <div
                onClick={() => setInfoOpen(false)}
                style={{
                  position: 'fixed', inset: 0, zIndex: 1000,
                  background: 'rgba(15,23,42,0.35)',
                  animation: 'tinfo-fade 180ms ease-out',
                }}
              />
              {/* Bottom sheet — slides up. Rounded top, respects iOS
                  home indicator. Same portal target so it also clears the
                  nav stacking context. */}
              <div
                role="dialog"
                aria-label="What this means"
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'fixed', left: 0, right: 0, bottom: 0,
                  zIndex: 1001,
                  background: '#ffffff',
                  borderTopLeftRadius: 22, borderTopRightRadius: 22,
                  boxShadow: '0 -10px 30px rgba(15,23,42,0.18)',
                  paddingTop: 10,
                  paddingLeft: 18, paddingRight: 18,
                  paddingBottom: 'calc(22px + env(safe-area-inset-bottom))',
                  fontFamily: FONT,
                  animation: 'tinfo-slide 240ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <div style={{
                  width: 40, height: 4, borderRadius: 999, background: '#e2e8f0',
                  margin: '0 auto 14px',
                }} />
                <div style={{
                  fontSize: 13.5, fontWeight: 800, color: '#334155',
                  marginBottom: 14, letterSpacing: '-0.005em',
                }}>
                  About this page
                </div>

                {/* Caveats — honest reminders. The mission itself
                    lives on the page; this sheet is "good to know"
                    plus the levers. */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {info.caveats.map((line, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <FontAwesomeIcon
                        icon={faCircleInfo}
                        style={{ fontSize: 13, color: '#94a3b8', flexShrink: 0, marginTop: 3 }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#475569', lineHeight: 1.55 }}>
                        {line}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Levers, at the end. The chips name the concrete
                    actions behind the mission; small uppercase caption
                    keeps them clearly tied to "how". */}
                <div style={{
                  marginTop: 16, paddingTop: 14,
                  borderTop: '1px solid #eceef2',
                }}>
                  <div style={{
                    fontSize: 10.5, fontWeight: 800, color: '#64748b',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    marginBottom: 10,
                  }}>
                    How to grow the pool
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {info.levers.map(c => (
                      <span key={c} style={{
                        fontSize: 11.5, fontWeight: 700, color: '#475569',
                        background: '#ffffff', border: '1px solid #eceef2',
                        borderRadius: 999, padding: '5px 11px',
                      }}>
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <style>{`
                @keyframes tinfo-slide {
                  from { transform: translateY(100%); }
                  to   { transform: translateY(0); }
                }
                @keyframes tinfo-fade {
                  from { opacity: 0; }
                  to   { opacity: 1; }
                }
              `}</style>
            </>,
            document.body,
          )}
        </>
      )}
      {/* Account menu — small anchored dropdown under the "⋯", same shape
          as SopLibraryPage's own teacher "⋯" menu (Guides tab) rather
          than a full-height side drawer: a drawer read as a completely
          different pattern from the one already shown on Guides, and
          with most teachers holding zero admin module grants it was
          usually just a single "Logout" row floating in a wall of empty
          space. Entry points into the wider admin app (ADMIN_MENU_LINKS)
          still show first when the account actually has module grants.
          Portaled to <body> so it isn't clipped to the header's bounds;
          fixed-positioned at the same right:8 edge as the trigger, just
          below it. */}
      {menuOpen && createPortal(
        <div
          ref={menuDropdownRef}
          style={{
            position: 'fixed',
            top: `calc(env(safe-area-inset-top) + ${(TEACHER_TOPBAR_HEIGHT - 32) / 2 + 32 + 6}px)`,
            right: 8,
            width: 200,
            background: '#fff',
            border: '1px solid #eceef2',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(15,23,42,0.14)',
            zIndex: 91,
            overflow: 'hidden',
            padding: 4,
            fontFamily: FONT,
          }}
        >
          {visibleAdminLinks.map(l => (
            <NavLink key={l.to} to={l.to} onClick={() => setMenuOpen(false)} style={{
              display: 'flex', alignItems: 'center', width: '100%', padding: '8px 10px',
              borderRadius: 7, color: '#334155', textDecoration: 'none',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            }}>
              <FontAwesomeIcon icon={l.icon} style={{ width: 14, marginRight: 8, color: '#7c3aed' }} />
              {l.label}
            </NavLink>
          ))}
          {visibleAdminLinks.length > 0 && (
            <div style={{ height: 1, background: '#eceef2', margin: '4px 0' }} />
          )}
          {/* Profile + Logout live on TeacherMySettingsPage now, not
              inline here — this is just the entry point to it. */}
          {settingsPath && (
            <NavLink to={settingsPath} onClick={() => setMenuOpen(false)} style={{
              display: 'flex', alignItems: 'center', width: '100%', padding: '8px 10px',
              borderRadius: 7, color: '#334155', textDecoration: 'none',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            }}>
              <FontAwesomeIcon icon={faGear} style={{ width: 14, marginRight: 8, color: '#7c3aed' }} />
              Settings
            </NavLink>
          )}
        </div>,
        document.body,
      )}
      </header>
    </>
  );
}
