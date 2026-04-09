import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { createStudentWithLead } from '../../api/students.js';
import { fetchPackages, fetchPackageYears } from '../../api/packages.js';
import { fetchSettings } from '../../api/settings.js';
import { Student } from '../../types/index.js';
import { MARKETING_CHANNELS } from '../../constants/marketingChannels.js';

const OTHERS_VALUE = '__other__';

export default function AddStudentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (student: Student) => void;
}) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [activeTab, setActiveTab] = useState<'personal' | 'package' | 'enrolment'>('personal');

  // Personal
  const [childName, setChildName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [dob, setDob] = useState('');

  // Marketing channel
  const [channelChoice, setChannelChoice] = useState('');
  const [otherChannel, setOtherChannel] = useState('');

  // Lead submitted timestamp (default today)
  const [submittedAt, setSubmittedAt] = useState(todayStr);

  // Package
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [selectedProgramme, setSelectedProgramme] = useState('');
  const [selectedAge, setSelectedAge] = useState<number | ''>('');
  const [feeOverridden, setFeeOverridden] = useState(false);
  const [monthlyFee, setMonthlyFee] = useState(0);

  // Enrolment
  const [paymentDate, setPaymentDate] = useState(todayStr);
  const [startDate, setStartDate] = useState('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  const allowedAges = (settings?.package_ages as number[] | undefined) ?? [];
  const minAge = allowedAges.length > 0 ? Math.min(...allowedAges) : null;
  const maxAge = allowedAges.length > 0 ? Math.max(...allowedAges) : null;

  // Compute calculated age from DOB (current year - birth year)
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

  // Auto-set age + programme defaults when packages load or DOB changes
  useEffect(() => {
    if (packages.length === 0) return;
    if (!selectedProgramme && programmes.length > 0) setSelectedProgramme(programmes[0]);
    if (selectedAge === '' && ages.length > 0) {
      if (dob) {
        const childAge = year - new Date(dob).getFullYear();
        setSelectedAge(ages.includes(childAge) ? childAge : ages[0]);
      } else {
        setSelectedAge(ages[0]);
      }
    }
  }, [packages, dob]);

  // Resolve packageId from programme + age
  const selectedPackage = packages.find(p => p.programme === selectedProgramme && p.age === selectedAge);
  const selectedPackageId = selectedPackage?.id ?? '';

  // Keep monthly fee in sync with package price when not overridden
  useEffect(() => {
    if (!feeOverridden && selectedPackage) {
      setMonthlyFee(selectedPackage.price ?? 0);
    }
  }, [selectedPackageId, feeOverridden]);

  const yearOptions = availableYears.includes(year) ? availableYears : [year, ...availableYears];

  const resolvedChannel = channelChoice === OTHERS_VALUE ? otherChannel.trim() : channelChoice;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!childName.trim()) { setError('Child name is required'); setActiveTab('personal'); return; }
    if (!parentPhone.trim()) { setError('Parent phone is required'); setActiveTab('personal'); return; }
    if (!dob) { setError('Date of birth is required'); setActiveTab('personal'); return; }
    if (dobAgeError) { setError(dobAgeError); setActiveTab('personal'); return; }
    if (!resolvedChannel) { setError('Marketing channel is required'); setActiveTab('personal'); return; }
    if (!submittedAt) { setError('Lead date is required'); setActiveTab('personal'); return; }
    if (!selectedPackageId) { setError('Please select a package'); setActiveTab('package'); return; }
    if (!paymentDate) { setError('Payment date is required'); setActiveTab('enrolment'); return; }

    setSaving(true);
    try {
      const created = await createStudentWithLead({
        childName: childName.trim(),
        parentPhone: parentPhone.trim(),
        childDob: dob,
        howDidYouKnow: resolvedChannel,
        programme: selectedProgramme,
        submittedAt: new Date(submittedAt).toISOString(),
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
          <h2 style={modal.title}>Add Student</h2>
          <button onClick={onClose} style={modal.closeBtn} aria-label="Close"><FontAwesomeIcon icon={faXmark} /></button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
          Manually enrol a child who didn't fill in the enquiry form.
        </p>

        <div style={modal.tabBar}>
          <button type="button" style={{ ...modal.tab, ...(activeTab === 'personal' ? modal.tabActive : {}) }} onClick={() => setActiveTab('personal')}>Personal Details</button>
          <button type="button" style={{ ...modal.tab, ...(activeTab === 'package' ? modal.tabActive : {}) }} onClick={() => setActiveTab('package')}>Package Details</button>
          <button type="button" style={{ ...modal.tab, ...(activeTab === 'enrolment' ? modal.tabActive : {}) }} onClick={() => setActiveTab('enrolment')}>Enrolment Details</button>
        </div>

        <form onSubmit={handleSave}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18, minHeight: 360 }}>

            {activeTab === 'personal' && (
              <>
                <label style={modal.label}>
                  Child Name
                  <input type="text" style={modal.input} value={childName} onChange={e => setChildName(e.target.value)} required />
                </label>

                <label style={modal.label}>
                  Parent Phone
                  <input type="text" style={modal.input} value={parentPhone} onChange={e => setParentPhone(e.target.value)} required />
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

                <label style={modal.label}>
                  Marketing Channel <span style={{ color: '#e53e3e' }}>*</span>
                  <select style={modal.input} value={channelChoice} onChange={e => setChannelChoice(e.target.value)} required>
                    <option value="">Select channel…</option>
                    {MARKETING_CHANNELS.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                    <option value={OTHERS_VALUE}>Others (specify)</option>
                  </select>
                </label>
                {channelChoice === OTHERS_VALUE && (
                  <input
                    type="text"
                    style={modal.input}
                    value={otherChannel}
                    onChange={e => setOtherChannel(e.target.value)}
                    placeholder="e.g. Roadshow, School Visit"
                    autoFocus
                  />
                )}

                <label style={modal.label}>
                  Lead Date
                  <input type="date" style={modal.input} value={submittedAt} onChange={e => setSubmittedAt(e.target.value)} required />
                  <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Defaults to today. Backdate if the parent enquired earlier.</span>
                </label>
              </>
            )}

            {activeTab === 'package' && (
              <>
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
              </>
            )}

            {activeTab === 'enrolment' && (
              <>
                <label style={modal.label}>
                  Payment Date
                  <input type="date" style={modal.input} value={paymentDate} onChange={e => setPaymentDate(e.target.value)} required />
                </label>

                <label style={modal.label}>
                  First Day of School
                  <input type="date" style={modal.input} value={startDate} onChange={e => setStartDate(e.target.value)} />
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

          <div style={modal.footer}>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={onClose} style={modal.cancelBtn}>Cancel</button>
              <button type="submit" disabled={saving} style={modal.saveBtn}>
                {saving ? 'Creating…' : 'Create Student'}
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
    background: '#fff', borderRadius: 14, padding: '28px 32px', width: '100%', maxWidth: 520,
    boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  title: { margin: 0, fontSize: 20, fontWeight: 700 },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 18, cursor: 'pointer',
    color: '#a0aec0', lineHeight: 1, padding: 4,
  },
  tabBar: { display: 'flex', borderBottom: '2px solid #e2e8f0', gap: 0 },
  tab: {
    flex: 1, padding: '8px 8px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: 'none', background: 'none', color: '#a0aec0', textAlign: 'center' as const,
    borderBottom: '2px solid transparent', marginBottom: -2,
  },
  tabActive: { color: '#3182ce', borderBottom: '2px solid #3182ce' },
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
