import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faClipboardCheck } from '@fortawesome/free-solid-svg-icons';
import { TASKS_KEY, fetchMyAppraisalTasks } from '../../api/appraisal-runs.js';
import { TODO_HEADING, taskLine } from '../appraisals/appraisalTasks.js';

// Teacher app → "Appraisals": anything waiting for this person — appraisals
// they score or sign off (supervisors, principals) and their own to read and
// confirm. Hidden when there's nothing (and for anyone the list isn't for).

const C = { card: '#ffffff', border: '#ddd6fe', text: '#334155', muted: '#64748b', accent: '#7c3aed', accentSoft: '#f5f3ff', divider: '#eef0f3' };

export function MyAppraisalTasksCard({ teacherId, sectionLabelStyle }: { teacherId: string; sectionLabelStyle: React.CSSProperties }) {
  const { data: tasks = [] } = useQuery({ queryKey: TASKS_KEY, queryFn: fetchMyAppraisalTasks, retry: false });
  if (tasks.length === 0) return null;
  return (
    <>
      <div style={sectionLabelStyle}>Appraisals</div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, overflow: 'hidden', marginBottom: 26, boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}>
        {tasks.map((t, i) => (
          <Link key={t.id} to={`/appraisals/${t.id}?app=teacher`} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', minHeight: 44, textDecoration: 'none', color: 'inherit',
            borderTop: i ? `1px solid ${C.divider}` : 'none', WebkitTapHighlightColor: 'transparent',
          }}>
            <span aria-hidden style={{ width: 36, height: 36, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.accentSoft, color: C.accent, fontSize: 15 }}>
              <FontAwesomeIcon icon={faClipboardCheck} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: C.text }}>{TODO_HEADING[t.todo]}</span>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.muted, marginTop: 2 }}>{taskLine(t, t.teacherId === teacherId)}</span>
            </span>
            <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 13, color: C.muted }} />
          </Link>
        ))}
      </div>
    </>
  );
}
