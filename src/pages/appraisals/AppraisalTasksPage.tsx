import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { TASKS_KEY, fetchMyAppraisalTasks } from '../../api/appraisal-runs.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { TODO_HEADING, TODO_VERB, groupTasks, taskLine } from './appraisalTasks.js';
import { ADMIN as p, button } from './runTheme.js';

/** Operation → Appraisals to do: everything waiting for me, by what I have to do. */
export default function AppraisalTasksPage() {
  const { isMobile } = useIsMobile();
  const { data: tasks = [], isPending, error } = useQuery({ queryKey: TASKS_KEY, queryFn: fetchMyAppraisalTasks });
  const me = currentTeacherId();
  const groups = groupTasks(tasks);

  return (
    <div style={{ padding: isMobile ? '16px' : '24px 32px 48px', fontFamily: p.font, background: p.bg, minHeight: '100%' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 16px', fontSize: isMobile ? 20 : 24, fontWeight: 700, color: p.text }}>Appraisals to do</h1>
        {isPending && <LoadingSpinner />}
        {error && <p role="alert" style={{ color: p.red, fontSize: 14 }}>{(error as Error).message}</p>}
        {!isPending && !error && groups.length === 0 && (
          <div style={{ padding: '48px 16px', textAlign: 'center', background: p.card, borderRadius: 12, border: `1px solid ${p.border}` }}>
            <FontAwesomeIcon icon={faCheck} style={{ fontSize: 24, color: p.green, marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: p.sub }}>Nothing waiting for you.</div>
          </div>
        )}
        {groups.map(g => (
          <section key={g.todo} style={{ marginBottom: 24 }} aria-labelledby={`todo-${g.todo}`}>
            <h2 id={`todo-${g.todo}`} style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: p.muted }}>
              {TODO_HEADING[g.todo]} · {g.tasks.length}
            </h2>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, background: p.card, border: `1px solid ${p.border}`, borderRadius: 12, overflow: 'hidden' }}>
              {g.tasks.map((t, i) => (
                <li key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i ? `1px solid ${p.border}` : 'none' }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: p.text }}>
                    {taskLine(t, t.teacherId === me)}
                    {t.status === 'SENT_BACK' && <span style={{ color: p.red }}> · Sent back</span>}
                  </span>
                  <Link to={`/appraisals/${t.id}`} style={{ ...button(p, 'secondary', { small: true, mobile: isMobile }), textDecoration: 'none' }}>
                    {TODO_VERB[g.todo]}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function currentTeacherId(): string | null {
  try { return (JSON.parse(localStorage.getItem('user') ?? 'null') as { teacherId?: string | null } | null)?.teacherId ?? null; } catch { return null; }
}
