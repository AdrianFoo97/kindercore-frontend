import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDay, faCopy, faArrowUp, faArrowDown } from '@fortawesome/free-solid-svg-icons';
import { OperatingCostCategory } from '../../../api/operatingCost.js';
import { C, SIZE, SHADOW, MOTION, RADIUS, MONTH_FULL, cellKey, fmtRM, fmtRMCompact, RowState } from './shared.js';
import { ExpenseRow } from './ExpenseRow.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RowWithState {
  category: OperatingCostCategory;
  state: RowState;
}

interface CategoryPanelProps {
  groupName: string;
  rows: RowWithState[];                  // paginated + state-annotated
  totalCount: number;
  filledCount: number;
  missingCount: number;
  groupTotal: number;
  groupLastMonthTotal: number;
  values: Record<string, number>;
  lastMonthValues: Record<string, number>;
  selectedMonth: number;
  year: number;
  onCellChange: (categoryId: string, month: number, v: number) => void;
  onCopyRowFromLast: (categoryId: string, month: number, lastValue: number) => void;
  onCopyAllFromLast: () => void;
  hasAnyLastMonth: boolean;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}

// ── CategoryPanel ────────────────────────────────────────────────────────────

export function CategoryPanel({
  groupName, rows, totalCount, filledCount, missingCount,
  groupTotal, groupLastMonthTotal,
  values, lastMonthValues, selectedMonth, year,
  onCellChange, onCopyRowFromLast, onCopyAllFromLast, hasAnyLastMonth,
  page, totalPages, onPageChange,
}: CategoryPanelProps) {
  const now = new Date();
  const isCurrent = year === now.getFullYear() && selectedMonth === now.getMonth();
  const periodLabel = `${MONTH_FULL[selectedMonth]} ${year}`;

  if (totalCount === 0) {
    return (
      <section style={cardStyle}>
        <p style={emptyStyle}>No categories in {groupName}.</p>
      </section>
    );
  }

  return (
    <section style={cardStyle}>
      {/* Panel header */}
      <PanelHeader
        groupName={groupName}
        periodLabel={periodLabel}
        isCurrent={isCurrent}
        filledCount={filledCount}
        totalCount={totalCount}
        missingCount={missingCount}
        groupTotal={groupTotal}
        lastMonthTotal={groupLastMonthTotal}
        hasAnyLastMonth={hasAnyLastMonth}
        onCopyLastMonth={onCopyAllFromLast}
      />

      {/* Rows — rendered in original sort order */}
      <div>
        {rows.map((r, i) => (
          <ExpenseRow
            key={r.category.id}
            category={r.category}
            value={values[cellKey(r.category.id, selectedMonth)] ?? 0}
            lastMonthValue={lastMonthValues[r.category.id] ?? 0}
            state={r.state}
            isLast={i === rows.length - 1}
            onChange={v => onCellChange(r.category.id, selectedMonth, v)}
            onCopyLast={() =>
              onCopyRowFromLast(r.category.id, selectedMonth, lastMonthValues[r.category.id] ?? 0)
            }
          />
        ))}

        {/* Reserve space so the footer stays put on short pages */}
        {rows.length < SIZE.pageSize && (
          <div style={{
            height: (SIZE.pageSize - rows.length) * SIZE.rowHeight,
            background: C.card,
          }} />
        )}
      </div>

      {/* Subtotal footer */}
      <GroupSubtotalFooter
        groupName={groupName}
        total={groupTotal}
        lastMonthTotal={groupLastMonthTotal}
        filledCount={filledCount}
        totalCount={totalCount}
        missingCount={missingCount}
        hasAnyLastMonth={hasAnyLastMonth}
      />

      {/* Pagination */}
      <Pagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={onPageChange}
      />
    </section>
  );
}

// ── PanelHeader ──────────────────────────────────────────────────────────────

