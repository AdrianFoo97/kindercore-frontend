import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faChildren } from '@fortawesome/free-solid-svg-icons';
import { createSibling } from '../../api/students.js';
import { fetchPackages, fetchPackageYears } from '../../api/packages.js';
import { fetchSettings } from '../../api/settings.js';
import { Student } from '../../types/index.js';

export default function AddSiblingModal({
  sourceStudent,
  onClose,
  onCreated,
}: {
  sourceStudent: Student;
  onClose: () => void;
  onCreated: (student: Student) => void;
}) {
  const todayStr = new Date().toISOString().split('T')[0];

  // Sibling-specific fields
  const [childName, setChildName] = useState('');
  const [dob, setDob] = useState('');

  // Package
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [selectedProgramme, setSelectedProgramme] = useState('');
  const [selectedAge, setSelectedAge] = useState<number | ''>('');
  const [feeOverridden, setFeeOverridden] = useState(false);
  const [monthlyFee, setMonthlyFee] = useState(0);

  // Enrolment
  const [paymentDate, setPaymentDate] = useState(todayStr);
  const [startDate, setStartDate] = useState(todayStr);
  const [startDateManuallyEdited, setStartDateManuallyEdited] = useState(false);
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  const allowedAges = (settings?.package_ages as number[] | undefined) ?? [];
  const minAge = allowedAges.length > 0 ? Math.min(...allowedAges) : null;
  const maxAge = allowedAges.length > 0 ? Math.max(...allowedAges) : null;

  const calculatedAge = dob ? new Date().getFullYear() - new Date(dob).getFullYear() : null;
  const dobAgeError =
    calculatedAge !== null && allowedAges.length > 0 && (calculatedAge < minAge! || calculatedAge > maxAge!)
      ? `Age must be between ${minAge} and ${maxAge} (got ${calculatedAge})`
      : '';

  const { data: availableYears = [] } = useQuery({
    queryKey: ['packageYears'],
    queryFn: fetchPackageYears,
  });

  const { data: packages = [] } = useQuery({
    queryKey: ['packages', year],
    queryFn: () => fetchPackages(year),
    enabled: !!year,
  });

  const programmes = [...new Set(packages.map(p => p.programme))];
  const ages = [...new Set(packages.map(p => p.age))].sort((a, b) => a - b);

  useEffect(() => {
    if (packages.length === 0) return;
    if (!selectedProgramme && programmes.length > 0) setSelectedProgramme(programmes[0]);
  }, [packages]);

  useEffect(() => {
    if (ages.length === 0) return;
    if (dob) {
      const childAge = year - new Date(dob).getFullYear();
      setSelectedAge(ages.includes(childAge) ? childAge : ages[0]);
    } else if (selectedAge === '') {
      setSelectedAge(ages[0]);
    }
  }, [dob, packages, year]);

  const selectedPackage = packages.find(p => p.programme === selectedProgramme && p.age === selectedAge);
  const selectedPackageId = selectedPackage?.id ?? '';

  useEffect(() => {
    if (!feeOverridden && selectedPackage) setMonthlyFee(selectedPackage.price ?? 0);
  }, [selectedPackageId, feeOverridden]);

  useEffect(() => {
    if (!startDateManuallyEdited) setStartDate(paymentDate);
  }, [paymentDate, startDateManuallyEdited]);

  const yearOptions = availableYears.includes(year) ? availableYears : [year, ...availableYears];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!childName.trim()) { setError('Sibling name is required'); return; }
    if (!dob) { setError('Date of birth is required'); return; }
    if (dobAgeError) { setError(dobAgeError); return; }
    if (!selectedPackageId) { setError('Please select a package'); return; }
    if (!paymentDate) { setError('Payment date is required'); return; }

    setSaving(true);
    try {
      const created = await createSibling({
        leadId: sourceStudent.leadId,
        childName: childName.trim(),
        childDob: dob,
        enrolmentYear: year,
        enrolmentMonth: month,
        packageId: selectedPackageId,
        enrolledAt: new Date(paymentDate).toISOString(),
        startDate: startDate || null,
        notes: notes || null,
        monthlyFee,
        feeOverridden,
      });
      onCreated(created);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={modal.backdrop}>
      <div style={modal.card} onClick={(e) => e.stopPropagation()}>
        <div style={modal.header}>
          <h2 style={modal.title}>
            <FontAwesomeIcon icon={faChildren} style={{ marginRight: 8, color: '#3182ce' }} />
            Add Sibling
          </h2>
          <button onClick={onClose} style={modal.closeBtn} aria-label="Close"><FontAwesomeIcon icon={faXmark} /></button>
        </div>

        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 12px', margin: '8px 0 16px', fontSize: 12, color: '#0369a1' }}>
          Sibling of <strong>{sourceStudent.lead.childName}</strong> · Parent: {sourceStudent.lead.parentPhone}
          <div style={{ marginTop: 4, color: '#64748b' }}>Parent contact and marketing source are inherited from {sourceStudent.lead.childName}'s lead.</div>
        </div>

        <form onSubmit={handleSave}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={modal.label}>
              Sibling Name
              <input type="text" style={modal.input} value={childName} onChange={e => setChildName(e.target.value)} required autoFocus />
            </label>

            <label style={modal.label}>
              Date of Birth
              <input
                type="date"
                style={{ ...modal.input, borderColor: dobAgeError ? '#e53e3e' : '#e2e8f0' }}
                value={dob}
                onChange={e => setDob(e.target.value)}
                required
              />
              {dob && calculatedAge !== null && !dobAgeError && (
                <span style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Age {calculatedAge}</span>
              )}
              {dobAgeError && (
                <span style={{ fontSize: 11, color: '#e53e3e', marginTop: 2 }}>{dobAgeError}</span>
              )}
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={modal.label}>
                Enrolment Year
                <select style={modal.input} value={year} onChange={e => setYear(Number(e.target.value))}>
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
              <label style={modal.label}>
                Enrolment Month
                <select style={modal.input} value={month} onChange={e => setMonth(Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}</option>
                  ))}
                </select>
              </label>
            </div>

            {packages.length === 0 ? (
              <span style={{ fontSize: 13, color: '#a0aec0' }}>Loading packages…</span>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={modal.label}>
                  Programme
                  <select style={modal.input} value={selectedProgramme} onChange={e => setSelectedProgramme(e.target.value)}>
                    {programmes.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <label style={modal.label}>
                  Age Group
                  <select style={modal.input} value={selectedAge} onChange={e => setSelectedAge(Number(e.target.value))}>
                    {ages.map(a => <option key={a} value={a}>Age {a}</option>)}
                  </select>
                </label>
              </div>
            )}

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#2d3748' }}>Monthly Fee</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b', cursor: 'pointer' }}>
                  <input type="checkbox" checked={feeOverridden} onChange={e => {
                    setFeeOverridden(e.target.checked);
                    if (!e.target.checked && selectedPackage) setMonthlyFee(selectedPackage.price ?? 0);
                  }} />
                  Custom fee
                </label>
              </div>
              <input
                type="number" min={0} step={1}
                style={{ ...modal.input, background: feeOverridden ? '#fff' : '#f8fafc', color: feeOverridden ? '#1e293b' : '#94a3b8' }}
                value={monthlyFee}
                onChange={e => setMonthlyFee(Number(e.target.value))}
                disabled={!feeOverridden}
              />
              {!feeOverridden && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Auto-set from package price</div>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={modal.label}>
                Payment Date
                <input type="date" style={modal.input} value={paymentDate} onChange={e => setPaymentDate(e.target.value)} required />
              </label>
              <label style={modal.label}>
                First Day of School
                <input
                  type="date"
                  style={modal.input}
                  value={startDate}
                  onChange={e => { setStartDate(e.target.value); setStartDateManuallyEdited(true); }}
                />
              </label>
            </div>

            <label style={modal.label}>
              Notes
              <textarea
                style={{ ...modal.input, height: 72, resize: 'vertical' as const }}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes…"
              />
            </label>
          </div>

          {error && <p style={{ color: '#e53e3e', fontSize: 13, marginTop: 12 }}>{error}</p>}

          <div style={modal.footer}>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={onClose} style={modal.cancelBtn}>Cancel</button>
              <button type="submit" disabled={saving} style={modal.saveBtn}>
                {saving ? 'Creating…' : 'Create Sibling'}
              </button>
            </div>
          </div>
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
    background: '#fff', borderRadius: 14, padding: '28px 32px', width: '100%', maxWidth: 560,
    boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  title: { margin: 0, fontSize: 20, fontWeight: 700 },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 18, cursor: 'pointer',
    color: '#a0aec0', lineHeight: 1, padding: 4,
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
};
