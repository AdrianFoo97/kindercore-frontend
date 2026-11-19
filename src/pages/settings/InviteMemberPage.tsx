import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faChevronLeft, faCircleCheck, faCopy } from '@fortawesome/free-solid-svg-icons';
import { apiFetch } from '../../api/client.js';
import { fetchAuthRoleCatalog, fetchAuthRoles } from '../../api/auth-roles.js';
import { ALL_MODULE_KEYS } from '../../constants/authModules.js';
import ConfirmDialog from '../../components/common/ConfirmDialog.js';
import { useGoBack } from '../../hooks/useGoBack.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import AccessRolesPicker from './AccessRolesPicker.js';
import AccessSummary from './AccessSummary.js';
import { combinedFunctions, combinedModules } from './accessRoleForm.js';
import { inviteEmailProblem } from './inviteForm.js';

// Settings → Team members → Invite (/settings/users/invite). Same shape as
// Edit access: who and what on the left, the live access summary with
// "Send invite" on the right. After sending: the result and the invite link.

type AccountType = 'USER' | 'ADMIN';
interface InviteResult { email: string; inviteLink: string; emailSent: boolean }

const C = {
  text: '#1a1f36', sub: '#3c4257', muted: '#697386', border: '#e3e8ee', accent: '#5a67d8',
  accentSoft: '#eef2ff', danger: '#b91c1c', ok: '#15803d',
};
const BACK_TO = '/settings/users';
const ACCOUNT_TYPES: { key: AccountType; label: string; about: string }[] = [
  { key: 'USER', label: 'Team member', about: 'Opens what their roles allow.' },
  { key: 'ADMIN', label: 'Admin', about: 'Opens everything, including Settings.' },
];

