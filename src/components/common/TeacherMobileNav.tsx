import { useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHouse, faStar, faSackDollar, faBookOpen,
} from '@fortawesome/free-solid-svg-icons';
import { useIsMobile } from '../../hooks/useIsMobile.js';

// ─────────────────────────────────────────────────────────────────────────────
// Teacher mobile bottom nav — the app tab bar for the gamified
// teacher experience. Renders on mobile across the whole teacher app
// (hubs AND their spokes — e.g. Grow My Pay, Pay Breakdown, Rewards
// history), with the active tab derived from the section. The only
// exceptions are the two redeem flows that own a sticky bottom action
// bar (reward detail / my-reward detail) — stacking a tab bar under a
// "Redeem"/"Done" bar would be two competing bottom bars, so those
// stay full-screen with just their back chevron.
//
// It is `position: fixed` to the visual viewport bottom (with iOS
// safe-area inset) so it stays put regardless of the page's own
// height/scroll. ProtectedLayout reserves an equal strip of padding
// at the bottom of the scroll area whenever the bar is shown, so page
// content is never hidden underneath it.
// ─────────────────────────────────────────────────────────────────────────────

const FONT =
  '"Segoe UI", Roboto, Arial, sans-serif';

const ACCENT = '#7c3aed';
const MUTED = '#94a3b8';

// Floating glass capsule: bar height + the 12px gap it sits above the
// screen bottom + 12px breathing room + the iOS home-indicator safe
// area. Exported so the shell reserves exactly this much space below
// the page content so nothing hides under the floating bar.
export const TEACHER_NAV_HEIGHT = 60;
export const TEACHER_NAV_SPACE = `calc(${TEACHER_NAV_HEIGHT}px + 24px + env(safe-area-inset-bottom))`;

// Any teacher gamified surface: /teachers/:id/<section>[/...spoke].
// `my-career` also covers its nested `journey`/`skill-badges` spokes.
const TEACHER_PATH = /^\/teachers\/([^/]+)\/(home|my-career|my-compensation|rewards|leaderboard|career\/missions)(?:\/|$)/;

// Guides (How-To Guide library) — a shared admin/HR page outside
// /teachers/:id, so it carries no teacherId in its URL. Only counts as
// a teacher-app surface when tagged ?app=teacher (see App.tsx's
// isTeacherSurface); the plain admin entry point is untouched.
const TEACHER_SOP_PATH = /^\/operations\/sops(?:\/|$)/;

// Focused redeem flows that own a sticky bottom action bar — the nav
// is suppressed here so there's never a tab bar stacked under a
// "Redeem"/"Done" bar. Reward detail (catalog/:rewardId) and the
// my-reward detail (rewards/my/:redemptionId).
const STICKY_CTA = /^\/teachers\/[^/]+\/rewards\/(catalog\/[^/]+|my\/[^/]+)\/?$/;

// Guides has no teacherId in its own URL — read the logged-in
// teacher's id from the same place LoginPage stashes it at sign-in, so
// the bar's other three tabs (Home/Career/Pay) still know where to go.
function currentTeacherId(): string | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return (JSON.parse(raw) as { teacherId?: string | null }).teacherId ?? null;
  } catch {
    return null;
  }
}

/**
 * For a teacher gamified path, which bottom tab is active. Returns
 * { teacherId, activeSeg } or null when the nav should not show
 * (non-teacher route, a sticky-CTA redeem flow, or Guides reached
 * outside the teacher app).
 */
export function teacherNavMatch(
  pathname: string,
  search: string = '',
): { teacherId: string; activeSeg: string } | null {
  if (STICKY_CTA.test(pathname)) return null;
  if (TEACHER_SOP_PATH.test(pathname)) {
    if (new URLSearchParams(search).get('app') !== 'teacher') return null;
    const teacherId = currentTeacherId();
    return teacherId ? { teacherId, activeSeg: 'sop' } : null;
  }
  const m = pathname.match(TEACHER_PATH);
  if (!m) return null;
  const [, teacherId, section] = m;
  const activeSeg =
    section === 'leaderboard' ? 'leaderboard'
    : section === 'home' ? 'home'
    : section === 'my-compensation' ? 'my-compensation'
    : section === 'rewards' ? 'rewards'
    // my-career (+ its nested journey/skill-badges spokes) and
    // career/missions all belong to Career.
    : 'my-career';
  return { teacherId, activeSeg };
}

