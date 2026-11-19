import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import { apiFetch } from '../../api/client.js';
import { fetchTeachers } from '../../api/planner.js';
import { fetchAuthRoleCatalog, fetchAuthRoles } from '../../api/auth-roles.js';
import { fetchPositions } from '../../api/salary.js';
import { ALL_MODULE_KEYS } from '../../constants/authModules.js';
import { useToast } from '../../components/common/Toast.js';
import ConfirmDialog from '../../components/common/ConfirmDialog.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.js';
import { useGoBack } from '../../hooks/useGoBack.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import AccessRolesPicker from './AccessRolesPicker.js';
import AccessSummary from './AccessSummary.js';
import { memberActivity } from './memberActivity.js';
import { combinedFunctions, combinedModules, positionRoleFor, sameIds } from './accessRoleForm.js';

// Settings → Team members → a person → Edit access (/settings/users/:id/access).
// Left: who they are, their staff record (its position may bring a role) and
// every role to tick. Right (stays in view): the live result — roles, what
// they'll open, extra functions — with Save, which waits until something
// changed. Leaving with unsaved changes asks first.

interface MemberRecord {
  id: string; name: string; email: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'USER';
  teacherId: string | null;
  authRoleIds: string[];
  lastSeenAt: string | null;
}

const C = {
  text: '#1a1f36', sub: '#3c4257', muted: '#697386', border: '#e3e8ee', accent: '#5a67d8',
  accentSoft: '#eef2ff', danger: '#b91c1c', warn: '#b45309',
};
const BACK_TO = '/settings/users';
const ACCOUNT_LABEL = { SUPERADMIN: 'Superadmin', ADMIN: 'Admin', USER: 'Team member' } as const;