function PanelHeader({
  groupName, periodLabel, isCurrent, filledCount, totalCount, missingCount, groupTotal,
  lastMonthTotal, hasAnyLastMonth, onCopyLastMonth,
}: {
  groupName: string;
  periodLabel: string;
  isCurrent: boolean;
  filledCount: number;
  totalCount: number;
  missingCount: number;
  groupTotal: number;
  lastMonthTotal: number;
  hasAnyLastMonth: boolean;
  onCopyLastMonth: () => void;
}) {
  const delta = groupTotal - lastMonthTotal;
  const deltaPct = lastMonthTotal > 0 ? (delta / lastMonthTotal) * 100 : 0;
  const showDelta = hasAnyLastMonth && lastMonthTotal > 0 && delta !== 0;
  const deltaIsIncrease = delta > 0;
  const deltaColor = deltaIsIncrease ? C.red : C.green;
  const deltaBg = deltaIsIncrease ? '#fef2f2' : '#f0fdf4';

  return (
    <header style={{
      padding: `24px ${SIZE.cardPadX}px 22px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 32,
      borderBottom: `1px solid ${C.border}`,
    }}>
      {/* Left: title + period chip + subtitle */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
          <h2 style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 800,
            color: C.text,
            letterSpacing: '-0.02em',
          }}>{groupName}</h2>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            background: isCurrent ? C.primaryLight : C.hover,
            color: isCurrent ? C.primary : C.muted,
            border: `1px solid ${isCurrent ? C.primaryBorder : C.border}`,
            borderRadius: RADIUS.pill,
            fontSize: 11,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.01em',
          }}>
            <FontAwesomeIcon icon={faCalendarDay} style={{ fontSize: 9 }} />
            {periodLabel}
          </span>
        </div>
      </div>

      {/* Right: Copy last month action + Group Total block (horizontal) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        flexShrink: 0,
      }}>
        {hasAnyLastMonth && (
          <button
            type="button"
            onClick={onCopyLastMonth}
            className="occ-copy-btn"
            title={lastMonthTotal > 0
              ? `Fill every category with last month's values (total: ${fmtRMCompact(lastMonthTotal)})`
              : "Fill every category with last month's values"}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 14px',
              background: C.card,
              color: C.textSub,
              border: `1px solid ${C.border}`,
              borderRadius: RADIUS.control,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
              transition: `all ${MOTION.fast}`,
              letterSpacing: '-0.005em',
              whiteSpace: 'nowrap',
            }}
          >
            <FontAwesomeIcon icon={faCopy} style={{ fontSize: 11, color: C.primary }} />
            Copy last month
          </button>
        )}

        {/* Visual divider between action and total */}
        {hasAnyLastMonth && (
          <div style={{
            width: 1,
            alignSelf: 'stretch',
            background: C.border,
          }} />
        )}

        {/* Group Total block */}
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            color: C.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 5,
          }}>Group Total</div>
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            justifyContent: 'flex-end',
          }}>
            <div style={{
              fontSize: 30,
              fontWeight: 800,
              color: groupTotal > 0 ? C.text : C.dim,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
              letterSpacing: '-0.03em',
            }}>{fmtRM(groupTotal, { showZero: true })}</div>
            {showDelta && (
              <span
                title={`${deltaIsIncrease ? 'Up' : 'Down'} ${fmtRMCompact(Math.abs(delta))} (${Math.abs(deltaPct).toFixed(1)}%) from last month`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 9px',
                  background: deltaBg,
                  color: deltaColor,
                  borderRadius: RADIUS.pill,
                  fontSize: 11,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.005em',
                  whiteSpace: 'nowrap',
                }}
              >
                <FontAwesomeIcon icon={deltaIsIncrease ? faArrowUp : faArrowDown} style={{ fontSize: 9 }} />
                {Math.abs(deltaPct).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// ── GroupSubtotalFooter ──────────────────────────────────────────────────────

function GroupSubtotalFooter({
  groupName, total, lastMonthTotal, filledCount, totalCount, missingCount, hasAnyLastMonth,
}: {
  groupName: string;
  total: number;
  lastMonthTotal: number;
  filledCount: number;
  totalCount: number;
  missingCount: number;
  hasAnyLastMonth: boolean;
}) {
  const delta = total - lastMonthTotal;
  const deltaPct = lastMonthTotal > 0 ? (delta / lastMonthTotal) * 100 : 0;
  const showDelta = hasAnyLastMonth && lastMonthTotal > 0;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `18px ${SIZE.cardPadX}px`,
      borderTop: `1px solid ${C.border}`,
      background: C.subtleDense,
      gap: 16,
    }}>
      <div>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          color: C.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 3,
        }}>{groupName} Subtotal</div>
        <div style={{ fontSize: 11, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>
          {filledCount} of {totalCount} filled
          {missingCount > 0 && (
            <>
              {' · '}
              <span style={{ color: C.amber, fontWeight: 600 }}>{missingCount} still missing</span>
            </>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <div style={{
          fontSize: 22,
          fontWeight: 800,
          color: C.text,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
          letterSpacing: '-0.025em',
        }}>
          {fmtRM(total, { showZero: true })}
        </div>
        {showDelta && delta !== 0 && (
          <div style={{
            fontSize: 11,
            marginTop: 3,
            color: delta > 0 ? C.red : C.green,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.005em',
          }}>
            {delta > 0 ? '+' : '−'}{fmtRMCompact(Math.abs(delta))} ({delta > 0 ? '+' : '−'}{Math.abs(deltaPct).toFixed(1)}%) vs last month
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, totalCount, onPageChange }: {
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (p: number) => void;
}) {
  if (totalCount <= SIZE.pageSize) return null;
  const btn: React.CSSProperties = {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 7,
    padding: '5px 11px',
    fontSize: 12,
    fontWeight: 600,
    color: C.muted,
    cursor: 'pointer',
    fontFamily: 'inherit',
    minWidth: 30,
  };
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      padding: '12px 4px 14px',
      borderTop: `1px solid ${C.borderSoft}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button type="button" onClick={() => onPageChange(1)} disabled={page === 1} style={btn}>«</button>
        <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} style={btn}>‹</button>
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          color: C.primary,
          padding: '5px 14px',
          background: C.primaryLight,
          borderRadius: 7,
          fontVariantNumeric: 'tabular-nums',
          minWidth: 52,
          textAlign: 'center',
        }}>{page} / {totalPages}</span>
        <button type="button" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} style={btn}>›</button>
        <button type="button" onClick={() => onPageChange(totalPages)} disabled={page >= totalPages} style={btn}>»</button>
      </div>
      <span style={{ fontSize: 11, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>
        {((page - 1) * SIZE.pageSize) + 1}–{Math.min(page * SIZE.pageSize, totalCount)} of {totalCount}
      </span>
    </div>
  );
}

// ── Local styles ─────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: C.card,
  borderRadius: RADIUS.card,
  boxShadow: SHADOW.card,
  border: `1px solid ${C.border}`,
  overflow: 'hidden',
};

const emptyStyle: React.CSSProperties = {
  color: C.dim,
  fontSize: 14,
  textAlign: 'center',
  padding: '80px 0',
  margin: 0,
};
