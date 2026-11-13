// How-To Guides list → page switcher: « ‹ 2 / 5 › » and "11–20 of 43".
// Hidden when everything fits on one page.

const BORDER = '#eef0f4';
const DIVIDER = '#f1f5f9';
const MUTED = '#64748b';

export default function SopPagination({ page, pageCount, totalCount, pageSize, onPageChange }: {
  page: number;
  pageCount: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  if (totalCount <= pageSize) return null;
  const btn: React.CSSProperties = {
    background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 7,
    minHeight: 32, minWidth: 32, padding: '0 10px', fontSize: 13, fontWeight: 600, color: MUTED,
    cursor: 'pointer', fontFamily: 'inherit',
  };
  return (
    <nav aria-label="Pages" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      padding: '16px 4px 4px', marginTop: 8, borderTop: `1px solid ${DIVIDER}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button type="button" aria-label="First page" title="First page" onClick={() => onPageChange(1)} disabled={page === 1} style={btn}>«</button>
        <button type="button" aria-label="Previous page" title="Previous page" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} style={btn}>‹</button>
        <span style={{
          fontSize: 13, fontWeight: 700, color: 'var(--sop-accent)', padding: '6px 14px',
          background: 'var(--sop-accent-soft)', borderRadius: 7, fontVariantNumeric: 'tabular-nums',
          minWidth: 52, textAlign: 'center',
        }}>{page} / {pageCount}</span>
        <button type="button" aria-label="Next page" title="Next page" onClick={() => onPageChange(Math.min(pageCount, page + 1))} disabled={page >= pageCount} style={btn}>›</button>
        <button type="button" aria-label="Last page" title="Last page" onClick={() => onPageChange(pageCount)} disabled={page >= pageCount} style={btn}>»</button>
      </div>
      <span style={{ fontSize: 12, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
        {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount}
      </span>
    </nav>
  );
}
