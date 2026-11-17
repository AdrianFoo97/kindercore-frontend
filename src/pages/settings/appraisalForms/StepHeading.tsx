import type { ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { C } from './formTheme.js';

/**
 * A step's heading: its title (and number, when not already on a tab), a short hint, whether it's ready,
 * and — right here — what it still needs before the form can go live.
 * `issues` undefined = no status (read-only versions).
 */
export default function StepHeading({ id, number, title, hint, issues, right, listIssues = true }: {
  id: string; number?: number; title: string; hint?: string; issues?: string[]; right?: ReactNode;
  /** false = only the count here; each problem is shown where it is (e.g. on its step). */
  listIssues?: boolean;
}) {
  const todo = issues?.length ?? 0;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {number !== undefined && <span aria-hidden style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: todo ? C.amber : C.primary, background: todo ? C.amberSoft : C.primarySoft,
        }}>{number}</span>}
        <h2 id={id} style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text, flex: 1, minWidth: 0 }}>{title}</h2>
        {right}
        {issues && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
            color: todo ? C.amber : C.green }}>
            {!todo && <FontAwesomeIcon icon={faCircleCheck} />}
            {todo ? `${todo} to fix` : 'Ready'}
          </span>
        )}
      </div>
      {hint && <p style={{ margin: number !== undefined ? '4px 0 0 40px' : '4px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{hint}</p>}
      {todo > 0 && listIssues && (
        <ul role="alert" style={{ listStyle: 'none', margin: '12px 0 0', padding: '10px 12px', borderRadius: 8, background: C.amberSoft, display: 'grid', gap: 4 }}>
          {issues!.map(p => (
            <li key={p} style={{ display: 'flex', gap: 8, fontSize: 13.5, color: C.amber, lineHeight: 1.45 }}>
              <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginTop: 3, fontSize: 12 }} />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}