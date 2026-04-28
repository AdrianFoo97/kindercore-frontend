import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSearch } from '@fortawesome/free-solid-svg-icons';
import { fetchTeachers, updateTeacher } from '../api/planner.js';
import { fetchTeachersWithSalary, fetchPositions } from '../api/salary.js';
import { useToast } from '../components/common/Toast.js';
import { TeacherRow } from './teachers/TeacherRow.js';
import { TeachersToolbar, TeachersTabKey } from './teachers/TeachersToolbar.js';
import { ResignDialog } from './teachers/ResignDialog.js';
import { HeaderStats } from './teachers/HeaderStats.js';
import { TP_C, TP_MOTION, TP_RADIUS } from './teachers/tokens.js';

interface SalaryEntry {
  calculatedSalary: number;
  isFixedSalary: boolean;
}

export default function TeachersPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ['planner-teachers'],
    queryFn: fetchTeachers,
  });
  const { data: positions = [] } = useQuery({
    queryKey: ['salary-positions'],
    queryFn: fetchPositions,
  });
  const { data: teachersSalary = [] } = useQuery({
    queryKey: ['salary-teachers'],
    queryFn: fetchTeachersWithSalary,
  });

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TeachersTabKey>('active');
  const [resignTarget, setResignTarget] = useState<any>(null);

  const salaryMap = useMemo(() => {
    const m = new Map<string, SalaryEntry>();
    for (const t of teachersSalary) {
      m.set(t.id, {
        calculatedSalary: t.calculatedSalary,
        isFixedSalary: t.isFixedSalary,
      });
    }
    return m;
  }, [teachersSalary]);

  const posMap = useMemo(
    () => new Map(positions.map(p => [p.positionId, p])),
    [positions],
  );

  // Today, normalized to start-of-day for stable date comparisons.
  // Soft-deleted teachers (isActive=false AND resignedAt=null) are hidden
  // from every filter — they're "never should have existed" rows.
  // Active = visible AND (no resignedAt OR resignedAt is in the future) —
  //         this includes teachers scheduled to resign on a future date.
  // Inactive = visible AND resignedAt is in the past or today.
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const counts = useMemo(() => {
    let active = 0;
    let inactive = 0;
    let all = 0;
    for (const t of teachers as any[]) {
      const visible = t.isActive || !!t.resignedAt;
      if (!visible) continue;
      all++;
      const stillActive = !t.resignedAt || new Date(t.resignedAt) > today;
      if (stillActive) active++;
      else inactive++;
    }
    return { active, inactive, all };
  }, [teachers, today]);

  const incompleteCount = useMemo(() => {
    let n = 0;
    for (const t of teachers as any[]) {
      const visible = t.isActive || !!t.resignedAt;
      if (!visible) continue;
      const stillActive = !t.resignedAt || new Date(t.resignedAt) > today;
      if (!stillActive) continue;
      const pos = t.positionId ? posMap.get(t.positionId) : null;
      const sal = salaryMap.get(t.id);
      if (!pos || !sal || sal.calculatedSalary <= 0) n++;
    }
    return n;
  }, [teachers, posMap, salaryMap, today]);

  const headerStats = useMemo(() => {
    let partTime = 0;
    let fullTime = 0;
    for (const t of teachers as any[]) {
      const visible = t.isActive || !!t.resignedAt;
      if (!visible) continue;
      const stillActive = !t.resignedAt || new Date(t.resignedAt) > today;
      if (!stillActive) continue;
      const days = Array.isArray(t.workDays) ? t.workDays.length : 0;
      if (t.workStartMinute == null || t.workEndMinute == null || days <= 0) continue;
      const rawHours = (t.workEndMinute - t.workStartMinute) / 60;
      const dailyHours = rawHours >= 6 ? rawHours - 1 : rawHours;
      const weekly = dailyHours * days;
      if (weekly <= 0) continue;
      if (weekly < 35) partTime++;
      else fullTime++;
    }
    return {
      total: counts.active,
      fullTime,
      partTime,
    };
  }, [teachers, counts.active, today]);

  const filteredTeachers = useMemo(() => {
    let list = (teachers as any[]).filter(t => t.isActive || !!t.resignedAt);
    if (tab === 'active') {
      list = list.filter(t => !t.resignedAt || new Date(t.resignedAt) > today);
    } else if (tab === 'inactive') {
      list = list.filter(t => !!t.resignedAt && new Date(t.resignedAt) <= today);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(q));
    }
    return list;
  }, [teachers, search, tab, today]);

  const handleResignConfirm = async (date: string) => {
    if (!resignTarget) return;
    try {
      // Only set resignedAt — isActive is reserved for soft-delete and
      // shouldn't be flipped on resign. Active/inactive is derived from
      // resignedAt against today (see filter logic above).
      await updateTeacher(resignTarget.id, { resignedAt: date });
      qc.invalidateQueries({ queryKey: ['planner-teachers'] });
      qc.invalidateQueries({ queryKey: ['salary-teachers'] });
      showToast(`${resignTarget.name} marked as resigned`);
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to resign', 'error');
    }
    setResignTarget(null);
  };

  if (isLoading) {
    return (
      <div style={s.page}>
        <div style={s.inner}>
          <p style={{ color: TP_C.muted, textAlign: 'center', marginTop: 80 }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <style>{css}</style>
      <div style={s.inner}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <h1 style={s.heading}>Teachers</h1>
            {incompleteCount > 0 && (
              <p style={s.subtitle}>
                <span style={{ color: TP_C.amber, fontWeight: 600 }}>
                  {incompleteCount} profile{incompleteCount === 1 ? '' : 's'} incomplete
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Summary */}
        <HeaderStats stats={headerStats} />

        {/* Toolbar */}
        <TeachersToolbar
          tab={tab}
          onTabChange={setTab}
          counts={counts}
          search={search}
          onSearchChange={setSearch}
          rightActions={
            <button
              onClick={() => navigate('/teachers/new')}
              className="tp-add-btn"
              style={s.addBtn}
            >
              <FontAwesomeIcon icon={faPlus} style={{ fontSize: 11 }} /> Add Teacher
            </button>
          }
        />

        {/* Table / empty */}
        {filteredTeachers.length === 0 ? (
          <div style={s.emptyState}>
            <div style={s.emptyIcon}>
              <FontAwesomeIcon
                icon={search ? faSearch : faPlus}
                style={{ fontSize: 18, color: TP_C.muted }}
              />
            </div>
            <div style={s.emptyTitle}>
              {search ? 'No teachers match your search' : 'No teachers yet'}
            </div>
            <div style={s.emptySub}>
              {search ? 'Try a different search term.' : 'Add your first teacher to get started.'}
            </div>
          </div>
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <colgroup>
                <col />
                <col style={{ width: '26%' }} />
                <col style={{ width: 180 }} />
                <col style={{ width: 160 }} />
                <col style={{ width: 56 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={s.th}>Teacher</th>
                  <th style={s.th}>Role</th>
                  <th style={s.th}>Schedule</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Salary</th>
                  <th style={s.th} />
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((t: any) => (
                  <TeacherRow
                    key={t.id}
                    teacher={t}
                    position={t.positionId ? posMap.get(t.positionId) : null}
                    salary={salaryMap.get(t.id)}
                    onClick={() => navigate(`/teachers/${t.id}`)}
                    onResign={() => setResignTarget(t)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {resignTarget && (
        <ResignDialog
          name={resignTarget.name}
          onConfirm={handleResignConfirm}
          onCancel={() => setResignTarget(null)}
        />
      )}
    </div>
  );
}

const css = `
  .tp-row { transition: background ${TP_MOTION.fast}; cursor: pointer; }
  .tp-row > td { transition: box-shadow ${TP_MOTION.fast}; }
  .tp-row:hover { background: #f7f9fc; }
  .tp-row:hover > td:first-child { box-shadow: inset 3px 0 0 ${TP_C.primary}; }
  .tp-row:hover .tp-actions { opacity: 1 !important; }
  .tp-more:hover { background: #e2e8f0 !important; color: ${TP_C.text} !important; }
  .tp-menu-item:hover { background: #f8fafc !important; }
  .tp-menu-danger:hover { background: ${TP_C.redBg} !important; }
  .tp-search:focus-within { border-color: ${TP_C.primary} !important; box-shadow: 0 0 0 3px rgba(90, 103, 216, 0.12) !important; }
  .tp-search:focus-within svg { color: ${TP_C.primary} !important; }
  .tp-tab:hover:not(.tp-tab-active) { color: ${TP_C.textSub} !important; }
  .tp-add-btn:hover { background: ${TP_C.primaryHover} !important; box-shadow: 0 4px 10px rgba(90, 103, 216, 0.28) !important; transform: translateY(-0.5px); }
`;

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: '32px 40px',
    background: TP_C.bg,
    minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: TP_C.text,
  },
  inner: { maxWidth: 1180, margin: '0 auto' },

  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 22,
    gap: 16,
  },
  heading: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: TP_C.text,
  },
  subtitle: {
    margin: '6px 0 0',
    fontSize: 13,
    color: TP_C.muted,
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: 0,
  },
  subtitleSep: { margin: '0 8px', color: TP_C.dim },
  addBtn: {
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 600,
    borderRadius: TP_RADIUS.control,
    border: 'none',
    background: TP_C.primary,
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    whiteSpace: 'nowrap' as const,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(90, 103, 216, 0.18)',
    transition: `all ${TP_MOTION.fast}`,
  },

  emptyState: {
    border: `1px solid ${TP_C.borderSoft}`,
    borderRadius: TP_RADIUS.card,
    padding: '64px 24px',
    textAlign: 'center' as const,
    background: TP_C.card,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: '#f1f5f9',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 15, fontWeight: 700, color: TP_C.text, marginBottom: 4 },
  emptySub: { fontSize: 13, color: TP_C.muted },

  tableWrap: {
    border: `1px solid ${TP_C.borderSoft}`,
    borderRadius: TP_RADIUS.card,
    overflow: 'hidden',
    background: TP_C.card,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 24px rgba(15, 23, 42, 0.06)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 13,
    tableLayout: 'fixed' as const,
  },
  th: {
    textAlign: 'left' as const,
    padding: '13px 16px',
    fontWeight: 700,
    fontSize: 10,
    color: TP_C.muted,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    borderBottom: `1px solid ${TP_C.borderSoft}`,
    whiteSpace: 'nowrap' as const,
    background: '#fafbfc',
  },
};
