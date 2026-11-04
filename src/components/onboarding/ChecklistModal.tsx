import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
import type { OnboardingTask } from '../../types/index.js';

// The onboarding checklist window — the same one for Students → Onboarding
// and HR → Onboarding (staff). Callers decide what Save does.

export function ChecklistModal({
  subtitle,
  initialItems,
  templateTasks,
  canFinish = true,
  onClose,
  onSave,
}: {
  /** Whose checklist — e.g. "Aisha · 012-345 6789". */
  subtitle: string;
  initialItems: OnboardingTask[];
  /** Loaded into an empty checklist, e.g. from Settings → Onboarding. */
  templateTasks?: string[];
  /**
   * Whether ticking this whole list finishes onboarding. False when something
   * else is still outstanding (a new joiner's other list) — then a fully
   * ticked list just saves, and the button never says "Mark as Completed".
   */
  canFinish?: boolean;
  onClose: () => void;
  /** Persist the ticks; `finish` means the caller should also mark onboarding complete. */
  onSave: (items: OnboardingTask[], finish: boolean) => Promise<void>;
}) {
  const [items, setItems] = useState<OnboardingTask[]>(initialItems);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (items.length === 0 && templateTasks?.length) {
      setItems(templateTasks.map(task => ({ task, done: false })));
    }
  }, [templateTasks]);

  const toggle = (idx: number) => {
    setItems(prev => prev.map((t, i) => i === idx ? { ...t, done: !t.done } : t));
  };

  const markAll = () => setItems(prev => prev.map(t => ({ ...t, done: true })));

  const doneCount = items.filter(t => t.done).length;
  const allDone = doneCount === items.length && items.length > 0;
  const finishes = allDone && canFinish;

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await onSave(items, finishes);
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
            <p style={modal.subtitle}>{subtitle}</p>
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
              background: finishes ? '#10b981' : '#3b82f6',
              minWidth: finishes ? 150 : undefined,
            }}>
              {saving
                ? (finishes ? 'Finalizing…' : 'Saving…')
                : (finishes ? <><FontAwesomeIcon icon={faCheck} /> Mark as Completed</> : 'Save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const modal: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', padding: 16,
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
