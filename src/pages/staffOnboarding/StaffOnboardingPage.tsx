import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faGear, faListCheck, faTriangleExclamation, faUser, faUserCheck } from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { fetchSettings } from '../../api/settings.js';
import {
  completeStaffOnboarding, fetchStaffOnboarding, STAFF_ONBOARDING_SETTING, type StaffOnboardingEntry,
} from '../../api/staffOnboarding.js';
import ConfirmDialog from '../../components/common/ConfirmDialog.js';
import { ActionMenu } from '../../components/onboarding/ActionMenu.js';
import { ProgressBar } from '../../components/onboarding/ProgressBar.js';
import { UpNextTask } from '../../components/onboarding/UpNextTask.js';
import { getAvatarColor, getInitials } from '../../components/onboarding/avatar.js';
import { chipCount, chipStyle, filterLabel, filterRow, toolbarCard } from '../../components/onboarding/filterStyles.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { whatsappSendUrl } from '../../utils/whatsapp.js';
import { StaffChecklistModal, type StaffList } from './StaffChecklistModal.js';
import { checklistFor, checklistProgress, onboardingStage, type OnboardingStage } from './progress.js';

// HR → Onboarding — the staff version of Students → Onboarding, same look.
// Each new joiner has two checklists: HR's (ticked here) and their own
// (ticked in their app — HR can tick it for them from the ⋯ menu). HR can
// mark onboarding complete only once BOTH are done. Everyone added through
// Recruitment → Hire, New Staff → Approve or Add Staff lands here.

const QUERY_KEY = ['staff-onboarding'];
const SUCCESS_BANNER_MS = 5000;
const DAY_MS = 24 * 60 * 60 * 1000;

const FILTERS: { key: OnboardingStage | null; label: string; color: string; bg: string }[] = [
  { key: null, label: 'All', color: '#334155', bg: '#f1f5f9' },
  { key: 'notStarted', label: 'Not Started', color: '#6d28d9', bg: '#f5f3ff' },
  { key: 'inProgress', label: 'In Progress', color: '#b45309', bg: '#fffbeb' },
  { key: 'ready', label: 'Ready to Complete', color: '#047857', bg: '#ecfdf5' },
];

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function joinedAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return 'joined today';
  if (days === 1) return 'joined yesterday';
  return `joined ${days} days ago`;
}

