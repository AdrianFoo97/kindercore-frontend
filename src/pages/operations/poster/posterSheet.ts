import type { CSSProperties } from 'react';

// What every poster sheet shares — the A4 page box, its colours, and the
// print rules (only the print layer prints, one A4 sheet per page).

/** 210 mm at 96 dpi — the on-screen preview scales down from this. */
export const SHEET_PX = 794;

export const POSTER_C = { text: '#0f172a', sub: '#334155', muted: '#64748b', border: '#e2e8f0', bg: '#f1f5f9' };

export const sheetStyle: CSSProperties = {
  width: '210mm', height: '297mm', boxSizing: 'border-box', margin: '0 auto', overflow: 'hidden', background: '#fff',
  boxShadow: '0 1px 3px rgba(15,23,42,0.12)', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
};

// On screen the print layer is hidden; when printing, only it shows.
export const PRINT_CSS = `
  .poster-print { display: none; }
  @media print {
    @page { size: A4 portrait; margin: 0; }
    body > *:not(.poster-print) { display: none !important; }
    .poster-print { display: block; }
    .poster-print .poster-sheet { box-shadow: none !important; margin: 0 !important; break-after: page; }
    .poster-print .poster-sheet:last-child { break-after: auto; }
    .poster-print * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;
