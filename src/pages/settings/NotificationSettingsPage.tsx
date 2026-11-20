import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { fetchNotificationSettings, saveNotificationSettings } from '../../api/notifications.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.js';
import { groupByCategory, groupBySource } from '../../components/common/notificationDisplay.js';

// Your notifications (Settings → Organisation → Notifications for admins;
// /notifications/settings for everyone; inside the teacher app via
// TeacherNotificationSettingsPage). Only what your roles (and, for staff,
// your own work) give you is listed — by category, then by where it comes
// from. Your own choice only.

const C = { text: '#1a1f36', sub: '#3c4257', muted: '#64748b', border: '#e2e8f0', divider: '#eef0f4', accent: '#4f5bd5', ok: '#15803d', danger: '#b91c1c' };
const QUERY_KEY = ['notification-settings'];

/** `embedded`: inside another page that has its own title and padding (the teacher app). */
export default function NotificationSettingsPage({ embedded = false, accent = C.accent }: { embedded?: boolean; accent?: string } = {}) {
  const pad = embedded ? undefined : 'm-pad';
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: QUERY_KEY, queryFn: fetchNotificationSettings });
  const [on, setOn] = useState<Set<string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (data && !on) setOn(new Set(data.events.filter(e => e.enabled).map(e => e.kind))); }, [data, on]);

  if (isLoading || (data && !on)) return <div className={pad}><LoadingSpinner /></div>;
  if (isError || !data || !on) {
    return (
      <div className={pad}>
        <p style={{ fontSize: 14, color: C.danger }}>Couldn’t load your notification settings.</p>
        <button type="button" onClick={() => refetch()} style={s.secondary}>Retry</button>
      </div>
    );
  }

  const initiallyOn = new Set(data.events.filter(e => e.enabled).map(e => e.kind));
  const dirty = data.events.some(e => initiallyOn.has(e.kind) !== on.has(e.kind));
  const toggle = (kind: string) => {
    const next = new Set(on);
    if (next.has(kind)) next.delete(kind); else next.add(kind);
    setOn(next); setSaved(false);
  };
  const save = async () => {
    setSaving(true); setError('');
    try {
      const r = await saveNotificationSettings(data.events.filter(e => !on.has(e.kind)).map(e => e.kind));
      qc.setQueryData(QUERY_KEY, r);
      setOn(new Set(r.events.filter(e => e.enabled).map(e => e.kind)));
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Couldn’t save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={pad}>
      {!embedded && <h1>Notifications</h1>}

      {data.events.length === 0 && (
        <div style={{ ...s.card, textAlign: 'center', color: C.muted, fontSize: 14, padding: 32 }}>
          None of your roles come with notifications yet.
        </div>
      )}
      {groupByCategory(data.events).map(g => (
        <section key={g.category} style={s.card} aria-labelledby={`cat-${g.category}`}>
          <h2 id={`cat-${g.category}`} style={s.catTitle}>{g.category}</h2>
          {groupBySource(g.events).map((src, si) => (
            <div key={src.label} style={{ marginTop: si ? 16 : 8 }}>
              <div style={s.source}>{src.label}</div>
              {src.events.map((e, i) => (
                <label key={e.kind} style={{ ...s.row, borderTop: i ? `1px solid ${C.divider}` : 'none' }}>
                  <input type="checkbox" checked={on.has(e.kind)} onChange={() => toggle(e.kind)}
                    style={{ width: 18, height: 18, marginTop: 2, accentColor: accent, cursor: 'pointer', flexShrink: 0 }} />
                  <span>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.text }}>{e.label}</span>
                    <span style={{ display: 'block', fontSize: 13, color: C.muted, marginTop: 2 }}>{e.description}</span>
                  </span>
                </label>
              ))}
            </div>
          ))}
        </section>
      ))}

      {data.events.length > 0 && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        {error && <span role="alert" style={{ fontSize: 13, color: C.danger, marginRight: 'auto' }}>{error}</span>}
        {!error && <span role="status" style={{ fontSize: 13, color: saved ? C.ok : C.muted, marginRight: 'auto' }}>
          {saved && !dirty ? <><FontAwesomeIcon icon={faCheck} /> Saved</> : dirty ? 'Unsaved changes' : ''}
        </span>}
        <button type="button" onClick={save} disabled={!dirty || saving}
          style={{ ...s.primary, background: accent, minHeight: embedded ? 44 : 36, opacity: !dirty || saving ? 0.5 : 1, cursor: !dirty || saving ? 'default' : 'pointer' }}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 24px', marginBottom: 16 },
  source: { fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 4 },
  catTitle: { margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' },
  row: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', cursor: 'pointer' },
  primary: { minHeight: 36, padding: '0 18px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' },
  secondary: { minHeight: 36, padding: '0 16px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.sub, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' },
};
