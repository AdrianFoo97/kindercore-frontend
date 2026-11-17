import type { AppraisalTask, TaskTodo } from '../../api/appraisal-runs.js';
import { MONTH_LABELS } from './appraisalDisplay.js';

// "Appraisals to do": what's waiting for the signed-in person — to score, to
// sign off, or (their own) to read and confirm — grouped in that order.

export const TODO_HEADING: Record<TaskTodo, string> = { SCORE: 'To score', SIGN_OFF: 'To sign off', ACKNOWLEDGE: 'To read and confirm' };
const TODO_ORDER: TaskTodo[] = ['SCORE', 'SIGN_OFF', 'ACKNOWLEDGE'];

/** Non-empty groups, in the order they're done. */
export function groupTasks(tasks: AppraisalTask[]): { todo: TaskTodo; tasks: AppraisalTask[] }[] {
  return TODO_ORDER.map(todo => ({ todo, tasks: tasks.filter(t => t.todo === todo) })).filter(g => g.tasks.length > 0);
}

/** One line for a task: "Tina · Monthly EI appraisal · Oct 2026" (your own just says the form). */
export function taskLine(t: AppraisalTask, own: boolean): string {
  const when = `${MONTH_LABELS[t.period.month]} ${t.period.year}`;
  return own ? `${t.formName} · ${when}` : `${t.teacherName} · ${t.formName} · ${when}`;
}

/** The button on a task, by what's to do. */
export const TODO_VERB: Record<TaskTodo, string> = { SCORE: 'Score', SIGN_OFF: 'Review', ACKNOWLEDGE: 'Read' };