export default function EditAccessPage() {
  const { id } = useParams<{ id: string }>();
  const goBack = useGoBack(BACK_TO);
  const { isMobile } = useIsMobile();
  const qc = useQueryClient();
  const { showToast } = useToast();

  const users = useQuery({ queryKey: ['admin-users'], queryFn: () => apiFetch<MemberRecord[]>('/api/auth/users') });
  const { data: teachers = [] } = useQuery({ queryKey: ['planner-teachers'], queryFn: fetchTeachers });
  const { data: roles = [] } = useQuery({ queryKey: ['auth-roles'], queryFn: fetchAuthRoles });
  const { data: positions = [] } = useQuery({ queryKey: ['salary-positions'], queryFn: fetchPositions });
  const { data: catalog } = useQuery({ queryKey: ['auth-role-catalog'], queryFn: fetchAuthRoleCatalog });
  const member = users.data?.find(u => u.id === id) ?? null;

  const [teacherId, setTeacherId] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  useEffect(() => {
    if (loaded || !member) return;
    setTeacherId(member.teacherId ?? '');
    setRoleIds(member.authRoleIds ?? []);
    setLoaded(true);
  }, [loaded, member]);

  const isAdmin = member ? member.role !== 'USER' : false;
  const dirty = !!member && loaded && ((member.teacherId ?? '') !== teacherId || !sameIds(member.authRoleIds ?? [], roleIds));

  // A refresh or closing the tab with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const inherited = positionRoleFor(teacherId || null, teachers, positions, roles);
  const effectiveIds = [...roleIds, ...(inherited ? [inherited.role.id] : [])];
  const roleNames = [
    ...(inherited ? [`${inherited.role.name} (position)`] : []),
    ...roleIds.filter(r => r !== inherited?.role.id).map(r => roles.find(x => x.id === r)?.name).filter((n): n is string => !!n),
  ];
  const functionLabel = new Map((catalog?.functions ?? []).map(f => [f.key, f.label]));
  const linkedTeacher = teachers.find(t => t.id === teacherId);
  const positionName = positions.find(p => p.positionId === linkedTeacher?.positionId)?.name ?? null;

  const leave = () => (dirty ? setConfirmLeave(true) : goBack());

  const save = async () => {
    if (!member || !dirty) return;
    setSaving(true);
    try {
      await apiFetch(`/api/auth/users/${member.id}/teacher`, { method: 'PATCH', body: JSON.stringify({ teacherId: teacherId || null }) });
      if (!isAdmin) {
        await apiFetch(`/api/auth/users/${member.id}/auth-roles`, { method: 'PUT', body: JSON.stringify({ authRoleIds: roleIds }) });
      }
      await qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['auth-roles'] });
      showToast('Access saved');
      goBack();
    } catch (e: any) {
      showToast(e?.message ?? 'Couldn’t save', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (users.isLoading) return <div className="m-pad"><LoadingSpinner /></div>;
  if (users.isError) {
    return (
      <div className="m-pad">
        <p style={{ fontSize: 14, color: C.danger }}>Couldn’t load this team member.</p>
        <button type="button" onClick={() => users.refetch()} style={s.secondary}>Retry</button>
      </div>
    );
  }
  if (!member) {
    return (
      <div className="m-pad">
        <p style={{ fontSize: 14, color: C.muted }}>This team member no longer exists.</p>
        <button type="button" onClick={goBack} style={s.secondary}>Back to team members</button>
      </div>
    );
  }

  const activity = memberActivity(member.lastSeenAt);
  const actions = (
    <div>
      <div role="status" style={{ fontSize: 13, color: dirty ? C.warn : C.muted, marginBottom: 12 }}>
        {dirty ? 'Unsaved changes' : 'No changes yet'}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
      <button type="button" onClick={leave} disabled={saving} style={{ ...s.secondary, cursor: saving ? 'default' : 'pointer' }}>Cancel</button>
      <button type="button" onClick={save} disabled={!dirty || saving}
        style={{ ...s.primary, opacity: !dirty || saving ? 0.5 : 1, cursor: !dirty || saving ? 'default' : 'pointer' }}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
      </div>
    </div>
  );
  const summary = (
    <AccessSummary
      roleNames={roleNames}
      modules={combinedModules(roles, effectiveIds, ALL_MODULE_KEYS)}
      includes={catalog?.moduleIncludes ?? {}}
      functions={combinedFunctions(roles, effectiveIds).map(k => functionLabel.get(k) ?? k)}
      isAdmin={isAdmin}
    />
  );

  return (
    <div className="m-pad">
      {/* Who they are */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        {!isMobile && (
          <button type="button" onClick={leave} aria-label="Back to team members" title="Back" style={s.back}>
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
        )}
        <div aria-hidden style={s.avatar}>{(member.name || member.email).charAt(0).toUpperCase()}</div>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0 }}>{member.name || member.email}</h1>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4, overflowWrap: 'anywhere' }}>
            {member.email} · {ACCOUNT_LABEL[member.role]} · {activity.label}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 320px', gap: 24, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <section style={s.section}>
            <label htmlFor="access-staff" style={s.label}>Staff record</label>
            <p style={s.hint}>Links their sign-in to their staff page, pay and appraisals.</p>
            <select id="access-staff" value={teacherId} onChange={e => setTeacherId(e.target.value)} style={s.select}>
              <option value="">Not linked to a staff record</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {teacherId && (
              <p style={{ ...s.hint, margin: '8px 0 0' }}>
                {positionName
                  ? <>Position: <strong style={{ color: C.sub, fontWeight: 600 }}>{positionName}</strong>{inherited ? <> — gives the <strong style={{ color: C.sub, fontWeight: 600 }}>{inherited.role.name}</strong> role.</> : ' — no role comes with it.'}</>
                  : 'No position set on this staff record.'}
              </p>
            )}
          </section>

          <section style={s.section}>
            <label htmlFor="access-roles" style={s.label}>Roles</label>
            {isAdmin ? (
              <p style={{ ...s.hint, marginBottom: 0 }}>{ACCOUNT_LABEL[member.role]}s can open everything, so roles don’t apply.</p>
            ) : (
              <>
                <p style={s.hint}>Choose all that apply. Their access is everything these roles allow together.</p>
                <AccessRolesPicker id="access-roles" roles={roles} value={roleIds} onChange={setRoleIds}
                  inherited={inherited} scroll={false} showSummary={false} />
              </>
            )}
          </section>
        </div>

        {/* The result — stays in view on desktop; Save lives here so it never scrolls away. */}
        <aside style={isMobile ? s.section : { ...s.section, position: 'sticky', top: 16 }} aria-label="Access summary">
          {summary}
          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 16, paddingTop: 16 }}>{actions}</div>
        </aside>
      </div>

      {/* Phones: once something changed, Save stays one tap away instead of below the whole list. */}
      {isMobile && dirty && (
        <>
          <div style={{ height: 72 }} aria-hidden />
          <div style={s.mobileBar}>
            <span style={{ fontSize: 13, color: C.warn, flex: 1 }}>Unsaved changes</span>
            <button type="button" onClick={save} disabled={saving}
              style={{ ...s.primary, minHeight: 44, opacity: saving ? 0.5 : 1, cursor: saving ? 'default' : 'pointer' }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </>
      )}

      {confirmLeave && (
        <ConfirmDialog
          title="Discard your changes?"
          message="The changes you made to their access won’t be saved."
          confirmLabel="Discard"
          destructive
          onConfirm={() => { setConfirmLeave(false); goBack(); }}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  mobileBar: {
    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50, display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: '#fff',
    borderTop: `1px solid ${C.border}`, boxShadow: '0 -4px 16px rgba(15,23,42,0.06)',
  },
  back: { width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.muted, cursor: 'pointer', flexShrink: 0 },
  avatar: {
    width: 48, height: 48, borderRadius: '50%', background: C.accentSoft, color: C.accent, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700,
  },
  section: { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, marginBottom: 16 },
  label: { display: 'block', fontSize: 15, fontWeight: 600, color: C.text },
  hint: { margin: '4px 0 16px', fontSize: 13, color: C.muted, lineHeight: 1.5 },
  select: { width: '100%', maxWidth: 400, minHeight: 40, padding: '0 12px', borderRadius: 8, fontSize: 14, background: '#fff', color: C.text, boxSizing: 'border-box' },
  secondary: { minHeight: 36, padding: '0 16px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.sub, fontSize: 14, fontWeight: 600, fontFamily: 'inherit' },
  primary: { minHeight: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' },
};
