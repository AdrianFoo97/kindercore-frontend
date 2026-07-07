import { useState, useEffect, useMemo, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faCalendarDays, faBriefcase, faPlus, faTrash, faCoins, faPen, faStar, faArrowUp, faChevronLeft, faRoad } from '@fortawesome/free-solid-svg-icons';
import {
  fetchTeachers, createTeacher, updateTeacher,
  fetchClassrooms, fetchSubjects,
} from '../../api/planner.js';
import { fetchPositions, fetchLevelIncentives } from '../../api/salary.js';
import { fetchCareerRecords, createCareerRecord, updateCareerRecord, deleteCareerRecord } from '../../api/career.js';
import { fetchAllowanceTypes, fetchTeacherAllowances, upsertTeacherAllowances } from '../../api/allowance.js';
import { fetchTeacherAppraisals, upsertTeacherAppraisal, deleteTeacherAppraisal, TeacherAppraisal } from '../../api/teacher-appraisals.js';
import { useToast } from '../../components/common/Toast.js';
import { useDeleteDialog } from '../../components/common/DeleteDialog.js';

const C = {
  primary: '#5a67d8', primaryLight: '#eef0fa', card: '#fff', text: '#1e293b',
  muted: '#94a3b8', sub: '#475569', border: '#e2e8f0', green: '#059669',
};
const PRESET_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#6b7280','#0ea5e9','#14b8a6','#a855f7'];

