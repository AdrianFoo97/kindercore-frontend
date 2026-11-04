import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faListCheck } from '@fortawesome/free-solid-svg-icons';
import type { OnboardingTask } from '../../types/index.js';
import { fetchMyOnboarding, tickMyOnboarding } from '../../api/staffOnboarding.js';
import { checklistProgress } from '../staffOnboarding/progress.js';

// Teacher Home → "My onboarding": a new joiner's own checklist (handbook,
// guides, routine…). Each tap saves straight away — no Save button to forget
// on a phone. Hidden once everything is ticked, and for staff who never had
// one (everyone who joined before onboarding existed).

const C = {
  card: '#ffffff', border: '#ddd6fe', text: '#334155', muted: '#64748b', soft: '#94a3b8',
  accent: '#7c3aed', accentSoft: '#f5f3ff', track: '#ede9fe', done: '#16a34a', doneSoft: '#f0fdf4',
};

export function MyOnboardingCard({ teacherId, sectionLabelStyle }: { teacherId: string; sectionLabelStyle: React.CSSProperties }) {
  const qc = useQueryClient();
  const queryKey = ['my-onboarding', teacherId];
  const { data } = useQuery({ queryKey, queryFn: () => fetchMyOnboarding(teacherId), retry: false });
  const tasks = data?.tasks ?? [];
  const { done, total, stage } = checklistProgress(tasks);
  if (total === 0 || stage === 'ready') return null;

  const toggle = async (idx: number) => {
    const next: OnboardingTask[] = tasks.map((t, i) => (i === idx ? { ...t, done: !t.done } : t));
    qc.setQueryData(queryKey, { tasks: next }); // tick shows instantly
    try {
      const saved = await tickMyOnboarding(teacherId, next);
      qc.setQueryData(queryKey, saved);
    } catch {
      qc.invalidateQueries({ queryKey }); // put back what's really saved
    }
  };
  const pct = Math.round((done / total) * 100);

  return (
    <>
      <div style={sectionLabelStyle}>My onboarding</div>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16, marginBottom: 26,
        boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 13, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: C.accentSoft, color: C.accent, fontSize: 17, border: `1px solid ${C.border}`,
          }}>
            <FontAwesomeIcon icon={faListCheck} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Welcome to the team!</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: C.muted, marginTop: 2 }}>
              {done} of {total} done — tick each one as you go.
            </div>
          </div>
        </div>

        <div style={{ height: 6, background: C.track, borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: C.accent, borderRadius: 3, transition: 'width 0.3s ease' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tasks.map((t, i) => (
            <button
              key={`${i}-${t.task}`}
              type="button"
              onClick={() => toggle(i)}
              aria-pressed={t.done}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                padding: '11px 12px', borderRadius: 12, cursor: 'pointer', font: 'inherit',
                border: `1px solid ${t.done ? '#bbf7d0' : '#eceef2'}`, background: t.done ? C.doneSoft : '#f8fafc',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{
                width: 22, height: 22, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `2px solid ${t.done ? C.done : '#cbd5e1'}`, background: t.done ? C.done : '#fff', color: '#fff', fontSize: 11,
              }}>
                {t.done && <FontAwesomeIcon icon={faCheck} />}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: t.done ? C.soft : C.text, textDecoration: t.done ? 'line-through' : 'none', lineHeight: 1.4 }}>
                {t.task}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
