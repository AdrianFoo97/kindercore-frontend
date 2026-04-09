import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsisVertical, faPen, faArrowRotateLeft, faCircleInfo, faRightFromBracket, faTrash, faCircleCheck } from '@fortawesome/free-solid-svg-icons';
import { fetchStudents, updateStudent, completeOnboarding, withdrawStudent, reactivateStudent, deleteStudent } from '../api/students.js';
import { Student } from '../types/index.js';
import EditStudentModal from '../components/students/EditStudentModal.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { useToast } from '../components/common/Toast.js';

const CURRENT_YEAR  = new Date().getFullYear();

type FilterTab = 'active' | 'enrolled' | 'graduated' | 'withdrawn';
type SortKey   = 'name' | 'age';
type SortDir   = 'asc'  | 'desc';

function calcAge(dob: string)  { return CURRENT_YEAR - new Date(dob).getFullYear(); }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatEnrolmentMonth(month: number, year: number) {
  return `${MONTH_NAMES[month - 1] ?? month} ${year}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  { bg: '#fce7f3', color: '#be185d' },
  { bg: '#ede9fe', color: '#6d28d9' },
  { bg: '#dbeafe', color: '#1d4ed8' },
  { bg: '#dcfce7', color: '#15803d' },
  { bg: '#ffedd5', color: '#c2410c' },
  { bg: '#fef9c3', color: '#a16207' },
  { bg: '#e0f2fe', color: '#0369a1' },
];
function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function exportToExcel(students: Student[], tabLabel: string) {
  const rows = students.map(s => ({
    'Name': s.lead.childName,
    'Date of Birth': new Date(s.lead.childDob).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }),
    'Age': calcAge(s.lead.childDob),
    'Programme': s.package.programme,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 6 }, { wch: 24 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, tabLabel);
  XLSX.writeFile(wb, `students-${tabLabel.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

const AGE_PALETTE: Record<number, { bg: string; color: string }> = {
  2: { bg: '#fce7f3', color: '#9d174d' },
  3: { bg: '#ffedd5', color: '#9a3412' },
  4: { bg: '#fef9c3', color: '#854d0e' },
  5: { bg: '#dcfce7', color: '#166534' },
  6: { bg: '#dbeafe', color: '#1d4ed8' },
};

function AgeBadge({ age }: { age: number }) {
  const { bg, color } = AGE_PALETTE[age] ?? { bg: '#f3f4f6', color: '#374151' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', background: bg, color, borderRadius: 6, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
      {age}
    </span>
  );
}

const TAB_LABELS: Record<FilterTab, string> = {
  active: 'Active', enrolled: 'Enrolled', graduated: 'Graduated', withdrawn: 'Withdrawn',
};

// Lifecycle stage metadata — accent is the pipeline indicator colour
const LIFECYCLE_STAGES: { tab: FilterTab; label: string; accent: string; textColor: string }[] = [
  { tab: 'enrolled',  label: 'Enrolled',  accent: '#d97706', textColor: '#92400e' },
  { tab: 'active',    label: 'Active',    accent: '#059669', textColor: '#065f46' },
  { tab: 'graduated', label: 'Graduated', accent: '#5a79c8', textColor: '#1e40af' },
  { tab: 'withdrawn', label: 'Withdrawn', accent: '#64748b', textColor: '#334155' },
];

function actionBtn(variant: 'neutral' | 'red' | 'green'): React.CSSProperties {
  const v = {
    neutral: { border: '1px solid #e5e7eb', background: '#fff',    color: '#374151' },
    red:     { border: '1px solid #fecaca', background: '#fff',    color: '#dc2626' },
    green:   { border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#16a34a' },
  }[variant];
  return { padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', lineHeight: '1.5', ...v };
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StudentsPage() {
  const { isMobile, isTablet } = useIsMobile();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [tab,              setTab]              = useState<FilterTab>('active');
  const [search,           setSearch]           = useState('');
  const [editingStudent,   setEditingStudent]   = useState<Student | null>(null);
  const [withdrawingStudent, setWithdrawingStudent] = useState<Student | null>(null);
  const [withdrawDate,     setWithdrawDate]     = useState('');
  const [withdrawReason,   setWithdrawReason]   = useState('');
  const [reactivatingStudent, setReactivatingStudent] = useState<Student | null>(null);
  const [viewingReasonStudent, setViewingReasonStudent] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [groupBy,          setGroupBy]          = useState<'none' | 'programme' | 'age'>('age');
  const [filterAge,        setFilterAge]        = useState<string>('all');
  const [filterProgramme,  setFilterProgramme]  = useState<string>('all');
  const [sortKey,          setSortKey]          = useState<SortKey>('age');
  const [sortDir,          setSortDir]          = useState<SortDir>('asc');
  const [page,             setPage]             = useState(1);
  const [openMenuId,       setOpenMenuId]       = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void; destructive?: boolean } | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const openMenu = useCallback((id: string, btnEl: HTMLButtonElement) => {
    if (openMenuId === id) { setOpenMenuId(null); return; }
    const rect = btnEl.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setOpenMenuId(id);
  }, [openMenuId]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (openMenuId && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenuId]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const { data: studentsData, isPending, isError } = useQuery({
    queryKey: ['students', { pageSize: 1000 }],
    queryFn: () => fetchStudents({ pageSize: 1000 }),
  });
  const students = studentsData?.items ?? [];

  const withdrawMutation = useMutation({
    mutationFn: ({ id, date, reason }: { id: string; date: string; reason: string }) =>
      withdrawStudent(id, { withdrawnAt: new Date(date).toISOString(), withdrawReason: reason || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setWithdrawingStudent(null); setWithdrawDate(''); setWithdrawReason('');
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => reactivateStudent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setReactivatingStudent(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStudent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setDeletingStudent(null);
    },
  });

  const counts = {
    active:    students.filter(s => s.status === 'active').length,
    enrolled:  students.filter(s => s.status === 'enrolled').length,
    graduated: students.filter(s => s.status === 'graduated').length,
    withdrawn: students.filter(s => s.status === 'withdrawn').length,
  };

  const tabFiltered = students.filter(s => s.status === tab);

  const allAges       = [...new Set(tabFiltered.map(s => calcAge(s.lead.childDob)))].sort((a, b) => a - b);
  const allProgrammes = [...new Set(tabFiltered.map(s => s.package.programme))].sort();

  const filtered = tabFiltered.filter(s => {
    if (filterAge !== 'all' && calcAge(s.lead.childDob) !== Number(filterAge)) return false;
    if (filterProgramme !== 'all' && s.package.programme !== filterProgramme) return false;
    if (search.trim() && !s.lead.childName.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  const PAGE_SIZE  = 15;
  const sorted     = [...filtered].sort((a, b) => {
    const p = sortKey === 'name' ? a.lead.childName.localeCompare(b.lead.childName) : calcAge(a.lead.childDob) - calcAge(b.lead.childDob);
    const s = sortKey === 'name' ? calcAge(a.lead.childDob) - calcAge(b.lead.childDob) : a.lead.childName.localeCompare(b.lead.childName);
    const d = sortDir === 'asc' ? 1 : -1;
    return p !== 0 ? p * d : s;
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const grouped: { label: string; rows: Student[] }[] = (() => {
    if (groupBy === 'none') return [{ label: '', rows: paginated }];
    const map = new Map<string, Student[]>();
    for (const s of paginated) {
      const key = groupBy === 'programme' ? s.package.programme : `Age ${calcAge(s.lead.childDob)}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([label, rows]) => ({ label, rows }));
  })();

  const handleSaved   = (_updated: Student) => {
    queryClient.invalidateQueries({ queryKey: ['students'] });
    setEditingStudent(null);
    showToast('Student updated successfully');
  };
  const handleTabSelect = (t: FilterTab) => {
    setTab(t); setFilterAge('all'); setFilterProgramme('all'); setSearch(''); setPage(1);
  };

  const currentStage = LIFECYCLE_STAGES.find(s => s.tab === tab)!;
  const hasDateCol   = tab === 'active' || tab === 'enrolled' || tab === 'withdrawn';
  const colCount     = hasDateCol ? 5 : 4;

  const sel: React.CSSProperties = {
    fontSize: 13, color: '#374151', padding: '5px 9px',
    borderRadius: 6, border: '1px solid #e5e7eb',
    background: '#fff', cursor: 'pointer', outline: 'none', appearance: 'auto' as any,
  };

  const th: React.CSSProperties = {
    padding: '10px 16px 9px', textAlign: 'left', fontSize: 11, fontWeight: 600,
    color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em',
    borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap', userSelect: 'none',
    background: '#fafafa',
  };

  const td: React.CSSProperties = {
    padding: '10px 16px', verticalAlign: 'middle',
    borderBottom: '1px solid #f3f4f6',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f7f8fa', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
      <style>{`
        .sp-row:hover td        { background: #f8fafc !important; }
        .sp-edit-btn            { opacity: 0; transition: opacity 0.12s; pointer-events: none; }
        .sp-row:hover .sp-edit-btn { opacity: 1; pointer-events: auto; }
        .sp-dots-btn            { opacity: 0.35; transition: opacity 0.12s; }
        .sp-row:hover .sp-dots-btn { opacity: 0.7; }
        .sp-dots-btn:hover      { opacity: 1 !important; }
        .sp-stage-btn:hover     { background: #f8fafc !important; }
        .sp-th-sort             { cursor: pointer; }
        .sp-th-sort:hover       { color: #374151 !important; }
        .sp-search:focus        { border-color: #a5b4fc !important; background: #fff !important; outline: none; }
        .sp-menu-item:hover     { background: #f3f4f6 !important; }
      `}</style>

      {/* ══ Zone 1 · Header ══════════════════════════════════════════════════ */}
      <div style={{ background: '#fff', flexShrink: 0 }}>
        <div style={{ padding: isMobile ? '22px 12px 0' : '22px 32px 0', maxWidth: 960, margin: '0 auto' }}>

          {/* Title */}
          <div style={{ marginBottom: 22 }}>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>
              Students
            </h1>
          </div>

          {/* ── Lifecycle pipeline ── */}
          <div className="kc-no-scrollbar" style={{ display: 'flex', alignItems: 'stretch', ...(isMobile ? { overflowX: 'auto', justifyContent: 'flex-start' } : { justifyContent: 'center' }) }}>
            {LIFECYCLE_STAGES.map((stage, idx) => {
              const active = tab === stage.tab;
              const isWd   = stage.tab === 'withdrawn';
              return (
                <React.Fragment key={stage.tab}>
                  {/* Pipe separator before Withdrawn */}
                  {isWd && (
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px 3px', color: '#e2e8f0', fontSize: 22, userSelect: 'none', lineHeight: 1 }}>
                      |
                    </div>
                  )}
                  {/* › between main stages */}
                  {!isWd && idx > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 3px 3px', color: '#d1d5db', fontSize: 15, userSelect: 'none' }}>
                      ›
                    </div>
                  )}
                  <button
                    className="sp-stage-btn"
                    onClick={() => handleTabSelect(stage.tab)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      gap: 3, padding: isMobile ? '6px 10px 10px' : '6px 16px 12px',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      borderBottom: active ? `2px solid ${stage.accent}` : '2px solid transparent',
                      marginBottom: -1, textAlign: 'left', flexShrink: 0,
                    }}
                  >
                    <span style={{
                      fontSize: isMobile ? 18 : 22, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.04em',
                      color: active ? stage.accent : '#111827',
                      transition: 'color 0.1s',
                    }}>
                      {counts[stage.tab]}
                    </span>
                    <span style={{
                      fontSize: isMobile ? 9 : 10.5, fontWeight: 600, letterSpacing: '0.07em',
                      textTransform: 'uppercase',
                      color: active ? stage.accent : '#9ca3af',
                      transition: 'color 0.1s',
                      whiteSpace: 'nowrap',
                    }}>
                      {stage.label}
                    </span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══ Zone 2 · Toolbar ════════════════════════════════════════════════ */}
      <div style={{ background: '#f7f8fa', padding: '10px 0', flexShrink: 0 }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: isMobile ? '0 12px' : '0 32px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: '#fff', border: '1px solid #e8eaed', borderRadius: 10,
          padding: isMobile ? '10px 12px' : '7px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          ...(isMobile ? { flexWrap: 'wrap' as const, gap: 8 } : {}),
        }}>

          {/* Search */}
          <div style={{ position: 'relative', flexShrink: isMobile ? undefined : 0, ...(isMobile ? { flex: '1 1 100%' } : {}) }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
              style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#b0b8c8', pointerEvents: 'none' }}>
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            <input
              className="sp-search"
              type="text"
              placeholder="Search students…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{
                width: isMobile ? '100%' : 196, padding: '5px 10px 5px 30px', fontSize: 13,
                borderRadius: 7, border: '1px solid #e8eaed',
                color: '#111827', background: search ? '#fff' : '#f9fafb',
                transition: 'border-color 0.15s, background 0.15s',
                boxSizing: 'border-box' as const,
              }}
            />
          </div>

          {/* Divider */}
          {!isMobile && <div style={{ width: 1, height: 18, background: '#e8eaed', margin: '0 6px', flexShrink: 0 }} />}

          {/* Age filter */}
          <div style={{ position: 'relative', flexShrink: 0, ...(isMobile ? { flex: 1 } : {}) }}>
            <select
              value={filterAge}
              onChange={e => { setFilterAge(e.target.value); setPage(1); }}
              style={{
                fontSize: 13, fontWeight: filterAge !== 'all' ? 600 : 400,
                color: filterAge !== 'all' ? '#1d4ed8' : '#4b5563',
                padding: '5px 26px 5px 10px', borderRadius: 6,
                border: `1px solid ${filterAge !== 'all' ? '#bfdbfe' : '#e8eaed'}`,
                background: filterAge !== 'all' ? '#eff6ff' : '#f9fafb',
                cursor: 'pointer', outline: 'none', appearance: 'none' as any,
                ...(isMobile ? { width: '100%' } : {}),
              }}
            >
              <option value="all">All ages</option>
              {allAges.map(a => <option key={a} value={a}>Age {a}</option>)}
            </select>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: filterAge !== 'all' ? '#3b82f6' : '#94a3b8', pointerEvents: 'none' }}>
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Programme filter */}
          <div style={{ position: 'relative', flexShrink: 0, ...(isMobile ? { flex: 1 } : {}) }}>
            <select
              value={filterProgramme}
              onChange={e => { setFilterProgramme(e.target.value); setPage(1); }}
              style={{
                fontSize: 13, fontWeight: filterProgramme !== 'all' ? 600 : 400,
                color: filterProgramme !== 'all' ? '#1d4ed8' : '#4b5563',
                padding: '5px 26px 5px 10px', borderRadius: 6,
                border: `1px solid ${filterProgramme !== 'all' ? '#bfdbfe' : '#e8eaed'}`,
                background: filterProgramme !== 'all' ? '#eff6ff' : '#f9fafb',
                cursor: 'pointer', outline: 'none', appearance: 'none' as any,
                ...(isMobile ? { width: '100%' } : {}),
              }}
            >
              <option value="all">All programmes</option>
              {allProgrammes.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: filterProgramme !== 'all' ? '#3b82f6' : '#94a3b8', pointerEvents: 'none' }}>
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Grouping filter */}
          <div style={{ position: 'relative', flexShrink: 0, ...(isMobile ? { flex: 1 } : {}) }}>
            <select
              value={groupBy}
              onChange={e => setGroupBy(e.target.value as typeof groupBy)}
              style={{
                fontSize: 13, fontWeight: groupBy !== 'none' ? 600 : 400,
                color: groupBy !== 'none' ? '#1d4ed8' : '#4b5563',
                padding: '5px 26px 5px 10px', borderRadius: 6,
                border: `1px solid ${groupBy !== 'none' ? '#bfdbfe' : '#e8eaed'}`,
                background: groupBy !== 'none' ? '#eff6ff' : '#f9fafb',
                cursor: 'pointer', outline: 'none', appearance: 'none' as any,
                ...(isMobile ? { width: '100%' } : {}),
              }}
            >
              <option value="none">No grouping</option>
              <option value="programme">Group by programme</option>
              <option value="age">Group by age</option>
            </select>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: groupBy !== 'none' ? '#3b82f6' : '#94a3b8', pointerEvents: 'none' }}>
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {!isMobile && <div style={{ flex: 1 }} />}

          {/* Divider */}
          {!isMobile && <div style={{ width: 1, height: 18, background: '#e8eaed', margin: '0 6px', flexShrink: 0 }} />}

          {/* Sort */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, ...(isMobile ? { flex: 1 } : {}) }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Sort</span>
            <div style={{ position: 'relative' }}>
              <select
                value={sortKey}
                onChange={e => { setSortKey(e.target.value as SortKey); setSortDir('asc'); }}
                style={{
                  fontSize: 13, fontWeight: 500, color: '#374151',
                  padding: '5px 26px 5px 10px', borderRadius: 6,
                  border: '1px solid #e8eaed', background: '#f9fafb',
                  cursor: 'pointer', outline: 'none', appearance: 'none' as any,
                }}
              >
                <option value="age">Age</option>
                <option value="name">Name</option>
              </select>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <button
              onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
              style={{
                width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid #e8eaed', borderRadius: 6, background: '#f9fafb',
                color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 700, lineHeight: 1,
                flexShrink: 0,
              }}
            >
              {sortDir === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* ══ Zone 3 · Body ═══════════════════════════════════════════════════ */}
      <div style={{ flex: 1, padding: '18px 0 48px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: isMobile ? '0 12px' : '0 32px' }}>

        {/* Result label + Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, paddingLeft: 1 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: currentStage.accent, flexShrink: 0, display: 'inline-block' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: currentStage.textColor }}>{TAB_LABELS[tab]}</span>
          <span style={{ fontSize: 13, color: '#d1d5db' }}>·</span>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            {filtered.length} {filtered.length === 1 ? 'student' : 'students'}
            {(search || filterAge !== 'all' || filterProgramme !== 'all') && ' — filtered'}
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => exportToExcel(sorted, TAB_LABELS[tab])}
            disabled={sorted.length === 0}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', fontSize: 12, fontWeight: 500,
              color: '#374151', background: '#fff',
              border: '1px solid #d1d5db', borderRadius: 7,
              cursor: sorted.length === 0 ? 'not-allowed' : 'pointer',
              opacity: sorted.length === 0 ? 0.4 : 1,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v8M5 7l3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Export
          </button>
        </div>

        {/* States */}
        {isPending && (
          <div style={{ padding: '80px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        )}
        {isError && (
          <div style={{ padding: '80px 0', textAlign: 'center', color: '#ef4444', fontSize: 13 }}>Failed to load students.</div>
        )}
        {!isPending && !isError && filtered.length === 0 && (
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 10, padding: '72px 0', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#374151' }}>
              No {TAB_LABELS[tab].toLowerCase()} students
            </p>
            {(filterAge !== 'all' || filterProgramme !== 'all' || search) && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>Adjust your filters or search.</p>
            )}
          </div>
        )}

        {/* ── Table / Cards ── */}
        {!isPending && !isError && filtered.length > 0 && isMobile && (
          /* ── Mobile: Card layout ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {grouped.map(({ label, rows }) => (
              <React.Fragment key={label || '__all__'}>
                {label && (
                  <div style={{
                    padding: '8px 0 4px', fontSize: 11, fontWeight: 700,
                    color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    {label}
                    <span style={{ marginLeft: 8, fontWeight: 500, color: '#9ca3af', textTransform: 'none', letterSpacing: 0 }}>{rows.length}</span>
                  </div>
                )}
                {rows.map(s => {
                  const age = calcAge(s.lead.childDob);
                  const av  = avatarColor(s.lead.childName);
                  return (
                    <div key={s.id} style={{
                      background: '#fff', border: '1px solid #e8eaed', borderRadius: 10,
                      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
                    }}>
                      {/* Top row: avatar + name + menu */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                          background: av.bg, color: av.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 800, letterSpacing: '0.02em',
                        }}>
                          {initials(s.lead.childName)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.01em' }}>
                            {s.lead.childName}
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); openMenu(s.id, e.currentTarget); }}
                          style={{
                            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '1px solid #e8eaed', background: '#f9fafb', cursor: 'pointer', borderRadius: 8,
                            color: '#64748b', fontSize: 14, flexShrink: 0,
                          }}
                        >
                          <FontAwesomeIcon icon={faEllipsisVertical} />
                        </button>
                      </div>
                      {/* Info row */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: 12, color: '#64748b' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <AgeBadge age={age} />
                        </span>
                        <span>{s.package.programme}</span>
                        <span style={{ color: '#94a3b8' }}>
                          {formatDate(s.lead.childDob)}
                        </span>
                        {(tab === 'active' || tab === 'enrolled') && (
                          <span style={{ color: '#94a3b8' }}>
                            Enrolled {formatEnrolmentMonth(s.enrolmentMonth, s.enrolmentYear)}
                          </span>
                        )}
                        {tab === 'withdrawn' && (
                          <span style={{ color: '#94a3b8' }}>
                            Withdrawn {s.withdrawnAt ? formatDate(s.withdrawnAt) : '—'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        )}
        {!isPending && !isError && filtered.length > 0 && !isMobile && (
          /* ── Tablet / Desktop: Table layout ── */
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ overflowX: isTablet ? 'auto' : undefined }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', ...(isTablet ? { minWidth: 700 } : {}) }}>
                <thead>
                  <tr>
                    <th style={{ ...th, paddingLeft: 20, width: '35%' }}>
                      <span className="sp-th-sort" onClick={() => toggleSort('name')}
                        style={sortKey === 'name' ? { color: '#374151' } : {}}>
                        Name {sortKey === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </span>
                    </th>
                    <th style={{ ...th, width: 72 }}>
                      <span className="sp-th-sort" onClick={() => toggleSort('age')}
                        style={sortKey === 'age' ? { color: '#374151' } : {}}>
                        Age {sortKey === 'age' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </span>
                    </th>
                    <th style={th}>Programme</th>
                    {(tab === 'active' || tab === 'enrolled') && <th style={{ ...th, width: 120 }}>Enrolment</th>}
                    {tab === 'withdrawn'                       && <th style={{ ...th, width: 130 }}>Withdrawn</th>}
                    <th style={{ ...th, width: 148, paddingRight: 20 }} />
                  </tr>
                </thead>
                <tbody>
                  {(() => grouped.map(({ label, rows }) => (
                    <React.Fragment key={label || '__all__'}>
                      {label && (
                        <tr>
                          <td colSpan={colCount} style={{
                            padding: '8px 20px 6px', fontSize: 11, fontWeight: 700,
                            color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em',
                            background: '#f8fafc', borderBottom: '1px solid #f3f4f6',
                          }}>
                            {label}
                            <span style={{ marginLeft: 8, fontWeight: 500, color: '#9ca3af', textTransform: 'none', letterSpacing: 0 }}>{rows.length}</span>
                          </td>
                        </tr>
                      )}
                      {rows.map(s => {
                        const age = calcAge(s.lead.childDob);
                        const av  = avatarColor(s.lead.childName);
                        return (
                          <tr key={s.id} className="sp-row">
                            {/* Name + avatar */}
                            <td style={{ ...td, paddingLeft: 20 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                  background: av.bg, color: av.color,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 10.5, fontWeight: 800, letterSpacing: '0.02em',
                                }}>
                                  {initials(s.lead.childName)}
                                </div>
                                <div>
                                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', letterSpacing: '-0.01em' }}>
                                    {s.lead.childName}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Age */}
                            <td style={td}><AgeBadge age={age} /></td>

                            {/* Programme — plain text, no badge */}
                            <td style={{ ...td, fontSize: 13, color: '#374151' }}>{s.package.programme}</td>

                            {/* Enrolment / Withdrawn date */}
                            {(tab === 'active' || tab === 'enrolled') && (
                              <td style={{ ...td, fontSize: 13, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                                {formatEnrolmentMonth(s.enrolmentMonth, s.enrolmentYear)}
                              </td>
                            )}
                            {tab === 'withdrawn' && (
                              <td style={{ ...td, fontSize: 13, color: '#94a3b8' }}>
                                {s.withdrawnAt ? formatDate(s.withdrawnAt) : '—'}
                              </td>
                            )}

                            {/* Actions */}
                            <td style={{ ...td, paddingRight: 20 }}>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                                {/* Edit — visible on row hover only (not for withdrawn) */}
                                {s.status !== 'withdrawn' && (
                                  <button
                                    className="sp-edit-btn"
                                    onClick={() => setEditingStudent(s)}
                                    style={actionBtn('neutral')}
                                  >
                                    <FontAwesomeIcon icon={faPen} style={{ fontSize: 10, marginRight: 4 }} />
                                    Edit
                                  </button>
                                )}

                                {/* Three-dot overflow menu — always visible */}
                                <button
                                  className="sp-dots-btn"
                                  onClick={(e) => { e.stopPropagation(); openMenu(s.id, e.currentTarget); }}
                                  style={{
                                    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: 'none', background: 'none', cursor: 'pointer', borderRadius: 6,
                                    color: '#64748b', fontSize: 14,
                                  }}
                                >
                                  <FontAwesomeIcon icon={faEllipsisVertical} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  )))()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'center', marginTop: 20 }}>
            <button onClick={() => setPage(1)}                                     disabled={safePage === 1}           style={pgBtn(false)}>«</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))}              disabled={safePage === 1}           style={pgBtn(false)}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)} style={pgBtn(p === safePage)}>{p}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} style={pgBtn(false)}>›</button>
            <button onClick={() => setPage(totalPages)}                        disabled={safePage === totalPages} style={pgBtn(false)}>»</button>
          </div>
        )}
        </div>
      </div>

      {/* ══ Modals ══════════════════════════════════════════════════════════ */}

      {editingStudent && (
        <EditStudentModal
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSaved={handleSaved}
        />
      )}

      {withdrawingStudent && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={mTitle}>Withdraw Student</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#4b5563' }}>
              <strong>{withdrawingStudent.lead.childName}</strong> · {withdrawingStudent.package.name}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={mLabel}>
                Withdrawal Date
                <input type="date" value={withdrawDate} onChange={e => setWithdrawDate(e.target.value)} style={mInput} required />
              </label>
              <label style={mLabel}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Reason <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span>
                </span>
                <textarea value={withdrawReason} onChange={e => setWithdrawReason(e.target.value)} style={{ ...mInput, height: 72, resize: 'vertical' }} placeholder="e.g. moving overseas, financial reasons…" />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => { setWithdrawingStudent(null); setWithdrawDate(''); setWithdrawReason(''); }} style={mCancel} disabled={withdrawMutation.isPending}>Cancel</button>
              <button
                onClick={() => { if (!withdrawDate) return; withdrawMutation.mutate({ id: withdrawingStudent.id, date: withdrawDate, reason: withdrawReason }); }}
                style={{ ...mAction, background: '#dc2626' }}
                disabled={withdrawMutation.isPending || !withdrawDate}
              >
                {withdrawMutation.isPending ? 'Withdrawing…' : 'Confirm Withdraw'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingReasonStudent && (
        <div style={overlayStyle} onClick={() => setViewingReasonStudent(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={mTitle}>Withdrawal Details</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#4b5563' }}>
              <strong>{viewingReasonStudent.lead.childName}</strong> · {viewingReasonStudent.package.name}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={mFieldLabel}>Withdrawn Date</div>
                <div style={{ fontSize: 14, color: '#111827' }}>{viewingReasonStudent.withdrawnAt ? formatDate(viewingReasonStudent.withdrawnAt) : '—'}</div>
              </div>
              <div>
                <div style={mFieldLabel}>Reason</div>
                <div style={{ fontSize: 14, color: viewingReasonStudent.withdrawReason ? '#111827' : '#9ca3af', fontStyle: viewingReasonStudent.withdrawReason ? 'normal' : 'italic' }}>
                  {viewingReasonStudent.withdrawReason ?? 'No reason provided'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setViewingReasonStudent(null)} style={mCancel}>Close</button>
            </div>
          </div>
        </div>
      )}

      {reactivatingStudent && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={mTitle}>Reactivate Student</h3>
            <p style={{ margin: '0 0 10px', fontSize: 14, color: '#4b5563' }}>
              <strong>{reactivatingStudent.lead.childName}</strong> · {reactivatingStudent.package.name}
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280' }}>
              This will restore the student to active status and clear the withdrawal record.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setReactivatingStudent(null)} style={mCancel} disabled={reactivateMutation.isPending}>Cancel</button>
              <button onClick={() => reactivateMutation.mutate(reactivatingStudent.id)} style={{ ...mAction, background: '#16a34a' }} disabled={reactivateMutation.isPending}>
                {reactivateMutation.isPending ? 'Reactivating…' : 'Yes, Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingStudent && (
        <div style={overlayStyle} onClick={() => setDeletingStudent(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h3 style={mTitle}>Delete Student</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#4b5563' }}>
              Permanently delete <strong>{deletingStudent.lead.childName}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeletingStudent(null)} style={mCancel} disabled={deleteMutation.isPending}>Cancel</button>
              <button onClick={() => deleteMutation.mutate(deletingStudent.id)} style={{ ...mAction, background: '#dc2626' }} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Portal-rendered overflow menu (avoids table overflow clipping) */}
      {openMenuId && (() => {
        const s = students.find(st => st.id === openMenuId);
        if (!s) return null;
        return createPortal(
          <div ref={menuRef} style={{
            position: 'fixed', top: menuPos.top, right: menuPos.right,
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 160, zIndex: 300,
            padding: '4px 0', overflow: 'hidden',
          }}>
            {s.status === 'withdrawn' ? (
              <>
                <button className="sp-menu-item" onClick={() => { setViewingReasonStudent(s); setOpenMenuId(null); }} style={menuItemStyle}>
                  <FontAwesomeIcon icon={faCircleInfo} style={{ width: 14, color: '#64748b' }} /> View Reason
                </button>
                <button className="sp-menu-item" onClick={() => { setReactivatingStudent(s); setOpenMenuId(null); }} style={{ ...menuItemStyle, color: '#16a34a' }}>
                  <FontAwesomeIcon icon={faArrowRotateLeft} style={{ width: 14 }} /> Reactivate
                </button>
                <div style={{ height: 1, background: '#f3f4f6', margin: '4px 0' }} />
                <button className="sp-menu-item" onClick={() => { setDeletingStudent(s); setOpenMenuId(null); }} style={{ ...menuItemStyle, color: '#dc2626' }}>
                  <FontAwesomeIcon icon={faTrash} style={{ width: 14 }} /> Delete
                </button>
              </>
            ) : (
              <>
                {s.status === 'enrolled' && (
                  <button className="sp-menu-item" onClick={() => {
                    setOpenMenuId(null);
                    const tasks: { done: boolean }[] = Array.isArray(s.onboardingProgress) ? s.onboardingProgress : [];
                    const hasTasks = tasks.length > 0;
                    const hasIncompleteTasks = tasks.some(t => !t.done);
                    const doActivate = async () => {
                      try {
                        await completeOnboarding(s.id, true);
                        await updateStudent(s.id, { startDate: new Date().toISOString().split('T')[0] });
                        queryClient.invalidateQueries({ queryKey: ['students'] });
                        showToast(`${s.lead.childName} marked as active`);
                      } catch (e) {
                        setConfirmModal({ message: e instanceof Error ? e.message : 'Failed to mark active', onConfirm: () => {} });
                      }
                    };
                    if (hasIncompleteTasks || !hasTasks) {
                      setConfirmModal({
                        message: `${s.lead.childName} has ${!hasTasks ? 'no' : 'incomplete'} onboarding tasks. Mark as active anyway?`,
                        onConfirm: doActivate,
                      });
                    } else {
                      doActivate();
                    }
                  }} style={{ ...menuItemStyle, color: '#16a34a' }}>
                    <FontAwesomeIcon icon={faCircleCheck} style={{ width: 14 }} /> Mark Active
                  </button>
                )}
                <button className="sp-menu-item" onClick={() => { setEditingStudent(s); setOpenMenuId(null); }} style={menuItemStyle}>
                  <FontAwesomeIcon icon={faPen} style={{ width: 14, color: '#64748b' }} /> Edit Student
                </button>
                <div style={{ height: 1, background: '#f3f4f6', margin: '4px 0' }} />
                <button className="sp-menu-item" onClick={() => { setWithdrawingStudent(s); setWithdrawDate(new Date().toISOString().split('T')[0]); setWithdrawReason(''); setOpenMenuId(null); }} style={{ ...menuItemStyle, color: '#dc2626' }}>
                  <FontAwesomeIcon icon={faRightFromBracket} style={{ width: 14 }} /> Withdraw
                </button>
              </>
            )}
          </div>,
          document.body,
        );
      })()}
      {/* Confirm modal */}
      {confirmModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px 28px', minWidth: 320, maxWidth: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <p style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 600, color: '#1a202c', lineHeight: 1.5 }}>{confirmModal.message}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmModal(null)} style={{ padding: '8px 18px', background: '#edf2f7', color: '#4a5568', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }} style={{ padding: '8px 18px', background: confirmModal.destructive ? '#dc2626' : '#3182ce', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                {confirmModal.destructive ? 'Delete' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pgBtn(active: boolean): React.CSSProperties {
  return {
    minWidth: 30, padding: '5px 9px', borderRadius: 6,
    border: active ? '1px solid #5a79c8' : '1px solid #e5e7eb',
    background: active ? '#5a79c8' : '#fff',
    color: active ? '#fff' : '#374151',
    cursor: 'pointer', fontSize: 13, fontWeight: 500,
  };
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
};
const modalStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: '28px 32px',
  maxWidth: 420, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
};
const mTitle: React.CSSProperties       = { margin: '0 0 12px', fontSize: 17, fontWeight: 700, color: '#111827' };
const mLabel: React.CSSProperties       = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, fontWeight: 600, color: '#374151' };
const mInput: React.CSSProperties       = { padding: '8px 10px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 14, color: '#111827', background: '#fff', width: '100%', boxSizing: 'border-box' };
const mCancel: React.CSSProperties      = { padding: '8px 18px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 };
const mAction: React.CSSProperties      = { padding: '8px 18px', borderRadius: 7, border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 };
const mFieldLabel: React.CSSProperties  = { fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 };
const menuItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
  padding: '8px 14px', border: 'none', background: 'none',
  fontSize: 13, fontWeight: 500, color: '#374151', cursor: 'pointer',
  textAlign: 'left',
};
