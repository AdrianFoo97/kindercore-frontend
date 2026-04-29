import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faCircleInfo, faGraduationCap, faArrowRightArrowLeft, faTriangleExclamation, faBoxesStacked, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { runYearRollover, undoYearRollover, repairStuckRollovers, RolloverSummary, RolloverUndoSummary, RolloverRepairSummary } from '../../api/admin.js';
import { useToast } from '../../components/common/Toast.js';

const C = {
  bg: '#f8fafc', card: '#fff', border: '#e2e8f0', text: '#1e293b',
  muted: '#64748b', faint: '#94a3b8', primary: '#5a67d8', primaryLight: '#eef0fa',
  green: '#059669', greenBg: '#ecfdf5',
  amber: '#b45309', amberBg: '#fffbeb',
  red: '#dc2626', redBg: '#fef2f2',
};

export default function YearRolloverPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();
  // Refresh every query that depends on student/enrollment state.
  // The Revenue chart's `finance-summary` is the most user-visible one.
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['students'] });
    qc.invalidateQueries({ queryKey: ['enrollments'] });
    qc.invalidateQueries({ queryKey: ['finance-summary'] });
    qc.invalidateQueries({ queryKey: ['packages'] });
  };
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [summary, setSummary] = useState<RolloverSummary | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<RolloverSummary | null>(null);
  const [error, setError] = useState('');
  const [undoConfirmOpen, setUndoConfirmOpen] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [undoSummary, setUndoSummary] = useState<RolloverUndoSummary | null>(null);
  const [undoYear, setUndoYear] = useState(currentYear);
  const [repairYear, setRepairYear] = useState(currentYear);
  const [repairing, setRepairing] = useState(false);
  const [repairConfirmOpen, setRepairConfirmOpen] = useState(false);
  const [repairPreview, setRepairPreview] = useState<RolloverRepairSummary | null>(null);
  const [repairSummary, setRepairSummary] = useState<RolloverRepairSummary | null>(null);

  // Run a dry-run first so the admin can sanity-check the impact before
  // writing anything. Real run only happens after explicit confirmation.
  const handlePreview = async () => {
    setPreviewing(true); setError(''); setSummary(null);
    try {
      const result = await runYearRollover(year, true);
      setPreview(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  const handleRun = async () => {
    setSubmitting(true); setError('');
    try {
      const result = await runYearRollover(year, false);
      setSummary(result);
      setPreview(null);
      setUndoSummary(null);
      setConfirmOpen(false);
      invalidateAll();
      showToast(`Rollover to ${year} complete`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rollover failed');
    } finally {
      setSubmitting(false);
    }
  };

  // The year we're going to undo: from the most recent successful rollover
  // if one's still in state, otherwise from the manual undo-year input.
  const targetUndoYear = summary?.targetYear ?? undoYear;

  const handleUndo = async () => {
    setUndoing(true); setError('');
    try {
      const result = await undoYearRollover(targetUndoYear);
      setUndoSummary(result);
      setSummary(null);
      setUndoConfirmOpen(false);
      invalidateAll();
      showToast(`Rollover to ${targetUndoYear} undone`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Undo failed');
    } finally {
      setUndoing(false);
    }
  };

  const handleRepairPreview = async () => {
    setRepairing(true); setError(''); setRepairSummary(null);
    try {
      const result = await repairStuckRollovers(repairYear, true);
      setRepairPreview(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Repair preview failed');
    } finally {
      setRepairing(false);
    }
  };

  const handleRepair = async () => {
    setRepairing(true); setError('');
    try {
      const result = await repairStuckRollovers(repairYear, false);
      setRepairSummary(result);
      setRepairPreview(null);
      setRepairConfirmOpen(false);
      invalidateAll();
      showToast(`Repaired ${result.fixed.length} stuck student(s)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Repair failed');
    } finally {
      setRepairing(false);
    }
  };

  const repairResult = repairSummary ?? repairPreview;

  const result = summary ?? preview;

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <div style={s.breadcrumb}>
          <button onClick={() => navigate(-1)} style={s.backBtn} title="Back">
            <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 11 }} />
          </button>
          <span style={s.breadcrumbLink}>Admin</span>
          <span style={{ color: C.muted, fontSize: 11 }}>/</span>
          <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>Year Rollover</span>
        </div>

        <h1 style={s.heading}>Year Rollover</h1>
        <p style={{ margin: '8px 0 24px', fontSize: 13, color: C.muted, lineHeight: 1.55, maxWidth: 720 }}>
          Closes every active student's current enrolment on Dec 31 of last year and opens a new
          one on Jan 1 of the target year, automatically promoting them to the next age class.
          Students turning 7 are graduated. Missing target-year packages are auto-cloned from the
          previous year using the same prices.
        </p>

        {/* ── Form card ──────────────────────────────────────── */}
        <div style={s.card}>
          <h2 style={s.sectionTitle}>Target Year</h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' as const }}>
            <div style={{ width: 140 }}>
              <label style={s.label}>Roll over INTO</label>
              <select style={s.input} value={year} onChange={e => setYear(Number(e.target.value))}>
                {[currentYear, currentYear + 1, currentYear + 2].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, fontSize: 12, color: C.muted, lineHeight: 1.5, paddingBottom: 8 }}>
              Each active student currently on a {year - 1} package will move to the matching
              {' '}{year} package for their new age class.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="button" onClick={handlePreview} disabled={previewing || submitting} style={s.outlineBtn}>
              {previewing ? 'Computing…' : 'Preview'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={previewing || submitting}
              style={{ ...s.solidBtn, opacity: previewing || submitting ? 0.6 : 1, cursor: previewing || submitting ? 'not-allowed' : 'pointer' }}
            >
              Run rollover
            </button>
          </div>
          {error && <p style={{ marginTop: 12, fontSize: 12, color: C.red }}>{error}</p>}
        </div>

        {/* ── Undo a previous rollover ────────────────────── */}
        <div style={s.card}>
          <h2 style={s.sectionTitle}>Undo A Previous Rollover</h2>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
            Reverses a previous rollover. Deletes every <code style={s.codeChip}>Year rollover</code> enrolment
            created on Jan 1 of the chosen year, reopens the previous period for each student, and
            ungraduates any students closed by that rollover.
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' as const }}>
            <div style={{ width: 140 }}>
              <label style={s.label}>Year to undo</label>
              <select style={s.input} value={undoYear} onChange={e => setUndoYear(Number(e.target.value))}>
                {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, fontSize: 12, color: C.amber, lineHeight: 1.5, paddingBottom: 8 }}>
              <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 11, marginRight: 6 }} />
              Manual edits to a rolled-over student made <strong>after</strong> the rollover may be lost.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              type="button"
              onClick={() => setUndoConfirmOpen(true)}
              disabled={undoing}
              style={{ ...s.outlineBtn, color: C.amber, borderColor: '#fde68a' }}
            >
              <FontAwesomeIcon icon={faRotateLeft} style={{ fontSize: 11, marginRight: 6 }} />
              {undoing ? 'Undoing…' : `Undo rollover for ${undoYear}`}
            </button>
          </div>
        </div>

        {/* ── Repair stuck rollover students ──────────────────── */}
        <div style={s.card}>
          <h2 style={s.sectionTitle}>Repair Stuck Students</h2>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: C.muted, lineHeight: 1.55 }}>
            Finds students who have only one enrolment row that starts on Jan 1 of the chosen year
            and predates that boundary (i.e. they enrolled before the year but have no history).
            Replaces their enrolment with the matching previous-year package (same programme, age − 1).
            Use this when an undo couldn't reopen their previous period because the row was missing.
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' as const }}>
            <div style={{ width: 140 }}>
              <label style={s.label}>Stuck on year</label>
              <select style={s.input} value={repairYear} onChange={e => setRepairYear(Number(e.target.value))}>
                {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, fontSize: 12, color: C.muted, lineHeight: 1.5, paddingBottom: 8 }}>
              Run a Preview first to see exactly which students would be moved and to which package.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="button" onClick={handleRepairPreview} disabled={repairing} style={s.outlineBtn}>
              {repairing && !repairSummary ? 'Computing…' : 'Preview repair'}
            </button>
            <button
              type="button"
              onClick={() => setRepairConfirmOpen(true)}
              disabled={repairing}
              style={{ ...s.solidBtn, opacity: repairing ? 0.6 : 1, cursor: repairing ? 'not-allowed' : 'pointer' }}
            >
              Run repair
            </button>
          </div>
        </div>

        {/* ── Repair summary ─────────────────────────────────── */}
        {repairResult && (
          <>
            {repairSummary && (
              <div style={{ ...s.card, background: C.greenBg, borderColor: '#a7f3d0' }}>
                <div style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>
                  ✓ Repaired {repairSummary.fixed.length} stuck student{repairSummary.fixed.length === 1 ? '' : 's'}
                  {repairSummary.skipped.length > 0 ? `, skipped ${repairSummary.skipped.length}` : ''}.
                </div>
              </div>
            )}
            {!repairSummary && repairPreview && (
              <div style={{ ...s.card, background: C.amberBg, borderColor: '#fde68a' }}>
                <div style={{ fontSize: 13, color: C.amber, fontWeight: 600 }}>
                  Preview — {repairPreview.fixed.length} would be repaired,
                  {' '}{repairPreview.skipped.length} would be skipped. Click "Run repair" to commit.
                </div>
              </div>
            )}
            {repairResult.fixed.length > 0 && (
              <Section title="Will Be Moved" icon={faArrowRightArrowLeft}>
                {repairResult.fixed.map(f => (
                  <Row key={f.studentId} primary={f.childName} secondary={f.fromPackage} trailing={f.toPackage} trailingColor={C.primary} arrow />
                ))}
              </Section>
            )}
            {repairResult.skipped.length > 0 && (
              <Section title="Skipped" icon={faTriangleExclamation}>
                {repairResult.skipped.map(sk => (
                  <Row key={sk.studentId} primary={sk.childName} secondary={sk.reason} trailingColor={C.amber} />
                ))}
              </Section>
            )}
          </>
        )}

        {/* ── Result summary ─────────────────────────────────── */}
        {result && (
          <>
            {summary && (
              <div style={{ ...s.card, background: C.greenBg, borderColor: '#a7f3d0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' as const }}>
                <div style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>
                  ✓ Rollover to {summary.targetYear} completed.
                </div>
                <button
                  type="button"
                  onClick={() => setUndoConfirmOpen(true)}
                  disabled={undoing}
                  style={{ ...s.outlineBtn, color: C.amber, borderColor: '#fde68a', background: '#fff' }}
                >
                  <FontAwesomeIcon icon={faRotateLeft} style={{ fontSize: 11, marginRight: 6 }} />
                  Undo rollover
                </button>
              </div>
            )}
            {!summary && preview && (
              <div style={{ ...s.card, background: C.amberBg, borderColor: '#fde68a' }}>
                <div style={{ fontSize: 13, color: C.amber, fontWeight: 600 }}>
                  Preview — nothing has been changed yet. Click "Run rollover" to commit.
                </div>
              </div>
            )}

            {/* Counts strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
              <Stat icon={faBoxesStacked} label="Packages cloned" count={result.packagesCreated.length} />
              <Stat icon={faArrowRightArrowLeft} label="Students rolled over" count={result.rolledOver.length} accent={C.primary} />
              <Stat icon={faGraduationCap} label="Graduated" count={result.graduated.length} accent={C.green} />
              <Stat icon={faTriangleExclamation} label="Skipped" count={result.skipped.length} accent={result.skipped.length > 0 ? C.amber : C.faint} />
            </div>

            {result.packagesCreated.length > 0 && (
              <Section title="New Packages" icon={faBoxesStacked}>
                {result.packagesCreated.map(p => (
                  <Row key={p.id} primary={p.name} secondary={`${p.programme} · age ${p.age}`} trailing={p.price !== null ? `RM ${p.price.toLocaleString()}` : '—'} />
                ))}
              </Section>
            )}

            {result.rolledOver.length > 0 && (
              <Section title="Students Rolled Over" icon={faArrowRightArrowLeft}>
                {result.rolledOver.map(r => (
                  <Row key={r.studentId} primary={r.childName} secondary={r.fromPackage} trailing={r.toPackage} trailingColor={C.primary} arrow />
                ))}
              </Section>
            )}

            {result.graduated.length > 0 && (
              <Section title="Graduated" icon={faGraduationCap}>
                {result.graduated.map(g => (
                  <Row key={g.studentId} primary={g.childName} secondary={g.fromPackage} trailing={`Age ${g.age}`} trailingColor={C.green} />
                ))}
              </Section>
            )}

            {result.skipped.length > 0 && (
              <Section title="Skipped" icon={faTriangleExclamation}>
                {result.skipped.map(sk => (
                  <Row key={sk.studentId} primary={sk.childName} secondary={sk.reason} trailingColor={C.amber} />
                ))}
              </Section>
            )}
          </>
        )}

        {/* ── Undo summary ─────────────────────────────────── */}
        {undoSummary && (
          <>
            <div style={{ ...s.card, background: C.amberBg, borderColor: '#fde68a' }}>
              <div style={{ fontSize: 13, color: C.amber, fontWeight: 600 }}>
                ↶ Rollover to {undoSummary.targetYear} undone.
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
              <Stat icon={faArrowRightArrowLeft} label="Reopened" count={undoSummary.reopened.length} accent={C.primary} />
              <Stat icon={faGraduationCap} label="Un-graduated" count={undoSummary.ungraduated.length} accent={C.green} />
              <Stat icon={faTriangleExclamation} label="Skipped" count={undoSummary.skipped.length} accent={undoSummary.skipped.length > 0 ? C.amber : C.faint} />
            </div>
            {undoSummary.reopened.length > 0 && (
              <Section title="Reopened Periods" icon={faArrowRightArrowLeft}>
                {undoSummary.reopened.map(r => (
                  <Row key={r.studentId} primary={r.childName} secondary="Restored to pre-rollover period" trailing={r.restoredPackage} trailingColor={C.primary} />
                ))}
              </Section>
            )}
            {undoSummary.ungraduated.length > 0 && (
              <Section title="Un-graduated" icon={faGraduationCap}>
                {undoSummary.ungraduated.map(u => (
                  <Row key={u.studentId} primary={u.childName} secondary="Reactivated" trailing={u.restoredPackage} trailingColor={C.green} />
                ))}
              </Section>
            )}
            {undoSummary.skipped.length > 0 && (
              <Section title="Skipped" icon={faTriangleExclamation}>
                {undoSummary.skipped.map(sk => (
                  <Row key={sk.studentId} primary={sk.childName} secondary={sk.reason} trailingColor={C.amber} />
                ))}
              </Section>
            )}
          </>
        )}
      </div>

      {/* ── Confirm modal ─────────────────────────────────── */}
      {confirmOpen && (
        <div style={modal.backdrop} onClick={() => !submitting && setConfirmOpen(false)}>
          <div style={modal.card} onClick={e => e.stopPropagation()}>
            <h2 style={modal.title}>Run rollover to {year}?</h2>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
              This will close every active student's current enrolment and open a new one for {year}.
              The action is reversible (you can edit/delete enrolment periods individually) but it
              writes many rows. Re-runs are idempotent — students already on a {year} package will be skipped.
            </p>
            <div style={{ background: C.amberBg, border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', margin: '14px 0', fontSize: 12, color: C.amber, lineHeight: 1.5, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <FontAwesomeIcon icon={faCircleInfo} style={{ fontSize: 13, marginTop: 2 }} />
              <span>If you haven't run a Preview, you may want to do that first to see exactly what will change.</span>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setConfirmOpen(false)} disabled={submitting} style={s.outlineBtn}>
                Cancel
              </button>
              <button type="button" onClick={handleRun} disabled={submitting} style={{ ...s.solidBtn, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                {submitting ? 'Running…' : `Run rollover to ${year}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Repair confirm modal ────────────────────────── */}
      {repairConfirmOpen && (
        <div style={modal.backdrop} onClick={() => !repairing && setRepairConfirmOpen(false)}>
          <div style={modal.card} onClick={e => e.stopPropagation()}>
            <h2 style={modal.title}>Repair stuck students?</h2>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
              For each student stuck on a {repairYear} package with no history (enrolled before {repairYear}),
              this replaces their open enrolment with the matching {repairYear - 1} package — same programme,
              one age class lower. The enrolment's start date is unchanged.
            </p>
            <div style={{ background: C.amberBg, border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', margin: '14px 0', fontSize: 12, color: C.amber, lineHeight: 1.5, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <FontAwesomeIcon icon={faCircleInfo} style={{ fontSize: 13, marginTop: 2 }} />
              <span>Run Preview first if you haven't, to see exactly which students will be moved.</span>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setRepairConfirmOpen(false)} disabled={repairing} style={s.outlineBtn}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRepair}
                disabled={repairing}
                style={{ ...s.solidBtn, opacity: repairing ? 0.6 : 1, cursor: repairing ? 'not-allowed' : 'pointer' }}
              >
                {repairing ? 'Repairing…' : 'Run repair'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Undo confirm modal ──────────────────────────── */}
      {undoConfirmOpen && (
        <div style={modal.backdrop} onClick={() => !undoing && setUndoConfirmOpen(false)}>
          <div style={modal.card} onClick={e => e.stopPropagation()}>
            <h2 style={modal.title}>Undo rollover to {targetUndoYear}?</h2>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
              This will delete the {targetUndoYear} enrolment periods created by the rollover and
              reopen each student's previous period. Graduated students will be reactivated.
            </p>
            <div style={{ background: C.redBg, border: '1px solid #fecaca', borderRadius: 8, padding: '10px 12px', margin: '14px 0', fontSize: 12, color: C.red, lineHeight: 1.5, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 13, marginTop: 2 }} />
              <span>
                Any manual edits to a rolled-over student's data made <strong>after</strong> the
                rollover will be lost. Cloned packages stay in the database — they aren't deleted.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setUndoConfirmOpen(false)} disabled={undoing} style={s.outlineBtn}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUndo}
                disabled={undoing}
                style={{ ...s.solidBtn, background: C.amber, opacity: undoing ? 0.6 : 1, cursor: undoing ? 'not-allowed' : 'pointer' }}
              >
                {undoing ? 'Undoing…' : `Undo rollover for ${targetUndoYear}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function Stat({ icon, label, count, accent }: { icon: any; label: string; count: number; accent?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <FontAwesomeIcon icon={icon} style={{ fontSize: 11, color: C.faint }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent ?? C.text, fontVariantNumeric: 'tabular-nums' as any }}>
        {count}
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div style={{ ...s.card, padding: 0, overflow: 'hidden' as const }}>
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <FontAwesomeIcon icon={icon} style={{ fontSize: 12, color: C.muted }} />
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Row({
  primary, secondary, trailing, trailingColor, arrow,
}: {
  primary: string; secondary?: string; trailing?: string; trailingColor?: string; arrow?: boolean;
}) {
  return (
    <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: `1px solid #f1f5f9` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{primary}</div>
        {secondary && (
          <div style={{ marginTop: 2, fontSize: 11, color: C.muted }}>{secondary}</div>
        )}
      </div>
      {arrow && (
        <FontAwesomeIcon icon={faArrowRightArrowLeft} style={{ fontSize: 10, color: C.faint }} />
      )}
      {trailing && (
        <div style={{ fontSize: 13, fontWeight: 600, color: trailingColor ?? C.text, textAlign: 'right' as const }}>
          {trailing}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: C.text },
  inner: { maxWidth: 920, margin: '0 auto' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  backBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.border}`, background: C.card, color: C.muted, cursor: 'pointer' },
  breadcrumbLink: { fontSize: 13, fontWeight: 600, color: C.primary },
  heading: { fontSize: 22, fontWeight: 800, color: C.text, margin: 0 },
  card: { background: C.card, borderRadius: 12, padding: '20px 24px', border: `1px solid ${C.border}`, marginBottom: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 14px' },
  label: { fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 4, display: 'block' },
  input: { width: '100%', padding: '9px 12px', fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 8, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit', color: C.text, background: '#fff' },
  outlineBtn: { padding: '10px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.text, cursor: 'pointer', whiteSpace: 'nowrap' as const },
  solidBtn: { padding: '10px 22px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: C.primary, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' as const },
  codeChip: { padding: '1px 6px', borderRadius: 4, background: '#f1f5f9', color: '#475569', fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
};

const modal: Record<string, React.CSSProperties> = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  card: { background: '#fff', borderRadius: 14, padding: '24px 28px', width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' },
};
