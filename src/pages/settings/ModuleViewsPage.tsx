import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faEye, faLinkSlash, faPlus } from '@fortawesome/free-solid-svg-icons';
import { fetchAuthViews, updateAuthView, AuthViewRecord } from '../../api/auth-views.js';
import { MODULE_LABELS, ModuleKey } from '../../constants/authModules.js';
import { useToast } from '../../components/common/Toast.js';
import ConfirmDialog from '../../components/common/ConfirmDialog.js';

// Module-first mirror of AuthViewsPage.tsx — same data (fetchAuthViews),
// just grouped by one module instead of listed flat. Adding/removing here
// only edits that view's `modules` array via the existing updateAuthView
// endpoint; it never touches what any Access Role has already granted.
//
//   /settings/modules/:moduleKey

const C = {
  primary: '#5a67d8', primarySoft: '#eef2ff',
  bg: '#f8fafc', card: '#ffffff', cardBorder: '#eef0f4',
  text: '#0f172a', muted: '#64748b', mutedSoft: '#94a3b8',
  border: '#e2e8f0', divider: '#eceef2', danger: '#ef4444',
};
const RADIUS = 14;
const SHADOW = '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)';

function parseApiError(e: any): string {
  try { return JSON.parse(e?.message)?.message ?? e.message; } catch { return e?.message ?? 'Something went wrong'; }
}

