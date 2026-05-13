import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faPen } from '@fortawesome/free-solid-svg-icons';
import { updateLead, UpdateLeadPayload } from '../../api/leads.js';
import { Lead, LeadStatus } from '../../types/index.js';
// Shared with the enquiry form + student-creation modal so the source
// dropdown stays consistent (adding a channel only happens in one file).
import { MARKETING_CHANNELS } from '../../constants/marketingChannels.js';

const currentYear = new Date().getFullYear();
const ENROLMENT_YEARS = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
const STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'APPOINTMENT_BOOKED', 'FOLLOW_UP', 'ENROLLED', 'LOST'];
const RELATIONSHIP_OPTIONS = ['Mother', 'Father', 'Guardian', 'Grandparent', 'Other'];
const PROGRAMME_OPTIONS = [
  { value: 'Core', label: '日常课程 Core' },
  { value: 'Core+Music', label: '日常+音乐 Core+Music' },
  { value: 'FullDay', label: 'Full Day 学习生活' },
];

function programmeLabel(val: string): string {
  return PROGRAMME_OPTIONS.find(p => p.value === val)?.label || val || '—';
}

function transportLabel(val: boolean | null): string {
  if (val === true || (val as unknown) === 1) return 'Yes';
  if (val === false || (val as unknown) === 0) return 'No';
  return '—';
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    NEW: 'New', CONTACTED: 'Contacted', APPOINTMENT_BOOKED: 'Appt Booked',
    FOLLOW_UP: 'Follow-Up', ENROLLED: 'Enrolled', LOST: 'Lost',
  };
  return map[s] || s;
}

// Friend Referral leads carry the referrer's child name inside `notes`
// in the shape `朋友介绍 — 朋友的孩子：{name}，请确认是否在 Bukit Indah 分校
// 就读以申请介绍优惠` (saved by the public enquiry form). The edit modal
// surfaces that name as a dedicated field so staff don't have to type the
// Chinese marker phrase by hand. Helpers below keep the textarea clean
// (without the phrase) while ensuring saves rebuild it correctly.
const REFERRAL_PHRASE_RE = /朋友介绍 — 朋友的孩子：[^，\n]*，请确认是否在 Bukit Indah 分校就读以申请介绍优惠\n?/g;

function extractReferrerNameFromNotes(notes: string): string {
  const m = notes.match(/朋友的孩子：\s*([^，,\n。]+)/);
  return m ? m[1].trim() : '';
}

function stripReferralPhrase(notes: string): string {
  return notes.replace(REFERRAL_PHRASE_RE, '').trim();
}

function rebuildNotesWithReferrer(notesBody: string, refName: string, isReferral: boolean): string {
  const body = notesBody.trim();
  if (!isReferral || !refName.trim()) return body;
  const phrase = `朋友介绍 — 朋友的孩子：${refName.trim()}，请确认是否在 Bukit Indah 分校就读以申请介绍优惠`;
  return body ? `${phrase}\n${body}` : phrase;
}

interface EditForm {
  childName: string; parentPhone: string; childDob: string;
  enrolmentYear: string; status: LeadStatus; notes: string; lostReason: string;
  relationship: string; programme: string; howDidYouKnow: string;
  addressLocation: string; needsTransport: string; preferredAppointmentTime: string;
  referrerName: string;
}

type ViewTab = 'child' | 'contact' | 'other';
const TABS: { key: ViewTab; label: string }[] = [
  { key: 'child', label: 'Child' },
  { key: 'contact', label: 'Contact' },
  { key: 'other', label: 'Other' },
];

