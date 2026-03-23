import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { apiFetch } from '../api/client.js';

// ─────────────────────────────────────────────────────────────────────────────
// Password requirements
// ─────────────────────────────────────────────────────────────────────────────

const PW_RULES = [
  { key: 'length', label: 'At least 8 characters', test: (v: string) => v.length >= 8 },
  { key: 'upper', label: 'One uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { key: 'lower', label: 'One lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { key: 'number', label: 'One number', test: (v: string) => /\d/.test(v) },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const LockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

const AlertIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const CheckIcon = ({ color = 'currentColor' }: { color?: string }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const Spinner = ({ color = 'white' }: { color?: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: 'kc-spin 0.75s linear infinite', flexShrink: 0 }}>
    <circle cx="8" cy="8" r="6" stroke={color === 'white' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)'} strokeWidth="2.5" />
    <path d="M8 2a6 6 0 016 6" stroke={color === 'white' ? 'white' : '#374151'} strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Field component (matches login page)
// ─────────────────────────────────────────────────────────────────────────────

function Field({ id, label, type, value, onChange, onBlur, error, placeholder, autoComplete, disabled, readOnly, suffix }: {
  id: string; label: string; type: string; value: string;
  onChange: (v: string) => void; onBlur: () => void; error: string;
  placeholder?: string; autoComplete?: string; disabled?: boolean; readOnly?: boolean;
  suffix?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const hasError = !!error;
  const borderColor = hasError ? '#dc2626' : focused ? '#1d4ed8' : '#d1d5db';
  const boxShadow = hasError && focused ? '0 0 0 3px rgba(220,38,38,0.12)' : focused ? '0 0 0 3px rgba(29,78,216,0.12)' : 'none';

  return (
    <div style={{ marginBottom: 20 }}>
      <label htmlFor={id} style={S.label}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          id={id} type={type} value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur(); }}
          placeholder={placeholder} autoComplete={autoComplete}
          disabled={disabled} readOnly={readOnly}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${id}-err` : undefined}
          style={{
            ...S.input, borderColor, boxShadow,
            paddingRight: suffix ? 46 : 14,
            background: readOnly ? '#f9fafb' : disabled ? '#f9fafb' : '#fff',
            color: readOnly ? '#6b7280' : disabled ? '#9ca3af' : '#0f172a',
            cursor: readOnly ? 'default' : undefined,
          }}
        />
        {suffix && <div style={S.inputSuffix}>{suffix}</div>}
      </div>
      {hasError && <p id={`${id}-err`} role="alert" style={S.fieldError}>{error}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Password strength indicator
// ─────────────────────────────────────────────────────────────────────────────

function PasswordRequirements({ password, visible }: { password: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <div style={{ marginTop: -12, marginBottom: 16, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
        {PW_RULES.map(rule => {
          const pass = rule.test(password);
          return (
            <div key={rule.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: pass ? '#16a34a' : '#94a3b8', fontWeight: 500, transition: 'color 0.2s' }}>
              <CheckIcon color={pass ? '#16a34a' : '#cbd5e1'} />
              <span style={{ textDecoration: pass ? undefined : undefined }}>{rule.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

type PageState = 'loading' | 'ready' | 'expired' | 'used' | 'invalid' | 'success';

export default function SetupAccountPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('token') ?? '';

  // Page state
  const [pageState, setPageState] = useState<PageState>('loading');
  const [inviteEmail, setInviteEmail] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // Touched state
  const [touched, setTouched] = useState({ name: false, password: false, confirm: false });

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Verify invite token on mount
  useEffect(() => {
    if (!inviteToken) { setPageState('invalid'); return; }
    apiFetch<{ email: string; role: string }>(`/api/auth/invite/${inviteToken}`)
      .then(data => { setInviteEmail(data.email); setPageState('ready'); })
      .catch((err: any) => {
        if (err?.status === 410) {
          setPageState(err.message?.includes('expired') ? 'expired' : 'used');
        } else {
          setPageState('invalid');
        }
      });
  }, [inviteToken]);

  // Validation
  const nameError = touched.name && !name.trim() ? 'Please enter your full name.' : '';
  const allPwRulesPass = PW_RULES.every(r => r.test(password));
  const passwordError = touched.password && !allPwRulesPass ? 'Password does not meet requirements.' : '';
  const confirmError = touched.confirm && password !== confirmPassword ? 'Passwords do not match.' : '';
  const isFormValid = !!name.trim() && allPwRulesPass && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, password: true, confirm: true });
    if (!isFormValid) return;

    setSubmitError('');
    setIsSubmitting(true);
    try {
      const data = await apiFetch<{ token: string; user: { id: string; email: string; name: string; role: string } }>('/api/auth/activate', {
        method: 'POST',
        body: JSON.stringify({ token: inviteToken, name: name.trim(), password }),
      });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setPageState('success');
      setTimeout(() => navigate('/leads'), 2000);
    } catch (err: any) {
      setSubmitError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render states ─────────────────────────────────────────────────────────

  const renderContent = () => {
    if (pageState === 'loading') {
      return (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spinner color="gray" />
          <p style={{ marginTop: 16, fontSize: 14, color: '#64748b' }}>Verifying your invite...</p>
        </div>
      );
    }

    if (pageState === 'invalid' || pageState === 'expired' || pageState === 'used') {
      const messages = {
        invalid: { title: 'Invalid invite link', desc: 'This link is not valid. Please ask your administrator for a new invite.' },
        expired: { title: 'Invite expired', desc: 'This invite link has expired. Please ask your administrator to send a new one.' },
        used: { title: 'Already activated', desc: 'This invite has already been used. You can sign in with your credentials.' },
      };
      const m = messages[pageState];
      return (
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: pageState === 'used' ? '#dbeafe' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            {pageState === 'used' ? <CheckIcon color="#1d4ed8" /> : <AlertIcon />}
          </div>
          <h2 style={S.formTitle}>{m.title}</h2>
          <p style={{ ...S.formSubtitle, marginBottom: 28 }}>{m.desc}</p>
          <Link to="/login" style={{ color: '#1d4ed8', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            Go to sign in
          </Link>
        </div>
      );
    }

    if (pageState === 'success') {
      return (
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', transition: 'transform 0.3s ease', transform: 'scale(1)' }}>
            <CheckIcon color="#16a34a" />
          </div>
          <h2 style={S.formTitle}>Account created</h2>
          <p style={{ ...S.formSubtitle, marginBottom: 8 }}>Your account is ready. Redirecting to the dashboard...</p>
          <div style={{ marginTop: 16 }}><Spinner color="gray" /></div>
        </div>
      );
    }

    // ── Ready state: show form ─────────────────────────────────────────────
    return (
      <>
        <div style={S.formHeader}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 24 }}>
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
              <rect width="30" height="30" rx="8" fill="#1d4ed8" />
              <text x="15" y="21" textAnchor="middle" fill="white" fontSize="17" fontWeight="800">K</text>
            </svg>
            <span style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>KinderTech</span>
          </div>
          <h2 style={S.formTitle}>Set up your account</h2>
          <p style={S.formSubtitle}>You've been invited to access the admin portal. Complete your account setup below.</p>
        </div>

        {submitError && (
          <div role="alert" style={S.authErrorBanner}>
            <AlertIcon />
            <span>{submitError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <Field
            id="setup-name" label="Full name" type="text" value={name}
            onChange={v => { setName(v); if (submitError) setSubmitError(''); }}
            onBlur={() => setTouched(t => ({ ...t, name: true }))}
            error={nameError} placeholder="Your full name" autoComplete="name" disabled={isSubmitting}
          />

          <Field
            id="setup-email" label="Work email" type="email" value={inviteEmail}
            onChange={() => {}} onBlur={() => {}} error="" readOnly
            autoComplete="email"
          />

          <div onFocus={() => setPasswordFocused(true)} onBlur={() => setPasswordFocused(false)}>
          <Field
            id="setup-password" label="Password" type={showPassword ? 'text' : 'password'} value={password}
            onChange={v => { setPassword(v); if (submitError) setSubmitError(''); }}
            onBlur={() => { setTouched(t => ({ ...t, password: true })); }}
            error={passwordError} placeholder="Create a password" autoComplete="new-password" disabled={isSubmitting}
            suffix={
              <button type="button" onClick={() => setShowPassword(s => !s)} style={S.eyeBtn} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            }
          />

          </div>
          <PasswordRequirements password={password} visible={passwordFocused || (touched.password && !allPwRulesPass)} />

          <Field
            id="setup-confirm" label="Confirm password" type={showConfirm ? 'text' : 'password'} value={confirmPassword}
            onChange={v => { setConfirmPassword(v); if (submitError) setSubmitError(''); }}
            onBlur={() => setTouched(t => ({ ...t, confirm: true }))}
            error={confirmError} placeholder="Confirm your password" autoComplete="new-password" disabled={isSubmitting}
            suffix={
              <button type="button" onClick={() => setShowConfirm(s => !s)} style={S.eyeBtn} aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            }
          />

          <button
            type="submit"
            disabled={isSubmitting || !isFormValid}
            className="kc-submit-btn"
            style={{
              ...S.submitBtn,
              opacity: isSubmitting ? 0.72 : !isFormValid ? 0.55 : 1,
              cursor: isSubmitting || !isFormValid ? 'not-allowed' : 'pointer',
            }}
          >
            {isSubmitting
              ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}><Spinner />Creating account...</span>
              : 'Create account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <span style={{ fontSize: 13.5, color: '#64748b' }}>Already have an account? </span>
          <Link to="/login" style={{ fontSize: 13.5, color: '#1d4ed8', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
        </div>

        <div style={S.secureNote}>
          <LockIcon />
          <span>Secured connection · Internal staff access only</span>
        </div>
      </>
    );
  };

  return (
    <>
      <style>{globalStyles}</style>
      <div style={S.page}>
        <div style={S.formPanel}>
          <div style={S.formCard}>
            {renderContent()}
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles (matching login page exactly)
// ─────────────────────────────────────────────────────────────────────────────

const globalStyles = `
  @keyframes kc-spin {
    to { transform: rotate(360deg); }
  }
  .kc-submit-btn:not(:disabled):hover {
    opacity: 0.92 !important;
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(29, 78, 216, 0.35) !important;
  }
  .kc-submit-btn:not(:disabled):active {
    transform: translateY(0);
    opacity: 0.88 !important;
  }
`;

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    WebkitFontSmoothing: 'antialiased',
  },
  formPanel: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc',
    padding: '40px 24px',
  },
  formCard: {
    background: '#ffffff',
    borderRadius: 18,
    padding: '44px 40px',
    width: '100%',
    maxWidth: 440,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 40px rgba(0,0,0,0.07)',
    border: '1px solid #f1f5f9',
  },
  formHeader: {
    marginBottom: 28,
  },
  formTitle: {
    fontSize: 23,
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.4px',
    marginBottom: 6,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 1.55,
  },
  authErrorBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '13px 16px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 10,
    color: '#b91c1c',
    fontSize: 13.5,
    fontWeight: 500,
    lineHeight: 1.5,
    marginBottom: 24,
  },
  label: {
    display: 'block',
    fontSize: 13.5,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 6,
    letterSpacing: '0.008em',
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 9,
    border: '1.5px solid',
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    lineHeight: 1.5,
    fontFamily: 'inherit',
  },
  inputSuffix: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    paddingRight: 13,
  },
  fieldError: {
    marginTop: 6,
    fontSize: 12.5,
    color: '#dc2626',
    fontWeight: 500,
    lineHeight: 1.4,
  },
  eyeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    color: '#9ca3af',
    lineHeight: 1,
  },
  submitBtn: {
    width: '100%',
    padding: '13px',
    background: 'linear-gradient(135deg, #1d4ed8 0%, #5a79c8 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: '0.01em',
    transition: 'opacity 0.15s ease, transform 0.12s ease, box-shadow 0.15s ease',
    boxShadow: '0 2px 8px rgba(29, 78, 216, 0.28)',
    fontFamily: 'inherit',
  },
  secureNote: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 22,
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: 500,
    letterSpacing: '0.01em',
  },
};
