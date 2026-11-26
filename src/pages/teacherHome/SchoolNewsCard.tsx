import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChildren, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { SCHOOL_NEWS_KEY, fetchSchoolNews, hideSchoolNews, type SchoolNewsPost } from '../../api/schoolNews.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { MODULES } from '../../constants/authModules.js';
import ConfirmDialog from '../../components/common/ConfirmDialog.js';
import { useToast } from '../../components/common/Toast.js';

// Home → "School news": a new child is joining — for everyone to celebrate.
// Only the class and start date (never the child's name). Hidden when there's
// nothing recent. Whoever runs enrolment (Students) can hide a post for everyone.

const C = { card: '#ffffff', border: '#ede9fe', text: '#334155', muted: '#64748b', accent: '#7c3aed', accentSoft: '#f5f3ff', divider: '#eef0f3' };

const ago = (iso: string): string => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
};

export function SchoolNewsCard({ sectionLabelStyle }: { sectionLabelStyle: React.CSSProperties }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { hasModule } = usePermissions();
  const canHide = hasModule(MODULES.STUDENTS);
  const { data: posts = [] } = useQuery({ queryKey: SCHOOL_NEWS_KEY, queryFn: fetchSchoolNews, retry: false });
  const [hiding, setHiding] = useState<SchoolNewsPost | null>(null);
  const hide = useMutation({
    mutationFn: (p: SchoolNewsPost) => hideSchoolNews(p.id),
    onSuccess: () => { setHiding(null); qc.invalidateQueries({ queryKey: SCHOOL_NEWS_KEY }); showToast('Hidden for everyone'); },
    onError: (e: Error) => showToast(e.message || 'Couldn’t hide it', 'error'),
  });
  if (posts.length === 0) return null;

  return (
    <>
      <div style={sectionLabelStyle}>School news</div>
      <ul style={{ listStyle: 'none', margin: '0 0 26px', padding: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}>
        {posts.map((p, i) => (
          <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px 12px 16px', borderTop: i ? `1px solid ${C.divider}` : 'none' }}>
            <span aria-hidden style={{ width: 36, height: 36, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.accentSoft, color: C.accent, fontSize: 15 }}>
              <FontAwesomeIcon icon={faChildren} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: C.text, lineHeight: 1.35 }}>{p.title}</span>
              <span style={{ display: 'block', marginTop: 2, fontSize: 12.5, fontWeight: 600, color: C.muted, lineHeight: 1.4 }}>{p.body}</span>
              <span style={{ display: 'block', marginTop: 4, fontSize: 11, fontWeight: 700, color: C.muted }}>{ago(p.postedAt)}</span>
            </span>
            {canHide && (
              <button type="button" onClick={() => setHiding(p)} aria-label="Hide this news for everyone" title="Hide for everyone" style={{
                width: 44, height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', background: 'none', color: C.muted, cursor: 'pointer', borderRadius: 12, fontSize: 14,
              }}>
                <FontAwesomeIcon icon={faEyeSlash} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {hiding && (
        <ConfirmDialog title="Hide this news for everyone?" message="It comes off every staff member’s Home." confirmLabel="Hide" destructive
          loading={hide.isPending} onConfirm={() => hide.mutate(hiding)} onCancel={() => setHiding(null)} />
      )}
    </>
  );
}
