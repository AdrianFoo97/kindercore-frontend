import { useParams, useNavigate } from 'react-router-dom';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faPen, faTrash, faChevronLeft, faXmark, faEllipsisVertical } from '@fortawesome/free-solid-svg-icons';
import {
  fetchTeachers, createTeacher, updateTeacher, deleteTeacher,
  fetchClassrooms, createClassroom, updateClassroom, deleteClassroom,
  fetchSubjects, createSubject, updateSubject, deleteSubject,
  fetchTasks, createTask, updateTask, deleteTask,
} from '../../api/planner.js';
import { Teacher, Classroom, PlannerSubject, PlannerTask } from '../../types/index.js';
import { SettingsBreadcrumb } from '../../components/common/SettingsBreadcrumb.js';

const C = {
  primary: '#5a67d8', primaryLight: '#eef0fa', card: '#fff', text: '#1e293b',
  muted: '#94a3b8', border: '#e2e8f0', danger: '#ef4444', success: '#22c55e',
};
const PRESET_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#6b7280','#0ea5e9','#14b8a6','#a855f7'];
const TASK_CATEGORIES = [
  { value: 'TEACHING', label: 'Teaching' }, { value: 'ADMIN', label: 'Admin' },
  { value: 'DUTY', label: 'Duty' }, { value: 'BREAK', label: 'Break' }, { value: 'OTHER', label: 'Other' },
];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
function minutesToTime(m: number): string {
  const h = Math.floor(m / 60), mm = m % 60, p = h >= 12 ? 'PM' : 'AM';
  return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(mm).padStart(2, '0')} ${p}`;
}

const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 6, outline: 'none', boxSizing: 'border-box' };
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 3, display: 'block' };
const tag = (active: boolean, activeColor = C.primary): React.CSSProperties => ({
  padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 12, border: 'none', cursor: 'pointer',
  background: active ? activeColor : '#f1f5f9', color: active ? '#fff' : C.muted, transition: 'all 0.1s',
});
const dayBtn = (active: boolean): React.CSSProperties => ({
  width: 36, height: 30, fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none', cursor: 'pointer',
  background: active ? C.primary : '#f1f5f9', color: active ? '#fff' : C.muted,
});

type ResourceType = 'teachers' | 'classes' | 'subjects' | 'tasks';

export default function TimetableSettingsPage() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const resourceType = (type || 'teachers') as ResourceType;

  const { data: teachers = [] } = useQuery({ queryKey: ['planner-teachers'], queryFn: fetchTeachers });
  const { data: classrooms = [] } = useQuery({ queryKey: ['planner-classrooms'], queryFn: fetchClassrooms });
  const { data: subjects = [] } = useQuery({ queryKey: ['planner-subjects'], queryFn: fetchSubjects });
  const { data: tasks = [] } = useQuery({ queryKey: ['planner-tasks'], queryFn: fetchTasks });

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [capacity, setCapacity] = useState('');
  const [category, setCategory] = useState('TEACHING');
  const [defaultDuration, setDefaultDuration] = useState('60');
  const [classLessonsMap, setClassLessonsMap] = useState<Record<string, string>>({});
  const [allowedSubjectIds, setAllowedSubjectIds] = useState<string[]>([]);
  const [allowedClassroomIds, setAllowedClassroomIds] = useState<string[]>([]);
  const [workStartMinute, setWorkStartMinute] = useState<number | ''>('');
  const [workEndMinute, setWorkEndMinute] = useState<number | ''>('');
  const [workDays, setWorkDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [classStartMinute, setClassStartMinute] = useState<number | ''>('');
  const [classEndMinute, setClassEndMinute] = useState<number | ''>('');
  const [classDays, setClassDays] = useState<number[]>([0, 1, 2, 3, 4]);

  const reset = () => {
    setName(''); setColor(PRESET_COLORS[0]); setCapacity(''); setCategory('TEACHING');
    setDefaultDuration('60'); setClassLessonsMap({});
    setEditingId(null); setAllowedSubjectIds([]); setAllowedClassroomIds([]);
    setClassStartMinute(''); setClassEndMinute(''); setClassDays([0, 1, 2, 3, 4]);
    setWorkStartMinute(''); setWorkEndMinute(''); setWorkDays([0, 1, 2, 3, 4]);
    setFormOpen(false);
  };

  const openNew = () => {
    if (resourceType === 'teachers') { navigate('/teachers/new'); return; }
    reset(); setFormOpen(true);
  };
  const openEdit = (item: any) => {
    setEditingId(item.id); setName(item.name);
    if (item.color) setColor(item.color);
    if (item.capacity != null) setCapacity(String(item.capacity));
    if (item.category) setCategory(item.category);
    setDefaultDuration(item.defaultDuration != null ? String(item.defaultDuration) : '60');
    if (item.classLessons) {
      const m: Record<string, string> = {};
      for (const [k, v] of Object.entries(item.classLessons as Record<string, number>)) m[k] = String(v);
      setClassLessonsMap(m);
    } else setClassLessonsMap({});
    setAllowedSubjectIds(item.allowedSubjectIds || []);
    setAllowedClassroomIds(item.allowedClassroomIds || []);
    setWorkStartMinute(item.workStartMinute ?? ''); setWorkEndMinute(item.workEndMinute ?? '');
    setWorkDays(item.workDays || [0, 1, 2, 3, 4]);
    setClassStartMinute(item.startMinute ?? ''); setClassEndMinute(item.endMinute ?? '');
    setClassDays(item.daysOfWeek || [0, 1, 2, 3, 4]);
    setFormOpen(true);
  };

  // Mutations
  const inv = (k: string) => () => { qc.invalidateQueries({ queryKey: [k] }); reset(); };
  const createTeacherMut = useMutation({ mutationFn: createTeacher, onSuccess: inv('planner-teachers') });
  const updateTeacherMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: any }) => updateTeacher(id, data), onSuccess: inv('planner-teachers') });
  const deleteTeacherMut = useMutation({ mutationFn: deleteTeacher, onSuccess: () => qc.invalidateQueries({ queryKey: ['planner-teachers'] }) });
  const createClassroomMut = useMutation({ mutationFn: createClassroom, onSuccess: inv('planner-classrooms') });
  const updateClassroomMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: any }) => updateClassroom(id, data), onSuccess: inv('planner-classrooms') });
  const deleteClassroomMut = useMutation({ mutationFn: deleteClassroom, onSuccess: () => qc.invalidateQueries({ queryKey: ['planner-classrooms'] }) });
  const createSubjectMut = useMutation({ mutationFn: createSubject, onSuccess: inv('planner-subjects') });
  const updateSubjectMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: any }) => updateSubject(id, data), onSuccess: inv('planner-subjects') });
  const deleteSubjectMut = useMutation({ mutationFn: deleteSubject, onSuccess: () => qc.invalidateQueries({ queryKey: ['planner-subjects'] }) });
  const createTaskMut = useMutation({ mutationFn: createTask, onSuccess: inv('planner-tasks') });
  const updateTaskMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: any }) => updateTask(id, data), onSuccess: inv('planner-tasks') });
  const deleteTaskMut = useMutation({ mutationFn: deleteTask, onSuccess: () => qc.invalidateQueries({ queryKey: ['planner-tasks'] }) });

  const items = useMemo(() => {
    if (resourceType === 'teachers') return teachers;
    if (resourceType === 'classes') return classrooms.filter((c: any) => c.isActive);
    if (resourceType === 'subjects') return subjects;
    return tasks;
  }, [resourceType, teachers, classrooms, subjects, tasks]);

  const title = resourceType === 'teachers' ? 'Teachers' : resourceType === 'classes' ? 'Classes' : resourceType === 'subjects' ? 'Subjects' : 'Tasks';
  const singular = title.slice(0, -1);
  const activeClasses = classrooms.filter((c: any) => c.isActive);

  const handleSave = () => {
    if (!name.trim()) return;
    if (resourceType === 'teachers') {
      const d = { name: name.trim(), color, allowedSubjectIds: allowedSubjectIds.length > 0 ? allowedSubjectIds : undefined, allowedClassroomIds: allowedClassroomIds.length > 0 ? allowedClassroomIds : undefined, workStartMinute: workStartMinute !== '' ? workStartMinute : undefined, workEndMinute: workEndMinute !== '' ? workEndMinute : undefined, workDays: workDays.length > 0 ? workDays : undefined };
      editingId ? updateTeacherMut.mutate({ id: editingId, data: d }) : createTeacherMut.mutate(d as any);
    } else if (resourceType === 'classes') {
      const d = { name: name.trim(), capacity: capacity ? Number(capacity) : undefined, startMinute: classStartMinute !== '' ? classStartMinute : undefined, endMinute: classEndMinute !== '' ? classEndMinute : undefined, daysOfWeek: classDays.length > 0 ? classDays : undefined };
      editingId ? updateClassroomMut.mutate({ id: editingId, data: d }) : createClassroomMut.mutate(d);
    } else if (resourceType === 'subjects') {
      const dd = defaultDuration ? Number(defaultDuration) : undefined;
      const cl: Record<string, number> = {};
      for (const [k, v] of Object.entries(classLessonsMap)) { if (v && Number(v) > 0) cl[k] = Number(v); }
      const clData = Object.keys(cl).length > 0 ? cl : null;
      editingId ? updateSubjectMut.mutate({ id: editingId, data: { name: name.trim(), color, defaultDuration: dd ?? null, classLessons: clData } }) : createSubjectMut.mutate({ name: name.trim(), color, defaultDuration: dd, classLessons: clData ?? undefined });
    } else {
      editingId ? updateTaskMut.mutate({ id: editingId, data: { name: name.trim(), category, color } }) : createTaskMut.mutate({ name: name.trim(), category, color });
    }
  };

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    if (resourceType === 'teachers') deleteTeacherMut.mutate(id);
    else if (resourceType === 'classes') deleteClassroomMut.mutate(id);
    else if (resourceType === 'subjects') deleteSubjectMut.mutate(id);
    else deleteTaskMut.mutate(id);
    setDeleteConfirm(null);
  };

  const timeSlots = useMemo(() => { const s: number[] = []; for (let m = 420; m <= 1080; m += 30) s.push(m); return s; }, []);
  const hasColor = resourceType !== 'classes';

  // Build teacher detail info
  const getTeacherDetails = (t: any) => {
    const parts: string[] = [];
    if (t.workStartMinute != null) parts.push(`${minutesToTime(t.workStartMinute)} - ${minutesToTime(t.workEndMinute)}`);
    return parts;
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <SettingsBreadcrumb label={title} />
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>{title}</h1>
          <span style={{ fontSize: 12, color: C.muted, background: '#f1f5f9', padding: '2px 8px', borderRadius: 10 }}>{items.length}</span>
        </div>
        <button onClick={openNew} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: C.primary, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <FontAwesomeIcon icon={faPlus} style={{ fontSize: 11 }} />
          Add {singular}
        </button>
      </div>

      {/* Form modal */}
      {formOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}
          onClick={e => { if (e.target === e.currentTarget) reset(); }}>
        <div style={{ width: 500, maxWidth: '92vw', maxHeight: '85vh', background: C.card, borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.text, letterSpacing: -0.3 }}>{editingId ? `Edit ${singular}` : `New ${singular}`}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                {editingId ? 'Update the details below' : `Add a new ${singular.toLowerCase()} to the timetable`}
              </div>
            </div>
            <button onClick={reset} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: C.muted, width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#e2e8f0')} onMouseLeave={e => (e.currentTarget.style.background = '#f1f5f9')}>
              <FontAwesomeIcon icon={faXmark} style={{ fontSize: 14 }} />
            </button>
          </div>
          <div style={{ height: 1, background: C.border, margin: '0 24px' }} />
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Name + Color */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Name</label>
              <input style={{ ...inp, padding: '10px 12px', fontSize: 14 }} value={name} onChange={e => setName(e.target.value)} placeholder={`Enter ${singular.toLowerCase()} name`} autoFocus />
            </div>
            {hasColor && (
              <div>
                <label style={lbl}>Color</label>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', maxWidth: 170 }}>
                  {PRESET_COLORS.map(c => (
                    <div key={c} onClick={() => setColor(c)} style={{
                      width: 24, height: 24, borderRadius: 8, background: c, cursor: 'pointer',
                      outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 2, transition: 'outline 0.1s',
                    }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Teacher fields */}
          {resourceType === 'teachers' && (
            <>
              {/* Schedule section */}
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Schedule</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ width: 120 }}>
                    <label style={{ ...lbl, fontSize: 10 }}>Start</label>
                    <select style={{ ...inp, padding: '7px 8px', fontSize: 12 }} value={workStartMinute} onChange={e => setWorkStartMinute(e.target.value ? Number(e.target.value) : '')}>
                      <option value="">--</option>
                      {timeSlots.map(m => <option key={m} value={m}>{minutesToTime(m)}</option>)}
                    </select>
                  </div>
                  <div style={{ width: 120 }}>
                    <label style={{ ...lbl, fontSize: 10 }}>End</label>
                    <select style={{ ...inp, padding: '7px 8px', fontSize: 12 }} value={workEndMinute} onChange={e => setWorkEndMinute(e.target.value ? Number(e.target.value) : '')}>
                      <option value="">--</option>
                      {timeSlots.map(m => <option key={m} value={m}>{minutesToTime(m)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ ...lbl, fontSize: 10 }}>Days</label>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {DAYS.map((d, i) => <button key={i} onClick={() => setWorkDays(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i])} style={{ ...dayBtn(workDays.includes(i)), width: 34, height: 28, fontSize: 10 }}>{d}</button>)}
                    </div>
                  </div>
                </div>
              </div>
              {/* Permissions section */}
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Permissions</div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ ...lbl, fontSize: 10 }}>Can teach subjects</label>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {subjects.map(s => <button key={s.id} onClick={() => setAllowedSubjectIds(p => p.includes(s.id) ? p.filter(x => x !== s.id) : [...p, s.id])} style={tag(allowedSubjectIds.includes(s.id), s.color)}>{s.name}</button>)}
                    {subjects.length === 0 && <span style={{ fontSize: 11, color: C.muted, fontStyle: 'italic' }}>No subjects configured</span>}
                  </div>
                </div>
                <div>
                  <label style={{ ...lbl, fontSize: 10 }}>Can teach classes</label>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {activeClasses.map((c: any) => <button key={c.id} onClick={() => setAllowedClassroomIds(p => p.includes(c.id) ? p.filter(x => x !== c.id) : [...p, c.id])} style={tag(allowedClassroomIds.includes(c.id))}>{c.name}</button>)}
                    {activeClasses.length === 0 && <span style={{ fontSize: 11, color: C.muted, fontStyle: 'italic' }}>No classes configured</span>}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Class fields */}
          {resourceType === 'classes' && (
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Schedule</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ width: 70 }}>
                  <label style={{ ...lbl, fontSize: 10 }}>Capacity</label>
                  <input style={{ ...inp, padding: '7px 8px', fontSize: 12 }} type="number" min="1" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="#" />
                </div>
                <div style={{ width: 120 }}>
                  <label style={{ ...lbl, fontSize: 10 }}>Start</label>
                  <select style={{ ...inp, padding: '7px 8px', fontSize: 12 }} value={classStartMinute} onChange={e => setClassStartMinute(e.target.value ? Number(e.target.value) : '')}>
                    <option value="">--</option>
                    {timeSlots.map(m => <option key={m} value={m}>{minutesToTime(m)}</option>)}
                  </select>
                </div>
                <div style={{ width: 120 }}>
                  <label style={{ ...lbl, fontSize: 10 }}>End</label>
                  <select style={{ ...inp, padding: '7px 8px', fontSize: 12 }} value={classEndMinute} onChange={e => setClassEndMinute(e.target.value ? Number(e.target.value) : '')}>
                    <option value="">--</option>
                    {timeSlots.map(m => <option key={m} value={m}>{minutesToTime(m)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ ...lbl, fontSize: 10 }}>Days</label>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {DAYS.map((d, i) => <button key={i} onClick={() => setClassDays(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i])} style={{ ...dayBtn(classDays.includes(i)), width: 34, height: 28, fontSize: 10 }}>{d}</button>)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Subject fields */}
          {resourceType === 'subjects' && (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 160 }}>
                  <label style={lbl}>Default Duration</label>
                  <select style={{ ...inp, padding: '10px 12px' }} value={defaultDuration} onChange={e => setDefaultDuration(e.target.value)}>
                    <option value="30">30 min</option>
                    <option value="60">1 hour</option>
                    <option value="90">1.5 hours</option>
                    <option value="120">2 hours</option>
                  </select>
                </div>
              </div>
              {activeClasses.length > 0 && (
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Weekly Lessons per Class</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {activeClasses.map((cls: any) => (
                      <div key={cls.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', borderRadius: 8, padding: '6px 10px', border: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{cls.name}</span>
                        <input style={{ ...inp, width: 42, padding: '4px', fontSize: 12, textAlign: 'center', border: `1px solid ${C.border}`, borderRadius: 6 }} type="number" min="0" value={classLessonsMap[cls.id] || ''} onChange={e => setClassLessonsMap(p => ({ ...p, [cls.id]: e.target.value }))} placeholder="0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Task fields */}
          {resourceType === 'tasks' && (
            <div style={{ width: 180 }}>
              <label style={lbl}>Category</label>
              <select style={{ ...inp, padding: '10px 12px' }} value={category} onChange={e => setCategory(e.target.value)}>
                {TASK_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          )}

          </div>
          {/* Actions */}
          <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={reset} style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.text, cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')} onMouseLeave={e => (e.currentTarget.style.background = C.card)}>
              Cancel
            </button>
            <button onClick={handleSave} style={{ padding: '9px 24px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: C.primary, color: '#fff', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#4c51bf')} onMouseLeave={e => (e.currentTarget.style.background = C.primary)}>
              {editingId ? 'Save Changes' : `Add ${singular}`}
            </button>
          </div>
        </div>
        </div>
      )}

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.length === 0 && !formOpen && (
          <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 13, background: C.card, borderRadius: 10, border: `1px solid ${C.border}` }}>
            No {title.toLowerCase()} yet. Click "Add {singular}" to get started.
          </div>
        )}
        {items.map((item: any) => (
          <div key={item.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
            background: editingId === item.id ? C.primaryLight : C.card,
            borderRadius: 8, border: `1px solid ${editingId === item.id ? C.primary + '40' : C.border}`,
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { if (editingId !== item.id) e.currentTarget.style.borderColor = '#cbd5e1'; }}
            onMouseLeave={e => { if (editingId !== item.id) e.currentTarget.style.borderColor = C.border; }}
          >
            {/* Color dot */}
            {hasColor && <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color || C.muted, flexShrink: 0 }} />}

            {/* Name + details */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{item.name}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
                {/* Teacher details */}
                {resourceType === 'teachers' && (
                  <>
                    {item.workStartMinute != null && (
                      <span style={{ fontSize: 10, color: C.muted, background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>
                        {minutesToTime(item.workStartMinute)} - {minutesToTime(item.workEndMinute)}
                      </span>
                    )}
                    {item.allowedSubjectIds?.map((sid: string) => {
                      const s = subjects.find((x: any) => x.id === sid);
                      return s ? <span key={sid} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: s.color + '20', color: s.color, fontWeight: 600 }}>{s.name}</span> : null;
                    })}
                    {item.allowedClassroomIds?.map((cid: string) => {
                      const c = classrooms.find((x: any) => x.id === cid);
                      return c ? <span key={cid} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: C.primaryLight, color: C.primary, fontWeight: 600 }}>{c.name}</span> : null;
                    })}
                  </>
                )}
                {/* Class details */}
                {resourceType === 'classes' && (
                  <>
                    {item.startMinute != null && (
                      <span style={{ fontSize: 10, color: C.muted, background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>
                        {minutesToTime(item.startMinute)} - {minutesToTime(item.endMinute)}
                      </span>
                    )}
                    {item.capacity && <span style={{ fontSize: 10, color: C.muted, background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>Cap: {item.capacity}</span>}
                  </>
                )}
                {/* Subject details */}
                {resourceType === 'subjects' && (
                  <>
                    {item.defaultDuration && <span style={{ fontSize: 10, color: C.muted, background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>{item.defaultDuration}m</span>}
                    {item.classLessons && Object.entries(item.classLessons as Record<string, number>).map(([cid, count]) => {
                      const c = classrooms.find((x: any) => x.id === cid);
                      return c ? <span key={cid} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: C.primaryLight, color: C.primary, fontWeight: 600 }}>{c.name}: {count}/wk</span> : null;
                    })}
                  </>
                )}
                {/* Task details */}
                {resourceType === 'tasks' && (
                  <span style={{ fontSize: 10, color: C.muted, background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>{item.category}</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <button onClick={() => resourceType === 'teachers' ? navigate(`/teachers/${item.id}`) : openEdit(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: '6px 8px', borderRadius: 6 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <FontAwesomeIcon icon={faPen} style={{ fontSize: 12 }} />
            </button>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: '6px 8px', borderRadius: 6 }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                <FontAwesomeIcon icon={faEllipsisVertical} style={{ fontSize: 14 }} />
              </button>
              {menuOpenId === item.id && (
                <MoreMenu
                  onDelete={() => { setMenuOpenId(null); setDeleteConfirm({ id: item.id, name: item.name }); }}
                  onClose={() => setMenuOpenId(null)}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}
          onClick={e => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}>
          <div style={{ width: 380, background: C.card, borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px 16px' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Delete {singular}</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
                Are you sure you want to delete <strong style={{ color: C.text }}>{deleteConfirm.name}</strong>? This action cannot be undone.
              </div>
            </div>
            <div style={{ padding: '12px 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.text, cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')} onMouseLeave={e => (e.currentTarget.style.background = C.card)}>
                Cancel
              </button>
              <button onClick={confirmDelete} style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: C.danger, color: '#fff', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#dc2626')} onMouseLeave={e => (e.currentTarget.style.background = C.danger)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MoreMenu({ onDelete, onClose }: { onDelete: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 20,
      background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: 140, overflow: 'hidden',
    }}>
      <button
        onClick={onDelete}
        onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
        onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '9px 14px', fontSize: 13, fontWeight: 500, color: C.danger,
          background: '#fff', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <FontAwesomeIcon icon={faTrash} style={{ fontSize: 11 }} />
        Delete
      </button>
    </div>
  );
}
