import { Navigate, useParams } from 'react-router-dom';

// Shared guide links (/guide/:templateId) — one link for everyone. Lives
// inside the signed-in layout, so a signed-out visitor goes to login first
// and comes straight back here; then teachers get the teacher-app view of
// the guide and office staff the admin view. Opening it still needs the
// Operation module, like the guide page itself.
export default function GuideShareRedirect() {
  const { templateId = '' } = useParams();
  const isTeacher = !!readStoredTeacherId();
  const target = `/operations/sops/${encodeURIComponent(templateId)}${isTeacher ? '?app=teacher' : ''}`;
  return <Navigate to={target} replace />;
}

function readStoredTeacherId(): string | null {
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as { teacherId?: string | null }).teacherId ?? null : null;
  } catch {
    return null;
  }
}