// Rewards and Leaderboard are built and working (see TeacherRewardsPage,
// TeacherLeaderboardPage) but deliberately held back from the primary
// tab bar for now — deferred to a future rollout. Their routes and every
// existing deep link into them (e.g. the points chip on the Pay hero,
// Home's preview cards) stay fully functional; they're just not one of
// the four tabs a teacher lands on by default.
//
// Guides links into the shared admin SOP Library (/operations/sops),
// tagged ?app=teacher so that page keeps showing this same floating
// bar + bottom nav instead of switching to the admin Navbar — see
// TeacherTopBar.tsx's teacherSopTopBar and App.tsx's isTeacherSurface.
const TABS = [
  { seg: 'home',            label: 'Home',   icon: faHouse },
  { seg: 'my-career',       label: 'Career', icon: faStar },
  { seg: 'my-compensation', label: 'Pay',    icon: faSackDollar },
  { seg: 'sop',             label: 'Guides', icon: faBookOpen, href: '/operations/sops?app=teacher' },
] as const;

export default function TeacherMobileNav() {
  const { isMobile } = useIsMobile();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  const match = teacherNavMatch(pathname, search);
  if (!isMobile || !match) return null;

  const { teacherId, activeSeg } = match;

  return (
    <nav
      aria-label="Teacher navigation"
      style={{
        // Floating "liquid glass" capsule — detached from the screen
        // edges, frosted translucent, sitting above the home indicator.
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 'calc(env(safe-area-inset-bottom) + 12px)',
        zIndex: 50,
        height: TEACHER_NAV_HEIGHT,
        padding: 6,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'stretch',
        borderRadius: 28,
        background: 'rgba(255,255,255,0.60)',
        backdropFilter: 'blur(22px) saturate(180%)',
        WebkitBackdropFilter: 'blur(22px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.55)',
        boxShadow: '0 10px 30px rgba(15,23,42,0.16), 0 2px 6px rgba(15,23,42,0.06)',
        fontFamily: FONT,
      }}
    >
      <style>{`
        .tnav-tab {
          transition: transform 150ms cubic-bezier(0.4,0,0.2,1),
                      background 200ms ease, color 200ms ease;
          -webkit-tap-highlight-color: transparent;
        }
        /* Tactile press — the whole tab dips in. */
        .tnav-tab:active { transform: scale(0.86); }
        .tnav-ico {
          display: inline-flex;
          transition: transform 200ms cubic-bezier(0.34,1.56,0.64,1);
        }
        /* Springy pop when a tab becomes the active one. */
        .tnav-tab--active .tnav-ico { animation: tnav-pop 360ms cubic-bezier(0.34,1.56,0.64,1); }
        @keyframes tnav-pop {
          0%   { transform: scale(0.7) translateY(1px); }
          55%  { transform: scale(1.22) translateY(-1px); }
          100% { transform: scale(1) translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .tnav-tab, .tnav-ico { transition: none; }
          .tnav-tab--active .tnav-ico { animation: none; }
        }
      `}</style>
      {TABS.map(t => {
        const active = t.seg === activeSeg;
        return (
          <button
            key={t.seg}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => navigate('href' in t ? t.href : `/teachers/${teacherId}/${t.seg}`)}
            className={`tnav-tab${active ? ' tnav-tab--active' : ''}`}
            style={{
              flex: 1,
              // minWidth:0 stops a long label (e.g. "Leaderboard")
              // from forcing its tab wider than an equal fifth.
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              border: 'none',
              borderRadius: 20,
              // Active tab gets a soft violet glass capsule, iOS-style.
              background: active ? 'rgba(124,58,237,0.13)' : 'transparent',
              cursor: 'pointer',
              color: active ? ACCENT : MUTED,
              fontFamily: 'inherit',
            }}
          >
            <span className="tnav-ico">
              <FontAwesomeIcon icon={t.icon} style={{ fontSize: 18 }} />
            </span>
            {/* Constant weight — an active 700→800 bump widens long
                labels and resizes the tabs. Active is already carried
                by colour, the violet capsule, and the icon pop. */}
            <span style={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: '0.01em',
              whiteSpace: 'nowrap',
            }}>
              {t.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
