import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faMagnifyingGlass,
  faChevronDown, faChevronUp, faXmark, faTrash, faPen,
  faTriangleExclamation, faGripVertical, faSchool,
  faChalkboardTeacher, faListCheck, faBook, faClock,
  faCalendarDays, faCheck, faBars, faSave, faFolderOpen, faRotateLeft, faRotateRight, faFileExport,
} from '@fortawesome/free-solid-svg-icons';
import {
  fetchTeachers, createTeacher, updateTeacher, deleteTeacher,
  fetchClassrooms, createClassroom, updateClassroom, deleteClassroom,
  fetchSubjects, createSubject, updateSubject, deleteSubject,
  fetchTasks, createTask, updateTask, deleteTask,
  fetchBlocks, createBlock, updateBlock, deleteBlock,
  CreateBlockPayload, UpdateBlockPayload,
  fetchSavedTimetables, saveTimetable, loadSavedTimetable, deleteSavedTimetable,
  SavedTimetable,
} from '../api/planner.js';
import {
  Teacher, Classroom, PlannerSubject, PlannerTask, ScheduleBlock,
} from '../types/index.js';

// ── Color palette ────────────────────────────────────────────────────────────

const C = {
  bg: '#f1f5f9',
  card: '#ffffff',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  primary: '#4f46e5',
  primaryLight: '#e0e7ff',
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',
};

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b',
];

const TASK_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'TEACHING', label: 'Teaching' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'DUTY', label: 'Duty' },
  { value: 'BREAK', label: 'Break' },
  { value: 'OTHER', label: 'Other' },
];

// ── Constants ────────────────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_START = 420;   // 7:00 AM in minutes
const DAY_END = 1080;    // 6:00 PM in minutes
const SLOT_DURATION = 30; // minutes
const ROW_HEIGHT = 40;   // pixels per slot
const TIME_COL_WIDTH = 60;

const DURATION_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────



function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function generateTimeSlots(): number[] {
  const slots: number[] = [];
  for (let m = DAY_START; m < DAY_END; m += SLOT_DURATION) slots.push(m);
  return slots;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Compute column layout for overlapping blocks within a day */
function layoutBlocks(dayBlocks: ScheduleBlock[]): Map<string, { col: number; totalCols: number }> {
  const result = new Map<string, { col: number; totalCols: number }>();
  if (dayBlocks.length === 0) return result;

  // Sort by start time, then classroom name, then duration (longer first)
  const sorted = [...dayBlocks].sort((a, b) =>
    a.startMinute - b.startMinute ||
    (a.classroom?.name || 'zzz').localeCompare(b.classroom?.name || 'zzz') ||
    b.durationMinutes - a.durationMinutes
  );

  // Assign columns using a greedy algorithm
  const columns: Array<{ end: number; blockId: string }[]> = [];

  for (const block of sorted) {
    const blockEnd = block.startMinute + block.durationMinutes;
    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      const lastInCol = columns[c][columns[c].length - 1];
      if (lastInCol.end <= block.startMinute) {
        columns[c].push({ end: blockEnd, blockId: block.id });
        result.set(block.id, { col: c, totalCols: 0 }); // totalCols computed later
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([{ end: blockEnd, blockId: block.id }]);
      result.set(block.id, { col: columns.length - 1, totalCols: 0 });
    }
  }

  // Now compute totalCols for each block by finding max overlapping columns at its time
  for (const block of sorted) {
    const blockEnd = block.startMinute + block.durationMinutes;
    let maxCols = 1;
    for (const other of sorted) {
      if (other.id === block.id) continue;
      const otherEnd = other.startMinute + other.durationMinutes;
      if (other.startMinute < blockEnd && block.startMinute < otherEnd) {
        // overlaps
        const otherLayout = result.get(other.id);
        const thisLayout = result.get(block.id);
        if (otherLayout && thisLayout) {
          maxCols = Math.max(maxCols, Math.max(otherLayout.col, thisLayout.col) + 1);
        }
      }
    }
    const layout = result.get(block.id);
    if (layout) layout.totalCols = Math.max(layout.totalCols, maxCols);
  }

  // Normalize: ensure all overlapping blocks share the same totalCols
  for (const block of sorted) {
    const blockEnd = block.startMinute + block.durationMinutes;
    const layout = result.get(block.id)!;
    for (const other of sorted) {
      if (other.id === block.id) continue;
      const otherEnd = other.startMinute + other.durationMinutes;
      if (other.startMinute < blockEnd && block.startMinute < otherEnd) {
        const otherLayout = result.get(other.id)!;
        const maxTotal = Math.max(layout.totalCols, otherLayout.totalCols);
        layout.totalCols = maxTotal;
        otherLayout.totalCols = maxTotal;
      }
    }
  }

  return result;
}


// ── Shared inline styles ─────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13, border: `1px solid ${C.border}`,
  borderRadius: 6, outline: 'none', boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, appearance: 'auto' as const,
};

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#fff',
  background: C.primary, border: 'none', borderRadius: 6, cursor: 'pointer',
};

const btnDanger: React.CSSProperties = {
  ...btnPrimary, background: C.danger,
};

const btnGhost: React.CSSProperties = {
  padding: '8px 16px', fontSize: 13, fontWeight: 600, color: C.muted,
  background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 4,
};

const TASK_CATS_GLOBAL = ['TEACHING', 'ADMIN', 'DUTY', 'BREAK', 'OTHER'];
const TASK_COLORS_GLOBAL: Record<string, string> = { TEACHING: '#ef4444', ADMIN: '#3b82f6', DUTY: '#f97316', BREAK: '#22c55e', OTHER: '#6b7280' };

