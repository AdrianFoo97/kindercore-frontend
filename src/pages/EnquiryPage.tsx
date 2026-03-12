import { useState } from 'react';
import { submitLead } from '../api/leads.js';

const ENROLMENT_YEARS = [2026, 2027, 2028, 2029, 2030, 2031];

const PROGRAMMES = [
  'Full day (8:30am–5:30pm)',
  'Half day (8:30am–2:30pm)',
  'Basic (8:30am–12:30pm)',
];

const APPOINTMENT_TIMES = ['Tuesday', 'Thursday', 'Saturday'];

const LOCATIONS = [
  'Bukit Indah',
  'Medini',
  'Iskandar Puteri',
  'Nusajaya',
  'Gelang Patah',
  'Permas Jaya',
  'Skudai',
  'Other',
];

const HOW_DID_YOU_KNOW = [
  'Facebook',
  'Instagram',
  'Google',
  'TikTok',
  'Word of mouth',
  'Flyer / Banner',
  'School event',
  'Other',
];

interface Form {
  childName: string;
  parentPhone: string;
  childDob: string;
  enrolmentYear: string;
  relationship: string;
  relationshipOther: string;
  programme: string;
  preferredAppointmentTime: string;
  appointmentTimeOther: string;
  addressLocation: string;
  addressLocationOther: string;
  needsTransport: string;
  howDidYouKnow: string;
  howDidYouKnowOther: string;
  company: string; // honeypot
}

const EMPTY: Form = {
  childName: '',
  parentPhone: '',
  childDob: '',
  enrolmentYear: '2026',
  relationship: '',
  relationshipOther: '',
  programme: '',
  preferredAppointmentTime: '',
  appointmentTimeOther: '',
  addressLocation: '',
  addressLocationOther: '',
  needsTransport: '',
  howDidYouKnow: '',
  howDidYouKnowOther: '',
  company: '',
};

function resolveOther(value: string, other: string) {
  return value === 'Other' ? (other.trim() || 'Other') : value;
}

export default function EnquiryPage() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const set = (field: keyof Form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const setRadio = (field: keyof Form, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await submitLead({
        childName: form.childName,
        parentPhone: form.parentPhone,
        childDob: form.childDob,
        enrolmentYear: Number(form.enrolmentYear),
        ...(form.company ? { company: form.company } : {}),
        relationship: resolveOther(form.relationship, form.relationshipOther) || undefined,
        programme: form.programme || undefined,
        preferredAppointmentTime: resolveOther(form.preferredAppointmentTime, form.appointmentTimeOther) || undefined,
        addressLocation: resolveOther(form.addressLocation, form.addressLocationOther) || undefined,
        needsTransport: form.needsTransport !== '' ? form.needsTransport === 'yes' : undefined,
        howDidYouKnow: resolveOther(form.howDidYouKnow, form.howDidYouKnowOther) || undefined,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.successTitle}>Thank you for your enquiry!</h2>
          <p style={styles.successText}>
            We've received your details and will be in touch with you shortly to arrange a school visit.
          </p>
          <button onClick={() => { setSubmitted(false); setForm(EMPTY); }} style={styles.submitBtn}>
            Submit another enquiry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoArea}>
          <span style={styles.logoIcon}>🏫</span>
          <h1 style={styles.schoolName}>Ten Toes Preschool</h1>
          <p style={styles.tagline}>Nurturing curious minds, one step at a time</p>
        </div>

        <div style={styles.divider} />

        <h2 style={styles.formTitle}>Book a School Visit</h2>
        <p style={styles.formSubtitle}>
          Fill in your details below and our team will reach out to schedule a personalised visit for your child.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Honeypot */}
          <input type="text" name="company" value={form.company} onChange={set('company')}
            style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />

          {/* Child's Name */}
          <Field label="Child's Name" required>
            <input style={styles.input} type="text" placeholder="e.g. Sophie"
              value={form.childName} onChange={set('childName')} required autoComplete="off" />
          </Field>

          {/* Contact Number */}
          <Field label="Your Contact No." required>
            <input style={styles.input} type="tel" placeholder="e.g. 012-345 6789"
              value={form.parentPhone} onChange={set('parentPhone')} required />
          </Field>

          {/* Child DOB */}
          <Field label="Child's Date of Birth" required>
            <input style={styles.input} type="date" value={form.childDob} onChange={set('childDob')}
              max={new Date().toISOString().split('T')[0]} min="2015-01-01" required />
          </Field>

          {/* Enrolment Year */}
          <Field label="Intended Enrolment Year" required>
            <select style={styles.input} value={form.enrolmentYear} onChange={set('enrolmentYear')} required>
              {ENROLMENT_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </Field>

          {/* Relationship */}
          <Field label="Your relationship with your child" required>
            <RadioGroup
              options={['Mother', 'Father', 'Other']}
              value={form.relationship}
              onChange={v => setRadio('relationship', v)}
              required
            />
            {form.relationship === 'Other' && (
              <input style={{ ...styles.input, marginTop: 6 }} type="text" placeholder="Please specify"
                value={form.relationshipOther} onChange={set('relationshipOther')} required />
            )}
          </Field>

          {/* Programme */}
          <Field label="Which programme are you interested in?" required>
            <RadioGroup
              options={PROGRAMMES}
              value={form.programme}
              onChange={v => setRadio('programme', v)}
              required
            />
          </Field>

          {/* Preferred Appointment Time */}
          <Field label="Your preferred appointment day" required>
            <RadioGroup
              options={[...APPOINTMENT_TIMES, 'Other']}
              value={form.preferredAppointmentTime}
              onChange={v => setRadio('preferredAppointmentTime', v)}
              required
            />
            {form.preferredAppointmentTime === 'Other' && (
              <input style={{ ...styles.input, marginTop: 6 }} type="text" placeholder="Please specify"
                value={form.appointmentTimeOther} onChange={set('appointmentTimeOther')} required />
            )}
          </Field>

          {/* Address Location */}
          <Field label="Your address location" required>
            <RadioGroup
              options={LOCATIONS}
              value={form.addressLocation}
              onChange={v => setRadio('addressLocation', v)}
              required
            />
            {form.addressLocation === 'Other' && (
              <input style={{ ...styles.input, marginTop: 6 }} type="text" placeholder="Please specify"
                value={form.addressLocationOther} onChange={set('addressLocationOther')} required />
            )}
          </Field>

          {/* Transport */}
          <Field label="Do you need transport service?" required>
            <RadioGroup
              options={['Yes', 'No']}
              value={form.needsTransport === 'yes' ? 'Yes' : form.needsTransport === 'no' ? 'No' : ''}
              onChange={v => setRadio('needsTransport', v === 'Yes' ? 'yes' : 'no')}
              required
            />
          </Field>

          {/* How did you know */}
          <Field label="How did you hear about us?" required>
            <RadioGroup
              options={HOW_DID_YOU_KNOW}
              value={form.howDidYouKnow}
              onChange={v => setRadio('howDidYouKnow', v)}
              required
            />
            {form.howDidYouKnow === 'Other' && (
              <input style={{ ...styles.input, marginTop: 6 }} type="text" placeholder="Please specify"
                value={form.howDidYouKnowOther} onChange={set('howDidYouKnowOther')} required />
            )}
          </Field>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" disabled={submitting} style={styles.submitBtn}>
            {submitting ? 'Submitting…' : 'Request a Visit →'}
          </button>
        </form>

        <p style={styles.footerNote}>We'll contact you via WhatsApp within 1 business day.</p>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={fieldStyles.wrap}>
      <div style={fieldStyles.label}>
        {label} {required && <span style={fieldStyles.req}>*</span>}
      </div>
      {children}
    </div>
  );
}

