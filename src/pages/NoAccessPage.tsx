import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserLock } from '@fortawesome/free-solid-svg-icons';

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eef0f4',
  text: '#0f172a',
  muted: '#64748b',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
};

// Shown when a login succeeds but the account has no AuthRole grants yet
// (no Teacher link, or a Position with no AuthRole assigned) — without
// this, RequireModule would bounce such a user to the public marketing
// page, which looks identical to a failed login.
export default function NoAccessPage() {
  return (
    <div style={{
      minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: C.bg, fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', padding: 24,
    }}>
      <div style={{
        background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 14,
        padding: '36px 40px', maxWidth: 440, textAlign: 'center',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', background: C.primarySoft, color: C.primary,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, margin: '0 auto 16px',
        }}>
          <FontAwesomeIcon icon={faUserLock} />
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: C.text }}>
          You're logged in, but nothing's assigned yet
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: C.muted, lineHeight: 1.6 }}>
          Your account isn't linked to a position with any access granted. Ask an admin to link your
          account under Manage Users, and assign an access role to your position under Access Roles.
        </p>
      </div>
    </div>
  );
}
