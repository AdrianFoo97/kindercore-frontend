import { useState, useEffect, useId } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { login } from '../api/auth.js';

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

function validateEmail(value: string): string {
  if (!value.trim()) return 'Please enter your email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Enter a valid email address.';
  return '';
}

function validatePassword(value: string): string {
  if (!value) return 'Please enter your password.';
  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Field component
// ─────────────────────────────────────────────────────────────────────────────

interface FieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  error: string;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  suffix?: React.ReactNode;
}

function Field({ id, label, type, value, onChange, onBlur, error, placeholder, autoComplete, disabled, suffix }: FieldProps) {
  const [focused, setFocused] = useState(false);
  const hasError = !!error;

  const borderColor = hasError
    ? '#dc2626'
    : focused
    ? '#1d4ed8'
    : '#d1d5db';

  const boxShadow = hasError && focused
    ? '0 0 0 3px rgba(220,38,38,0.12)'
    : focused
    ? '0 0 0 3px rgba(29,78,216,0.12)'
    : 'none';

  return (
    <div style={{ marginBottom: 20 }}>
      <label htmlFor={id} style={S.label}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur(); }}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${id}-err` : undefined}
          style={{
            ...S.input,
            borderColor,
            boxShadow,
            paddingRight: suffix ? 46 : 14,
            background: disabled ? '#f9fafb' : '#fff',
            color: disabled ? '#9ca3af' : '#0f172a',
          }}
        />
        {suffix && (
          <div style={S.inputSuffix}>{suffix}</div>
        )}
      </div>
      {hasError && (
        <p id={`${id}-err`} role="alert" style={S.fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Spinner
// ─────────────────────────────────────────────────────────────────────────────

function Spinner({ color = 'white' }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: 'kc-spin 0.75s linear infinite', flexShrink: 0 }}>
      <circle cx="8" cy="8" r="6" stroke={color === 'white' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)'} strokeWidth="2.5" />
      <path d="M8 2a6 6 0 016 6" stroke={color === 'white' ? 'white' : '#374151'} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

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

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Google Calendar section (post-login)
// ─────────────────────────────────────────────────────────────────────────────

function SignedInSection({ onLogout }: { onLogout: () => void }) {
  return (
    <div>
      <div style={S.formHeader}>
        <h2 style={S.formTitle}>You're signed in</h2>
        <p style={S.formSubtitle}>Go to your dashboard to get started.</p>
      </div>
      <Link
        to="/leads"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#1d4ed8', fontSize: 14, fontWeight: 600, textDecoration: 'none', marginBottom: 28 }}
      >
        Go to dashboard <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 6 }} />
      </Link>
      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 24 }}>
        <button onClick={onLogout} style={S.ghostBtn}>Sign out</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const navigate = useNavigate();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // touched: only show errors after field interaction or submit attempt
  const [touched, setTouched] = useState({ email: false, password: false });

  // Submission state
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const token = localStorage.getItem('token');
  const isLoggedIn = !!token;

  useEffect(() => {
    if (isLoggedIn) {
      navigate('/leads', { replace: true });
    }
  }, [isLoggedIn, navigate]);

  // Derived validation (only shown when touched)
  const emailError = touched.email ? validateEmail(email) : '';
  const passwordError = touched.password ? validatePassword(password) : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Reveal all field errors on submit attempt
    setTouched({ email: true, password: true });

    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    if (eErr || pErr) return;

    setAuthError('');
    setIsLoggingIn(true);
    try {
      const data = await login(email.trim(), password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/leads');
    } catch (err: unknown) {
      const { ApiError } = await import('../api/client.js');
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setAuthError('The email or password you entered is incorrect. Please try again.');
        } else if (err.status === 429) {
          setAuthError('Too many login attempts. Please wait a few minutes and try again.');
        } else if (err.status === 503 || err.code === 'DB_UNAVAILABLE') {
          setAuthError('Service temporarily unavailable. Please try again shortly.');
        } else if (err.status === 0 || err.code === 'NETWORK_ERROR') {
          setAuthError('Unable to connect to server. Please check your connection.');
        } else {
          setAuthError('Something went wrong. Please try again.');
        }
      } else {
        setAuthError('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
  };

  return (
    <>
      <style>{globalStyles}</style>
      <div style={S.page}>

        {/* ── Form panel ──────────────────────────────────────────────────── */}
        <div style={S.formPanel}>
          <div style={S.formCard}>
            {!isLoggedIn ? (
              <>
                <div style={S.formHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 24 }}>
                    <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                      <rect width="30" height="30" rx="8" fill="#1d4ed8" />
                      <text x="15" y="21" textAnchor="middle" fill="white" fontSize="17" fontWeight="800">K</text>
                    </svg>
                    <span style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>KinderTech</span>
                  </div>
                  <h2 style={S.formTitle}>Welcome back</h2>
                  <p style={S.formSubtitle}>Sign in to your account to access the admin portal.</p>
                </div>

                {/* Auth error banner */}
                {authError && (
                  <div role="alert" style={S.authErrorBanner}>
                    <AlertIcon />
                    <span>{authError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  <Field
                    id="login-email"
                    label="Email address"
                    type="email"
                    value={email}
                    onChange={v => { setEmail(v); if (authError) setAuthError(''); }}
                    onBlur={() => setTouched(t => ({ ...t, email: true }))}
                    error={emailError}
                    placeholder="Email address"
                    autoComplete="email"
                    disabled={isLoggingIn}
                  />

                  <Field
                    id="login-password"
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={v => { setPassword(v); if (authError) setAuthError(''); }}
                    onBlur={() => setTouched(t => ({ ...t, password: true }))}
                    error={passwordError}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={isLoggingIn}
                    suffix={
                      <button
                        type="button"
                        onClick={() => setShowPassword(s => !s)}
                        style={S.eyeBtn}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    }
                  />

                  <div style={S.formMeta}>
                    <span style={S.forgotLink}>Forgot password?</span>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="kc-submit-btn"
                    style={{
                      ...S.submitBtn,
                      opacity: isLoggingIn ? 0.72 : 1,
                      cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isLoggingIn
                      ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}><Spinner />Signing in…</span>
                      : 'Sign in'}
                  </button>
                </form>

                <div style={S.secureNote}>
                  <LockIcon />
                  <span>Secured connection · Internal access only</span>
                </div>
              </>
            ) : (
              <SignedInSection onLogout={handleLogout} />
            )}
          </div>
        </div>

      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Global styles (focus, hover, animation, responsive)
// ─────────────────────────────────────────────────────────────────────────────

const globalStyles = `
  @keyframes kc-spin {
    to { transform: rotate(360deg); }
  }
  .kc-submit-btn:not(:disabled):hover {
    opacity: 0.92;
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(29, 78, 216, 0.35) !important;
  }
  .kc-submit-btn:not(:disabled):active {
    transform: translateY(0);
    opacity: 0.88;
  }
  @media (max-width: 768px) {
    .kc-brand-panel { display: none !important; }
    .kc-mobile-logo { display: flex !important; }
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    WebkitFontSmoothing: 'antialiased',
  },

  // ── Brand panel ──────────────────────────────────────────────────────────
  brandPanel: {
    width: 440,
    flexShrink: 0,
    background: 'linear-gradient(155deg, #1e3a8a 0%, #1e40af 45%, #1d4ed8 100%)',
    display: 'flex',
    flexDirection: 'column',
    padding: '52px 48px',
  },
  logoMark: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 52,
  },
  brandHeadline: {
    fontSize: 30,
    fontWeight: 800,
    color: '#ffffff',
    lineHeight: 1.25,
    letterSpacing: '-0.5px',
    marginBottom: 16,
  },
  brandTagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.62)',
    lineHeight: 1.65,
    marginBottom: 44,
    maxWidth: 320,
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 13,
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.78)',
    fontWeight: 500,
    lineHeight: 1.4,
  },
  featureDot: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.45)',
    flexShrink: 0,
  },
  brandFooter: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.32)',
    letterSpacing: '0.03em',
    position: 'relative',
    zIndex: 1,
  },

  // ── Form panel ───────────────────────────────────────────────────────────
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

  // ── Auth error banner ────────────────────────────────────────────────────
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

  // ── Form fields ──────────────────────────────────────────────────────────
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

  // ── Form meta row ────────────────────────────────────────────────────────
  formMeta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 24,
    marginTop: -8,
  },
  forgotLink: {
    fontSize: 13,
    color: '#1d4ed8',
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '0.005em',
  },

  // ── Password toggle ──────────────────────────────────────────────────────
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

  // ── Submit button ────────────────────────────────────────────────────────
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

  // ── Secure note ──────────────────────────────────────────────────────────
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

  // ── Google section ───────────────────────────────────────────────────────
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '11px 14px',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 9,
    color: '#15803d',
    fontSize: 13.5,
    fontWeight: 600,
    marginBottom: 14,
  },

  // ── Ghost button ─────────────────────────────────────────────────────────
  ghostBtn: {
    background: 'none',
    border: '1.5px solid #e5e7eb',
    borderRadius: 9,
    padding: '9px 20px',
    fontSize: 13.5,
    fontWeight: 600,
    color: '#6b7280',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s, color 0.15s',
  },
};
