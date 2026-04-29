import { useState } from 'react';

// Reusable withdraw dialog. Mounted from both StudentsPage (row action)
// and EditStudentPage (Enrolments tab action). Parent owns the mutation;
// this component just collects date + reason and calls onConfirm.

export interface WithdrawDialogProps {
  studentName: string;
  /** Optional context line under the title — usually the package name. */
  context?: string | null;
  /** Called with the chosen date and trimmed reason. Parent should await
   *  its own mutation and rely on `submitting` to gate UI. */
  onConfirm: (args: { date: string; reason: string }) => void | Promise<void>;
  onCancel: () => void;
  /** Show the spinner / disable buttons while the mutation is in flight. */
  submitting?: boolean;
}

export default function WithdrawDialog({
  studentName, context, onConfirm, onCancel, submitting,
}: WithdrawDialogProps) {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');

  const valid = !!date;

  return (
    <div style={overlay}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <h3 style={titleStyle}>Withdraw Student</h3>
        <p style={subtitle}>
          <strong>{studentName}</strong>{context ? <> · {context}</> : null}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={label}>
            Withdrawal Date
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={input}
              required
              autoFocus
            />
          </label>
          <label style={label}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Reason <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span>
            </span>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              style={{ ...input, height: 72, resize: 'vertical' as const }}
              placeholder="e.g. moving overseas, financial reasons…"
            />
          </label>
        </div>
        <p style={{ margin: '14px 0 0', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
          The current enrolment closes on this date. Past months keep their
          original package and fee for revenue reporting.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" onClick={onCancel} style={cancelBtn} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { if (valid) onConfirm({ date, reason: reason.trim() }); }}
            disabled={!valid || submitting}
            style={{
              ...confirmBtn,
              opacity: !valid || submitting ? 0.6 : 1,
              cursor: !valid || submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Withdrawing…' : 'Confirm Withdraw'}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
};
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: '24px 28px', width: '100%', maxWidth: 480,
  boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
};
const titleStyle: React.CSSProperties = {
  margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a',
};
const subtitle: React.CSSProperties = {
  margin: '6px 0 18px', fontSize: 13, color: '#64748b',
};
const label: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155',
};
const input: React.CSSProperties = {
  padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
  fontSize: 13, color: '#1e293b', background: '#fff', width: '100%',
  boxSizing: 'border-box' as const, fontFamily: 'inherit', outline: 'none',
};
const cancelBtn: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0',
  background: '#fff', color: '#334155', cursor: 'pointer', fontWeight: 600, fontSize: 13,
};
const confirmBtn: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 8, border: 'none',
  background: '#dc2626', color: '#fff', fontWeight: 600, fontSize: 13,
};
