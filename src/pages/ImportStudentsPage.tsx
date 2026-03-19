import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faXmark, faTriangleExclamation, faArrowRight, faFile, faArrowsRotate, faLink, faCircleQuestion } from '@fortawesome/free-solid-svg-icons';
import { fetchLeads } from '../api/leads.js';
import { createStudent } from '../api/students.js';
import { fetchPackages } from '../api/packages.js';
import { Lead, Package } from '../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ParsedRow {
  rowNum: number;
  childName: string;
  programme: string;
  startDate: string;
  notes: string;
  // resolved
  matchedLead?: Lead;
  matchedPackage?: Package;
  errors: string[];
  status: 'matched' | 'no-lead' | 'no-package' | 'duplicate' | 'error';
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeForMatch(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseDate(raw: unknown): string {
  if (!raw) return '';
  if (typeof raw === 'number') {
    // Excel serial date
    const d = new Date((raw - 25569) * 86400 * 1000);
    return d.toISOString().split('T')[0];
  }
  const s = String(raw).trim();
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Try DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  // Try Date parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return '';
}

function findHeader(headers: string[], ...candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex(h => h.toLowerCase().replace(/[_\s]/g, '').includes(c.toLowerCase().replace(/[_\s]/g, '')));
    if (idx >= 0) return idx;
  }
  return -1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function ImportStudentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropError, setDropError] = useState('');
  const [loading, setLoading] = useState(false);

  // Import state
  const [importTotal, setImportTotal] = useState(0);
  const [importDone, setImportDone] = useState(0);
  const [importFailed, setImportFailed] = useState<{ rowNum: number; childName: string; error: string }[]>([]);

  const matchableRows = rows.filter(r => r.status === 'matched');
  const unmatchedRows = rows.filter(r => r.status !== 'matched');

  // ── File processing ──

  const processFile = useCallback(async (file: File) => {
    setDropError('');
    setLoading(true);

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext ?? '')) {
      setDropError('Please upload a CSV or Excel file');
      setLoading(false);
      return;
    }

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (raw.length < 2) {
        setDropError('File has no data rows');
        setLoading(false);
        return;
      }

      const headers = (raw[0] as string[]).map(h => String(h ?? '').trim());
      const nameIdx = findHeader(headers, 'childName', 'child_name', 'name', 'student');
      const progIdx = findHeader(headers, 'programme', 'program', 'package');
      const startIdx = findHeader(headers, 'startDate', 'start_date', 'start');
      const notesIdx = findHeader(headers, 'notes', 'note', 'remark');

      if (nameIdx < 0) {
        setDropError('Could not find a "Child Name" column. Expected: childName, name, or student');
        setLoading(false);
        return;
      }

      // Fetch enrolled leads and packages for matching
      const [leadsResp, pkgs] = await Promise.all([
        fetchLeads(1, 2000, 'ENROLLED'),
        fetchPackages(),
      ]);
      const enrolledLeads = leadsResp.items;

      // Build name → lead map
      const leadsByName = new Map<string, Lead>();
      for (const l of enrolledLeads) {
        leadsByName.set(normalizeForMatch(l.childName), l);
      }

      // Check which leads already have students
      const leadsWithStudents = new Set<string>();
      // We can't easily check this without a new endpoint, so we'll rely on the 409 error during import

      const parsed: ParsedRow[] = [];
      const seenLeadIds = new Set<string>();

      for (let i = 1; i < raw.length; i++) {
        const r = raw[i] as unknown[];
        const childName = String(r[nameIdx] ?? '').trim();
        if (!childName) continue;

        const programme = progIdx >= 0 ? String(r[progIdx] ?? '').trim() : '';
        const startDate = startIdx >= 0 ? parseDate(r[startIdx]) : '';
        const notes = notesIdx >= 0 ? String(r[notesIdx] ?? '').trim() : '';
        const errors: string[] = [];

        const normalName = normalizeForMatch(childName);
        const matchedLead = leadsByName.get(normalName);

        let status: ParsedRow['status'] = 'matched';
        let matchedPackage: Package | undefined;

        if (!matchedLead) {
          status = 'no-lead';
          errors.push('No enrolled lead found with this name');
        } else if (seenLeadIds.has(matchedLead.id)) {
          status = 'duplicate';
          errors.push('Duplicate — this lead already appears in an earlier row');
        } else {
          seenLeadIds.add(matchedLead.id);

          // Try to match package
          if (programme) {
            const year = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear();
            const childAge = matchedLead.childDob
              ? Math.floor((new Date(year, 0, 1).getTime() - new Date(matchedLead.childDob).getTime()) / (365.25 * 86400000))
              : null;

            matchedPackage = pkgs.find(p =>
              p.programme.toLowerCase() === programme.toLowerCase() && p.year === year
              && (childAge !== null ? p.age === childAge : true)
            ) ?? pkgs.find(p =>
              p.programme.toLowerCase() === programme.toLowerCase() && p.year === year
            );

            if (!matchedPackage) {
              status = 'no-package';
              errors.push(`No package found for "${programme}" in ${year}`);
            }
          } else {
            // Try to find any package for this year
            const year = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear();
            const childAge = matchedLead.childDob
              ? Math.floor((new Date(year, 0, 1).getTime() - new Date(matchedLead.childDob).getTime()) / (365.25 * 86400000))
              : null;

            matchedPackage = pkgs.find(p =>
              p.year === year && (childAge !== null ? p.age === childAge : true)
            );

            if (!matchedPackage) {
              status = 'no-package';
              errors.push('No programme specified and could not auto-match a package');
            }
          }
        }

        parsed.push({
          rowNum: i + 1,
          childName,
          programme,
          startDate,
          notes,
          matchedLead,
          matchedPackage,
          errors,
          status,
        });
      }

      setRows(parsed);
      setFileName(file.name);
      setStep('preview');
    } catch (err) {
      setDropError(err instanceof Error ? err.message : 'Failed to read file');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Drag/drop ──

  const onDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const onDragLeave = () => setIsDragOver(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };
  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  // ── Import ──

  const runImport = async () => {
    const toImport = matchableRows;
    setStep('importing');
    setImportTotal(toImport.length);
    setImportDone(0);
    setImportFailed([]);

    const failed: typeof importFailed = [];

    for (const row of toImport) {
      try {
        const startDate = row.startDate || undefined;
        const enrolmentYear = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear();
        const enrolmentMonth = startDate ? new Date(startDate).getMonth() + 1 : new Date().getMonth() + 1;

        await createStudent({
          leadId: row.matchedLead!.id,
          enrolmentYear,
          enrolmentMonth,
          packageId: row.matchedPackage!.id,
          startDate,
          notes: row.notes || undefined,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        failed.push({ rowNum: row.rowNum, childName: row.childName, error: msg });
      }
      setImportDone(prev => prev + 1);
    }

    setImportFailed(failed);
    setStep('done');
  };

  const resetToUpload = () => {
    setStep('upload'); setRows([]); setFileName(''); setDropError('');
    setImportTotal(0); setImportDone(0); setImportFailed([]);
  };

  // ── Render ──

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <h1 style={s.heading}>Import Students</h1>
        <p style={s.subtitle}>
          Upload a CSV or Excel file to import students. Each student will be linked to an enrolled lead by matching child name.
        </p>

        {/* Step indicator */}
        <div style={s.stepRow}>
          {[
            { n: 1, label: 'Upload file' },
            { n: 2, label: 'Review matches' },
            { n: 3, label: 'Import' },
          ].map((st, i, arr) => {
            const current = step === 'upload' ? 1 : step === 'preview' ? 2 : step === 'importing' ? 3 : 3;
            const isActive = st.n === current;
            const isDone = st.n < current || step === 'done';
            return (
              <div key={st.n} style={s.stepItem}>
                <div style={{
                  ...s.stepCircle,
                  ...(isDone ? s.stepCircleDone : isActive ? s.stepCircleActive : s.stepCircleInactive),
                }}>
                  {isDone ? <FontAwesomeIcon icon={faCheck} /> : st.n}
                </div>
                <span style={{ ...s.stepLabel, fontWeight: isActive || isDone ? 600 : 400, color: isActive ? '#5a79c8' : isDone ? '#5b9a6f' : '#a0aec0' }}>
                  {st.label}
                </span>
                {i < arr.length - 1 && (
                  <div style={{ ...s.stepConnector, background: isDone ? '#5b9a6f' : '#e2e8f0' }} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Upload step ── */}
        {step === 'upload' && (
          <div>
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                ...s.dropZone,
                borderColor: isDragOver ? '#5a79c8' : dropError ? '#c47272' : '#cbd5e0',
                background: isDragOver ? '#f0f4fa' : '#fafbfc',
              }}
            >
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={onFileChange} style={{ display: 'none' }} />
              {loading ? (
                <p style={s.dropText}>Processing file...</p>
              ) : (
                <>
                  <p style={s.dropText}>
                    <FontAwesomeIcon icon={faFile} style={{ marginRight: 8 }} />
                    Drag & drop a file here, or <span style={{ color: '#5a79c8', fontWeight: 600, cursor: 'pointer' }}>browse</span>
                  </p>
                  <p style={s.dropHint}>Supports .csv, .xlsx, .xls</p>
                </>
              )}
              {dropError && <p style={{ ...s.dropText, color: '#c47272', marginTop: 8 }}>{dropError}</p>}
            </div>

            <div style={s.helpBox}>
              <FontAwesomeIcon icon={faCircleQuestion} style={{ color: '#94a3b8', marginRight: 8, flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Expected columns</div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                  <strong>childName</strong> (required) — must match an enrolled lead's name<br />
                  <strong>programme</strong> — e.g. "Half Day", "Full Day" (used to match a package)<br />
                  <strong>startDate</strong> — first day of school (YYYY-MM-DD or DD/MM/YYYY)<br />
                  <strong>notes</strong> — optional notes
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Preview step ── */}
        {step === 'preview' && (
          <div>
            <div style={s.fileSummary}>
              <FontAwesomeIcon icon={faFile} style={{ color: '#64748b', marginRight: 8 }} />
              <span style={{ fontWeight: 600, color: '#1e293b' }}>{fileName}</span>
              <span style={{ color: '#94a3b8', marginLeft: 8 }}>{rows.length} rows</span>
              <button onClick={resetToUpload} style={s.changFileBtn}>← Change file</button>
            </div>

            {/* Stats */}
            <div style={s.statGrid}>
              <div style={{ ...s.statCard, borderColor: '#bbf7d0', background: '#f0fdf4' }}>
                <div style={{ ...s.statValue, color: '#276749' }}>{matchableRows.length}</div>
                <div style={{ ...s.statLabel, color: '#5b9a6f' }}>Matched</div>
              </div>
              <div style={{ ...s.statCard, ...(unmatchedRows.length > 0 ? { borderColor: '#fed7d7', background: '#fff5f5' } : {}) }}>
                <div style={{ ...s.statValue, color: unmatchedRows.length > 0 ? '#c47272' : '#a0aec0' }}>{unmatchedRows.length}</div>
                <div style={{ ...s.statLabel, color: unmatchedRows.length > 0 ? '#c47272' : '#a0aec0' }}>Unmatched</div>
              </div>
            </div>

            {/* Matched rows table */}
            {matchableRows.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={s.sectionTitle}><FontAwesomeIcon icon={faLink} style={{ marginRight: 6, color: '#5b9a6f' }} /> Matched ({matchableRows.length})</h3>
                <div style={s.tableWrap}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        {['Row', 'Child Name', 'Lead Match', 'Package', 'Start Date'].map(h => (
                          <th key={h} style={s.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matchableRows.map(r => (
                        <tr key={r.rowNum}>
                          <td style={s.td}>{r.rowNum}</td>
                          <td style={s.td}>{r.childName}</td>
                          <td style={{ ...s.td, color: '#5b9a6f' }}>
                            <FontAwesomeIcon icon={faCheck} style={{ marginRight: 4 }} />
                            {r.matchedLead?.childName}
                          </td>
                          <td style={s.td}>{r.matchedPackage?.name ?? '—'}</td>
                          <td style={s.td}>{r.startDate || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Unmatched rows */}
            {unmatchedRows.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={s.sectionTitle}><FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: 6, color: '#c47272' }} /> Unmatched ({unmatchedRows.length})</h3>
                <div style={s.tableWrap}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        {['Row', 'Child Name', 'Issue'].map(h => (
                          <th key={h} style={s.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {unmatchedRows.map(r => (
                        <tr key={r.rowNum} style={{ background: '#fff5f5' }}>
                          <td style={s.td}>{r.rowNum}</td>
                          <td style={s.td}>{r.childName}</td>
                          <td style={{ ...s.td, color: '#c47272', fontSize: 12 }}>{r.errors.join('; ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={resetToUpload} style={s.btnSecondary}>Cancel</button>
              <button
                onClick={runImport}
                disabled={matchableRows.length === 0}
                style={{ ...s.btnPrimary, opacity: matchableRows.length === 0 ? 0.5 : 1 }}
              >
                Import {matchableRows.length} student{matchableRows.length !== 1 ? 's' : ''}
                <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 6 }} />
              </button>
            </div>
          </div>
        )}

        {/* ── Importing step ── */}
        {step === 'importing' && (
          <div style={s.centerCard}>
            <FontAwesomeIcon icon={faArrowsRotate} spin style={{ fontSize: 28, color: '#5a79c8', marginBottom: 16 }} />
            <div style={s.progressTrack}>
              <div style={{ ...s.progressBar, width: importTotal > 0 ? `${Math.round((importDone / importTotal) * 100)}%` : '0%' }} />
            </div>
            <p style={{ fontSize: 14, color: '#475569', marginTop: 12 }}>
              Importing student {Math.min(importDone + 1, importTotal)} of {importTotal}…
            </p>
            <p style={{ fontSize: 12, color: '#94a3b8' }}>Please do not close this tab.</p>
          </div>
        )}

        {/* ── Done step ── */}
        {step === 'done' && (() => {
          const succeeded = importTotal - importFailed.length;
          const allOk = importFailed.length === 0;
          const allFailed = succeeded === 0;

          return (
            <div>
              <div style={{
                ...s.centerCard,
                background: allOk ? '#f0fdf4' : allFailed ? '#fff5f5' : '#fffff0',
                border: `1px solid ${allOk ? '#bbf7d0' : allFailed ? '#fed7d7' : '#fde68a'}`,
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, color: '#fff', marginBottom: 16,
                  background: allOk ? '#5b9a6f' : allFailed ? '#c47272' : '#d69e2e',
                }}>
                  <FontAwesomeIcon icon={allOk ? faCheck : allFailed ? faXmark : faTriangleExclamation} />
                </div>
                <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#1e293b' }}>
                  {allOk ? 'All done!' : allFailed ? 'Import failed' : `${succeeded} of ${importTotal} imported`}
                </h2>
                <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>
                  {allOk
                    ? `${importTotal} student${importTotal !== 1 ? 's' : ''} created and linked to leads.`
                    : allFailed
                    ? 'All rows failed. Check the errors below.'
                    : `${importFailed.length} row${importFailed.length !== 1 ? 's' : ''} could not be imported.`}
                </p>
              </div>

              {importFailed.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <h3 style={s.sectionTitle}>Failed rows ({importFailed.length})</h3>
                  <div style={s.tableWrap}>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          {['Row', 'Child Name', 'Error'].map(h => (
                            <th key={h} style={s.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importFailed.map(f => (
                          <tr key={f.rowNum} style={{ background: '#fff5f5' }}>
                            <td style={s.td}>{f.rowNum}</td>
                            <td style={s.td}>{f.childName}</td>
                            <td style={{ ...s.td, color: '#c47272', fontSize: 12 }}>{f.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 24 }}>
                {!allFailed && (
                  <button
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ['students'] });
                      navigate('/students');
                    }}
                    style={s.btnPrimary}
                  >
                    View students <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 6 }} />
                  </button>
                )}
                <button onClick={resetToUpload} style={s.btnSecondary}>Import another file</button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: { padding: '32px 24px', fontFamily: 'system-ui, sans-serif', display: 'flex', justifyContent: 'center' },
  inner: { width: '100%', maxWidth: 720 },
  heading: { margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#8893a7', lineHeight: 1.5 },

  // Steps
  stepRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 28, marginTop: 20 },
  stepItem: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  stepCircle: { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 },
  stepCircleActive: { background: '#5a79c8', color: '#fff' },
  stepCircleDone: { background: '#5b9a6f', color: '#fff' },
  stepCircleInactive: { background: '#e2e8f0', color: '#a0aec0' },
  stepLabel: { fontSize: 13, whiteSpace: 'nowrap' as const },
  stepConnector: { height: 2, width: 32, margin: '0 8px', borderRadius: 1, flexShrink: 0 },

  // Drop zone
  dropZone: {
    border: '2px dashed #cbd5e0', borderRadius: 10, padding: '48px 24px',
    textAlign: 'center' as const, cursor: 'pointer', transition: 'all 0.15s',
  },
  dropText: { margin: 0, fontSize: 14, color: '#475569' },
  dropHint: { margin: '8px 0 0', fontSize: 12, color: '#94a3b8' },

  // Help box
  helpBox: {
    display: 'flex', alignItems: 'flex-start', gap: 4, padding: '14px 16px',
    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, marginTop: 16,
  },

  // File summary
  fileSummary: {
    display: 'flex', alignItems: 'center', padding: '10px 14px',
    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 16, fontSize: 13,
  },
  changFileBtn: {
    marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
    color: '#5a79c8', fontSize: 12, fontWeight: 600,
  },

  // Stats
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 16 },
  statCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 16px' },
  statValue: { fontSize: 28, fontWeight: 700, color: '#1e293b', lineHeight: 1.1 },
  statLabel: { fontSize: 12, color: '#718096', marginTop: 4 },

  // Section
  sectionTitle: { margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#1e293b' },

  // Table
  tableWrap: { borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  th: { padding: '8px 12px', textAlign: 'left' as const, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 11, fontWeight: 600, color: '#8893a7', textTransform: 'uppercase' as const },
  td: { padding: '8px 12px', borderBottom: '1px solid #f1f5f9', color: '#334155' },

  // Center card
  centerCard: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', textAlign: 'center' as const,
    padding: '36px 32px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff',
  },

  // Progress
  progressTrack: { width: '100%', maxWidth: 320, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
  progressBar: { height: '100%', background: '#5a79c8', borderRadius: 3, transition: 'width 0.3s ease' },

  // Buttons
  btnPrimary: {
    padding: '9px 20px', background: '#5a79c8', color: '#fff', border: 'none',
    borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  btnSecondary: {
    padding: '9px 20px', background: '#fff', color: '#64748b', border: '1px solid #e2e8f0',
    borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500,
  },
};
