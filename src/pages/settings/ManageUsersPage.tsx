import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserPlus, faCopy, faCheck, faTrash, faPaperPlane, faPen, faCircle } from '@fortawesome/free-solid-svg-icons';
import { apiFetch } from '../../api/client.js';
import { fetchTeachers } from '../../api/planner.js';
import { fetchAuthRoles } from '../../api/auth-roles.js';
import { useToast } from '../../components/common/Toast.js';
import { memberActivity } from './memberActivity.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.js';
import AccessRolesPicker from './AccessRolesPicker.js';
import { fetchPositions } from '../../api/salary.js';
import { positionRoleFor } from './accessRoleForm.js';

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'USER';
  activated: boolean;
  inviteLink: string | null;
  createdAt: string;
  teacherId: string | null;
  /** Their own access roles (any number) — on top of whatever their linked staff record's position gives. */
  authRoleIds: string[];
  lastLoginAt: string | null;
  lastSeenAt: string | null;
}

const fmtSignIn = (iso: string | null) => iso
  ? `Last signed in ${new Date(iso).toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`
  : 'Has not signed in yet';

export default function ManageUsersPage() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}') as { id: string; role: string };

  const { data: teachers = [] } = useQuery({
    queryKey: ['planner-teachers'],
    queryFn: fetchTeachers,
  });
  const { data: authRoles = [] } = useQuery({
    queryKey: ['auth-roles'],
    queryFn: fetchAuthRoles,
  });

  // Edit access is its own page (Settings → Team members → a person).
  const navigate = useNavigate();
  const openEdit = (u: UserRecord) => navigate(`/settings/users/${u.id}/access`);

  const { data: positions = [] } = useQuery({ queryKey: ['salary-positions'], queryFn: fetchPositions });
  /** Every role a person has: their position's (marked) and their own. */
  const roleSummary = (u: UserRecord) => {
    const fromPosition = positionRoleFor(u.teacherId, teachers, positions, authRoles);
    const own = (u.authRoleIds ?? []).filter(id => id !== fromPosition?.role.id).map(id => authRoles.find(r => r.id === id)?.name).filter(Boolean);
    const all = [...(fromPosition ? [`${fromPosition.role.name} (position)`] : []), ...own];
    return all.length ? all.join(' · ') : 'No access roles';
  };

  const canDelete = (u: UserRecord) => {
    // Can't delete yourself
    if (u.id === currentUser.id) return false;
    // SUPERADMIN can delete anyone
    if (currentUser.role === 'SUPERADMIN') return true;
    // ADMIN can only delete USER
    if (currentUser.role === 'ADMIN' && u.role === 'USER') return true;
    return false;
  };
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiFetch<UserRecord[]>('/api/auth/users'),
    refetchInterval: 60_000, // keep "Online now" current while the page is open
  });

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'USER' | 'ADMIN'>('USER');
  const [inviteRoleIds, setInviteRoleIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [resendingId, setResendingId] = useState('');

  const [inviteSuccess, setInviteSuccess] = useState('');

  const inviteMutation = useMutation({
    mutationFn: (payload: { email: string; role: string; authRoleIds: string[] }) =>
      apiFetch<{ inviteLink: string; emailSent: boolean }>('/api/auth/invite', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: (data) => {
      setInviteError('');
      setShowInvite(false);
      setInviteSuccess(data.emailSent ? `Invite email sent to ${inviteEmail}` : 'Invite created — copy the link to share');
      setInviteEmail('');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setTimeout(() => setInviteSuccess(''), 5000);
    },
    onError: (err: any) => {
      setInviteError(err?.message || 'Failed to create invite');
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    inviteMutation.mutate({
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      authRoleIds: inviteRole === 'USER' ? inviteRoleIds : [],
    });
  };

  const handleCopy = (id: string, link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  const handleResend = async (email: string, role: string, id: string) => {
    setResendingId(id);
    try {
      await apiFetch('/api/auth/invite', { method: 'POST', body: JSON.stringify({ email, role }) });
      setInviteSuccess(`Invite resent to ${email}`);
      setTimeout(() => setInviteSuccess(''), 5000);
    } catch {
      setInviteSuccess('');
    } finally {
      setResendingId('');
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/auth/users/${deleteTarget.id}`, { method: 'DELETE' });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const activeUsers = users.filter(u => u.activated);
  const pendingUsers = users.filter(u => !u.activated);
  const onlineCount = activeUsers.filter(u => memberActivity(u.lastSeenAt).online).length;

  return (
    <div className="m-pad" style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0 }}>Team Members</h1>
        </div>
        <button
          onClick={() => { setShowInvite(true); setInviteEmail(''); setInviteError(''); setInviteRole('USER'); setInviteRoleIds([]); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', background: '#1d4ed8', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <FontAwesomeIcon icon={faUserPlus} /> Invite Member
        </button>
      </div>

      {/* Success banner */}
      {inviteSuccess && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, marginBottom: 20, fontSize: 14, color: '#166534', fontWeight: 500 }}>
          <FontAwesomeIcon icon={faCheck} /> {inviteSuccess}
        </div>
      )}

      {/* Invite modal */}
      {showInvite && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '32px', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Invite team member</h2>
            <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px' }}>They'll receive a link to set up their account.</p>

            <form onSubmit={handleInvite}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Email address</label>
                  <input
                    type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                    placeholder="colleague@school.com"
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #d1d5db',
                      fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                    }}
                  />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Role</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['USER', 'ADMIN'] as const).map(r => (
                      <button key={r} type="button" onClick={() => setInviteRole(r)} style={{
                        padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                        border: inviteRole === r ? '1.5px solid #1d4ed8' : '1.5px solid #d1d5db',
                        background: inviteRole === r ? '#eff6ff' : '#fff',
                        color: inviteRole === r ? '#1d4ed8' : '#6b7280',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}>{r === 'USER' ? 'User' : 'Admin'}</button>
                    ))}
                  </div>
                </div>
                {inviteRole === 'USER' && (
                  <div style={{ marginBottom: 20 }}>
                    <label htmlFor="invite-roles" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Access roles</label>
                    <AccessRolesPicker id="invite-roles" roles={authRoles} value={inviteRoleIds} onChange={setInviteRoleIds} />
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                      Give as many as fit what they do. Staff also get their position’s role once linked to their staff record.
                    </p>
                  </div>
                )}
                {inviteError && (
                  <p style={{ color: '#dc2626', fontSize: 13, fontWeight: 500, marginBottom: 16 }}>{inviteError}</p>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" onClick={() => setShowInvite(false)} style={{
                    padding: '9px 20px', border: '1.5px solid #d1d5db', borderRadius: 8,
                    background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>Cancel</button>
                  <button type="submit" disabled={inviteMutation.isPending || !inviteEmail.trim()} style={{
                    padding: '9px 24px', background: '#1d4ed8', color: '#fff', border: 'none',
                    borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    opacity: inviteMutation.isPending || !inviteEmail.trim() ? 0.6 : 1,
                  }}>
                    {inviteMutation.isPending ? 'Sending...' : 'Send Invite'}
                  </button>
                </div>
              </form>
          </div>
        </div>
      )}

      {/* Active users */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Active members ({activeUsers.length})
            {onlineCount > 0 && (
              <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 600, color: '#16a34a' }}>
                <FontAwesomeIcon icon={faCircle} style={{ fontSize: 7, marginRight: 5, verticalAlign: 'middle' }} />
                {onlineCount} online now
              </span>
            )}
          </h3>
        </div>
        {isLoading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#64748b', fontSize: 14 }}><LoadingSpinner /></div>
        ) : activeUsers.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#64748b', fontSize: 14 }}>No active members.</div>
        ) : (
          activeUsers.map(u => {
            const activity = memberActivity(u.lastSeenAt);
            return (
            <div key={u.id} className="m-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 20px', borderBottom: '1px solid #f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <div style={{
                  position: 'relative', flexShrink: 0,
                  width: 36, height: 36, borderRadius: '50%', background: '#eff6ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, color: '#1d4ed8',
                }}>
                  {(u.name || u.email)[0].toUpperCase()}
                  {activity.online && (
                    <span aria-hidden style={{
                      position: 'absolute', right: -1, bottom: -1, width: 11, height: 11, borderRadius: '50%',
                      background: '#22c55e', border: '2px solid #fff',
                    }} />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{u.name || '—'}</div>
                  <div style={{ fontSize: 13, color: '#64748b', overflowWrap: 'anywhere' }}>{u.email}</div>
                  {u.role === 'USER' && (
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                      {roleSummary(u)}
                    </div>
                  )}
                  <div title={fmtSignIn(u.lastLoginAt)} style={{
                    fontSize: 12, marginTop: 2, fontWeight: activity.online ? 600 : 500,
                    color: activity.online ? '#16a34a' : '#94a3b8',
                  }}>
                    {activity.label}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                  background: u.role === 'SUPERADMIN' ? '#fef3c7' : u.role === 'ADMIN' ? '#eff6ff' : '#f1f5f9',
                  color: u.role === 'SUPERADMIN' ? '#d97706' : u.role === 'ADMIN' ? '#1d4ed8' : '#64748b',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>{u.role}</span>
                <button onClick={() => openEdit(u)} title="Edit access" style={{
                  background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, color: '#374151',
                  cursor: 'pointer', padding: 6, fontSize: 12, display: 'inline-flex', alignItems: 'center',
                }}>
                  <FontAwesomeIcon icon={faPen} />
                </button>
                {canDelete(u) && (
                  <button aria-label="Delete user" title="Delete user" onClick={() => setDeleteTarget({ id: u.id, name: u.name || u.email })} style={{
                    background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 6, fontSize: 13,
                  }}>
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                )}
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* Pending invites */}
      {pendingUsers.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', marginTop: 20 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>Pending invites ({pendingUsers.length})</h3>
          </div>
          {pendingUsers.map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: '#fef3c7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, color: '#d97706',
                }}>
                  {u.email[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{u.email}</div>
                  <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 500 }}>Invite pending</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => handleResend(u.email, u.role, u.id)} disabled={resendingId === u.id} style={{
                  padding: '5px 12px', border: '1px solid #d1d5db', borderRadius: 6,
                  background: '#fff', color: resendingId === u.id ? '#94a3b8' : '#374151',
                  cursor: resendingId === u.id ? 'default' : 'pointer', fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit',
                }}>
                  <FontAwesomeIcon icon={faPaperPlane} /> {resendingId === u.id ? 'Sending...' : 'Resend'}
                </button>
                {u.inviteLink && (
                  <button onClick={() => handleCopy(u.id, u.inviteLink!)} style={{
                    padding: '5px 12px', border: '1px solid #d1d5db', borderRadius: 6,
                    background: copiedId === u.id ? '#dcfce7' : '#fff',
                    color: copiedId === u.id ? '#16a34a' : '#374151',
                    cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
                    fontFamily: 'inherit', transition: 'all 0.15s',
                  }}>
                    <FontAwesomeIcon icon={copiedId === u.id ? faCheck : faCopy} /> {copiedId === u.id ? 'Copied' : 'Copy Link'}
                  </button>
                )}
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                  background: '#f1f5f9', color: '#64748b',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>{u.role}</span>
                <button onClick={() => setDeleteTarget({ id: u.id, name: u.email })} style={{
                  background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 6, fontSize: 13,
                }}>
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '32px', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <FontAwesomeIcon icon={faTrash} style={{ color: '#dc2626', fontSize: 18 }} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', textAlign: 'center', margin: '0 0 8px' }}>Remove member</h3>
            <p style={{ fontSize: 14, color: '#64748b', textAlign: 'center', margin: '0 0 24px', lineHeight: 1.5 }}>
              Are you sure you want to remove <strong>{deleteTarget.name}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} style={{
                flex: 1, padding: '10px', border: '1.5px solid #d1d5db', borderRadius: 8,
                background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancel</button>
              <button onClick={confirmDelete} disabled={deleting} style={{
                flex: 1, padding: '10px', border: 'none', borderRadius: 8,
                background: '#dc2626', color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: deleting ? 'default' : 'pointer', fontFamily: 'inherit',
                opacity: deleting ? 0.7 : 1,
              }}>{deleting ? 'Removing...' : 'Remove'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
