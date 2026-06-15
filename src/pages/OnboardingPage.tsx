import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchStudents, patchOnboardingProgress, completeOnboarding } from '../api/students.js';
import { fetchSettings } from '../api/settings.js';
import { Student, OnboardingTask } from '../types/index.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faXmark, faTriangleExclamation, faPen, faListCheck, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';

const CURRENT_YEAR = new Date().getFullYear();
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const AVATAR_COLORS = [
  { bg: '#dbeafe', color: '#1e40af' },
  { bg: '#fce7f3', color: '#9d174d' },
  { bg: '#d1fae5', color: '#065f46' },
  { bg: '#ede9fe', color: '#5b21b6' },
  { bg: '#fef3c7', color: '#92400e' },
  { bg: '#ffedd5', color: '#9a3412' },
];

function getAvatarColor(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+')) return cleaned.replace(/\D/g, '');
  if (cleaned.startsWith('0')) return '60' + cleaned.slice(1);
  if (/^(60|65|62|66|63|91|44|1)\d+$/.test(cleaned)) return cleaned;
  return '60' + cleaned;
}

function formatStartMonth(month: number, year: number) {
  return `${MONTH_NAMES[month - 1] ?? month} ${year}`;
}

function formatStartDate(student: Student) {
  if (student.startDate) {
    const d = new Date(student.startDate);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return formatStartMonth(student.enrolmentMonth, student.enrolmentYear);
}

function getAge(dob: string) {
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age;
}

function getCountdown(startDate: string | null): { label: string; color: string; bg: string; urgent: boolean; isPast: boolean } | null {
  if (!startDate) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(startDate);
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round((targetDay.getTime() - today.getTime()) / 86400000);

  // Past — student has already started; onboarding is overdue.
  // Single red tier: any overdue is bad and the longer it sits the worse,
  // so no softening for older cases.
  if (diffDays < 0) {
    const past = Math.abs(diffDays);
    const label = past <= 7  ? `${past} day${past !== 1 ? 's' : ''} overdue`
                : past <= 30 ? (() => { const w = Math.round(past / 7);  return `${w} week${w !== 1 ? 's' : ''} overdue`; })()
                :              (() => { const m = Math.round(past / 30); return `${m} month${m !== 1 ? 's' : ''} overdue`; })();
    return { label, color: '#b91c1c', bg: '#fee2e2', urgent: true, isPast: true };
  }

  // Future
  if (diffDays === 0) return { label: 'Today!',   color: '#15803d', bg: '#dcfce7', urgent: true, isPast: false };
  if (diffDays === 1) return { label: 'Tomorrow', color: '#c2410c', bg: '#ffedd5', urgent: true, isPast: false };
  if (diffDays <= 7)  return { label: `In ${diffDays} days`, color: '#c2410c', bg: '#ffedd5', urgent: true,  isPast: false };
  if (diffDays <= 30) return { label: `In ${diffDays} days`, color: '#b45309', bg: '#fef9c3', urgent: false, isPast: false };
  if (diffDays <= 90) {
    const weeks = Math.round(diffDays / 7);
    return { label: `In ${weeks} week${weeks !== 1 ? 's' : ''}`, color: '#6d28d9', bg: '#f5f3ff', urgent: false, isPast: false };
  }
  const months = Math.round(diffDays / 30);
  return { label: `In ${months} month${months !== 1 ? 's' : ''}`, color: '#475569', bg: '#f1f5f9', urgent: false, isPast: false };
}

function getProgress(tasks: OnboardingTask[] | string | null) {
  const parsed: OnboardingTask[] = Array.isArray(tasks) ? tasks : (typeof tasks === 'string' ? (() => { try { return JSON.parse(tasks); } catch { return []; } })() : []);
  if (!parsed || parsed.length === 0) return { done: 0, total: 0, nextTask: null };
  const done = parsed.filter(t => t.done).length;
  const nextTask = parsed.find(t => !t.done) ?? null;
  return { done, total: parsed.length, nextTask };
}

// ── ProgressBar ───────────────────────────────────────────────────────────────

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isComplete = total > 0 && done === total;
  const remaining = total - done;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: isComplete ? '#10b981' : '#3b82f6',
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: isComplete ? '#059669' : '#3b82f6', minWidth: 28, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const }}>
          {pct}%
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: isComplete ? '#059669' : '#64748b' }}>
          {done} of {total} tasks complete
        </span>
        {!isComplete && (
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{remaining} remaining</span>
        )}
      </div>
    </div>
  );
}

// ── ActionMenu ────────────────────────────────────────────────────────────────