export default function StaffOnboardingPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isMobile } = useIsMobile();
  const { data: entries = [], isPending, isError } = useQuery({ queryKey: QUERY_KEY, queryFn: fetchStaffOnboarding });
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  const hrTemplate: string[] = Array.isArray(settings?.[STAFF_ONBOARDING_SETTING]) ? settings[STAFF_ONBOARDING_SETTING] as string[] : [];

  const [filter, setFilter] = useState<OnboardingStage | null>(null);
  const [openList, setOpenList] = useState<{ entry: StaffOnboardingEntry; list: StaffList } | null>(null);
  const [completeAllFor, setCompleteAllFor] = useState<StaffOnboardingEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const stageOf = (e: StaffOnboardingEntry) => onboardingStage(e.onboardingProgress, e.selfOnboardingProgress);
  const shown = filter ? entries.filter(e => stageOf(e) === filter) : entries;
  const countOf = (key: OnboardingStage | null) => (key ? entries.filter(e => stageOf(e) === key).length : entries.length);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: QUERY_KEY });
    qc.invalidateQueries({ queryKey: ['planner-teachers'] });
  };
  const announce = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), SUCCESS_BANNER_MS);
  };
  const finish = async (entry: StaffOnboardingEntry, force: boolean) => {
    setBusy(true);
    try {
      await completeStaffOnboarding(entry.id, force);
      announce(`${entry.name} has been marked as fully onboarded.`);
      refresh();
      setCompleteAllFor(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: isMobile ? '16px 12px' : '28px 32px', fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ maxWidth: isMobile ? '100%' : 860, margin: '0 auto' }}>

        {/* ── Top Bar ── */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: isMobile ? 8 : 12, marginBottom: isMobile ? 14 : 20, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#0f172a' }}>Staff Onboarding</h1>
          {!isPending && !isError && entries.length > 0 && (
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {entries.length} {entries.length === 1 ? 'new joiner' : 'new joiners'}
            </span>
          )}
          <div style={{ flex: 1 }} />
          <Link to="/settings/staff-onboarding" style={{
            padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, fontWeight: 600,
            color: '#374151', background: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <FontAwesomeIcon icon={faGear} style={{ fontSize: 11 }} /> Edit checklists
          </Link>
        </div>

        {/* ── Toolbar ── */}
        {!isPending && !isError && entries.length > 0 && (
          <div style={toolbarCard}>
            <div style={filterRow}>
              <span style={filterLabel}>Progress</span>
              {FILTERS.map(f => {
                const active = filter === f.key;
                const count = countOf(f.key);
                const muted = !active && count === 0;
                return (
                  <button key={f.label} onClick={() => setFilter(active ? null : f.key)} style={chipStyle(active, f.color, f.bg, muted)}>
                    <span>{f.label}</span>
                    <span style={chipCount(active, f.color, muted)}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Success Banner ── */}
        {successMsg && (
          <div style={{
            marginBottom: 16, padding: '10px 16px', background: '#f0fdf4', color: '#15803d',
            border: '1px solid #bbf7d0', borderRadius: 10, fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <FontAwesomeIcon icon={faCheck} /> {successMsg}
          </div>
        )}

        {isPending && <p style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: 24 }}>Loading…</p>}

        {isError && (
          <div style={{ padding: '40px 20px', textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid #fecaca' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}><FontAwesomeIcon icon={faTriangleExclamation} /></div>
            <div style={{ fontSize: 14, color: '#dc2626', fontWeight: 600 }}>Failed to load new staff</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Please refresh the page.</div>
          </div>
        )}

        {!isPending && !isError && shown.length === 0 && (
          <div style={{ padding: '60px 20px', textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}><FontAwesomeIcon icon={faCheck} style={{ color: '#16a34a' }} /></div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>
              {entries.length === 0 ? 'All caught up!' : 'Nobody in this group'}
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>
              {entries.length === 0
                ? 'Every staff member has finished onboarding. New joiners appear here when they\'re hired, approved, or added on the Staff page.'
                : 'Try another filter.'}
            </div>
          </div>
        )}

        {shown.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shown.map(e => (
              <StaffOnboardingCard
                key={e.id}
                entry={e}
                isMobile={isMobile}
                busy={busy}
                onHrTasks={() => setOpenList({ entry: e, list: 'hr' })}
                onOwnTasks={() => setOpenList({ entry: e, list: 'own' })}
                onComplete={() => finish(e, false)}
                onCompleteAll={() => setCompleteAllFor(e)}
                onOpenRecord={() => navigate(`/teachers/${e.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {openList && (
        <StaffChecklistModal
          entry={openList.entry}
          list={openList.list}
          initial={openList.list === 'hr'
            ? checklistFor(openList.entry.onboardingProgress, hrTemplate)
            : openList.entry.selfOnboardingProgress}
          onClose={() => setOpenList(null)}
          onSaved={completed => {
            if (completed) announce(`${openList.entry.name} has been marked as fully onboarded.`);
            refresh();
            setOpenList(null);
          }}
        />
      )}

      {completeAllFor && (
        <ConfirmDialog
          title={`Complete all tasks for ${completeAllFor.name}?`}
          message="Every task on both checklists — HR's and their own — will be ticked and they'll leave this list. Use this for someone who is already fully set up."
          confirmLabel="Complete all"
          loading={busy}
          onConfirm={() => finish(completeAllFor, true)}
          onCancel={() => setCompleteAllFor(null)}
        />
      )}
    </div>
  );
}

function StaffOnboardingCard({ entry, isMobile, busy, onHrTasks, onOwnTasks, onComplete, onCompleteAll, onOpenRecord }: {
  entry: StaffOnboardingEntry;
  isMobile: boolean;
  busy: boolean;
  onHrTasks: () => void;
  onOwnTasks: () => void;
  onComplete: () => void;
  onCompleteAll: () => void;
  onOpenRecord: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const hr = checklistProgress(entry.onboardingProgress);
  const own = checklistProgress(entry.selfOnboardingProgress);
  const hrDone = hr.stage === 'ready';
  const ready = onboardingStage(entry.onboardingProgress, entry.selfOnboardingProgress) === 'ready';
  const avatarColor = getAvatarColor(entry.name);

  const menu = (
    <ActionMenu groups={[
      [
        { icon: faListCheck, label: 'HR Tasks', onClick: onHrTasks, iconColor: '#3b82f6' },
        ...(own.total > 0 ? [{ icon: faUserCheck, label: 'Their Own Tasks', onClick: onOwnTasks, iconColor: '#7c3aed' }] : []),
        { icon: faUser, label: 'Open Staff Record', onClick: onOpenRecord, iconColor: '#5a67d8' },
      ],
      entry.phone ? [{ icon: faWhatsapp, label: 'WhatsApp Staff', onClick: () => window.open(whatsappSendUrl(entry.phone!), '_blank'), iconColor: '#25d366' }] : [],
      !ready ? [{ icon: faCheck, label: 'Complete All Tasks', onClick: onCompleteAll, iconColor: '#10b981' }] : [],
    ]} />
  );
  // Mark as Completed only once BOTH lists are done; until then, point HR
  // at whichever list still has work on it.
  const primary = ready ? (
    <button onClick={onComplete} disabled={busy} style={primaryBtn('#10b981', busy, isMobile)}>
      <FontAwesomeIcon icon={faCheck} /> Mark as Completed
    </button>
  ) : hrDone ? (
    <button onClick={onOwnTasks} style={primaryBtn('#7c3aed', false, isMobile)}>
      View Their Tasks
    </button>
  ) : (
    <button onClick={onHrTasks} style={primaryBtn('#3b82f6', false, isMobile)}>
      {hr.total === 0 ? 'Set Up HR Tasks' : 'Continue HR Tasks'}
    </button>
  );
  // HR's next step first; once HR is done, what the new joiner still has to do.
  const upNext = hr.nextTask ?? own.nextTask;

  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${hovered ? '#c7d2fe' : '#e2e8f0'}`,
        borderRadius: isMobile ? 10 : 14,
        padding: isMobile ? '14px 12px' : '18px 20px',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: isMobile ? 'center' : 'flex-start', gap: 12, marginBottom: isMobile ? 10 : 14 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: avatarColor.bg, color: avatarColor.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, letterSpacing: '0.02em',
        }}>
          {getInitials(entry.name)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: isMobile ? 15 : 16, fontWeight: 700, color: '#0f172a', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {entry.name}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>{entry.positionName ?? 'No position'}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Started {fmtDate(entry.joinDate)} · {joinedAgo(entry.joinDate)}
          </div>
        </div>

        {isMobile ? menu : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {primary}
            {menu}
          </div>
        )}
      </div>

      {/* Progress — HR's list (drives completion), then their own */}
      <div style={{ paddingLeft: isMobile ? 0 : 54, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {hr.total === 0 ? (
          <span style={{ fontSize: 12, color: '#94a3b8' }}>No HR tasks set up — set up tasks to begin onboarding</span>
        ) : (
          <ProgressBar done={hr.done} total={hr.total} label="HR tasks" />
        )}
        {own.total > 0 && <ProgressBar done={own.done} total={own.total} label="Their own tasks" />}
      </div>
      {upNext && (
        <div style={{ paddingLeft: isMobile ? 0 : 54 }}>
          <UpNextTask task={upNext} label={hr.nextTask ? 'Up next' : 'Waiting on them'} />
        </div>
      )}

      {isMobile && <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>{primary}</div>}
    </div>
  );
}

function primaryBtn(bg: string, busy: boolean, fullWidth: boolean): React.CSSProperties {
  return {
    ...(fullWidth ? { flex: 1, padding: '10px 16px' } : { padding: '8px 16px' }),
    borderRadius: 8, border: 'none', background: bg, color: '#fff',
    cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1,
    fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    boxShadow: `0 1px 4px ${bg}40`,
  };
}
