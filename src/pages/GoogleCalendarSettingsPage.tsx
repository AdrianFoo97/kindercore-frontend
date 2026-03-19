import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getGoogleStatus, getConnectToken, listGoogleCalendars, setGoogleCalendar } from '../api/google.js';

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="8" fill="#16a34a" />
      <path d="M4.5 8l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <span style={{ display: 'inline-block', width: 15, height: 15, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
  );
}

export default function GoogleCalendarSettingsPage() {
  const [searchParams] = useSearchParams();
  const googleParam = searchParams.get('google');
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedCalendarId, setSavedCalendarId] = useState<string | null>(null);

  const { data: googleStatus, refetch } = useQuery({
    queryKey: ['googleStatus'],
    queryFn: getGoogleStatus,
    retry: false,
  });

  const { data: calendarList, isLoading: calendarsLoading, isError: calendarsError } = useQuery({
    queryKey: ['googleCalendars'],
    queryFn: listGoogleCalendars,
    enabled: !!googleStatus?.connected,
    retry: 1,
  });

  useEffect(() => {
    if (googleParam === 'connected') {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['googleCalendars'] });
    }
  }, [googleParam, refetch, queryClient]);

  // Pre-select the currently configured calendar when both queries are ready
  useEffect(() => {
    if (!calendarList || calendarList.length === 0) return;
    if (!googleStatus?.connected) return;
    if (selectedCalendarId !== null) return;
    const configuredId = googleStatus.calendarId;
    const primaryCal = calendarList.find(c => c.primary);
    // Resolve 'primary' alias to the actual primary calendar ID
    const resolvedId = configuredId === 'primary' && primaryCal ? primaryCal.id : configuredId;
    if (resolvedId && calendarList.some(c => c.id === resolvedId)) {
      setSelectedCalendarId(resolvedId);
      setSavedCalendarId(resolvedId);
    } else {
      const fallbackId = (primaryCal ?? calendarList[0]).id;
      setSelectedCalendarId(fallbackId);
      setSavedCalendarId(fallbackId);
    }
  }, [calendarList, googleStatus]);

  const handleSaveCalendar = async () => {
    if (!selectedCalendarId) return;
    setIsSaving(true);
    try {
      await setGoogleCalendar(selectedCalendarId);
      setSavedCalendarId(selectedCalendarId);
      queryClient.invalidateQueries({ queryKey: ['googleStatus'] });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const { url } = await getConnectToken();
      sessionStorage.setItem('google_return_to', '/settings/calendar');
      window.location.href = url;
    } catch {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    // After reconnecting, the old token is replaced — just prompt reconnect
    queryClient.removeQueries({ queryKey: ['googleStatus'] });
    handleConnect();
  };

  return (
    <div style={{ padding: '32px 24px', fontFamily: 'system-ui, sans-serif', display: 'flex', justifyContent: 'center' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#1a202c' }}>Google Calendar</h1>
        <p style={{ margin: '0 0 28px', fontSize: 14, color: '#6b7280' }}>
          Connect a Google account to enable calendar event creation when booking appointments.
        </p>

        {googleParam === 'connected' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, marginBottom: 20, fontSize: 14, color: '#15803d', fontWeight: 600 }}>
            <CheckIcon />
            Google Calendar connected successfully.
          </div>
        )}

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Google Calendar icon */}
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="#4285F4" strokeWidth="1.5" fill="white" />
                  <rect x="3" y="3" width="18" height="5" rx="2" fill="#4285F4" />
                  <rect x="3" y="6" width="18" height="2" fill="#4285F4" />
                  <line x1="8" y1="3" x2="8" y2="8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="16" y1="3" x2="16" y2="8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                  <text x="12" y="18" textAnchor="middle" fill="#4285F4" fontSize="7" fontWeight="700">CAL</text>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1a202c' }}>Google Calendar</div>
                {googleStatus?.connected ? (
                  <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: '#9ca3af', flexShrink: 0 }}>Account:</span>
                      <span style={{ fontWeight: 600 }}>
                        {googleStatus.email ?? <span style={{ color: '#9ca3af', fontWeight: 400, fontStyle: 'italic' }}>Reconnect to see</span>}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: '#9ca3af', flexShrink: 0 }}>Calendar:</span>
                      <span style={{ fontWeight: 600 }}>
                        {googleStatus.calendarName ?? (googleStatus.calendarId
                          ? <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{googleStatus.calendarId}</span>
                          : <span style={{ color: '#9ca3af', fontWeight: 400, fontStyle: 'italic' }}>Reconnect to see</span>)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Not connected</div>
                )}
              </div>
            </div>
            {googleStatus?.connected
              ? <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: '#15803d', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: '4px 12px' }}>
                  <CheckIcon /> Connected
                </span>
              : <span style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 20, padding: '4px 12px' }}>
                  Not connected
                </span>
            }
          </div>

          {/* Body */}
          <div style={{ padding: '16px 20px' }}>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>
              When connected, KinderTech will create and update Google Calendar events automatically when appointments are booked or confirmed. Only calendar event access is requested — no access to email or other data.
            </p>

            {googleStatus?.connected && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Create events in
                </label>
                {calendarsLoading ? (
                  <div style={{ fontSize: 13, color: '#9ca3af' }}>Loading calendars…</div>
                ) : calendarsError ? (
                  <div style={{ fontSize: 13, color: '#dc2626' }}>Failed to load calendars. Try reconnecting your account.</div>
                ) : calendarList && calendarList.length > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <select
                      value={selectedCalendarId ?? ''}
                      onChange={e => setSelectedCalendarId(e.target.value)}
                      style={{ flex: 1, padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, color: '#1a202c', background: '#fff', cursor: 'pointer' }}
                    >
                      {calendarList.map(c => (
                        <option key={c.id} value={c.id ?? ''}>
                          {c.name}{c.primary ? ' (primary)' : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleSaveCalendar}
                      disabled={isSaving || selectedCalendarId === savedCalendarId}
                      style={{ padding: '8px 16px', background: selectedCalendarId === savedCalendarId ? '#f1f5f9' : '#2b6cb0', color: selectedCalendarId === savedCalendarId ? '#9ca3af' : '#fff', border: 'none', borderRadius: 7, cursor: isSaving || selectedCalendarId === savedCalendarId ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}
                    >
                      {isSaving ? 'Saving…' : savedCalendarId === selectedCalendarId ? 'Saved' : 'Save'}
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: '#9ca3af' }}>No calendars found.</div>
                )}
              </div>
            )}

            {googleStatus?.connected ? (
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                style={{ padding: '9px 18px', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 7, cursor: isConnecting ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, color: '#4a5568', opacity: isConnecting ? 0.7 : 1 }}
              >
                {isConnecting
                  ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 13, height: 13, border: '2px solid #a0aec0', borderTopColor: '#4a5568', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />Redirecting…</span>
                  : 'Reconnect with a different account'}
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                style={{ padding: '9px 18px', background: '#2b6cb0', color: '#fff', border: 'none', borderRadius: 7, cursor: isConnecting ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, opacity: isConnecting ? 0.7 : 1 }}
              >
                {isConnecting
                  ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Spinner />Redirecting…</span>
                  : 'Connect Google Calendar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