export default function EditLeadModal({ lead, lostReasons, onClose, onSaved }: {
  lead: Lead; lostReasons: string[]; onClose: () => void; onSaved: (updated: Lead) => void;
}) {
  const [tab, setTab] = useState<ViewTab>('child');
  const [editing, setEditing] = useState(false);
  const initialNotesRaw = lead.notes ?? '';
  const [form, setForm] = useState<EditForm>({
    childName: lead.childName, parentPhone: lead.parentPhone,
    childDob: lead.childDob.split('T')[0], enrolmentYear: String(lead.enrolmentYear),
    status: lead.status, notes: stripReferralPhrase(initialNotesRaw), lostReason: lead.lostReason ?? '',
    relationship: lead.relationship ?? '', programme: lead.programme ?? '',
    howDidYouKnow: lead.howDidYouKnow ?? '', addressLocation: lead.addressLocation ?? '',
    needsTransport: lead.needsTransport === null ? '' : lead.needsTransport ? 'yes' : 'no',
    preferredAppointmentTime: lead.preferredAppointmentTime ?? '',
    referrerName: extractReferrerNameFromNotes(initialNotesRaw),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (field: keyof EditForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.status === 'LOST' && !form.lostReason) { setError('Please select a reason for marking this lead as Lost.'); return; }
    setSaving(true); setError('');
    try {
      const combinedNotes = rebuildNotesWithReferrer(
        form.notes,
        form.referrerName,
        form.howDidYouKnow === 'Friend Referral',
      );
      const payload: UpdateLeadPayload = {
        childName: form.childName, parentPhone: form.parentPhone, childDob: form.childDob,
        enrolmentYear: Number(form.enrolmentYear), status: form.status, notes: combinedNotes,
        lostReason: form.status === 'LOST' ? form.lostReason : null,
        relationship: form.relationship || null, programme: form.programme || null,
        howDidYouKnow: form.howDidYouKnow || null, addressLocation: form.addressLocation || null,
        needsTransport: form.needsTransport === '' ? null : form.needsTransport === 'yes',
        preferredAppointmentTime: form.preferredAppointmentTime || null,
      };
      const updated = await updateLead(lead.id, payload);
      onSaved(updated);
      setEditing(false);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleCancel = () => {
    const notesRaw = lead.notes ?? '';
    setForm({
      childName: lead.childName, parentPhone: lead.parentPhone,
      childDob: lead.childDob.split('T')[0], enrolmentYear: String(lead.enrolmentYear),
      status: lead.status, notes: stripReferralPhrase(notesRaw), lostReason: lead.lostReason ?? '',
      relationship: lead.relationship ?? '', programme: lead.programme ?? '',
      howDidYouKnow: lead.howDidYouKnow ?? '', addressLocation: lead.addressLocation ?? '',
      needsTransport: lead.needsTransport === null ? '' : lead.needsTransport ? 'yes' : 'no',
      preferredAppointmentTime: lead.preferredAppointmentTime ?? '',
      referrerName: extractReferrerNameFromNotes(notesRaw),
    });
    setEditing(false);
    setError('');
  };

  const BODY_HEIGHT = 280;

  // View-only row
  const ViewRow = ({ label, value }: { label: string; value: string }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 14, color: value && value !== '—' ? '#1e293b' : '#cbd5e1', fontWeight: 400 }}>{value || '—'}</span>
    </div>
  );

  return (
    <div style={mo.backdrop} onClick={onClose}>
      <div style={mo.card} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={mo.header}>
          <h2 style={mo.title}>{lead.childName}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!editing && (
              <button onClick={() => setEditing(true)} style={{ ...mo.editBtn }}>
                <FontAwesomeIcon icon={faPen} style={{ fontSize: 11, marginRight: 5 }} />Edit
              </button>
            )}
            <button onClick={onClose} style={mo.closeBtn}><FontAwesomeIcon icon={faXmark} /></button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e2e8f0', marginBottom: 16 }}>
          {TABS.map(t => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} style={{
              padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: 'none', border: 'none', borderBottom: tab === t.key ? '2px solid #5a79c8' : '2px solid transparent',
              color: tab === t.key ? '#5a79c8' : '#94a3b8', transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
        </div>

        <form onSubmit={handleSave}>
          <div style={{ minHeight: BODY_HEIGHT }}>

            {/* ── Child Tab ── */}
            {tab === 'child' && !editing && (
              <div style={mo.viewGrid}>
                <ViewRow label="Child Name" value={lead.childName} />
                <ViewRow label="Date of Birth" value={new Date(lead.childDob).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} />
                <ViewRow label="Enrollment Year" value={String(lead.enrolmentYear)} />
                <ViewRow label="Programme" value={programmeLabel(lead.programme ?? '')} />
              </div>
            )}
            {tab === 'child' && editing && (
              <div style={mo.grid}>
                <label style={mo.label}>Child Name<input style={mo.input} value={form.childName} onChange={set('childName')} required /></label>
                <label style={mo.label}>Date of Birth<input style={mo.input} type="date" value={form.childDob} onChange={set('childDob')} max={new Date().toISOString().split('T')[0]} required /></label>
                <label style={mo.label}>Enrollment Year
                  <select style={mo.input} value={form.enrolmentYear} onChange={set('enrolmentYear')}>
                    {ENROLMENT_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </label>
                <label style={mo.label}>Programme
                  <input style={mo.input} value={form.programme} onChange={set('programme')} placeholder="e.g. Core, FullDay" />
                </label>
              </div>
            )}

            {/* ── Contact Tab ── */}
            {tab === 'contact' && !editing && (
              <div style={mo.viewGrid}>
                <ViewRow label="Parent Phone" value={lead.parentPhone} />
                <ViewRow label="Relationship" value={lead.relationship || '—'} />
                <ViewRow label="Address / Location" value={lead.addressLocation || '—'} />
                <ViewRow label="Needs Transport" value={transportLabel(lead.needsTransport)} />
              </div>
            )}
            {tab === 'contact' && editing && (
              <div style={mo.grid}>
                <label style={mo.label}>Parent Phone<input style={mo.input} value={form.parentPhone} onChange={set('parentPhone')} required /></label>
                <label style={mo.label}>Relationship
                  <select style={mo.input} value={form.relationship} onChange={set('relationship')}>
                    <option value="">—</option>
                    {RELATIONSHIP_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                <label style={mo.label}>Address / Location<input style={mo.input} value={form.addressLocation} onChange={set('addressLocation')} placeholder="e.g. Bukit Indah" /></label>
                <label style={mo.label}>Needs Transport
                  <select style={mo.input} value={form.needsTransport} onChange={set('needsTransport')}>
                    <option value="">—</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
              </div>
            )}

            {/* ── Other Tab ── */}
            {tab === 'other' && !editing && (() => {
              const cleanNotes = stripReferralPhrase(lead.notes ?? '');
              const refName = extractReferrerNameFromNotes(lead.notes ?? '');
              const isReferral = lead.howDidYouKnow === 'Friend Referral';
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={mo.viewGrid}>
                    <ViewRow label="How Did You Know?" value={lead.howDidYouKnow || '—'} />
                    {isReferral && <ViewRow label="Referrer's Child" value={refName || '—'} />}
                    <ViewRow label="Preferred Visit Time" value={lead.preferredAppointmentTime || '—'} />
                    <ViewRow label="Status" value={statusLabel(lead.status)} />
                    {lead.status === 'LOST' && <ViewRow label="Lost Reason" value={lead.lostReason || '—'} />}
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>Notes</span>
                    <p style={{ fontSize: 14, color: cleanNotes ? '#1e293b' : '#cbd5e1', margin: '2px 0 0', lineHeight: 1.5 }}>
                      {cleanNotes || '—'}
                    </p>
                  </div>
                </div>
              );
            })()}
            {tab === 'other' && editing && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={mo.grid}>
                  <label style={mo.label}>How Did You Know?
                    <select style={mo.input} value={form.howDidYouKnow} onChange={set('howDidYouKnow')}>
                      <option value="">—</option>
                      {MARKETING_CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </label>
                  {form.howDidYouKnow === 'Friend Referral' && (
                    <label style={mo.label}>
                      Referrer's Child Name
                      <input style={mo.input} value={form.referrerName} onChange={set('referrerName')} placeholder="e.g. Tommy" />
                    </label>
                  )}
                  <label style={mo.label}>Preferred Visit Time<input style={mo.input} value={form.preferredAppointmentTime} onChange={set('preferredAppointmentTime')} placeholder="e.g. Weekday afternoon" /></label>
                  <label style={mo.label}>Status
                    <select style={mo.input} value={form.status} onChange={set('status')}>
                      {STATUSES.filter(s => s !== 'ENROLLED' || lead.status === 'ENROLLED').map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  {form.status === 'LOST' && (
                    <label style={mo.label}>
                      <span>Lost Reason <span style={{ color: '#e53e3e' }}>*</span></span>
                      <select style={mo.input} value={form.lostReason} onChange={set('lostReason')} required>
                        <option value="">— select reason —</option>
                        {lostReasons.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </label>
                  )}
                </div>
                <label style={mo.label}>
                  Notes
                  <textarea style={{ ...mo.input, height: 60, resize: 'vertical' }} value={form.notes} onChange={set('notes')} placeholder="Optional notes..." />
                </label>
              </div>
            )}
          </div>

          {error && <p style={{ color: '#e53e3e', fontSize: 13, marginTop: 8 }}>{error}</p>}

          {/* Footer */}
          {editing && (
            <div style={mo.footer}>
              <button type="button" onClick={handleCancel} style={mo.cancelBtn}>Cancel</button>
              <button type="submit" disabled={saving} style={mo.saveBtn}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

const mo: Record<string, React.CSSProperties> = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 },
  card: { background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxWidth: 600, maxHeight: '85vh', overflowY: 'auto' as const, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', boxSizing: 'border-box' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { margin: 0, fontSize: 18 },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#718096', lineHeight: 1 },
  editBtn: { padding: '5px 12px', fontSize: 12, fontWeight: 600, color: '#5a79c8', background: '#eef2fa', border: '1px solid #c7d2e8', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  viewGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600, color: '#2d3748' },
  input: { padding: '7px 10px', border: '1px solid #cbd5e0', borderRadius: 4, fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  cancelBtn: { padding: '8px 18px', background: '#edf2f7', border: '1px solid #e2e8f0', borderRadius: 4, cursor: 'pointer', fontSize: 14 },
  saveBtn: { padding: '8px 18px', background: '#4299e1', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
};
