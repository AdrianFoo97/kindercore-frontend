import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchStudents, patchOnboardingProgress, completeOnboarding } from '../api/students.js';
import { fetchSettings } from '../api/settings.js';
import { Student, OnboardingTask } from '../types/index.js';
import EditStudentModal from '../components/students/EditStudentModal.js';

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
  return '60' + cleaned;
}

function formatStartMonth(month: number, year: number) {
  return `${MONTH_NAMES[month - 1] ?? month} ${year}`;
}

function getProgress(tasks: OnboardingTask[] | null) {
  if (!tasks || tasks.length === 0) return { done: 0, total: 0, nextTask: null };
  const done = tasks.filter(t => t.done).length;
  const nextTask = tasks.find(t => !t.done) ?? null;
  return { done, total: tasks.length, nextTask };
}

// ── ProgressBar ───────────────────────────────────────────────────────────────

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isComplete = total > 0 && done === total;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: isComplete ? '#10b981' : '#3b82f6',
            borderRadius: 4,
            transition: 'width 0.3s ease',
          }} />
        </div>
        <span style={{
          fontSize: 12, fontWeight: 700, minWidth: 34, textAlign: 'right' as const,
          color: isComplete ? '#059669' : '#3b82f6',
        }}>
          {pct}%
        </span>
        <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' as const }}>
          {done}/{total} tasks
        </span>
      </div>
    </div>
  );
}

// ── ActionMenu ────────────────────────────────────────────────────────────────

