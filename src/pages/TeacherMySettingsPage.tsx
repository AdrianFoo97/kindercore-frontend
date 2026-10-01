import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faEnvelope, faBriefcase, faCakeCandles, faPhone, faArrowRightFromBracket,
  faCircleQuestion, faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { fetchTeacherCareer } from '../api/career-missions.js';
import { fetchTeachers } from '../api/planner.js';
import { TEACHER_CONTENT_TOP } from '../components/common/TeacherTopBar.js';
import { User } from '../types/index.js';

function fmtBirthday(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Teacher Settings — reached from the "⋯" on every main tab. Just the
// account basics (who you're signed in as) plus the one action that
// actually belongs here: Logout. This floating chrome otherwise had no
// account surface at all; this page (not the "⋯" menu itself) is where
// it lives now.
// ─────────────────────────────────────────────────────────────────────────────

const FONT =
  '"Segoe UI", Roboto, Arial, sans-serif';

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eceef2',
  text: '#475569',
  textStrong: '#334155',
  muted: '#64748b',
  pAccent: '#7c3aed',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  dangerBorder: '#fecaca',
};

export default function TeacherMySettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isMobile } = useIsMobile();

  const rawUser = localStorage.getItem('user');
  const currentUser = rawUser ? (JSON.parse(rawUser) as User) : null;

  const { data: career } = useQuery({
    queryKey: ['teacher-career', id],
    queryFn: () => fetchTeacherCareer(id!),
    enabled: !!id,
  });
  const positionName = career?.currentPosition?.name ?? null;

  // Same query/cache key TeacherHomePage.tsx already uses for this
  // teacher's own row — phone/dob live here, not on the career record.
  const { data: teachers = [] } = useQuery({
    queryKey: ['planner-teachers'],
    queryFn: fetchTeachers,
  });
  const teacher = teachers.find(t => t.id === id);

  const rows: { icon: IconDefinition; label: string; value: string }[] = [
    ...(teacher?.dob ? [{ icon: faCakeCandles, label: 'Birthday', value: fmtBirthday(teacher.dob) }] : []),
    ...(teacher?.phone ? [{ icon: faPhone, label: 'Phone', value: teacher.phone }] : []),
    ...(currentUser?.email ? [{ icon: faEnvelope, label: 'Email', value: currentUser.email }] : []),
    ...(positionName ? [{ icon: faBriefcase, label: 'Position', value: positionName }] : []),
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const pageStyle: React.CSSProperties = {
    paddingTop: isMobile ? TEACHER_CONTENT_TOP : 28,
    paddingRight: isMobile ? 16 : 32,
    paddingBottom: 40,
    paddingLeft: isMobile ? 16 : 32,
    minHeight: '100vh',
    fontFamily: FONT,
    color: C.text,
    background: C.bg,
  };

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: isMobile ? 640 : 480, margin: '0 auto' }}>
        {/* Page title — lives here as plain content, not in the shared
            floating bar (which suppresses its own at-rest title for
            every teacher page now — see TeacherTopBar.tsx's
            titleMovedToPage). Same treatment as Home/Pay hub/Guides.
            Gated to mobile only — desktop shows the real admin Navbar
            instead of this floating chrome, same as Home's own gate. */}
        {isMobile && (
          <h1 style={{
            margin: '0 0 16px', paddingLeft: 4, fontSize: 30, fontWeight: 800,
            color: C.textStrong, letterSpacing: '-0.02em',
          }}>
            Settings
          </h1>
        )}

        {/* ── Profile ──────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: C.card, border: `1px solid ${C.cardBorder}`,
          borderRadius: 18, padding: '18px', marginBottom: 16,
          boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
            background: C.pAccent, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 24, letterSpacing: '-0.01em',
          }}>
            {(currentUser?.name || '?').charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 18, fontWeight: 800, color: C.textStrong,
              letterSpacing: '-0.02em', lineHeight: 1.2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {currentUser?.name || 'Account'}
            </div>
            {positionName && (
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.pAccent, marginTop: 2 }}>
                {positionName}
              </div>
            )}
          </div>
        </div>

        {/* ── Account details ──────────────────────────────────── */}
        {rows.length > 0 && (
          <div style={{
            background: C.card, border: `1px solid ${C.cardBorder}`,
            borderRadius: 14, marginBottom: 24, overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
          }}>
            {rows.map((row, i) => (
              <div key={row.label} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px',
                borderBottom: i < rows.length - 1 ? `1px solid ${C.cardBorder}` : undefined,
              }}>
                <FontAwesomeIcon icon={row.icon} style={{ width: 16, color: C.muted }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {row.label}
                  </div>
                  <div style={{
                    fontSize: 14, fontWeight: 700, color: C.textStrong, marginTop: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {row.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Help ─────────────────────────────────────────────── */}
        <div style={{
          background: C.card, border: `1px solid ${C.cardBorder}`,
          borderRadius: 14, marginBottom: 24, overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
        }}>
          <button
            type="button"
            onClick={() => navigate(`/teachers/${id}/settings/report-bug`)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              padding: '14px 16px', border: 'none', background: 'transparent',
              cursor: 'pointer', textAlign: 'left' as const, fontFamily: 'inherit',
            }}
          >
            <FontAwesomeIcon icon={faCircleQuestion} style={{ width: 16, color: C.muted }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.textStrong }}>Report a Bug</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>Something not working right? Let us know.</div>
            </div>
            <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 12, color: C.muted }} />
          </button>
        </div>

        {/* ── Logout ───────────────────────────────────────────── */}
        <button
          type="button"
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            width: '100%', padding: '13px', border: `1.5px solid ${C.dangerBorder}`,
            borderRadius: 12, background: C.dangerSoft, cursor: 'pointer',
            color: C.danger, fontSize: 14.5, fontWeight: 700, fontFamily: 'inherit',
          }}
        >
          <FontAwesomeIcon icon={faArrowRightFromBracket} />
          Logout
        </button>
      </div>
    </div>
  );
}
