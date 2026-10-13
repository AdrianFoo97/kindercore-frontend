import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faPen, faTimes, faCheck, faTag } from '@fortawesome/free-solid-svg-icons';
import {
  fetchMarketingCampaigns, createMarketingCampaign, updateMarketingCampaign, deleteMarketingCampaign,
  MarketingCampaignRecord,
} from '../../api/marketing-campaigns.js';
import { useToast } from '../../components/common/Toast.js';
import { useDeleteDialog } from '../../components/common/DeleteDialog.js';

// Marketing campaigns — each has a promo code parents can enter on the
// public enquiry form, valid only while today falls within
// [startDate, endDate]. Same list+modal shape as the Settings catalog
// pages (e.g. MissionCategoriesPage.tsx), just living under the Marketing
// nav module instead of Settings since campaigns get created/retired as
// day-to-day marketing work, not config set once and left alone.

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#eef0f4',
  divider: '#eef0f3',
  text: '#0f172a',
  textSub: '#475569',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  primary: '#5a67d8',
  primarySoft: '#eef2ff',
  danger: '#dc2626',
};
const RADIUS = 14;
const RADIUS_SM = 8;
const SHADOW = '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)';

type Status = 'upcoming' | 'active' | 'ended';

function statusOf(c: MarketingCampaignRecord): Status {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(c.startDate);
  const end = new Date(c.endDate);
  if (today < start) return 'upcoming';
  if (today > end) return 'ended';
  return 'active';
}

