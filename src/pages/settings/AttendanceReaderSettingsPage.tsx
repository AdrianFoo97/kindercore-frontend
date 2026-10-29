import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faShieldHalved, faTriangleExclamation, faKey, faCopy, faCheck, faRotate, faPowerOff, faServer, faIdBadge,
} from '@fortawesome/free-solid-svg-icons';
import {
  fetchReaderKeyStatus, generateReaderKey, clearReaderKey, attendanceScanUrl, ReaderKeyStatus,
} from '../../api/admin.js';
import ConfirmDialog from '../../components/common/ConfirmDialog.js';
import { useToast } from '../../components/common/Toast.js';

// Settings → Attendance Reader (Admin/Superadmin). Generates the secret the
// door RFID readers send as X-Reader-Key, which locks POST
// /api/attendance/scan to real readers (and signed-in staff). The key is
// shown once, at generation — only a hash is stored server-side.

const C = {
  bg: '#f8fafc', card: '#fff', border: '#e8ebf0', borderSoft: '#f1f3f6',
  text: '#0f172a', textSub: '#475569', muted: '#64748b', mutedSoft: '#94a3b8',
  primary: '#5a67d8', primarySoft: '#eef0fa',
  ok: '#15803d', okSoft: '#f0fdf4', okBorder: '#bbf7d0',
  warn: '#b45309', warnSoft: '#fffbeb', warnBorder: '#fde68a',
  danger: '#dc2626',
};
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const STATUS_KEY = ['attendance-reader-key'];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function AttendanceReaderSettingsPage() {
  const raw = localStorage.getItem('user');
  const role = raw ? (JSON.parse(raw) as { role?: string }).role : undefined;
  const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';
  const qc = useQueryClient();
  const { showToast } = useToast();

  const { data: status, isLoading, error } = useQuery({ queryKey: STATUS_KEY, queryFn: fetchReaderKeyStatus, enabled: isAdmin });
  const [newKey, setNewKey] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'regenerate' | 'off' | null>(null);

  const gen = useMutation({
    mutationFn: generateReaderKey,
    onSuccess: ({ key, status: s }) => { qc.setQueryData(STATUS_KEY, s); setNewKey(key); setConfirm(null); },
    onError: (e: Error) => showToast(e.message || 'Could not generate a key', 'error'),
  });
  const off = useMutation({
    mutationFn: clearReaderKey,
    onSuccess: s => { qc.setQueryData(STATUS_KEY, s); setNewKey(null); setConfirm(null); showToast('Reader key removed — the scanner is open again', 'success'); },
    onError: (e: Error) => showToast(e.message || 'Could not remove the key', 'error'),
  });

  if (!isAdmin) {
    return <div style={{ padding: 40, color: C.muted, fontFamily: 'system-ui, sans-serif' }}>This page is only available to Admins.</div>;
  }

  return (
    <div style={st.page}>
      <div style={st.inner}>
        <h1 style={st.h1}><FontAwesomeIcon icon={faIdBadge} style={{ color: C.primary, fontSize: 20, marginRight: 10 }} />Attendance Reader</h1>
        <p style={st.sub}>
          The RFID card readers at the door record attendance by sending each tap to the server. A reader key makes sure
          only your readers can do that — without one, anyone who knows a card number could record a tap and see that
          child’s name. Scans made by staff inside the app keep working either way.
        </p>

        {isLoading ? (
          <div style={st.card}>Checking…</div>
        ) : error || !status ? (
          <div style={st.card}>Couldn’t load the reader status. {(error as Error | null)?.message}</div>
        ) : (
          <>
            {newKey && <NewKeyPanel keyValue={newKey} onDone={() => setNewKey(null)} />}
            <StatusCard
              status={status}
              busy={gen.isPending || off.isPending}
              onGenerate={() => (status.configured ? setConfirm('regenerate') : gen.mutate())}
              onTurnOff={() => setConfirm('off')}
            />
            <SetupSteps />
          </>
        )}
      </div>

      {confirm === 'regenerate' && (
        <ConfirmDialog
          title="Generate a new reader key?"
          message="The current key stops working immediately. Every reader will be refused until you enter the new key on it — do this when you can update all readers straight away."
          confirmLabel="Generate new key"
          loading={gen.isPending}
          onConfirm={() => gen.mutate()}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'off' && (
        <ConfirmDialog
          title="Turn off reader protection?"
          message="The scanner will accept taps from anyone again, and reveal children’s names to whoever sends a valid card number. Readers will keep working."
          confirmLabel="Turn off"
          destructive
          loading={off.isPending}
          onConfirm={() => off.mutate()}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

function StatusCard({ status, busy, onGenerate, onTurnOff }: {
  status: ReaderKeyStatus; busy: boolean; onGenerate: () => void; onTurnOff: () => void;
}) {
  const on = status.configured;
  return (
    <div style={{ ...st.card, borderColor: on ? C.okBorder : C.warnBorder, background: on ? C.okSoft : C.warnSoft }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={st.statusIcon(on)}><FontAwesomeIcon icon={on ? faShieldHalved : faTriangleExclamation} /></div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: on ? C.ok : C.warn }}>
            {on ? 'Protected — only readers with the key can record taps' : 'Not protected — anyone can record a tap'}
          </div>
          {on && status.source === 'settings' && (
            <div style={st.meta}>
              Key <code style={st.code}>kcr_••••••••{status.hint}</code>
              {status.createdAt && <> · created {fmtDate(status.createdAt)}</>}
            </div>
          )}
          {on && status.source === 'env' && (
            <div style={st.meta}>
              <FontAwesomeIcon icon={faServer} style={{ fontSize: 11, marginRight: 6 }} />
              Set on the server (ATTENDANCE_READER_KEY) — change it there, not here.
            </div>
          )}
          {!on && <div style={st.meta}>Generate a key, then enter it on each reader.</div>}
        </div>
        {status.source !== 'env' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={onGenerate} disabled={busy} style={st.primaryBtn(busy)}>
              <FontAwesomeIcon icon={on ? faRotate : faKey} style={{ fontSize: 12 }} />
              {on ? 'Generate new key' : 'Generate key'}
            </button>
            {on && (
              <button onClick={onTurnOff} disabled={busy} style={st.ghostBtn(busy)}>
                <FontAwesomeIcon icon={faPowerOff} style={{ fontSize: 12 }} /> Turn off
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function NewKeyPanel({ keyValue, onDone }: { keyValue: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <div style={st.revealCard}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>Your new reader key</div>
      <div style={{ fontSize: 13, color: C.warn, fontWeight: 600, marginBottom: 12 }}>
        <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: 6 }} />
        Copy it now — for security it won’t be shown again. If you lose it, just generate a new one.
      </div>
      <div style={st.keyRow}>
        <code style={st.keyBox}>{keyValue}</code>
        <button
          onClick={async () => { try { await navigator.clipboard.writeText(keyValue); setCopied(true); } catch { /* clipboard blocked */ } }}
          style={st.copyBtn(copied)}
        >
          <FontAwesomeIcon icon={copied ? faCheck : faCopy} style={{ fontSize: 12 }} /> {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <button onClick={onDone} style={{ ...st.ghostBtn(false), marginTop: 12 }}>I’ve saved it</button>
    </div>
  );
}

function SetupSteps() {
  return (
    <div style={st.card}>
      <div style={st.sectionTitle}>Setting up a reader</div>
      <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: C.textSub, lineHeight: 1.8 }}>
        <li>Open the reader’s configuration (its web page or setup app).</li>
        <li>Make sure it sends taps to <code style={st.code}>{attendanceScanUrl()}</code></li>
        <li>Add a request header named <code style={st.code}>X-Reader-Key</code> with the key as its value.</li>
        <li>Tap a test card — it should appear on that student’s Attendance tab.</li>
      </ol>
      <div style={{ fontSize: 12, color: C.mutedSoft, marginTop: 10 }}>
        Do this on every reader before generating a new key, or the old readers will be refused until updated.
      </div>
    </div>
  );
}

const st = {
  page: { padding: '28px 32px 48px', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', background: C.bg, minHeight: '100%', color: C.text } as React.CSSProperties,
  inner: { maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 } as React.CSSProperties,
  h1: { margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center' } as React.CSSProperties,
  sub: { margin: '0 0 6px', fontSize: 13.5, color: C.muted, lineHeight: 1.6 } as React.CSSProperties,
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px' } as React.CSSProperties,
  statusIcon: (on: boolean): React.CSSProperties => ({
    width: 42, height: 42, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, background: '#fff', color: on ? C.ok : C.warn, border: `1px solid ${on ? C.okBorder : C.warnBorder}`,
  }),
  meta: { fontSize: 13, color: C.textSub, marginTop: 6 } as React.CSSProperties,
  code: { fontFamily: MONO, fontSize: 12.5, background: '#eef0f4', padding: '1px 6px', borderRadius: 4, color: C.text, wordBreak: 'break-all' } as React.CSSProperties,
  primaryBtn: (busy: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9, border: 'none',
    background: busy ? '#a5b4fc' : C.primary, color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
    cursor: busy ? 'default' : 'pointer',
  }),
  ghostBtn: (busy: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9,
    border: `1px solid ${C.border}`, background: '#fff', color: C.textSub, fontSize: 13, fontWeight: 600,
    fontFamily: 'inherit', cursor: busy ? 'default' : 'pointer',
  }),
  revealCard: { background: C.card, border: `2px solid ${C.primary}`, borderRadius: 12, padding: '18px 20px' } as React.CSSProperties,
  keyRow: { display: 'flex', gap: 8, alignItems: 'stretch', flexWrap: 'wrap' } as React.CSSProperties,
  keyBox: {
    flex: 1, minWidth: 240, fontFamily: MONO, fontSize: 14, fontWeight: 600, padding: '10px 12px', borderRadius: 8,
    background: '#f8fafc', border: `1px solid ${C.border}`, color: C.text, wordBreak: 'break-all', userSelect: 'all',
  } as React.CSSProperties,
  copyBtn: (copied: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    fontFamily: 'inherit', cursor: 'pointer', border: 'none',
    background: copied ? '#16a34a' : C.primary, color: '#fff', minHeight: 40,
  }),
  sectionTitle: { fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 } as React.CSSProperties,
};
