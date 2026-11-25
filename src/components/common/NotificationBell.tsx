import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faBell, faCheckDouble, faChevronLeft, faGear } from '@fortawesome/free-solid-svg-icons';
import { fetchNotificationSettings, fetchNotifications, markAllNotificationsRead, markNotificationRead, type AppNotification } from '../../api/notifications.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { badgeText, isAppLink } from './notificationDisplay.js';
import NotificationList from './NotificationList.js';
import type { NotificationGroup } from './notificationGroups.js';

// The bell in the top bar: important things that need someone to act (a new
// lead, a job application, staff waiting for approval, an incident). Clicking
// one marks it read and opens the place to deal with it. Grouped like
// Facebook (NotificationList); on a phone the list fills the screen.

/** How often the bell checks for new notifications while the app is open. */
const POLL_MS = 60_000;
const QUERY_KEY = ['notifications'];

/** Where the gear goes: admins → Settings; staff → their teacher-app page; anyone else → the plain page. */
function notificationSettingsPath(): string {
  try {
    const u = JSON.parse(localStorage.getItem('user') ?? 'null') as { role?: string; teacherId?: string | null } | null;
    if (u?.role === 'ADMIN' || u?.role === 'SUPERADMIN') return '/settings/notifications';
    if (u?.teacherId) return `/teachers/${encodeURIComponent(u.teacherId)}/settings/notifications`;
  } catch { /* fall through */ }
  return '/notifications/settings';
}

/** `teacher`: the frosted round button of the teacher app's top bar (next to its ⋯). */
export default function NotificationBell({ variant = 'navbar' }: { variant?: 'navbar' | 'teacher' } = {}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isMobile } = useIsMobile();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Which notifications this person's roles give them — none means no bell at all.
  const { data: settings } = useQuery({ queryKey: ['notification-settings'], queryFn: fetchNotificationSettings, staleTime: 5 * 60_000 });
  const hasAny = (settings?.events.length ?? 0) > 0;
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: QUERY_KEY, queryFn: fetchNotifications, refetchInterval: POLL_MS, enabled: hasAny });
  const settingsPath = notificationSettingsPath();
  const teacherLook = variant === 'teacher';
  const unread = data?.unread ?? 0;
  const badge = badgeText(unread);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !panelRef.current?.contains(t)) dismissRef.current();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismissRef.current(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  // Phone: the list fills the screen — the page behind it doesn't scroll.
  useEffect(() => {
    if (!open || !isMobile) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = before; };
  }, [open, isMobile]);
  // Phone: the back button (or back swipe) closes the list instead of leaving the page —
  // opening it adds a history step (same address) that "back" removes.
  useEffect(() => {
    if (!open || !isMobile) return;
    window.history.pushState(window.history.state, '');
    const onPop = () => dismissRef.current();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [open, isMobile]);
  /** The ← on a phone: same as the phone's back button. */
  const goBack = () => window.history.back();

  const openOne = async (n: AppNotification) => {
    setOpen(false);
    if (!n.readAt) {
      markNotificationRead(n.id).finally(() => qc.invalidateQueries({ queryKey: QUERY_KEY }));
    }
    if (isAppLink(n.link)) navigate(n.link);
  };
  const openGroup = (g: NotificationGroup) => {
    setOpen(false);
    const unreadIds = g.items.filter(n => !n.readAt).map(n => n.id);
    if (unreadIds.length) void Promise.all(unreadIds.map(markNotificationRead)).finally(() => qc.invalidateQueries({ queryKey: QUERY_KEY }));
    if (g.link && isAppLink(g.link)) navigate(g.link);
  };
  /**
   * Closing the list without opening anything (← back, the phone's back button, a tap
   * outside, Escape, the bell again) counts as having seen them all — like Facebook
   * clearing the badge — so everything is marked read. Opening one marks only that one.
   */
  const dismiss = () => {
    setOpen(false);
    if (unread > 0) void readAll();
  };
  // The listeners above are set up once per opening; they call the latest dismiss through this.
  const dismissRef = useRef(dismiss);
  useEffect(() => { dismissRef.current = dismiss; });
  const readAll = async () => {
    // Shown as read straight away; the server catches up.
    qc.setQueryData<{ items: AppNotification[]; unread: number }>(QUERY_KEY, d => d && ({
      unread: 0, items: d.items.map(n => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
    }));
    await markAllNotificationsRead();
    qc.invalidateQueries({ queryKey: QUERY_KEY });
  };

  if (!hasAny) return null;
  const portal = (panel: React.ReactElement) => (isMobile ? createPortal(panel, document.body) : panel);

  // Phone: full screen over everything (drawn at the page's top level, so the top
  // bar and bottom tabs can't cover it), like Facebook's app. Desktop: a panel under the bell.
  const panelPosition: React.CSSProperties = isMobile
    ? { position: 'fixed', inset: 0, borderRadius: 0, border: 'none', display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top)' }
    : { position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 380 };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => (open ? dismiss() : setOpen(true))} aria-expanded={open} aria-haspopup="dialog"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} title="Notifications" style={teacherLook ? s.hitTeacher : s.bellBtn}>
        {teacherLook ? (
          <span style={s.bellBtnTeacher}>
            <FontAwesomeIcon icon={faBell} />
            {badge && <span style={{ ...s.badge, borderColor: '#fff' }} aria-hidden>{badge}</span>}
          </span>
        ) : (
          <>
            <FontAwesomeIcon icon={faBell} />
            {badge && <span style={s.badge} aria-hidden>{badge}</span>}
          </>
        )}
      </button>

      {open && (
        portal(<div ref={panelRef} role="dialog" aria-modal={isMobile || undefined} aria-label="Notifications" style={{ ...s.panel, ...panelPosition }}>
          <style>{'.notif-row:hover { background: #f1f5f9 !important; } .notif-row:focus-visible { outline: 2px solid #4f5bd5; outline-offset: -2px; }'}</style>
          {isMobile ? (
            <PhoneHeader unread={unread} onBack={goBack} onReadAll={() => void readAll()}
              onSettings={() => { setOpen(false); navigate(settingsPath); }} />
          ) : (
            <div style={s.header}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Notifications</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button type="button" onClick={readAll} disabled={unread === 0}
                  style={{ ...s.linkBtn, opacity: unread === 0 ? 0.45 : 1, cursor: unread === 0 ? 'default' : 'pointer' }}>
                  Mark all as read
                </button>
                <button type="button" onClick={() => { setOpen(false); navigate(settingsPath); }}
                  aria-label="Notification settings" title="Notification settings"
                  style={{ ...s.linkBtn, width: 28, height: 28, color: '#64748b', cursor: 'pointer' }}>
                  <FontAwesomeIcon icon={faGear} />
                </button>
              </span>
            </div>
          )}
          <div style={isMobile ? { flex: 1, overflowY: 'auto', paddingBottom: 'env(safe-area-inset-bottom)' } : { maxHeight: 420, overflowY: 'auto' }}>
            {isLoading && <p style={s.state}>Loading…</p>}
            {isError && (
              <div style={s.state}>
                Couldn’t load notifications.{' '}
                <button type="button" onClick={() => refetch()} style={s.linkBtn}>Retry</button>
              </div>
            )}
            {data && data.items.length === 0 && (
              <div style={{ ...s.state, padding: '32px 16px' }}>
                <FontAwesomeIcon icon={faBell} style={{ fontSize: 20, color: '#cbd5e1', marginBottom: 8 }} />
                <div>You’re all caught up.</div>
              </div>
            )}
            {data && <NotificationList items={data.items} large={isMobile} onOpen={n => void openOne(n)} onOpenGroup={openGroup} />}
          </div>
        </div>)
      )}
    </div>
  );
}

