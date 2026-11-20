import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBell, faBookOpen, faBug, faBullhorn, faCartShopping, faClipboardCheck, faFileLines, faGear, faListCheck, faScrewdriverWrench,
  faTriangleExclamation, faUserPlus, faChild, faUserMinus, faReceipt, faChartLine, faBagShopping, faFlag, faStar, faGift, faFileSignature,
} from '@fortawesome/free-solid-svg-icons';
import { fetchNotificationSettings, fetchNotifications, markAllNotificationsRead, markNotificationRead, type AppNotification } from '../../api/notifications.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { badgeText, isAppLink, timeAgo } from './notificationDisplay.js';

// The bell in the top bar: important things that need someone to act (a new
// lead, a job application, staff waiting for approval, an incident). Clicking
// one marks it read and opens the place to deal with it.

/** How often the bell checks for new notifications while the app is open. */
const POLL_MS = 60_000;
const QUERY_KEY = ['notifications'];

const KIND_LOOK: Record<string, { icon: IconDefinition; color: string; bg: string }> = {
  NEW_LEAD: { icon: faBullhorn, color: '#4f5bd5', bg: '#eef2ff' },
  NEW_STUDENT: { icon: faChild, color: '#4f5bd5', bg: '#eef2ff' },
  STUDENT_WITHDRAWN: { icon: faUserMinus, color: '#475569', bg: '#f1f5f9' },
  ITEM_BOUGHT: { icon: faReceipt, color: '#0f766e', bg: '#f0fdfa' },
  COSTS_RECORDED: { icon: faChartLine, color: '#4f5bd5', bg: '#eef2ff' },
  NEW_APPLICATION: { icon: faFileLines, color: '#0f766e', bg: '#f0fdfa' },
  NEW_STAFF_JOIN: { icon: faUserPlus, color: '#7c3aed', bg: '#f5f3ff' },
  INCIDENT_REPORTED: { icon: faTriangleExclamation, color: '#b45309', bg: '#fffbeb' },
  APPRAISAL_SIGN_OFF: { icon: faClipboardCheck, color: '#7c3aed', bg: '#f5f3ff' },
  ONBOARDING_SELF_DONE: { icon: faListCheck, color: '#7c3aed', bg: '#f5f3ff' },
  FACILITY_REPORTED: { icon: faScrewdriverWrench, color: '#b45309', bg: '#fffbeb' },
  ITEM_REQUESTED: { icon: faCartShopping, color: '#0f766e', bg: '#f0fdfa' },
  GUIDE_SUGGESTED: { icon: faBookOpen, color: '#4f5bd5', bg: '#eef2ff' },
  BUG_REPORTED: { icon: faBug, color: '#b91c1c', bg: '#fef2f2' },
  MY_REQUEST_UPDATE: { icon: faBagShopping, color: '#0f766e', bg: '#f0fdfa' },
  MY_REPORT_UPDATE: { icon: faFlag, color: '#b45309', bg: '#fffbeb' },
  MY_APPRAISAL_READY: { icon: faFileSignature, color: '#7c3aed', bg: '#f5f3ff' },
  MY_POINTS: { icon: faStar, color: '#a16207', bg: '#fefce8' },
  MY_REWARD_DELIVERED: { icon: faGift, color: '#7c3aed', bg: '#f5f3ff' },
};
const DEFAULT_LOOK = { icon: faBell, color: '#475569', bg: '#f1f5f9' };

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
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const openOne = async (n: AppNotification) => {
    setOpen(false);
    if (!n.readAt) {
      markNotificationRead(n.id).finally(() => qc.invalidateQueries({ queryKey: QUERY_KEY }));
    }
    if (isAppLink(n.link)) navigate(n.link);
  };
  const readAll = async () => {
    await markAllNotificationsRead();
    qc.invalidateQueries({ queryKey: QUERY_KEY });
  };

  if (!hasAny) return null;

  const panelPosition: React.CSSProperties = isMobile
    ? { position: 'fixed', top: 64, left: 16, right: 16 }
    : { position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 380 };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="dialog"
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
        <div role="dialog" aria-label="Notifications" style={{ ...s.panel, ...panelPosition }}>
          <style>{'.notif-row:hover { background: #f1f5f9 !important; } .notif-row:focus-visible { outline: 2px solid #4f5bd5; outline-offset: -2px; }'}</style>
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
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
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
            {data?.items.map(n => <NotificationRow key={n.id} n={n} onOpen={() => openOne(n)} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationRow({ n, onOpen }: { n: AppNotification; onOpen: () => void }) {
  const look = KIND_LOOK[n.kind] ?? DEFAULT_LOOK;
  const unread = !n.readAt;
  return (
    <button type="button" onClick={onOpen} className="notif-row" style={{ ...s.row, background: unread ? '#f8faff' : '#fff' }}>
      <span style={{ ...s.icon, color: look.color, background: look.bg }}><FontAwesomeIcon icon={look.icon} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: unread ? 700 : 500, color: '#0f172a', lineHeight: 1.4 }}>{n.title}</span>
        {n.body && <span style={{ display: 'block', fontSize: 12, color: '#64748b', lineHeight: 1.4, marginTop: 2 }}>{n.body}</span>}
        <span style={{ display: 'block', fontSize: 12, color: '#64748b', marginTop: 4 }}>{timeAgo(n.createdAt)}</span>
      </span>
      {unread && <span style={s.dot} aria-label="Unread" />}
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
  row: {
    display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%', padding: '12px 16px', border: 'none',
    borderBottom: '1px solid #f1f5f9', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
  },
  icon: { width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 },
  dot: { width: 8, height: 8, borderRadius: '50%', background: '#4f5bd5', flexShrink: 0, marginTop: 6 },
};