function EditTaskModal({ task, onClose, onSave, onDelete }: {
  task: { id: string; name: string; category: string; color: string; defaultDuration: number };
  onClose: () => void;
  onSave: (data: { name: string; category: string; color: string; defaultDuration: number }) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(task.name);
  const [category, setCategory] = useState(task.category);
  const [duration, setDuration] = useState(task.defaultDuration || 30);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 380, background: C.card, borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Edit Task</span>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: C.muted, width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesomeIcon icon={faXmark} style={{ fontSize: 12 }} />
          </button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>Name</label>
              <input autoFocus style={{ ...inputStyle, padding: '10px 12px', fontSize: 14 }} value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div style={{ width: 120 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>Duration</label>
              <select style={{ ...selectStyle, height: 42 }} value={duration} onChange={e => setDuration(Number(e.target.value))}>
                {DURATION_OPTIONS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>Category</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {TASK_CATS_GLOBAL.map(c => (
                <button key={c} onClick={() => setCategory(c)} style={{
                  flex: 1, padding: '8px 4px', fontSize: 11, fontWeight: 600, borderRadius: 8,
                  border: category === c ? 'none' : `1.5px solid ${C.border}`,
                  cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.15s',
                  background: category === c ? (TASK_COLORS_GLOBAL[c] || C.primary) : C.card,
                  color: category === c ? '#fff' : C.muted,
                }}>{c.toLowerCase()}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={onDelete} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: C.danger, fontSize: 12, fontWeight: 600,
            padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 5, opacity: 0.8,
          }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}
          >
            <FontAwesomeIcon icon={faTrash} /> Delete
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ padding: '9px 18px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.text, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => { if (name.trim()) onSave({ name: name.trim(), category, color: TASK_COLORS_GLOBAL[category] || '#6b7280', defaultDuration: duration }); }} disabled={!name.trim()} style={{
            padding: '9px 20px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: 'none',
            background: name.trim() ? C.primary : '#cbd5e1', color: '#fff', cursor: name.trim() ? 'pointer' : 'default',
          }}>Update</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ResourcePanel
// ══════════════════════════════════════════════════════════════════════════════

interface ResourcePanelProps {
  teachers: Teacher[];
  subjects: PlannerSubject[];
  tasks: PlannerTask[];
  classrooms: Classroom[];
  blocks: ScheduleBlock[];
  search: string;
  onSearchChange: (v: string) => void;
  onDragStart?: (data: { type: string; id: string }) => void;
  onDragEnd?: () => void;
  onEditResource?: (type: string, id?: string) => void;
  onAddTask?: (data: { name: string; category: string; color: string; defaultDuration?: number }) => void;
}

function ResourcePanel({ teachers, subjects, tasks, classrooms, blocks, search, onSearchChange, onDragStart: notifyDragStart, onDragEnd: notifyDragEnd, onEditResource, onAddTask }: ResourcePanelProps) {
  const [resourceMenu, setResourceMenu] = useState<{ type: string; id: string; name: string; x: number; y: number } | null>(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('ADMIN');
  const [newTaskDuration, setNewTaskDuration] = useState(30);
  const TASK_CATS = ['TEACHING', 'ADMIN', 'DUTY', 'BREAK', 'OTHER'];
  const TASK_COLORS: Record<string, string> = { TEACHING: '#ef4444', ADMIN: '#3b82f6', DUTY: '#f97316', BREAK: '#22c55e', OTHER: '#6b7280' };
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    teachers: true, subjects: true, tasks: true,
  });

  const toggle = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const q = search.toLowerCase();

  // Calculate remaining work hours per teacher per day
  const teacherDailyRemaining = useMemo(() => {
    const map = new Map<string, { daily: number; perDay: number[] }>();
    for (const t of teachers) {
      if (!t.isActive || t.workStartMinute == null || t.workEndMinute == null) continue;
      const dailyMinutes = t.workEndMinute - t.workStartMinute;
      const workDays = t.workDays ?? [0, 1, 2, 3, 4];
      const perDay: number[] = [];
      for (let d = 0; d < 5; d++) {
        if (!workDays.includes(d)) { perDay.push(0); continue; }
        const usedOnDay = blocks
          .filter(b => b.dayOfWeek === d && (
            b.teacherId === t.id || (b.assignedTeacherIds && b.assignedTeacherIds.includes(t.id))
          ))
          .reduce((sum, b) => sum + b.durationMinutes, 0);
        perDay.push(dailyMinutes - usedOnDay);
      }
      map.set(t.id, { daily: dailyMinutes, perDay });
    }
    return map;
  }, [teachers, blocks]);

  const filteredTeachers = teachers.filter(t => t.isActive && t.name.toLowerCase().includes(q));
  const filteredSubjects = subjects.filter(s => s.name.toLowerCase().includes(q));
  const filteredTasks = tasks.filter(t => t.name.toLowerCase().includes(q));

  const handleDragStart = (e: React.DragEvent, type: string, id: string, name: string, color: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ type, id, name, color }));
    e.dataTransfer.effectAllowed = 'copy';
    notifyDragStart?.({ type, id });
  };

  const handleDragEnd = () => { notifyDragEnd?.(); };

  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 12px', cursor: 'pointer', userSelect: 'none',
    borderBottom: `1px solid ${C.border}`, background: '#f8fafc',
  };

  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
    cursor: 'grab', borderBottom: `1px solid ${C.border}`, fontSize: 13,
    transition: 'background 0.15s',
  };

  return (
    <div style={{
      width: 260, minWidth: 260, background: C.card, borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Search */}
      <div style={{ padding: '12px 12px 8px' }}>
        <div style={{ position: 'relative' }}>
          <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 10, top: 10, color: C.muted, fontSize: 12 }} />
          <input
            style={{ ...inputStyle, paddingLeft: 30 }}
            placeholder="Search resources..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Teachers */}
        <div>
          <div style={sectionHeaderStyle} onClick={() => toggle('teachers')}>
            <span style={{ fontWeight: 700, fontSize: 12, color: C.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Teachers ({filteredTeachers.length})
            </span>
            <FontAwesomeIcon icon={expandedSections.teachers ? faChevronUp : faChevronDown} style={{ fontSize: 10, color: C.muted }} />
          </div>
          {expandedSections.teachers && filteredTeachers.map(t => {
            const info = teacherDailyRemaining.get(t.id);
            return (
            <div
              key={t.id}
              style={{ ...itemStyle, flexDirection: 'column', alignItems: 'stretch', gap: 3 }}
              draggable
              onDragStart={e => handleDragStart(e, 'teacher', t.id, t.name, t.color)}
              onDragEnd={handleDragEnd}
              onContextMenu={e => { e.preventDefault(); setResourceMenu({ type: 'teachers', id: t.id, name: t.name, x: e.clientX, y: e.clientY }); }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FontAwesomeIcon icon={faGripVertical} style={{ fontSize: 10, color: '#cbd5e1' }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                <span style={{ color: C.text, flex: 1 }}>{t.name}</span>
              </div>
              {info && (
                <div style={{ display: 'flex', gap: 2, marginLeft: 28 }}>
                  {DAYS.map((d, i) => {
                    const workDays = t.workDays ?? [0, 1, 2, 3, 4];
                    if (!workDays.includes(i)) return <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: '#d1d5db' }}>-</div>;
                    const rem = info.perDay[i];
                    const h = Math.floor(Math.abs(rem) / 60);
                    const m = Math.abs(rem) % 60;
                    const label = rem < 0 ? `-${h}${m ? `:${m.toString().padStart(2, '0')}` : ''}` : `${h}${m ? `:${m.toString().padStart(2, '0')}` : ''}`;
                    return (
                      <div key={i} style={{
                        flex: 1, textAlign: 'center', fontSize: 9, fontWeight: 600, borderRadius: 3, padding: '1px 0',
                        color: rem < 0 ? C.danger : rem === 0 ? C.success : C.muted,
                        background: rem < 0 ? hexToRgba(C.danger, 0.08) : rem === 0 ? hexToRgba(C.success, 0.08) : 'transparent',
                      }}>
                        <div style={{ fontSize: 8, fontWeight: 400, color: '#94a3b8' }}>{d.slice(0, 1)}</div>
                        {label}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            );
          })}
        </div>

        {/* Subjects */}
        <div>
          <div style={sectionHeaderStyle} onClick={() => toggle('subjects')}>
            <span style={{ fontWeight: 700, fontSize: 12, color: C.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Subjects ({filteredSubjects.length})
            </span>
            <FontAwesomeIcon icon={expandedSections.subjects ? faChevronUp : faChevronDown} style={{ fontSize: 10, color: C.muted }} />
          </div>
          {expandedSections.subjects && filteredSubjects.map(s => {
            const activeClasses = classrooms.filter(c => c.isActive);
            const cl = s.classLessons || {};
            const hasTargets = Object.keys(cl).length > 0 || (s.lessonsPerWeek != null && activeClasses.length > 0);
            return (
            <div
              key={s.id}
              style={{ ...itemStyle, flexDirection: 'column', alignItems: 'stretch', gap: 3 }}
              draggable
              onDragStart={e => handleDragStart(e, 'subject', s.id, s.name, s.color)}
              onDragEnd={handleDragEnd}
              onContextMenu={e => { e.preventDefault(); setResourceMenu({ type: 'subjects', id: s.id, name: s.name, x: e.clientX, y: e.clientY }); }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FontAwesomeIcon icon={faGripVertical} style={{ fontSize: 10, color: '#cbd5e1' }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                <span style={{ color: C.text, flex: 1 }}>{s.name}</span>
                {s.defaultDuration && (
                  <span style={{ fontSize: 9, color: C.muted }}>{s.defaultDuration}m</span>
                )}
              </div>
              {hasTargets && (
                <div style={{ display: 'flex', gap: 3, marginLeft: 28, flexWrap: 'wrap' }}>
                  {activeClasses.map(cls => {
                    const target = cl[cls.id] ?? s.lessonsPerWeek;
                    if (target == null || target === 0) return null;
                    const count = blocks.filter(b => b.subjectId === s.id && b.classroomId === cls.id).length;
                    const isFull = count >= target;
                    const isOver = count > target;
                    return (
                      <span key={cls.id} style={{
                        fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
                        color: isOver ? C.danger : isFull ? C.success : C.muted,
                        background: isOver ? hexToRgba(C.danger, 0.08) : isFull ? hexToRgba(C.success, 0.08) : '#f8fafc',
                      }}>
                        {cls.name} {count}/{target}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            );
          })}
        </div>

        {/* Tasks */}
        <div>
          <div style={sectionHeaderStyle} onClick={() => toggle('tasks')}>
            <span style={{ fontWeight: 700, fontSize: 12, color: C.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Tasks ({filteredTasks.length})
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={e => { e.stopPropagation(); setAddTaskOpen(true); setNewTaskName(''); setNewTaskCategory('ADMIN'); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.primary, fontSize: 12, padding: '2px 4px' }}
              >
                <FontAwesomeIcon icon={faPlus} />
              </button>
              <FontAwesomeIcon icon={expandedSections.tasks ? faChevronUp : faChevronDown} style={{ fontSize: 10, color: C.muted }} />
            </div>
          </div>
          {expandedSections.tasks && filteredTasks.map(t => (
            <div
              key={t.id}
              style={itemStyle}
              draggable
              onDragStart={e => handleDragStart(e, 'task', t.id, t.name, t.color)}
              onDragEnd={handleDragEnd}
              onContextMenu={e => { e.preventDefault(); setResourceMenu({ type: 'tasks', id: t.id, name: t.name, x: e.clientX, y: e.clientY }); }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <FontAwesomeIcon icon={faGripVertical} style={{ fontSize: 10, color: '#cbd5e1' }} />
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                background: hexToRgba(t.color, 0.15), color: t.color,
              }}>
                {t.category}
              </span>
              <span style={{ color: C.text }}>{t.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Add task modal */}
      {addTaskOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}
          onClick={e => { if (e.target === e.currentTarget) setAddTaskOpen(false); }}>
          <div style={{ width: 360, background: C.card, borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>New Task</span>
              <button onClick={() => setAddTaskOpen(false)} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: C.muted, width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesomeIcon icon={faXmark} style={{ fontSize: 12 }} />
              </button>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 3, display: 'block' }}>Name</label>
                <input
                  autoFocus style={{ ...inputStyle, padding: '10px 12px', fontSize: 14 }}
                  value={newTaskName} onChange={e => setNewTaskName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newTaskName.trim()) { onAddTask?.({ name: newTaskName.trim(), category: newTaskCategory, color: TASK_COLORS[newTaskCategory], defaultDuration: newTaskDuration }); setAddTaskOpen(false); } }}
                  placeholder="Task name"
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 3, display: 'block' }}>Category</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {TASK_CATS.map(c => (
                    <button key={c} onClick={() => setNewTaskCategory(c)} style={{
                      padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: newTaskCategory === c ? TASK_COLORS[c] : '#f1f5f9',
                      color: newTaskCategory === c ? '#fff' : C.muted, textTransform: 'capitalize',
                    }}>{c.toLowerCase()}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 3, display: 'block' }}>Default Duration</label>
                <select style={selectStyle} value={newTaskDuration} onChange={e => setNewTaskDuration(Number(e.target.value))}>
                  {DURATION_OPTIONS.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setAddTaskOpen(false)} style={btnGhost}>Cancel</button>
              <button
                onClick={() => { if (newTaskName.trim()) { onAddTask?.({ name: newTaskName.trim(), category: newTaskCategory, color: TASK_COLORS[newTaskCategory], defaultDuration: newTaskDuration }); setAddTaskOpen(false); } }}
                style={{ ...btnPrimary, opacity: newTaskName.trim() ? 1 : 0.5 }}
                disabled={!newTaskName.trim()}
              >Add Task</button>
            </div>
          </div>
        </div>
      )}

      {/* Resource context menu */}
      {resourceMenu && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 999 }}
          onClick={() => setResourceMenu(null)}
          onContextMenu={e => { e.preventDefault(); setResourceMenu(null); }}
        >
          <div style={{
            position: 'absolute', top: resourceMenu.y, left: resourceMenu.x,
            background: C.card, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            border: `1px solid ${C.border}`, overflow: 'hidden', minWidth: 140,
          }}>
            <button
              onClick={() => {
                onEditResource?.(resourceMenu.type, resourceMenu.id);
                setResourceMenu(null);
              }}
              style={{
                width: '100%', padding: '10px 16px', border: 'none', background: 'none',
                cursor: 'pointer', textAlign: 'left', fontSize: 13, color: C.text,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <FontAwesomeIcon icon={faPen} style={{ fontSize: 11, color: C.muted }} />
              Edit {resourceMenu.type === 'teachers' ? 'Teachers' : resourceMenu.type === 'subjects' ? 'Subjects' : 'Tasks'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// WeekNavigator
// ══════════════════════════════════════════════════════════════════════════════

interface WeekHeaderProps {
  onSave: () => void;
  onLoad: (id: string) => void;
  onNew: () => void;
  onDelete: () => void;
  onClearAll: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  savedTimetables: SavedTimetable[];
  currentTimetableId: string | null;
  currentTimetableName: string | null;
  saving?: boolean;
  onExport?: () => void;
}

function WeekHeader({ onSave, onLoad, onNew, onDelete, onClearAll, onUndo, onRedo, canUndo, canRedo, savedTimetables, currentTimetableId, currentTimetableName, saving, onExport }: WeekHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: C.card,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
          Weekly Timetable
        </span>
        {currentTimetableName && (
          <span style={{ fontSize: 12, color: C.primary, background: C.primaryLight, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
            {currentTimetableName}
          </span>
        )}
        {!currentTimetableId && (
          <span style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}>Unsaved</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" style={{ ...btnGhost, padding: '6px 10px', opacity: canUndo ? 1 : 0.3 }}>
          <FontAwesomeIcon icon={faRotateLeft} />
        </button>
        <button onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)" style={{ ...btnGhost, padding: '6px 10px', opacity: canRedo ? 1 : 0.3 }}>
          <FontAwesomeIcon icon={faRotateRight} />
        </button>
        <div style={{ width: 1, height: 20, background: C.border, margin: '0 4px' }} />
        <button onClick={onNew} style={{ ...btnGhost, display: 'flex', alignItems: 'center', gap: 6 }}>
          <FontAwesomeIcon icon={faPlus} />
          New
        </button>
        <button onClick={onClearAll} style={{ ...btnGhost, color: C.danger, display: 'flex', alignItems: 'center', gap: 6 }}>
          <FontAwesomeIcon icon={faTrash} />
          Clear All
        </button>
        <button onClick={onSave} disabled={saving} style={{ ...btnGhost, display: 'flex', alignItems: 'center', gap: 6 }}>
          <FontAwesomeIcon icon={faSave} />
          {saving ? 'Saving...' : 'Save'}
        </button>
        {currentTimetableId && (
          <button onClick={onDelete} style={{ ...btnGhost, color: C.danger, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FontAwesomeIcon icon={faTrash} />
            Delete
          </button>
        )}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button onClick={() => setDropdownOpen(!dropdownOpen)} style={{ ...btnGhost, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FontAwesomeIcon icon={faFolderOpen} />
            Load
            <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 10 }} />
          </button>
          {dropdownOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4,
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 220, zIndex: 100,
              maxHeight: 300, overflowY: 'auto',
            }}>
              {savedTimetables.length === 0 ? (
                <div style={{ padding: '12px 16px', color: C.muted, fontSize: 12 }}>No saved timetables</div>
              ) : (
                savedTimetables.map(t => (
                  <div
                    key={t.id}
                    onClick={() => { onLoad(t.id); setDropdownOpen(false); }}
                    style={{
                      padding: '10px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderBottom: `1px solid ${C.border}`, fontSize: 13,
                      background: t.id === currentTimetableId ? C.primaryLight : 'transparent',
                    }}
                    onMouseEnter={e => { if (t.id !== currentTimetableId) e.currentTarget.style.background = C.primaryLight; }}
                    onMouseLeave={e => { if (t.id !== currentTimetableId) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: C.text }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{new Date(t.updatedAt).toLocaleDateString()}</div>
                    </div>
                    {t.id === currentTimetableId && (
                      <FontAwesomeIcon icon={faCheck} style={{ color: C.primary, fontSize: 12 }} />
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        {onExport && (
          <button onClick={onExport} style={{ ...btnGhost, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FontAwesomeIcon icon={faFileExport} />
            Export
          </button>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ViewModeSelector
// ══════════════════════════════════════════════════════════════════════════════

type ViewMode = 'classroom' | 'teacher' | 'task';

interface ViewModeSelectorProps {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}

function ViewModeSelector({ mode, onChange }: ViewModeSelectorProps) {
  const items: Array<{ key: ViewMode; label: string; icon: typeof faSchool }> = [
    { key: 'classroom', label: 'Class', icon: faSchool },
    { key: 'teacher', label: 'Teacher', icon: faChalkboardTeacher },
    { key: 'task', label: 'Task', icon: faListCheck },
  ];

  return (
    <div style={{ display: 'flex', gap: 4, padding: '8px 16px', background: C.card, borderBottom: `1px solid ${C.border}` }}>
      {items.map(it => (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6,
            border: mode === it.key ? `1px solid ${C.primary}` : `1px solid transparent`,
            background: mode === it.key ? C.primaryLight : 'transparent',
            color: mode === it.key ? C.primary : C.muted,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <FontAwesomeIcon icon={it.icon} style={{ fontSize: 11 }} />
          {it.label}
        </button>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TimetableGrid
// ══════════════════════════════════════════════════════════════════════════════

interface TimetableGridProps {
  weekDate: string;
  blocks: ScheduleBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string) => void;
  onContextMenu?: (blockId: string, x: number, y: number) => void;
  onCellClick: (dayOfWeek: number, startMinute: number, x: number, y: number) => void;
  onDropOnCell: (dayOfWeek: number, startMinute: number, data: string, classroomId?: string) => void;
  dropAllowed?: boolean;
  activeClass?: Classroom | null;
  allClasses?: Classroom[];
  draggingTeacherId?: string | null;
  draggingData?: { type: string; id: string } | null;
  onDragDataChange?: (data: { type: string; id: string } | null) => void;
  teachers?: Teacher[];
}

function TimetableGrid({ weekDate, blocks, selectedBlockId, onSelectBlock, onContextMenu, onCellClick, onDropOnCell, dropAllowed = true, activeClass, allClasses, draggingTeacherId, draggingData, onDragDataChange, teachers: allTeachers }: TimetableGridProps) {
  const slots = useMemo(() => generateTimeSlots(), []);
  const totalHeight = slots.length * ROW_HEIGHT;
  const [blockDragReady, setBlockDragReady] = useState(false);
  const [dragConflictBlockId, setDragConflictBlockId] = useState<string | null>(null);
  const [dragConflictReason, setDragConflictReason] = useState<string>('');

  useEffect(() => {
    if (draggingData?.type === 'block') {
      const timer = setTimeout(() => setBlockDragReady(true), 150);
      return () => clearTimeout(timer);
    }
    setBlockDragReady(false);
  }, [draggingData]);

  const handleDragOver = (e: React.DragEvent) => {
    if (!dropAllowed && !(draggingData?.type === 'block')) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    // In All view with class columns, don't allow teacher/subject drops on the grid body (white space)
    if (!activeClass && allClasses.length > 0 && (draggingData?.type === 'teacher' || draggingData?.type === 'subject')) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = draggingData?.type === 'block' ? 'move' : 'copy';
  };

  const getCellFromEvent = (e: React.DragEvent | React.MouseEvent, dayIdx: number): { dayOfWeek: number; startMinute: number } => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const slotIdx = Math.floor(y / ROW_HEIGHT);
    const startMinute = DAY_START + slotIdx * SLOT_DURATION;
    return { dayOfWeek: dayIdx, startMinute: Math.max(DAY_START, Math.min(startMinute, DAY_END - SLOT_DURATION)) };
  };

  // Group blocks by day
  const blocksByDay = useMemo(() => {
    const map: Record<number, ScheduleBlock[]> = {};
    for (let d = 0; d < 5; d++) map[d] = [];
    blocks.forEach(b => {
      if (map[b.dayOfWeek]) map[b.dayOfWeek].push(b);
    });
    return map;
  }, [blocks]);

  // Current time indicator

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', minWidth: TIME_COL_WIDTH + 5 * 180 }}>
        {/* Time column */}
        <div style={{ width: TIME_COL_WIDTH, minWidth: TIME_COL_WIDTH, flexShrink: 0 }}>
          {/* header spacer */}
          <div style={{ height: 48, borderBottom: `1px solid ${C.border}`, background: C.card }} />
          {/* time labels */}
          <div style={{ position: 'relative' }}>
            {slots.map((m, i) => (
              <div
                key={m}
                style={{
                  height: ROW_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                  paddingRight: 8, fontSize: 11, color: C.muted, borderBottom: `1px solid ${i % 2 === 1 ? C.border : '#f1f5f9'}`,
                  background: i % 2 === 0 ? '#fafbfc' : C.card,
                }}
              >
                {m % 60 === 0 ? minutesToTime(m) : ''}
              </div>
            ))}
          </div>
        </div>

        {/* Day columns */}
        {DAYS.map((dayName, dayIdx) => {
          return (
            <div key={dayIdx} style={{ flex: 1, minWidth: 180 }}>
              {/* Day header */}
              {/* Day header */}
              <div style={{
                height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}`,
                background: C.card,
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{dayName}</span>
              </div>

              {/* Grid body */}
              <div
                style={{ position: 'relative', borderLeft: `1px solid ${C.border}` }}
                onDragOver={handleDragOver}
                onDrop={e => {
                  e.preventDefault();
                  const cell = getCellFromEvent(e, dayIdx);
                  const data = e.dataTransfer.getData('text/plain');
                  onDropOnCell(cell.dayOfWeek, cell.startMinute, data);
                }}
                onClick={() => { onSelectBlock(''); }}
                onContextMenu={e => {
                  if (e.target === e.currentTarget || (e.target as HTMLElement).dataset?.slot) {
                    e.preventDefault();
                    const cell = getCellFromEvent(e, dayIdx);
                    onCellClick(cell.dayOfWeek, cell.startMinute, e.clientX, e.clientY);
                  }
                }}
              >
                {/* Slot backgrounds */}
                {slots.map((m, i) => {
                  const isClassTime = activeClass
                    && activeClass.startMinute != null && activeClass.endMinute != null
                    && activeClass.daysOfWeek?.includes(dayIdx)
                    && m >= activeClass.startMinute && m < activeClass.endMinute;
                  return (
                    <div
                      key={m}
                      data-slot="true"
                      style={{
                        height: ROW_HEIGHT, borderBottom: `1px solid ${i % 2 === 1 ? C.border : '#f1f5f9'}`,
                        background: isClassTime ? hexToRgba(C.primary, 0.06) : (i % 2 === 0 ? '#fafbfc' : C.card),
                      }}
                    />
                  );
                })}

                {/* Class time range backgrounds (All view) — interactive drop targets */}
                {allClasses && allClasses.length > 0 && (() => {
                  const dayClasses = allClasses
                    .filter(c => c.isActive && c.startMinute != null && c.endMinute != null && c.daysOfWeek?.includes(dayIdx))
                    .sort((a, b) => a.startMinute! - b.startMinute! || a.name.localeCompare(b.name));
                  if (dayClasses.length === 0) return null;

                  const classLayout = layoutBlocks(dayClasses.map(c => ({
                    id: c.id, startMinute: c.startMinute!, durationMinutes: c.endMinute! - c.startMinute!,
                    weekDate: '', dayOfWeek: 0, teacherId: '', subjectId: null, taskId: null, classroomId: null, notes: null,
                    teacher: { id: '', name: '', color: '' }, subject: null, task: null, classroom: null, assignedTeacherIds: null,
                  })));

                  // Check if there are task/non-class blocks for this day
                  const dayBlks = blocksByDay[dayIdx] || [];
                  const hasTaskBlocks = dayBlks.some(b => !b.classroomId);
                  const bgScale = hasTaskBlocks ? 0.85 : 1;

                  return dayClasses.map(cls => {
                    const top = ((cls.startMinute! - DAY_START) / SLOT_DURATION) * ROW_HEIGHT;
                    const height = ((cls.endMinute! - cls.startMinute!) / SLOT_DURATION) * ROW_HEIGHT;
                    const pos = classLayout.get(cls.id) || { col: 0, totalCols: 1 };
                    const colWidth = (100 / pos.totalCols) * bgScale;
                    const leftPct = (pos.col * (100 / pos.totalCols)) * bgScale;

                    // Check if dragging teacher/block is allowed in this class
                    const teacherAllowed = (() => {
                      if (!draggingData || !allTeachers) return true;
                      let teacherId: string | null = null;
                      if (draggingData.type === 'teacher') {
                        teacherId = draggingData.id;
                      } else if (draggingData.type === 'block') {
                        const draggedBlock = blocks.find(b => b.id === draggingData.id);
                        teacherId = draggedBlock?.teacherId || null;
                      }
                      if (!teacherId) return true;
                      const teacher = allTeachers.find(t => t.id === teacherId);
                      if (!teacher) return true;
                      if (!teacher.allowedClassroomIds || teacher.allowedClassroomIds.length === 0) return true;
                      return teacher.allowedClassroomIds.includes(cls.id);
                    })();

                    return (
                      <div
                        key={cls.id}
                        onDragOver={e => {
                          e.stopPropagation();
                          // Tasks don't belong in class columns
                          if (draggingData?.type === 'task') return;
                          if (!teacherAllowed) return;
                          // For sidebar teacher drags, check if there's an existing subject block the teacher can't teach
                          if (draggingData?.type === 'teacher') {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const y = e.clientY - rect.top;
                            const slotIdx = Math.floor(y / ROW_HEIGHT);
                            const hoverStart = cls.startMinute! + slotIdx * SLOT_DURATION;
                            const existingSubjectBlock = blocks.find(b =>
                              b.classroomId === cls.id && b.dayOfWeek === dayIdx && b.subjectId
                              && b.startMinute <= hoverStart && hoverStart < b.startMinute + b.durationMinutes
                            );
                            if (existingSubjectBlock?.subjectId) {
                              const teacher = allTeachers?.find(t => t.id === draggingData.id);
                              if (teacher?.allowedSubjectIds?.length && !teacher.allowedSubjectIds.includes(existingSubjectBlock.subjectId)) {
                                return; // teacher can't teach this subject — don't allow drop
                              }
                            }
                          }
                          // For block drags, check teacher time overlap AND class time overlap
                          if (draggingData?.type === 'block') {
                            const draggedBlk = blocks.find(b => b.id === draggingData.id);
                            if (draggedBlk) {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const y = e.clientY - rect.top;
                              const slotIdx = Math.floor(y / ROW_HEIGHT);
                              const hoverStart = cls.startMinute! + slotIdx * SLOT_DURATION;
                              const hoverEnd = hoverStart + draggedBlk.durationMinutes;
                              // Check teacher time conflict
                              if (draggedBlk.teacherId) {
                                const teacherConflict = blocks.find(b =>
                                  b.id !== draggedBlk.id
                                  && b.teacherId === draggedBlk.teacherId
                                  && b.dayOfWeek === dayIdx
                                  && b.startMinute < hoverEnd
                                  && hoverStart < b.startMinute + b.durationMinutes
                                );
                                if (teacherConflict) {
                                  setDragConflictBlockId(teacherConflict.id);
                                  setDragConflictReason(`Overlaps with ${teacherConflict.teacher?.name || 'another block'}`);
                                  return;
                                }
                              }
                              // Check class time conflict
                              const classConflict = blocks.find(b =>
                                b.id !== draggedBlk.id
                                && b.classroomId === cls.id
                                && b.dayOfWeek === dayIdx
                                && b.startMinute < hoverEnd
                                && hoverStart < b.startMinute + b.durationMinutes
                              );
                              if (classConflict) {
                                setDragConflictBlockId(classConflict.id);
                                setDragConflictReason('Time slot occupied');
                                return;
                              }
                              setDragConflictBlockId(null);
                            }
                          }
                          e.preventDefault();
                          e.dataTransfer.dropEffect = draggingData?.type === 'block' ? 'move' : 'copy';
                        }}
                        onDrop={e => {
                          e.stopPropagation();
                          if (!teacherAllowed) return;
                          // Don't allow tasks in class columns
                          try { const d = JSON.parse(e.dataTransfer.getData('text/plain')); if (d.type === 'task') return; } catch {}
                          e.preventDefault();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const y = e.clientY - rect.top;
                          const slotIdx = Math.floor(y / ROW_HEIGHT);
                          const startMinute = cls.startMinute! + slotIdx * SLOT_DURATION;
                          const dropStart = Math.max(cls.startMinute!, Math.min(startMinute, cls.endMinute! - SLOT_DURATION));
                          const data = e.dataTransfer.getData('text/plain');
                          // Validate teacher-subject compatibility on drop
                          try {
                            const d = JSON.parse(data);
                            if (d.type === 'teacher') {
                              const existingSubjectBlock = blocks.find(b =>
                                b.classroomId === cls.id && b.dayOfWeek === dayIdx && b.subjectId
                                && b.startMinute <= dropStart && dropStart < b.startMinute + b.durationMinutes
                              );
                              if (existingSubjectBlock?.subjectId) {
                                const teacher = allTeachers?.find(t => t.id === d.id);
                                if (teacher?.allowedSubjectIds?.length && !teacher.allowedSubjectIds.includes(existingSubjectBlock.subjectId)) {
                                  return; // teacher can't teach this subject
                                }
                              }
                            }
                          } catch {}
                          // Final overlap check for block moves
                          try {
                            const d = JSON.parse(data);
                            if (d.type === 'block') {
                              const draggedBlk = blocks.find(b => b.id === d.id);
                              if (draggedBlk) {
                                const dropEnd = dropStart + draggedBlk.durationMinutes;
                                // Teacher overlap
                                if (draggedBlk.teacherId) {
                                  const teacherOverlap = blocks.some(b =>
                                    b.id !== draggedBlk.id
                                    && b.teacherId === draggedBlk.teacherId
                                    && b.dayOfWeek === dayIdx
                                    && b.startMinute < dropEnd
                                    && dropStart < b.startMinute + b.durationMinutes
                                  );
                                  if (teacherOverlap) return;
                                }
                                // Class overlap
                                const classOverlap = blocks.some(b =>
                                  b.id !== draggedBlk.id
                                  && b.classroomId === cls.id
                                  && b.dayOfWeek === dayIdx
                                  && b.startMinute < dropEnd
                                  && dropStart < b.startMinute + b.durationMinutes
                                );
                                if (classOverlap) return;
                              }
                            }
                          } catch {}
                          onDropOnCell(dayIdx, dropStart, data, cls.id);
                        }}
                        onContextMenu={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const y = e.clientY - rect.top;
                          const slotIdx = Math.floor(y / ROW_HEIGHT);
                          const startMinute = cls.startMinute! + slotIdx * SLOT_DURATION;
                          onCellClick(dayIdx, Math.max(cls.startMinute!, Math.min(startMinute, cls.endMinute! - SLOT_DURATION)), e.clientX, e.clientY);
                        }}
                        style={{
                          position: 'absolute', top, height,
                          left: `calc(${leftPct}% + 2px)`, width: `calc(${colWidth}% - 4px)`,
                          background: draggingData
                            ? (teacherAllowed ? hexToRgba(C.success, 0.06) : hexToRgba(C.danger, 0.06))
                            : hexToRgba(C.primary, 0.04),
                          border: draggingData
                            ? (teacherAllowed ? `1px dashed ${hexToRgba(C.success, 0.3)}` : `1px dashed ${hexToRgba(C.danger, 0.3)}`)
                            : `1px dashed ${hexToRgba(C.primary, 0.2)}`,
                          borderRadius: 4,
                          zIndex: 1,
                          cursor: draggingData ? (teacherAllowed ? 'copy' : 'not-allowed') : 'default',
                          pointerEvents: draggingData ? 'auto' : 'none',
                        }}
                      >
                      </div>
                    );
                  });
                })()}



                {/* Blocks */}
                {(() => {
                  const dayBlocks = blocksByDay[dayIdx] || [];

                  // If allClasses are shown, position blocks within their class column
                  // Build class column layout map: classId -> { left%, width% }
                  let classColMap: Map<string, { leftPct: number; widthPct: number }> | null = null;
                  if (allClasses && allClasses.length > 0) {
                    const dayClasses = allClasses
                      .filter(c => c.isActive && c.startMinute != null && c.endMinute != null && c.daysOfWeek?.includes(dayIdx))
                      .sort((a, b) => a.startMinute! - b.startMinute! || a.name.localeCompare(b.name));
                    if (dayClasses.length > 0) {
                      const clsLayout = layoutBlocks(dayClasses.map(c => ({
                        id: c.id, startMinute: c.startMinute!, durationMinutes: c.endMinute! - c.startMinute!,
                        weekDate: '', dayOfWeek: 0, teacherId: '', subjectId: null, taskId: null, classroomId: null, notes: null,
                        teacher: { id: '', name: '', color: '' }, subject: null, task: null, classroom: null, assignedTeacherIds: null,
                      })));
                      classColMap = new Map();
                      for (const cls of dayClasses) {
                        const pos = clsLayout.get(cls.id) || { col: 0, totalCols: 1 };
                        const w = 100 / pos.totalCols;
                        classColMap.set(cls.id, { leftPct: pos.col * w, widthPct: w });
                      }
                    }
                  }

                  // For blocks without class columns, use overlap layout
                  const noClassBlocks = dayBlocks.filter(b => !classColMap || !b.classroomId || !classColMap.has(b.classroomId));
                  const layout = layoutBlocks(noClassBlocks);
                  const hasTaskCol = classColMap && noClassBlocks.length > 0;
                  // If we have both class columns and task blocks, scale class columns to leave room for task column
                  const classScale = hasTaskCol ? 0.85 : 1;
                  const taskLeft = hasTaskCol ? 85 : 0;
                  const taskWidth = hasTaskCol ? 15 : 100;

                  return dayBlocks.map(block => {
                    const top = ((block.startMinute - DAY_START) / SLOT_DURATION) * ROW_HEIGHT;
                    const height = (block.durationMinutes / SLOT_DURATION) * ROW_HEIGHT;
                    const isTask = !!block.task && !block.subject;
                    const blockColor = block.subject?.color || block.task?.color || block.teacher?.color || C.muted;
                    const hasConflict = block.conflicts && block.conflicts.length > 0;
                    const isSelected = block.id === selectedBlockId;

                    // Position within class column if available
                    let leftStyle: string;
                    let widthStyle: string;
                    if (classColMap && block.classroomId && classColMap.has(block.classroomId)) {
                      const cc = classColMap.get(block.classroomId)!;
                      leftStyle = `calc(${cc.leftPct * classScale}% + 4px)`;
                      widthStyle = `calc(${cc.widthPct * classScale}% - 8px)`;
                    } else if (hasTaskCol) {
                      const pos = layout.get(block.id) || { col: 0, totalCols: 1 };
                      const colWidth = taskWidth / pos.totalCols;
                      leftStyle = `calc(${taskLeft + pos.col * colWidth}% + 2px)`;
                      widthStyle = `calc(${colWidth}% - 4px)`;
                    } else {
                      const pos = layout.get(block.id) || { col: 0, totalCols: 1 };
                      const colWidth = 100 / pos.totalCols;
                      leftStyle = `calc(${pos.col * colWidth}% + 2px)`;
                      widthStyle = `calc(${colWidth}% - 4px)`;
                    }

                    // Check if dragging resource can be dropped onto this block
                    let blockDropAllowed = true;
                    let blockDropReason = '';
                    if (draggingData) {
                      if (draggingData.type === 'teacher') {
                        const teacher = allTeachers?.find(t => t.id === draggingData.id);
                        if (block.teacherId && block.subjectId) {
                          // Has both — allow swap if teacher can teach the subject and class
                          if (block.classroomId && teacher?.allowedClassroomIds?.length && !teacher.allowedClassroomIds.includes(block.classroomId)) {
                            blockDropAllowed = false;
                            blockDropReason = `${teacher.name} cannot teach in ${block.classroom?.name || 'this class'}`;
                          } else if (teacher?.allowedSubjectIds?.length && !teacher.allowedSubjectIds.includes(block.subjectId)) {
                            blockDropAllowed = false;
                            blockDropReason = `${teacher.name} cannot teach ${block.subject?.name}`;
                          }
                          // else: allowed — will swap teacher
                        } else if (block.classroomId && teacher?.allowedClassroomIds?.length && !teacher.allowedClassroomIds.includes(block.classroomId)) {
                          blockDropAllowed = false;
                          blockDropReason = `${teacher.name} cannot teach in ${block.classroom?.name || 'this class'}`;
                        } else if (block.subjectId && teacher?.allowedSubjectIds?.length && !teacher.allowedSubjectIds.includes(block.subjectId)) {
                          blockDropAllowed = false;
                          blockDropReason = `${teacher.name} cannot teach ${block.subject?.name}`;
                        }
                      } else if (draggingData.type === 'subject') {
                        // Only check if block has a teacher — can that teacher teach the dragged subject?
                        if (block.teacherId) {
                          const teacher = allTeachers?.find(t => t.id === block.teacherId);
                          if (teacher?.allowedSubjectIds?.length && !teacher.allowedSubjectIds.includes(draggingData.id)) {
                            blockDropAllowed = false;
                            blockDropReason = `${teacher.name} cannot teach this subject`;
                          }
                        }
                        // If block has no teacher, always allow subject assignment
                        // If block already has a subject and no teacher, allow swap
                      } else if (draggingData.type === 'block') {
                        const draggedBlk = blocks.find(b => b.id === draggingData.id);
                        if (draggedBlk && draggedBlk.id !== block.id) {
                          const dragHasTeacherOnly = draggedBlk.teacherId && !draggedBlk.subjectId && !draggedBlk.taskId;
                          const targetHasSubjectOnly = block.subjectId && !block.teacherId;
                          const dragHasSubjectOnly = draggedBlk.subjectId && !draggedBlk.teacherId;
                          const targetHasTeacherOnly = block.teacherId && !block.subjectId && !block.taskId;

                          // Swap validation — each teacher keeps their own subject, only check class constraints
                          if (draggedBlk.teacherId && block.classroomId) {
                            const dt = allTeachers?.find(t => t.id === draggedBlk.teacherId);
                            if (dt?.allowedClassroomIds?.length && !dt.allowedClassroomIds.includes(block.classroomId)) {
                              blockDropAllowed = false;
                              blockDropReason = `${dt.name} cannot teach in ${block.classroom?.name || 'this class'}`;
                            }
                          }
                          if (blockDropAllowed && block.teacherId && draggedBlk.classroomId) {
                            const bt = allTeachers?.find(t => t.id === block.teacherId);
                            if (bt?.allowedClassroomIds?.length && !bt.allowedClassroomIds.includes(draggedBlk.classroomId)) {
                              blockDropAllowed = false;
                              blockDropReason = `${bt.name} cannot teach in ${draggedBlk.classroom?.name || 'that class'}`;
                            }
                          }
                        }
                      } else if (draggingData.type === 'task') {
                        if (block.subjectId || block.taskId) {
                          blockDropAllowed = false;
                          blockDropReason = 'Already has a subject/task';
                        }
                      }
                    }
                    const isDragHover = (!!draggingData && !blockDropAllowed) || (dragConflictBlockId === block.id);
                    if (dragConflictBlockId === block.id && !blockDropReason) {
                      blockDropReason = dragConflictReason;
                    }

                    return (
                      <div
                        key={block.id}
                        draggable
                        onDragStart={e => {
                          e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'block', id: block.id }));
                          e.dataTransfer.effectAllowed = 'move';
                          onDragDataChange?.({ type: 'block', id: block.id });
                        }}
                        onDragEnd={() => {
                          onDragDataChange?.(null);
                          setDragConflictBlockId(null);
                        }}
                        onDragOver={e => {
                          if (!draggingData) return;
                          if (draggingData.type === 'block') {
                            e.stopPropagation();
                            const draggedBlk = blocks.find(b => b.id === draggingData.id);
                            if (!draggedBlk) return;
                            // Allow dropping on self (repositioning) — check overlaps first
                            if (draggedBlk.id === block.id) {
                              const gridBody = (e.currentTarget as HTMLElement).parentElement;
                              if (gridBody) {
                                const rect = gridBody.getBoundingClientRect();
                                const y = e.clientY - rect.top;
                                const slotIdx = Math.floor(y / ROW_HEIGHT);
                                const newStart = Math.max(DAY_START, DAY_START + slotIdx * SLOT_DURATION);
                                const newEnd = newStart + block.durationMinutes;
                                const teacherConflict = block.teacherId ? blocks.find(b =>
                                  b.id !== block.id && b.teacherId === block.teacherId && b.dayOfWeek === block.dayOfWeek
                                  && b.startMinute < newEnd && newStart < b.startMinute + b.durationMinutes
                                ) : null;
                                const classConflict = block.classroomId ? blocks.find(b =>
                                  b.id !== block.id && b.classroomId === block.classroomId && b.dayOfWeek === block.dayOfWeek
                                  && b.startMinute < newEnd && newStart < b.startMinute + b.durationMinutes
                                ) : null;
                                const conflict = teacherConflict || classConflict;
                                if (conflict) {
                                  const reason = teacherConflict
                                    ? `Overlaps with ${teacherConflict.teacher?.name || 'another block'}`
                                    : `Time slot occupied`;
                                  setDragConflictBlockId(conflict.id);
                                  setDragConflictReason(reason);
                                  return;
                                }
                              }
                              setDragConflictBlockId(null);
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              return;
                            }

                            // Swap: each teacher keeps their own subject, only check class constraints
                            if (draggedBlk.teacherId && block.classroomId) {
                              const dt = allTeachers?.find(t => t.id === draggedBlk.teacherId);
                              if (dt?.allowedClassroomIds?.length && !dt.allowedClassroomIds.includes(block.classroomId)) return;
                            }
                            if (block.teacherId && draggedBlk.classroomId) {
                              const bt = allTeachers?.find(t => t.id === block.teacherId);
                              if (bt?.allowedClassroomIds?.length && !bt.allowedClassroomIds.includes(draggedBlk.classroomId)) return;
                            }
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            return;
                          }
                          e.stopPropagation();
                          if (!blockDropAllowed) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'copy';
                        }}
                        onDrop={e => {
                          const rawData = e.dataTransfer.getData('text/plain');
                          try {
                            const d = JSON.parse(rawData);
                            if (d.type === 'block') {
                              e.stopPropagation();
                              e.preventDefault();
                              if (d.id === block.id) {
                                // Self-drop: reposition based on cursor
                                const gridBody = e.currentTarget.parentElement;
                                if (gridBody) {
                                  const rect = gridBody.getBoundingClientRect();
                                  const y = e.clientY - rect.top;
                                  const slotIdx = Math.floor(y / ROW_HEIGHT);
                                  const newStart = Math.max(DAY_START, DAY_START + slotIdx * SLOT_DURATION);
                                  const newEnd = newStart + block.durationMinutes;
                                  // Check overlap with other blocks of same teacher OR same class
                                  const hasTeacherOverlap = block.teacherId && blocks.some(b =>
                                    b.id !== block.id
                                    && b.teacherId === block.teacherId
                                    && b.dayOfWeek === block.dayOfWeek
                                    && b.startMinute < newEnd
                                    && newStart < b.startMinute + b.durationMinutes
                                  );
                                  const hasClassOverlap = block.classroomId && blocks.some(b =>
                                    b.id !== block.id
                                    && b.classroomId === block.classroomId
                                    && b.dayOfWeek === block.dayOfWeek
                                    && b.startMinute < newEnd
                                    && newStart < b.startMinute + b.durationMinutes
                                  );
                                  if (hasTeacherOverlap || hasClassOverlap) return;
                                  onDropOnCell(block.dayOfWeek, newStart, rawData, block.classroomId || undefined);
                                }
                              } else {
                                onDropOnCell(block.dayOfWeek, block.startMinute, JSON.stringify({ type: 'swap', blockId: d.id, targetBlockId: block.id, targetClassroomId: block.classroomId }), block.classroomId || undefined);
                              }
                              return;
                            }
                          } catch {}
                          e.stopPropagation();
                          if (!blockDropAllowed) return;
                          e.preventDefault();
                          onDropOnCell(block.dayOfWeek, block.startMinute, rawData, block.classroomId || undefined);
                        }}
                        onClick={e => { e.stopPropagation(); onSelectBlock(block.id); }}
                        onContextMenu={e => {
                          e.preventDefault(); e.stopPropagation();
                          onContextMenu?.(block.id, e.clientX, e.clientY);
                        }}
                        title={isDragHover ? blockDropReason : undefined}
                        style={{
                          position: 'absolute', top, height: height - 2,
                          left: leftStyle, width: widthStyle,
                          background: isDragHover
                            ? hexToRgba(C.danger, 0.1)
                            : isTask ? hexToRgba(blockColor, 0.12) : hexToRgba(blockColor, 0.2),
                          border: isDragHover
                            ? `1px solid ${hexToRgba(C.danger, 0.4)}`
                            : isTask ? `1px dashed ${blockColor}` : `1px solid ${hexToRgba(blockColor, 0.4)}`,
                          borderLeft: isDragHover ? `3px solid ${C.danger}` : hasConflict ? `3px solid ${C.warning}` : isSelected ? `3px solid ${C.primary}` : isTask ? `1px dashed ${blockColor}` : `3px solid ${blockColor}`,
                          borderRadius: 4, padding: '3px 6px',
                          cursor: isDragHover ? 'not-allowed' : 'pointer',
                          overflow: 'hidden', zIndex: blockDragReady ? 10 : 2, fontSize: 11,
                          boxShadow: isSelected ? `0 0 0 2px ${hexToRgba(C.primary, 0.3)}` : 'none',
                          transition: 'box-shadow 0.15s, background 0.15s',
                        }}
                      >
                        {isDragHover && (
                          <div style={{ fontSize: 9, color: C.danger, fontWeight: 600, marginBottom: 1 }}>
                            {blockDropReason}
                          </div>
                        )}
                        <div style={{ fontWeight: 700, color: isDragHover ? C.danger : blockColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {hasConflict && <FontAwesomeIcon icon={faTriangleExclamation} style={{ color: C.warning, marginRight: 4, fontSize: 10 }} />}
                          {(() => {
                            if (block.assignedTeacherIds && block.assignedTeacherIds.length > 0) {
                              const names = block.assignedTeacherIds.map(tid => allTeachers?.find(t => t.id === tid)?.name).filter(Boolean);
                              return names.join(', ') || block.task?.name || 'Unassigned';
                            }
                            return block.teacher?.name || block.subject?.name || block.task?.name || 'Unassigned';
                          })()}
                        </div>
                        {height > 28 && !isDragHover && (
                          <div style={{ color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.7, fontSize: 10 }}>
                            {block.subject?.name || block.task?.name || ''}
                            {block.classroom ? ` - ${block.classroom.name}` : ''}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}

                {/* Class column labels — rendered on top of everything */}
                {allClasses && allClasses.length > 0 && (() => {
                  const dayClasses = allClasses
                    .filter(c => c.isActive && c.startMinute != null && c.endMinute != null && c.daysOfWeek?.includes(dayIdx))
                    .sort((a, b) => a.startMinute! - b.startMinute! || a.name.localeCompare(b.name));
                  if (dayClasses.length === 0) return null;
                  const clsLayout = layoutBlocks(dayClasses.map(c => ({
                    id: c.id, startMinute: c.startMinute!, durationMinutes: c.endMinute! - c.startMinute!,
                    weekDate: '', dayOfWeek: 0, teacherId: '', subjectId: null, taskId: null, classroomId: null, notes: null,
                    teacher: { id: '', name: '', color: '' }, subject: null, task: null, classroom: null, assignedTeacherIds: null,
                  })));
                  const dayBlks = blocksByDay[dayIdx] || [];
                  const hasTaskBlks = dayBlks.some(b => !b.classroomId);
                  const lblScale = hasTaskBlks ? 0.85 : 1;
                  return dayClasses.map(cls => {
                    const clsTop = ((cls.startMinute! - DAY_START) / SLOT_DURATION) * ROW_HEIGHT;
                    const pos = clsLayout.get(cls.id) || { col: 0, totalCols: 1 };
                    const rawWidth = 100 / pos.totalCols;
                    const colWidth = rawWidth * lblScale;
                    const leftPct = (pos.col * rawWidth) * lblScale + colWidth / 2;
                    return (
                      <div key={`label-${cls.id}`} style={{
                        position: 'absolute', top: clsTop - 9, left: `${leftPct}%`, transform: 'translateX(-50%)',
                        background: '#eef0fa', padding: '1px 7px', borderRadius: 4,
                        fontSize: 9, fontWeight: 700, color: hexToRgba(C.primary, 0.7),
                        textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap',
                        pointerEvents: 'none', zIndex: 20,
                        border: `1px solid ${hexToRgba(C.primary, 0.15)}`,
                      }}>
                        {cls.name}
                      </div>
                    );
                  });
                })()}

                {/* Block-drag: add drag handling to existing class column backgrounds */}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AssignmentDrawer
// ══════════════════════════════════════════════════════════════════════════════

interface BlockFormData {
  teacherId: string;
  assignmentType: 'subject' | 'task';
  subjectId: string;
  taskId: string;
  classroomId: string;
  assignedTeacherIds: string[];
  dayOfWeek: number;
  startMinute: number;
  durationMinutes: number;
  notes: string;
}

interface AssignmentDrawerProps {
  block: ScheduleBlock | null; // null = creating new
  formData: BlockFormData;
  onChange: (data: Partial<BlockFormData>) => void;
  teachers: Teacher[];
  subjects: PlannerSubject[];
  tasks: PlannerTask[];
  classrooms: Classroom[];
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
  saving: boolean;
  error: string | null;
  allBlocks: ScheduleBlock[];
}

function AssignmentDrawer({
  block, formData, onChange, teachers, subjects, tasks, classrooms,
  onSave, onDelete, onClose, saving, error, allBlocks,
}: AssignmentDrawerProps) {
  const slots = useMemo(() => generateTimeSlots(), []);
  const isEditing = !!block;

  const rowStyle: React.CSSProperties = { display: 'flex', gap: 12 };
  const fieldStyle: React.CSSProperties = { flex: 1 };
  const compactLabel: React.CSSProperties = { ...labelStyle, fontSize: 11, marginBottom: 3 };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.35)',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: 460, maxWidth: '92vw', maxHeight: '85vh', background: C.card, borderRadius: 14,
        boxShadow: '0 12px 40px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
      }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
          {isEditing ? 'Edit Assignment' : 'New Assignment'}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 16, padding: 4 }}>
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>

      {/* Form */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Row 1: Teacher + Type toggle */}
        <div style={rowStyle}>
          {formData.assignmentType === 'subject' ? (
            <div style={{ flex: 2 }}>
              <label style={compactLabel}>Teacher</label>
              <select style={selectStyle} value={formData.teacherId} onChange={e => onChange({ teacherId: e.target.value })}>
                <option value="">None</option>
                {teachers.filter(t => t.isActive).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ flex: 2 }}>
              <label style={compactLabel}>Assigned Teachers</label>
              <div style={{
                display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
                padding: '6px 8px', minHeight: 38, borderRadius: 8,
                border: `1px solid ${C.border}`, background: '#fafbfc',
              }}>
                {formData.assignedTeacherIds.map(tid => {
                  const t = teachers.find(x => x.id === tid);
                  return t ? (
                    <span key={tid} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px', fontSize: 12, fontWeight: 600, borderRadius: 16,
                      background: t.color + '18', color: t.color, border: `1.5px solid ${t.color}40`,
                    }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: t.color, flexShrink: 0,
                      }} />
                      {t.name}
                      <button onClick={() => onChange({ assignedTeacherIds: formData.assignedTeacherIds.filter(x => x !== tid) })}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: t.color, fontSize: 10, padding: '0 0 0 2px', lineHeight: 1,
                          opacity: 0.7,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
                      >
                        <FontAwesomeIcon icon={faXmark} />
                      </button>
                    </span>
                  ) : null;
                })}
                {teachers.filter(t => t.isActive && !formData.assignedTeacherIds.includes(t.id)).length > 0 && (
                  <select
                    style={{
                      ...selectStyle, width: 'auto', minWidth: 110, flex: 1,
                      padding: '3px 6px', fontSize: 11, border: 'none',
                      background: 'transparent', color: C.primary,
                    }}
                    value=""
                    onChange={e => {
                      if (e.target.value && !formData.assignedTeacherIds.includes(e.target.value)) {
                        onChange({ assignedTeacherIds: [...formData.assignedTeacherIds, e.target.value] });
                      }
                      e.target.value = '';
                    }}
                  >
                    <option value="">+ Add teacher</option>
                    {teachers.filter(t => t.isActive && !formData.assignedTeacherIds.includes(t.id)).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
                {formData.assignedTeacherIds.length === 0 && (
                  <span style={{ fontSize: 11, color: C.muted, fontStyle: 'italic' }}>No teachers assigned</span>
                )}
              </div>
            </div>
          )}
          <div style={{ flex: 1 }}>
            <label style={compactLabel}>Type</label>
            <div style={{ display: 'flex', gap: 2, height: 36 }}>
              {(['subject', 'task'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => onChange({ assignmentType: type, subjectId: '', taskId: '' })}
                  style={{
                    flex: 1, fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none',
                    background: formData.assignmentType === type ? C.primary : '#f1f5f9',
                    color: formData.assignmentType === type ? '#fff' : C.muted,
                    cursor: 'pointer', textTransform: 'capitalize',
                  }}
                >
                  {type === 'subject' ? 'Subject' : 'Task'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: Subject/Task + Class */}
        <div style={rowStyle}>
          <div style={fieldStyle}>
            <label style={compactLabel}>{formData.assignmentType === 'subject' ? 'Subject' : 'Task'}</label>
            {formData.assignmentType === 'subject' ? (
              <select style={selectStyle} value={formData.subjectId} onChange={e => onChange({ subjectId: e.target.value })}>
                <option value="">Select...</option>
                {(() => {
                  const selectedTeacher = teachers.find(t => t.id === formData.teacherId);
                  const allowed = selectedTeacher?.allowedSubjectIds;
                  const filtered = allowed && allowed.length > 0
                    ? subjects.filter(s => allowed.includes(s.id))
                    : subjects;
                  return filtered.map(s => <option key={s.id} value={s.id}>{s.name}</option>);
                })()}
              </select>
            ) : (
              <select style={selectStyle} value={formData.taskId} onChange={e => onChange({ taskId: e.target.value })}>
                <option value="">Select...</option>
                {tasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>
          {formData.assignmentType === 'subject' && <div style={fieldStyle}>
            <label style={compactLabel}>Class</label>
            <select style={selectStyle} value={formData.classroomId} onChange={e => onChange({ classroomId: e.target.value })}>
              <option value="">None</option>
              {(() => {
                const selectedTeacher = teachers.find(t => t.id === formData.teacherId);
                const allowed = selectedTeacher?.allowedClassroomIds;
                const filtered = allowed && allowed.length > 0
                  ? classrooms.filter(c => c.isActive && allowed.includes(c.id))
                  : classrooms.filter(c => c.isActive);
                return filtered.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ));
              })()}
            </select>
          </div>}
        </div>

        {/* Row 3: Day + Start Time + Duration */}
        <div style={rowStyle}>
          <div style={fieldStyle}>
            <label style={compactLabel}>Day</label>
            <select style={selectStyle} value={formData.dayOfWeek} onChange={e => onChange({ dayOfWeek: Number(e.target.value) })}>
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={compactLabel}>Start</label>
            <select style={selectStyle} value={formData.startMinute} onChange={e => onChange({ startMinute: Number(e.target.value) })}>
              {slots.map(m => {
                const isOccupied = formData.teacherId && allBlocks.some(b =>
                  b.teacherId === formData.teacherId
                  && b.dayOfWeek === formData.dayOfWeek
                  && b.id !== block?.id
                  && m >= b.startMinute
                  && m < b.startMinute + b.durationMinutes
                );
                if (isOccupied) return <option key={m} value={m} disabled style={{ color: '#d1d5db' }}>{minutesToTime(m)} (occupied)</option>;
                return <option key={m} value={m}>{minutesToTime(m)}</option>;
              })}
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={compactLabel}>Duration</label>
            <select style={selectStyle} value={formData.durationMinutes} onChange={e => onChange({ durationMinutes: Number(e.target.value) })}>
              {DURATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Duration overlap warning */}
        {(() => {
          if (!formData.teacherId) return null;
          const slotEnd = formData.startMinute + formData.durationMinutes;
          const overlapping = allBlocks.find(b =>
            b.teacherId === formData.teacherId
            && b.dayOfWeek === formData.dayOfWeek
            && b.id !== block?.id
            && b.startMinute < slotEnd
            && formData.startMinute < b.startMinute + b.durationMinutes
          );
          if (!overlapping) return null;
          return (
            <div style={{ fontSize: 11, color: C.danger, display: 'flex', alignItems: 'center', gap: 4, marginTop: -4 }}>
              <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 10 }} />
              Overlaps with {overlapping.teacher.name} at {minutesToTime(overlapping.startMinute)}
              {overlapping.subject ? ` (${overlapping.subject.name})` : ''}
            </div>
          );
        })()}

        {/* Notes */}
        <div>
          <label style={compactLabel}>Notes</label>
          <textarea
            style={{ ...inputStyle, minHeight: 50, resize: 'vertical', fontFamily: 'inherit', fontSize: 12 }}
            value={formData.notes}
            onChange={e => onChange({ notes: e.target.value })}
            placeholder="Optional notes..."
          />
        </div>

        {/* Conflicts & errors */}
        {block?.conflicts && block.conflicts.length > 0 && (
          <div style={{ padding: 8, borderRadius: 6, background: '#fffbeb', border: `1px solid ${C.warning}`, fontSize: 11, color: '#92400e' }}>
            <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: 4 }} />
            {block.conflicts.map(c => c.description).join('; ')}
          </div>
        )}
        {error && (
          <div style={{ padding: 8, borderRadius: 6, background: '#fef2f2', border: `1px solid ${C.danger}`, fontSize: 11, color: C.danger }}>
            <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: 4 }} />
            {error}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, alignItems: 'center' }}>
        {isEditing && (
          <button onClick={onDelete} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: C.danger, fontSize: 12, fontWeight: 600,
            padding: '8px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4,
          }}
            onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <FontAwesomeIcon icon={faTrash} />
            Delete
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{ ...btnGhost, padding: '8px 16px' }}>Cancel</button>
        <button onClick={onSave} disabled={saving} style={{
          ...btnPrimary, padding: '8px 20px', opacity: saving ? 0.5 : 1,
        }}>
          {saving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
        </button>
      </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════════════════════

export default function OperationsPlannerPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  // Fixed weekDate — planner is not date-based, blocks persist indefinitely as draft
  const weekDate = '2000-01-03';
  const [viewMode, setViewMode] = useState<ViewMode>('classroom');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resourceSearch, setResourceSearch] = useState('');
  const [selectedFilterId, setSelectedFilterId_] = useState<string>('all');
  const [showTasks, setShowTasks] = useState(true);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const setSelectedFilterId = (id: string) => {
    setSelectedFilterId_(id);
    // Default: tasks ON for "All", OFF for specific classes
    setShowTasks(id === 'all' || id === 'unassigned');
  };
  const [currentTimetableId, setCurrentTimetableId] = useState<string | null>(null);
  const [currentTimetableName, setCurrentTimetableName] = useState<string | null>(null);
  const [draggingData, setDraggingDataState] = useState<{ type: string; id: string } | null>(null);
  const draggingDataRef = useRef<{ type: string; id: string } | null>(null);
  const setDraggingData = (d: { type: string; id: string } | null) => {
    draggingDataRef.current = d;
    setDraggingDataState(d);
  };

  const defaultForm: BlockFormData = {
    teacherId: '', assignmentType: 'subject', subjectId: '', taskId: '',
    classroomId: '', assignedTeacherIds: [], dayOfWeek: 0, startMinute: DAY_START, durationMinutes: 60, notes: '',
  };
  const [formData, setFormData] = useState<BlockFormData>(defaultForm);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: blocks = [], isLoading: blocksLoading, isError: blocksError } = useQuery({
    queryKey: ['planner-blocks', weekDate],
    queryFn: () => fetchBlocks(weekDate),
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['planner-teachers'],
    queryFn: fetchTeachers,
  });

  const { data: classrooms = [] } = useQuery({
    queryKey: ['planner-classrooms'],
    queryFn: fetchClassrooms,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['planner-subjects'],
    queryFn: fetchSubjects,
  });

  const { data: plannerTasks = [] } = useQuery({
    queryKey: ['planner-tasks'],
    queryFn: fetchTasks,
  });

  // ── Undo/Redo ──────────────────────────────────────────────────────────────
  type BlockSnapshot = Array<{
    dayOfWeek: number; startMinute: number; durationMinutes: number;
    teacherId: string | null; subjectId: string | null; taskId: string | null;
    classroomId: string | null; notes: string | null;
  }>;
  const undoStack = useRef<BlockSnapshot[]>([]);
  const redoStack = useRef<BlockSnapshot[]>([]);
  const lastSnapshotRef = useRef<string>('');

  const takeSnapshot = () => {
    const snap: BlockSnapshot = blocks.map(b => ({
      dayOfWeek: b.dayOfWeek, startMinute: b.startMinute, durationMinutes: b.durationMinutes,
      teacherId: b.teacherId, subjectId: b.subjectId, taskId: b.taskId,
      classroomId: b.classroomId, notes: b.notes,
    }));
    const key = JSON.stringify(snap);
    if (key !== lastSnapshotRef.current) {
      undoStack.current.push(snap);
      if (undoStack.current.length > 50) undoStack.current.shift();
      redoStack.current = [];
      lastSnapshotRef.current = key;
    }
  };

  const restoreSnapshot = async (snap: BlockSnapshot) => {
    // Delete all current blocks
    await Promise.all(blocks.map(b => deleteBlock(b.id)));
    // Recreate from snapshot
    const now = new Date();
    if (snap.length > 0) {
      await Promise.all(snap.map(b => createBlock({
        weekDate, dayOfWeek: b.dayOfWeek, startMinute: b.startMinute,
        durationMinutes: b.durationMinutes, teacherId: b.teacherId || undefined,
        subjectId: b.subjectId || undefined, taskId: b.taskId || undefined,
        classroomId: b.classroomId || undefined, notes: b.notes || undefined,
        skipConflictCheck: true,
      } as any)));
    }
    await invalidateBlocks();
  };

  const [undoRedoPending, setUndoRedoPending] = useState(false);

  const handleUndo = async () => {
    if (undoStack.current.length < 2 || undoRedoPending) return;
    setUndoRedoPending(true);
    const current = undoStack.current.pop()!;
    redoStack.current.push(current);
    const prev = undoStack.current[undoStack.current.length - 1];
    lastSnapshotRef.current = JSON.stringify(prev);
    await restoreSnapshot(prev);
    setUndoRedoPending(false);
  };

  const handleRedo = async () => {
    if (redoStack.current.length === 0 || undoRedoPending) return;
    setUndoRedoPending(true);
    const next = redoStack.current.pop()!;
    undoStack.current.push(next);
    lastSnapshotRef.current = JSON.stringify(next);
    await restoreSnapshot(next);
    setUndoRedoPending(false);
  };

  // Track snapshots when blocks change
  useEffect(() => {
    if (blocks.length > 0 || undoStack.current.length > 0) {
      const snap: BlockSnapshot = blocks.map(b => ({
        dayOfWeek: b.dayOfWeek, startMinute: b.startMinute, durationMinutes: b.durationMinutes,
        teacherId: b.teacherId, subjectId: b.subjectId, taskId: b.taskId,
        classroomId: b.classroomId, notes: b.notes,
      }));
      const key = JSON.stringify(snap);
      if (key !== lastSnapshotRef.current) {
        if (!undoRedoPending) {
          undoStack.current.push(snap);
          if (undoStack.current.length > 50) undoStack.current.shift();
          redoStack.current = [];
        }
        lastSnapshotRef.current = key;
      }
    }
  }, [blocks]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockId && !drawerOpen) {
        e.preventDefault();
        deleteBlock(selectedBlockId).then(() => {
          invalidateBlocks();
          setSelectedBlockId(null);
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [blocks, undoRedoPending, selectedBlockId, drawerOpen]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const invalidateBlocks = () => qc.invalidateQueries({ queryKey: ['planner-blocks', weekDate] });

  const [saveError, setSaveError] = useState<string | null>(null);

  const handleMutationError = (err: any) => {
    const msg = err?.message || '';
    const conflictMsg = 'This teacher is already assigned at this time. Please choose a different time slot or teacher.';
    if (msg.includes('conflict') || msg.includes('409')) {
      if (drawerOpen) setSaveError(conflictMsg);
      else showConfirm('Conflict', conflictMsg, () => setConfirmModal(null));
    } else {
      if (drawerOpen) setSaveError(msg || 'Failed to save. Please try again.');
      else showConfirm('Error', msg || 'Failed to save. Please try again.', () => setConfirmModal(null));
    }
  };

  const createBlockMut = useMutation({
    mutationFn: (d: CreateBlockPayload) => createBlock(d),
    onSuccess: () => { invalidateBlocks(); closeDrawer(); setSaveError(null); },
    onError: handleMutationError,
  });

  const updateBlockMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBlockPayload }) => updateBlock(id, data),
    onSuccess: () => { invalidateBlocks(); closeDrawer(); setSaveError(null); },
    onError: handleMutationError,
  });

  const deleteBlockMut = useMutation({
    mutationFn: (id: string) => deleteBlock(id),
    onSuccess: () => { invalidateBlocks(); closeDrawer(); },
  });



  // ── Saved Timetables ───────────────────────────────────────────────────────
  const { data: savedTimetablesList = [] } = useQuery({
    queryKey: ['saved-timetables'],
    queryFn: fetchSavedTimetables,
  });

  const saveTimetableMut = useMutation({
    mutationFn: (name: string) => saveTimetable({ name, weekDate }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['saved-timetables'] });
      setCurrentTimetableId(data.id);
      setCurrentTimetableName(data.name);
    },
  });

  const loadTimetableMut = useMutation({
    mutationFn: (id: string) => loadSavedTimetable(id, weekDate),
    onSuccess: (_data, id) => {
      invalidateBlocks();
      const loaded = savedTimetablesList.find(t => t.id === id);
      setCurrentTimetableId(id);
      setCurrentTimetableName(loaded?.name || null);
    },
  });

  const deleteTimetableMut = useMutation({
    mutationFn: (id: string) => deleteSavedTimetable(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-timetables'] });
      setCurrentTimetableId(null);
      setCurrentTimetableName(null);
    },
  });

  // Generic confirm modal
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void; danger?: boolean } | null>(null);
  const showConfirm = (title: string, message: string, onConfirm: () => void, danger?: boolean) => {
    setConfirmModal({ title, message, onConfirm, danger });
  };

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveModalName, setSaveModalName] = useState('');
  const [saveModalError, setSaveModalError] = useState('');

  const handleSaveTimetable = () => {
    if (currentTimetableId) {
      // Already saved — overwrite: delete old then save with same name
      deleteSavedTimetable(currentTimetableId).then(() => {
        saveTimetableMut.mutate(currentTimetableName!);
      });
    } else {
      setSaveModalName('');
      setSaveModalError('');
      setSaveModalOpen(true);
    }
  };

  const handleSaveModalConfirm = () => {
    const name = saveModalName.trim();
    if (!name) {
      setSaveModalError('Name is required');
      return;
    }
    if (savedTimetablesList.some(t => t.name === name)) {
      setSaveModalError(`"${name}" already exists`);
      return;
    }
    saveTimetableMut.mutate(name);
    setSaveModalOpen(false);
  };

  const handleLoadTimetable = (id: string) => {
    if (blocks.length > 0 && !currentTimetableId) {
      showConfirm('Unsaved Changes', 'You have unsaved changes. Load anyway?', () => {
        loadTimetableMut.mutate(id);
      });
    } else {
      loadTimetableMut.mutate(id);
    }
  };

  const clearAllBlocks = async () => {
    if (blocks.length > 0) {
      await Promise.all(blocks.map(b => deleteBlock(b.id)));
      await invalidateBlocks();
    }
  };

  const handleNewTimetable = () => {
    if (blocks.length > 0 && !currentTimetableId) {
      showConfirm('New Timetable', 'You have unsaved changes. Create a new empty timetable?', async () => {
        await clearAllBlocks();
        setCurrentTimetableId(null);
        setCurrentTimetableName(null);
        setConfirmModal(null);
      });
    } else {
      clearAllBlocks().then(() => {
        setCurrentTimetableId(null);
        setCurrentTimetableName(null);
      });
    }
  };

  const handleDeleteTimetable = () => {
    if (!currentTimetableId) return;
    showConfirm('Delete Timetable', `Delete "${currentTimetableName}"? This will also clear all blocks.`, async () => {
      await clearAllBlocks();
      deleteTimetableMut.mutate(currentTimetableId);
      setConfirmModal(null);
    }, true);
  };

  const handleClearAll = () => {
    if (blocks.length === 0) return;
    showConfirm('Clear All', 'Remove all blocks from the timetable?', async () => {
      await clearAllBlocks();
      setConfirmModal(null);
    }, true);
  };

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const wb = XLSX.utils.book_new();
    const minutesToTimeStr = (m: number) => {
      const h = Math.floor(m / 60);
      const mm = m % 60;
      const suffix = h >= 12 ? 'PM' : 'AM';
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      return `${h12}:${String(mm).padStart(2, '0')} ${suffix}`;
    };

    // Helper: build a timetable grid for given blocks
    const buildSheet = (sheetBlocks: typeof blocks, sheetName: string) => {
      // Find time range
      const allStarts = sheetBlocks.map(b => b.startMinute);
      const allEnds = sheetBlocks.map(b => b.startMinute + b.durationMinutes);
      const minTime = allStarts.length ? Math.min(...allStarts) : DAY_START;
      const maxTime = allEnds.length ? Math.max(...allEnds) : DAY_END;

      // Build rows: each row is a 30-min slot
      const rows: string[][] = [];
      // Header row
      rows.push(['Time', ...DAYS]);

      for (let t = minTime; t < maxTime; t += 30) {
        const row = [minutesToTimeStr(t)];
        for (let d = 0; d < 5; d++) {
          const blocksAt = sheetBlocks.filter(b =>
            b.dayOfWeek === d && b.startMinute <= t && t < b.startMinute + b.durationMinutes
          );
          const labels = blocksAt.map(b => {
            const parts: string[] = [];
            if (b.teacher?.name) parts.push(b.teacher.name);
            if (b.assignedTeacherIds && b.assignedTeacherIds.length > 0 && !b.teacher?.name) {
              const names = b.assignedTeacherIds.map(tid => teachers.find(tt => tt.id === tid)?.name).filter(Boolean);
              if (names.length) parts.push(names.join(', '));
            }
            if (b.subject?.name) parts.push(b.subject.name);
            if (b.task?.name) parts.push(b.task.name);
            if (b.classroom?.name) parts.push(`(${b.classroom.name})`);
            return parts.join(' - ');
          });
          row.push(labels.join(' | '));
        }
        rows.push(row);
      }

      const ws = XLSX.utils.aoa_to_sheet(rows);
      // Set column widths
      ws['!cols'] = [{ wch: 12 }, ...DAYS.map(() => ({ wch: 30 }))];
      XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31)); // Excel limit 31 chars
    };

    // Sheet per classroom
    classrooms.filter(c => c.isActive).forEach(cls => {
      const clsBlocks = blocks.filter(b => b.classroomId === cls.id);
      if (clsBlocks.length > 0 || true) { // always include sheet
        buildSheet(clsBlocks, cls.name);
      }
    });

    // Teacher sheets
    teachers.filter(t => t.isActive).forEach(t => {
      const tBlocks = blocks.filter(b =>
        b.teacherId === t.id || (b.assignedTeacherIds && b.assignedTeacherIds.includes(t.id))
      );
      buildSheet(tBlocks, `Teacher - ${t.name}`);
    });

    // Tasks sheet
    const taskBlocks = blocks.filter(b => b.taskId);
    if (taskBlocks.length > 0) {
      buildSheet(taskBlocks, 'Tasks');
    }

    // Download
    const timetableName = currentTimetableName || 'Timetable';
    XLSX.writeFile(wb, `${timetableName}.xlsx`);
  }, [blocks, classrooms, teachers, currentTimetableName]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedBlock = useMemo(() => blocks.find(b => b.id === selectedBlockId) || null, [blocks, selectedBlockId]);

  // ── Drawer handlers ────────────────────────────────────────────────────────
  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedBlockId(null);
    setFormData(defaultForm);
    setSaveError(null);
  };

  const openNewBlock = (dayOfWeek: number, startMinute: number, prefill?: Partial<BlockFormData>) => {
    setSelectedBlockId(null);
    const merged = { ...defaultForm, dayOfWeek, startMinute, ...prefill };

    // Auto-select subject if teacher has allowed subjects
    if (merged.teacherId && !merged.subjectId) {
      const teacher = teachers.find(t => t.id === merged.teacherId);
      if (teacher?.allowedSubjectIds && teacher.allowedSubjectIds.length > 0) {
        merged.assignmentType = 'subject';
        if (teacher.allowedSubjectIds.length === 1) {
          merged.subjectId = teacher.allowedSubjectIds[0];
        }
      }
    }

    // Use subject's default duration if available
    if (merged.subjectId && merged.durationMinutes === defaultForm.durationMinutes) {
      const subj = subjects.find(s => s.id === merged.subjectId);
      if (subj?.defaultDuration) merged.durationMinutes = subj.defaultDuration;
    }

    setFormData(merged);
    setDrawerOpen(true);
  };

  const openEditBlock = (block: ScheduleBlock) => {
    setSelectedBlockId(block.id);
    setFormData({
      teacherId: block.teacherId || '',
      assignmentType: block.subject ? 'subject' : 'task',
      subjectId: block.subjectId || '',
      taskId: block.taskId || '',
      classroomId: block.classroomId || '',
      assignedTeacherIds: block.assignedTeacherIds && block.assignedTeacherIds.length > 0
        ? block.assignedTeacherIds
        : (block.teacherId && block.taskId ? [block.teacherId] : []),
      dayOfWeek: block.dayOfWeek,
      startMinute: block.startMinute,
      durationMinutes: block.durationMinutes,
      notes: block.notes || '',
    });
    setDrawerOpen(true);
  };

  const handleSelectBlock = (id: string) => {
    setSelectedBlockId(id || null);
  };

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ blockId: string; x: number; y: number } | null>(null);

  const handleContextMenu = (blockId: string, x: number, y: number) => {
    setSelectedBlockId(blockId);
    setContextMenu({ blockId, x, y });
  };

  const [cellContextMenu, setCellContextMenu] = useState<{ dayOfWeek: number; startMinute: number; x: number; y: number } | null>(null);

  const handleCellClick = (dayOfWeek: number, startMinute: number, x: number, y: number) => {
    setCellContextMenu({ dayOfWeek, startMinute, x, y });
  };

  // Get current class context for drops
  const getDropClassId = (): string | null => {
    if (viewMode === 'classroom' && selectedFilterId !== 'all' && selectedFilterId !== 'unassigned') {
      return selectedFilterId;
    }
    return null;
  };

  const validateTeacherForClass = (teacherId: string, classId: string | null): boolean => {
    if (!classId) return true;
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return true;
    if (!teacher.allowedClassroomIds || teacher.allowedClassroomIds.length === 0) return true;
    return teacher.allowedClassroomIds.includes(classId);
  };

  const validateTeacherForSubject = (teacherId: string, subjectId: string): boolean => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) return true;
    if (!teacher.allowedSubjectIds || teacher.allowedSubjectIds.length === 0) return true;
    return teacher.allowedSubjectIds.includes(subjectId);
  };

  const handleDrop = (dayOfWeek: number, startMinute: number, rawData: string, dropClassroomId?: string) => {
    try {
      const data = JSON.parse(rawData);
      const classId = dropClassroomId || getDropClassId();

      if (data.type === 'swap') {
        const draggedBlock = blocks.find(b => b.id === data.blockId);
        const targetBlock = blocks.find(b => b.id === data.targetBlockId);
        if (draggedBlock && targetBlock) {
          // Merge: teacher-only block dropped onto subject-only block (or vice versa)
          const dragHasTeacherOnly = draggedBlock.teacherId && !draggedBlock.subjectId && !draggedBlock.taskId;
          const targetHasSubjectOnly = targetBlock.subjectId && !targetBlock.teacherId;
          const dragHasSubjectOnly = draggedBlock.subjectId && !draggedBlock.teacherId;
          const targetHasTeacherOnly = targetBlock.teacherId && !targetBlock.subjectId && !targetBlock.taskId;

          if (dragHasTeacherOnly && targetHasSubjectOnly) {
            // Assign dragged teacher to target block, delete dragged block
            Promise.all([
              updateBlock(targetBlock.id, { teacherId: draggedBlock.teacherId, skipConflictCheck: true } as any),
              deleteBlock(draggedBlock.id),
            ]).then(() => invalidateBlocks()).catch(handleMutationError);
          } else if (dragHasSubjectOnly && targetHasTeacherOnly) {
            // Assign dragged subject to target block + update duration, delete dragged block
            const subj = subjects.find(s => s.id === draggedBlock.subjectId);
            const mergeData: any = { subjectId: draggedBlock.subjectId, skipConflictCheck: true };
            if (subj?.defaultDuration) mergeData.durationMinutes = subj.defaultDuration;
            Promise.all([
              updateBlock(targetBlock.id, mergeData),
              deleteBlock(draggedBlock.id),
            ]).then(() => invalidateBlocks()).catch(handleMutationError);
          } else if (dragHasTeacherOnly && targetBlock.taskId) {
            // Add teacher to task's assignedTeacherIds
            const existing = targetBlock.assignedTeacherIds || [];
            if (!existing.includes(draggedBlock.teacherId!)) {
              updateBlock(targetBlock.id, {
                assignedTeacherIds: [...existing, draggedBlock.teacherId!],
                skipConflictCheck: true,
              } as any).then(() => {
                deleteBlock(draggedBlock.id).then(() => invalidateBlocks());
              }).catch(handleMutationError);
            }
          } else {
            // Full swap: exchange time, day, and classroom between two blocks
            Promise.all([
              updateBlock(data.blockId, {
                dayOfWeek: targetBlock.dayOfWeek,
                startMinute: targetBlock.startMinute,
                classroomId: targetBlock.classroomId,
                skipConflictCheck: true,
              } as any),
              updateBlock(data.targetBlockId, {
                dayOfWeek: draggedBlock.dayOfWeek,
                startMinute: draggedBlock.startMinute,
                classroomId: draggedBlock.classroomId,
                skipConflictCheck: true,
              } as any),
            ]).then(() => invalidateBlocks()).catch(handleMutationError);
          }
        }
      } else if (data.type === 'block') {
        const updateData: any = { dayOfWeek, startMinute, skipConflictCheck: true };
        if (classId) updateData.classroomId = classId;
        updateBlockMut.mutate({ id: data.id, data: updateData });
      } else if (data.type === 'teacher') {
        // In All view, teacher must be dropped on a class column, not the grid body
        if (!classId && viewMode === 'classroom' && selectedFilterId === 'all') return;
        if (!validateTeacherForClass(data.id, classId)) {
          return; // silently prevent — visual feedback already shown during drag
        }
        // Check if there's an existing block at this time — auto-assign teacher if empty
        // Also match task blocks without classroomId
        const existingBlock = blocks.find(b =>
          b.dayOfWeek === dayOfWeek
          && b.startMinute <= startMinute
          && startMinute < b.startMinute + b.durationMinutes
          && (!classId || b.classroomId === classId || (b.taskId && !b.classroomId))
        );
        if (existingBlock) {
          if (existingBlock.taskId) {
            // Task block: add teacher to assignedTeacherIds
            const existing = existingBlock.assignedTeacherIds || [];
            if (!existing.includes(data.id)) {
              updateBlockMut.mutate({ id: existingBlock.id, data: { assignedTeacherIds: [...existing, data.id] } });
            }
          } else {
            // Subject block: validate teacher can teach the subject, then assign
            if (existingBlock.subjectId) {
              const teacher = teachers.find(t => t.id === data.id);
              if (teacher?.allowedSubjectIds?.length && !teacher.allowedSubjectIds.includes(existingBlock.subjectId)) {
                return; // teacher can't teach this subject
              }
            }
            updateBlockMut.mutate({ id: existingBlock.id, data: { teacherId: data.id } });
          }
        } else {
          // Check for ANY overlap in same class before creating
          const duration = 30;
          if (classId) {
            const overlapping = blocks.find(b =>
              b.classroomId === classId && b.dayOfWeek === dayOfWeek
              && b.startMinute < startMinute + duration && startMinute < b.startMinute + b.durationMinutes
            );
            if (overlapping) {
              // Try to assign teacher to the overlapping block instead
              if (overlapping.taskId) {
                const existing = overlapping.assignedTeacherIds || [];
                if (!existing.includes(data.id)) {
                  updateBlockMut.mutate({ id: overlapping.id, data: { assignedTeacherIds: [...existing, data.id] } });
                }
              } else if (overlapping.subjectId) {
                const teacher = teachers.find(t => t.id === data.id);
                if (teacher?.allowedSubjectIds?.length && !teacher.allowedSubjectIds.includes(overlapping.subjectId)) {
                  return; // teacher can't teach this subject
                }
                if (!overlapping.teacherId) {
                  updateBlockMut.mutate({ id: overlapping.id, data: { teacherId: data.id } });
                }
              }
              return;
            }
          }
          createBlockMut.mutate({
            weekDate, dayOfWeek, startMinute, durationMinutes: duration,
            teacherId: data.id, classroomId: classId || undefined,
          });
        }
      } else if (data.type === 'subject') {
        // In All view, subject must be dropped on a class column, not the grid body
        if (!classId && viewMode === 'classroom' && selectedFilterId === 'all') return;
        // Check if there's an existing block at this time — auto-assign subject if empty
        const existingBlock = blocks.find(b =>
          b.dayOfWeek === dayOfWeek
          && b.startMinute <= startMinute
          && startMinute < b.startMinute + b.durationMinutes
          && (!classId || b.classroomId === classId)
        );
        if (existingBlock) {
          // Assign subject to existing block + update duration to subject's default
          const subj = subjects.find(s => s.id === data.id);
          const updateData: any = { subjectId: data.id };
          if (subj?.defaultDuration && !existingBlock.subjectId) {
            updateData.durationMinutes = subj.defaultDuration;
          }
          updateBlockMut.mutate({ id: existingBlock.id, data: updateData });
        } else {
          const subj = subjects.find(s => s.id === data.id);
          const duration = subj?.defaultDuration || 60;
          // Check for class overlap before creating
          if (classId && blocks.some(b =>
            b.classroomId === classId && b.dayOfWeek === dayOfWeek
            && b.startMinute < startMinute + duration && startMinute < b.startMinute + b.durationMinutes
          )) return;
          createBlockMut.mutate({
            weekDate, dayOfWeek, startMinute, durationMinutes: duration,
            subjectId: data.id, classroomId: classId || undefined,
          });
        }
      } else if (data.type === 'task') {
        const existingBlock = blocks.find(b =>
          b.dayOfWeek === dayOfWeek
          && b.startMinute <= startMinute
          && startMinute < b.startMinute + b.durationMinutes
          && !b.taskId && !b.subjectId
          && (!classId || b.classroomId === classId)
        );
        if (existingBlock) {
          updateBlockMut.mutate({ id: existingBlock.id, data: { taskId: data.id } });
        } else {
          // Create task block directly (no class), use task's default duration
          const task = plannerTasks.find(t => t.id === data.id);
          createBlockMut.mutate({
            weekDate, dayOfWeek, startMinute, durationMinutes: task?.defaultDuration || 30,
            taskId: data.id,
          });
        }
      }
    } catch {
      // ignore invalid data
    }
  };

  const handleSave = () => {
    const payload = {
      weekDate,
      dayOfWeek: formData.dayOfWeek,
      startMinute: formData.startMinute,
      durationMinutes: formData.durationMinutes,
      teacherId: formData.teacherId || undefined,
      subjectId: formData.assignmentType === 'subject' && formData.subjectId ? formData.subjectId : undefined,
      taskId: formData.assignmentType === 'task' && formData.taskId ? formData.taskId : undefined,
      classroomId: formData.classroomId || undefined,
      assignedTeacherIds: formData.assignedTeacherIds.length > 0 ? formData.assignedTeacherIds : undefined,
      notes: formData.notes || undefined,
    };

    if (selectedBlockId) {
      const { weekDate: _w, ...updatePayload } = payload;
      updateBlockMut.mutate({ id: selectedBlockId, data: updatePayload });
    } else {
      createBlockMut.mutate(payload);
    }
  };

  const handleDelete = () => {
    if (!selectedBlockId) return;
    showConfirm('Delete Assignment', 'Delete this assignment?', () => {
      deleteBlockMut.mutate(selectedBlockId);
      setConfirmModal(null);
    }, true);
  };



  const handleFormChange = (partial: Partial<BlockFormData>) => {
    setFormData(prev => {
      const next = { ...prev, ...partial };
      // Auto-select subject when teacher changes
      if (partial.teacherId && partial.teacherId !== prev.teacherId) {
        const teacher = teachers.find(t => t.id === partial.teacherId);
        if (teacher?.allowedSubjectIds && teacher.allowedSubjectIds.length > 0) {
          next.assignmentType = 'subject';
          next.subjectId = teacher.allowedSubjectIds.length === 1 ? teacher.allowedSubjectIds[0] : '';
          next.taskId = '';
        } else {
          next.subjectId = '';
          next.taskId = '';
        }
      }
      return next;
    });
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  // Fixed week planner — no week navigation needed

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', background: C.bg, overflow: 'hidden' }}>
      {/* Left sidebar */}
      <ResourcePanel
        teachers={teachers}
        subjects={subjects}
        tasks={plannerTasks}
        classrooms={classrooms}
        blocks={blocks}
        search={resourceSearch}
        onSearchChange={setResourceSearch}
        onDragStart={setDraggingData}
        onDragEnd={() => setDraggingData(null)}
        onEditResource={(type, id) => {
          if (type === 'tasks' && id) {
            setEditTaskId(id);
          } else {
            navigate(`/settings/timetable/${type}`);
          }
        }}
        onAddTask={(data) => createTask(data).then(() => qc.invalidateQueries({ queryKey: ['planner-tasks'] }))}
      />

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <WeekHeader
          onSave={handleSaveTimetable}
          onLoad={handleLoadTimetable}
          onNew={handleNewTimetable}
          onDelete={handleDeleteTimetable}
          onClearAll={handleClearAll}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={undoStack.current.length >= 2 && !undoRedoPending}
          canRedo={redoStack.current.length > 0 && !undoRedoPending}
          savedTimetables={savedTimetablesList}
          currentTimetableId={currentTimetableId}
          currentTimetableName={currentTimetableName}
          saving={saveTimetableMut.isPending}
          onExport={handleExport}
        />
        <ViewModeSelector mode={viewMode} onChange={(m) => { setViewMode(m); setSelectedFilterId('all'); }} />

        {/* Filter tabs */}
        {(() => {
          const filterItems: Array<{ id: string; label: string }> = [{ id: 'all', label: 'All' }];
          if (viewMode === 'classroom') {
            classrooms.filter(c => c.isActive).forEach(c => filterItems.push({ id: c.id, label: c.name }));
            filterItems.push({ id: 'unassigned', label: 'No Class' });
          } else if (viewMode === 'teacher') {
            teachers.filter(t => t.isActive).forEach(t => filterItems.push({ id: t.id, label: t.name }));
          }
          if (filterItems.length <= 2 && viewMode !== 'task') return null;
          if (viewMode === 'task') return null;
          return (
            <div style={{ display: 'flex', gap: 4, padding: '6px 16px', background: C.card, borderBottom: `1px solid ${C.border}`, overflowX: 'auto', alignItems: 'center' }}>
              {filterItems.map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFilterId(f.id)}
                  style={{
                    padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, whiteSpace: 'nowrap',
                    border: selectedFilterId === f.id ? `1px solid ${C.primary}` : `1px solid ${C.border}`,
                    background: selectedFilterId === f.id ? C.primaryLight : 'transparent',
                    color: selectedFilterId === f.id ? C.primary : C.muted,
                    cursor: 'pointer',
                  }}
                >
                  {f.label}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>
                    <FontAwesomeIcon icon={faListCheck} style={{ marginRight: 4, fontSize: 10 }} />
                    Tasks
                  </span>
                  <button
                    onClick={() => setShowTasks(v => !v)}
                    style={{
                      width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: showTasks ? C.primary : '#cbd5e1',
                      position: 'relative', transition: 'background 0.2s',
                    }}
                  >
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 2,
                      left: showTasks ? 18 : 2,
                      transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                </div>
            </div>
          );
        })()}

        {/* Content */}
        {blocksLoading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 14 }}>
            <FontAwesomeIcon icon={faClock} spin style={{ marginRight: 8 }} />
            Loading schedule...
          </div>
        ) : blocksError ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.danger, fontSize: 14 }}>
            <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: 8 }} />
            Failed to load schedule. Please try again.
          </div>
        ) : (
          <TimetableGrid
            weekDate={weekDate}
            blocks={blocks.filter(b => {
              const isTask = b.taskId && !b.subjectId;
              // Hide tasks if toggle is off
              if (!showTasks && isTask) return false;
              // Task blocks (no class) always show in all views when toggle is on
              if (isTask && !b.classroomId) return true;
              if (selectedFilterId === 'all') return true;
              if (viewMode === 'classroom') {
                if (selectedFilterId === 'unassigned') return !b.classroomId;
                return b.classroomId === selectedFilterId;
              }
              if (viewMode === 'teacher') return b.teacherId === selectedFilterId;
              return true;
            })}
            selectedBlockId={selectedBlockId}
            onSelectBlock={handleSelectBlock}
            onContextMenu={handleContextMenu}
            onCellClick={handleCellClick}
            onDropOnCell={handleDrop}
            dropAllowed={(() => {
              if (!draggingData) return true;
              const classId = getDropClassId();
              if (!classId) return true;
              if (draggingData.type === 'teacher') return validateTeacherForClass(draggingData.id, classId);
              return true;
            })()}
            activeClass={viewMode === 'classroom' && selectedFilterId !== 'all' && selectedFilterId !== 'unassigned'
              ? classrooms.find(c => c.id === selectedFilterId) || null
              : null}
            allClasses={viewMode === 'classroom'
              ? (selectedFilterId === 'all'
                ? classrooms.filter(c => c.isActive && c.startMinute != null && c.endMinute != null)
                : (selectedFilterId !== 'unassigned'
                  ? classrooms.filter(c => c.id === selectedFilterId && c.isActive && c.startMinute != null && c.endMinute != null)
                  : undefined))
              : undefined}
            draggingTeacherId={draggingData?.type === 'teacher' ? draggingData.id : null}
            draggingData={draggingData}
            onDragDataChange={setDraggingData}
            teachers={teachers}
          />
        )}

        {/* Empty state overlay */}
        {!blocksLoading && !blocksError && blocks.length === 0 && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            textAlign: 'center', color: C.muted, pointerEvents: 'none',
          }}>
            <FontAwesomeIcon icon={faCalendarDays} style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>No assignments this week</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Drag resources from the sidebar to start planning.</div>
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 999 }}
          onClick={() => setContextMenu(null)}
          onContextMenu={e => { e.preventDefault(); setContextMenu(null); }}
        >
          <div style={{
            position: 'absolute', top: contextMenu.y, left: contextMenu.x,
            background: C.card, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            border: `1px solid ${C.border}`, overflow: 'hidden', minWidth: 140,
          }}>
            <button
              onClick={() => {
                const block = blocks.find(b => b.id === contextMenu.blockId);
                if (block) openEditBlock(block);
                setContextMenu(null);
              }}
              style={{
                width: '100%', padding: '10px 16px', border: 'none', background: 'none',
                cursor: 'pointer', textAlign: 'left', fontSize: 13, color: C.text,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <FontAwesomeIcon icon={faPen} style={{ fontSize: 11, color: C.muted }} />
              Edit
            </button>
            <div style={{ height: 1, background: C.border }} />
            <button
              onClick={() => {
                deleteBlock(contextMenu.blockId).then(() => {
                  invalidateBlocks();
                  setSelectedBlockId(null);
                });
                setContextMenu(null);
              }}
              style={{
                width: '100%', padding: '10px 16px', border: 'none', background: 'none',
                cursor: 'pointer', textAlign: 'left', fontSize: 13, color: C.danger,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <FontAwesomeIcon icon={faTrash} style={{ fontSize: 11 }} />
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Cell context menu */}
      {cellContextMenu && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 999 }}
          onClick={() => setCellContextMenu(null)}
          onContextMenu={e => { e.preventDefault(); setCellContextMenu(null); }}
        >
          <div style={{
            position: 'absolute', top: cellContextMenu.y, left: cellContextMenu.x,
            background: C.card, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            border: `1px solid ${C.border}`, overflow: 'hidden', minWidth: 160,
          }}>
            <button
              onClick={() => {
                openNewBlock(cellContextMenu.dayOfWeek, cellContextMenu.startMinute);
                setCellContextMenu(null);
              }}
              style={{
                width: '100%', padding: '10px 16px', border: 'none', background: 'none',
                cursor: 'pointer', textAlign: 'left', fontSize: 13, color: C.text,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <FontAwesomeIcon icon={faPlus} style={{ fontSize: 11, color: C.primary }} />
              New Assignment
            </button>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {confirmModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmModal(null); }}
        >
          <div style={{ width: 380, background: C.card, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{confirmModal.title}</span>
            </div>
            <div style={{ padding: '16px 20px', fontSize: 13, color: C.text, lineHeight: 1.5 }}>
              {confirmModal.message}
            </div>
            <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setConfirmModal(null)} style={btnGhost}>Cancel</button>
              <button
                onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
                style={confirmModal.danger ? btnDanger : btnPrimary}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save timetable modal */}
      {saveModalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}
          onClick={e => { if (e.target === e.currentTarget) setSaveModalOpen(false); }}
        >
          <div style={{ width: 360, background: C.card, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Save Timetable</span>
              <button onClick={() => setSaveModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 16 }}>
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 4, display: 'block' }}>Name</label>
              <input
                autoFocus
                style={{ ...inputStyle, width: '100%' }}
                value={saveModalName}
                onChange={e => { setSaveModalName(e.target.value); setSaveModalError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveModalConfirm(); }}
                placeholder="e.g. Week 1 Draft"
              />
              {saveModalError && (
                <div style={{ marginTop: 6, fontSize: 12, color: C.danger, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 10 }} />
                  {saveModalError}
                </div>
              )}
            </div>
            <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setSaveModalOpen(false)} style={btnGhost}>Cancel</button>
              <button onClick={handleSaveModalConfirm} style={btnPrimary}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Right drawer */}
      {drawerOpen && (
        <AssignmentDrawer
          block={selectedBlock}
          formData={formData}
          onChange={handleFormChange}
          teachers={teachers}
          subjects={subjects}
          tasks={plannerTasks}
          classrooms={classrooms}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={closeDrawer}
          saving={createBlockMut.isPending || updateBlockMut.isPending}
          error={saveError}
          allBlocks={blocks}
        />
      )}



      {/* Edit task modal */}
      {editTaskId && (() => {
        const task = plannerTasks.find(t => t.id === editTaskId);
        if (!task) return null;
        return <EditTaskModal
          task={task}
          onClose={() => setEditTaskId(null)}
          onSave={(data) => {
            updateTask(task.id, data).then(() => {
              qc.invalidateQueries({ queryKey: ['planner-tasks'] });
              setEditTaskId(null);
            });
          }}
          onDelete={() => {
            deleteTask(task.id).then(() => {
              qc.invalidateQueries({ queryKey: ['planner-tasks'] });
              setEditTaskId(null);
            });
          }}
        />;
      })()}

    </div>
  );
}