function ActionMenu({
  onViewTasks,
  onEdit,
  onWhatsApp,
  onCompleteAll,
  hasTasks,
}: {
  onViewTasks: () => void;
  onEdit: () => void;
  onWhatsApp: () => void;
  onCompleteAll: () => void;
  hasTasks: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const menuItem = (icon: typeof faPen, label: string, onClick: () => void, iconColor = '#64748b') => (
    <button
      onClick={() => { onClick(); setOpen(false); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px',
        textAlign: 'left' as const, background: 'none', border: 'none',
        fontSize: 13, fontWeight: 400, cursor: 'pointer', color: '#374151', borderRadius: 6,
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#eef1f5')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      <FontAwesomeIcon icon={icon} fixedWidth style={{ color: iconColor, fontSize: 12 }} />
      {label}
    </button>
  );

  const sep = <div style={{ height: 1, background: '#f1f5f9', margin: '4px 8px' }} />;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: open ? '#f1f5f9' : 'none', border: '1px solid',
          borderColor: open ? '#cbd5e1' : '#e2e8f0',
          borderRadius: 8, cursor: 'pointer', fontSize: 16, color: '#64748b',
          lineHeight: 1,
        }}
        aria-label="More actions"
      >
        ⋯
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 100,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)', minWidth: 190, padding: '4px 0',
        }}>
          <div style={{ padding: '2px 4px' }}>
            {menuItem(faListCheck, 'View Tasks', onViewTasks, '#3b82f6')}
            {menuItem(faPen, 'Edit Student', onEdit, '#5a67d8')}
          </div>
          {sep}
          <div style={{ padding: '2px 4px' }}>
            {menuItem(faWhatsapp, 'WhatsApp Parent', onWhatsApp, '#25d366')}
          </div>
          {hasTasks && (<>
            {sep}
            <div style={{ padding: '2px 4px' }}>
              {menuItem(faCheck, 'Complete All Tasks', onCompleteAll, '#10b981')}
            </div>
          </>)}
        </div>
      )}
    </div>
  );
}

// ── StudentOnboardingCard ─────────────────────────────────────────────────────

