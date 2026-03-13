import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare, faComment, faCalendarPlus, faBell } from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { fetchLeads, updateLead, createAppointment, fetchUpcomingAppointments, fetchLeadStats, UpcomingAppointment, UpdateLeadPayload } from '../api/leads.js';
import { fetchSettings } from '../api/settings.js';
import { getConnectToken } from '../api/google.js';
import { fetchPackages, fetchPackageYears } from '../api/packages.js';
import { createStudent } from '../api/students.js';
import { Lead, LeadStatus, Package } from '../types/index.js';

const STATUSES: LeadStatus[] = [
  'NEW',
  'CONTACTED',
  'APPOINTMENT_BOOKED',
  'FOLLOW_UP',
  'ENROLLED',
  'LOST',
];

const currentYear = new Date().getFullYear();
const ENROLMENT_YEARS = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

type SortField = 'submittedAt' | 'childName' | 'childDob' | 'enrolmentYear' | 'status';
type SortOrder = 'asc' | 'desc';

// ── Helpers ───────────────────────────────────────────────────────────────────


function calcClassAge(dob: string, enrolmentYear: number): number {
  return enrolmentYear - new Date(dob).getFullYear();
}

function classAgeBadgeStyle(age: number): React.CSSProperties {
  const palette: Record<number, { bg: string; color: string }> = {
    2: { bg: '#fed7e2', color: '#97266d' },
    3: { bg: '#feebc8', color: '#c05621' },
    4: { bg: '#fefcbf', color: '#744210' },
    5: { bg: '#c6f6d5', color: '#276749' },
    6: { bg: '#bee3f8', color: '#2c5282' },
  };
  const { bg, color } = palette[age] ?? { bg: '#e2e8f0', color: '#4a5568' };
  return {
    display: 'inline-block', padding: '1px 7px', background: bg, color,
    borderRadius: 10, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' as const, cursor: 'default',
  };
}

const YEAR_PALETTE = [
  { bg: '#d1fae5', color: '#065f46' },
  { bg: '#dbeafe', color: '#1e40af' },
  { bg: '#fef3c7', color: '#92400e' },
  { bg: '#ede9fe', color: '#5b21b6' },
  { bg: '#fce7f3', color: '#9d174d' },
];
function enrolmentYearBadgeStyle(year: number): React.CSSProperties {
  const { bg, color } = YEAR_PALETTE[Math.abs(year - 2020) % YEAR_PALETTE.length];
  return {
    display: 'inline-block', padding: '1px 7px', background: bg, color,
    borderRadius: 10, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' as const,
  };
}

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+')) return cleaned.replace(/\D/g, '');
  if (cleaned.startsWith('0')) return '60' + cleaned.slice(1);
  return '60' + cleaned;
}

function whatsappUrl(phone: string, message: string): string {
  return `https://web.whatsapp.com/send?phone=${normalizePhone(phone)}&text=${encodeURIComponent(message)}`;
}