function RadioGroup({ options, value, onChange, required }: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div style={radioStyles.group}>
      {options.map(opt => (
        <label key={opt} style={radioStyles.label}>
          <input
            type="radio"
            name={opt}
            value={opt}
            checked={value === opt}
            onChange={() => onChange(opt)}
            required={required && !value}
            style={radioStyles.input}
          />
          {opt}
        </label>
      ))}
    </div>
  );
}

const fieldStyles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: '#2d3748' },
  req: { color: '#e53e3e', fontWeight: 400 },
};

const radioStyles: Record<string, React.CSSProperties> = {
  group: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#2d3748', cursor: 'pointer' },
  input: { accentColor: '#2b6cb0', width: 16, height: 16, flexShrink: 0 },
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #ebf8ff 0%, #e9d8fd 100%)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '32px 16px',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 480,
    boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
  },
  logoArea: { textAlign: 'center', marginBottom: 20 },
  logoIcon: { fontSize: 40, display: 'block', marginBottom: 8 },
  schoolName: { margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#2b6cb0', letterSpacing: '-0.5px' },
  tagline: { margin: 0, fontSize: 13, color: '#718096' },
  divider: { height: 1, background: '#e2e8f0', margin: '20px 0' },
  formTitle: { margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#1a202c' },
  formSubtitle: { margin: '0 0 20px', fontSize: 13, color: '#718096', lineHeight: 1.5 },
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  input: {
    padding: '10px 12px',
    border: '1.5px solid #e2e8f0',
    borderRadius: 6,
    fontSize: 14,
    fontFamily: 'inherit',
    color: '#2d3748',
    width: '100%',
    boxSizing: 'border-box',
  },
  error: {
    color: '#e53e3e', fontSize: 13, margin: 0,
    padding: '8px 12px', background: '#fff5f5',
    border: '1px solid #fed7d7', borderRadius: 6,
  },
  submitBtn: {
    padding: '12px', background: '#2b6cb0', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 15,
    fontWeight: 700, cursor: 'pointer', marginTop: 4, letterSpacing: '0.2px',
  },
  footerNote: { textAlign: 'center', fontSize: 12, color: '#a0aec0', marginTop: 20, marginBottom: 0 },
  successIcon: {
    width: 56, height: 56, borderRadius: '50%', background: '#c6f6d5',
    color: '#276749', fontSize: 26, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
  },
  successTitle: { textAlign: 'center', margin: '0 0 10px', fontSize: 20, color: '#1a202c' },
  successText: { textAlign: 'center', color: '#4a5568', fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' },
};
