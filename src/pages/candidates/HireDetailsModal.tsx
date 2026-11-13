import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faUserCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
import type { HireCandidateInput } from '../../api/candidates.js';
import { fetchPositions, fetchLevelIncentives, fetchDepartments } from '../../api/salary.js';
import { fetchAllowanceTypes } from '../../api/allowance.js';
import { useToast } from '../../components/common/Toast.js';
import { C } from './theme.js';
import { ISM } from './modalStyles.js';

// "Confirm & hire" / "Approve & add to staff": collects position, salary,
// statutory contributions, allowances and schedule, then hands them to
// onConfirm — Recruitment → Hire and HR → New Staff → Approve both use it,
// and both end up in the backend's single staffRecord.service.

/** Who is joining — prefilled into the form where we know it. */
export interface HirePerson {
  name: string;
  phone: string | null;
  startDate?: string | null;
  expectedSalary?: number | null;
  desiredPosition?: string | null;
  employmentType?: 'full-time' | 'part-time';
}

const EMP_TOGGLE_ON = { padding: '6px 16px', fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#4f46e5', color: '#fff' } as React.CSSProperties;
const EMP_TOGGLE_OFF = { ...EMP_TOGGLE_ON, background: '#f1f5f9', color: '#64748b' } as React.CSSProperties;

// Schedule picker constants — same shape as EditTeacherPage's Operations
// tab (workStartMinute/workEndMinute/workDays), duplicated here rather
// than shared since the two pages don't otherwise import from each other.
const HIRE_WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const HIRE_TIME_SLOTS = (() => { const s: number[] = []; for (let m = 420; m <= 1080; m += 30) s.push(m); return s; })();
function hireMinutesToTime(m: number): string {
  const h = Math.floor(m / 60), mm = m % 60, p = h >= 12 ? 'PM' : 'AM';
  return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(mm).padStart(2, '0')} ${p}`;
}

// "Accepted" on an OFFER_SENT candidate — instead of a one-click status
// flip, this confirms the details needed to actually create the Teacher
// record (position, salary, statutory contributions) and does both in one
// atomic backend call. Nothing is created/changed if the admin closes
// without confirming — the candidate stays exactly at OFFER_SENT.
export function HireDetailsModal(props: {
  person: HirePerson;
  /** Heading and button wording, e.g. "Confirm & hire" or "Approve & add to staff". */
  actionLabel: string;
  onConfirm: (details: HireCandidateInput) => Promise<void>;
  onClose: () => void;
  onDone: () => void;
}) {
  const { person, actionLabel, onConfirm, onClose, onDone } = props;
  const { showToast } = useToast();
  const { data: allPositions = [] } = useQuery({ queryKey: ['salary-positions'], queryFn: fetchPositions });
  const { data: departmentList = [] } = useQuery({ queryKey: ['departments'], queryFn: fetchDepartments });
  const { data: allIncentives = [] } = useQuery({ queryKey: ['salary-incentives'], queryFn: fetchLevelIncentives });
  const { data: allowTypes = [] } = useQuery({ queryKey: ['allowance-types'], queryFn: fetchAllowanceTypes });
  // Every allowance type except Level Allowance, which isn't directly
  // editable here — it's auto-derived from Position + Level, same as
  // EditTeacherPage's Salary tab.
  const visibleAllowTypes = allowTypes
    .filter(t => t.name.trim().toLowerCase() !== 'level allowance')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const [phone, setPhone] = useState(person.phone ?? '');
  const [positionId, setPositionId] = useState('');
  const [level, setLevel] = useState(0);
  const [employmentType, setEmploymentType] = useState<'full-time' | 'part-time'>(person.employmentType ?? 'full-time');
  const [joinDate, setJoinDate] = useState(person.startDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [workStartMinute, setWorkStartMinute] = useState<number | ''>('');
  const [workEndMinute, setWorkEndMinute] = useState<number | ''>('');
  const [workDays, setWorkDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [salaryType, setSalaryType] = useState<'formula' | 'fixed' | 'hourly'>('formula');
  const [fixedSalaryAmount, setFixedSalaryAmount] = useState(person.expectedSalary ?? 0);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [allowanceDrafts, setAllowanceDrafts] = useState<Record<string, number>>({});
  const getAllowanceAmt = (typeId: string) => allowanceDrafts[typeId] ?? 0;
  const setAllowanceAmt = (typeId: string, v: number) => setAllowanceDrafts(prev => ({ ...prev, [typeId]: v }));
  const [hasEpf, setHasEpf] = useState(true);
  const [hasSocso, setHasSocso] = useState(true);
  const [hasEis, setHasEis] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Two steps instead of one long scroll — Hire details, then Salary &
  // Statutory. Step 1 must be filled in before Next unlocks.
  const [step, setStep] = useState<1 | 2>(1);

  // A bare "0" sitting in every untouched amount field reads as data
  // that's already been entered, not as "nothing yet" — six of them in
  // a row is noisy. Render 0 as an empty, placeholder'd field instead;
  // an actual 0 the admin types is indistinguishable from untouched,
  // which is fine since both mean "no amount".
  const zeroableNumber = (value: number, onChange: (v: number) => void) => ({
    type: 'number' as const,
    min: 0,
    value: value === 0 ? '' : value,
    placeholder: '0',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value === '' ? 0 : Number(e.target.value)),
  });

  // Best-effort pre-fill: match the candidate's free-text desired position
  // to a real Position by name once the list loads. Admin can still change it.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || allPositions.length === 0) return;
    prefilled.current = true;
    const match = person.desiredPosition
      ? allPositions.find(p => p.name.toLowerCase() === person.desiredPosition!.toLowerCase())
      : undefined;
    if (match) setPositionId(match.positionId);
  }, [allPositions, person.desiredPosition]);

  const selectedPosition = allPositions.find(p => p.positionId === positionId);
  const maxLevel = selectedPosition?.maxLevel ?? 5;

  // Positions grouped by department — a flat list would get unwieldy
  // once a second department exists alongside Academic.
  const positionOptionGroups = useMemo(() => {
    const byDept = new Map<string, typeof allPositions>();
    for (const p of allPositions) {
      const key = p.departmentId ?? '__none';
      if (!byDept.has(key)) byDept.set(key, []);
      byDept.get(key)!.push(p);
    }
    const groups = departmentList
      .filter(d => byDept.has(d.departmentId))
      .map(d => ({ label: d.name, items: byDept.get(d.departmentId)! }));
    if (byDept.has('__none')) groups.push({ label: 'Other', items: byDept.get('__none')! });
    return groups;
  }, [allPositions, departmentList]);
  const levelIncentive = allIncentives.find(i => i.positionId === positionId && i.level === level)?.amount ?? 0;
  const totalAllowances = visibleAllowTypes.reduce((sum, t) => sum + getAllowanceAmt(t.id), 0);
  // Same monthly-hours formula the backend (salary.controller.ts) and
  // EditTeacherPage use: minus a 1h lunch break once the day is 6h+.
  const rawHoursPerDay = (workStartMinute !== '' && workEndMinute !== '') ? (Number(workEndMinute) - Number(workStartMinute)) / 60 : 0;
  const hoursPerDay = rawHoursPerDay >= 6 ? rawHoursPerDay - 1 : rawHoursPerDay;
  const monthlyHours = hoursPerDay * workDays.length * 4.33;
  const totalSalary = salaryType === 'fixed'
    ? fixedSalaryAmount + totalAllowances
    : salaryType === 'formula'
    ? (selectedPosition ? selectedPosition.basicSalary + levelIncentive + totalAllowances : totalAllowances)
    // Hourly needs an actual schedule to turn a rate into a monthly figure —
    // show the honest "not set yet" state until Start/End/Days are filled in.
    : (workStartMinute !== '' && workEndMinute !== '' && workDays.length > 0)
    ? hourlyRate * monthlyHours + totalAllowances
    : null;

  const step1Valid = phone.trim().length > 0 && positionId.length > 0 && joinDate.length > 0;
  const canConfirm = !saving
    && step1Valid
    && (salaryType !== 'fixed' || fixedSalaryAmount > 0)
    && (salaryType !== 'hourly' || hourlyRate > 0);

  const handleConfirm = async () => {
    if (!canConfirm) { setError('Please fill in every field before confirming.'); return; }
    setSaving(true); setError('');
    try {
      await onConfirm({
        phone: phone.trim(),
        positionId,
        level,
        employmentType,
        joinDate,
        salaryType,
        fixedSalaryAmount: salaryType === 'fixed' ? fixedSalaryAmount : undefined,
        hourlyRate: salaryType === 'hourly' ? hourlyRate : undefined,
        hasEpf, hasSocso, hasEis,
        workStartMinute: workStartMinute !== '' ? workStartMinute : undefined,
        workEndMinute: workEndMinute !== '' ? workEndMinute : undefined,
        workDays: workDays.length > 0 ? workDays : undefined,
        allowances: visibleAllowTypes
          .map(t => ({ allowanceTypeId: t.id, amount: getAllowanceAmt(t.id) }))
          .filter(a => a.amount > 0),
      });
      showToast(`${person.name} added to staff`);
      onDone();
    } catch (e: any) {
      setError(e?.message ?? 'Could not add to staff.');
    } finally {
      setSaving(false);
    }
  };

  return (
    // No backdrop-click-to-close here — this form has too much entered
    // data (position, salary, allowances) to risk losing on a stray
    // click outside the card. Close explicitly via the X or Cancel.
    <div style={ISM.backdrop}>
      <div style={{ ...ISM.card, width: 'min(560px, 100%)' }}>
        <div style={ISM.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ ...ISM.headerIcon, background: C.successSoft, color: C.success }}>
              <FontAwesomeIcon icon={faUserCheck} />
            </div>
            <div>
              <h2 style={ISM.title}>{actionLabel}</h2>
              <div style={ISM.subtitle}>{person.name} · {person.desiredPosition ?? 'No position'}</div>
            </div>
          </div>
          <button onClick={onClose} style={ISM.closeBtn} title="Close">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        {/* Step indicator — click a completed step to jump back to it.
            Step 1 turns into a checkmark once you've moved past it, and
            the connector fills in, so progress reads at a glance instead
            of two same-weight numbered chips. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 24px 0' }}>
          <button
            type="button"
            onClick={() => setStep(1)}
            style={{ ...ISM.sectionLabel, marginBottom: 0, border: 'none', background: 'none', padding: 0, cursor: 'pointer', opacity: step === 1 ? 1 : 0.85 }}
          >
            <span style={ISM.stepChip}>
              {step === 2 ? <FontAwesomeIcon icon={faCheck} style={{ fontSize: 9 }} /> : '1'}
            </span>
            Hire details
          </button>
          <div style={{ flex: 1, height: 2, borderRadius: 1, background: step === 2 ? ISM.stepChip.background : '#e2e8f0', transition: 'background 0.2s ease' }} />
          <button
            type="button"
            onClick={() => { if (step1Valid) setStep(2); }}
            disabled={!step1Valid}
            style={{ ...ISM.sectionLabel, marginBottom: 0, border: 'none', background: 'none', padding: 0, cursor: step1Valid ? 'pointer' : 'default', opacity: step === 2 ? 1 : 0.55 }}
          >
            <span style={{ ...ISM.stepChip, background: step1Valid ? ISM.stepChip.background : '#cbd5e1' }}>2</span>
            Salary & statutory
          </button>
        </div>

        <div style={{ padding: '18px 24px 20px', display: 'flex', flexDirection: 'column' as const, gap: 14, maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' as const }}>
          {step === 1 && (
            <>
              <label style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub }}>
                  Phone <span style={{ color: C.danger }}>*</span>
                </span>
                <input value={phone} onChange={e => setPhone(e.target.value)} style={ISM.dateInput} />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub }}>
                  Position <span style={{ color: C.danger }}>*</span>
                </span>
                <select
                  value={positionId}
                  onChange={e => { setPositionId(e.target.value); setLevel(0); }}
                  style={{ ...ISM.dateInput, cursor: 'pointer' }}
                >
                  <option value="">— select position —</option>
                  {positionOptionGroups.map(g => (
                    <optgroup key={g.label} label={g.label}>
                      {g.items.map(p => <option key={p.positionId} value={p.positionId}>{p.name}</option>)}
                    </optgroup>
                  ))}
                </select>
                {person.desiredPosition && !selectedPosition && (
                  <span style={{ fontSize: 11, color: C.mutedSoft }}>Applied for "{person.desiredPosition}"</span>
                )}
              </label>

              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, width: 80 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub }}>Level</span>
                  <select value={level} onChange={e => setLevel(Number(e.target.value))} style={{ ...ISM.dateInput, cursor: 'pointer' }}>
                    {Array.from({ length: maxLevel + 1 }, (_, i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, flex: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub }}>Employment type</span>
                  <select value={employmentType} onChange={e => setEmploymentType(e.target.value as any)} style={{ ...ISM.dateInput, cursor: 'pointer' }}>
                    <option value="full-time">Full Time</option>
                    <option value="part-time">Part Time</option>
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, width: 150 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub }}>
                    Join date <span style={{ color: C.danger }}>*</span>
                  </span>
                  <input type="date" value={joinDate} onChange={e => setJoinDate(e.target.value)} style={ISM.dateInput} />
                </label>
              </div>
              {person.startDate && (
                <span style={{ fontSize: 11, color: C.mutedSoft, marginTop: -8 }}>
                  Candidate preferred {new Date(person.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}

              <div style={{ borderTop: `1px solid #f1f5f9`, paddingTop: 14, marginTop: 2 }}>
                <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.mutedSoft, letterSpacing: '0.05em', textTransform: 'uppercase' as const, marginBottom: 8 }}>
                  Schedule <span style={{ fontWeight: 400, textTransform: 'none' as const, letterSpacing: 0 }}>(optional)</span>
                </span>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const, alignItems: 'flex-end' }}>
                  <label style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, width: 130 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub }}>Start</span>
                    <select
                      value={workStartMinute}
                      onChange={e => {
                        const v = e.target.value ? Number(e.target.value) : '';
                        setWorkStartMinute(v);
                        if (v === '') return;
                        if (workEndMinute === '') {
                          // No End picked yet — default to a 9-hour span
                          // (8 effective hours after the lunch deduction),
                          // a typical full teaching day, clamped to the
                          // last available slot. Admin can still change it.
                          // If Start is so late there's no room left for a
                          // valid End (e.g. Start = the last slot), leave
                          // End empty rather than clamp it down to Start.
                          const lastSlot = HIRE_TIME_SLOTS[HIRE_TIME_SLOTS.length - 1];
                          const proposedEnd = v + 9 * 60;
                          if (proposedEnd <= lastSlot) setWorkEndMinute(proposedEnd);
                          else if (lastSlot > v) setWorkEndMinute(lastSlot);
                        } else if (workEndMinute <= v) {
                          // An End that's no longer after the new Start is
                          // meaningless (would compute negative hours) —
                          // clear it rather than leave a stale invalid pair.
                          setWorkEndMinute('');
                        }
                      }}
                      style={{ ...ISM.dateInput, cursor: 'pointer' }}
                    >
                      <option value="">--</option>
                      {HIRE_TIME_SLOTS.map(m => <option key={m} value={m}>{hireMinutesToTime(m)}</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, width: 130 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub }}>End</span>
                    <select value={workEndMinute} onChange={e => setWorkEndMinute(e.target.value ? Number(e.target.value) : '')} style={{ ...ISM.dateInput, cursor: 'pointer' }}>
                      <option value="">--</option>
                      {/* Only times after Start — an End before/equal to Start
                          isn't a valid same-day shift, so it's just not offered. */}
                      {HIRE_TIME_SLOTS.filter(m => workStartMinute === '' || m > workStartMinute).map(m => <option key={m} value={m}>{hireMinutesToTime(m)}</option>)}
                    </select>
                  </label>
                  <div>
                    <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textSub, marginBottom: 6 }}>Days</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {HIRE_WEEK_DAYS.map((d, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setWorkDays(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i].sort())}
                          style={{ width: 36, height: 32, fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none', cursor: 'pointer', background: workDays.includes(i) ? '#4f46e5' : '#f1f5f9', color: workDays.includes(i) ? '#fff' : '#94a3b8' }}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <label style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, width: 140 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub }}>Salary type</span>
                  <select value={salaryType} onChange={e => setSalaryType(e.target.value as any)} style={{ ...ISM.dateInput, cursor: 'pointer' }}>
                    <option value="fixed">Fixed</option>
                    <option value="hourly">Hourly Rate</option>
                    <option value="formula">Formula</option>
                  </select>
                </label>
                {salaryType === 'fixed' && (
                  <label style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, width: 160 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub }}>Fixed amount (RM)</span>
                    <input {...zeroableNumber(fixedSalaryAmount, setFixedSalaryAmount)} style={ISM.dateInput} />
                  </label>
                )}
                {salaryType === 'hourly' && (
                  <label style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, width: 160 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub }}>Hourly rate (RM)</span>
                    <input {...zeroableNumber(hourlyRate, setHourlyRate)} style={ISM.dateInput} />
                  </label>
                )}
                {salaryType === 'formula' && selectedPosition && (
                  <div style={{ fontSize: 11, color: C.mutedSoft, paddingBottom: 8, lineHeight: 1.6 }}>
                    Basic RM {selectedPosition.basicSalary.toLocaleString()}
                    {levelIncentive > 0 && <> + Level incentive RM {levelIncentive.toLocaleString()}</>}
                  </div>
                )}
              </div>

              {visibleAllowTypes.length > 0 && (
                <div style={{ marginTop: 2, paddingTop: 14, borderTop: `1px solid #f1f5f9` }}>
                  <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.mutedSoft, letterSpacing: '0.05em', textTransform: 'uppercase' as const, marginBottom: 8 }}>
                    Allowances <span style={{ fontWeight: 400, textTransform: 'none' as const, letterSpacing: 0 }}>(optional)</span>
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 12 }}>
                    {visibleAllowTypes.map(t => (
                      <label key={t.id} style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, width: 150 }}>
                        {/* Fixed height regardless of wrap, so a 2-line label
                            (e.g. "Training Completion Allowance") doesn't push
                            its input out of alignment with its row-mates. */}
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.textSub, minHeight: 30, lineHeight: 1.3 }}>{t.name}</span>
                        <input {...zeroableNumber(getAllowanceAmt(t.id), v => setAllowanceAmt(t.id, v))} style={ISM.dateInput} />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Always-visible running total — the whole point is that
                  typing an allowance should immediately answer "is the
                  salary I'm about to set actually right?" without the
                  admin having to add it up themselves. */}
              <div style={{
                marginTop: 14, padding: '10px 14px', borderRadius: 8,
                background: totalSalary != null ? C.successSoft : '#fffbeb',
                border: `1px solid ${totalSalary != null ? '#bbf7d0' : '#fde68a'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: totalSalary != null ? C.success : '#92400e' }}>
                  Total monthly salary
                </span>
                {totalSalary != null ? (
                  <span style={{ fontSize: 16, fontWeight: 800, color: C.success, fontVariantNumeric: 'tabular-nums' as const }}>
                    RM {totalSalary.toLocaleString()}
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: '#92400e', textAlign: 'right' as const, maxWidth: 220 }}>
                    Set the work schedule on Step 1 to see the total
                  </span>
                )}
              </div>

              <div style={{ marginTop: 2, paddingTop: 14, borderTop: `1px solid #f1f5f9` }}>
                <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.mutedSoft, letterSpacing: '0.05em', textTransform: 'uppercase' as const, marginBottom: 8 }}>
                  Statutory contributions
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([['EPF', hasEpf, setHasEpf], ['SOCSO', hasSocso, setHasSocso], ['EIS', hasEis, setHasEis]] as const).map(([label, val, setter]) => (
                    <button key={label} type="button" onClick={() => setter(!val)} style={val ? EMP_TOGGLE_ON : EMP_TOGGLE_OFF}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {error && <div style={ISM.errorRow}>{error}</div>}

        <div style={ISM.footer}>
          <button onClick={step === 1 ? onClose : () => setStep(1)} style={ISM.cancelBtn}>
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          <div style={{ flex: 1 }} />
          {step === 1 ? (
            <button
              onClick={() => step1Valid && setStep(2)}
              disabled={!step1Valid}
              style={{ ...ISM.saveBtn, opacity: step1Valid ? 1 : 0.6, cursor: step1Valid ? 'pointer' : 'default' }}
            >
              Next
            </button>
          ) : (
            <button onClick={handleConfirm} disabled={!canConfirm} style={{ ...ISM.saveBtn, background: C.success, opacity: canConfirm ? 1 : 0.6, cursor: canConfirm ? 'pointer' : 'default' }}>
              {saving ? 'Saving…' : actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
