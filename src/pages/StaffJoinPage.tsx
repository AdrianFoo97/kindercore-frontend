import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faIdCard } from '@fortawesome/free-solid-svg-icons';
import { submitStaffJoin, type StaffJoinInput } from '../api/staffJoins.js';
import { isGmail, joinFormProblem } from './staffJoins/joinFormProblem.js';

// Public "New staff" form (/join) — for people joining the team who didn't
// apply through the job application form. HR reviews it under HR → New Staff.

const C = {
  bg: '#f8fafc', card: '#ffffff', text: '#0f172a', muted: '#64748b', border: '#e2e8f0',
  primary: '#4f46e5', danger: '#dc2626', success: '#16a34a', warning: '#b45309',
};

const EMPTY: StaffJoinInput = { fullName: '', phone: '', dob: '', email: '', note: '', company: '' };

export default function StaffJoinPage() {
  const [draft, setDraft] = useState<StaffJoinInput>(EMPTY);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const set = <K extends keyof StaffJoinInput>(k: K, v: StaffJoinInput[K]) => setDraft(d => ({ ...d, [k]: v }));
  const showGmailNudge = draft.email.includes('@') && !isGmail(draft.email);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = joinFormProblem(draft, new Date().toISOString().slice(0, 10));
    if (problem) { setError(problem); return; }
    setSending(true); setError('');
    try {
      await submitStaffJoin({ ...draft, fullName: draft.fullName.trim(), phone: draft.phone.trim(), email: draft.email.trim(), note: draft.note?.trim() || undefined });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div style={s.page}>
        <div style={{ ...s.card, textAlign: 'center' }}>
          <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 40, color: C.success, marginBottom: 12 }} />
          <h1 style={s.title}>Thank you!</h1>
          <p style={s.sub}>We've received your details. HR will check them and add you to the team.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <form style={s.card} onSubmit={submit} noValidate>
        <div style={s.badge}><FontAwesomeIcon icon={faIdCard} /></div>
        <h1 style={s.title}>New staff details</h1>
        <p style={s.sub}>Joining our team? Fill this in so HR can set up your staff record.</p>

        <Field label="Full name (as in IC)" required>
          <input style={s.input} value={draft.fullName} onChange={e => set('fullName', e.target.value)} autoComplete="name" />
        </Field>
        <Field label="Phone number" required>
          <input style={s.input} value={draft.phone} onChange={e => set('phone', e.target.value)} inputMode="tel" autoComplete="tel" placeholder="012-345 6789" />
        </Field>
        <Field label="Date of birth" required>
          <input style={s.input} type="date" value={draft.dob} onChange={e => set('dob', e.target.value)} />
        </Field>
        <Field label="Email" required>
          <input style={s.input} type="email" value={draft.email} onChange={e => set('email', e.target.value)} autoComplete="email" placeholder="yourname@gmail.com" />
          <span style={s.hint(showGmailNudge)}>
            {showGmailNudge
              ? 'A Gmail address is preferred — you\'ll use it to sign in to the staff app. This one is fine if you don\'t have Gmail.'
              : 'Gmail preferred — you\'ll use it to sign in to the staff app.'}
          </span>
        </Field>
        <Field label="Anything HR should know? (optional)">
          <textarea style={{ ...s.input, minHeight: 72, resize: 'vertical' }} value={draft.note} onChange={e => set('note', e.target.value)} maxLength={2000} />
        </Field>

        {/* Honeypot — hidden from people, filled by bots. */}
        <input tabIndex={-1} autoComplete="off" aria-hidden value={draft.company} onChange={e => set('company', e.target.value)}
          style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />

        {error && <div role="alert" style={s.error}>{error}</div>}
        <button type="submit" disabled={sending} style={s.submit(sending)}>{sending ? 'Sending…' : 'Send my details'}</button>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>
        {label}{required && <span style={{ color: C.danger }}> *</span>}
      </span>
      {children}
    </label>
  );
}

const s = {
  page: { minHeight: '100vh', background: C.bg, display: 'flex', justifyContent: 'center', padding: '32px 16px', fontFamily: 'system-ui, -apple-system, sans-serif' } as React.CSSProperties,
  card: { position: 'relative', width: '100%', maxWidth: 480, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '28px 22px', alignSelf: 'flex-start' } as React.CSSProperties,
  badge: { width: 44, height: 44, borderRadius: 12, background: '#eef2ff', color: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 14 } as React.CSSProperties,
  title: { fontSize: 22, fontWeight: 800, color: C.text, margin: '0 0 6px' } as React.CSSProperties,
  sub: { fontSize: 14, color: C.muted, margin: '0 0 22px', lineHeight: 1.5 } as React.CSSProperties,
  input: { width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 15, borderRadius: 8, border: `1px solid ${C.border}`, fontFamily: 'inherit', color: C.text, background: '#fff' } as React.CSSProperties,
  hint: (nudge: boolean): React.CSSProperties => ({
    display: 'block', marginTop: 6, fontSize: 12, lineHeight: 1.4, color: nudge ? C.warning : C.muted,
  }),
  error: { background: '#fef2f2', color: C.danger, border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 14 } as React.CSSProperties,
  submit: (busy: boolean): React.CSSProperties => ({
    width: '100%', padding: '12px 16px', fontSize: 15, fontWeight: 700, borderRadius: 10, border: 'none', fontFamily: 'inherit',
    background: busy ? '#a5b4fc' : C.primary, color: '#fff', cursor: busy ? 'default' : 'pointer',
  }),
};