function StudentOnboardingCard({
  student,
  onViewTasks,
  onEdit,
  onWhatsApp,
  onCompleteAll,
  isMobile,
  highlighted,
}: {
  student: Student;
  onViewTasks: () => void;
  onEdit: () => void;
  onWhatsApp: () => void;
  onCompleteAll: () => void;
  isMobile: boolean;
  highlighted?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const { done, total, nextTask } = getProgress(student.onboardingProgress);
  const avatarColor = getAvatarColor(student.lead.childName);
  const age = getAge(student.lead.childDob);
  const countdown = getCountdown(student.startDate);

  // Per-card overdue accent. There is no "all-done" path here: when every
  // task is checked the modal/menu auto-finalizes the student, so the
  // student leaves the pending list before this card ever renders done.
  const accent = countdown?.isPast ? '#dc2626' : 'transparent';
  const sideColor = countdown?.isPast ? '#fecaca' : hovered ? '#c7d2fe' : '#e2e8f0';
  return (
    <div
      id={`onboarding-card-${student.id}`}
      style={{
        background: '#fff',
        border: `1px solid ${sideColor}`,
        borderRadius: isMobile ? 10 : 14,
        // Left accent stripe via inset shadow so the border-radius stays
        // perfectly symmetric on all four corners. Survives hover because
        // it's independent of the border colors.
        boxShadow: accent !== 'transparent' ? `inset 3px 0 0 ${accent}` : 'none',
        padding: isMobile ? '14px 12px' : '18px 20px',
        transition: 'border-color 0.15s',
        // Outline ring (not border) is used for the highlight animation so
        // it doesn't fight the per-state border color (red for overdue).
        outline: highlighted ? '2px solid transparent' : undefined,
        outlineOffset: highlighted ? 2 : undefined,
        animation: highlighted ? 'kc-highlight-card 2.4s ease-out' : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: isMobile ? 'center' : 'flex-start', gap: 12, marginBottom: isMobile ? 10 : 14, flexWrap: isMobile ? 'wrap' as const : 'nowrap' as const }}>

        {/* Avatar */}
        <div style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: avatarColor.bg, color: avatarColor.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, letterSpacing: '0.02em',
        }}>
          {getInitials(student.lead.childName)}
        </div>

        {/* Name + details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: isMobile ? 15 : 16, fontWeight: 700, color: '#0f172a', marginBottom: 4, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {student.lead.childName}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>
            {student.package.name}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
            {student.startDate ? (
              <>
                <span>{countdown?.isPast ? 'Started' : 'Starting'} {formatStartDate(student)}</span>
                {countdown && (
                  <span style={{
                    padding: '1px 7px', borderRadius: 10,
                    background: countdown.bg, color: countdown.color,
                    fontSize: 11, fontWeight: countdown.urgent ? 700 : 600,
                    letterSpacing: countdown.urgent ? '0.01em' : 0,
                  }}>
                    {countdown.label}
                  </span>
                )}
              </>
            ) : (
              <span style={{ color: '#cbd5e1', fontStyle: 'italic' as const }}>First day not set</span>
            )}
          </div>
        </div>

        {/* Menu button on mobile (top-right) */}
        {isMobile && (
          <ActionMenu
            onViewTasks={onViewTasks}
            onEdit={onEdit}
            onWhatsApp={onWhatsApp}
            onCompleteAll={onCompleteAll}
            hasTasks={total > 0}
          />
        )}

        {/* Mobile button moved to bottom of card */}

        {/* Primary action + menu — desktop only */}
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              onClick={onViewTasks}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: '#3b82f6', color: '#fff', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' as const,
                boxShadow: '0 1px 4px rgba(59,130,246,0.25)',
              }}
            >
              {total === 0 ? 'Set Up Tasks' : 'Continue Tasks'}
            </button>
            <ActionMenu
              onViewTasks={onViewTasks}
              onEdit={onEdit}
              onWhatsApp={onWhatsApp}
              onCompleteAll={onCompleteAll}
              hasTasks={total > 0}
            />
          </div>
        )}
      </div>

      {/* Progress section */}
      <div style={{ paddingLeft: isMobile ? 0 : 54 }}>
        {total === 0 ? (
          <span style={{ fontSize: 12, color: '#94a3b8' }}>No tasks configured — set up tasks to begin onboarding</span>
        ) : (
          <ProgressBar done={done} total={total} />
        )}

        {/* Next task — red theme when overdue, amber otherwise. Drop the
            inner left accent when the parent card already carries one,
            so the urgency signal isn't doubled. */}
        {nextTask && (() => {
          const overdue = !!countdown?.isPast;
          const theme = overdue
            ? { bg: '#fef2f2', border: '#fecaca', accent: '#dc2626', label: '#b91c1c', divider: '#fca5a5', text: '#991b1b' }
            : { bg: '#fffbeb', border: '#fde68a', accent: '#f59e0b', label: '#d97706', divider: '#fcd34d', text: '#92400e' };
          const cardHasAccent = accent !== 'transparent';
          return (
            <div style={{
              marginTop: 10, padding: '9px 12px',
              background: theme.bg,
              border: `1px solid ${theme.border}`,
              ...(cardHasAccent ? {} : { borderLeft: `3px solid ${theme.accent}` }),
              borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: theme.label, letterSpacing: '0.06em', whiteSpace: 'nowrap' as const, textTransform: 'uppercase' as const }}>
                Up next
              </span>
              <span style={{ width: 1, height: 12, background: theme.divider, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: theme.text, lineHeight: 1.4, fontWeight: 500 }}>
                {nextTask.task}
              </span>
            </div>
          );
        })()}
      </div>

      {/* Primary action — mobile: at bottom of card */}
      {isMobile && (
        <div style={{ width: '100%', display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={onViewTasks}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none',
              background: '#3b82f6', color: '#fff', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' as const,
              boxShadow: '0 1px 4px rgba(59,130,246,0.25)',
            }}
          >
            {total === 0 ? 'Set Up Tasks' : 'Continue Tasks'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Checklist Modal ───────────────────────────────────────────────────────────

function ChecklistModal({
  student,
  onClose,
  onSaved,
}: {
  student: Student;
  onClose: () => void;
  onSaved: (updated: Student, completed: boolean) => void;
}) {
  const raw = student.onboardingProgress;
  const existingTasks: OnboardingTask[] = Array.isArray(raw) ? raw : (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : []);
  const [items, setItems] = useState<OnboardingTask[]>(existingTasks);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });

  useEffect(() => {
    if (items.length === 0 && settings?.onboarding_tasks?.length) {
      setItems(settings.onboarding_tasks.map((task: string) => ({ task, done: false })));
    }
  }, [settings]);

  const toggle = (idx: number) => {
    setItems(prev => prev.map((t, i) => i === idx ? { ...t, done: !t.done } : t));
  };

  const markAll = () => setItems(prev => prev.map(t => ({ ...t, done: true })));

  const doneCount = items.filter(t => t.done).length;
  const allDone = doneCount === items.length && items.length > 0;

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const updated = await patchOnboardingProgress(student.id, items);
      // When every item is checked, the natural next action is to finalize
      // — saves the user a second click and matches the button's intent.
      if (allDone) await completeOnboarding(student.id);
      onSaved(updated, allDone);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  const listRef = useRef<HTMLDivElement>(null);
  const nextTaskRef = useRef<HTMLLabelElement>(null);
  const nextIdx = items.findIndex(t => !t.done);

  useEffect(() => {
    if (nextTaskRef.current && listRef.current) {
      const list = listRef.current;
      const el = nextTaskRef.current;
      const top = el.offsetTop - list.offsetTop - list.clientHeight / 2 + el.clientHeight / 2;
      list.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  }, [nextIdx]);

  return (
    <div style={modal.backdrop}>
      {/* Backdrop is intentionally NOT clickable — onboarding edits are
          easy to lose with an accidental click. Close via the ✕, Cancel,
          or Save buttons only. */}
      <div style={modal.card}>
        <div style={modal.header}>
          <div>
            <h2 style={modal.title}>Onboarding Checklist</h2>
            <p style={modal.subtitle}>{student.lead.childName} · {student.lead.parentPhone}</p>
          </div>
          <button onClick={onClose} style={modal.closeBtn} aria-label="Close"><FontAwesomeIcon icon={faXmark} /></button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ flex: 1, height: 10, background: '#e2e8f0', borderRadius: 5, overflow: 'hidden', position: 'relative' as const }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: allDone ? '#10b981' : '#3b82f6',
                borderRadius: 5, transition: 'width 0.3s',
              }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: allDone ? '#059669' : '#3b82f6', minWidth: 36 }}>
              {pct}%
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
            {doneCount} / {items.length} completed
            {allDone && (
              <span style={{ padding: '1px 8px', background: '#d1fae5', color: '#059669', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                All done!
              </span>
            )}
          </div>
        </div>

        <div ref={listRef} style={modal.list}>
          {items.length === 0 && (
            <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', margin: 0 }}>
              No onboarding tasks configured.
            </p>
          )}
          {items.map((t, idx) => (
            <label
              key={idx}
              ref={idx === nextIdx ? nextTaskRef : undefined}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '9px 12px',
                background: idx === nextIdx ? '#eff6ff' : t.done ? '#f0fdf4' : '#f8fafc',
                borderRadius: 8,
                border: `1px solid ${idx === nextIdx ? '#93c5fd' : t.done ? '#bbf7d0' : '#e2e8f0'}`,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => toggle(idx)}
                style={{ width: 15, height: 15, accentColor: '#10b981', flexShrink: 0, marginTop: 1 }}
              />
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, width: 18, flexShrink: 0 }}>{idx + 1}.</span>
              <span style={{ fontSize: 13, color: t.done ? '#6ee7b7' : '#374151', flex: 1, lineHeight: 1.5, textDecoration: t.done ? 'line-through' : 'none' }}>
                {t.task}
              </span>
            </label>
          ))}
        </div>

        {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}

        <div style={modal.footer}>
          <button onClick={markAll} disabled={allDone || saving} style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid #bfdbfe',
            background: '#eff6ff', color: '#5a79c8', cursor: allDone ? 'default' : 'pointer',
            fontWeight: 600, fontSize: 13, opacity: allDone ? 0.5 : 1,
          }}>
            Mark All Done
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={modal.cancelBtn}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{
              ...modal.saveBtn,
              background: allDone ? '#10b981' : '#3b82f6',
              minWidth: allDone ? 150 : undefined,
            }}>
              {saving
                ? (allDone ? 'Finalizing…' : 'Saving…')
                : (allDone ? <><FontAwesomeIcon icon={faCheck} /> Mark as Completed</> : 'Save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div style={{ width: 42, height: 42, background: '#f1f5f9', borderRadius: 12, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ width: '38%', height: 16, background: '#f1f5f9', borderRadius: 4, marginBottom: 8 }} />
          <div style={{ width: '55%', height: 11, background: '#f1f5f9', borderRadius: 4, marginBottom: 6 }} />
          <div style={{ width: '35%', height: 11, background: '#f1f5f9', borderRadius: 4 }} />
        </div>
        <div style={{ width: 120, height: 34, background: '#f1f5f9', borderRadius: 8, flexShrink: 0 }} />
        <div style={{ width: 32, height: 32, background: '#f1f5f9', borderRadius: 8, flexShrink: 0 }} />
      </div>
      <div style={{ paddingLeft: 54 }}>
        <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, marginBottom: 8 }} />
        <div style={{ width: '45%', height: 11, background: '#f1f5f9', borderRadius: 4 }} />
      </div>
    </div>
  );
}

