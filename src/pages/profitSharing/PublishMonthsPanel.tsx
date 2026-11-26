import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faClockRotateLeft, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import {
  PROFIT_PUBLISH_FUNCTION, fetchPublications, publicationsKey, publishMonth, unpublishMonth,
  type PublicationMonth, type PublicationOverview,
} from '../../api/profitSharePublish.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { useToast } from '../../components/common/Toast.js';
import ConfirmDialog from '../../components/common/ConfirmDialog.js';
import LoadingSpinner from '../../components/common/LoadingSpinner.js';
import { MONTH_NAMES, changedSincePublished, publishRowState } from './publishState.js';

// Analysis → Profit Sharing → "Published to staff": each month of the year —
// its pool now, and whether staff can see it. Staff see a month on Pay only
// once it's published here. Publishing / taking back is the Finance
// Manager's (ANALYSIS_PROFIT_PUBLISH); everyone else on this page just sees the states.

const C = {
  card: '#ffffff', border: '#e2e8f0', divider: '#f1f5f9', text: '#0f172a', sub: '#334155', muted: '#64748b',
  accent: '#5a67d8', green: '#047857', greenSoft: '#ecfdf5', amber: '#b45309', amberSoft: '#fffbeb', red: '#b91c1c',
};
const MAX_REASON = 500;

const rm = (n: number) => `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });

export default function PublishMonthsPanel({ year }: { year: number }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { isMobile } = useIsMobile();
  const { hasView } = usePermissions();
  const canPublish = hasView(PROFIT_PUBLISH_FUNCTION);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: publicationsKey(year), queryFn: () => fetchPublications(year) });
  const [confirmPublish, setConfirmPublish] = useState<PublicationMonth | null>(null);
  const [takingBack, setTakingBack] = useState<PublicationMonth | null>(null);
  const [reason, setReason] = useState('');

  const done = (next: PublicationOverview, toast: string) => {
    qc.setQueryData(publicationsKey(year), next);
    qc.invalidateQueries({ queryKey: ['teacher-pay-pools'] });
    showToast(toast);
  };
  const publish = useMutation({
    mutationFn: (m: PublicationMonth) => publishMonth(year, m.monthIdx),
    onSuccess: next => { setConfirmPublish(null); done(next, 'Published to staff'); },
    onError: (e: Error) => showToast(e.message || 'Couldn’t publish', 'error'),
  });
  const takeBack = useMutation({
    mutationFn: (m: PublicationMonth) => unpublishMonth(year, m.monthIdx, reason.trim()),
    onSuccess: next => { setTakingBack(null); setReason(''); done(next, 'Taken back'); },
    onError: (e: Error) => showToast(e.message || 'Couldn’t take it back', 'error'),
  });

  return (
    <section aria-labelledby="ps-publish-title" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 24, overflow: 'hidden' }}>
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.divider}` }}>
        <h2 id="ps-publish-title" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>Published to staff · {year}</h2>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: C.muted }}>Staff see a month’s team pool and annual bonus on Pay only once it’s published here.</p>
      </div>

      {isLoading ? (
        <div style={{ padding: 24, textAlign: 'center' }}><LoadingSpinner /></div>
      ) : isError || !data ? (
        <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: C.muted }}>
          Couldn’t load what’s published. <button type="button" onClick={() => refetch()} style={linkBtn}>Retry</button>
        </div>
      ) : (
        <>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {data.months.map((m, i) => (
              <MonthRow key={m.monthIdx} month={m} first={i === 0} mobile={isMobile} canPublish={canPublish}
                onPublish={() => setConfirmPublish(m)} onTakeBack={() => { setReason(''); setTakingBack(m); }} />
            ))}
          </ol>
          {data.history.length > 0 && <History rows={data.history} />}
        </>
      )}

      {confirmPublish && (
        <ConfirmDialog
          title={`Publish ${MONTH_NAMES[confirmPublish.monthIdx]} ${year}?`}
          message={<>Staff will see {MONTH_NAMES[confirmPublish.monthIdx]}’s team pool of <strong>{rm(confirmPublish.livePool)}</strong> and annual-bonus contribution of <strong>{rm(confirmPublish.liveBonus)}</strong> on Pay, and get a notification. The amounts stay as they are now, even if the figures change later.</>}
          confirmLabel="Publish" loading={publish.isPending}
          onConfirm={() => publish.mutate(confirmPublish)} onCancel={() => setConfirmPublish(null)} />
      )}
      {takingBack && (
        <ConfirmDialog
          title={`Take back ${MONTH_NAMES[takingBack.monthIdx]} ${year}?`}
          destructive confirmLabel="Take back" loading={takeBack.isPending} disabled={!reason.trim()}
          message={
            <>
              <p style={{ margin: '0 0 12px' }}>Staff stop seeing this month’s team pool and annual bonus until it’s published again.</p>
              <label htmlFor="ps-reason" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: 6 }}>Reason</label>
              <textarea id="ps-reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={MAX_REASON} rows={3} autoFocus
                placeholder="e.g. Operating costs were entered twice"
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', fontSize: 14, fontFamily: 'inherit', border: `1px solid #cbd5e1`, borderRadius: 8, resize: 'vertical' }} />
            </>
          }
          onConfirm={() => takeBack.mutate(takingBack)} onCancel={() => setTakingBack(null)} />
      )}
    </section>
  );
}