function ActionMenu({
  onViewTasks,
  onEdit,
  waUrl,
  onComplete,
  allDone,
}: {
  onViewTasks: () => void;
  onEdit: () => void;
  waUrl: string;
  onComplete: () => void;
  allDone: boolean;
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

  const item = (label: string, onClick: () => void, danger = false) => (
    <button
      onClick={() => { onClick(); setOpen(false); }}
      style={{
        display: 'block', width: '100%', padding: '8px 14px',
        textAlign: 'left' as const, background: 'none', border: 'none',
        fontSize: 13, fontWeight: 500, cursor: 'pointer',
        color: danger ? '#dc2626' : '#374151',
        borderRadius: 6,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = danger ? '#fef2f2' : '#f8fafc')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      {label}
    </button>
  );

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
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.10)', minWidth: 170, padding: '4px',
        }}>
          {item('View Tasks', onViewTasks)}
          {item('Edit Student', onEdit)}
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            style={{
              display: 'block', padding: '8px 14px',
              fontSize: 13, fontWeight: 500, color: '#374151',
              textDecoration: 'none', borderRadius: 6,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            WhatsApp Parent
          </a>
          {allDone && (
            <>
              <div style={{ height: 1, background: '#e2e8f0', margin: '4px 0' }} />
              {item('✓ Complete Onboarding', onComplete)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── StudentOnboardingCard ─────────────────────────────────────────────────────

function StudentOnboardingCard({
  student,
  index,
  onViewTasks,
  onEdit,
  onConfirmComplete,
  completing,
}: {
  student: Student;
  index: number;
  onViewTasks: () => void;
  onEdit: () => void;
  onConfirmComplete: () => void;
  completing: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const { done, total, nextTask } = getProgress(student.onboardingProgress);
  const allDone = total > 0 && done === total;
  const avatarColor = getAvatarColor(student.lead.childName);
  const waUrl = `https://web.whatsapp.com/send?phone=${normalizePhone(student.lead.parentPhone)}`;

  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${hovered ? '#c7d2fe' : '#e2e8f0'}`,
        borderRadius: 12,
        padding: '16px 20px',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: hovered
          ? '0 4px 12px rgba(59,130,246,0.08)'
          : '0 1px 3px rgba(0,0,0,0.05)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Row: student info + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
        {/* Index number */}
        <span style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 600, width: 20, flexShrink: 0, textAlign: 'center' as const }}>
          {index}
        </span>

        {/* Avatar */}
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: avatarColor.bg, color: avatarColor.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, letterSpacing: '0.02em',
        }}>
          {getInitials(student.lead.childName)}
        </div>

        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 2, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {student.lead.childName}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {student.package.name}
            <span style={{ margin: '0 5px', color: '#cbd5e1' }}>·</span>
            Age {student.package.age}Y
            <span style={{ margin: '0 5px', color: '#cbd5e1' }}>·</span>
            {formatStartMonth(student.enrolmentMonth, student.enrolmentYear)}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {allDone ? (
            <button
              onClick={onConfirmComplete}
              disabled={completing}
              style={{
                padding: '7px 14px', borderRadius: 8, border: 'none',
                background: '#10b981', color: '#fff', cursor: completing ? 'default' : 'pointer',
                fontSize: 13, fontWeight: 600, opacity: completing ? 0.6 : 1,
                whiteSpace: 'nowrap' as const,
              }}
            >
              {completing ? 'Completing…' : 'Mark Complete'}
            </button>
          ) : (
            <button
              onClick={onViewTasks}
              style={{
                padding: '7px 14px', borderRadius: 8, border: 'none',
                background: '#3b82f6', color: '#fff', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' as const,
              }}
            >
              {total === 0 ? 'Set Up Tasks' : 'Continue Task'}
            </button>
          )}
          <ActionMenu
            onViewTasks={onViewTasks}
            onEdit={onEdit}
            waUrl={waUrl}
            onComplete={onConfirmComplete}
            allDone={allDone}
          />
        </div>
      </div>

      {/* Progress */}
      <div style={{ paddingLeft: 34 }}>
        {total === 0 ? (
          <span style={{ fontSize: 12, color: '#94a3b8' }}>No tasks configured</span>
        ) : (
          <ProgressBar done={done} total={total} />
        )}

        {/* Next task */}
        {!allDone && nextTask && (
          <div style={{
            marginTop: 10, padding: '8px 12px',
            background: '#fffbeb', border: '1px solid #fde68a',
            borderLeft: '3px solid #f59e0b',
            borderRadius: 6, display: 'flex', alignItems: 'flex-start', gap: 8,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309', whiteSpace: 'nowrap' as const, marginTop: 1 }}>
              NEXT
            </span>
            <span style={{ fontSize: 13, color: '#78350f', lineHeight: 1.4 }}>
              {nextTask.task}
            </span>
          </div>
        )}

        {allDone && (
          <div style={{
            marginTop: 10, padding: '7px 12px',
            background: '#f0fdf4', border: '1px solid #bbf7d0',
            borderRadius: 6, fontSize: 12, color: '#059669', fontWeight: 600,
          }}>
            ✓ All tasks completed — ready to finalize onboarding
          </div>
        )}
      </div>
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
  onSaved: (updated: Student) => void;
}) {
  const existingTasks = student.onboardingProgress ?? [];
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

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const updated = await patchOnboardingProgress(student.id, items);
      onSaved(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const doneCount = items.filter(t => t.done).length;
  const allDone = doneCount === items.length && items.length > 0;
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  return (
    <div style={modal.backdrop} onClick={onClose}>
      <div style={modal.card} onClick={e => e.stopPropagation()}>
        <div style={modal.header}>
          <div>
            <h2 style={modal.title}>Onboarding Checklist</h2>
            <p style={modal.subtitle}>{student.lead.childName} · {student.lead.parentPhone}</p>
          </div>
          <button onClick={onClose} style={modal.closeBtn} aria-label="Close">✕</button>
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

        <div style={modal.list}>
          {items.length === 0 && (
            <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', margin: 0 }}>
              No onboarding tasks configured.
            </p>
          )}
          {items.map((t, idx) => (
            <label
              key={idx}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '9px 12px',
                background: t.done ? '#f0fdf4' : '#f8fafc',
                borderRadius: 8,
                border: `1px solid ${t.done ? '#bbf7d0' : '#e2e8f0'}`,
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
            background: '#eff6ff', color: '#2563eb', cursor: allDone ? 'default' : 'pointer',
            fontWeight: 600, fontSize: 13, opacity: allDone ? 0.5 : 1,
          }}>
            Mark All Done
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={modal.cancelBtn}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={modal.saveBtn}>
              {saving ? 'Saving…' : 'Save'}
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
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <div style={{ width: 20, height: 12, background: '#f1f5f9', borderRadius: 4 }} />
        <div style={{ width: 38, height: 38, background: '#f1f5f9', borderRadius: 10 }} />
        <div style={{ flex: 1 }}>
          <div style={{ width: '40%', height: 14, background: '#f1f5f9', borderRadius: 4, marginBottom: 6 }} />
          <div style={{ width: '60%', height: 11, background: '#f1f5f9', borderRadius: 4 }} />
        </div>
        <div style={{ width: 110, height: 32, background: '#f1f5f9', borderRadius: 8 }} />
        <div style={{ width: 32, height: 32, background: '#f1f5f9', borderRadius: 8 }} />
      </div>
      <div style={{ paddingLeft: 34 }}>
        <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, marginBottom: 8 }} />
        <div style={{ width: '30%', height: 11, background: '#f1f5f9', borderRadius: 4 }} />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);
  const [page, setPage] = useState(1);
  const [checklistStudent, setChecklistStudent] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [confirmStudent, setConfirmStudent] = useState<Student | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: students = [], isPending, isError } = useQuery({
    queryKey: ['students'],
    queryFn: fetchStudents,
  });

  const PAGE_SIZE = 20;
  const pending = students.filter(s => !s.onboardingCompleted && !s.withdrawnAt);
  const availableYears = Array.from(new Set(pending.map(s => s.enrolmentYear))).sort((a, b) => b - a);
  const yearOptions = availableYears.includes(selectedYear) ? availableYears : [selectedYear, ...availableYears];
  const filtered = pending
    .filter(s => s.enrolmentYear === selectedYear)
    .sort((a, b) => a.enrolmentMonth - b.enrolmentMonth || a.lead.childName.localeCompare(b.lead.childName));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSaved = (updated: Student) => {
    queryClient.setQueryData<Student[]>(['students'], (prev = []) =>
      prev.map(s => s.id === updated.id ? updated : s)
    );
    setChecklistStudent(null);
  };

  const handleEditSaved = (updated: Student) => {
    queryClient.setQueryData<Student[]>(['students'], (prev = []) =>
      prev.map(s => s.id === updated.id ? updated : s)
    );
    setEditingStudent(null);
  };

  const handleComplete = async (s: Student) => {
    setCompleting(s.id);
    setConfirmStudent(null);
    try {
      const updated = await completeOnboarding(s.id);
      queryClient.setQueryData<Student[]>(['students'], (prev = []) =>
        prev.map(x => x.id === updated.id ? updated : x)
      );
      setSuccessMsg(`${s.lead.childName} has been marked as fully onboarded.`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch {
      // ignore
    } finally {
      setCompleting(null);
    }
  };

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* ── Top Bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a', flex: 1 }}>
            Student Onboarding
          </h1>
          <select
            value={selectedYear}
            onChange={e => { setSelectedYear(Number(e.target.value)); setPage(1); }}
            style={{
              padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
              fontSize: 13, fontWeight: 600, color: '#374151', background: '#fff',
              cursor: 'pointer', outline: 'none',
            }}
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {filtered.length > 0 && (
            <span style={{
              padding: '4px 12px', background: '#fef9c3', color: '#854d0e',
              borderRadius: 20, fontSize: 12, fontWeight: 700, border: '1px solid #fde68a',
            }}>
              {filtered.length} pending
            </span>
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
            <span>✓</span> {successMsg}
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
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontSize: 14, color: '#dc2626', fontWeight: 600 }}>Failed to load students</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Please refresh the page.</div>
          </div>
        )}

        {/* ── Empty state ── */}
        {!isPending && !isError && filtered.length === 0 && (
          <div style={{
            padding: '60px 20px', textAlign: 'center', background: '#fff',
            borderRadius: 12, border: '1px solid #e2e8f0',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>
              {pending.length === 0 ? 'All caught up!' : `No pending students for ${selectedYear}`}
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>
              {pending.length === 0
                ? 'All students have completed onboarding.'
                : `There are ${pending.length} pending student(s) in other years.`}
            </div>
          </div>
        )}

        {/* ── Student List ── */}
        {paginated.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {paginated.map((s, idx) => (
              <StudentOnboardingCard
                key={s.id}
                student={s}
                index={(safePage - 1) * PAGE_SIZE + idx + 1}
                onViewTasks={() => setChecklistStudent(s)}
                onEdit={() => setEditingStudent(s)}
                onConfirmComplete={() => setConfirmStudent(s)}
                completing={completing === s.id}
              />
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'center', marginTop: 20 }}>
            <button onClick={() => setPage(1)} disabled={safePage === 1} style={pgBtn(safePage === 1)}>«</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} style={pgBtn(safePage === 1)}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                style={{
                  ...pgBtn(false),
                  ...(p === safePage ? { background: '#3b82f6', color: '#fff', border: '1px solid #3b82f6' } : {}),
                }}
              >
                {p}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} style={pgBtn(safePage === totalPages)}>›</button>
            <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages} style={pgBtn(safePage === totalPages)}>»</button>
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

      {editingStudent && (
        <EditStudentModal
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSaved={handleEditSaved}
          onDeleted={() => {
            queryClient.setQueryData<Student[]>(['students'], (prev = []) =>
              prev.filter(s => s.id !== editingStudent.id)
            );
            setEditingStudent(null);
          }}
        />
      )}

      {confirmStudent && (
        <div style={modal.backdrop} onClick={() => setConfirmStudent(null)}>
          <div style={{ ...modal.card, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: 6, fontSize: 28 }}>🎓</div>
            <h2 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
              Confirm Onboarding Completion
            </h2>
            <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 20px', lineHeight: 1.6 }}>
              Mark <strong style={{ color: '#0f172a' }}>{confirmStudent.lead.childName}</strong> as fully onboarded?
              They will be <strong>removed from this list</strong>.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setConfirmStudent(null)} style={modal.cancelBtn}>Cancel</button>
              <button
                onClick={() => handleComplete(confirmStudent)}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
              >
                Yes, Complete
              </button>
            </div>
          </div>
        </div>
      )}
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
  list: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 2 },
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
