import { useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import { createRevision } from '../../../api/sop-revisions.js';
import { fetchSections } from '../../../api/sop-sections.js';
import { fetchCategories } from '../../../api/sop-categories.js';
import { fetchTemplates } from '../../../api/sop-templates.js';
import { useToast } from '../../../components/common/Toast.js';
import FormModal from '../../../components/common/FormModal.js';
import { TEMPLATE_FILE_NAME, readSopWorkbook, templateSheets, type ImportRefs, type Rows } from './sopImport.js';

// Author Guides → "Import from a spreadsheet": download the template, fill it
// in, import it, and it becomes a Draft guide (opened in the editor to check
// and publish). A hook, so the page lays the actions out its own way; `ui` is
// the hidden file picker and the "fix these" pop-up, rendered once.

/** Today's sections, categories and guides — what the template lists and the import must match. */
async function loadRefs(): Promise<ImportRefs> {
  const [sections, categories, guides] = await Promise.all([fetchSections(), fetchCategories(), fetchTemplates()]);
  return {
    sections: sections.filter(s => !s.deletedAt),
    categories: categories.filter(c => !c.deletedAt),
    guides: guides.map(g => ({ id: g.id, title: g.title })),
  };
}

/** The wide "How to fill it in" column on the Guide sheet; other columns are narrower. */
const NOTE_COLUMN_WIDTH = 60;
const COLUMN_WIDTH = 32;

function downloadTemplate(refs: ImportRefs) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(templateSheets(refs))) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = rows[0].map((_, i) => ({ wch: i === 2 && name !== 'Lists' ? NOTE_COLUMN_WIDTH : COLUMN_WIDTH }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  XLSX.writeFile(wb, TEMPLATE_FILE_NAME);
}

async function readFile(file: File): Promise<Record<string, Rows>> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  return Object.fromEntries(wb.SheetNames.map(n => [n, XLSX.utils.sheet_to_json<Rows[number]>(wb.Sheets[n], { header: 1, defval: '' })]));
}

export function useSopImport(): {
  busy: 'template' | 'import' | null;
  downloadTemplate: () => void;
  chooseFile: () => void;
  ui: ReactNode;
} {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'template' | 'import' | null>(null);
  const [problems, setProblems] = useState<string[] | null>(null);

  const onDownload = async () => {
    setBusy('template');
    try { downloadTemplate(await loadRefs()); }
    catch (e) { showToast(e instanceof Error ? e.message : 'Couldn’t make the template', 'error'); }
    finally { setBusy(null); }
  };

  const onFile = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = ''; // the same file can be chosen again after fixing it
    if (!file) return;
    setBusy('import');
    try {
      const [sheets, refs] = await Promise.all([readFile(file), loadRefs()]);
      const result = readSopWorkbook(sheets, refs);
      if ('problems' in result) { setProblems(result.problems); return; }
      const draft = await createRevision(result.draft);
      qc.invalidateQueries({ queryKey: ['sop-revisions'] });
      showToast('Draft created');
      navigate(`/operations/sops/propose?fromRevision=${draft.id}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Couldn’t import that file', 'error');
    } finally {
      setBusy(null);
    }
  };

  const ui = (
    <>
      <input ref={fileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden
        onChange={e => onFile(e.target.files?.[0])} />
      {problems && (
        <FormModal title="Fix these, then import again" onClose={() => setProblems(null)} cancelLabel="Close">
          <p style={{ margin: '0 0 12px', fontSize: 14, color: '#334155' }}>Nothing was created.</p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8, maxHeight: 'min(50vh, 420px)', overflowY: 'auto' }}>
            {problems.map(p => (
              <li key={p} style={{ display: 'flex', gap: 8, fontSize: 14, color: '#0f172a', lineHeight: 1.45 }}>
                <FontAwesomeIcon icon={faCircleExclamation} style={{ color: '#b45309', marginTop: 3, flexShrink: 0 }} />
                {p}
              </li>
            ))}
          </ul>
        </FormModal>
      )}
    </>
  );

  return { busy, downloadTemplate: () => { void onDownload(); }, chooseFile: () => fileRef.current?.click(), ui };
}
