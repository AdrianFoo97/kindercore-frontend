import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SopTemplate } from '../api/sop-templates.js';
import { SopStep } from '../api/sop-steps.js';

const MARGIN = 40;
const PAGE_W = 595.28; // A4 pt
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;

// jsPDF's built-in fonts (helvetica/times/courier) only support the
// Windows-1252 code page — common typographic characters like curly
// quotes, em-dash, bullet, and ellipsis are in there and render fine, but
// anything outside it (arrows, math symbols, CJK, emoji) silently corrupts
// into garbled glyphs with broken letter-spacing instead of erroring.
// Admin-authored step text uses "→" for flow steps ("Log in → Picking"),
// so that's the one guaranteed to show up; map it and its obvious cousins
// to ASCII, and fall back to "?" for anything else out of range so a
// stray character degrades gracefully instead of corrupting the whole line.
const CHAR_REPLACEMENTS: Record<string, string> = {
  '→': '->', '←': '<-', '↔': '<->', '⇒': '=>', '⇐': '<=',
  '×': 'x', '÷': '/', '≈': '~', '≠': '!=', '≤': '<=', '≥': '>=',
};
function sanitizeForPdf(text: string): string {
  return text.replace(/[Ā-￿]/g, ch => {
    if (CHAR_REPLACEMENTS[ch]) return CHAR_REPLACEMENTS[ch];
    // Windows-1252's upper half (0x80–0x9F) covers curly quotes, dashes,
    // bullet, ellipsis, trademark, etc. — those map straight through fine.
    const code = ch.charCodeAt(0);
    if (code >= 0x2010 && code <= 0x2022) return ch; // dashes/quotes/bullet range jsPDF handles
    if (code === 0x2026) return ch; // ellipsis
    return code <= 0x00ff ? ch : '?';
  });
}

// Same "-" convention as the on-screen table (renderDetailLines in
// SopTemplateStepsPage.tsx) — a line is a bullet only if it's actually
// typed as one; everything else prints as a plain wrapped line.
function parseDetailLines(detail: string | null): { text: string; bullet: boolean }[] {
  return (detail ?? '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const m = /^-\s*(.*)$/.exec(line);
      return m ? { text: m[1], bullet: true } : { text: line, bullet: false };
    });
}

// Blank name/date signing lines for each certification stage — mirrors the
// "鉴定栏" (certification panel) at the bottom of the original source
// document (完成人/训练员/鉴定者), which is a physical sign-off form, not
// data pulled from a live observation record. The source template also had
// two follow-up sign-off stages (追踪人×2) — dropped here as unneeded.
const SIGNOFF_ROLES = ['Completed by (Trainee)', 'Trainer', 'Assessor'];

export function downloadSopPdf(template: SopTemplate, steps: SopStep[]) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = MARGIN;

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const pageCenterX = PAGE_W / 2;

  // Title — centered, matching the source template's title-page treatment.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  const titleLines = doc.splitTextToSize(sanitizeForPdf(template.title), CONTENT_W);
  ensureSpace(titleLines.length * 24);
  doc.text(titleLines, pageCenterX, y, { align: 'center' });
  y += titleLines.length * 24 + 2;

  // Document-type subtitle — matches the source template's own
  // "岗位观察检查表" (Position Observation Checklist) line under the title.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(120, 120, 120);
  ensureSpace(16);
  doc.text('POSITION OBSERVATION CHECKLIST', pageCenterX, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 22;

  // Purpose — "岗位目标" in the source template
  if (template.goal) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    ensureSpace(16);
    doc.text('PURPOSE', MARGIN, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const goalLines = doc.splitTextToSize(sanitizeForPdf(template.goal), CONTENT_W);
    ensureSpace(goalLines.length * 14);
    doc.text(goalLines, MARGIN, y);
    y += goalLines.length * 14 + 10;
  }

  // Video
  if (template.videoUrl) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    ensureSpace(16);
    doc.text('VIDEO', MARGIN, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(90, 103, 216);
    ensureSpace(14);
    doc.textWithLink(template.videoUrl, MARGIN, y, { url: template.videoUrl });
    doc.setTextColor(0, 0, 0);
    y += 20;
  }

  y += 6;

  // Steps table — 步骤 / 操作细节和标准, exactly the two columns the
  // source document uses, with a full-width section-header row between
  // groups instead of the source's plain third-column-blank convention.
  const sections = [...new Set(steps.map(s => s.section))];
  const bySection = new Map<string, SopStep[]>();
  for (const st of steps) {
    if (!bySection.has(st.section)) bySection.set(st.section, []);
    bySection.get(st.section)!.push(st);
  }

  const body: any[] = [];
  for (const section of sections) {
    body.push([{
      content: sanitizeForPdf(section.toUpperCase()),
      colSpan: 2,
      styles: { fontStyle: 'bold', fillColor: [238, 242, 255], textColor: [90, 103, 216], fontSize: 10.5 },
    }]);
    const sectionSteps = (bySection.get(section) ?? []).slice().sort((a, b) => a.displayOrder - b.displayOrder);
    sectionSteps.forEach((st, idx) => {
      const detail = parseDetailLines(st.detail)
        .map(({ text, bullet }) => sanitizeForPdf(bullet ? `•  ${text}` : text))
        .join('\n');
      body.push([sanitizeForPdf(`${idx + 1}. ${st.title}`), detail]);
    });
  }

  autoTable(doc, {
    startY: y,
    head: [['Step', 'Operation Details & Standard']],
    body,
    theme: 'grid',
    margin: { left: MARGIN, right: MARGIN, bottom: MARGIN },
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 7, valign: 'top', overflow: 'linebreak', lineColor: [225, 225, 232], lineWidth: 0.75 },
    headStyles: { fillColor: [90, 103, 216], textColor: 255, fontStyle: 'bold', fontSize: 10.5 },
    columnStyles: { 0: { cellWidth: 165, fontStyle: 'bold' }, 1: { cellWidth: CONTENT_W - 165 } },
  });

  // jspdf-autotable attaches the table's final Y position to the doc so
  // subsequent content can pick up right where the (auto-paginated) table
  // actually ended, without re-deriving page geometry ourselves.
  y = (doc as any).lastAutoTable.finalY + 34;

  // Sign-off panel — the source document's "鉴定栏" block. Blank name/date
  // lines for physical signing, in the same order; this isn't pulled from
  // a live SopObservation record. Labelled "Sign-off" rather than
  // "Certification" — nobody's issuing a credential here, they're just
  // recording who did/verified/confirmed the procedure and when.
  ensureSpace(30 + SIGNOFF_ROLES.length * 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('SIGN-OFF', MARGIN, y);
  y += 22;

  const labelW = 150;
  const dateLabelX = MARGIN + labelW + 190;
  doc.setDrawColor(180, 180, 180);
  for (const role of SIGNOFF_ROLES) {
    ensureSpace(30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.text(`${role}:`, MARGIN, y);
    doc.line(MARGIN + labelW, y + 2, dateLabelX - 20, y + 2);
    doc.text('Date:', dateLabelX, y);
    doc.line(dateLabelX + 35, y + 2, PAGE_W - MARGIN, y + 2);
    y += 30;
  }

  const fileName = `${template.title.replace(/[^\w\- ]+/g, '').trim() || 'How-To Guide'}.pdf`;
  doc.save(fileName);
}