/**
 * Phone: like the teacher app's other screens — liquid-glass round buttons on
 * top (back; mark all read; settings), then the page title in the big
 * left-aligned "magazine" style.
 */
function PhoneHeader({ unread, onBack, onReadAll, onSettings }: {
  unread: number; onBack: () => void; onReadAll: () => void; onSettings: () => void;
}) {
  return (
    <div style={{ padding: '4px 4px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <GlassButton icon={faChevronLeft} label="Back" onClick={onBack} />
        <span style={{ display: 'flex' }}>
          <GlassButton icon={faCheckDouble} label={unread ? 'Mark all as read' : 'All read'} onClick={onReadAll} disabled={unread === 0} />
          <GlassButton icon={faGear} label="Notification settings" onClick={onSettings} />
        </span>
      </div>
      <h1 style={{ margin: '8px 12px 4px', fontSize: 30, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>Notifications</h1>
    </div>
  );
}

/** A 44 px tap area around the teacher app's 32 px liquid-glass circle (same as its top bar). */
function GlassButton({ icon, label, onClick, disabled }: { icon: IconDefinition; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
      style={{ ...s.hitTeacher, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1 }}>
      <span style={{ ...s.bellBtnTeacher, fontSize: 14 }}><FontAwesomeIcon icon={icon} /></span>
    </button>
  );
}

const s: Record<string, React.CSSProperties> = {
  bellBtn: {
    position: 'relative', width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
    background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.28)',
    color: '#fff', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  // Teacher app: a 44 px tap area around the same 32 px frosted circle as the top bar's ⋯ button.
  hitTeacher: {
    width: 44, height: 44, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent',
  },
  bellBtnTeacher: {
    position: 'relative', width: 32, height: 32, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
    border: '1px solid rgba(255,255,255,0.32)', background: 'rgba(255,255,255,0.22)',
    backdropFilter: 'blur(22px) saturate(180%)', WebkitBackdropFilter: 'blur(22px) saturate(180%)',
    boxShadow: '0 2px 10px rgba(15,23,42,0.12)', color: '#334155', fontSize: 15,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, padding: '0 5px', boxSizing: 'border-box',
    borderRadius: 999, background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: '18px',
    textAlign: 'center', border: '2px solid #5a67d8',
  },
  panel: {
    zIndex: 1200, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden',
    boxShadow: '0 12px 32px rgba(15,23,42,0.16)', color: '#0f172a', textAlign: 'left',
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #eef0f4' },
  linkBtn: { border: 'none', background: 'none', padding: 0, color: '#4f5bd5', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' },
  state: { margin: 0, padding: 16, fontSize: 13, color: '#64748b', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' },
};