function defaultAppointmentTime(): string {
  const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const remainder = d.getMinutes() % 30;
  if (remainder !== 0) d.setMinutes(d.getMinutes() + (30 - remainder), 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Upcoming Appointments Panel ───────────────────────────────────────────────

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function groupByDate(items: UpcomingAppointment[]): { date: string; appts: UpcomingAppointment[]; isToday: boolean }[] {
  const map = new Map<string, UpcomingAppointment[]>();
  for (const item of items) {
    const key = new Date(item.appointmentStart).toLocaleDateString('en-MY', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  const today = new Date();
  return Array.from(map.entries()).map(([date, appts]) => ({
    date,
    appts,
    isToday: isSameDay(new Date(appts[0].appointmentStart), today),
  }));
}

function UpcomingPanel({ items }: { items: UpcomingAppointment[] }) {
  const groups = groupByDate(items);
  return (
    <div style={panel.container}>
      <h2 style={panel.heading}>Upcoming Appointments</h2>
      {groups.length === 0 && <p style={panel.empty}>No upcoming appointments</p>}
      {groups.map(({ date, appts, isToday }) => (
        <div key={date} style={panel.group}>
          <div style={isToday ? panel.dateLabelToday : panel.dateLabel}>
            {isToday ? `TODAY — ${date}` : date}
          </div>
          {appts.map((a) => (
            <div key={a.id} style={isToday ? panel.rowToday : panel.row}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={isToday ? panel.nameToday : panel.name}>
                  {a.appointmentIsPlaceholder && <span style={panel.phBadge}>PH</span>}
                  {a.childName}
                </span>
                <FontAwesomeIcon
                  icon={faWhatsapp}
                  onClick={() => window.open(whatsappUrl(a.parentPhone, ''), '_blank')}
                  title="WhatsApp"
                  style={{ color: '#25d366', fontSize: 18, cursor: 'pointer' }}
                />
              </span>
              <span style={isToday ? panel.timeToday : panel.time}>
                {new Date(a.appointmentStart).toLocaleTimeString('en-MY', {
                  hour: '2-digit', minute: '2-digit', hour12: true,
                })}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Follow Up Panel ───────────────────────────────────────────────────────────

function FollowUpPanel({ leads }: { leads: Lead[] }) {
  return (
    <div style={panel.container}>
      <h2 style={panel.heading}>Follow Up</h2>
      {leads.length === 0 && <p style={panel.empty}>No follow-ups pending</p>}
      {leads.map((lead) => (
        <div key={lead.id} style={panel.row}>
          <div>
            <div style={panel.name}>{lead.childName}</div>
            {lead.appointmentStart && (
              <div style={{ fontSize: 11, color: '#e53e3e', marginTop: 1 }}>
                {new Date(lead.appointmentStart).toLocaleDateString('en-MY', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </div>
            )}
          </div>
          <a
            href={`https://web.whatsapp.com/send?phone=${normalizePhone(lead.parentPhone)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 16, textDecoration: 'none' }}
            title={lead.parentPhone}
          >💬</a>
        </div>
      ))}
    </div>
  );
}

// ── Appointment Modal ─────────────────────────────────────────────────────────

function applyWaTemplate(template: string, childName: string, dt: string, address: string, durationMinutes: number): string {
  const d = new Date(dt);
  const end = new Date(d.getTime() + durationMinutes * 60_000);
  const dateStr = d.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = d.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true });
  const endTimeStr = end.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true });
  return template
    .replace(/\{\{childName\}\}/g, childName)
    .replace(/\{\{appointmentDate\}\}/g, dateStr)
    .replace(/\{\{appointmentTime\}\}/g, timeStr)
    .replace(/\{\{appointmentEndTime\}\}/g, endTimeStr)
    .replace(/\{\{address\}\}/g, address);
}

function AppointmentModal({
  lead,
  waTemplate,
  waTemplateZh,
  address,
  durationMinutes,
  onClose,
  onConfirm,
}: {
  lead: Lead;
  waTemplate: string;
  waTemplateZh: string;
  address: string;
  durationMinutes: number;
  onClose: () => void;
  onConfirm: (appointmentStart: string, waMessage: string, isPlaceholder: boolean) => Promise<void>;
}) {
  const initialDateTime = lead.appointmentStart
    ? (() => {
        const d = new Date(lead.appointmentStart);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      })()
    : defaultAppointmentTime();
  const [dateTime, setDateTime] = useState(initialDateTime);
  const [isPlaceholder, setIsPlaceholder] = useState(lead.appointmentIsPlaceholder ?? !lead.appointmentStart);
  const [message, setMessage] = useState(() => applyWaTemplate(waTemplate, lead.childName, initialDateTime, address, durationMinutes));
  const [messageEdited, setMessageEdited] = useState(false);
  const [messageZh, setMessageZh] = useState(() => waTemplateZh ? applyWaTemplate(waTemplateZh, lead.childName, initialDateTime, address, durationMinutes) : '');
  const [messageZhEdited, setMessageZhEdited] = useState(false);
  const [lang, setLang] = useState<'en' | 'zh'>('en');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!messageEdited) setMessage(applyWaTemplate(waTemplate, lead.childName, dateTime, address, durationMinutes));
  }, [dateTime]);

  useEffect(() => {
    if (!messageZhEdited && waTemplateZh) setMessageZh(applyWaTemplate(waTemplateZh, lead.childName, dateTime, address, durationMinutes));
  }, [dateTime]);

  const handleWhatsApp = () => {
    window.open(whatsappUrl(lead.parentPhone, message), '_blank');
  };

  const handleWhatsAppZh = () => {
    window.open(whatsappUrl(lead.parentPhone, messageZh), '_blank');
  };

  const handleConfirm = async () => {
    if (!dateTime) { setError('Please select a date and time.'); return; }
    setConfirming(true);
    setError('');
    try {
      await onConfirm(new Date(dateTime).toISOString(), message, isPlaceholder);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to book appointment');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div style={apptModal.backdrop} onClick={onClose}>
      <div style={apptModal.card} onClick={(e) => e.stopPropagation()}>
        <div style={apptModal.header}>
          <div>
            <h2 style={apptModal.title}>Book Appointment</h2>
            <p style={apptModal.subtitle}>{lead.childName} · {lead.parentPhone}</p>
          </div>
          <button onClick={onClose} style={apptModal.closeBtn} aria-label="Close">✕</button>
        </div>

        <label style={apptModal.label}>
          Appointment Date & Time
          <input
            type="datetime-local"
            style={apptModal.input}
            value={dateTime}
            onChange={(e) => { setDateTime(e.target.value); }}
            required
          />
        </label>

        <label style={apptModal.placeholderCheck}>
          <input
            type="checkbox"
            checked={isPlaceholder}
            onChange={(e) => setIsPlaceholder(e.target.checked)}
          />
          Is Placeholder
        </label>

        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
            <div style={apptModal.label}>WhatsApp Message</div>
            {waTemplateZh && (
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => setLang('en')}
                  style={{ padding: '2px 10px', borderRadius: 6, border: '1px solid #cbd5e0', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: lang === 'en' ? '#3182ce' : '#f7fafc', color: lang === 'en' ? '#fff' : '#4a5568' }}
                >EN</button>
                <button
                  onClick={() => setLang('zh')}
                  style={{ padding: '2px 10px', borderRadius: 6, border: '1px solid #cbd5e0', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: lang === 'zh' ? '#3182ce' : '#f7fafc', color: lang === 'zh' ? '#fff' : '#4a5568' }}
                >中文</button>
              </div>
            )}
          </div>
          {lang === 'en' ? (
            <>
              <textarea
                style={{ ...apptModal.input, height: 100, resize: 'vertical' }}
                value={message}
                onChange={(e) => { setMessage(e.target.value); setMessageEdited(true); }}
              />
              <button onClick={handleWhatsApp} style={{ ...apptModal.waBtn, marginTop: 8, width: '100%' }}>
                📱 WhatsApp
              </button>
            </>
          ) : (
            <>
              <textarea
                style={{ ...apptModal.input, height: 100, resize: 'vertical' }}
                value={messageZh}
                onChange={(e) => { setMessageZh(e.target.value); setMessageZhEdited(true); }}
              />
              <button onClick={handleWhatsAppZh} style={{ ...apptModal.waBtn, marginTop: 8, width: '100%' }}>
                📱 WhatsApp (中文)
              </button>
            </>
          )}
        </div>

        {error && <p style={apptModal.error}>{error}</p>}

        <div style={apptModal.footer}>
          <button onClick={handleConfirm} disabled={confirming} style={{ ...apptModal.confirmBtn, marginLeft: 'auto' }}>
            {confirming ? 'Booking…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Follow Up Modal ───────────────────────────────────────────────────────────

function applyFollowUpTemplate(template: string, lead: Lead, address: string, durationMinutes: number): string {
  const childName = lead.childName;
  const dt = lead.appointmentStart;
  if (dt) {
    const d = new Date(dt);
    const end = new Date(d.getTime() + durationMinutes * 60_000);
    const dateStr = d.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true });
    const endTimeStr = end.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true });
    return template
      .replace(/\{\{childName\}\}/g, childName)
      .replace(/\{\{appointmentDate\}\}/g, dateStr)
      .replace(/\{\{appointmentTime\}\}/g, timeStr)
      .replace(/\{\{appointmentEndTime\}\}/g, endTimeStr)
      .replace(/\{\{address\}\}/g, address);
  }
  return template
    .replace(/\{\{childName\}\}/g, childName)
    .replace(/\{\{appointmentDate\}\}/g, '')
    .replace(/\{\{appointmentTime\}\}/g, '')
    .replace(/\{\{appointmentEndTime\}\}/g, '')
    .replace(/\{\{address\}\}/g, address);
}

function FollowUpModal({
  lead,
  waTemplate,
  waTemplateZh,
  address,
  durationMinutes,
  onClose,
}: {
  lead: Lead;
  waTemplate: string;
  waTemplateZh: string;
  address: string;
  durationMinutes: number;
  onClose: () => void;
}) {
  const [message, setMessage] = useState(() => applyFollowUpTemplate(waTemplate, lead, address, durationMinutes));
  const [messageZh, setMessageZh] = useState(() => waTemplateZh ? applyFollowUpTemplate(waTemplateZh, lead, address, durationMinutes) : '');
  const [lang, setLang] = useState<'en' | 'zh'>('en');

  useEffect(() => {
    setMessage(applyFollowUpTemplate(waTemplate, lead, address, durationMinutes));
  }, [waTemplate]);

  useEffect(() => {
    if (waTemplateZh) setMessageZh(applyFollowUpTemplate(waTemplateZh, lead, address, durationMinutes));
  }, [waTemplateZh]);

  const handleWhatsApp = () => {
    window.open(whatsappUrl(lead.parentPhone, lang === 'en' ? message : messageZh), '_blank');
  };

  return (
    <div style={apptModal.backdrop} onClick={onClose}>
      <div style={apptModal.card} onClick={(e) => e.stopPropagation()}>
        <div style={apptModal.header}>
          <div>
            <h2 style={apptModal.title}>Follow Up</h2>
            <p style={apptModal.subtitle}>{lead.childName} · {lead.parentPhone}</p>
          </div>
          <button onClick={onClose} style={apptModal.closeBtn} aria-label="Close">✕</button>
        </div>

        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
            <div style={apptModal.label}>WhatsApp Message</div>
            {waTemplateZh && (
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setLang('en')} style={{ padding: '2px 10px', borderRadius: 6, border: '1px solid #cbd5e0', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: lang === 'en' ? '#3182ce' : '#f7fafc', color: lang === 'en' ? '#fff' : '#4a5568' }}>EN</button>
                <button onClick={() => setLang('zh')} style={{ padding: '2px 10px', borderRadius: 6, border: '1px solid #cbd5e0', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: lang === 'zh' ? '#3182ce' : '#f7fafc', color: lang === 'zh' ? '#fff' : '#4a5568' }}>中文</button>
              </div>
            )}
          </div>
          <textarea
            style={{ ...apptModal.input, height: 120, resize: 'vertical' }}
            value={lang === 'en' ? message : messageZh}
            onChange={(e) => lang === 'en' ? setMessage(e.target.value) : setMessageZh(e.target.value)}
          />
          <button onClick={handleWhatsApp} style={{ ...apptModal.waBtn, marginTop: 8, width: '100%' }}>
            📱 WhatsApp{lang === 'zh' ? ' (中文)' : ''}
          </button>
        </div>

        <div style={apptModal.footer}>
          <button onClick={onClose} style={{ ...apptModal.confirmBtn, background: '#718096', marginLeft: 'auto' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

const PINNED_LOST_REASON = "Didn't attend the enquiry";
const DEFAULT_LOST_REASONS = [
  PINNED_LOST_REASON,
  'Transportation', 'Operating Hours', 'Distance', 'Enrolled other school',
  'Fee too expensive', 'Special Need', 'Class Full', "Didn't reply", 'Under Age',
];

interface EditForm {
  childName: string;
  parentPhone: string;
  childDob: string;
  enrolmentYear: string;
  status: LeadStatus;
  notes: string;
  lostReason: string;
}

function EditModal({
  lead,
  lostReasons,
  onClose,
  onSaved,
}: {
  lead: Lead;
  lostReasons: string[];
  onClose: () => void;
  onSaved: (updated: Lead) => void;
}) {
  const [form, setForm] = useState<EditForm>({
    childName: lead.childName,
    parentPhone: lead.parentPhone,
    childDob: lead.childDob.split('T')[0],
    enrolmentYear: String(lead.enrolmentYear),
    status: lead.status,
    notes: lead.notes ?? '',
    lostReason: lead.lostReason ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field: keyof EditForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.status === 'LOST' && !form.lostReason) {
      setError('Please select a reason for marking this lead as Lost.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload: UpdateLeadPayload = {
        childName: form.childName,
        parentPhone: form.parentPhone,
        childDob: form.childDob,
        enrolmentYear: Number(form.enrolmentYear),
        status: form.status,
        notes: form.notes,
        lostReason: form.status === 'LOST' ? form.lostReason : null,
      };
      const updated = await updateLead(lead.id, payload);
      onSaved(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={modal.backdrop} onClick={onClose}>
      <div style={modal.card} onClick={(e) => e.stopPropagation()}>
        <div style={modal.header}>
          <h2 style={modal.title}>Edit Lead</h2>
          <button onClick={onClose} style={modal.closeBtn} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSave}>
          <div style={modal.grid}>
            <label style={modal.label}>
              Child Name
              <input style={modal.input} value={form.childName} onChange={set('childName')} required />
            </label>
            <label style={modal.label}>
              Parent Phone
              <input style={modal.input} value={form.parentPhone} onChange={set('parentPhone')} required />
            </label>
            <label style={modal.label}>
              Date of Birth
              <input
                style={modal.input}
                type="date"
                value={form.childDob}
                onChange={set('childDob')}
                max={new Date().toISOString().split('T')[0]}
                required
              />
            </label>
            <label style={modal.label}>
              Enrolment Year
              <select style={modal.input} value={form.enrolmentYear} onChange={set('enrolmentYear')}>
                {ENROLMENT_YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
            <label style={modal.label}>
              Status
              <select style={modal.input} value={form.status} onChange={set('status')}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            {form.status === 'LOST' && (
              <label style={modal.label}>
                <span>Lost Reason <span style={{ color: '#e53e3e' }}>*</span></span>
                <select style={modal.input} value={form.lostReason} onChange={set('lostReason')} required>
                  <option value="">— select reason —</option>
                  {lostReasons.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <label style={{ ...modal.label, display: 'block', marginTop: 12 }}>
            Notes
            <textarea
              style={{ ...modal.input, height: 80, resize: 'vertical' }}
              value={form.notes}
              onChange={set('notes')}
              placeholder="Optional notes…"
            />
          </label>

          {error && <p style={{ color: '#e53e3e', marginTop: 8 }}>{error}</p>}

          <div style={modal.footer}>
            <button type="button" onClick={onClose} style={modal.cancelBtn}>Cancel</button>
            <button type="submit" disabled={saving} style={modal.saveBtn}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Enrolment Modal ───────────────────────────────────────────────────────────

function EnrolmentModal({
  lead,
  onClose,
  onEnrolled,
}: {
  lead: Lead;
  onClose: () => void;
  onEnrolled: () => void;
}) {
  const { data: availableYears = [], isLoading: loadingYears } = useQuery({
    queryKey: ['packageYears'],
    queryFn: fetchPackageYears,
  });

  const defaultYear = availableYears.includes(lead.enrolmentYear)
    ? lead.enrolmentYear
    : availableYears[0] ?? lead.enrolmentYear;

  const todayStr = new Date().toISOString().split('T')[0];

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayStr);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const year = selectedYear ?? defaultYear;

  const { data: packages = [], isLoading: loadingPkgs } = useQuery({
    queryKey: ['packages', year],
    queryFn: () => fetchPackages(year),
    enabled: !!year,
  });

  // Reset package selection when year changes
  useEffect(() => {
    setSelectedPackageId('');
  }, [year]);

  // Auto-select package matching child's age for the selected year
  useEffect(() => {
    if (packages.length > 0) {
      const childAge = year - new Date(lead.childDob).getFullYear();
      const matched = packages.find((p) => p.age === childAge);
      setSelectedPackageId((matched ?? packages[0]).id);
    }
  }, [packages]);

  const handleSubmit = async () => {
    if (!selectedPackageId) { setError('Please select a package'); return; }
    if (!paymentDate) { setError('Please enter a payment date'); return; }
    setSubmitting(true); setError('');
    try {
      await createStudent({
        leadId: lead.id,
        enrolmentYear: year,
        enrolmentMonth: selectedMonth,
        packageId: selectedPackageId,
        enrolledAt: new Date(paymentDate).toISOString(),
        notes: notes || undefined,
      });
      onEnrolled();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Enrolment failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={modal.backdrop} onClick={onClose}>
      <div style={modal.card} onClick={(e) => e.stopPropagation()}>
        <div style={modal.header}>
          <h2 style={modal.title}>Enrol Student</h2>
          <button onClick={onClose} style={modal.closeBtn} aria-label="Close">✕</button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: '#4a5568' }}>
          Enrolling <strong>{lead.childName}</strong>
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={modal.label}>
            Enrolment Year
            {loadingYears ? (
              <span style={{ fontSize: 13, color: '#a0aec0', marginTop: 4 }}>Loading years…</span>
            ) : availableYears.length === 0 ? (
              <span style={{ fontSize: 13, color: '#e53e3e', marginTop: 4 }}>No packages configured. Add them in Settings → Packages.</span>
            ) : (
              <select
                style={modal.input}
                value={year}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}
          </label>

          <label style={modal.label}>
            Enrolment Month
            <select
              style={modal.input}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
            >
              {['January','February','March','April','May','June','July','August','September','October','November','December'].map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </select>
          </label>

          <label style={modal.label}>
            Package
            {loadingPkgs ? (
              <span style={{ fontSize: 13, color: '#a0aec0', marginTop: 4 }}>Loading packages…</span>
            ) : packages.length === 0 ? (
              <span style={{ fontSize: 13, color: '#e53e3e', marginTop: 4 }}>No packages for {year}. Add them in Settings → Packages.</span>
            ) : (
              <select style={modal.input} value={selectedPackageId} onChange={(e) => setSelectedPackageId(e.target.value)}>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </label>

          <label style={modal.label}>
            Payment Date
            <input
              type="date"
              style={modal.input}
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </label>

          <label style={modal.label}>
            Notes
            <textarea
              style={{ ...modal.input, height: 72, resize: 'vertical' }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes…"
            />
          </label>
        </div>

        {error && <p style={{ color: '#e53e3e', fontSize: 13, marginTop: 12 }}>{error}</p>}

        <div style={modal.footer}>
          <button onClick={onClose} style={modal.cancelBtn}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || availableYears.length === 0 || packages.length === 0}
            style={{ ...modal.saveBtn, background: '#38a169' }}
          >
            {submitting ? 'Enrolling…' : 'Confirm Enrolment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [bookingLead, setBookingLead] = useState<Lead | null>(null);
  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null);
  const [enrolingLead, setEnrolingLead] = useState<Lead | null>(null);
  const [rowResults, setRowResults] = useState<Record<string, { link?: string | null; error?: string }>>({});
  const [filterStatus, setFilterStatus] = useState('active');
  const [completedSubFilter, setCompletedSubFilter] = useState<'' | 'ENROLLED' | 'LOST'>('');
  const [sortBy, setSortBy] = useState<SortField>('submittedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const effectiveStatus = filterStatus === 'inactive' && completedSubFilter ? completedSubFilter : filterStatus;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['leads', page, pageSize, effectiveStatus, sortBy, sortOrder],
    queryFn: () => fetchLeads(page, pageSize, effectiveStatus || undefined, sortBy, sortOrder),
  });

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const handleFilterStatus = (status: string) => {
    setFilterStatus(status);
    setCompletedSubFilter('');
    setPage(1);
  };

  const sortIndicator = (field: SortField) => (
    <span style={{ marginLeft: 4, color: sortBy === field ? '#2d3748' : '#cbd5e0' }}>
      {sortBy === field ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  const { data: upcomingAppts = [] } = useQuery({
    queryKey: ['upcomingAppointments'],
    queryFn: fetchUpcomingAppointments,
    refetchInterval: 60_000,
  });

  const { data: followUpData } = useQuery({
    queryKey: ['leads-follow-up'],
    queryFn: () => fetchLeads(1, 50, 'FOLLOW_UP', 'appointmentStart', 'asc'),
    refetchInterval: 60_000,
  });
  const followUpLeads = followUpData?.items ?? [];

  const { data: stats } = useQuery({
    queryKey: ['lead-stats'],
    queryFn: fetchLeadStats,
    staleTime: 0,
    refetchInterval: 60_000,
  });

  const waTemplate =
    settings?.whatsapp_template ??
    'Hi, this is Ten Toes Preschool. Thanks for your enquiry for {{childName}}. Would you like to arrange a school visit?';
  const waTemplateZh = settings?.whatsapp_template_zh ?? '';
  const followUpTemplate = settings?.whatsapp_followup_template ?? 'Hi, just following up on {{childName}}\'s enquiry. Do you have any questions?';
  const followUpTemplateZh = settings?.whatsapp_followup_template_zh ?? '';
  const kinderAddress = typeof settings?.kinder_address === 'string' ? settings.kinder_address : '';
  const apptDuration = typeof settings?.appointment_duration_minutes === 'number' ? settings.appointment_duration_minutes : 30;

  const lostReasons: string[] = (() => {
    const raw = Array.isArray(settings?.lost_reasons) ? settings.lost_reasons as string[] : DEFAULT_LOST_REASONS;
    // Always ensure pinned reason is first
    return [PINNED_LOST_REASON, ...raw.filter(r => r !== PINNED_LOST_REASON)];
  })();

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    queryClient.invalidateQueries({ queryKey: ['leads-follow-up'] });
    queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
  };

  const [isExporting, setIsExporting] = useState(false);
  async function handleExport() {
    if (!data || data.total === 0) return;
    setIsExporting(true);
    try {
      const all = await fetchLeads(1, data.total, effectiveStatus || undefined, sortBy, sortOrder);
      const rows = all.items.map((l: Lead) => ({
        'Submitted At': l.submittedAt,
        'Child Name': l.childName,
        'Parent Phone': l.parentPhone,
        'Child Date of Birth': l.childDob ? l.childDob.toString().split('T')[0] : '',
        'Enrolment Year': l.enrolmentYear,
        'Relationship to Child': l.relationship ?? '',
        'Programme': l.programme ?? '',
        'Preferred Appointment Time': l.preferredAppointmentTime ?? '',
        'Address / Location': l.addressLocation ?? '',
        'Needs Transport': l.needsTransport == null ? '' : l.needsTransport ? 'Yes' : 'No',
        'How Did You Know': l.howDidYouKnow ?? '',
        'Status': l.status,
        'Notes': l.notes ?? '',
        'Lost / Declined Reason': l.lostReason ?? '',
        'Appointment': l.appointmentStart ?? '',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const label = filterStatus === 'active' ? 'active' : filterStatus === 'inactive' ? 'completed' : 'all';
      a.href = url;
      a.download = `leads-${label}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  const handleSaved = (_updated: Lead) => {
    invalidateAll();
    setEditingLead(null);
  };

  const handleFollowUp = (lead: Lead) => {
    setFollowUpLead(lead);
  };

  const handleConfirmAppointment = async (lead: Lead, appointmentStart: string, waMessage: string, isPlaceholder: boolean) => {
    try {
      const result = await createAppointment(lead.id, appointmentStart, waMessage, isPlaceholder);
      setRowResults((prev) => ({ ...prev, [lead.id]: { link: result.googleEventLink } }));
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['upcomingAppointments'] });
      if (result.googleEventLink) window.open(result.googleEventLink, '_blank');
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Google calendar not connected')) {
        const { url } = await getConnectToken();
        sessionStorage.setItem('google_return_to', window.location.pathname);
        window.location.href = url;
        return;
      }
      throw err;
    }
  };

  return (
    <div style={styles.page}>
      {editingLead && (
        <EditModal
          lead={editingLead}
          lostReasons={lostReasons}
          onClose={() => setEditingLead(null)}
          onSaved={handleSaved}
        />
      )}
      {bookingLead && (
        <AppointmentModal
          lead={bookingLead}
          waTemplate={waTemplate}
          waTemplateZh={waTemplateZh}
          address={kinderAddress}
          durationMinutes={apptDuration}
          onClose={() => setBookingLead(null)}
          onConfirm={(start, msg, isPlaceholder) => handleConfirmAppointment(bookingLead, start, msg, isPlaceholder)}
        />
      )}
      {followUpLead && (
        <FollowUpModal
          lead={followUpLead}
          waTemplate={followUpTemplate}
          waTemplateZh={followUpTemplateZh}
          address={kinderAddress}
          durationMinutes={apptDuration}
          onClose={() => setFollowUpLead(null)}
        />
      )}
      {enrolingLead && (
        <EnrolmentModal
          lead={enrolingLead}
          onClose={() => setEnrolingLead(null)}
          onEnrolled={() => { invalidateAll(); setEnrolingLead(null); }}
        />
      )}

      <div style={styles.statsRow}>
        {([
          { label: 'New',         key: 'NEW',                color: '#3182ce', bg: '#ebf8ff' },
          { label: 'Contacted',   key: 'CONTACTED',          color: '#6b46c1', bg: '#faf5ff' },
          { label: 'Appt Booked', key: 'APPOINTMENT_BOOKED', color: '#2f855a', bg: '#f0fff4' },
          { label: 'Follow Up',   key: 'FOLLOW_UP',          color: '#c05621', bg: '#fffaf0' },
        ] as { label: string; key: keyof typeof stats; color: string; bg: string }[]).map(({ label, key, color, bg }) => (
          <div
            key={key}
            onClick={() => handleFilterStatus(key as string)}
            style={{
              ...styles.statCard, background: bg, cursor: 'pointer',
              outline: filterStatus === key ? `2px solid ${color}` : 'none',
              outlineOffset: 2,
            }}
          >
            <div style={{ ...styles.statCount, color }}>{stats?.[key] ?? '—'}</div>
            <div style={styles.statLabel}>{label}</div>
          </div>
        ))}
      </div>

      <div style={styles.layout}>
        <div style={styles.main}>
          <div style={styles.toolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={styles.heading}>Leads</h1>
          <button
            onClick={handleExport}
            disabled={isExporting || !data || data.total === 0}
            style={{ padding: '5px 14px', fontSize: 13, fontWeight: 600, background: '#2f855a', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', opacity: isExporting || !data || data.total === 0 ? 0.5 : 1 }}
          >
            {isExporting ? 'Exporting…' : '↓ Export CSV'}
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={styles.filterRow}>
            {(['active', 'inactive', ''] as const).map((g) => (
              <button
                key={g || 'all'}
                onClick={() => handleFilterStatus(g)}
                style={filterStatus === g ? styles.filterBtnActive : styles.filterBtn}
              >
                {g === '' ? 'All' : g === 'active' ? 'Active' : 'Completed'}
              </button>
            ))}
          </div>
          {filterStatus === 'inactive' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#a0aec0', fontWeight: 600 }}>Show:</span>
              {([['', 'All'], ['ENROLLED', 'Enrolled'], ['LOST', 'Lost']] as const).map(([val, label]) => (
                <button
                  key={val || 'all-completed'}
                  onClick={() => { setCompletedSubFilter(val); setPage(1); }}
                  style={completedSubFilter === val ? subFilterBtnActiveStyle(val) : styles.subFilterBtn}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isLoading && <p style={styles.stateMsg}>Loading…</p>}
      {isError && (
        <p style={{ ...styles.stateMsg, color: '#e53e3e' }}>
          Error: {(error as Error).message}
        </p>
      )}

      {data && (
        <>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: 40 }}>#</th>
                  <th style={{ ...styles.th, cursor: 'pointer' }} onClick={() => handleSort('submittedAt')}>Submitted{sortIndicator('submittedAt')}</th>
                  <th style={{ ...styles.th, cursor: 'pointer' }} onClick={() => handleSort('childName')}>Child Name{sortIndicator('childName')}</th>
                  <th style={styles.th}>Class / Year</th>
                  <th style={styles.th}>Appointment</th>
                  <th style={{ ...styles.th, cursor: 'pointer' }} onClick={() => handleSort('status')}>Status{sortIndicator('status')}</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((lead: Lead, idx: number) => {
                  const result = rowResults[lead.id];
                  const rowNum = (page - 1) * pageSize + idx + 1;
                  const isHovered = hoveredRow === lead.id;

                  return (
                    <tr key={lead.id}
                      style={{ ...styles.tr, background: isHovered ? '#f0f4ff' : undefined }}
                      onMouseEnter={() => setHoveredRow(lead.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <td style={{ ...styles.td, color: '#a0aec0', fontSize: 12, textAlign: 'center', width: 40 }}>{rowNum}</td>
                      <td style={styles.td}>
                        {new Date(lead.submittedAt).toLocaleString('en-MY', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td style={styles.td}>{lead.childName}</td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span
                            title={new Date(lead.childDob).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
                            style={classAgeBadgeStyle(calcClassAge(lead.childDob, lead.enrolmentYear))}
                          >
                            Age {calcClassAge(lead.childDob, lead.enrolmentYear)}
                          </span>
                          <span style={enrolmentYearBadgeStyle(lead.enrolmentYear)}>{lead.enrolmentYear}</span>
                        </div>
                      </td>
                      <td style={{ ...styles.td, color: '#4a5568', fontSize: 13 }}>
                        {lead.appointmentStart
                          ? new Date(lead.appointmentStart).toLocaleString('en-MY', {
                              day: '2-digit', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit', hour12: true,
                            })
                          : <span style={{ color: '#cbd5e0' }}>—</span>}
                      </td>
                      <td style={styles.td}>
                        <span style={statusBadge(lead.status)}>{lead.status}</span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.actions}>
                          <button onClick={() => setEditingLead(lead)} style={styles.editBtn}>
                            <FontAwesomeIcon icon={faPenToSquare} style={{ marginRight: 5 }} />Edit
                          </button>

                          <a
                            href={`https://web.whatsapp.com/send?phone=${normalizePhone(lead.parentPhone)}`}
                            target="_blank"
                            rel="noreferrer"
                            style={styles.waBtn}
                          >
                            <FontAwesomeIcon icon={faComment} style={{ marginRight: 5 }} />WhatsApp
                          </a>

                          {(['NEW', 'CONTACTED', 'APPOINTMENT_BOOKED', 'FOLLOW_UP'] as LeadStatus[]).includes(lead.status) && (
                            <button
                              onClick={() => setBookingLead(lead)}
                              style={styles.apptBtn}
                            >
                              <FontAwesomeIcon icon={faCalendarPlus} style={{ marginRight: 5 }} />
                              {lead.status === 'NEW' ? 'Book Appt' : 'Reschedule Appt'}
                            </button>
                          )}

                          {lead.status === 'FOLLOW_UP' && (
                            <button
                              onClick={() => handleFollowUp(lead)}
                              style={styles.followUpActiveBtn}
                            >
                              <FontAwesomeIcon icon={faBell} style={{ marginRight: 5 }} />Follow Up
                            </button>
                          )}

                          {lead.status !== 'ENROLLED' && lead.status !== 'LOST' && (
                            <button
                              onClick={() => setEnrolingLead(lead)}
                              style={styles.enrolBtn}
                            >
                              Enrol
                            </button>
                          )}

                          {result?.error && (
                            <span style={styles.rowError}>{result.error}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={styles.paging}>
            <span style={styles.pageInfo}>{data.total} total</span>
            <div style={styles.pagingControls}>
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                style={styles.pageBtn}
                title="First page"
              >
                «
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={styles.pageBtn}
              >
                ‹ Prev
              </button>
              <span style={styles.pageChip}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={styles.pageBtn}
              >
                Next ›
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
                style={styles.pageBtn}
                title="Last page"
              >
                »
              </button>
            </div>
            <span style={styles.pageInfo} />
          </div>
          <div style={styles.pagingRowsRow}>
            <label style={styles.rowsLabel}>
              Rows per page:
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                style={styles.rowsSelect}
              >
                {[10, 20, 30, 50].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}
        </div>
        <div style={styles.sidebar}>
          <UpcomingPanel items={upcomingAppts} />
          <FollowUpPanel leads={followUpLeads} />
        </div>
      </div>
    </div>
  );
}


function statusBadge(status: Lead['status']): React.CSSProperties {
  const palette: Record<Lead['status'], { bg: string; color: string }> = {
    NEW:                { bg: '#dbeafe', color: '#1e40af' },
    CONTACTED:          { bg: '#fef3c7', color: '#92400e' },
    APPOINTMENT_BOOKED: { bg: '#a7f3d0', color: '#065f46' },
    FOLLOW_UP:          { bg: '#ffedd5', color: '#9a3412' },
    ENROLLED:           { bg: '#bbf7d0', color: '#14532d' },
    LOST:               { bg: '#fecaca', color: '#991b1b' },
  };
  const { bg, color } = palette[status] ?? { bg: '#e2e8f0', color: '#4a5568' };
  return {
    padding: '2px 8px',
    borderRadius: 12,
    background: bg,
    color,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  };
}

function subFilterBtnActiveStyle(val: string): React.CSSProperties {
  return {
    padding: '4px 10px', borderRadius: 12, cursor: 'pointer', fontSize: 11, fontWeight: 600,
    ...(val === 'ENROLLED'
      ? { background: '#276749', border: '1px solid #276749', color: '#fff' }
      : val === 'LOST'
      ? { background: '#c53030', border: '1px solid #c53030', color: '#fff' }
      : { background: '#2b6cb0', border: '1px solid #2b6cb0', color: '#fff' }),
  };
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '24px 32px', fontFamily: 'system-ui, sans-serif' },
  statsRow: { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
  statCard: {
    flex: '1 1 140px', padding: '16px 20px', borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  statCount: { fontSize: 32, fontWeight: 800, lineHeight: 1 },
  statLabel: { fontSize: 12, fontWeight: 600, color: '#718096', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' },
  toolbar: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  heading: { margin: 0, fontSize: 24 },
  filterRow: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  filterBtn: {
    padding: '5px 12px', background: '#edf2f7', border: '1px solid #e2e8f0',
    borderRadius: 16, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#4a5568',
  },
  filterBtnActive: {
    padding: '5px 12px', background: '#2b6cb0', border: '1px solid #2b6cb0',
    borderRadius: 16, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#fff',
  },
  subFilterBtn: {
    padding: '4px 10px', background: '#edf2f7', border: '1px solid #e2e8f0',
    borderRadius: 12, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#4a5568',
  },
  layout: { display: 'flex', gap: 20, alignItems: 'flex-start' },
  main: { flex: 1, minWidth: 0 },
  sidebar: {
    display: 'flex', flexDirection: 'column', gap: 12,
    width: 260, flexShrink: 0,
    position: 'sticky', top: 16, alignSelf: 'flex-start',
    maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
  },
  stateMsg: { fontSize: 16, color: '#4a5568' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 960 },
  th: {
    textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e2e8f0',
    background: '#f7fafc', fontWeight: 700, fontSize: 13, color: '#4a5568', whiteSpace: 'nowrap',
  },
  tr: { borderBottom: '1px solid #edf2f7' },
  td: { padding: '10px 12px', verticalAlign: 'middle', fontSize: 14 },
  actions: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  editBtn: {
    padding: '4px 10px', background: '#edf2f7', color: '#2d3748',
    border: '1px solid #e2e8f0', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  waBtn: {
    padding: '4px 10px', background: '#25D366', color: '#fff',
    borderRadius: 4, textDecoration: 'none', fontSize: 13, fontWeight: 600,
  },
  apptBtn: {
    padding: '4px 10px', background: '#4299e1', color: '#fff',
    border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13,
  },
  followUpActiveBtn: {
    padding: '4px 10px', background: '#ed8936', color: '#fff',
    border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  enrolBtn: {
    padding: '4px 10px', background: '#38a169', color: '#fff',
    border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  rowError: { color: '#e53e3e', fontSize: 12 },
  paging: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 20, flexWrap: 'wrap' },
  pagingControls: { display: 'flex', alignItems: 'center', gap: 4 },
  pageBtn: {
    padding: '5px 10px', background: '#fff', border: '1px solid #e2e8f0',
    borderRadius: 6, cursor: 'pointer', fontSize: 14, color: '#4a5568', fontWeight: 500,
    transition: 'background 0.15s',
  },
  pageChip: {
    padding: '5px 14px', background: '#ebf4ff', border: '1px solid #bee3f8',
    borderRadius: 6, fontSize: 13, fontWeight: 700, color: '#2b6cb0', whiteSpace: 'nowrap' as const,
  },
  pageInfo: { color: '#718096', fontSize: 13 },
  pagingRowsRow: { display: 'flex', justifyContent: 'center', marginTop: 8 },
  rowsLabel: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4a5568', fontWeight: 500 },
  rowsSelect: {
    padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6,
    fontSize: 13, color: '#2d3748', background: '#fff', cursor: 'pointer',
  },
};

const modal: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  card: {
    background: '#fff', borderRadius: 8, padding: 28, width: '100%',
    maxWidth: 560, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { margin: 0, fontSize: 18 },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#718096', lineHeight: 1 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600, color: '#2d3748' },
  input: {
    padding: '7px 10px', border: '1px solid #cbd5e0', borderRadius: 4,
    fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  cancelBtn: {
    padding: '8px 18px', background: '#edf2f7', border: '1px solid #e2e8f0',
    borderRadius: 4, cursor: 'pointer', fontSize: 14,
  },
  saveBtn: {
    padding: '8px 18px', background: '#4299e1', color: '#fff',
    border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 600,
  },
};

const apptModal: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  card: {
    background: '#fff', borderRadius: 10, padding: 28, width: '100%',
    maxWidth: 500, boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { margin: '0 0 4px', fontSize: 18 },
  subtitle: { margin: 0, fontSize: 13, color: '#718096' },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#718096', lineHeight: 1 },
  label: { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, fontWeight: 600, color: '#2d3748' },
  input: {
    padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6,
    fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  },
  error: { color: '#e53e3e', fontSize: 13, marginTop: 10, marginBottom: 0 },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 20 },
  waBtn: {
    padding: '9px 16px', background: '#25D366', color: '#fff',
    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600,
  },
  rescheduleBtn: {
    padding: '9px 20px', background: '#ed8936', color: '#fff',
    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 700,
  },
  confirmBtn: {
    padding: '9px 20px', background: '#2b6cb0', color: '#fff',
    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 700,
  },
  placeholderCheck: {
    display: 'flex', alignItems: 'center', gap: 8, marginTop: 10,
    fontSize: 13, color: '#4a5568', cursor: 'pointer', fontWeight: 600,
  },
};

const panel: Record<string, React.CSSProperties> = {
  container: {
    background: '#fff', border: '1px solid #e2e8f0',
    borderRadius: 8, padding: '16px 0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  heading: {
    margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#2d3748',
    padding: '0 16px', textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  empty: { padding: '0 16px', color: '#a0aec0', fontSize: 13 },
  group: { marginBottom: 12 },
  dateLabel: {
    padding: '6px 16px', background: '#ebf8ff', color: '#2b6cb0',
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  row: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '7px 16px', borderBottom: '1px solid #f7fafc',
  },
  name: { fontSize: 13, fontWeight: 600, color: '#2d3748' },
  time: { fontSize: 12, color: '#718096', whiteSpace: 'nowrap' as const },
  dateLabelToday: {
    padding: '6px 16px', background: '#fffaf0', color: '#c05621',
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
    borderLeft: '3px solid #ed8936',
  },
  rowToday: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '7px 16px', borderBottom: '1px solid #feebc8', background: '#fffaf0',
  },
  nameToday: { fontSize: 13, fontWeight: 700, color: '#c05621' },
  timeToday: { fontSize: 12, color: '#dd6b20', whiteSpace: 'nowrap' as const, fontWeight: 600 },
  phBadge: {
    display: 'inline-block', padding: '0 5px', marginRight: 4,
    background: '#6b46c1', color: '#fff', borderRadius: 4,
    fontSize: 10, fontWeight: 800, verticalAlign: 'middle', letterSpacing: '0.03em',
  },
};
