import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { fetchStudents, withdrawStudent, reactivateStudent } from '../api/students.js';
import { Student } from '../types/index.js';
import EditStudentModal from '../components/students/EditStudentModal.js';

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

type FilterTab = 'active' | 'enrolled' | 'graduated' | 'withdrawn';

function isWithdrawn(s: Student) {
  return s.withdrawnAt != null;
}
function classAge(s: Student) {
  return CURRENT_YEAR - new Date(s.lead.childDob).getFullYear();
}
function isGraduated(s: Student) {
  return !isWithdrawn(s) && classAge(s) > 6;
}
function isEnrolled(s: Student) {
  return !isWithdrawn(s) && !isGraduated(s) && (
    s.enrolmentYear > CURRENT_YEAR ||
    (s.enrolmentYear === CURRENT_YEAR && s.enrolmentMonth > CURRENT_MONTH)
  );
}
function isActive(s: Student) {
  return !isWithdrawn(s) && !isGraduated(s) && !isEnrolled(s);
}

function calcAge(dob: string): number {
  return CURRENT_YEAR - new Date(dob).getFullYear();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-MY', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatEnrolmentMonth(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1] ?? month} ${year}`;
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

// ── Main Page ─────────────────────────────────────────────────────────────────

type SortKey = 'name' | 'age';
type SortDir = 'asc' | 'desc';

export default function StudentsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<FilterTab>('active');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [withdrawingStudent, setWithdrawingStudent] = useState<Student | null>(null);
  const [withdrawDate, setWithdrawDate] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('');
  const [reactivatingStudent, setReactivatingStudent] = useState<Student | null>(null);
  const [viewingReasonStudent, setViewingReasonStudent] = useState<Student | null>(null);
  const [groupBy, setGroupBy] = useState<'none' | 'programme' | 'age'>('none');
  const [filterAge, setFilterAge] = useState<string>('all');
  const [filterProgramme, setFilterProgramme] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('age');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const { data: students = [], isPending, isError } = useQuery({
    queryKey: ['students'],
    queryFn: fetchStudents,
  });
  const isLoading = isPending;

  const withdrawMutation = useMutation({
    mutationFn: ({ id, date, reason }: { id: string; date: string; reason: string }) =>
      withdrawStudent(id, { withdrawnAt: new Date(date).toISOString(), withdrawReason: reason || undefined }),
    onSuccess: (updated) => {
      queryClient.setQueryData<Student[]>(['students'], (prev = []) =>
        prev.map(s => s.id === updated.id ? updated : s)
      );
      setWithdrawingStudent(null);
      setWithdrawDate('');
      setWithdrawReason('');
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => reactivateStudent(id),
    onSuccess: (updated) => {
      queryClient.setQueryData<Student[]>(['students'], (prev = []) =>
        prev.map(s => s.id === updated.id ? updated : s)
      );
      setReactivatingStudent(null);
    },
  });

  const tabFiltered = students.filter(s => {
    if (tab === 'active') return isActive(s);
    if (tab === 'enrolled') return isEnrolled(s);
    if (tab === 'withdrawn') return isWithdrawn(s);
    return isGraduated(s);
  });

  const allAges = [...new Set(tabFiltered.map(s => classAge(s)))].sort((a, b) => a - b);
  const allProgrammes = [...new Set(tabFiltered.map(s => s.package.programme))].sort();

  const filtered = tabFiltered.filter(s => {
    if (filterAge !== 'all' && classAge(s) !== Number(filterAge)) return false;
    if (filterProgramme !== 'all' && s.package.programme !== filterProgramme) return false;
    return true;
  });

  const PAGE_SIZE = 15;

  const sorted = [...filtered].sort((a, b) => {
    const primary = sortKey === 'name'
      ? a.lead.childName.localeCompare(b.lead.childName)
      : classAge(a) - classAge(b);
    const secondary = sortKey === 'name'
      ? classAge(a) - classAge(b)
      : a.lead.childName.localeCompare(b.lead.childName);
    const dir = sortDir === 'asc' ? 1 : -1;
    return primary !== 0 ? primary * dir : secondary;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Group the paginated list into ordered sections
  const grouped: { label: string; rows: Student[] }[] = (() => {
    if (groupBy === 'none') return [{ label: '', rows: paginated }];
    const map = new Map<string, Student[]>();
    for (const s of paginated) {
      const key = groupBy === 'programme' ? s.package.programme : `Age ${classAge(s)}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([label, rows]) => ({ label, rows }));
  })();

  const counts = {
    active: students.filter(isActive).length,
    enrolled: students.filter(isEnrolled).length,
    graduated: students.filter(isGraduated).length,
    withdrawn: students.filter(isWithdrawn).length,
  };

  const handleSaved = (updated: Student) => {
    queryClient.setQueryData<Student[]>(['students'], (prev = []) =>
      prev.map(s => s.id === updated.id ? updated : s)
    );
    setEditingStudent(null);
  };

  const handleDeleted = (id: string) => {
    queryClient.setQueryData<Student[]>(['students'], (prev = []) =>
      prev.filter(s => s.id !== id)
    );
    setEditingStudent(null);
  };

  return (
    <div style={styles.page}>
      <div style={styles.inner}>
        <div style={styles.header}>
          <h1 style={styles.heading}>Student List</h1>
          <button
            onClick={() => exportToExcel(sorted, tab.charAt(0).toUpperCase() + tab.slice(1))}
            style={styles.exportBtn}
            disabled={sorted.length === 0}
          >
            ↓ Export Excel
          </button>
        </div>
        <div style={styles.tabs}>
          {(['active', 'enrolled', 'graduated', 'withdrawn'] as FilterTab[]).map(t => {
            const labels: Record<FilterTab, string> = {
              active: 'Active',
              enrolled: 'Enrolled',
              graduated: 'Graduated',
              withdrawn: 'Withdrawn',
            };
            return (
              <button
                key={t}
                onClick={() => { setTab(t); setFilterAge('all'); setFilterProgramme('all'); setPage(1); }}
                style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
              >
                {labels[t]}
                <span style={{ ...styles.tabCount, ...(tab === t ? styles.tabCountActive : {}) }}>
                  {counts[t]}
                </span>
              </button>
            );
          })}
        </div>

        <div style={styles.toolbar}>
          <div style={styles.toolbarGroup}>
            <span style={styles.toolbarLabel}>Filter</span>
            <select
              value={filterAge}
              onChange={e => { setFilterAge(e.target.value); setPage(1); }}
              style={styles.toolbarSelect}
            >
              <option value="all">All Ages</option>
              {allAges.map(a => <option key={a} value={a}>Age {a}</option>)}
            </select>
            <select
              value={filterProgramme}
              onChange={e => { setFilterProgramme(e.target.value); setPage(1); }}
              style={styles.toolbarSelect}
            >
              <option value="all">All Programmes</option>
              {allProgrammes.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={styles.toolbarDivider} />
          <div style={styles.toolbarGroup}>
            <span style={styles.toolbarLabel}>Group by</span>
            <select
              value={groupBy}
              onChange={e => setGroupBy(e.target.value as typeof groupBy)}
              style={styles.toolbarSelect}
            >
              <option value="none">None</option>
              <option value="programme">Programme</option>
              <option value="age">Class Age</option>
            </select>
          </div>
          <div style={styles.toolbarDivider} />
          <div style={styles.toolbarGroup}>
            <span style={styles.toolbarLabel}>Sort by</span>
            <select
              value={sortKey}
              onChange={e => { setSortKey(e.target.value as SortKey); setSortDir('asc'); }}
              style={styles.toolbarSelect}
            >
              <option value="age">Age</option>
              <option value="name">Name</option>
            </select>
            <button
              onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              style={styles.sortDirBtn}
              title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortDir === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        {isLoading && <p style={styles.stateMsg}>Loading…</p>}
        {isError && <p style={{ ...styles.stateMsg, color: '#e53e3e' }}>Failed to load students.</p>}

        {!isLoading && !isError && filtered.length === 0 && (
          <p style={styles.stateMsg}>
            {students.length === 0 ? 'No students enrolled yet.' : `No ${tab} students.`}
          </p>
        )}

        {filtered.length > 0 && (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: 40 }}>#</th>
                  <th style={styles.th}>Name</th>
                  <th style={{ ...styles.th, width: 80 }}>Age</th>
                  <th style={styles.th}>Programme</th>
                  {tab === 'withdrawn' && <th style={{ ...styles.th, width: 140 }}>Withdrawn Date</th>}
                  <th style={{ ...styles.th, width: 160 }}></th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let rowOffset = (safePage - 1) * PAGE_SIZE;
                  return grouped.map(({ label, rows }) => (
                  <React.Fragment key={label || '__all__'}>
                    {label && (
                      <tr>
                        <td colSpan={tab === 'withdrawn' ? 6 : 5} style={styles.groupHeader}>{label} <span style={styles.groupCount}>{rows.length}</span></td>
                      </tr>
                    )}
                    {rows.map((s) => {
                  rowOffset += 1;
                  const rowNum = rowOffset;
                  const age = calcAge(s.lead.childDob);
                  return (
                    <tr key={s.id} style={styles.tr}>
                      <td style={{ ...styles.td, color: '#a0aec0', fontSize: 12, textAlign: 'center' }}>{rowNum}</td>
                      <td style={styles.td}>
                        <span style={styles.name}>{s.lead.childName}</span>
                        {s.notes && <div style={styles.noteText}>{s.notes}</div>}
                      </td>
                      <td style={styles.td}>
                        <span style={ageBadgeStyle(age)}>Age {age}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.pkgBadge}>{s.package.programme}</span>
                      </td>
                      {tab === 'withdrawn' && (
                        <td style={{ ...styles.td, fontSize: 13, color: '#718096' }}>
                          {s.withdrawnAt ? formatDate(s.withdrawnAt) : '—'}
                        </td>
                      )}
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {isWithdrawn(s) ? (
                            <button onClick={() => setViewingReasonStudent(s)} style={styles.editBtn}>Reason</button>
                          ) : (
                            <button onClick={() => setEditingStudent(s)} style={styles.editBtn}>Edit</button>
                          )}
                          {isWithdrawn(s) ? (
                            <button onClick={() => setReactivatingStudent(s)} style={styles.reactivateBtn}>Reactivate</button>
                          ) : (
                            <button onClick={() => {
                              setWithdrawingStudent(s);
                              setWithdrawDate(new Date().toISOString().split('T')[0]);
                              setWithdrawReason('');
                            }} style={styles.withdrawBtn}>Withdraw</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                    })}
                  </React.Fragment>
                ));
                })()}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div style={styles.pagination}>
            <button onClick={() => setPage(1)} disabled={safePage === 1} style={styles.pageBtn}>«</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} style={styles.pageBtn}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)} style={{ ...styles.pageBtn, ...(p === safePage ? styles.pageBtnActive : {}) }}>{p}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} style={styles.pageBtn}>›</button>
            <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages} style={styles.pageBtn}>»</button>
          </div>
        )}
      </div>

      {editingStudent && (
        <EditStudentModal
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}

      {withdrawingStudent && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h3 style={styles.modalTitle}>Withdraw Student</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#4a5568' }}>
              <strong>{withdrawingStudent.lead.childName}</strong> · {withdrawingStudent.package.name}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={styles.modalLabel}>
                Withdrawal Date
                <input
                  type="date"
                  value={withdrawDate}
                  onChange={e => setWithdrawDate(e.target.value)}
                  style={styles.modalInput}
                  required
                />
              </label>
              <label style={styles.modalLabel}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Reason <span style={{ fontWeight: 400, color: '#a0aec0' }}>(optional)</span>
                </div>
                <textarea
                  value={withdrawReason}
                  onChange={e => setWithdrawReason(e.target.value)}
                  style={{ ...styles.modalInput, height: 72, resize: 'vertical' as const }}
                  placeholder="e.g. moving overseas, financial reasons…"
                />
              </label>
            </div>
            <div style={{ ...styles.modalActions, marginTop: 20 }}>
              <button
                onClick={() => { setWithdrawingStudent(null); setWithdrawDate(''); setWithdrawReason(''); }}
                style={styles.modalCancelBtn}
                disabled={withdrawMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!withdrawDate) return;
                  withdrawMutation.mutate({ id: withdrawingStudent.id, date: withdrawDate, reason: withdrawReason });
                }}
                style={styles.modalConfirmBtn}
                disabled={withdrawMutation.isPending || !withdrawDate}
              >
                {withdrawMutation.isPending ? 'Withdrawing…' : 'Confirm Withdraw'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingReasonStudent && (
        <div style={styles.modalOverlay} onClick={() => setViewingReasonStudent(null)}>
          <div style={styles.modalBox} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Withdrawal Details</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#4a5568' }}>
              <strong>{viewingReasonStudent.lead.childName}</strong> · {viewingReasonStudent.package.name}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#718096', marginBottom: 4 }}>Withdrawn Date</div>
                <div style={{ fontSize: 14, color: '#2d3748' }}>
                  {viewingReasonStudent.withdrawnAt ? formatDate(viewingReasonStudent.withdrawnAt) : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#718096', marginBottom: 4 }}>Reason</div>
                <div style={{ fontSize: 14, color: viewingReasonStudent.withdrawReason ? '#2d3748' : '#a0aec0', fontStyle: viewingReasonStudent.withdrawReason ? 'normal' : 'italic' }}>
                  {viewingReasonStudent.withdrawReason ?? 'No reason provided'}
                </div>
              </div>
            </div>
            <div style={{ ...styles.modalActions, marginTop: 20 }}>
              <button onClick={() => setViewingReasonStudent(null)} style={styles.modalCancelBtn}>Close</button>
            </div>
          </div>
        </div>
      )}

      {reactivatingStudent && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <h3 style={styles.modalTitle}>Reactivate Student</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#4a5568' }}>
              <strong>{reactivatingStudent.lead.childName}</strong> · {reactivatingStudent.package.name}
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#4a5568' }}>
              This will restore the student to active status and clear the withdrawal record.
            </p>
            <div style={{ ...styles.modalActions }}>
              <button
                onClick={() => setReactivatingStudent(null)}
                style={styles.modalCancelBtn}
                disabled={reactivateMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={() => reactivateMutation.mutate(reactivatingStudent.id)}
                style={styles.modalReactivateBtn}
                disabled={reactivateMutation.isPending}
              >
                {reactivateMutation.isPending ? 'Reactivating…' : 'Yes, Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const AGE_PALETTE: Record<number, { bg: string; color: string }> = {
  2: { bg: '#fed7e2', color: '#97266d' },
  3: { bg: '#feebc8', color: '#c05621' },
  4: { bg: '#fefcbf', color: '#744210' },
  5: { bg: '#c6f6d5', color: '#276749' },
  6: { bg: '#bee3f8', color: '#2c5282' },
};

function ageBadgeStyle(age: number): React.CSSProperties {
  const { bg, color } = AGE_PALETTE[age] ?? { bg: '#e2e8f0', color: '#4a5568' };
  return {
    display: 'inline-block', padding: '2px 9px', background: bg, color,
    borderRadius: 10, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' as const,
  };
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px 24px', fontFamily: 'system-ui, sans-serif', display: 'flex', justifyContent: 'center' },
  inner: { width: '100%', maxWidth: 960 },
  header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, justifyContent: 'space-between' },
  heading: { margin: 0, fontSize: 24 },
  exportBtn: {
    padding: '7px 16px', fontSize: 13, fontWeight: 600,
    background: '#fff', color: '#2d3748',
    border: '1px solid #e2e8f0', borderRadius: 8,
    cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  tabs: { display: 'flex', gap: 8, marginBottom: 24 },
  tab: {
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '7px 18px', borderRadius: 8, border: '1px solid #e2e8f0',
    background: '#f7fafc', color: '#4a5568', cursor: 'pointer',
    fontSize: 14, fontWeight: 600,
  },
  tabActive: {
    background: '#2b6cb0', color: '#fff', border: '1px solid #2b6cb0',
  },
  tabCount: {
    display: 'inline-block', minWidth: 20, padding: '1px 7px',
    background: '#e2e8f0', color: '#4a5568',
    borderRadius: 10, fontSize: 12, fontWeight: 700, textAlign: 'center' as const,
  },
  tabCountActive: { background: 'rgba(255,255,255,0.25)', color: '#fff' },
  toolbar: {
    display: 'flex', alignItems: 'center', gap: 0, marginBottom: 20,
    background: '#f7fafc', border: '1px solid #e2e8f0',
    borderRadius: 10, padding: '8px 16px', width: 'fit-content',
  },
  toolbarGroup: { display: 'flex', alignItems: 'center', gap: 8 },
  toolbarDivider: { width: 1, height: 20, background: '#e2e8f0', margin: '0 16px' },
  toolbarLabel: { fontSize: 12, fontWeight: 600, color: '#718096', whiteSpace: 'nowrap' as const },
  toolbarSelect: {
    fontSize: 13, fontWeight: 600, color: '#2d3748',
    padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0',
    background: '#fff', cursor: 'pointer', outline: 'none',
  },
  sortDirBtn: {
    fontSize: 13, fontWeight: 700, color: '#2b6cb0',
    padding: '4px 8px', borderRadius: 6, border: '1px solid #bee3f8',
    background: '#ebf8ff', cursor: 'pointer', lineHeight: 1,
  },
  groupHeader: {
    padding: '8px 14px', background: '#f7fafc', fontWeight: 700, fontSize: 13,
    color: '#2d3748', borderTop: '2px solid #e2e8f0', borderBottom: '1px solid #e2e8f0',
  },
  groupCount: {
    display: 'inline-block', marginLeft: 6, padding: '1px 8px', background: '#e2e8f0',
    color: '#4a5568', borderRadius: 10, fontSize: 12, fontWeight: 700,
  },
  stateMsg: { color: '#718096', textAlign: 'center', marginTop: 48, fontSize: 15 },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left', padding: '10px 14px', borderBottom: '2px solid #e2e8f0',
    background: '#f7fafc', fontWeight: 700, fontSize: 13, color: '#4a5568', whiteSpace: 'nowrap' as const,
  },
  tr: { borderBottom: '1px solid #edf2f7' },
  td: { padding: '12px 14px', verticalAlign: 'middle', fontSize: 14 },
  name: { fontWeight: 600, color: '#2d3748', fontSize: 14 },
  subText: { fontSize: 12, color: '#718096', marginTop: 3 },
  noteText: { fontSize: 12, color: '#a0aec0', marginTop: 2, fontStyle: 'italic' },
  pkgBadge: {
    display: 'inline-block', padding: '3px 10px', background: '#ebf8ff', color: '#2b6cb0',
    border: '1px solid #bee3f8', borderRadius: 10, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' as const,
  },
  yearBadge: {
    display: 'inline-block', padding: '2px 10px', background: '#f0fff4', color: '#276749',
    border: '1px solid #9ae6b4', borderRadius: 10, fontSize: 12, fontWeight: 700,
  },
  editBtn: {
    background: 'none', border: '1px solid #bee3f8', color: '#2b6cb0',
    cursor: 'pointer', fontSize: 12, fontWeight: 600,
    padding: '3px 10px', borderRadius: 6,
  },
  withdrawBtn: {
    background: 'none', border: '1px solid #fc8181', color: '#c53030',
    cursor: 'pointer', fontSize: 12, fontWeight: 600,
    padding: '3px 10px', borderRadius: 6,
  },
  reactivateBtn: {
    background: 'none', border: '1px solid #9ae6b4', color: '#276749',
    cursor: 'pointer', fontSize: 12, fontWeight: 600,
    padding: '3px 10px', borderRadius: 6,
  },
  modalOverlay: {
    position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
  },
  modalBox: {
    background: '#fff', borderRadius: 12, padding: '28px 32px',
    maxWidth: 420, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  },
  modalTitle: { margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: '#2d3748' },
  modalActions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  modalLabel: { display: 'flex', flexDirection: 'column' as const, gap: 5, fontSize: 13, fontWeight: 600, color: '#4a5568' },
  modalInput: { padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, color: '#2d3748', background: '#fff', width: '100%', boxSizing: 'border-box' as const },
  modalCancelBtn: {
    padding: '8px 20px', borderRadius: 8, border: '1px solid #e2e8f0',
    background: '#f7fafc', color: '#4a5568', cursor: 'pointer', fontSize: 14, fontWeight: 600,
  },
  modalConfirmBtn: {
    padding: '8px 20px', borderRadius: 8, border: 'none',
    background: '#e53e3e', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
  },
  modalReactivateBtn: {
    padding: '8px 20px', borderRadius: 8, border: 'none',
    background: '#38a169', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
  },
  pagination: {
    display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'center', marginTop: 20,
  },
  pageBtn: {
    minWidth: 32, padding: '5px 10px', borderRadius: 6, border: '1px solid #e2e8f0',
    background: '#f7fafc', color: '#4a5568', cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  pageBtnActive: {
    background: '#2b6cb0', color: '#fff', border: '1px solid #2b6cb0',
  },
};