export default function ModuleViewsPage() {
  const { moduleKey } = useParams<{ moduleKey: string }>();
  const m = moduleKey as ModuleKey;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();

  const { data: views = [], isLoading } = useQuery({
    queryKey: ['auth-views'],
    queryFn: fetchAuthViews,
  });

  const [removing, setRemoving] = useState<AuthViewRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const label = MODULE_LABELS[m];

  if (!isLoading && !label) {
    return (
      <div style={s.page}>
        <div style={s.inner}>
          <p style={{ color: C.muted }}>Unknown module.</p>
          <Link to="/settings/modules" style={s.crumbLink}>Back to Modules</Link>
        </div>
      </div>
    );
  }

  const assigned = views.filter(v => v.modules.includes(m));
  const unassigned = views.filter(v => !v.modules.includes(m));

  const addExisting = async (v: AuthViewRecord) => {
    setBusyId(v.id);
    try {
      await updateAuthView(v.id, { modules: [...v.modules, m] });
      qc.invalidateQueries({ queryKey: ['auth-views'] });
      showToast(`${v.label} added to ${label}`);
    } catch (e: any) {
      showToast(parseApiError(e), 'error');
    }
    setBusyId(null);
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setBusyId(removing.id);
    try {
      await updateAuthView(removing.id, { modules: removing.modules.filter(x => x !== m) });
      qc.invalidateQueries({ queryKey: ['auth-views'] });
      showToast(`${removing.label} removed from ${label}`);
      setRemoving(null);
    } catch (e: any) {
      showToast(parseApiError(e), 'error');
    }
    setBusyId(null);
  };

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <div style={s.breadcrumb}>
          <button onClick={() => navigate('/settings/modules')} style={s.backBtn} title="Back">
            <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 11 }} />
          </button>
          <Link to="/settings/modules" style={s.crumbLink}>Modules</Link>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: C.mutedSoft }} />
          <span style={s.crumbCurrent}>{label ?? m}</span>
        </div>

        <h1 style={s.heading}>{label ?? m} — Views</h1>
        <p style={s.subheading}>
          What an Access Role is offered to pick from once it's granted the {label ?? m} module.
        </p>

        <div style={s.card}>
          <div style={s.cardHeader}>
            <div>
              <h3 style={s.cardTitle}>Assigned</h3>
              <div style={s.cardSub}>
                {isLoading ? '…' : assigned.length === 0 ? 'No views yet' : `${assigned.length} view${assigned.length === 1 ? '' : 's'}`}
              </div>
            </div>
            <button onClick={() => navigate(`/settings/auth-views/new?module=${m}`)} style={s.primaryBtn}>
              <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
              Create new view
            </button>
          </div>

          {isLoading ? (
            <p style={{ padding: 24, color: C.mutedSoft, fontSize: 13 }}>Loading…</p>
          ) : assigned.length === 0 ? (
            <p style={{ padding: 24, textAlign: 'center', color: C.muted, fontSize: 13 }}>
              No views assigned to {label} yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {assigned.map(v => {
                const isOnly = v.modules.length <= 1;
                return (
                  <div key={v.id} style={s.row}>
                    <div style={s.iconSwatch}>
                      <FontAwesomeIcon icon={faEye} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>
                        {v.label}
                      </span>
                      <div style={{ fontSize: 11, color: C.mutedSoft, fontFamily: 'ui-monospace, monospace', marginTop: 3 }}>
                        {v.key}
                      </div>
                      {v.description && (
                        <p style={{ margin: '6px 0 0', fontSize: 12, color: C.mutedSoft, lineHeight: 1.5 }}>
                          {v.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setRemoving(v)}
                      disabled={isOnly}
                      title={isOnly ? "A view needs at least one module — edit it directly to remove its last one." : `Remove from ${label}`}
                      style={{ ...s.iconBtn, color: isOnly ? C.mutedSoft : C.danger, cursor: isOnly ? 'default' : 'pointer' }}
                    >
                      <FontAwesomeIcon icon={faLinkSlash} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!isLoading && unassigned.length > 0 && (
          <div style={s.card}>
            <h3 style={s.cardTitle}>Add an existing view</h3>
            <p style={s.help}>
              Views currently defined under other module(s) — add {label} as one of their modules too, instead of
              creating a duplicate.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {unassigned.map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => addExisting(v)}
                  disabled={busyId === v.id}
                  style={{ ...s.chip, opacity: busyId === v.id ? 0.6 : 1, cursor: busyId === v.id ? 'default' : 'pointer' }}
                  title={v.description ?? undefined}
                >
                  <FontAwesomeIcon icon={faPlus} style={{ fontSize: 10 }} />
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {removing && (
        <ConfirmDialog
          title={`Remove "${removing.label}" from ${label}?`}
          message="The view itself won't be deleted — it stays under its other module(s), and any Access Role that already grants it keeps granting it. This only unlinks it from this module's picker."
          confirmLabel="Remove"
          loading={busyId === removing.id}
          onConfirm={confirmRemove}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: '24px 32px', background: C.bg, minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', color: C.text,
  },
  inner: { maxWidth: 760, margin: '0 auto' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 12, flexWrap: 'wrap', rowGap: 4 },
  crumbLink: { color: C.muted, textDecoration: 'none', fontWeight: 500 },
  crumbCurrent: { color: C.text, fontWeight: 600 },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.border}`,
    background: C.card, color: C.muted, cursor: 'pointer', transition: 'all 160ms ease',
  },
  heading: { margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' },
  subheading: { margin: '0 0 20px', fontSize: 13, color: C.muted, lineHeight: 1.5 },
  card: {
    background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS, padding: '22px 26px',
    boxShadow: SHADOW, marginBottom: 20,
  },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' },
  cardTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' },
  cardSub: { fontSize: 11, color: C.mutedSoft, marginTop: 2 },
  primaryBtn: {
    padding: '8px 16px', borderRadius: 10, border: 'none',
    background: C.primary, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  help: { margin: '4px 0 0', fontSize: 11, color: C.mutedSoft, lineHeight: 1.5 },
  row: {
    display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px',
    border: `1px solid ${C.cardBorder}`, borderRadius: 12, background: '#fff',
  },
  iconSwatch: {
    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: C.primarySoft, color: C.primary, fontSize: 16,
  },
  iconBtn: {
    width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.cardBorder}`,
    background: '#fff', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 12,
  },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
    border: `1px solid ${C.border}`, background: '#fff', color: C.text,
  },
};
