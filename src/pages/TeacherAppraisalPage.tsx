import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import { fetchTeachers } from '../api/planner.js';
import { AppraisalTab } from './settings/EditTeacherPage.js';

const C = {
  primary: '#5a67d8', card: '#fff', text: '#1e293b',
  muted: '#94a3b8', sub: '#475569', border: '#e2e8f0',
};

export default function TeacherAppraisalPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: teachers = [] } = useQuery({ queryKey: ['planner-teachers'], queryFn: fetchTeachers });
  const teacher = (teachers as any[]).find(t => t.id === id);

  return (
    <div style={s.page}>
      <style>{`.tap-back-btn:hover { background: #f1f5f9 !important; color: ${C.text} !important; border-color: #cbd5e1 !important; }`}</style>
      <div style={s.inner}>
        <div style={s.breadcrumb}>
          <button onClick={() => navigate('/teachers')} className="tap-back-btn" style={s.backBtn} title="Back">
            <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 11 }} />
          </button>
          <span onClick={() => navigate('/teachers')} style={s.breadcrumbLink}>Teachers</span>
          <span style={{ color: C.muted, fontSize: 11 }}>/</span>
          <span style={{ fontSize: 13, color: C.sub, fontWeight: 500 }}>{teacher?.name ?? '...'}</span>
          <span style={{ color: C.muted, fontSize: 11 }}>/</span>
          <span style={{ fontSize: 13, color: C.sub, fontWeight: 500 }}>Appraisal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          {teacher?.color && (
            <span style={{ width: 14, height: 14, borderRadius: '50%', background: teacher.color, flexShrink: 0 }} />
          )}
          <h1 style={s.heading}>{teacher?.name ? `${teacher.name} · Appraisal` : 'Appraisal'}</h1>
        </div>
        {id && <AppraisalTab teacherId={id} />}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: C.text },
  inner: { maxWidth: 860, margin: '0 auto' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  backBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.border}`, background: C.card, color: C.muted, cursor: 'pointer', transition: 'all 0.1s' },
  breadcrumbLink: { fontSize: 13, fontWeight: 600, color: C.primary, cursor: 'pointer' },
  heading: { fontSize: 22, fontWeight: 800, color: C.text, margin: 0 },
};
