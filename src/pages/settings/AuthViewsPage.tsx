import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faPen, faEye } from '@fortawesome/free-solid-svg-icons';
import { fetchAuthViews, deleteAuthView, AuthViewRecord } from '../../api/auth-views.js';
import { MODULE_LABELS } from '../../constants/authModules.js';
import { useToast } from '../../components/common/Toast.js';
import { useDeleteDialog } from '../../components/common/DeleteDialog.js';

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eef0f4',
  text: '#0f172a',
  textSub: '#475569',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
  danger: '#dc2626',
};
const RADIUS = 14;
const SHADOW = '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)';

export default function AuthViewsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { confirm } = useDeleteDialog();

  const { data: views = [], isLoading } = useQuery({
    queryKey: ['auth-views'],
    queryFn: fetchAuthViews,
  });

  const onDelete = async (view: AuthViewRecord) => {
    await confirm({
      entityType: 'view',
      entityName: view.label,
      consequence: 'The view will be permanently removed from the catalog.',
      blockedHint: 'Unassign this view from any access roles that still grant it, then try again.',
      onConfirm: async () => {
        try {
          await deleteAuthView(view.id);
          qc.invalidateQueries({ queryKey: ['auth-views'] });
          showToast('View deleted');
        } catch (e: any) {
          const msg = (() => { try { return JSON.parse(e?.message)?.message ?? e.message; } catch { return e?.message ?? 'Delete failed'; } })();
          showToast(msg, 'error');
          throw e;
        }
      },
    });
  };

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={s.heading}>Views</h1>
          <p style={s.subheading}>
            The catalog of finer-grained actions within a module (e.g. "Approve/reject How-To Guide changes").
            Defining a view here doesn't grant anyone anything by itself — a developer still has to wire an
            actual permission check to its key in code. This is just what's available to assign under Access Roles.
          </p>
        </div>

        <div style={s.card}>
          <div style={s.cardHeader}>
            <div>
              <h3 style={s.cardTitle}>Views</h3>
              <div style={s.cardSub}>
                {views.length === 0 ? 'No views yet' : `${views.length} view${views.length === 1 ? '' : 's'}`}
              </div>
            </div>
            <button onClick={() => navigate('/settings/auth-views/new')} style={s.primaryBtn}>
              <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
              Add view
            </button>
          </div>

          {isLoading ? (
            <p style={{ padding: 24, color: C.mutedSoft, fontSize: 13 }}>Loading…</p>
          ) : views.length === 0 ? (
            <p style={{ padding: 24, textAlign: 'center', color: C.muted, fontSize: 13 }}>
              No views configured yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {views.map(view => (
                <div key={view.id} style={s.row}>
                  <div style={s.iconSwatch}>
                    <FontAwesomeIcon icon={faEye} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>
                        {view.label}
                      </span>
                      {view.modules.map(m => (
                        <span key={m} style={s.moduleBadge}>{MODULE_LABELS[m]}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: C.mutedSoft, fontFamily: 'ui-monospace, monospace', marginTop: 3 }}>
                      {view.key}
                    </div>
                    {view.description && (
                      <p style={{ margin: '6px 0 0', fontSize: 12, color: C.mutedSoft, lineHeight: 1.5 }}>
                        {view.description}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => navigate(`/settings/auth-views/${view.id}/edit`)} style={s.iconBtn} aria-label="Edit">
                      <FontAwesomeIcon icon={faPen} />
                    </button>
                    <button onClick={() => onDelete(view)} style={{ ...s.iconBtn, color: C.danger }} aria-label="Delete">
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', background: C.bg, minHeight: '100vh', color: C.text },
  inner: { maxWidth: 1100, margin: '0 auto' },
  heading: { margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' },
  subheading: { margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.5, maxWidth: 720 },
  card: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS,
    padding: '22px 26px', boxShadow: SHADOW, marginBottom: 20,
  },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' },
  cardTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' },
  cardSub: { fontSize: 11, color: C.mutedSoft, marginTop: 2 },
  primaryBtn: {
    padding: '8px 16px', borderRadius: 10, border: 'none',
    background: C.primary, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  row: {
    display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px',
    border: `1px solid ${C.cardBorder}`, borderRadius: 12, background: '#fff',
  },
  iconSwatch: {
    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: C.primarySoft, color: C.primary, fontSize: 16,
  },
  moduleBadge: {
    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
    background: '#f1f5f9', color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.03em',
  },
  iconBtn: {
    width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.cardBorder}`,
    background: '#fff', cursor: 'pointer', color: C.muted, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 12,
  },
};