function randomHexColor(): string {
  // HSL-based random for nicer, more saturated colors
  const h = Math.floor(Math.random() * 360);
  const s = 55 + Math.floor(Math.random() * 25); // 55-80%
  const l = 45 + Math.floor(Math.random() * 15); // 45-60%
  // Convert HSL to hex
  const a = s * Math.min(l, 100 - l) / 10000;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function pickUnusedColor(usedColors: string[]): string {
  const used = new Set(usedColors.map(c => c?.toLowerCase()));
  const available = PRESET_COLORS.filter(c => !used.has(c.toLowerCase()));
  if (available.length > 0) return available[0];
  return randomUnusedHexColor(usedColors);
}

function randomUnusedHexColor(usedColors: string[]): string {
  const used = new Set(usedColors.filter(Boolean).map(c => c.toLowerCase()));
  for (let i = 0; i < 50; i++) {
    const c = randomHexColor();
    if (!used.has(c.toLowerCase())) return c;
  }
  return randomHexColor();
}
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
type Tab = 'personal' | 'operations' | 'career' | 'salary';

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60), mm = m % 60, p = h >= 12 ? 'PM' : 'AM';
  return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(mm).padStart(2, '0')} ${p}`;
}

// Detect the system-managed Level Allowance row by name. The amount
// for this row is auto-derived from the position+level matrix, not
// editable per teacher.
function isLevelAllowance(name: string): boolean {
  return name.trim().toLowerCase() === 'level allowance';
}

export default function EditTeacherPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { confirm: confirmDeleteRecord } = useDeleteDialog();
  const isNew = id === 'new';

  const { data: teachers = [] } = useQuery({ queryKey: ['planner-teachers'], queryFn: fetchTeachers });
  const { data: classrooms = [] } = useQuery({ queryKey: ['planner-classrooms'], queryFn: fetchClassrooms });
  const { data: subjects = [] } = useQuery({ queryKey: ['planner-subjects'], queryFn: fetchSubjects });
  const { data: allPositions = [] } = useQuery({ queryKey: ['salary-positions'], queryFn: fetchPositions });
  const { data: allIncentives = [] } = useQuery({ queryKey: ['salary-incentives'], queryFn: fetchLevelIncentives });
  const { data: careerHistory = [] } = useQuery({
    queryKey: ['career-records', id],
    queryFn: () => fetchCareerRecords(id!),
    enabled: !isNew && !!id,
  });
  const { data: allowTypes = [] } = useQuery({ queryKey: ['allowance-types'], queryFn: fetchAllowanceTypes });
  const { data: teacherAllowanceData = [] } = useQuery({
    queryKey: ['teacher-allowances', id],
    queryFn: () => fetchTeacherAllowances(id!),
    enabled: !isNew && !!id,
  });
  const activeClasses = classrooms.filter((c: any) => c.isActive);

  const teacher = useMemo(() => isNew ? null : teachers.find((t: any) => t.id === id), [teachers, id, isNew]);

  const [tab, setTab] = useState<Tab>('personal');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [resignedAt, setResignedAt] = useState('');
  const [joinedAt, setJoinedAt] = useState('');
  const [employmentType, setEmploymentType] = useState('full-time');
  const [allowedSubjectIds, setAllowedSubjectIds] = useState<string[]>([]);
  const [allowedClassroomIds, setAllowedClassroomIds] = useState<string[]>([]);
  const [workStartMinute, setWorkStartMinute] = useState<number | ''>('');
  const [workEndMinute, setWorkEndMinute] = useState<number | ''>('');
  const [workDays, setWorkDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [positionId, setPositionId] = useState<string>('');
  const [level, setLevel] = useState(0);
  const [allowanceDrafts, setAllowanceDrafts] = useState<Record<string, number>>({});
  const [allowanceSaving, setAllowanceSaving] = useState(false);
  const [salaryType, setSalaryType] = useState<'formula' | 'fixed' | 'hourly'>('formula');
  const [fixedSalaryAmount, setFixedSalaryAmount] = useState(0);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [excludeFromProfitShare, setExcludeFromProfitShare] = useState(false);
  const [overrideProfitShareWeight, setOverrideProfitShareWeight] = useState(false);
  const [customProfitShareWeight, setCustomProfitShareWeight] = useState<number>(0);
  const [hasEpf, setHasEpf] = useState(true);
  const [hasSocso, setHasSocso] = useState(true);
  const [hasEis, setHasEis] = useState(true);
  const isFixedSalary = salaryType === 'fixed';
  const isHourly = salaryType === 'hourly';
  const [loaded, setLoaded] = useState(false);
  const [showCareerForm, setShowCareerForm] = useState(false);
  const [careerPosId, setCareerPosId] = useState('');
  const [careerLevel, setCareerLevel] = useState(0);
  const [careerDate, setCareerDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [careerNotes, setCareerNotes] = useState('');
  const [careerSaving, setCareerSaving] = useState(false);
  const [editingCareerRecId, setEditingCareerRecId] = useState<string | null>(null);
  const [editCareerPosId, setEditCareerPosId] = useState('');
  const [editCareerLevel, setEditCareerLevel] = useState(0);
  const [editCareerDate, setEditCareerDate] = useState('');

  useEffect(() => {
    if (isNew) {
      if (!loaded && teachers.length > 0) {
        setColor(pickUnusedColor(teachers.map((t: any) => t.color)));
      }
      setLoaded(true);
      return;
    }
    if (teacher && !loaded) {
      setName(teacher.name);
      setPhone(teacher.phone ?? '');
      setColor(teacher.color || PRESET_COLORS[0]);
      setResignedAt(teacher.resignedAt ? teacher.resignedAt.slice(0, 10) : '');
      setJoinedAt(teacher.createdAt ? teacher.createdAt.slice(0, 10) : '');
      setEmploymentType(teacher.employmentType ?? 'full-time');
      setAllowedSubjectIds(teacher.allowedSubjectIds || []);
      setAllowedClassroomIds(teacher.allowedClassroomIds || []);
      setWorkStartMinute(teacher.workStartMinute ?? '');
      setWorkEndMinute(teacher.workEndMinute ?? '');
      setWorkDays(teacher.workDays || [0, 1, 2, 3, 4]);
      setPositionId(teacher.positionId ?? '');
      setLevel(teacher.level ?? 0);
      setSalaryType((teacher.salaryType as any) ?? (teacher.isFixedSalary ? 'fixed' : 'formula'));
      setFixedSalaryAmount(teacher.fixedSalaryAmount ?? 0);
      setHourlyRate(teacher.hourlyRate ?? 0);
      setExcludeFromProfitShare(teacher.excludeFromProfitShare ?? false);
      setOverrideProfitShareWeight(teacher.overrideProfitShareWeight ?? false);
      setCustomProfitShareWeight(teacher.customProfitShareWeight ?? 0);
      setHasEpf(teacher.hasEpf ?? true);
      setHasSocso(teacher.hasSocso ?? true);
      setHasEis(teacher.hasEis ?? true);
      setLoaded(true);
    }
  }, [teacher, isNew, loaded]);

  // Load teacher allowances into draft state
  useEffect(() => {
    if (teacherAllowanceData.length > 0) {
      const m: Record<string, number> = {};
      for (const a of teacherAllowanceData) {
        m[a.allowanceTypeId] = a.amount;
      }
      setAllowanceDrafts(m);
    }
  }, [teacherAllowanceData]);

  const getAmt = (typeId: string) => allowanceDrafts[typeId] ?? 0;
  const setAmt = (typeId: string, v: number) => setAllowanceDrafts(prev => ({ ...prev, [typeId]: v }));

  // Show every allowance type — admins can rename them but the set
  // is fixed system-wide. Each row carries its own enable checkbox so
  // a teacher with 0 KPI Allowance is explicitly opted out, not just
  // a default-zero accident. If the DB doesn't yet have a Level
  // Allowance row (server seed hasn't run), we synthesize one so the
  // UI is consistent regardless of seed state. The "Level Allowance"
  // row is skipped from totalAllowances because the level incentive
  // is added separately in totalSalary (avoid double-counting).
  const visibleAllowTypes = (() => {
    const list: any[] = [...allowTypes];
    const hasLevel = list.some(at => isLevelAllowance(at.name));
    if (!hasLevel) {
      list.push({
        id: '__virtual_level_allowance__',
        name: 'Level Allowance',
        isDefault: true,
        sortOrder: 99,
        parentId: null,
      });
    }
    return list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  })();
  const totalAllowances = visibleAllowTypes.reduce((sum, at) => {
    if (isLevelAllowance(at.name)) return sum;
    return sum + getAmt(at.id);
  }, 0);

  const timeSlots = useMemo(() => { const slots: number[] = []; for (let m = 420; m <= 1080; m += 30) slots.push(m); return slots; }, []);

  const handleSaveAllowancesOnly = async () => {
    if (!id) return;
    setAllowanceSaving(true);
    try {
      await saveAllowances(id);
      qc.invalidateQueries({ queryKey: ['teacher-allowances', id] });
      qc.invalidateQueries({ queryKey: ['salary-teachers'] });
      showToast('Allowances saved');
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to save', 'error');
    }
    setAllowanceSaving(false);
  };

  const saveAllowances = async (teacherId: string) => {
    // Exclude Level Allowance — its value is derived from the level
    // incentive matrix and isn't stored as a TeacherAllowance row.
    // Also skip the synthetic placeholder if the DB row doesn't exist
    // yet (seed hasn't run).
    const entries = visibleAllowTypes
      .filter(at => !isLevelAllowance(at.name) && !String(at.id).startsWith('__virtual'))
      .map(at => ({ allowanceTypeId: at.id, amount: getAmt(at.id) }));
    await upsertTeacherAllowances(teacherId, entries);
  };

  const createMut = useMutation({
    mutationFn: createTeacher,
    onSuccess: async (data: any) => {
      if (data?.id) await saveAllowances(data.id);
      qc.invalidateQueries({ queryKey: ['planner-teachers'] }); qc.invalidateQueries({ queryKey: ['salary-teachers'] }); showToast(`${name.trim()} added`); navigate('/teachers');
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateTeacher(id, data),
    onSuccess: async () => {
      await saveAllowances(id!);
      qc.invalidateQueries({ queryKey: ['planner-teachers'] }); qc.invalidateQueries({ queryKey: ['salary-teachers'] }); qc.invalidateQueries({ queryKey: ['teacher-allowances', id] }); showToast(`${name.trim()} updated`); navigate('/teachers');
    },
  });

  const handleSave = () => {
    if (!name.trim()) return;
    const d = {
      name: name.trim(), color, phone: phone.trim() || null,
      employmentType,
      // isActive is reserved for soft-delete. Active/inactive status is
      // derived from resignedAt vs today.
      resignedAt: resignedAt || null,
      createdAt: joinedAt || null,
      allowedSubjectIds: allowedSubjectIds.length > 0 ? allowedSubjectIds : undefined,
      allowedClassroomIds: allowedClassroomIds.length > 0 ? allowedClassroomIds : undefined,
      workStartMinute: workStartMinute !== '' ? workStartMinute : undefined,
      workEndMinute: workEndMinute !== '' ? workEndMinute : undefined,
      workDays: workDays.length > 0 ? workDays : undefined,
      positionId: positionId || null, level,
      salaryType,
      isFixedSalary: salaryType === 'fixed',
      fixedSalaryAmount: salaryType === 'fixed' ? fixedSalaryAmount : null,
      hourlyRate: salaryType === 'hourly' ? hourlyRate : null,
      excludeFromProfitShare,
      overrideProfitShareWeight,
      customProfitShareWeight: overrideProfitShareWeight ? customProfitShareWeight : null,
      hasEpf, hasSocso, hasEis,
    };
    if (isNew) createMut.mutate(d as any);
    else updateMut.mutate({ id: id!, data: d });
  };

  const saving = createMut.isPending || updateMut.isPending;

  const handleAddCareer = async () => {
    if (!careerPosId || !careerDate || !id) return;
    setCareerSaving(true);
    try {
      await createCareerRecord(id, { positionId: careerPosId, level: careerLevel, effectiveDate: careerDate, notes: careerNotes.trim() || null });
      qc.invalidateQueries({ queryKey: ['career-records', id] });
      qc.invalidateQueries({ queryKey: ['planner-teachers'] });
      qc.invalidateQueries({ queryKey: ['salary-teachers'] });
      // Update local state to reflect the new current position/level
      setPositionId(careerPosId);
      setLevel(careerLevel);
      showToast('Career record added');
      setShowCareerForm(false);
      setCareerPosId(''); setCareerLevel(0); setCareerNotes('');
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to add', 'error');
    }
    setCareerSaving(false);
  };

  const startEditCareer = (rec: any) => {
    setEditingCareerRecId(rec.id);
    setEditCareerPosId(rec.positionId);
    setEditCareerLevel(rec.level);
    setEditCareerDate(rec.effectiveDate.slice(0, 10));
  };

  const handleSaveCareerEdit = async () => {
    if (!editingCareerRecId || !editCareerPosId || !editCareerDate) return;
    setCareerSaving(true);
    try {
      await updateCareerRecord(editingCareerRecId, { positionId: editCareerPosId, level: editCareerLevel, effectiveDate: editCareerDate });
      qc.invalidateQueries({ queryKey: ['career-records', id] });
      qc.invalidateQueries({ queryKey: ['planner-teachers'] });
      qc.invalidateQueries({ queryKey: ['salary-teachers'] });
      // Update local state if this was the latest record
      const updated = careerHistory.find((r: any) => r.id === editingCareerRecId);
      if (updated && careerHistory.indexOf(updated) === 0) {
        setPositionId(editCareerPosId);
        setLevel(editCareerLevel);
      }
      showToast('Career record updated');
      setEditingCareerRecId(null);
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to update', 'error');
    }
    setCareerSaving(false);
  };

  const handleDeleteCareer = async (record: any) => {
    const ok = await confirmDeleteRecord({
      entityType: 'career record',
      entityName: `${record.positionId} Level ${record.level}`,
      title: 'Delete this career record?',
      consequence: <>This career entry will be removed. The teacher's current position will update to the next most recent record.</>,
      onConfirm: async () => {
        await deleteCareerRecord(record.id);
        qc.invalidateQueries({ queryKey: ['career-records', id] });
        qc.invalidateQueries({ queryKey: ['planner-teachers'] });
        qc.invalidateQueries({ queryKey: ['salary-teachers'] });
      },
    });
    if (ok) {
      // Update local state from next most recent record
      const remaining = careerHistory.filter((r: any) => r.id !== record.id);
      if (remaining.length > 0) {
        setPositionId(remaining[0].positionId);
        setLevel(remaining[0].level);
      } else {
        setPositionId('');
        setLevel(0);
      }
      showToast('Career record deleted');
    }
  };

  if (!isNew && !teacher && teachers.length > 0) {
    return <div style={s.page}><div style={s.inner}><p style={{ color: C.muted, textAlign: 'center', marginTop: 60 }}>Teacher not found.</p></div></div>;
  }

  // Salary breakdown
  const pos = allPositions.find(p => p.positionId === positionId);
  const basic = pos?.basicSalary ?? 0;
  const inc = allIncentives.find(i => i.positionId === positionId && i.level === level);
  const levelInc = inc?.amount ?? 0;
  // Hourly calculation: hourlyRate × net hours/day (minus 1h lunch if 6+h) × days/week × 4.33
  const rawHoursPerDay = (workStartMinute !== '' && workEndMinute !== '') ? (Number(workEndMinute) - Number(workStartMinute)) / 60 : 0;
  const hoursPerDay = rawHoursPerDay >= 6 ? rawHoursPerDay - 1 : rawHoursPerDay;
  const monthlyHours = hoursPerDay * workDays.length * 4.33;
  const hourlyBasic = hourlyRate * monthlyHours;

  const totalSalary = salaryType === 'hourly'
    ? hourlyBasic + totalAllowances
    : salaryType === 'fixed'
    ? fixedSalaryAmount + totalAllowances
    : (positionId ? basic + levelInc + totalAllowances : 0);

  // Computed profit-share weight from current career record or position
  const calculatedWeight = useMemo(() => {
    if (excludeFromProfitShare) return null;
    // Use latest career record effective as of today if available
    const now = new Date();
    const effectiveRecord = [...careerHistory]
      .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime())
      .find(r => new Date(r.effectiveDate) <= now);
    const effPosId = effectiveRecord?.positionId ?? positionId;
    const effLevel = effectiveRecord?.level ?? level;
    const effPos = allPositions.find(p => p.positionId === effPosId);
    if (!effPos || effPos.titleWeight === 0) return 0;
    const sortedPos = [...allPositions].sort((a, b) => a.titleWeight - b.titleWeight);
    const nextPos = sortedPos.find(p => p.titleWeight > effPos.titleWeight);
    const gap = nextPos ? nextPos.titleWeight - effPos.titleWeight : 1;
    const levelWeight = effPos.maxLevel > 0 ? (effLevel / effPos.maxLevel) * gap : 0;
    let w = effPos.titleWeight + levelWeight;
    if (employmentType === 'part-time') w = w / 2;
    return w;
  }, [excludeFromProfitShare, careerHistory, positionId, level, allPositions, employmentType]);

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: 'personal', label: 'Personal', icon: faUser },
    { key: 'operations', label: 'Operations', icon: faCalendarDays },
    { key: 'career', label: 'Career', icon: faBriefcase },
    { key: 'salary', label: 'Salary', icon: faCoins },
  ];

  return (
    <div style={s.page}>
      <style>{`.et-tab:hover { background: #f1f5f9 !important; } .et-del-career:hover { color: #ef4444 !important; background: #fef2f2 !important; } .et-back-btn:hover { background: #f1f5f9 !important; color: ${C.text} !important; border-color: #cbd5e1 !important; }`}</style>
      <div style={s.inner}>
        {/* Back + breadcrumb */}
        <div style={s.breadcrumb}>
          <button onClick={() => navigate('/teachers')} className="et-back-btn" style={s.backBtn} title="Back">
            <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 11 }} />
          </button>
          <span onClick={() => navigate('/teachers')} style={s.breadcrumbLink}>Teachers</span>
          <span style={{ color: C.muted, fontSize: 11 }}>/</span>
          <span style={{ fontSize: 13, color: C.sub, fontWeight: 500 }}>{isNew ? 'New' : teacher?.name ?? '...'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <h1 style={s.heading}>{isNew ? 'New Teacher' : teacher?.name ?? 'Teacher'}</h1>
        </div>

        {/* Layout: tabs left + content right */}
        <div style={s.layout}>
          {/* Tab nav */}
          <div style={s.tabNav}>
            {TABS.map(t => (
              <button key={t.key} className="et-tab" onClick={() => setTab(t.key)}
                style={{ ...s.tabBtn, ...(tab === t.key ? s.tabBtnActive : {}) }}>
                <FontAwesomeIcon icon={t.icon} style={{ fontSize: 12, width: 16 }} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={s.content}>
            {/* ── Personal ── */}
            {tab === 'personal' && (
              <>
                <div style={s.card}>
                  <h2 style={s.sectionTitle}>Basic Information</h2>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <label style={s.label}>Name</label>
                      <input style={s.input} value={name} onChange={e => setName(e.target.value)} placeholder="Enter teacher name" autoFocus />
                    </div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <label style={s.label}>Phone Number</label>
                      <input style={s.input} value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 012-345 6789" />
                    </div>
                  </div>
                  <div>
                    <label style={s.label}>Color</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 34, height: 34, borderRadius: 8, background: /^#[0-9a-f]{6}$/i.test(color) ? color : '#e2e8f0', flexShrink: 0, border: `1px solid ${C.border}` }} />
                      <input
                        style={{ ...s.input, width: 130, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', textTransform: 'lowercase' }}
                        value={color}
                        onChange={e => {
                          let v = e.target.value.toLowerCase();
                          if (v && !v.startsWith('#')) v = '#' + v;
                          setColor(v);
                        }}
                        placeholder="#5a67d8"
                        maxLength={7}
                      />
                      <button type="button"
                        onClick={() => {
                          const otherColors = teachers.filter((t: any) => t.id !== id).map((t: any) => t.color);
                          setColor(randomUnusedHexColor(otherColors));
                        }}
                        style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.text, cursor: 'pointer' }}>
                        Randomize
                      </button>
                    </div>
                  </div>
                </div>

                <div style={s.card}>
                  <h2 style={s.sectionTitle}>Employment</h2>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
                    {(() => {
                      // Status is derived from Last Working Day, not set by the
                      // user. Empty / future date = Active or Resigning;
                      // past / today = Resigned.
                      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
                      const d = resignedAt ? new Date(resignedAt) : null;
                      const status: 'active' | 'resigning' | 'resigned' = !d
                        ? 'active'
                        : d > todayStart ? 'resigning' : 'resigned';
                      const palette = status === 'active'
                        ? { bg: '#ecfdf5', fg: '#059669', dot: '#10b981', border: '#a7f3d0', label: 'Active' }
                        : status === 'resigning'
                          ? { bg: '#fffbeb', fg: '#b45309', dot: '#d97706', border: '#fde68a', label: 'Resigning' }
                          : { bg: '#f1f5f9', fg: '#64748b', dot: '#94a3b8', border: '#e2e8f0', label: 'Resigned' };
                      return (
                        <div style={{ width: 130 }}>
                          <label style={s.label}>Status</label>
                          <div
                            title={
                              status === 'active' ? 'Currently working — no resignation set'
                                : status === 'resigning' ? `Scheduled to resign on ${resignedAt}`
                                : `Resigned on ${resignedAt}`
                            }
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              height: 38,
                              padding: '0 14px',
                              borderRadius: 999,
                              background: palette.bg,
                              color: palette.fg,
                              border: `1px solid ${palette.border}`,
                              fontSize: 12,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                              cursor: 'default',
                              boxSizing: 'border-box' as const,
                            }}
                          >
                            <span style={{
                              width: 7, height: 7, borderRadius: '50%',
                              background: palette.dot,
                              flexShrink: 0,
                            }} />
                            {palette.label}
                          </div>
                        </div>
                      );
                    })()}
                    <div style={{ width: 130 }}>
                      <label style={s.label}>Type</label>
                      <select style={s.input} value={employmentType} onChange={e => setEmploymentType(e.target.value)}>
                        <option value="full-time">Full Time</option>
                        <option value="part-time">Part Time</option>
                      </select>
                    </div>
                    <div style={{ width: 150 }}>
                      <label style={s.label}>Join Date</label>
                      <input style={s.input} type="date" value={joinedAt} onChange={e => setJoinedAt(e.target.value)} />
                    </div>
                    <div style={{ width: 150 }}>
                      <label style={s.label}>Last Working Day</label>
                      <input style={s.input} type="date" value={resignedAt} onChange={e => setResignedAt(e.target.value)} />
                    </div>
                  </div>

                  <div style={{ borderTop: `1px solid #f1f5f9`, paddingTop: 16 }}>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div style={{ width: 140 }}>
                        <label style={s.label}>Salary Type</label>
                        <select style={s.input} value={salaryType} onChange={e => setSalaryType(e.target.value as any)}>
                          <option value="formula">Formula</option>
                          <option value="fixed">Fixed</option>
                          <option value="hourly">Hourly Rate</option>
                        </select>
                      </div>
                      {salaryType === 'fixed' && (
                        <div style={{ width: 160 }}>
                          <label style={s.label}>Fixed Amount (RM)</label>
                          <input style={s.input} type="text" inputMode="numeric" value={fixedSalaryAmount} onChange={e => setFixedSalaryAmount(Number(e.target.value.replace(/[^\d.]/g, '')))} />
                        </div>
                      )}
                      {salaryType === 'hourly' && (
                        <div style={{ width: 160 }}>
                          <label style={s.label}>Hourly Rate (RM)</label>
                          <input style={s.input} type="text" inputMode="numeric" value={hourlyRate} onChange={e => setHourlyRate(Number(e.target.value.replace(/[^\d.]/g, '')))} />
                        </div>
                      )}
                      {salaryType === 'formula' && (
                        <div style={{ fontSize: 12, color: C.muted, paddingBottom: 8 }}>
                          Salary = Basic + Level Incentive + Allowances
                        </div>
                      )}
                      {salaryType === 'hourly' && (
                        <div style={{ fontSize: 12, color: C.muted, paddingBottom: 8 }}>
                          ~{monthlyHours.toFixed(0)} hrs/month based on schedule
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid #f1f5f9` }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>Statutory Contributions</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {([['EPF', hasEpf, setHasEpf], ['SOCSO', hasSocso, setHasSocso], ['EIS', hasEis, setHasEis]] as const).map(([label, val, setter]) => (
                          <button key={label} type="button"
                            onClick={() => setter(!val)}
                            style={{ padding: '6px 16px', fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', background: val ? C.primary : '#f1f5f9', color: val ? '#fff' : C.muted, transition: 'all 0.15s' }}>
                            {label}
                          </button>
                        ))}
                      </div>
                      <p style={{ fontSize: 11, color: C.muted, margin: '6px 0 0' }}>Highlighted = employer must contribute. Toggle off for exempt staff.</p>
                    </div>

                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid #f1f5f9` }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                        <input type="checkbox" checked={excludeFromProfitShare} onChange={e => setExcludeFromProfitShare(e.target.checked)} />
                        <span style={{ fontWeight: 600, color: C.text }}>Exclude from profit share</span>
                        <span style={{ fontSize: 11, color: C.muted }}>(not counted in the profit share weight analysis)</span>
                      </label>
                    </div>

                    {!excludeFromProfitShare && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid #f1f5f9` }}>
                        <label style={s.label}>Profit-Share Weight</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            disabled={!overrideProfitShareWeight}
                            value={overrideProfitShareWeight ? customProfitShareWeight : (calculatedWeight ?? 0)}
                            onChange={e => setCustomProfitShareWeight(parseFloat(e.target.value) || 0)}
                            style={{
                              ...s.input, width: 100,
                              background: overrideProfitShareWeight ? '#fff' : '#f8fafc',
                              color: overrideProfitShareWeight ? C.text : C.muted,
                              cursor: overrideProfitShareWeight ? 'text' : 'default',
                            }}
                          />
                          {!overrideProfitShareWeight && calculatedWeight !== null && (
                            <span style={{ fontSize: 11, color: C.muted }}>
                              {calculatedWeight === 0 ? 'No position assigned' : `Formula: ${calculatedWeight.toFixed(2)}`}
                            </span>
                          )}
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, marginLeft: 'auto' }}>
                            <input
                              type="checkbox"
                              checked={overrideProfitShareWeight}
                              onChange={e => {
                                setOverrideProfitShareWeight(e.target.checked);
                                if (e.target.checked && calculatedWeight != null) {
                                  setCustomProfitShareWeight(parseFloat((calculatedWeight).toFixed(2)));
                                }
                              }}
                            />
                            <span style={{ fontWeight: 600, color: C.text }}>Override</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ── Operations ── */}
            {tab === 'operations' && (
              <>
                <div style={s.card}>
                  <h2 style={s.sectionTitle}>Schedule</h2>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ width: 140 }}>
                      <label style={s.label}>Start</label>
                      <select style={s.input} value={workStartMinute} onChange={e => setWorkStartMinute(e.target.value ? Number(e.target.value) : '')}>
                        <option value="">--</option>
                        {timeSlots.map(m => <option key={m} value={m}>{minutesToTime(m)}</option>)}
                      </select>
                    </div>
                    <div style={{ width: 140 }}>
                      <label style={s.label}>End</label>
                      <select style={s.input} value={workEndMinute} onChange={e => setWorkEndMinute(e.target.value ? Number(e.target.value) : '')}>
                        <option value="">--</option>
                        {timeSlots.map(m => <option key={m} value={m}>{minutesToTime(m)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={s.label}>Days</label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {DAYS.map((d, i) => (
                          <button key={i} onClick={() => setWorkDays(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i])}
                            style={{ width: 38, height: 32, fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none', cursor: 'pointer', background: workDays.includes(i) ? C.primary : '#f1f5f9', color: workDays.includes(i) ? '#fff' : C.muted }}>
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={s.card}>
                  <h2 style={s.sectionTitle}>Subjects</h2>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {subjects.map((sub: any) => (
                      <button key={sub.id} onClick={() => setAllowedSubjectIds(p => p.includes(sub.id) ? p.filter(x => x !== sub.id) : [...p, sub.id])}
                        style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 14, border: 'none', cursor: 'pointer', background: allowedSubjectIds.includes(sub.id) ? sub.color : '#f1f5f9', color: allowedSubjectIds.includes(sub.id) ? '#fff' : C.muted, transition: 'all 0.1s' }}>
                        {sub.name}
                      </button>
                    ))}
                    {subjects.length === 0 && <span style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}>No subjects configured</span>}
                  </div>
                </div>

                <div style={s.card}>
                  <h2 style={s.sectionTitle}>Classes</h2>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {activeClasses.map((cls: any) => (
                      <button key={cls.id} onClick={() => setAllowedClassroomIds(p => p.includes(cls.id) ? p.filter(x => x !== cls.id) : [...p, cls.id])}
                        style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 14, border: 'none', cursor: 'pointer', background: allowedClassroomIds.includes(cls.id) ? C.primary : '#f1f5f9', color: allowedClassroomIds.includes(cls.id) ? '#fff' : C.muted, transition: 'all 0.1s' }}>
                        {cls.name}
                      </button>
                    ))}
                    {activeClasses.length === 0 && <span style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}>No classes configured</span>}
                  </div>
                </div>
              </>
            )}

            {/* ── Career & Salary ── */}
            {tab === 'career' && (
              <>
                {isFixedSalary ? (
                  <div style={s.card}>
                    <h2 style={{ ...s.sectionTitle, margin: 0, marginBottom: 8 }}>Career History</h2>
                    <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Career progression is not tracked for fixed salary employees.</p>
                  </div>
                ) : <div style={s.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
                    <h2 style={{ ...s.sectionTitle, margin: 0 }}>Career History</h2>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {!isNew && (
                        <button onClick={() => navigate(`/teachers/${id}/career`)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 7, border: `1px solid ${C.primary}`, background: '#fff', color: C.primary, cursor: 'pointer' }}>
                          <FontAwesomeIcon icon={faRoad} style={{ fontSize: 10 }} /> View Progression
                        </button>
                      )}
                      {!isNew && !showCareerForm && (
                        <button onClick={() => {
                          setShowCareerForm(true);
                          // First career record → use join date; otherwise use today
                          setCareerDate(careerHistory.length === 0 && joinedAt ? joinedAt : new Date().toISOString().slice(0, 10));
                          setCareerPosId(positionId || (allPositions[0]?.positionId ?? ''));
                          setCareerLevel(0);
                        }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 7, border: 'none', background: C.primary, color: '#fff', cursor: 'pointer' }}>
                          <FontAwesomeIcon icon={faPlus} style={{ fontSize: 10 }} /> Record Progression
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Timeline */}
                  {isNew ? (
                    <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Save the teacher first, then add career records.</p>
                  ) : careerHistory.length === 0 && !showCareerForm ? (
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 8px' }}>No career records yet</p>
                      <p style={{ fontSize: 12, color: '#cbd5e1', margin: 0 }}>Click "Record Progression" to start tracking.</p>
                    </div>
                  ) : (
                    <div>
                      {/* Inline add form — appears as first timeline entry */}
                      {showCareerForm && (
                        <div style={{ display: 'flex', gap: 0 }}>
                          <div style={{ width: 80, flexShrink: 0, textAlign: 'right', paddingRight: 14, paddingTop: 2 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: C.primary }}>New</div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0 }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: C.primary, border: `2px solid ${C.primary}`, boxShadow: '0 0 0 3px rgba(90, 103, 216, 0.15)', flexShrink: 0, marginTop: 3 }} />
                            <div style={{ width: 2, flex: 1, background: '#f1f5f9', minHeight: 16 }} />
                          </div>
                          <div style={{ flex: 1, paddingLeft: 14, paddingBottom: 20 }}>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                              <select style={{ ...s.input, width: 'auto', flex: 1, minWidth: 120, fontSize: 12, padding: '6px 8px' }} value={careerPosId} onChange={e => setCareerPosId(e.target.value)}>
                                {allPositions.map(p => <option key={p.positionId} value={p.positionId}>{p.name}</option>)}
                              </select>
                              <select style={{ ...s.input, width: 80, fontSize: 12, padding: '6px 8px' }} value={careerLevel} onChange={e => setCareerLevel(Number(e.target.value))}>
                                {Array.from({ length: (allPositions.find(p => p.positionId === careerPosId)?.maxLevel ?? 5) + 1 }, (_, i) => (
                                  <option key={i} value={i}>Lvl {i}</option>
                                ))}
                              </select>
                              <input style={{ ...s.input, width: 130, fontSize: 12, padding: '6px 8px' }} type="date" value={careerDate} onChange={e => setCareerDate(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={handleAddCareer} disabled={careerSaving || !careerPosId || !careerDate}
                                style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', background: C.primary, color: '#fff', cursor: 'pointer', opacity: careerSaving ? 0.5 : 1 }}>
                                {careerSaving ? 'Saving...' : 'Save'}
                              </button>
                              <button onClick={() => setShowCareerForm(false)}
                                style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: C.muted, cursor: 'pointer' }}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      {careerHistory.map((rec: any, idx: number) => {
                        const recPos = allPositions.find(p => p.positionId === rec.positionId);
                        const isCurrent = idx === 0 && !showCareerForm;
                        const prevRec = careerHistory[idx + 1];
                        const isTitlePromotion = prevRec && rec.positionId !== prevRec.positionId;
                        const isLevelUp = prevRec && !isTitlePromotion && rec.level > prevRec.level;
                        const d = new Date(rec.effectiveDate);
                        const isEditingThis = editingCareerRecId === rec.id;
                        return (
                          <div key={rec.id} style={{ display: 'flex', gap: 0 }}>
                            {/* Date — left side */}
                            <div style={{ width: 80, flexShrink: 0, textAlign: 'right', paddingRight: 14, paddingTop: 2 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: isCurrent ? C.text : C.muted }}>{d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}</div>
                              <div style={{ fontSize: 10, color: C.muted }}>{d.getFullYear()}</div>
                            </div>
                            {/* Dot + line */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0 }}>
                              <div style={{
                                width: isCurrent ? 12 : isTitlePromotion ? 11 : 10,
                                height: isCurrent ? 12 : isTitlePromotion ? 11 : 10,
                                borderRadius: '50%', flexShrink: 0, marginTop: 3,
                                background: isCurrent ? C.primary : isTitlePromotion ? '#f59e0b' : '#fff',
                                border: isCurrent ? `2px solid ${C.primary}` : isTitlePromotion ? `2px solid #f59e0b` : `2px solid ${C.border}`,
                                boxShadow: isCurrent ? '0 0 0 3px rgba(90, 103, 216, 0.15)' : isTitlePromotion ? '0 0 0 3px rgba(245, 158, 11, 0.15)' : 'none',
                              }} />
                              {idx < careerHistory.length - 1 && <div style={{ width: 2, flex: 1, background: '#f1f5f9', minHeight: 32 }} />}
                            </div>
                            {/* Content — right side */}
                            <div style={{ flex: 1, paddingLeft: 14, paddingBottom: 28 }}>
                              {isEditingThis ? (
                                <>
                                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                                    <select style={{ ...s.input, width: 'auto', flex: 1, minWidth: 120, fontSize: 12, padding: '6px 8px' }} value={editCareerPosId} onChange={e => setEditCareerPosId(e.target.value)}>
                                      {allPositions.map(p => <option key={p.positionId} value={p.positionId}>{p.name}</option>)}
                                    </select>
                                    <select style={{ ...s.input, width: 80, fontSize: 12, padding: '6px 8px' }} value={editCareerLevel} onChange={e => setEditCareerLevel(Number(e.target.value))}>
                                      {Array.from({ length: (allPositions.find(p => p.positionId === editCareerPosId)?.maxLevel ?? 5) + 1 }, (_, i) => (
                                        <option key={i} value={i}>Lvl {i}</option>
                                      ))}
                                    </select>
                                    <input style={{ ...s.input, width: 130, fontSize: 12, padding: '6px 8px' }} type="date" value={editCareerDate} onChange={e => setEditCareerDate(e.target.value)} />
                                  </div>
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button onClick={handleSaveCareerEdit} disabled={careerSaving}
                                      style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', background: C.primary, color: '#fff', cursor: 'pointer', opacity: careerSaving ? 0.5 : 1 }}>
                                      {careerSaving ? 'Saving...' : 'Save'}
                                    </button>
                                    <button onClick={() => setEditingCareerRecId(null)}
                                      style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: C.muted, cursor: 'pointer' }}>
                                      Cancel
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: isCurrent ? C.text : C.sub }}>
                                      {recPos?.name ?? rec.positionId}{rec.level > 0 ? ` — Level ${rec.level}` : ''}
                                    </span>
                                    {isTitlePromotion && (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, color: '#92400e', background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', padding: '3px 9px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '0.04em', border: '1px solid #fcd34d', boxShadow: '0 1px 3px rgba(251, 191, 36, 0.2)' }}>
                                        <FontAwesomeIcon icon={faStar} style={{ fontSize: 8 }} /> Promoted
                                      </span>
                                    )}
                                    {isLevelUp && (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, color: C.green, background: '#dcfce7', padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                        <FontAwesomeIcon icon={faArrowUp} style={{ fontSize: 7 }} /> Level Up
                                      </span>
                                    )}
                                    {isCurrent && <span style={{ fontSize: 9, fontWeight: 700, color: C.primary, background: C.primaryLight, padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Current</span>}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <button onClick={() => startEditCareer(rec)} className="et-del-career" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: '4px 6px', fontSize: 11, borderRadius: 4 }} title="Edit">
                                      <FontAwesomeIcon icon={faPen} />
                                    </button>
                                    <button onClick={() => handleDeleteCareer(rec)} className="et-del-career" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: '4px 6px', fontSize: 11, borderRadius: 4 }} title="Delete">
                                      <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>}

              </>
            )}

            {/* ── Salary ── */}
            {tab === 'salary' && (
              <>
                {/* Salary hero */}
                {totalSalary > 0 && (
                  <div style={{ ...s.card, background: 'linear-gradient(135deg, #f8fafc 0%, #eef0fa 100%)', borderColor: '#c7d2fe' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Current Monthly Salary</div>
                        <div style={{ fontSize: 26, fontWeight: 800, color: C.green, lineHeight: 1 }}>RM {totalSalary.toLocaleString()}</div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 12, color: C.sub }}>
                        {isHourly ? (
                          <>
                            <div style={{ fontWeight: 600 }}>Hourly Rate</div>
                            <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>RM {hourlyRate} × {monthlyHours.toFixed(0)} hrs</div>
                          </>
                        ) : isFixedSalary ? (
                          <>
                            <div style={{ fontWeight: 600 }}>Fixed Salary</div>
                            {totalAllowances > 0 && <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{fixedSalaryAmount.toLocaleString()} + {totalAllowances.toLocaleString()} allowances</div>}
                          </>
                        ) : positionId ? (
                          <>
                            <div>{pos?.name} — Level {level}</div>
                            <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>Basic + Incentive + Allowances</div>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}

                {/* Allowances — render top-level types as flat rows.
                    Types that have children (e.g. Other Allowance) act
                    as category sums: their input shows the total of
                    all child amounts and is disabled. Children render
                    indented under their parent. */}
                <div style={s.card}>
                  <h2 style={s.sectionTitle}>Allowances</h2>
                  {visibleAllowTypes.length === 0 ? (
                    <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>No allowance types configured. Add them in Settings &gt; Employee Salary.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {visibleAllowTypes
                        .filter(at => !at.parentId)
                        .map(parent => {
                          const children = visibleAllowTypes.filter(c => c.parentId === parent.id);
                          const childrenSum = children.reduce((sum, c) => sum + getAmt(c.id), 0);
                          return (
                            <Fragment key={parent.id}>
                              <AllowanceRow
                                at={parent}
                                amount={isLevelAllowance(parent.name) ? levelInc : (children.length > 0 ? childrenSum : getAmt(parent.id))}
                                disabled={isLevelAllowance(parent.name) || children.length > 0}
                                isLevel={isLevelAllowance(parent.name)}
                                level={level}
                                onChange={v => setAmt(parent.id, v)}
                              />
                              {children.map(child => (
                                <div key={child.id} style={{
                                  paddingLeft: 24,
                                  borderLeft: `2px solid ${C.border}`,
                                  marginLeft: 8,
                                }}>
                                  <AllowanceRow
                                    at={child}
                                    amount={getAmt(child.id)}
                                    disabled={false}
                                    isLevel={false}
                                    level={level}
                                    onChange={v => setAmt(child.id, v)}
                                  />
                                </div>
                              ))}
                            </Fragment>
                          );
                        })}
                    </div>
                  )}
                </div>
                {/* Salary Breakdown */}
                {totalSalary > 0 && (
                  <div style={s.card}>
                    <h2 style={s.sectionTitle}>Salary Breakdown</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                      {isHourly ? (
                        <Row label={`Hourly (RM ${hourlyRate} × ${monthlyHours.toFixed(0)} hrs)`} value={hourlyBasic} />
                      ) : isFixedSalary ? (
                        <Row label="Fixed Salary" value={fixedSalaryAmount} />
                      ) : positionId ? (
                        <>
                          <Row label={`Basic Salary (${pos?.positionId})`} value={basic} />
                          <Row label={`Level ${level} Incentive`} value={levelInc} />
                        </>
                      ) : null}
                      {visibleAllowTypes.map(at => (
                        getAmt(at.id) > 0 ? <Row key={at.id} label={at.name} value={getAmt(at.id)} /> : null
                      ))}
                      <div style={{ borderTop: `2px solid ${C.border}`, paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>Total</span>
                        <span style={{ fontWeight: 800, fontSize: 18, color: C.green }}>RM {totalSalary.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Actions per tab */}
            {(tab === 'personal' || tab === 'operations') && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button onClick={() => navigate('/teachers')} style={s.cancelBtn}>Cancel</button>
                <button onClick={handleSave} disabled={saving || !name.trim()} style={{ ...s.saveBtn, opacity: saving || !name.trim() ? 0.6 : 1 }}>
                  {saving ? 'Saving…' : isNew ? 'Add Teacher' : 'Save Changes'}
                </button>
              </div>
            )}
            {tab === 'salary' && !isNew && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button onClick={handleSaveAllowancesOnly} disabled={allowanceSaving} style={{ ...s.saveBtn, opacity: allowanceSaving ? 0.6 : 1 }}>
                  {allowanceSaving ? 'Saving…' : 'Save Allowances'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>RM {value.toLocaleString()}</span>
    </div>
  );
}

// One row in the EditTeacher allowances list. Shared between top-level
// and nested children. `disabled` covers two cases: the Level Allowance
// (auto from level matrix) and parent rows that show the sum of their
// children (and therefore aren't directly editable).
function AllowanceRow({
  at, amount, disabled, isLevel, level, onChange,
}: {
  at: { id: string; name: string };
  amount: number;
  disabled: boolean;
  isLevel: boolean;
  level: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 13, color: C.sub, flex: 1 }}>
        {at.name}
        {isLevel && (
          <span style={{
            marginLeft: 8, fontSize: 10, fontWeight: 600,
            color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            Auto · Level {level}
          </span>
        )}
        {disabled && !isLevel && (
          <span style={{
            marginLeft: 8, fontSize: 10, fontWeight: 600,
            color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            Sum of sub-types
          </span>
        )}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: 140 }}>
        <span style={{ fontSize: 12, color: C.muted }}>RM</span>
        <input
          style={{
            ...s.input,
            textAlign: 'right', fontWeight: 600,
            background: disabled ? '#f1f5f9' : '#fff',
            color: disabled ? C.muted : C.text,
            cursor: disabled ? 'not-allowed' : 'text',
          }}
          type="text" inputMode="numeric"
          disabled={disabled}
          value={amount}
          onChange={e => {
            if (disabled) return;
            onChange(Number(e.target.value.replace(/[^\d.]/g, '')));
          }}
        />
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1e293b' },
  inner: { maxWidth: 860, margin: '0 auto' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  backBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.border}`, background: C.card, color: C.muted, cursor: 'pointer', transition: 'all 0.1s' },
  breadcrumbLink: { fontSize: 13, fontWeight: 600, color: C.primary, cursor: 'pointer' },
  heading: { fontSize: 22, fontWeight: 800, color: C.text, margin: 0 },

  // Layout
  layout: { display: 'flex', gap: 24 },
  tabNav: { width: 180, flexShrink: 0, display: 'flex', flexDirection: 'column' as const, gap: 2, position: 'sticky' as const, top: 28, alignSelf: 'flex-start' as const },
  tabBtn: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', fontSize: 13, fontWeight: 500,
    color: C.muted, background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer',
    textAlign: 'left' as const, fontFamily: 'inherit', transition: 'all 0.1s',
  },
  tabBtnActive: { background: C.primaryLight, color: C.primary, fontWeight: 600 },
  content: { flex: 1, minWidth: 0 },

  // Cards
  card: { background: C.card, borderRadius: 12, padding: '20px 24px', border: `1px solid ${C.border}`, marginBottom: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 14px' },
  label: { fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 4, display: 'block' },
  input: { width: '100%', padding: '9px 12px', fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 8, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' },

  // Actions
  cancelBtn: { padding: '10px 22px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.text, cursor: 'pointer' },
  saveBtn: { padding: '10px 28px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: C.primary, color: '#fff', cursor: 'pointer' },
};

// ── Appraisal Tab ────────────────────────────────────────────────────────────

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Score banding: ≥80 green, 60–79 amber, <60 red. Reused for the row pill
// and the summary average so the colour story stays consistent.
function scoreColors(score: number): { bg: string; color: string } {
  if (score >= 80) return { bg: '#dcfce7', color: '#15803d' };
  if (score >= 60) return { bg: '#fef3c7', color: '#b45309' };
  return { bg: '#fee2e2', color: '#991b1b' };
}

export function AppraisalTab({ teacherId }: { teacherId: string }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { confirm } = useDeleteDialog();

  const { data, isLoading } = useQuery({
    queryKey: ['teacher-appraisals', teacherId],
    queryFn: () => fetchTeacherAppraisals(teacherId),
  });
  const items = data?.items ?? [];

  const now = new Date();

  // Year filter — defaults to current calendar year, scoping both the
  // summary average and the history list below.
  const [filterYear, setFilterYear] = useState(now.getFullYear());

  // Items in the selected year only — drives the list + year-average.
  const yearItems = useMemo(() => items.filter(it => it.year === filterYear), [items, filterYear]);
  const yearAverage = useMemo(() => {
    if (yearItems.length === 0) return null;
    const sum = yearItems.reduce((acc, r) => acc + (r.score ?? 0), 0);
    return Math.round(sum / yearItems.length);
  }, [yearItems]);

  // Form state — defaults to "current month, blank score" for fast monthly entry.
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [score, setScore] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [evaluatedBy, setEvaluatedBy] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Existing record for the selected (year, month) — drives "this overwrites
  // an existing entry" hint and pre-fills the form when editing.
  const existingForPeriod = useMemo(
    () => items.find(it => it.year === year && it.month === month) ?? null,
    [items, year, month],
  );

  const startEdit = (a: TeacherAppraisal) => {
    setEditingId(a.id);
    setYear(a.year);
    setMonth(a.month);
    setScore(String(a.score));
    setNotes(a.notes ?? '');
    setEvaluatedBy(a.evaluatedBy ?? '');
  };
  const cancelEdit = () => {
    setEditingId(null);
    setYear(now.getFullYear()); setMonth(now.getMonth());
    setScore(''); setNotes(''); setEvaluatedBy('');
  };

  const submit = async () => {
    const parsed = parseFloat(score);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
      showToast('Score must be between 0 and 100', 'error');
      return;
    }
    setSaving(true);
    try {
      await upsertTeacherAppraisal(teacherId, {
        year, month, score: parsed,
        notes: notes.trim() || null,
        evaluatedBy: evaluatedBy.trim() || null,
      });
      qc.invalidateQueries({ queryKey: ['teacher-appraisals', teacherId] });
      qc.invalidateQueries({ queryKey: ['teacher-career', teacherId] });
      showToast(existingForPeriod ? 'Appraisal updated' : 'Appraisal recorded');
      cancelEdit();
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: TeacherAppraisal) => {
    const ok = await confirm({
      entityType: 'Appraisal',
      entityName: `${MONTH_LABELS[a.month]} ${a.year}`,
      consequence: 'This appraisal record will be permanently removed.',
      onConfirm: async () => {
        await deleteTeacherAppraisal(a.id);
        qc.invalidateQueries({ queryKey: ['teacher-appraisals', teacherId] });
        qc.invalidateQueries({ queryKey: ['teacher-career', teacherId] });
      },
    });
    if (ok) showToast('Appraisal deleted');
  };

  const yearOptions = useMemo(() => {
    const ys = new Set<number>();
    ys.add(now.getFullYear());
    ys.add(now.getFullYear() - 1);
    for (const it of items) ys.add(it.year);
    return [...ys].sort((a, b) => b - a);
  }, [items, now]);

  // Filter pill year options — same set, ordered newest-first. The form
  // and filter share the same option pool so admins don't see a year
  // they can't enter records for.
  const filterYearOptions = yearOptions;

  if (isLoading) return <div style={s.card}><p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Loading…</p></div>;

  return (
    <>
      {/* Summary card with inline year filter */}
      <div style={{ ...s.card, background: 'linear-gradient(135deg, #f8fafc 0%, #eef0fa 100%)', borderColor: '#c7d2fe' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Average Appraisal
              </div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
                {yearItems.length} record{yearItems.length === 1 ? '' : 's'} in {filterYear}
              </div>
            </div>
            <select
              value={filterYear}
              onChange={e => setFilterYear(Number(e.target.value))}
              style={{
                padding: '6px 12px', fontSize: 12, fontWeight: 600,
                border: `1px solid ${C.primary}33`, borderRadius: 8,
                background: '#fff', color: C.primary, cursor: 'pointer', outline: 'none',
              }}
            >
              {filterYearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1,
              color: yearAverage != null ? scoreColors(yearAverage).color : C.muted,
            }}>
              {yearAverage != null ? `${yearAverage}%` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Entry form */}
      <div style={s.card}>
        <h2 style={{ ...s.sectionTitle, margin: 0, marginBottom: 14 }}>
          {editingId ? 'Edit appraisal' : existingForPeriod ? 'Update existing month' : 'Record monthly appraisal'}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={s.label}>Year</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))} style={s.input as React.CSSProperties}>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label style={s.label}>Month</label>
            <select value={month} onChange={e => setMonth(Number(e.target.value))} style={s.input as React.CSSProperties}>
              {MONTH_LABELS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={s.label}>Score (0–100)</label>
            <input
              type="number" min={0} max={100} step={1}
              value={score}
              onChange={e => setScore(e.target.value)}
              placeholder="e.g. 78"
              style={s.input}
            />
          </div>
          <div>
            <label style={s.label}>Evaluator (optional)</label>
            <input
              type="text"
              value={evaluatedBy}
              onChange={e => setEvaluatedBy(e.target.value)}
              placeholder="e.g. Principal Tan"
              style={s.input}
            />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={s.label}>Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Strengths, areas for growth, next-month focus…"
            style={{ ...s.input, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>
        {existingForPeriod && !editingId && (
          <div style={{
            padding: '8px 12px', marginBottom: 12, borderRadius: 8,
            background: '#fef9c3', color: '#854d0e', fontSize: 12, fontWeight: 500,
          }}>
            An entry for {MONTH_LABELS[month]} {year} already exists ({existingForPeriod.score}%). Saving will overwrite it.
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {editingId && (
            <button onClick={cancelEdit} style={s.cancelBtn} type="button">Cancel</button>
          )}
          <button
            onClick={submit}
            disabled={saving || !score.trim()}
            style={{ ...s.saveBtn, opacity: saving || !score.trim() ? 0.5 : 1 }}
          >
            <FontAwesomeIcon icon={faPlus} style={{ fontSize: 11, marginRight: 6 }} />
            {saving ? 'Saving…' : editingId ? 'Save changes' : existingForPeriod ? 'Overwrite' : 'Add appraisal'}
          </button>
        </div>
      </div>

      {/* History list — scoped to selected year */}
      <div style={s.card}>
        <h2 style={{ ...s.sectionTitle, margin: 0, marginBottom: 12 }}>History · {filterYear}</h2>
        {yearItems.length === 0 ? (
          <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>No appraisals recorded for {filterYear}.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {yearItems.map(a => {
              const sc = scoreColors(a.score);
              return (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 14px', border: `1px solid ${C.border}`, borderRadius: 10,
                  background: editingId === a.id ? '#eef0fa' : '#fff',
                }}>
                  <div style={{
                    width: 56, padding: '6px 8px', borderRadius: 8,
                    background: sc.bg, color: sc.color,
                    textAlign: 'center', fontWeight: 700, fontSize: 13,
                  }}>
                    {Math.round(a.score)}%
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                      {MONTH_LABELS[a.month]} {a.year}
                      {a.evaluatedBy && (
                        <span style={{ marginLeft: 8, fontWeight: 500, color: C.muted, fontSize: 11 }}>
                          · {a.evaluatedBy}
                        </span>
                      )}
                    </div>
                    {a.notes && (
                      <div style={{ fontSize: 12, color: C.sub, marginTop: 4, lineHeight: 1.5 }}>
                        {a.notes}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => startEdit(a)} className="et-tab" style={{
                      padding: '6px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                      border: `1px solid ${C.border}`, background: '#fff', color: C.sub, cursor: 'pointer',
                    }}>
                      <FontAwesomeIcon icon={faPen} style={{ fontSize: 10, marginRight: 4 }} />
                      Edit
                    </button>
                    <button onClick={() => remove(a)} className="et-del-career" style={{
                      padding: '6px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                      border: `1px solid ${C.border}`, background: '#fff', color: C.muted, cursor: 'pointer',
                    }}>
                      <FontAwesomeIcon icon={faTrash} style={{ fontSize: 10 }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
