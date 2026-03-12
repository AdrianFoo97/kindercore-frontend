import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { updateStudent, deleteStudent } from '../../api/students.js';
import { fetchPackages, fetchPackageYears } from '../../api/packages.js';
import { Student } from '../../types/index.js';

const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function EditStudentModal({
  student,
  onClose,
  onSaved,
  onDeleted,
}: {
  student: Student;
  onClose: () => void;
  onSaved: (updated: Student) => void;
  onDeleted: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'personal' | 'enquiry'>('personal');
  const [childName, setChildName] = useState(student.lead.childName);
  const [parentPhone, setParentPhone] = useState(student.lead.parentPhone);
  const [dob, setDob] = useState(student.lead.childDob.split('T')[0]);
  const [year, setYear] = useState(student.enrolmentYear);
  const [month, setMonth] = useState(student.enrolmentMonth);
  const [packageId, setPackageId] = useState(student.packageId);
  const [paymentDate, setPaymentDate] = useState(student.enrolledAt.split('T')[0]);
  const [notes, setNotes] = useState(student.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  const { data: availableYears = [] } = useQuery({
    queryKey: ['packageYears'],
    queryFn: fetchPackageYears,
  });

  const { data: packages = [] } = useQuery({
    queryKey: ['packages', year],
    queryFn: () => fetchPackages(year),
    enabled: !!year,
  });

  useEffect(() => {
    if (packages.length === 0) return;
    const currentPkg = packages.find(p => p.id === packageId);
    if (currentPkg) return;
    const childAge = year - new Date(student.lead.childDob).getFullYear();
    const matched = packages.find(p => p.age === childAge);
    setPackageId((matched ?? packages[0]).id);
  }, [packages]);

  const handleDelete = async () => {
    setDeleting(true); setError('');
    try {
      await deleteStudent(student.id);
      onDeleted(student.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentDate) { setError('Please enter a payment date'); return; }
    setSaving(true); setError('');
    try {
      const updated = await updateStudent(student.id, {
        childName,
        parentPhone,
        childDob: dob,
        enrolmentYear: year,
        enrolmentMonth: month,
        packageId,
        enrolledAt: new Date(paymentDate).toISOString(),
        notes: notes || null,
      });
      onSaved(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const yearOptions = availableYears.includes(year) ? availableYears : [year, ...availableYears];

  return (
    <div style={modal.backdrop} onClick={onClose}>
      <div style={modal.card} onClick={(e) => e.stopPropagation()}>
        <div style={modal.header}>
          <h2 style={modal.title}>Edit Student</h2>
          <button onClick={onClose} style={modal.closeBtn} aria-label="Close">✕</button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: '#4a5568' }}>
          <strong>{childName}</strong> · {parentPhone}
        </p>

        {/* ── Tabs ── */}
        <div style={modal.tabBar}>
          <button
            type="button"
            style={{ ...modal.tab, ...(activeTab === 'personal' ? modal.tabActive : {}) }}
            onClick={() => setActiveTab('personal')}
          >
            Personal Details
          </button>
          <button
            type="button"
            style={{ ...modal.tab, ...(activeTab === 'enquiry' ? modal.tabActive : {}) }}
            onClick={() => setActiveTab('enquiry')}
          >
            Enquiry Details
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>

            {activeTab === 'personal' && (
              <>
                <label style={modal.label}>
                  Child Name
                  <input
                    type="text"
                    style={modal.input}
                    value={childName}
                    onChange={e => setChildName(e.target.value)}
                    required
                  />
                </label>

                <label style={modal.label}>
                  Parent Phone
                  <input
                    type="text"
                    style={modal.input}
                    value={parentPhone}
                    onChange={e => setParentPhone(e.target.value)}
                    required
                  />
                </label>

                <label style={modal.label}>
                  Date of Birth
                  <input
                    type="date"
                    style={modal.input}
                    value={dob}
                    onChange={e => setDob(e.target.value)}
                    required
                  />
                </label>
              </>
            )}

            {activeTab === 'enquiry' && (
              <>
                <label style={modal.label}>
                  Enrolment Year
                  <select style={modal.input} value={year} onChange={e => setYear(Number(e.target.value))}>
                    {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </label>

                <label style={modal.label}>
                  Enrolment Month
                  <select style={modal.input} value={month} onChange={e => setMonth(Number(e.target.value))}>
                    {MONTH_FULL.map((name, i) => (
                      <option key={i + 1} value={i + 1}>{name}</option>
                    ))}
                  </select>
                </label>

                <label style={modal.label}>
                  Package
                  {packages.length === 0 ? (
                    <span style={{ fontSize: 13, color: '#a0aec0', marginTop: 4 }}>Loading packages…</span>
                  ) : (
                    <select style={modal.input} value={packageId} onChange={e => setPackageId(e.target.value)}>
                      {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  )}
                </label>

                <label style={modal.label}>
                  Payment Date
                  <input
                    type="date"
                    style={modal.input}
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    required
                  />
                </label>

                <label style={modal.label}>
                  Notes
                  <textarea
                    style={{ ...modal.input, height: 100, resize: 'vertical' as const }}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Optional notes…"
                  />
                </label>
              </>
            )}
          </div>

          {error && <p style={{ color: '#e53e3e', fontSize: 13, marginTop: 12 }}>{error}</p>}

          {confirmDelete ? (
            <div style={modal.confirmDeleteBox}>
              <p style={modal.confirmDeleteText}>
                Permanently delete <strong>{student.lead.childName}</strong>? This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setConfirmDelete(false)} style={modal.cancelBtn} disabled={deleting}>
                  Cancel
                </button>
                <button type="button" onClick={handleDelete} style={modal.deleteConfirmBtn} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          ) : (
            <div style={modal.footer}>
              <button type="button" onClick={() => setConfirmDelete(true)} style={modal.deleteBtn}>
                Delete
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={onClose} style={modal.cancelBtn}>Cancel</button>
                <button type="submit" disabled={saving} style={modal.saveBtn}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

const modal: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  card: {
    background: '#fff', borderRadius: 14, padding: '28px 32px', width: '100%', maxWidth: 480,
    boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  title: { margin: 0, fontSize: 20, fontWeight: 700 },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 18, cursor: 'pointer',
    color: '#a0aec0', lineHeight: 1, padding: 4,
  },
  tabBar: {
    display: 'flex', borderBottom: '2px solid #e2e8f0', gap: 0,
  },
  tab: {
    padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: 'none', background: 'none', color: '#a0aec0',
    borderBottom: '2px solid transparent', marginBottom: -2,
  },
  tabActive: {
    color: '#3182ce', borderBottom: '2px solid #3182ce',
  },
  label: {
    display: 'flex', flexDirection: 'column', gap: 5,
    fontSize: 13, fontWeight: 600, color: '#4a5568',
  },
  input: {
    padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0',
    fontSize: 14, color: '#2d3748', background: '#fff', width: '100%', boxSizing: 'border-box',
  },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  cancelBtn: {
    padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0',
    background: '#f7fafc', color: '#4a5568', cursor: 'pointer', fontWeight: 600, fontSize: 14,
  },
  saveBtn: {
    padding: '8px 20px', borderRadius: 8, border: 'none',
    background: '#3182ce', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14,
  },
  deleteBtn: {
    padding: '8px 16px', borderRadius: 8, border: '1px solid #fc8181',
    background: 'none', color: '#c53030', cursor: 'pointer', fontWeight: 600, fontSize: 14,
  },
  confirmDeleteBox: {
    marginTop: 20, padding: '14px 16px', borderRadius: 10,
    background: '#fff5f5', border: '1px solid #feb2b2',
  },
  confirmDeleteText: { margin: '0 0 12px', fontSize: 13, color: '#742a2a' },
  deleteConfirmBtn: {
    padding: '8px 18px', borderRadius: 8, border: 'none',
    background: '#e53e3e', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14,
  },
};