export default function InviteMemberPage() {
  const goBack = useGoBack(BACK_TO);
  const { isMobile } = useIsMobile();
  const qc = useQueryClient();
  const { data: roles = [] } = useQuery({ queryKey: ['auth-roles'], queryFn: fetchAuthRoles });
  const { data: catalog } = useQuery({ queryKey: ['auth-role-catalog'], queryFn: fetchAuthRoleCatalog });

  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>('USER');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<InviteResult | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const problem = inviteEmailProblem(email);
  const started = email.trim() !== '' || roleIds.length > 0 || accountType !== 'USER';
  const isAdmin = accountType === 'ADMIN';
  const functionLabel = new Map((catalog?.functions ?? []).map(f => [f.key, f.label]));

  const leave = () => (started && !result ? setConfirmLeave(true) : goBack());
  const reset = () => { setEmail(''); setTouched(false); setAccountType('USER'); setRoleIds([]); setError(''); setResult(null); };

  const send = async () => {
    setTouched(true);
    if (problem || sending) return;
    setSending(true);
    setError('');
    try {
      const cleanEmail = email.trim().toLowerCase();
      const r = await apiFetch<{ inviteLink: string; emailSent: boolean }>('/api/auth/invite', {
        method: 'POST', body: JSON.stringify({ email: cleanEmail, role: accountType, authRoleIds: isAdmin ? [] : roleIds }),
      });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['auth-roles'] });
      setResult({ email: cleanEmail, inviteLink: r.inviteLink, emailSent: r.emailSent });
    } catch (e: any) {
      setError(e?.message ?? 'Couldn’t send the invite.');
    } finally {
      setSending(false);
    }
  };

  if (result) return <InviteSent result={result} onAnother={reset} onDone={goBack} />;

  const actions = (
    <div>
      {error && <div role="alert" style={{ fontSize: 13, color: C.danger, marginBottom: 12 }}>{error}</div>}
      {!error && <div role="status" style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>{problem ?? 'Ready to send.'}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={leave} disabled={sending} style={{ ...s.secondary, cursor: sending ? 'default' : 'pointer' }}>Cancel</button>
        <button type="button" onClick={send} disabled={!!problem || sending}
          style={{ ...s.primary, opacity: problem || sending ? 0.5 : 1, cursor: problem || sending ? 'default' : 'pointer' }}>
          {sending ? 'Sending…' : 'Send invite'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="m-pad">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        {!isMobile && (
          <button type="button" onClick={leave} aria-label="Back to team members" title="Back" style={s.back}>
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
        )}
        <h1 style={{ margin: 0 }}>Invite team member</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 320px', gap: 24, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <section style={s.section}>
            <label htmlFor="invite-email" style={s.label}>Email address</label>
            <p style={s.hint}>They’ll get a link to set their name and password.</p>
            <input id="invite-email" type="email" autoFocus value={email} placeholder="name@example.com"
              onChange={e => setEmail(e.target.value)} onBlur={() => setTouched(true)}
              onKeyDown={e => { if (e.key === 'Enter') send(); }}
              aria-invalid={touched && !!problem} aria-describedby="invite-email-problem" style={s.input} />
            {touched && problem && email.trim() && (
              <p id="invite-email-problem" style={{ ...s.hint, color: C.danger, margin: '8px 0 0' }}>{problem}</p>
            )}

            <div style={{ ...s.label, marginTop: 24 }} id="account-type-label">Account type</div>
            <div role="radiogroup" aria-labelledby="account-type-label" style={s.typeRow}>
              {ACCOUNT_TYPES.map(t => {
                const on = accountType === t.key;
                return (
                  <label key={t.key} style={{ ...s.typeCard, borderColor: on ? C.accent : C.border, background: on ? C.accentSoft : '#fff' }}>
                    <input type="radio" name="account-type" checked={on} onChange={() => setAccountType(t.key)}
                      style={{ accentColor: C.accent, margin: '2px 0 0', width: 16, height: 16, flexShrink: 0 }} />
                    <span>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.text }}>{t.label}</span>
                      <span style={{ display: 'block', fontSize: 13, color: C.muted, marginTop: 2 }}>{t.about}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          {!isAdmin && (
            <section style={s.section}>
              <label htmlFor="invite-roles" style={s.label}>Roles</label>
              <p style={s.hint}>Choose all that apply. Once they’ve joined, link them to their staff record on Edit access — its position may add a role.</p>
              <AccessRolesPicker id="invite-roles" roles={roles} value={roleIds} onChange={setRoleIds} scroll={false} showSummary={false} />
            </section>
          )}
        </div>

        <aside style={isMobile ? s.section : { ...s.section, position: 'sticky', top: 16 }} aria-label="Access summary">
          <AccessSummary
            roleNames={roleIds.map(r => roles.find(x => x.id === r)?.name).filter((n): n is string => !!n)}
            modules={combinedModules(roles, roleIds, ALL_MODULE_KEYS)}
            includes={catalog?.moduleIncludes ?? {}}
            functions={combinedFunctions(roles, roleIds).map(k => functionLabel.get(k) ?? k)}
            isAdmin={isAdmin}
          />
          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 16, paddingTop: 16 }}>{actions}</div>
        </aside>
      </div>

      {isMobile && !problem && (
        <>
          <div style={{ height: 72 }} aria-hidden />
          <div style={s.mobileBar}>
            <span style={{ fontSize: 13, color: C.muted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.trim()}</span>
            <button type="button" onClick={send} disabled={sending}
              style={{ ...s.primary, minHeight: 44, opacity: sending ? 0.5 : 1, cursor: sending ? 'default' : 'pointer' }}>
              {sending ? 'Sending…' : 'Send invite'}
            </button>
          </div>
        </>
      )}

      {confirmLeave && (
        <ConfirmDialog
          title="Discard this invite?"
          message="Nothing has been sent yet. What you’ve filled in won’t be kept."
          confirmLabel="Discard"
          destructive
          onConfirm={() => { setConfirmLeave(false); goBack(); }}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </div>
  );
}

/** After sending: whether the email went out, the link to share, and what next. */
function InviteSent({ result, onAnother, onDone }: { result: InviteResult; onAnother: () => void; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(result.inviteLink); setCopied(true); } catch { /* clipboard blocked */ }
  };
  return (
    <div className="m-pad">
      <section style={{ ...s.section, maxWidth: 560 }}>
        <FontAwesomeIcon icon={faCircleCheck} style={{ color: C.ok, fontSize: 28 }} />
        <h1 style={{ margin: '16px 0 4px' }}>{result.emailSent ? 'Invite sent' : 'Invite created'}</h1>
        <p style={{ ...s.hint, fontSize: 14 }}>
          {result.emailSent
            ? <>We emailed <strong style={{ color: C.sub }}>{result.email}</strong> a link to join. It works for 7 days.</>
            : <>The email couldn’t be sent, so share this link with <strong style={{ color: C.sub }}>{result.email}</strong> yourself. It works for 7 days.</>}
        </p>
        <label htmlFor="invite-link" style={{ ...s.label, fontSize: 13 }}>Invite link</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input id="invite-link" readOnly value={result.inviteLink} onFocus={e => e.target.select()} style={{ ...s.input, flex: 1, color: C.sub }} />
          <button type="button" onClick={copy} style={{ ...s.secondary, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <FontAwesomeIcon icon={copied ? faCheck : faCopy} /> {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 24, flexWrap: 'wrap' }}>
          <button type="button" onClick={onDone} style={{ ...s.primary, cursor: 'pointer' }}>Back to team members</button>
          <button type="button" onClick={onAnother} style={{ ...s.secondary, cursor: 'pointer' }}>Invite someone else</button>
        </div>
      </section>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  back: { width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.muted, cursor: 'pointer', flexShrink: 0 },
  section: { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, marginBottom: 16 },
  label: { display: 'block', fontSize: 15, fontWeight: 600, color: C.text },
  hint: { margin: '4px 0 16px', fontSize: 13, color: C.muted, lineHeight: 1.5 },
  input: { width: '100%', maxWidth: 400, minHeight: 40, padding: '0 12px', borderRadius: 8, fontSize: 14, background: '#fff', color: C.text, boxSizing: 'border-box', fontFamily: 'inherit' },
  typeRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginTop: 8 },
  typeCard: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16, border: '1px solid', borderRadius: 8, cursor: 'pointer' },
  secondary: { minHeight: 36, padding: '0 16px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.sub, fontSize: 14, fontWeight: 600, fontFamily: 'inherit' },
  primary: { minHeight: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' },
  mobileBar: {
    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50, display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: '#fff',
    borderTop: `1px solid ${C.border}`, boxShadow: '0 -4px 16px rgba(15,23,42,0.06)',
  },
};