function MonthRow({ month: m, first, mobile, canPublish, onPublish, onTakeBack }: {
  month: PublicationMonth; first: boolean; mobile: boolean; canPublish: boolean; onPublish: () => void; onTakeBack: () => void;
}) {
  const state = publishRowState(m);
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: mobile ? '12px 16px' : '12px 24px', borderTop: first ? 'none' : `1px solid ${C.divider}` }}>
      <span style={{ width: 96, fontSize: 14, fontWeight: 600, color: C.text }}>{MONTH_NAMES[m.monthIdx]}</span>
      <span style={{ flex: 1, minWidth: 180, fontSize: 13, color: C.sub }}>
        {state === 'published' && m.published && (
          <>
            <Pill tone="green" icon={faCheck}>Published · {rm(m.published.poolAmount)} pool · {rm(m.published.annualBonusAmount)} bonus</Pill>
            <span style={{ marginLeft: 8, fontSize: 12, color: C.muted }}>by {m.published.byName}, {day(m.published.publishedAt)}</span>
            {changedSincePublished(m) && (
              <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: C.amber }}>
                <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: 6 }} />
                The figures have changed since — it would be {rm(m.livePool)} pool · {rm(m.liveBonus)} bonus now.
              </span>
            )}
          </>
        )}
        {state === 'ready' && (<><Pill tone="amber">Not published</Pill><span style={{ marginLeft: 8, fontVariantNumeric: 'tabular-nums' }}>{rm(m.livePool)} pool · {rm(m.liveBonus)} bonus{m.liveHit ? '' : ' · target missed'}</span></>)}
        {state === 'not-finished' && <span style={{ color: C.muted }}>Month not finished</span>}
      </span>
      {canPublish && state === 'ready' && <button type="button" onClick={onPublish} style={primaryBtn}>Publish</button>}
      {canPublish && state === 'published' && <button type="button" onClick={onTakeBack} style={secondaryBtn}>Take back</button>}
    </li>
  );
}

function Pill({ tone, icon, children }: { tone: 'green' | 'amber'; icon?: typeof faCheck; children: React.ReactNode }) {
  const [bg, color] = tone === 'green' ? [C.greenSoft, C.green] : [C.amberSoft, C.amber];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 10px', borderRadius: 999, background: bg, color, fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
      {icon && <FontAwesomeIcon icon={icon} style={{ fontSize: 10 }} />}
      {children}
    </span>
  );
}

/** Every publish / take-back, newest first — who, when, and why it was taken back. */
function History({ rows }: { rows: PublicationOverview['history'] }) {
  return (
    <details style={{ borderTop: `1px solid ${C.divider}`, padding: '12px 24px' }}>
      <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.sub, minHeight: 28, display: 'flex', alignItems: 'center', gap: 8 }}>
        <FontAwesomeIcon icon={faClockRotateLeft} style={{ fontSize: 12, color: C.muted }} /> History
      </summary>
      <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, fontSize: 12, color: C.sub }}>
        {rows.map((h, i) => (
          <li key={i} style={{ padding: '4px 0' }}>
            <strong>{MONTH_NAMES[h.month]}</strong> — {h.action === 'PUBLISHED' ? `published (${rm(h.poolAmount ?? 0)} pool · ${rm(h.annualBonusAmount ?? 0)} bonus)` : `taken back: “${h.reason}”`} · {h.byName}, {day(h.at)}
          </li>
        ))}
      </ul>
    </details>
  );
}

const primaryBtn: React.CSSProperties = {
  minHeight: 32, padding: '0 16px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff',
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
};
const secondaryBtn: React.CSSProperties = {
  minHeight: 32, padding: '0 16px', borderRadius: 8, border: `1px solid #cbd5e1`, background: '#fff', color: C.sub,
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
};
const linkBtn: React.CSSProperties = { border: 'none', background: 'none', color: C.accent, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 };
