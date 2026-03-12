import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { login } from '../api/auth.js';
import { getGoogleStatus, getConnectToken } from '../api/google.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const googleParam = searchParams.get('google');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const token = localStorage.getItem('token');
  const isLoggedIn = !!token;

  useEffect(() => {
    if (isLoggedIn && googleParam !== 'connected') {
      navigate('/leads', { replace: true });
    }
  }, [isLoggedIn, googleParam, navigate]);

  const {
    data: googleStatus,
    refetch: refetchGoogleStatus,
  } = useQuery({
    queryKey: ['googleStatus'],
    queryFn: getGoogleStatus,
    enabled: isLoggedIn,
    retry: false,
  });

  useEffect(() => {
    if (googleParam === 'connected') {
      refetchGoogleStatus();
      const returnTo = sessionStorage.getItem('google_return_to');
      if (returnTo) {
        sessionStorage.removeItem('google_return_to');
        const timer = setTimeout(() => navigate(returnTo), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [googleParam, refetchGoogleStatus, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);
    try {
      const data = await login(email, password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/leads');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    try {
      const { url } = await getConnectToken();
      window.location.href = url;
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to initiate Google connection',
      );
      setIsConnecting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>KinderCore</h1>

        {!isLoggedIn ? (
          <form onSubmit={handleSubmit}>
            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={styles.input}
                placeholder="admin@kinderCore.local"
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={styles.input}
              />
            </div>
            {error && <p style={styles.error}>{error}</p>}
            <button type="submit" disabled={isLoggingIn} style={styles.button}>
              {isLoggingIn ? 'Logging in…' : 'Login'}
            </button>
          </form>
        ) : (
          <div>
            <p style={{ marginBottom: 8 }}>
              You are logged in.{' '}
              <Link to="/leads">Go to Leads &rarr;</Link>
            </p>
            <button onClick={handleLogout} style={{ ...styles.button, background: '#888' }}>
              Logout
            </button>

            <hr style={{ margin: '24px 0' }} />

            <h2 style={{ marginBottom: 16 }}>Google Calendar</h2>
            {googleParam === 'connected' && (
              <div style={styles.successBanner}>
                <span style={{ fontSize: 20 }}>✓</span>
                Google Calendar connected! Redirecting you back…
              </div>
            )}
            {googleStatus?.connected ? (
              <p style={{ color: 'green' }}>Google Calendar Connected ✅</p>
            ) : (
              <div>
                <p style={{ marginBottom: 12, color: '#555' }}>
                  Connect the shared company Google Calendar to enable appointment creation.
                </p>
                <button
                  onClick={handleConnectGoogle}
                  disabled={isConnecting}
                  style={styles.button}
                >
                  {isConnecting ? 'Redirecting…' : 'Connect Company Google Calendar'}
                </button>
              </div>
            )}
            {error && <p style={styles.error}>{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f0f4f8',
    padding: 16,
  },
  card: {
    background: '#fff',
    borderRadius: 8,
    padding: 32,
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
  },
  title: {
    marginBottom: 24,
    fontSize: 28,
    color: '#1a202c',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    marginBottom: 4,
    fontWeight: 600,
    color: '#2d3748',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 4,
    border: '1px solid #cbd5e0',
    fontSize: 16,
    boxSizing: 'border-box',
  },
  button: {
    padding: '10px 20px',
    background: '#4299e1',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 16,
    cursor: 'pointer',
  },
  error: {
    color: '#e53e3e',
    marginBottom: 12,
  },
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    background: '#c6f6d5',
    color: '#276749',
    borderRadius: 6,
    fontWeight: 600,
    fontSize: 14,
    marginBottom: 16,
  },
};
