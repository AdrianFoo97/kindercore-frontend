import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBell, faBookOpen, faBug, faBullhorn, faCartShopping, faChevronDown, faChevronUp, faClipboardCheck, faFileLines, faListCheck, faScrewdriverWrench,
  faTriangleExclamation, faUserPlus, faChild, faUserMinus, faReceipt, faChartLine, faBagShopping, faFlag, faStar, faGift, faFileSignature,
} from '@fortawesome/free-solid-svg-icons';
import type { AppNotification } from '../../api/notifications.js';
import { timeAgo } from './notificationDisplay.js';
import { groupSummary, notificationSections, type NotificationGroup } from './notificationGroups.js';

// The bell's list, grouped like Facebook: "New" (unread) and "Earlier", with
// everything of one kind in one row. A group that shares a page opens it; one
// that doesn't (e.g. several students) expands to pick one. `large` = the
// phone's full-screen look (bigger icons and text, like Facebook's app).

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
const ACCENT = '#4f5bd5';
const UNREAD_BG = '#eef3ff';
const DIVIDER = '#e8ebf0';
/** Row padding and the gap beside the icon on the phone. */
const LARGE_PAD = 16;
const LARGE_GAP = 12;

interface Props {
  items: AppNotification[];
  large: boolean;
  /** Open one notification (marks it read). */
  onOpen: (n: AppNotification) => void;
  /** Open a group's shared page, marking every one in it read. */
  onOpenGroup: (g: NotificationGroup) => void;
}

export default function NotificationList({ items, large, onOpen, onOpenGroup }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <>
      {notificationSections(items).map(section => (
        <section key={section.title} aria-label={section.title}>
          <h3 style={{ margin: 0, padding: large ? '16px 16px 8px' : '12px 16px 6px', fontSize: large ? 17 : 13, fontWeight: 700, color: '#0f172a' }}>
            {section.title}
          </h3>
          {section.groups.map(g => {
            if (g.items.length === 1) return <Row key={g.key} n={g.items[0]} large={large} onClick={() => onOpen(g.items[0])} />;
            const open = expanded === g.key;
            return (
              <div key={g.key}>
                <GroupRow g={g} large={large} open={open}
                  onClick={() => (g.link ? onOpenGroup(g) : setExpanded(open ? null : g.key))} />
                {open && g.items.map(n => <Row key={n.id} n={n} large={large} indent onClick={() => onOpen(n)} />)}
              </div>
            );
          })}
        </section>
      ))}
    </>
  );
}

function GroupRow({ g, large, open, onClick }: { g: NotificationGroup; large: boolean; open: boolean; onClick: () => void }) {
  const { title, detail } = groupSummary(g);
  const expandable = !g.link;
  return (
    <RowShell kind={g.kind} unread={g.unread} large={large} onClick={onClick} ariaExpanded={expandable ? open : undefined}
      label={`${title}${detail ? `: ${detail}` : ''}`} stack={g.items.length}>
      <Lines title={title} body={detail} time={g.items[0].createdAt} unread={g.unread} large={large}
        extra={expandable && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 8, color: ACCENT, fontWeight: 600 }}>
            {open ? 'Hide' : 'Show all'} <FontAwesomeIcon icon={open ? faChevronUp : faChevronDown} style={{ fontSize: 10 }} />
          </span>
        )} />
    </RowShell>
  );
}

function Row({ n, large, indent, onClick }: { n: AppNotification; large: boolean; indent?: boolean; onClick: () => void }) {
  return (
    <RowShell kind={n.kind} unread={!n.readAt} large={large} indent={indent} onClick={onClick} label={n.title}>
      <Lines title={n.title} body={n.body} time={n.createdAt} unread={!n.readAt} large={large} />
    </RowShell>
  );
}

function RowShell({ kind, unread, large, indent, onClick, label, ariaExpanded, stack, children }: {
  kind: string; unread: boolean; large: boolean; indent?: boolean; onClick: () => void; label: string;
  ariaExpanded?: boolean; stack?: number; children: React.ReactNode;
}) {
  const look = KIND_LOOK[kind] ?? DEFAULT_LOOK;
  const size = large ? (indent ? 44 : 56) : (indent ? 26 : 32);
  return (
    <button type="button" onClick={onClick} className="notif-row" aria-label={label} aria-expanded={ariaExpanded}
      style={{
        position: 'relative', display: 'flex', alignItems: large ? 'center' : 'flex-start', gap: LARGE_GAP, width: '100%',
        padding: large ? `12px ${LARGE_PAD}px 12px ${indent ? 40 : LARGE_PAD}px` : `12px 16px 12px ${indent ? 32 : 16}px`,
        border: 'none', borderBottom: large ? 'none' : '1px solid #f1f5f9', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
        background: unread ? (large ? UNREAD_BG : '#f8faff') : '#fff',
      }}>
      <span style={{ position: 'relative', flexShrink: 0 }}>
        <span style={{
          width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: look.color, background: look.bg, fontSize: Math.round(size * 0.4),
        }}><FontAwesomeIcon icon={look.icon} /></span>
        {!!stack && stack > 1 && (
          <span aria-hidden style={{
            position: 'absolute', right: -4, bottom: -4, minWidth: large ? 22 : 18, height: large ? 22 : 18, padding: '0 5px', boxSizing: 'border-box',
            borderRadius: 999, background: look.color, color: '#fff', border: '2px solid #fff',
            fontSize: large ? 11 : 10, fontWeight: 800, lineHeight: large ? '18px' : '14px', textAlign: 'center',
          }}>{stack}</span>
        )}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
      {/* Phone: a hairline between rows, across the whole row (icon included). */}
      {large && <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, background: DIVIDER }} />}
      {unread && <span aria-hidden style={{ width: large ? 12 : 8, height: large ? 12 : 8, borderRadius: '50%', background: ACCENT, flexShrink: 0, marginTop: large ? 0 : 6 }} />}
    </button>
  );
}

function Lines({ title, body, time, unread, large, extra }: {
  title: string; body: string | null; time: string; unread: boolean; large: boolean; extra?: React.ReactNode;
}) {
  return (
    <>
      <span style={{ display: 'block', fontSize: large ? 15 : 13, fontWeight: unread ? 700 : 500, color: '#0f172a', lineHeight: 1.35 }}>{title}</span>
      {body && <span style={{ display: 'block', fontSize: large ? 14 : 12, color: '#475569', lineHeight: 1.4, marginTop: 2 }}>{body}</span>}
      <span style={{ display: 'block', fontSize: large ? 13 : 12, marginTop: 4, color: unread ? ACCENT : '#64748b', fontWeight: unread ? 700 : 400 }}>
        {timeAgo(time)}{extra}
      </span>
    </>
  );
}
