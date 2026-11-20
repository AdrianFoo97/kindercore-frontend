import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faCircleExclamation, faFilePdf } from '@fortawesome/free-solid-svg-icons';
import { AI_FAILED, applyPnlImport, fetchImportStatus, readPnl, type ImportPreview } from '../../../api/pnlImport.js';
import { ApiError } from '../../../api/client.js';
import { usePermissions } from '../../../hooks/usePermissions.js';
import { useIsMobile } from '../../../hooks/useIsMobile.js';
import { useToast } from '../../../components/common/Toast.js';
import LoadingSpinner from '../../../components/common/LoadingSpinner.js';
import { buildApplyBody, initialState, type PlanState } from './importPlan.js';
import { ReviewPanel } from './ReviewPanel.js';
import { C } from '../operating-costs/shared.js';

// Finance → Operating Costs → Import P&L: choose the PDF, review what was
// read (checked against the file), decide each line, import. If the AI
// can't read it (or AI is off), the PDF's printed text is read instead —
// a problem with the AI never blocks an import.

const BACK = '/operations/operating-costs';

export default function ImportPnlPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { isMobile } = useIsMobile();
  const { isAdmin } = usePermissions();
  const fileInput = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [plan, setPlan] = useState<PlanState | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  /** The AI couldn't read this file — offer to try again or carry on without AI. */
  const [aiFailed, setAiFailed] = useState<{ file: File; message: string } | null>(null);
  const { data: status } = useQuery({ queryKey: ['operating-cost-import-status'], queryFn: fetchImportStatus, staleTime: 5 * 60_000 });
  const aiOff = status ? !status.available : false;

  const read = async (file: File | undefined, withoutAi = aiOff) => {
    if (!file) return;
    if (file.type !== 'application/pdf') { setProblem('Choose a PDF file.'); return; }
    setProblem(''); setAiFailed(null); setReading(true);
    try {
      const p = await readPnl(file, { withoutAi });
      setPreview(p);
      setPlan(initialState(p));
    } catch (e) {
      if (e instanceof ApiError && e.code === AI_FAILED) setAiFailed({ file, message: e.message });
      else setProblem(e instanceof Error ? e.message : 'Couldn’t read that file.');
    } finally {
      setReading(false);
    }
  };

  const doImport = async () => {
    if (!preview || !plan) return;
    setImporting(true);
    try {
      await applyPnlImport(buildApplyBody(preview, plan));
      const { year, month } = preview.period;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['operating-cost-entries', year] }),
        qc.invalidateQueries({ queryKey: ['operating-cost-categories'] }),
        qc.invalidateQueries({ queryKey: ['operating-cost-import-notices'] }),
        qc.invalidateQueries({ queryKey: ['operating-cost-import-history'] }),
      ]);
      showToast('P&L imported');
      navigate(`${BACK}?year=${year}&month=${month - 1}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Couldn’t import.', 'error');
      setImporting(false);
    }
  };

  const startOver = () => { setPreview(null); setPlan(null); setProblem(''); setAiFailed(null); };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: isMobile ? '20px 12px 48px' : '28px 32px 48px', boxSizing: 'border-box' }}>
      <style>{`@media (max-width: 767px) { .pnl-row { grid-template-columns: minmax(0, 1fr) auto !important; } .pnl-row > :last-child { grid-column: 1 / -1; } }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button type="button" onClick={() => navigate(BACK)} aria-label="Back to Operating Costs" title="Back" style={s.back}>
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>Import P&L</h1>
        <button type="button" onClick={() => navigate('/operations/operating-costs/imports')}
          style={{ marginLeft: 'auto', border: 'none', background: 'none', padding: 0, minHeight: 28, color: C.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          History
        </button>
      </div>

      {preview && plan ? (
        <ReviewPanel preview={preview} state={plan} onChange={setPlan} canAddCategory={isAdmin}
          importing={importing} onImport={doImport} onCancel={startOver} />
      ) : aiFailed ? (
        <section role="alert" style={s.failed} aria-label="The AI couldn’t read the file">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <FontAwesomeIcon icon={faCircleExclamation} style={{ color: C.amber, fontSize: 18, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>The AI couldn’t read this P&amp;L</div>
              <div style={{ fontSize: 13, color: C.textSub, marginTop: 4 }}>{aiFailed.message}</div>
              <div style={{ fontSize: 13, color: C.textSub, marginTop: 8 }}>
                You can carry on without AI: the PDF’s printed text is read instead, with the same checks — look over each line before importing.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" onClick={startOver} style={s.secondary}>Choose another file</button>
            <button type="button" onClick={() => void read(aiFailed.file, false)} style={s.secondary}>Try again with AI</button>
            <button type="button" onClick={() => void read(aiFailed.file, true)} style={s.primary}>Continue without AI</button>
          </div>
        </section>
      ) : reading ? (
        <div style={{ ...s.drop, cursor: 'default' }} role="status">
          <LoadingSpinner />
          <div style={{ fontSize: 14, color: C.textSub, marginTop: 12 }}>Reading the P&L and checking every amount…</div>
        </div>
      ) : (
        <>
          <div
            role="button" tabIndex={0} aria-label="Choose the P&L PDF"
            onClick={() => fileInput.current?.click()}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.current?.click(); } }}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); void read(e.dataTransfer.files[0]); }}
            style={{ ...s.drop, borderColor: dragging ? C.primary : C.dim, background: dragging ? C.primaryLight : '#fff' }}>
            <FontAwesomeIcon icon={faFilePdf} style={{ fontSize: 28, color: C.primary }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginTop: 12 }}>Drop the P&L PDF here, or click to choose it</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Only this month’s column is imported. Nothing is saved until you review it.</div>
            {aiOff && <div style={{ fontSize: 13, color: C.textSub, marginTop: 8 }}>AI is off, so the PDF’s printed text will be read instead.</div>}
          </div>
          <input ref={fileInput} type="file" accept="application/pdf" hidden onChange={e => { void read(e.target.files?.[0]); e.target.value = ''; }} />
          {problem && <p role="alert" style={{ marginTop: 16, fontSize: 14, color: C.red }}>{problem}</p>}
        </>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  back: { width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.muted, cursor: 'pointer', flexShrink: 0 },
  failed: { background: '#fff', border: '1px solid #fde68a', borderRadius: 12, padding: 24 },
  primary: { minHeight: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' },
  secondary: { minHeight: 36, padding: '0 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.textSub, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' },
  drop: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
    minHeight: 220, padding: 32, borderRadius: 12, border: '1px dashed', borderColor: C.dim, background: '#fff', cursor: 'pointer',
  },
};
