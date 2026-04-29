import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faUser, faBoxesStacked, faClipboardList, faPenToSquare, faArrowRightArrowLeft, faXmark, faCircle, faRightFromBracket, faArrowRotateLeft, faChildren, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { fetchStudents, updateStudent, fetchEnrollments, createEnrollment, updateEnrollment, deleteEnrollment, withdrawStudent, reactivateStudent, createSibling } from '../api/students.js';
import { fetchPackages, fetchPackageYears } from '../api/packages.js';
import { useToast } from '../components/common/Toast.js';
import { useDeleteDialog } from '../components/common/DeleteDialog.js';
import { Student, Enrollment, Package } from '../types/index.js';
import WithdrawDialog from '../components/students/WithdrawDialog.js';

// ── Design tokens (mirrors EditTeacherPage) ─────────────────────────────
const C = {
  primary: '#5a67d8', primaryLight: '#eef0fa', card: '#fff', text: '#1e293b',
  muted: '#94a3b8', sub: '#475569', border: '#e2e8f0', green: '#059669',
};

type Tab = 'personal' | 'enrolments' | 'dates';

function formatExactAge(dob: string): string {
  if (!dob) return '';
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return '';
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  if (years < 0) return '';
  const yLabel = `${years} year${years === 1 ? '' : 's'}`;
  const mLabel = `${months} month${months === 1 ? '' : 's'}`;
  return `${yLabel} ${mLabel}`;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function defaultStartDate(year: number, month: number): string {
  const now = new Date();
  if (year === now.getFullYear() && month === now.getMonth() + 1) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

export default function EditStudentPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();

  // Mode detection. The same component handles three flows:
  //   - Edit existing: id is a real student id
  //   - Add sibling: id === 'new' AND ?siblingOf=:existingId is set —
  //     parent contact / lead is inherited from the source sibling.
  //   - Plain new (no siblingOf): not currently supported here; the
  //     "+ Add Student" button on StudentsPage still uses AddStudentModal.
  //     Fall through redirects back so a stray URL doesn't show a broken page.
  const siblingOf = searchParams.get('siblingOf');
  const isNew = id === 'new';
  const isCreateSibling = isNew && !!siblingOf;

  useEffect(() => {
    if (isNew && !isCreateSibling) navigate('/students', { replace: true });
  }, [isNew, isCreateSibling, navigate]);

  // Pull from the cached students list (pageSize 1000 is plenty for a school).
  // Refresh on mount so we're never reading stale data after a save elsewhere.
  const { data: studentsData, isLoading } = useQuery({
    queryKey: ['students', { pageSize: 1000 }],
    queryFn: () => fetchStudents({ pageSize: 1000 }),
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const student: Student | undefined = useMemo(
    () => isNew ? undefined : studentsData?.items.find(s => s.id === id),
    [studentsData, id, isNew],
  );

  // Source sibling: the existing student we're adding a brother/sister to.
  // We use it to inherit parent phone, marketing source (via lead), and to
  // show context in the page heading.
  const sourceSibling: Student | undefined = useMemo(
    () => isCreateSibling ? studentsData?.items.find(s => s.id === siblingOf) : undefined,
    [studentsData, siblingOf, isCreateSibling],
  );

  const [tab, setTab] = useState<Tab>('personal');
  const [childName, setChildName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [dob, setDob] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(1);
  const [packageId, setPackageId] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [notes, setNotes] = useState('');
  const [feeOverridden, setFeeOverridden] = useState(false);
  const [monthlyFee, setMonthlyFee] = useState(0);
  const [classAgeOverridden, setClassAgeOverridden] = useState(false);
  const [classAge, setClassAge] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  // Enrolment-history UI state.
  // - editCurrent: when true, the Current Enrolment card expands into an
  //   inline edit form that uses the existing updateStudent flow (no new
  //   period created — just corrects today's package/fee).
  // - changePackageOpen: opens the Change Package modal which creates a new
  //   enrollment period via POST /enrollments.
  // - withdrawOpen: opens the WithdrawDialog. Closing the current period.
  // - withdrawSubmitting / reactivating: gate the dialogs / buttons during
  //   in-flight mutations.
  const [editCurrent, setEditCurrent] = useState(false);
  // Editable startDate for the current open enrollment — exposed via the
  // Edit current inline form. Synced from currentEnrollment when it loads.
  const [currentStartDate, setCurrentStartDate] = useState('');
  const [changePackageOpen, setChangePackageOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  // Editing a past (closed) enrollment for corrections.
  const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null);

  const deleteDialog = useDeleteDialog();

  // Effective DOB used for age display. Edit mode uses the student's lead
  // DOB; create-sibling mode uses whatever the user has entered so far.
  const effectiveDob = isCreateSibling ? dob : student?.lead.childDob;
  const calculatedAge = effectiveDob
    ? new Date().getFullYear() - new Date(effectiveDob).getFullYear()
    : 0;

  // Edit mode: load existing student data into form once.
  useEffect(() => {
    if (isNew || !student || loaded) return;
    setChildName(student.lead.childName);
    setParentPhone(student.lead.parentPhone);
    setDob(student.lead.childDob.split('T')[0]);
    setYear(new Date().getFullYear());
    setMonth(student.enrolmentMonth);
    setPackageId(student.packageId);
    setPaymentDate(student.enrolledAt.split('T')[0]);
    setStartDate(student.startDate
      ? student.startDate.split('T')[0]
      : defaultStartDate(student.enrolmentYear, student.enrolmentMonth));
    setNotes(student.notes ?? '');
    setFeeOverridden(student.feeOverridden ?? false);
    setMonthlyFee(student.monthlyFee ?? 0);
    const offset = student.ageOffset ?? 0;
    setClassAgeOverridden(offset !== 0);
    setClassAge(calculatedAge + offset);
    setLoaded(true);
  }, [student, loaded, calculatedAge, isNew]);

  // Create-sibling mode: inherit parent phone from the source student. Other
  // fields stay blank so the user fills them for the new child.
  useEffect(() => {
    if (!isCreateSibling || !sourceSibling || loaded) return;
    setParentPhone(sourceSibling.lead.parentPhone);
    setYear(new Date().getFullYear());
    setMonth(new Date().getMonth() + 1);
    const today = new Date().toISOString().split('T')[0];
    setPaymentDate(today);
    setStartDate(today);
    setLoaded(true);
  }, [isCreateSibling, sourceSibling, loaded]);

  // Enrolment history. Fails silently when the backend doesn't yet expose
  // /enrollments — we degrade to a single synthesised "current" period
  // derived from the student record so the UI is usable today. Disabled
  // entirely in create modes (no enrollments yet).
  const { data: enrollmentsRaw, error: enrollmentsErr } = useQuery({
    queryKey: ['enrollments', id],
    queryFn: () => fetchEnrollments(id!),
    enabled: !!id && !!student && !isNew,
    retry: false,
  });

  const { data: availableYears = [] } = useQuery({
    queryKey: ['packageYears'],
    queryFn: fetchPackageYears,
  });

  const { data: packages = [] } = useQuery({
    queryKey: ['packages', year],
    queryFn: () => fetchPackages(year),
    enabled: !!year,
  });

  // Final enrolments list. If the backend already returned rows, use them
  // (sorted newest-first). Otherwise synthesize one row from the student's
  // current package fields so the UI works without backend changes.
  const enrollments: Enrollment[] = useMemo(() => {
    if (enrollmentsRaw && enrollmentsRaw.length > 0) {
      return [...enrollmentsRaw].sort((a, b) =>
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
      );
    }
    if (!student) return [];
    return [{
      id: `synthetic-${student.id}`,
      studentId: student.id,
      packageId: student.packageId,
      package: student.package
        ? { id: student.packageId, ...student.package, price: student.monthlyFee ?? null }
        : undefined,
      monthlyFee: student.monthlyFee ?? 0,
      feeOverridden: student.feeOverridden ?? false,
      startDate: student.startDate ?? student.enrolledAt,
      endDate: student.withdrawnAt,
      reason: null,
      createdAt: student.createdAt,
    }];
  }, [enrollmentsRaw, student]);

  const currentEnrollment = useMemo(
    () => enrollments.find(e => e.endDate === null) ?? enrollments[0] ?? null,
    [enrollments],
  );
  const pastEnrollments = useMemo(
    () => enrollments.filter(e => e !== currentEnrollment),
    [enrollments, currentEnrollment],
  );
  const isHistoryAvailable = !enrollmentsErr;

  // Sync the editable currentStartDate any time the underlying enrollment
  // changes (e.g., after Save → invalidate → refetch). Keeps the input
  // showing the latest value unless the user is actively editing.
  useEffect(() => {
    if (currentEnrollment && !editCurrent) {
      setCurrentStartDate(currentEnrollment.startDate.slice(0, 10));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEnrollment?.id, currentEnrollment?.startDate, editCurrent]);
  // The student is "withdrawn" if either the cached student.withdrawnAt is
  // set OR the current-period enrollment has a closed endDate. They should
  // always agree, but we check both so the UI reacts correctly even if the
  // backend is mid-deploy.
  const isWithdrawn = !!student?.withdrawnAt || (currentEnrollment !== null && currentEnrollment.endDate !== null);

  // Invalidate every query that depends on student/enrollment state so the
  // UI reflects edits immediately. Revenue/finance summaries depend on
  // enrollment overlap with months — they must be refetched after any
  // package, fee, or date change.
  const invalidateStudentDerived = () => {
    qc.invalidateQueries({ queryKey: ['students'] });
    qc.invalidateQueries({ queryKey: ['leads'] });
    qc.invalidateQueries({ queryKey: ['enrollments', id] });
    qc.invalidateQueries({ queryKey: ['finance-summary'] });
  };

  const handleWithdraw = async ({ date, reason }: { date: string; reason: string }) => {
    if (!student) return;
    setWithdrawSubmitting(true);
    try {
      await withdrawStudent(student.id, { withdrawnAt: new Date(date).toISOString(), withdrawReason: reason || undefined });
      invalidateStudentDerived();
      showToast(`${student.lead.childName} withdrawn`);
      setWithdrawOpen(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to withdraw', 'error');
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  const handleDeleteEnrollment = async (en: Enrollment) => {
    const ok = await deleteDialog.confirm({
      entityType: 'enrolment period',
      entityName: `${en.package?.name ?? 'Unknown package'} · ${formatDate(en.startDate)} → ${en.endDate ? formatDate(en.endDate) : 'present'}`,
      onConfirm: async () => {
        await deleteEnrollment(en.id);
        invalidateStudentDerived();
      },
    });
    if (ok) showToast('Enrolment period deleted');
  };

  const handleReactivate = async () => {
    if (!student) return;
    setReactivating(true);
    try {
      await reactivateStudent(student.id);
      invalidateStudentDerived();
      showToast(`${student.lead.childName} reactivated`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to reactivate', 'error');
    } finally {
      setReactivating(false);
    }
  };

  // Auto-match: ensure the selected package matches the child's current age.
  // In create-sibling mode we use the source sibling's programme as the
  // initial preference (siblings often share the same programme).
  useEffect(() => {
    if (packages.length === 0) return;
    const targetAge = classAgeOverridden ? classAge : calculatedAge;
    if (!targetAge) return;
    const currentPkg = packages.find(p => p.id === packageId);
    if (currentPkg && currentPkg.age === targetAge) return;
    const preferredProgramme = student?.package?.programme ?? sourceSibling?.package?.programme;
    const matched =
      packages.find(p => p.programme === preferredProgramme && p.age === targetAge) ||
      packages.find(p => p.age === targetAge) ||
      packages[0];
    if (matched && matched.id !== packageId) setPackageId(matched.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packages, classAgeOverridden, classAge, calculatedAge]);

  // Keep monthlyFee in sync with package price when not overridden.
  useEffect(() => {
    if (!feeOverridden && packages.length > 0) {
      const pkg = packages.find(p => p.id === packageId);
      if (pkg) setMonthlyFee(pkg.price ?? 0);
    }
  }, [packages, packageId, feeOverridden]);

  const yearOptions = availableYears.includes(year) ? availableYears : [year, ...availableYears];

  // `inline=true` is used by the "Edit current" form on the Enrolments tab:
  // saves the changes but stays on the page (closes the inline editor
  // instead of navigating away).
  const handleSave = async (e?: React.FormEvent, opts?: { inline?: boolean }) => {
    e?.preventDefault();
    if (!paymentDate) { setError('Please enter a payment date'); return; }

    // Create-sibling validations specific to a new child record.
    if (isCreateSibling) {
      if (!sourceSibling) { setError('Source sibling not loaded'); return; }
      if (!childName.trim()) { setError('Child name is required'); return; }
      if (!dob) { setError('Date of birth is required'); return; }
      if (!packageId) { setError('Please pick a package'); return; }
    } else if (!student) {
      return;
    }

    setSaving(true); setError('');
    try {
      if (isCreateSibling && sourceSibling) {
        const created = await createSibling({
          leadId: sourceSibling.leadId,
          childName: childName.trim(),
          childDob: dob,
          enrolmentYear: year,
          enrolmentMonth: month,
          packageId,
          enrolledAt: new Date(paymentDate).toISOString(),
          startDate: startDate || null,
          notes: notes || null,
          monthlyFee,
          feeOverridden,
        });
        invalidateStudentDerived();
        showToast(`Sibling ${childName.trim()} created`);
        // Land on the source sibling's edit page so the user sees the new
        // child appear in the Siblings list.
        navigate(`/students/${sourceSibling.id}`);
        // Suppress unused-var warning when the API ever changes shape.
        void created;
      } else if (student) {
        await updateStudent(student.id, {
          childName,
          parentPhone,
          childDob: dob,
          enrolmentYear: year,
          enrolmentMonth: month,
          packageId,
          enrolledAt: new Date(paymentDate).toISOString(),
          startDate: startDate || null,
          notes: notes || null,
          monthlyFee,
          feeOverridden,
          ageOffset: classAgeOverridden ? classAge - calculatedAge : 0,
        });
        // If the inline Edit-current path also moved the open period's
        // startDate, push that to the enrollment row separately (the
        // updateStudent transaction only mirrors package/fee, not dates).
        if (opts?.inline
          && currentEnrollment
          && currentStartDate
          && currentStartDate !== currentEnrollment.startDate.slice(0, 10)
        ) {
          await updateEnrollment(currentEnrollment.id, { startDate: currentStartDate });
        }
        invalidateStudentDerived();
        showToast(opts?.inline ? 'Saved' : 'Student updated');
        if (opts?.inline) {
          setEditCurrent(false);
        } else {
          navigate('/students');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !studentsData) {
    return (
      <div style={s.page}>
        <div style={s.inner}>
          <p style={{ color: C.muted, textAlign: 'center', marginTop: 80 }}>Loading…</p>
        </div>
      </div>
    );
  }

  // Edit mode: must have the student. Create-sibling: must have the source.
  const missingForEdit = !isNew && !student;
  const missingForSibling = isCreateSibling && !sourceSibling;
  if (missingForEdit || missingForSibling) {
    const label = missingForSibling ? 'Source sibling not found.' : 'Student not found.';
    return (
      <div style={s.page}>
        <div style={s.inner}>
          <div style={s.breadcrumb}>
            <button onClick={() => navigate('/students')} className="es-back-btn" style={s.backBtn} title="Back">
              <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 11 }} />
            </button>
            <span onClick={() => navigate('/students')} style={s.breadcrumbLink}>Students</span>
          </div>
          <p style={{ color: '#dc2626', textAlign: 'center', marginTop: 80 }}>{label}</p>
        </div>
      </div>
    );
  }

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: 'personal',   label: 'Personal',   icon: faUser },
    { key: 'enrolments', label: 'Enrolments', icon: faBoxesStacked },
    { key: 'dates',      label: 'Dates',      icon: faClipboardList },
  ];

  // Filter packages to those matching the child's class age. In edit mode
  // we use the loaded student's DOB; in create-sibling mode we use the
  // user-entered DOB.
  const dobForFilter = isCreateSibling ? dob : student?.lead.childDob;
  const dobAge = dobForFilter ? year - new Date(dobForFilter).getFullYear() : 0;
  const childAge = classAgeOverridden ? classAge : dobAge;
  const filteredPackages = packages.filter(p => p.age === childAge);

  // Display strings for the page header — differ between modes.
  const headingText = isCreateSibling
    ? (childName.trim() || 'New Sibling')
    : (childName || student?.lead.childName || 'Student');
  const subheadingText = isCreateSibling
    ? `Sibling of ${sourceSibling?.lead.childName ?? '—'}`
    : `${student?.package?.name ?? '—'} · ${student?.package?.programme ?? ''}`;
  const ageBadge = isCreateSibling
    ? (dob ? `Age ${classAgeOverridden ? classAge : calculatedAge}` : null)
    : `Age ${classAgeOverridden ? classAge : calculatedAge}`;

  return (
    <>
    <form onSubmit={handleSave}>
      <div style={s.page}>
        <style>{`.es-tab:hover { background: #f1f5f9 !important; } .es-back-btn:hover { background: #f1f5f9 !important; color: ${C.text} !important; border-color: #cbd5e1 !important; } .es-icon-btn:hover { background: #f1f5f9 !important; } .es-icon-btn-danger:hover { background: #fef2f2 !important; }`}</style>
        <div style={s.inner}>
          {/* Back + breadcrumb. Create-sibling: back goes to source sibling. */}
          <div style={s.breadcrumb}>
            <button type="button" onClick={() => navigate(isCreateSibling && sourceSibling ? `/students/${sourceSibling.id}` : '/students')} className="es-back-btn" style={s.backBtn} title="Back">
              <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 11 }} />
            </button>
            <span onClick={() => navigate('/students')} style={s.breadcrumbLink}>Students</span>
            {isCreateSibling && sourceSibling && (
              <>
                <span style={{ color: C.muted, fontSize: 11 }}>/</span>
                <span onClick={() => navigate(`/students/${sourceSibling.id}`)} style={s.breadcrumbLink}>
                  {sourceSibling.lead.childName}
                </span>
              </>
            )}
            <span style={{ color: C.muted, fontSize: 11 }}>/</span>
            <span style={{ fontSize: 13, color: C.sub, fontWeight: 500 }}>
              {isCreateSibling ? 'Add Sibling' : (childName || student?.lead.childName)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
            <h1 style={s.heading}>{headingText}</h1>
            {ageBadge && (
              <span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>{ageBadge}</span>
            )}
          </div>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: C.muted }}>
            {subheadingText}
          </p>

          {/* Layout: tabs left + content right */}
          <div style={s.layout}>
            <div style={s.tabNav}>
              {TABS.map(t => (
                <button key={t.key} type="button" className="es-tab" onClick={() => setTab(t.key)}
                  style={{ ...s.tabBtn, ...(tab === t.key ? s.tabBtnActive : {}) }}>
                  <FontAwesomeIcon icon={t.icon} style={{ fontSize: 12, width: 16 }} />
                  {t.label}
                </button>
              ))}
            </div>

            <div style={s.content}>
              {tab === 'personal' && (
                <>
                  {/* Sibling context banner — only in create-sibling mode. */}
                  {isCreateSibling && sourceSibling && (
                    <div style={s.siblingBanner}>
                      <FontAwesomeIcon icon={faChildren} style={{ fontSize: 13, color: '#0369a1', marginRight: 8 }} />
                      Sibling of <strong style={{ margin: '0 4px' }}>{sourceSibling.lead.childName}</strong>
                      · Parent contact and marketing source are inherited from this lead.
                    </div>
                  )}
                  <div style={s.card}>
                    <h2 style={s.sectionTitle}>Personal Details</h2>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <label style={s.label}>Child Name</label>
                        <input style={s.input} value={childName} onChange={e => setChildName(e.target.value)} required autoFocus={isCreateSibling} />
                      </div>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <label style={s.label}>
                          Parent Phone
                          {isCreateSibling && <span style={{ marginLeft: 6, fontWeight: 500, color: C.muted }}>(inherited)</span>}
                        </label>
                        <input
                          style={{ ...s.input, ...(isCreateSibling ? { background: '#f8fafc', color: C.muted } : {}) }}
                          value={parentPhone}
                          onChange={e => setParentPhone(e.target.value)}
                          required
                          disabled={isCreateSibling}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <label style={s.label}>Date of Birth</label>
                        <input style={s.input} type="date" value={dob} onChange={e => setDob(e.target.value)} required />
                      </div>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <label style={s.label}>Age</label>
                        <div style={{ ...s.input, background: '#f8fafc', color: C.muted }}>
                          {formatExactAge(dob) || '—'}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <label style={s.label} htmlFor="class-age">Class Age</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.sub, cursor: 'pointer', marginBottom: 4 }}>
                          <input type="checkbox" checked={classAgeOverridden} onChange={e => {
                            setClassAgeOverridden(e.target.checked);
                            if (!e.target.checked) setClassAge(calculatedAge);
                          }} />
                          Custom class age
                        </label>
                      </div>
                      <input id="class-age" type="number" min={0} max={6} step={1}
                        style={{ ...s.input, maxWidth: 200, background: classAgeOverridden ? '#fff' : '#f8fafc', color: classAgeOverridden ? C.text : C.muted }}
                        value={classAgeOverridden ? classAge : calculatedAge}
                        onChange={e => {
                          const v = Number(e.target.value);
                          if (Number.isNaN(v)) return;
                          setClassAge(Math.max(0, Math.min(6, v)));
                        }}
                        disabled={!classAgeOverridden}
                      />
                      {!classAgeOverridden && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Auto-calculated from date of birth.</div>}
                    </div>
                  </div>

                  {/* Siblings section — edit mode only. Lists siblings under
                      the same lead and offers a one-click action to add a new
                      one (which navigates to /students/new?siblingOf=:id). */}
                  {!isNew && student && (
                    <div style={s.card}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const, marginBottom: student.siblings.length > 0 ? 12 : 0 }}>
                        <h2 style={{ ...s.sectionTitle, margin: 0 }}>Siblings</h2>
                        <button
                          type="button"
                          onClick={() => navigate(`/students/new?siblingOf=${student.id}`)}
                          style={s.outlineBtn}
                        >
                          <FontAwesomeIcon icon={faPlus} style={{ fontSize: 11, marginRight: 6 }} />
                          Add sibling
                        </button>
                      </div>
                      {student.siblings.length === 0 ? (
                        <div style={{ fontSize: 12, color: C.muted, padding: '6px 0' }}>
                          No siblings on file. Use <strong>Add sibling</strong> to enrol another child under the same parent.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' as const }}>
                          {student.siblings.map(sib => (
                            <div key={sib.id} style={s.historyRow}>
                              <FontAwesomeIcon icon={faChildren} style={{ fontSize: 11, color: C.muted, marginTop: 4, flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.text, fontWeight: 600 }}>
                                {sib.childName}
                              </div>
                              <button
                                type="button"
                                onClick={() => navigate(`/students/${sib.id}`)}
                                style={{ ...s.outlineBtn, padding: '6px 10px', fontSize: 11 }}
                              >
                                View
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {tab === 'enrolments' && isNew && (
                <div style={s.card}>
                  <h2 style={s.sectionTitle}>Initial Enrolment</h2>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                    <div style={{ width: 140 }}>
                      <label style={s.label}>Year</label>
                      <select style={s.input} value={year} onChange={e => setYear(Number(e.target.value))}>
                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <label style={s.label}>Package</label>
                      {packages.length === 0 ? (
                        <div style={{ ...s.input, color: C.muted }}>Loading packages…</div>
                      ) : (
                        <select style={s.input} value={packageId} onChange={e => {
                          setPackageId(e.target.value);
                          if (!feeOverridden) {
                            const pkg = packages.find(p => p.id === e.target.value);
                            if (pkg) setMonthlyFee(pkg.price ?? 0);
                          }
                        }}>
                          <option value="" disabled>Select a package…</option>
                          {(filteredPackages.length > 0 ? filteredPackages : packages).map(p =>
                            <option key={p.id} value={p.id}>{p.name}</option>,
                          )}
                        </select>
                      )}
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <label style={s.label} htmlFor="monthly-fee-new">Monthly Fee</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.sub, cursor: 'pointer', marginBottom: 4 }}>
                        <input type="checkbox" checked={feeOverridden} onChange={e => {
                          setFeeOverridden(e.target.checked);
                          if (!e.target.checked) {
                            const pkg = packages.find(p => p.id === packageId);
                            if (pkg) setMonthlyFee(pkg.price ?? 0);
                          }
                        }} />
                        Custom fee
                      </label>
                    </div>
                    <input id="monthly-fee-new" type="number" min={0} step={1}
                      style={{ ...s.input, maxWidth: 200, background: feeOverridden ? '#fff' : '#f8fafc', color: feeOverridden ? C.text : C.muted }}
                      value={monthlyFee}
                      onChange={e => setMonthlyFee(Number(e.target.value))}
                      disabled={!feeOverridden}
                    />
                    {!feeOverridden && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Auto-set from package price.</div>}
                  </div>
                </div>
              )}

              {tab === 'enrolments' && !isNew && (
                <>
                  {/* ── Current enrolment card ───────────────────────── */}
                  <div style={s.card}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' as const, marginBottom: editCurrent ? 16 : 0 }}>
                      <div>
                        <div style={s.sectionTitle}>Current Enrolment</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' as const }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>
                            {currentEnrollment?.package?.name ?? '—'}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: C.sub, fontVariantNumeric: 'tabular-nums' as any }}>
                            RM {currentEnrollment?.monthlyFee?.toLocaleString() ?? '0'}/mo
                          </div>
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, color: C.muted }}>
                          {currentEnrollment
                            ? `Started ${formatDate(currentEnrollment.startDate)}${currentEnrollment.endDate ? ` · Ended ${formatDate(currentEnrollment.endDate)}` : ' · Ongoing'}`
                            : 'No active enrolment'}
                        </div>
                      </div>
                      {!editCurrent && currentEnrollment && (
                        isWithdrawn ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={s.withdrawnPill}>Withdrawn</span>
                            <button type="button" onClick={handleReactivate} disabled={reactivating} style={{ ...s.outlineBtn, opacity: reactivating ? 0.6 : 1 }}>
                              <FontAwesomeIcon icon={faArrowRotateLeft} style={{ fontSize: 11, marginRight: 6 }} />
                              {reactivating ? 'Reactivating…' : 'Reactivate'}
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                            <button type="button" onClick={() => setEditCurrent(true)} style={s.outlineBtn}>
                              <FontAwesomeIcon icon={faPenToSquare} style={{ fontSize: 11, marginRight: 6 }} />
                              Edit current
                            </button>
                            <button type="button" onClick={() => setChangePackageOpen(true)} style={s.solidBtn}>
                              <FontAwesomeIcon icon={faArrowRightArrowLeft} style={{ fontSize: 11, marginRight: 6 }} />
                              Change package
                            </button>
                            <button type="button" onClick={() => setWithdrawOpen(true)} style={s.dangerOutlineBtn}>
                              <FontAwesomeIcon icon={faRightFromBracket} style={{ fontSize: 11, marginRight: 6 }} />
                              Withdraw
                            </button>
                          </div>
                        )
                      )}
                    </div>

                    {/* Inline edit form for the current enrolment. Saving is
                        handled by the page-level Save button. */}
                    {editCurrent && (
                      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                          <div style={{ width: 160 }}>
                            <label style={s.label}>Period Start Date</label>
                            <input
                              style={s.input}
                              type="date"
                              value={currentStartDate}
                              onChange={e => setCurrentStartDate(e.target.value)}
                            />
                          </div>
                          <div style={{ width: 140 }}>
                            <label style={s.label}>Year</label>
                            <select style={s.input} value={year} onChange={e => setYear(Number(e.target.value))}>
                              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                          </div>
                          <div style={{ flex: 1, minWidth: 240 }}>
                            <label style={s.label}>Package</label>
                            {packages.length === 0 ? (
                              <div style={{ ...s.input, color: C.muted }}>Loading packages…</div>
                            ) : (
                              <select style={s.input} value={packageId} onChange={e => {
                                setPackageId(e.target.value);
                                if (!feeOverridden) {
                                  const pkg = packages.find(p => p.id === e.target.value);
                                  if (pkg) setMonthlyFee(pkg.price ?? 0);
                                }
                              }}>
                                {(filteredPackages.length > 0 ? filteredPackages : packages).map(p =>
                                  <option key={p.id} value={p.id}>{p.name}</option>,
                                )}
                              </select>
                            )}
                          </div>
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <label style={s.label} htmlFor="monthly-fee">Monthly Fee</label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.sub, cursor: 'pointer', marginBottom: 4 }}>
                              <input type="checkbox" checked={feeOverridden} onChange={e => {
                                setFeeOverridden(e.target.checked);
                                if (!e.target.checked) {
                                  const pkg = packages.find(p => p.id === packageId);
                                  if (pkg) setMonthlyFee(pkg.price ?? 0);
                                }
                              }} />
                              Custom fee
                            </label>
                          </div>
                          <input id="monthly-fee" type="number" min={0} step={1}
                            style={{ ...s.input, maxWidth: 200, background: feeOverridden ? '#fff' : '#f8fafc', color: feeOverridden ? C.text : C.muted }}
                            value={monthlyFee}
                            onChange={e => setMonthlyFee(Number(e.target.value))}
                            disabled={!feeOverridden}
                          />
                          {!feeOverridden && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Auto-set from package price.</div>}
                        </div>
                        <div style={{ marginTop: 12, fontSize: 12, color: C.muted }}>
                          Editing here corrects the current period in place — it doesn't create a new one.
                          To switch to a different package on a future date, use <strong>Change package</strong> instead.
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                          <button type="button" onClick={() => setEditCurrent(false)} style={s.outlineBtn} disabled={saving}>
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSave(undefined, { inline: true })}
                            disabled={saving}
                            style={{ ...s.solidBtn, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
                          >
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── History ──────────────────────────────────────── */}
                  <div style={s.card}>
                    <div style={s.sectionTitle}>History</div>
                    {!isHistoryAvailable ? (
                      <div style={{ fontSize: 12, color: C.muted, padding: '6px 0', lineHeight: 1.5 }}>
                        Package history will appear here once the backend supports
                        <code style={{ margin: '0 4px', padding: '1px 6px', background: '#f1f5f9', borderRadius: 4, fontSize: 11 }}>/api/students/:id/enrollments</code>.
                        Showing the current enrolment only for now.
                      </div>
                    ) : pastEnrollments.length === 0 ? (
                      <div style={{ fontSize: 12, color: C.muted, padding: '6px 0' }}>
                        No previous enrolments. The current period is the student's first.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column' as const }}>
                        {pastEnrollments.map(en => (
                          <div key={en.id} style={s.historyRow}>
                            <FontAwesomeIcon icon={faCircle} style={{ fontSize: 6, color: C.muted, marginTop: 6, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, color: C.muted, fontVariantNumeric: 'tabular-nums' as any }}>
                                {formatDate(en.startDate)} → {en.endDate ? formatDate(en.endDate) : 'present'}
                              </div>
                              <div style={{ marginTop: 2, fontSize: 13, fontWeight: 600, color: C.text }}>
                                {en.package?.name ?? '—'}
                                <span style={{ marginLeft: 10, color: C.sub, fontWeight: 500, fontVariantNumeric: 'tabular-nums' as any }}>
                                  RM {en.monthlyFee.toLocaleString()}
                                </span>
                              </div>
                              {en.reason && (
                                <div style={{ marginTop: 2, fontSize: 11, color: C.muted, fontStyle: 'italic' as const }}>
                                  {en.reason}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 4, alignSelf: 'center', flexShrink: 0 }}>
                              <button
                                type="button"
                                className="es-icon-btn"
                                onClick={() => setEditingEnrollment(en)}
                                style={s.iconBtn}
                                title="Edit this enrolment period"
                              >
                                <FontAwesomeIcon icon={faPenToSquare} style={{ fontSize: 11 }} />
                              </button>
                              <button
                                type="button"
                                className="es-icon-btn es-icon-btn-danger"
                                onClick={() => handleDeleteEnrollment(en)}
                                style={{ ...s.iconBtn, color: '#dc2626' }}
                                title="Delete this enrolment period"
                              >
                                <FontAwesomeIcon icon={faTrash} style={{ fontSize: 11 }} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {tab === 'dates' && (
                <div style={s.card}>
                  <h2 style={s.sectionTitle}>Key Dates</h2>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <label style={s.label}>Payment Date</label>
                      <input style={s.input} type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} required />
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <label style={s.label}>First Day of School</label>
                      <input style={s.input} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label style={s.label}>Notes</label>
                    <textarea
                      style={{ ...s.input, height: 110, resize: 'vertical' as const, fontFamily: 'inherit' }}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Optional notes…"
                    />
                  </div>
                </div>
              )}

              {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 0, marginBottom: 12 }}>{error}</p>}

              {/* Page-level Save+Cancel — only relevant for tabs with editable
                  fields. The Enrolments tab uses self-contained actions
                  (Edit current's own Save, Change Package, Withdraw), so
                  the global Save isn't shown there to avoid confusion. */}
              {tab !== 'enrolments' && (
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button type="button" onClick={() => navigate(isCreateSibling && sourceSibling ? `/students/${sourceSibling.id}` : '/students')} style={s.cancelBtn}>
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} style={{ ...s.saveBtn, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
                    {saving ? 'Saving…' : (isCreateSibling ? 'Create sibling' : 'Save')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </form>
    {changePackageOpen && currentEnrollment && (
      <ChangePackageModal
        studentId={student.id}
        studentDob={student.lead.childDob}
        classAge={classAgeOverridden ? classAge : null}
        currentEnrollment={currentEnrollment}
        onClose={() => setChangePackageOpen(false)}
        onCreated={() => {
          setChangePackageOpen(false);
          invalidateStudentDerived();
          showToast('Package changed');
        }}
      />
    )}
    {withdrawOpen && (
      <WithdrawDialog
        studentName={student.lead.childName}
        context={currentEnrollment?.package?.name ?? null}
        submitting={withdrawSubmitting}
        onCancel={() => setWithdrawOpen(false)}
        onConfirm={handleWithdraw}
      />
    )}
    {editingEnrollment && (
      <EditEnrollmentModal
        enrollment={editingEnrollment}
        studentDob={student.lead.childDob}
        onClose={() => setEditingEnrollment(null)}
        onSaved={() => {
          setEditingEnrollment(null);
          invalidateStudentDerived();
          showToast('Enrolment updated');
        }}
      />
    )}
    </>
  );
}

// ── Change Package Modal ──────────────────────────────────────────────
// Closes the current enrollment on `effectiveDate` and opens a new one
// starting the same day with the chosen package + fee. The preview shows
// exactly what the resulting timeline will look like.

interface ChangePackageModalProps {
  studentId: string;
  studentDob: string;
  classAge: number | null;
  currentEnrollment: Enrollment;
  onClose: () => void;
  onCreated: () => void;
}

function ChangePackageModal({
  studentId, studentDob, classAge, currentEnrollment, onClose, onCreated,
}: ChangePackageModalProps) {
  // Default effective date must satisfy the backend rule "effective > current
  // period start". For most cases that means today. But after a year rollover
  // a student's current period starts on Jan 1 of next year — today would be
  // before that, failing validation immediately. Fall back to one day after
  // the current period's start in that case.
  const initialEffectiveDate = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentStart = new Date(currentEnrollment.startDate);
    currentStart.setHours(0, 0, 0, 0);
    const candidate = currentStart >= today
      ? new Date(currentStart.getTime() + 86400000)
      : today;
    return candidate.toISOString().split('T')[0];
  })();
  const [effectiveDate, setEffectiveDate] = useState(initialEffectiveDate);
  const [year, setYear] = useState(new Date().getFullYear());
  const [packageId, setPackageId] = useState('');
  const [feeOverridden, setFeeOverridden] = useState(false);
  const [monthlyFee, setMonthlyFee] = useState(0);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { data: packages = [] } = useQuery({
    queryKey: ['packages', year],
    queryFn: () => fetchPackages(year),
    enabled: !!year,
  });

  const dobAge = year - new Date(studentDob).getFullYear();
  const childAge = classAge ?? dobAge;
  const filteredPackages = packages.filter((p: Package) => p.age === childAge);
  const visiblePackages = filteredPackages.length > 0 ? filteredPackages : packages;

  // Default-pick the first matching package once packages load.
  useEffect(() => {
    if (!packageId && visiblePackages.length > 0) {
      const first = visiblePackages[0];
      setPackageId(first.id);
      setMonthlyFee(first.price ?? 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePackages]);

  const selectedPackage = packages.find((p: Package) => p.id === packageId);
  const startTooEarly = effectiveDate <= currentEnrollment.startDate.split('T')[0];
  const canSubmit = !!packageId && !!effectiveDate && !startTooEarly && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true); setError('');
    try {
      await createEnrollment(studentId, {
        packageId,
        monthlyFee,
        feeOverridden,
        startDate: effectiveDate,
        reason: reason.trim() || null,
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to change package');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={modal.backdrop} onClick={onClose}>
      <div style={modal.card} onClick={e => e.stopPropagation()}>
        <div style={modal.header}>
          <h2 style={modal.title}>Change Package</h2>
          <button type="button" onClick={onClose} style={modal.closeBtn} aria-label="Close">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
          The current enrolment closes on the effective date and a new one opens the same day.
          Past months keep their original package and fee for revenue reporting.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={s.label}>Effective From</label>
            <input style={s.input} type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
          </div>
          <div>
            <label style={s.label}>Year</label>
            <select style={s.input} value={year} onChange={e => setYear(Number(e.target.value))}>
              {(() => {
                const now = new Date().getFullYear();
                return [now - 1, now, now + 1].map(y => <option key={y} value={y}>{y}</option>);
              })()}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={s.label}>New Package</label>
          {packages.length === 0 ? (
            <div style={{ ...s.input, color: C.muted }}>Loading packages…</div>
          ) : (
            <select style={s.input} value={packageId} onChange={e => {
              setPackageId(e.target.value);
              if (!feeOverridden) {
                const pkg = packages.find((p: Package) => p.id === e.target.value);
                if (pkg) setMonthlyFee(pkg.price ?? 0);
              }
            }}>
              {visiblePackages.map((p: Package) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <label style={s.label}>Monthly Fee</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.sub, cursor: 'pointer', marginBottom: 4 }}>
              <input type="checkbox" checked={feeOverridden} onChange={e => {
                setFeeOverridden(e.target.checked);
                if (!e.target.checked && selectedPackage) setMonthlyFee(selectedPackage.price ?? 0);
              }} />
              Custom fee
            </label>
          </div>
          <input type="number" min={0} step={1}
            style={{ ...s.input, maxWidth: 200, background: feeOverridden ? '#fff' : '#f8fafc', color: feeOverridden ? C.text : C.muted }}
            value={monthlyFee}
            onChange={e => setMonthlyFee(Number(e.target.value))}
            disabled={!feeOverridden}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={s.label}>Reason (optional)</label>
          <input style={s.input} type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Upgrading to Full Day" />
        </div>

        {/* ── Preview ─────────────────────────────────────────── */}
        <div style={{ background: '#f8fafc', border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Preview
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, fontSize: 12 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.muted, flexShrink: 0, alignSelf: 'center' }} />
            <span style={{ color: C.muted, fontVariantNumeric: 'tabular-nums' as any, minWidth: 180 }}>
              {formatDate(currentEnrollment.startDate)} → {formatDate(effectiveDate)}
            </span>
            <span style={{ color: C.text, fontWeight: 500 }}>{currentEnrollment.package?.name ?? '—'}</span>
            <span style={{ marginLeft: 'auto', color: C.sub, fontWeight: 600, fontVariantNumeric: 'tabular-nums' as any }}>
              RM {currentEnrollment.monthlyFee.toLocaleString()}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.primary, flexShrink: 0, alignSelf: 'center' }} />
            <span style={{ color: C.muted, fontVariantNumeric: 'tabular-nums' as any, minWidth: 180 }}>
              {formatDate(effectiveDate)} → present
            </span>
            <span style={{ color: C.text, fontWeight: 600 }}>{selectedPackage?.name ?? '—'}</span>
            <span style={{ marginLeft: 'auto', color: C.primary, fontWeight: 700, fontVariantNumeric: 'tabular-nums' as any }}>
              RM {monthlyFee.toLocaleString()}
            </span>
          </div>
        </div>

        {startTooEarly && (
          <p style={{ color: '#dc2626', fontSize: 12, margin: '0 0 12px' }}>
            Effective date must be after the current enrolment's start ({formatDate(currentEnrollment.startDate)}).
          </p>
        )}
        {error && <p style={{ color: '#dc2626', fontSize: 12, margin: '0 0 12px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={s.cancelBtn}>Cancel</button>
          <button type="button" disabled={!canSubmit} onClick={submit}
            style={{ ...s.saveBtn, opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            {submitting ? 'Saving…' : 'Change package'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Enrollment Modal ──────────────────────────────────────────────
// Used to correct a past (closed) enrollment period — wrong package,
// wrong fee, wrong dates. Hits PATCH /enrollments/:id. The current open
// period is corrected via "Edit current" instead, not this modal.

interface EditEnrollmentModalProps {
  enrollment: Enrollment;
  studentDob: string;
  onClose: () => void;
  onSaved: () => void;
}

function EditEnrollmentModal({ enrollment, studentDob, onClose, onSaved }: EditEnrollmentModalProps) {
  const [packageId, setPackageId] = useState(enrollment.packageId);
  const [year, setYear] = useState(() => enrollment.package?.year ?? new Date().getFullYear());
  const [feeOverridden, setFeeOverridden] = useState(enrollment.feeOverridden);
  const [monthlyFee, setMonthlyFee] = useState(enrollment.monthlyFee);
  const [startDate, setStartDate] = useState(enrollment.startDate.slice(0, 10));
  const [endDate, setEndDate] = useState(enrollment.endDate ? enrollment.endDate.slice(0, 10) : '');
  const [reason, setReason] = useState(enrollment.reason ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { data: packages = [] } = useQuery({
    queryKey: ['packages', year],
    queryFn: () => fetchPackages(year),
    enabled: !!year,
  });

  const dobAge = year - new Date(studentDob).getFullYear();
  const filtered = packages.filter((p: Package) => p.age === dobAge);
  const visiblePackages = filtered.length > 0 ? filtered : packages;

  const selectedPackage = packages.find((p: Package) => p.id === packageId);
  const isOpenPeriod = enrollment.endDate === null;
  const datesValid = !!startDate && (isOpenPeriod || (!!endDate && endDate > startDate));

  const submit = async () => {
    if (!datesValid) {
      setError(isOpenPeriod ? 'Start date is required.' : 'End date must be after start date.');
      return;
    }
    setSubmitting(true); setError('');
    try {
      await updateEnrollment(enrollment.id, {
        packageId,
        monthlyFee,
        feeOverridden,
        startDate,
        // Send endDate only when this row had one — never reopen a closed
        // period from this modal (that's not the user's intent here).
        ...(enrollment.endDate !== null ? { endDate: endDate || null } : {}),
        reason: reason.trim() || null,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update enrolment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={modal.backdrop} onClick={onClose}>
      <div style={modal.card} onClick={e => e.stopPropagation()}>
        <div style={modal.header}>
          <h2 style={modal.title}>Edit Enrolment Period</h2>
          <button type="button" onClick={onClose} style={modal.closeBtn} aria-label="Close">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
          Corrects this period in place — package, fee, and dates. Use this for
          fixing wrong entries; revenue for past months will recalculate from the
          new values.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={s.label}>Start Date</label>
            <input style={s.input} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label style={s.label}>
              End Date {isOpenPeriod && <span style={{ marginLeft: 6, fontWeight: 500, color: C.muted }}>(current — leave blank)</span>}
            </label>
            <input
              style={{ ...s.input, ...(isOpenPeriod ? { background: '#f8fafc', color: C.muted } : {}) }}
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              disabled={isOpenPeriod}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={s.label}>Year</label>
            <select style={s.input} value={year} onChange={e => setYear(Number(e.target.value))}>
              {(() => {
                const now = new Date().getFullYear();
                return [now - 2, now - 1, now, now + 1].map(y => <option key={y} value={y}>{y}</option>);
              })()}
            </select>
          </div>
          <div>
            <label style={s.label}>Package</label>
            {packages.length === 0 ? (
              <div style={{ ...s.input, color: C.muted }}>Loading packages…</div>
            ) : (
              <select style={s.input} value={packageId} onChange={e => {
                setPackageId(e.target.value);
                if (!feeOverridden) {
                  const pkg = packages.find((p: Package) => p.id === e.target.value);
                  if (pkg) setMonthlyFee(pkg.price ?? 0);
                }
              }}>
                {visiblePackages.map((p: Package) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <label style={s.label}>Monthly Fee</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.sub, cursor: 'pointer', marginBottom: 4 }}>
              <input type="checkbox" checked={feeOverridden} onChange={e => {
                setFeeOverridden(e.target.checked);
                if (!e.target.checked && selectedPackage) setMonthlyFee(selectedPackage.price ?? 0);
              }} />
              Custom fee
            </label>
          </div>
          <input type="number" min={0} step={1}
            style={{ ...s.input, maxWidth: 200, background: feeOverridden ? '#fff' : '#f8fafc', color: feeOverridden ? C.text : C.muted }}
            value={monthlyFee}
            onChange={e => setMonthlyFee(Number(e.target.value))}
            disabled={!feeOverridden}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={s.label}>Reason (optional)</label>
          <input style={s.input} type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. correcting wrong start date" />
        </div>

        {error && <p style={{ color: '#dc2626', fontSize: 12, margin: '0 0 12px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={s.cancelBtn}>Cancel</button>
          <button type="button" disabled={!datesValid || submitting} onClick={submit}
            style={{ ...s.saveBtn, opacity: !datesValid || submitting ? 0.5 : 1, cursor: !datesValid || submitting ? 'not-allowed' : 'pointer' }}>
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

const modal: Record<string, React.CSSProperties> = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  card: { background: '#fff', borderRadius: 14, padding: '24px 28px', width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', maxHeight: '92vh', overflowY: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' },
  closeBtn: { background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#94a3b8', lineHeight: 1, padding: 4 },
};

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1e293b' },
  inner: { maxWidth: 860, margin: '0 auto' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  backBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.border}`, background: C.card, color: C.muted, cursor: 'pointer', transition: 'all 0.1s' },
  breadcrumbLink: { fontSize: 13, fontWeight: 600, color: C.primary, cursor: 'pointer' },
  heading: { fontSize: 22, fontWeight: 800, color: C.text, margin: 0 },
  layout: { display: 'flex', gap: 24 },
  tabNav: { width: 180, flexShrink: 0, display: 'flex', flexDirection: 'column' as const, gap: 2, position: 'sticky' as const, top: 28, alignSelf: 'flex-start' as const },
  tabBtn: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', fontSize: 13, fontWeight: 500,
    color: C.muted, background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer',
    textAlign: 'left' as const, fontFamily: 'inherit', transition: 'all 0.1s',
  },
  tabBtnActive: { background: C.primaryLight, color: C.primary, fontWeight: 600 },
  content: { flex: 1, minWidth: 0 },
  card: { background: C.card, borderRadius: 12, padding: '20px 24px', border: `1px solid ${C.border}`, marginBottom: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 14px' },
  label: { fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 4, display: 'block' },
  input: { width: '100%', padding: '9px 12px', fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 8, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit', color: C.text, background: '#fff' },
  cancelBtn: { padding: '10px 22px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.text, cursor: 'pointer' },
  saveBtn: { padding: '10px 28px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: C.primary, color: '#fff' },

  // Enrolment-tab specific
  outlineBtn: { padding: '8px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.text, cursor: 'pointer', whiteSpace: 'nowrap' as const },
  solidBtn:   { padding: '8px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: 'none', background: C.primary, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' as const },
  dangerOutlineBtn: { padding: '8px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: `1px solid #fecaca`, background: '#fff', color: '#dc2626', cursor: 'pointer', whiteSpace: 'nowrap' as const },
  withdrawnPill: { display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: 999, background: '#fef2f2', color: '#dc2626', border: `1px solid #fecaca`, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em' },
  historyRow: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderTop: `1px solid #f1f5f9` },
  iconBtn: { width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: C.muted, cursor: 'pointer', borderRadius: 6 },
  siblingBanner: { background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#0369a1', lineHeight: 1.5 },
};