const STATUS_STYLE: Record<Status, { label: string; bg: string; color: string }> = {
  upcoming: { label: 'Upcoming', bg: '#fef9c3', color: '#854d0e' },
  active: { label: 'Active', bg: '#dcfce7', color: '#166534' },
  ended: { label: 'Ended', bg: '#f1f5f9', color: '#64748b' },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MarketingCampaignsPage() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { confirm } = useDeleteDialog();

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['marketing-campaigns'],
    queryFn: fetchMarketingCampaigns,
  });

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<MarketingCampaignRecord | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['marketing-campaigns'] });

  const onSave = async (payload: { name: string; code: string; startDate: string; endDate: string }, isEdit: boolean) => {
    try {
      if (isEdit) {
        await updateMarketingCampaign(editing!.id, { name: payload.name, startDate: payload.startDate, endDate: payload.endDate });
        showToast('Campaign updated');
      } else {
        await createMarketingCampaign(payload);
        showToast('Campaign added');
      }
      invalidate();
      setEditorOpen(false); setEditing(null);
    } catch (e: any) {
      const msg = (() => { try { return JSON.parse(e?.message)?.message ?? e.message; } catch { return e?.message ?? 'Save failed'; } })();
      showToast(msg, 'error');
      throw e;
    }
  };

  const onDelete = async (c: MarketingCampaignRecord) => {
    await confirm({
      entityType: 'campaign',
      entityName: c.name,
      consequence: 'Its promo code will stop working on the enquiry form. Leads that already used it keep their record.',
      onConfirm: async () => {
        try {
          await deleteMarketingCampaign(c.id);
          invalidate();
          showToast('Campaign deleted');
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
          <h1 style={s.heading}>Campaigns</h1>
          <p style={s.subheading}>
            Marketing campaigns, each with a promo code parents can enter on the enquiry form. A code only works
            while today falls within its start and end date.
          </p>
        </div>

        <div style={s.card}>
          <div style={s.cardHeader}>
            <div>
              <h3 style={s.cardTitle}>Campaigns</h3>
              <div style={s.cardSub}>
                {campaigns.length === 0 ? 'No campaigns yet' : `${campaigns.length} campaign${campaigns.length === 1 ? '' : 's'}`}
              </div>
            </div>
            <button onClick={() => { setEditing(null); setEditorOpen(true); }} style={s.primaryBtn}>
              <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
              Add campaign
            </button>
          </div>

          {isLoading ? (
            <p style={{ padding: 24, color: C.mutedSoft, fontSize: 13 }}>Loading…</p>
          ) : campaigns.length === 0 ? (
            <p style={{ padding: 24, textAlign: 'center', color: C.muted, fontSize: 13 }}>
              No campaigns configured yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {campaigns.map(c => {
                const status = statusOf(c);
                const st = STATUS_STYLE[status];
                return (
                  <div key={c.id} style={s.row}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: status === 'active' ? C.primarySoft : '#f1f5f9', color: status === 'active' ? C.primary : C.mutedSoft, fontSize: 16,
                    }}>
                      <FontAwesomeIcon icon={faTag} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{c.name}</span>
                        <span style={{
                          fontSize: 12, fontWeight: 700, color: C.textSub, letterSpacing: '0.02em',
                          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                          padding: '2px 8px', borderRadius: 6, background: '#f1f5f9',
                        }}>{c.code}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                          background: st.bg, color: st.color, textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}>{st.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: C.mutedSoft, marginTop: 4 }}>
                        {fmtDate(c.startDate)} – {fmtDate(c.endDate)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => { setEditing(c); setEditorOpen(true); }} style={s.iconBtn} aria-label="Edit">
                        <FontAwesomeIcon icon={faPen} />
                      </button>
                      <button onClick={() => onDelete(c)} style={{ ...s.iconBtn, color: C.danger }} aria-label="Delete">
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {editorOpen && (
        <CampaignEditorModal
          campaign={editing}
          onCancel={() => { setEditorOpen(false); setEditing(null); }}
          onSave={onSave}
        />
      )}
    </div>
  );
}

function CampaignEditorModal({
  campaign, onCancel, onSave,
}: {
  campaign: MarketingCampaignRecord | null;
  onCancel: () => void;
  onSave: (payload: { name: string; code: string; startDate: string; endDate: string }, isEdit: boolean) => Promise<void>;
}) {
  const [name, setName] = useState(campaign?.name ?? '');
  const [code, setCode] = useState(campaign?.code ?? '');
  const [startDate, setStartDate] = useState(campaign?.startDate.slice(0, 10) ?? '');
  const [endDate, setEndDate] = useState(campaign?.endDate.slice(0, 10) ?? '');
  const [saving, setSaving] = useState(false);

  const isEdit = !!campaign;
  const codeValid = /^[A-Z0-9_-]+$/.test(code);
  const datesValid = !!startDate && !!endDate && startDate <= endDate;
  const canSave = name.trim().length > 0 && datesValid && (isEdit || codeValid);

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), code: isEdit ? campaign!.code : code.trim().toUpperCase(), startDate, endDate }, isEdit);
    } catch { /* error already toasted */ }
    finally { setSaving(false); }
  };

  return ReactDOM.createPortal(
    <div style={modal.overlay}>
      <div style={modal.dialog} onClick={e => e.stopPropagation()}>
        <div style={modal.header}>
          <div>
            <h2 style={modal.title}>{isEdit ? 'Edit campaign' : 'New campaign'}</h2>
            <div style={modal.subtitle}>
              {isEdit ? `Editing ${campaign!.name}` : 'A promo code valid for a specific date range'}
            </div>
          </div>
          <button onClick={onCancel} style={modal.closeBtn} aria-label="Close">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div style={modal.body}>
          <div style={modal.field}>
            <label style={modal.label}>Campaign name</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Chinese New Year 2026 — Facebook"
              style={modal.input}
            />
          </div>

          <div style={modal.field}>
            <label style={modal.label}>
              Promo code
              <span style={modal.labelHint}>What parents type on the form. Letters, numbers, underscore, dash.</span>
            </label>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
              disabled={isEdit}
              placeholder="CNY2026"
              style={{
                ...modal.input,
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                background: isEdit ? '#f8fafc' : '#fff',
                color: isEdit ? C.muted : C.text,
              }}
            />
          </div>

          <div style={modal.row2}>
            <div style={modal.field}>
              <label style={modal.label}>Start date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={modal.input} />
            </div>
            <div style={modal.field}>
              <label style={modal.label}>End date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={modal.input} />
            </div>
          </div>
          {startDate && endDate && startDate > endDate && (
            <p style={{ margin: '-10px 0 16px', fontSize: 12, color: C.danger }}>Start date must be on or before end date.</p>
          )}
        </div>

        <div style={modal.footer}>
          <button onClick={onCancel} style={modal.cancelBtn}>Cancel</button>
          <button
            onClick={submit}
            disabled={!canSave || saving}
            style={{ ...modal.saveBtn, opacity: !canSave || saving ? 0.5 : 1 }}
          >
            <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add campaign'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
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
    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
    border: `1px solid ${C.cardBorder}`, borderRadius: 12, background: '#fff',
  },
  iconBtn: {
    width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.cardBorder}`,
    background: '#fff', cursor: 'pointer', color: C.muted, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 12,
  },
};

const modal: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.42)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  dialog: {
    background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480,
    boxShadow: '0 24px 60px rgba(15,23,42,0.25)',
    maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '20px 24px 14px', borderBottom: `1px solid ${C.divider}`, gap: 12,
  },
  title: { margin: '0 0 2px', fontSize: 17, fontWeight: 700, color: C.text },
  subtitle: { fontSize: 12, color: C.muted },
  closeBtn: {
    width: 32, height: 32, borderRadius: 8, border: 'none',
    background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 14,
  },
  body: { padding: '20px 24px', overflowY: 'auto', flex: 1 },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: C.textSub, marginBottom: 6, letterSpacing: '0.01em' },
  labelHint: { display: 'block', fontSize: 11, fontWeight: 400, color: C.mutedSoft, marginTop: 2 },
  input: {
    width: '100%', padding: '10px 12px', fontSize: 13,
    border: `1px solid ${C.cardBorder}`, borderRadius: RADIUS_SM,
    outline: 'none', color: C.text, boxSizing: 'border-box',
  },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 10,
    padding: '14px 24px 20px', borderTop: `1px solid ${C.divider}`,
  },
  cancelBtn: {
    padding: '10px 18px', borderRadius: 10, border: `1px solid ${C.cardBorder}`,
    background: '#fff', color: C.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  saveBtn: {
    padding: '10px 18px', borderRadius: 10, border: 'none',
    background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
};