// ── WhatsApp Modal ────────────────────────────────────────────────────────────

function OnboardingWhatsAppModal({ phone, childName, templates, onClose }: {
  phone: string; childName: string;
  templates: { id: string; name: string; en: string; zh: string }[];
  onClose: () => void;
}) {
  const [tplId, setTplId] = useState('none');
  const [lang, setLang] = useState<'en' | 'zh'>('en');
  const [message, setMessage] = useState('');

  const applyTpl = (id: string, l: 'en' | 'zh') => {
    if (id === 'none') { setMessage(''); return; }
    const tpl = templates.find(t => t.id === id);
    if (!tpl) return;
    const raw = l === 'zh' ? tpl.zh : tpl.en;
    setMessage(raw.replace(/\{\{childName\}\}/g, childName));
  };

  const handleTplChange = (id: string) => { setTplId(id); applyTpl(id, lang); };
  const handleLangChange = (l: 'en' | 'zh') => { setLang(l); applyTpl(tplId, l); };
  const currentTpl = templates.find(t => t.id === tplId);
  const hasZh = tplId !== 'none' && !!currentTpl?.zh;

  const openWa = () => {
    const url = message.trim()
      ? `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message.trim())}`
      : `https://web.whatsapp.com/send?phone=${phone}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{childName}</h2>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#94a3b8' }}>+{phone}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 15, cursor: 'pointer', color: '#94a3b8', padding: 2 }}><FontAwesomeIcon icon={faXmark} /></button>
        </div>

        {/* Template + Language */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <select value={tplId} onChange={e => handleTplChange(e.target.value)} style={{
            padding: '4px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#334155',
          }}>
            <option value="none">No template</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <div style={{ flex: 1 }} />
          {hasZh && (
            <div style={{ display: 'inline-flex', borderRadius: 6, background: '#f1f5f9', padding: 2 }}>
              {(['en', 'zh'] as const).map(l => (
                <button key={l} onClick={() => handleLangChange(l)} style={{
                  padding: '2px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', lineHeight: '16px',
                  border: 'none', background: lang === l ? '#fff' : 'transparent',
                  color: lang === l ? '#1e293b' : '#94a3b8',
                  boxShadow: lang === l ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                }}>{l === 'en' ? 'EN' : '中文'}</button>
              ))}
            </div>
          )}
        </div>

        <textarea
          placeholder="Type your message..."
          style={{ display: 'block', width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff', height: 200, resize: 'vertical', lineHeight: 1.5, color: '#1e293b' }}
          value={message} onChange={e => setMessage(e.target.value)}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#64748b', fontWeight: 500 }}>Cancel</button>
          <div style={{ flex: 1 }} />
          <button onClick={openWa} style={{ padding: '9px 20px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 1px 3px rgba(34,197,94,0.3)' }}>
            <FontAwesomeIcon icon={faWhatsapp} style={{ fontSize: 15 }} /> Open in WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { isMobile, isTablet } = useIsMobile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const openStudentId = searchParams.get('student');
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [checklistStudent, setChecklistStudent] = useState<Student | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [waStudent, setWaStudent] = useState<Student | null>(null);
  const [onboardingStatusFilter, setOnboardingStatusFilter] = useState<string | null>(null);
  const [startMonthFilter, setStartMonthFilter] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const PAGE_SIZE = 20;
  const fetchParams: Record<string, unknown> = {
    onboarding: 'pending' as const,
    year: selectedYear !== 'all' ? selectedYear : undefined,
    search: debouncedSearch || undefined,
    page,
    pageSize: PAGE_SIZE,
    sortBy: 'startDate',
    sortOrder: 'asc' as const,
    ...(onboardingStatusFilter ? { onboardingStatus: onboardingStatusFilter } : {}),
    ...(startMonthFilter ? { startMonth: startMonthFilter } : {}),
  };

  const { data, isPending, isError } = useQuery({
    queryKey: ['students', fetchParams],
    queryFn: () => fetchStudents(fetchParams),
  });
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });

  const paginated = data?.items ?? [];
  const totalStudents = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalStudents / PAGE_SIZE));
  const availableYears = data?.availableYears ?? [];
  const yearOptions = selectedYear !== 'all' && !availableYears.includes(selectedYear as number) ? [selectedYear as number, ...availableYears] : availableYears;
  const { total: onboardingTotal, notStarted: notStartedCount, inProgress: inProgressCount } = data?.onboardingCounts ?? { total: 0, notStarted: 0, inProgress: 0, readyToComplete: 0 };
  const monthlyBreakdown = data?.monthlyBreakdown ?? { months: [], overdue: 0, startingSoon: 0, noDate: 0 };

  const invalidateStudents = () => queryClient.invalidateQueries({ queryKey: ['students'] });

  // If we arrived with ?student=<id>, scroll their card into view and
  // run a highlight animation so the admin sees exactly which one was
  // just touched. Clear the param so a refresh doesn't re-trigger it.
  useEffect(() => {
    if (!openStudentId) return;
    const target = paginated.find(s => s.id === openStudentId);
    if (!target) return;
    const el = document.getElementById(`onboarding-card-${openStudentId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('student');
        return next;
      }, { replace: true });
    }, 2400);
    return () => clearTimeout(t);
  }, [openStudentId, paginated, setSearchParams]);

  const handleSaved = (_updated: Student, completed: boolean) => {
    invalidateStudents();
    setChecklistStudent(null);
    if (completed) {
      setSuccessMsg(`${_updated.lead.childName} has been marked as fully onboarded.`);
      setTimeout(() => setSuccessMsg(null), 5000);
    }
  };

  return (
    <div style={{ padding: isMobile ? '16px 12px' : '28px 32px', fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      <style>{`
        @keyframes kc-highlight-card {
          0%   { outline-color: #3b82f6; }
          70%  { outline-color: #93c5fd; }
          100% { outline-color: transparent; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes kc-highlight-card { from, to { outline-color: transparent; } }
        }
      `}</style>
      <div style={{ maxWidth: isMobile ? '100%' : 860, margin: '0 auto' }}>

        {/* ── Top Bar ── */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: isMobile ? 8 : 12, marginBottom: isMobile ? 14 : 20 }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#0f172a' }}>
            Student Onboarding
          </h1>
          {!isPending && !isError && onboardingTotal > 0 && (
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' as const }}>
              {onboardingTotal} {onboardingTotal === 1 ? 'student' : 'students'}
            </span>
          )}
          <div style={{ flex: 1 }} />
          <select
            value={selectedYear}
            onChange={e => { setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value)); setPage(1); }}
            style={{
              padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
              fontSize: 13, fontWeight: 600, color: '#374151', background: '#fff',
              cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="all">All Years</option>
            {yearOptions.map(y => <option key={y} value={y}>{y === CURRENT_YEAR ? `${y} (Current)` : y}</option>)}
          </select>
        </div>

        {/* ── Toolbar — Search + Priority + Progress in one floating card ── */}
        <div style={toolbarCard}>
          <div style={{ position: 'relative' }}>
            <input
              placeholder="Search students..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '7px 12px 7px 32px', border: '1px solid #e8eaed',
                borderRadius: 7, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
                color: '#111827', background: search ? '#fff' : '#f9fafb', outline: 'none',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            />
            <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#b0b8c8', fontSize: 12 }} />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 12, padding: 2 }}>
                <FontAwesomeIcon icon={faXmark} />
              </button>
            )}
          </div>

          {!isPending && !isError && onboardingTotal > 0 && (
            <>
              {(monthlyBreakdown.overdue > 0 || monthlyBreakdown.months.length > 0) && (
              <div style={filterRow}>
                <span style={filterLabel}>Starting</span>
                {[
                  ...(monthlyBreakdown.overdue > 0 ? [{ key: 'overdue', label: 'Overdue', count: monthlyBreakdown.overdue, color: '#b91c1c', bg: '#fef2f2' }] : []),
                  ...monthlyBreakdown.months.map(m => {
                    const [yr, mo] = m.month.split('-');
                    return { key: m.month, label: `${MONTH_NAMES[Number(mo) - 1]} ${yr.slice(2)}`, count: m.count, color: '#1d4ed8', bg: '#eff6ff' };
                  }),
                ].map(chip => {
                  const active = startMonthFilter === chip.key;
                  return (
                    <button
                      key={chip.key}
                      onClick={() => { setStartMonthFilter(active ? null : chip.key); setPage(1); }}
                      style={chipStyle(active, chip.color, chip.bg, false)}
                    >
                      <span>{chip.label}</span>
                      <span style={chipCount(active, chip.color)}>{chip.count}</span>
                    </button>
                  );
                })}
                {(onboardingStatusFilter || startMonthFilter) && (
                  <button
                    onClick={() => { setOnboardingStatusFilter(null); setStartMonthFilter(null); setPage(1); }}
                    style={clearFiltersBtn}
                  >
                    <FontAwesomeIcon icon={faXmark} style={{ fontSize: 10 }} /> Clear filters
                  </button>
                )}
              </div>
            )}
            <div style={filterRow}>
              <span style={filterLabel}>Progress</span>
              {[
                { key: null as string | null, label: 'All',         count: onboardingTotal, color: '#334155', bg: '#f1f5f9' },
                { key: 'notStarted',          label: 'Not Started', count: notStartedCount, color: '#6d28d9', bg: '#f5f3ff' },
                { key: 'inProgress',          label: 'In Progress', count: inProgressCount, color: '#b45309', bg: '#fffbeb' },
              ].map(f => {
                const active = onboardingStatusFilter === f.key;
                const muted = !active && f.count === 0;
                return (
                  <button
                    key={f.key ?? 'all'}
                    onClick={() => { setOnboardingStatusFilter(active ? null : f.key); setPage(1); }}
                    style={chipStyle(active, f.color, f.bg, muted)}
                  >
                    <span>{f.label}</span>
                    <span style={chipCount(active, f.color, muted)}>{f.count}</span>
                  </button>
                );
              })}
              {/* When the Priority row isn't rendered, Clear filters lives here instead. */}
              {!(monthlyBreakdown.overdue > 0 || monthlyBreakdown.startingSoon > 0) && (onboardingStatusFilter || startMonthFilter) && (
                <button
                  onClick={() => { setOnboardingStatusFilter(null); setStartMonthFilter(null); setPage(1); }}
                  style={clearFiltersBtn}
                >
                  <FontAwesomeIcon icon={faXmark} style={{ fontSize: 10 }} /> Clear filters
                </button>
              )}
            </div>
            </>
          )}
        </div>

        {/* ── Success Banner ── */}
        {successMsg && (
          <div style={{
            marginBottom: 16, padding: '10px 16px',
            background: '#f0fdf4', color: '#15803d',
            border: '1px solid #bbf7d0', borderRadius: 10,
            fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span><FontAwesomeIcon icon={faCheck} /></span> {successMsg}
          </div>
        )}

        {/* ── Loading state ── */}
        {isPending && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* ── Error state ── */}
        {isError && (
          <div style={{
            padding: '40px 20px', textAlign: 'center', background: '#fff',
            borderRadius: 12, border: '1px solid #fecaca',
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}><FontAwesomeIcon icon={faTriangleExclamation} /></div>
            <div style={{ fontSize: 14, color: '#dc2626', fontWeight: 600 }}>Failed to load students</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Please refresh the page.</div>
          </div>
        )}

        {/* ── Empty state ── */}
        {!isPending && !isError && totalStudents === 0 && (
          <div style={{
            padding: '60px 20px', textAlign: 'center', background: '#fff',
            borderRadius: 12, border: '1px solid #e2e8f0',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}><FontAwesomeIcon icon={faCheck} style={{ color: '#16a34a' }} /></div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>
              {totalStudents === 0 ? 'All caught up!' : `No pending students for ${selectedYear}`}
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>
              {totalStudents === 0
                ? 'All students have completed onboarding.'
                : `There are ${totalStudents} pending student(s) in other years.`}
            </div>
          </div>
        )}

        {/* ── Student List ── */}
        {paginated.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {paginated.map((s) => (
              <StudentOnboardingCard
                key={s.id}
                student={s}
                onViewTasks={() => setChecklistStudent(s)}
                onEdit={() => navigate(`/students/${s.id}`)}
                onWhatsApp={() => setWaStudent(s)}
                onCompleteAll={async () => {
                  // Check every task AND finalize in one shot — the menu
                  // action means "we're done with this student".
                  const raw = s.onboardingProgress;
                  const tasks: Array<{ task: string; done: boolean }> = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
                  if (tasks.length > 0) {
                    await patchOnboardingProgress(s.id, tasks.map(t => ({ ...t, done: true })));
                  }
                  await completeOnboarding(s.id);
                  invalidateStudents();
                  setSuccessMsg(`${s.lead.childName} has been marked as fully onboarded.`);
                  setTimeout(() => setSuccessMsg(null), 5000);
                }}
                isMobile={isMobile}
                highlighted={openStudentId === s.id}
              />
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'center', marginTop: 20 }}>
            <button onClick={() => setPage(1)} disabled={page === 1} style={pgBtn(page === 1)}>«</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pgBtn(page === 1)}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                style={{
                  ...pgBtn(false),
                  ...(p === page ? { background: '#3b82f6', color: '#fff', border: '1px solid #3b82f6' } : {}),
                }}
              >
                {p}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pgBtn(page === totalPages)}>›</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={pgBtn(page === totalPages)}>»</button>
          </div>
        )}

      </div>

      {/* ── Modals ── */}
      {checklistStudent && (
        <ChecklistModal
          student={checklistStudent}
          onClose={() => setChecklistStudent(null)}
          onSaved={handleSaved}
        />
      )}

      {/* WhatsApp Modal */}
      {waStudent && (() => {
        const phone = normalizePhone(waStudent.lead.parentPhone);
        const childName = waStudent.lead.childName;
        // Build template list
        interface TplOpt { id: string; name: string; en: string; zh: string; }
        const templates: TplOpt[] = [
          { id: 'enquiry', name: 'Enquiry', en: String(settings?.whatsapp_template ?? ''), zh: String(settings?.whatsapp_template_zh ?? '') },
          { id: 'follow_up', name: 'Follow Up', en: String(settings?.whatsapp_followup_template ?? ''), zh: String(settings?.whatsapp_followup_template_zh ?? '') },
          ...(Array.isArray(settings?.whatsapp_custom_templates)
            ? (settings.whatsapp_custom_templates as { id: string; name: string; content_en: string; content_zh: string }[]).map(t => ({
                id: t.id, name: t.name, en: t.content_en, zh: t.content_zh,
              }))
            : []),
        ];
        return <OnboardingWhatsAppModal phone={phone} childName={childName} templates={templates} onClose={() => setWaStudent(null)} />;
      })()}

    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pgBtn(disabled: boolean): React.CSSProperties {
  return {
    minWidth: 32, padding: '5px 10px', borderRadius: 6,
    border: '1px solid #e2e8f0', background: disabled ? '#f8fafc' : '#fff',
    color: disabled ? '#cbd5e1' : '#374151', cursor: disabled ? 'default' : 'pointer',
    fontSize: 13, fontWeight: 600,
  };
}

const modal: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  card: {
    background: '#fff', borderRadius: 16, padding: '28px 32px',
    width: '100%', maxWidth: 520, maxHeight: '88vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#64748b' },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94a3b8', lineHeight: 1, padding: 4 },
  list: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 2, maxHeight: 240 },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, paddingTop: 14, borderTop: '1px solid #f1f5f9' },
  cancelBtn: {
    padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0',
    background: '#f8fafc', color: '#374151', cursor: 'pointer', fontWeight: 600, fontSize: 13,
  },
  saveBtn: {
    padding: '8px 18px', borderRadius: 8, border: 'none',
    background: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13,
  },
};

// ── Filter chip styling ──────────────────────────────────────────────────────
// Shared between the Priority and Progress rows so both filter dimensions
// read as siblings instead of two different chip systems.

const toolbarCard: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 14,
  padding: '12px 14px', marginBottom: 16,
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 14,
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

const filterRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  overflowX: 'auto', WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none', msOverflowStyle: 'none',
};

const filterLabel: React.CSSProperties = {
  fontSize: 11, color: '#94a3b8', fontWeight: 600,
  whiteSpace: 'nowrap', textTransform: 'uppercase',
  letterSpacing: '0.06em', minWidth: 64,
};

const clearFiltersBtn: React.CSSProperties = {
  marginLeft: 'auto',
  padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
  cursor: 'pointer', border: 'none', background: 'none', color: '#94a3b8',
  whiteSpace: 'nowrap', flexShrink: 0,
  display: 'flex', alignItems: 'center', gap: 5,
};

function chipStyle(active: boolean, color: string, bg: string, muted: boolean): React.CSSProperties {
  return {
    padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', border: '1px solid', transition: 'all 0.12s',
    whiteSpace: 'nowrap', flexShrink: 0,
    background: active ? color : muted ? '#f8fafc' : bg,
    color: active ? '#fff' : muted ? '#cbd5e1' : color,
    borderColor: active ? color : 'transparent',
    display: 'flex', alignItems: 'center', gap: 6,
  };
}

function chipCount(active: boolean, color: string, muted = false): React.CSSProperties {
  return {
    fontSize: 11, fontWeight: 700,
    padding: '0 6px', borderRadius: 8,
    background: active ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.06)',
    color: active ? '#fff' : muted ? '#cbd5e1' : color,
    fontVariantNumeric: 'tabular-nums',
  };
}
