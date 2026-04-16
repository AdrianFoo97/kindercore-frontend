import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { faCalendar } from '@fortawesome/free-solid-svg-icons';
import {
  fetchOperatingCostCategories,
  fetchOperatingCostGroups,
  fetchOperatingCostEntries,
  bulkUpsertOperatingCostEntries,
  OperatingCostCategory,
} from '../../api/operatingCost.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { useToast } from '../../components/common/Toast.js';
import { FilterPillStyles, PillSelect, PillToggle } from '../../components/common/FilterPill.js';
import { CategorySidebar, SidebarGroup } from './operating-costs/CategorySidebar.js';
import { CategoryPanel, RowWithState } from './operating-costs/CategoryPanel.js';
import { StickySaveBar } from './operating-costs/StickySaveBar.js';
import { C, SIZE, MONTH_LABELS, cellKey, fmtRMCompact, computeRowState } from './operating-costs/shared.js';

// ── Types ────────────────────────────────────────────────────────────────────

type ViewMode = 'month' | 'year';

export default function OperatingCostsPage() {
  const { isMobile } = useIsMobile();
  const { showToast } = useToast();
  const qc = useQueryClient();

  // ── Filter state ───────────────────────────────────────────────────────────
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const [activeGroupName, setActiveGroupName] = useState('');
  const [page, setPage] = useState(1);

  // ── Entry draft state ──────────────────────────────────────────────────────
  // flat map "categoryId|month" -> number
  const [values, setValues] = useState<Record<string, number>>({});
  const [originalValues, setOriginalValues] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: categories = [] } = useQuery({
    queryKey: ['operating-cost-categories'],
    queryFn: fetchOperatingCostCategories,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  // Groups are fetched separately so empty groups (e.g. HR Benefits with no
  // categories yet) still appear in the sidebar.
  const { data: groups = [] } = useQuery({
    queryKey: ['operating-cost-groups'],
    queryFn: fetchOperatingCostGroups,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const { data: entriesData, isLoading: entriesLoading } = useQuery({
    queryKey: ['operating-cost-entries', year],
    queryFn: () => fetchOperatingCostEntries(year),
    refetchOnMount: 'always',
    staleTime: 0,
  });

  // If selected month is January, "last month" is December of the previous
  // year, so we need a secondary fetch. Otherwise the same-year data suffices.
  const needsPrevYear = selectedMonth === 0;
  const { data: prevYearEntriesData } = useQuery({
    queryKey: ['operating-cost-entries', year - 1],
    queryFn: () => fetchOperatingCostEntries(year - 1),
    enabled: needsPrevYear,
    staleTime: 0,
  });

  // ── Hydrate values from saved entries + category defaults ──────────────────
  // originalValues tracks ONLY what's actually in the DB. values tracks what
  // the user sees (server data + unsaved default prefills). This way, applying
  // defaults is a real pending change that shows up in the sticky save bar on
  // first visit — the user clicks Save once and the defaults become real rows.
  useEffect(() => {
    if (!entriesData || categories.length === 0) return;
    const serverSnapshot: Record<string, number> = {};
    for (const row of entriesData.rows) {
      serverSnapshot[cellKey(row.categoryId, row.month)] = row.amount;
    }
    const draft: Record<string, number> = { ...serverSnapshot };
    for (const cat of categories) {
      if (cat.defaultAmount == null || cat.defaultAmount <= 0) continue;
      for (let m = 0; m < 12; m++) {
        const k = cellKey(cat.id, m);
        if (draft[k] === undefined) draft[k] = cat.defaultAmount;
      }
    }
    setValues(draft);
    setOriginalValues(serverSnapshot);
  }, [entriesData, categories]);

  // ── Derived: grouped categories ────────────────────────────────────────────
  // Seed the map with every group (including empty ones) so they appear in the
  // sidebar, then populate with categories and sort each bucket.
  const grouped = useMemo(() => {
    const g = new Map<string, OperatingCostCategory[]>();
    const sortedGroups = [...groups].sort((a, b) => a.sortOrder - b.sortOrder);
    for (const grp of sortedGroups) g.set(grp.name, []);
    for (const c of categories) {
      const list = g.get(c.groupName) ?? [];
      list.push(c);
      g.set(c.groupName, list);
    }
    for (const list of g.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);
    return [...g.entries()];
  }, [categories, groups]);

  // Default to the first group on first load
  useEffect(() => {
    if (!activeGroupName && grouped.length > 0) {
      setActiveGroupName(grouped[0][0]);
    }
  }, [grouped, activeGroupName]);

  // Reset pagination on group/view change
  useEffect(() => { setPage(1); }, [activeGroupName, viewMode]);

  // ── Derived: last-month reference values keyed by categoryId ───────────────
  const lastMonthValues = useMemo(() => {
    const result: Record<string, number> = {};
    if (selectedMonth === 0) {
      if (!prevYearEntriesData) return result;
      for (const r of prevYearEntriesData.rows) {
        if (r.month === 11) result[r.categoryId] = r.amount;
      }
    } else {
      if (!entriesData) return result;
      const target = selectedMonth - 1;
      for (const r of entriesData.rows) {
        if (r.month === target) result[r.categoryId] = r.amount;
      }
    }
    return result;
  }, [entriesData, prevYearEntriesData, selectedMonth]);

  const hasAnyLastMonth = Object.values(lastMonthValues).some(v => v > 0);

  // ── Derived: sidebar groups with per-group totals + filled counts ─────────
  const sidebarGroups: SidebarGroup[] = useMemo(() => {
    return grouped.map(([name, cats]) => {
      let total = 0;
      let filled = 0;
      for (const c of cats) {
        if (viewMode === 'year') {
          let any = 0;
          for (let m = 0; m < 12; m++) {
            const v = values[cellKey(c.id, m)] ?? 0;
            total += v;
            any += v;
          }
          if (any > 0) filled++;
        } else {
          const v = values[cellKey(c.id, selectedMonth)] ?? 0;
          total += v;
          if (v > 0) filled++;
        }
      }
      return { name, count: cats.length, total, filledCount: filled };
    });
  }, [grouped, values, selectedMonth, viewMode]);

  const grandTotal = sidebarGroups.reduce((s, g) => s + g.total, 0);

  // Active group data + pagination slice
  const activeGroupCategories = useMemo(
    () => grouped.find(([name]) => name === activeGroupName)?.[1] ?? [],
    [grouped, activeGroupName],
  );
  const activeGroupInfo = sidebarGroups.find(g => g.name === activeGroupName);
  const activeGroupTotal = activeGroupInfo?.total ?? 0;
  const activeGroupFilled = activeGroupInfo?.filledCount ?? 0;

  // Compute RowState for every row in the active group. The state drives
  // per-row styling (delta chip, budget progress, input border) and the
  // summary-bar counters. Row order is kept stable at the category's original
  // sortOrder — we don't re-shuffle by attention.
  const activeGroupRows = useMemo<RowWithState[]>(() => {
    return activeGroupCategories.map(category => {
      const v = values[cellKey(category.id, selectedMonth)] ?? 0;
      const last = lastMonthValues[category.id] ?? 0;
      return { category, state: computeRowState(category, v, last) };
    });
  }, [activeGroupCategories, values, lastMonthValues, selectedMonth]);

  const pagedRows = activeGroupRows.slice(
    (page - 1) * SIZE.pageSize,
    page * SIZE.pageSize,
  );

  // Per-group summary stats
  const activeGroupLastMonthTotal = useMemo(() => {
    let sum = 0;
    for (const r of activeGroupRows) sum += lastMonthValues[r.category.id] ?? 0;
    return sum;
  }, [activeGroupRows, lastMonthValues]);

  const activeGroupMissingCount = useMemo(
    () => activeGroupRows.filter(r => r.state.delta === 'missing').length,
    [activeGroupRows],
  );

  const totalPages = Math.max(1, Math.ceil(activeGroupCategories.length / SIZE.pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  // ── Dirty tracking ─────────────────────────────────────────────────────────
  const { isDirty, changedCount, deltaTotal } = useMemo(() => {
    const keys = new Set([...Object.keys(values), ...Object.keys(originalValues)]);
    let count = 0;
    let delta = 0;
    for (const k of keys) {
      const now = values[k] ?? 0;
      const was = originalValues[k] ?? 0;
      if (now !== was) {
        count++;
        delta += now - was;
      }
    }
    return { isDirty: count > 0, changedCount: count, deltaTotal: delta };
  }, [values, originalValues]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function setCell(categoryId: string, month: number, v: number) {
    setValues(prev => {
      const next = { ...prev };
      if (v === 0 || Number.isNaN(v)) {
        delete next[cellKey(categoryId, month)];
      } else {
        next[cellKey(categoryId, month)] = v;
      }
      return next;
    });
  }

  function copyRowFromLast(categoryId: string, month: number, lastValue: number) {
    if (lastValue <= 0) return;
    setCell(categoryId, month, lastValue);
  }

  function copyAllFromLast() {
    if (!hasAnyLastMonth) return;
    setValues(prev => {
      const next = { ...prev };
      for (const cat of activeGroupCategories) {
        const last = lastMonthValues[cat.id] ?? 0;
        if (last > 0) next[cellKey(cat.id, selectedMonth)] = last;
      }
      return next;
    });
    showToast(`Filled ${activeGroupCategories.length} categories from last month`, 'success');
  }

  async function handleSave() {
    if (!isDirty) return;
    setIsSaving(true);
    try {
      const rows: { categoryId: string; month: number; amount: number }[] = [];
      const keys = new Set([...Object.keys(values), ...Object.keys(originalValues)]);
      for (const k of keys) {
        const [categoryId, monthStr] = k.split('|');
        rows.push({ categoryId, month: Number(monthStr), amount: values[k] ?? 0 });
      }
      await bulkUpsertOperatingCostEntries(year, rows);
      setOriginalValues({ ...values });
      qc.invalidateQueries({ queryKey: ['operating-cost-entries', year] });
      qc.invalidateQueries({ queryKey: ['finance-summary'] });
      showToast('Operating costs saved', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  function handleDiscard() {
    setValues({ ...originalValues });
  }

  // ── Rendering ──────────────────────────────────────────────────────────────
  const periodLabel = viewMode === 'year'
    ? `${year}`
    : `${MONTH_LABELS[selectedMonth]} ${year}`;

  return (
    <div style={{
      ...pageStyle,
      // Year view stretches wider so all 12 months + avg + total columns fit
      // without horizontal scroll on typical desktop monitors (≥1500px).
      maxWidth: viewMode === 'year' ? 1500 : 1180,
      padding: isMobile ? '20px 12px' : '28px 32px',
      paddingBottom: isDirty ? 120 : 48,
      transition: 'max-width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      <FilterPillStyles />
      <style>{`
        .occ-tab { -webkit-tap-highlight-color: transparent; }
        .occ-tab:hover { background: ${C.hover}; }
        .occ-tab:active { transform: scale(0.995); }

        .occ-row { transition: background 0.12s ease; }
        .occ-row:hover { background: #f5f7fa; }
        .occ-row:hover .occ-last-pill { color: ${C.primary}; }
        .occ-last-pill:hover { color: ${C.primaryHover} !important; text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }

        /* Money inputs are always visible. Row-hover gives a slightly stronger
           border tint; cell-focus paints the primary ring. */
        .occ-row:hover .occ-money-shell { border-color: #cbd5e1 !important; }
        .occ-row .occ-money-shell:focus-within { border-color: ${C.primary} !important; }

        .occ-copy-btn:hover { background: ${C.primaryLight}; border-color: ${C.primaryBorder}; color: ${C.primary}; }

        .occ-discard-btn:hover:not(:disabled) { background: ${C.hover}; border-color: ${C.mutedMore}; color: ${C.textStrong}; }
        .occ-save-btn:hover:not(:disabled) { background: ${C.primaryHover}; transform: translateY(-1px); }
        .occ-save-btn:active:not(:disabled) { transform: translateY(0); }

        /* Year grid: highlight the row being edited + its sticky category label */
        .occ-year-table tbody tr:focus-within td { background: ${C.primaryLight} !important; }
        .occ-year-table tbody tr:focus-within td:first-child {
          color: ${C.primary} !important;
          font-weight: 700 !important;
          box-shadow: inset 3px 0 0 ${C.primary};
        }
        .occ-year-table .occ-grid-input:focus {
          background: #fff;
          box-shadow: inset 0 0 0 2px ${C.primary}, inset 0 0 0 4px ${C.primaryRing};
          border-radius: 3px;
        }
      `}</style>

      {/* Page header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={titleStyle}>Operating Costs</h1>
          <p style={subtitleStyle}>Record monthly operating expenses by category</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <PillSelect
            icon={faCalendar}
            value={String(year)}
            onChange={v => setYear(Number(v))}
            options={(() => {
              const y = new Date().getFullYear();
              return [y - 1, y, y + 1].map(n => ({ value: String(n), label: String(n) }));
            })()}
          />
          <PillToggle
            value={viewMode}
            onChange={v => setViewMode(v as ViewMode)}
            options={[
              { value: 'month', label: 'Month' },
              { value: 'year', label: 'Year' },
            ]}
          />
          <PillSelect
            value={viewMode === 'year' ? 'all' : String(selectedMonth)}
            onChange={v => setSelectedMonth(Number(v))}
            disabled={viewMode === 'year'}
            options={viewMode === 'year'
              ? [{ value: 'all', label: 'All months' }]
              : MONTH_LABELS.map((m, i) => ({
                  value: String(i),
                  label: i === new Date().getMonth() && year === new Date().getFullYear()
                    ? `${m} (current)`
                    : m,
                }))
            }
          />
        </div>
      </header>

      {/* Main content */}
      {entriesLoading ? (
        <div style={loadingStyle}>Loading…</div>
      ) : categories.length === 0 ? (
        <div style={loadingStyle}>
          No categories yet. Add categories under Settings → Operating Cost → Categories.
        </div>
      ) : viewMode === 'month' ? (
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          <CategorySidebar
            groups={sidebarGroups}
            grandTotal={grandTotal}
            periodLabel={periodLabel.toUpperCase()}
            activeGroupName={activeGroupName}
            onSelect={setActiveGroupName}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <CategoryPanel
              groupName={activeGroupName}
              rows={pagedRows}
              totalCount={activeGroupCategories.length}
              filledCount={activeGroupFilled}
              missingCount={activeGroupMissingCount}
              groupTotal={activeGroupTotal}
              groupLastMonthTotal={activeGroupLastMonthTotal}
              values={values}
              lastMonthValues={lastMonthValues}
              selectedMonth={selectedMonth}
              year={year}
              onCellChange={setCell}
              onCopyRowFromLast={copyRowFromLast}
              onCopyAllFromLast={copyAllFromLast}
              hasAnyLastMonth={hasAnyLastMonth}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </div>
      ) : (
        <YearGridView
          grouped={grouped}
          year={year}
          yearTotal={grandTotal}
          values={values}
          onCellChange={setCell}
        />
      )}

      <StickySaveBar
        visible={isDirty}
        changedCount={changedCount}
        deltaTotal={deltaTotal}
        isSaving={isSaving}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />
    </div>
  );
}

// ── Year grid (full-width overview, no sidebar) ──────────────────────────────

function YearGridView({
  grouped, year, yearTotal, values, onCellChange,
}: {
  grouped: [string, OperatingCostCategory[]][];
  year: number;
  yearTotal: number;
  values: Record<string, number>;
  onCellChange: (categoryId: string, month: number, v: number) => void;
}) {
  // Mark months that haven't happened yet so the grid visually communicates
  // "this is forecast territory" — still editable, just dimmed.
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth();
  const isFuture = (m: number) =>
    year > currentYear || (year === currentYear && m > currentMonthIdx);
  const isCurrent = (m: number) =>
    year === currentYear && m === currentMonthIdx;

  const totalCategories = grouped.reduce((s, [, cats]) => s + cats.length, 0);
  if (totalCategories === 0) {
    return (
      <section style={sectionStyle}>
        <p style={loadingStyle}>No categories yet.</p>
      </section>
    );
  }

  // Compute per-category annual totals for the right-most column
  const rowTotal = (catId: string) => {
    let sum = 0;
    for (let m = 0; m < 12; m++) sum += values[cellKey(catId, m)] ?? 0;
    return sum;
  };

  // Per-category average across months that have a non-zero value.
  // Averaging over filled months (not all 12) gives a meaningful "typical spend"
  // for categories that are only recorded on certain months.
  const rowAverage = (catId: string) => {
    let sum = 0;
    let filled = 0;
    for (let m = 0; m < 12; m++) {
      const v = values[cellKey(catId, m)] ?? 0;
      if (v > 0) { sum += v; filled++; }
    }
    return filled > 0 ? sum / filled : 0;
  };

  // Compute per-month grand totals for the footer
  const colTotal = (m: number) => {
    let sum = 0;
    for (const [, cats] of grouped) {
      for (const c of cats) sum += values[cellKey(c.id, m)] ?? 0;
    }
    return sum;
  };

  // Average of the monthly grand totals (over months with any spend).
  const gridAverage = (() => {
    let sum = 0;
    let filled = 0;
    for (let m = 0; m < 12; m++) {
      const v = colTotal(m);
      if (v > 0) { sum += v; filled++; }
    }
    return filled > 0 ? sum / filled : 0;
  })();

  return (
    <section style={sectionStyle}>
      {/* Header: title + KPI */}
      <header style={{
        padding: '22px 28px 20px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 24,
        borderBottom: `1px solid ${C.borderSoft}`,
      }}>
        <div>
          <h2 style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 800,
            color: C.textStrong,
            letterSpacing: '-0.02em',
          }}>{year} · 12-Month Grid</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>
            <strong style={{ color: C.textSub, fontWeight: 600 }}>{totalCategories}</strong> categories across {grouped.length} {grouped.length === 1 ? 'main category' : 'main categories'}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            color: C.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 4,
          }}>{year} Total</div>
          <div style={{
            fontSize: 28,
            fontWeight: 800,
            color: yearTotal > 0 ? C.textStrong : C.dim,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
            letterSpacing: '-0.025em',
          }}>{fmtRMCompact(yearTotal)}</div>
        </div>
      </header>

      {/* Grid — contained scroll area so both axes stay reachable */}
      <div style={{
        overflow: 'auto',
        maxHeight: 'calc(100vh - 280px)',
        minHeight: 360,
      }}>
        <table className="occ-year-table" style={{
          width: 'max-content',
          minWidth: '100%',
          borderCollapse: 'separate',
          borderSpacing: 0,
          tableLayout: 'fixed',
          fontSize: 13,
        }}>
          <colgroup>
            <col style={{ width: 240 }} />
            {MONTH_LABELS.map(m => <col key={m} style={{ width: 82 }} />)}
            <col style={{ width: 96 }} />
            <col style={{ width: 110 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{
                ...thStyle,
                position: 'sticky',
                left: 0,
                top: 0,
                background: C.subtle,
                zIndex: 4,
              }}>Category</th>
              {MONTH_LABELS.map((m, i) => {
                const future = isFuture(i);
                const current = isCurrent(i);
                return (
                  <th key={m} style={{
                    ...thStyle,
                    textAlign: 'right',
                    background: current ? C.primaryLight : C.subtle,
                    color: future ? C.mutedMore : (current ? C.primary : C.muted),
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                  }}>{m}</th>
                );
              })}
              <th style={{
                ...thStyle,
                textAlign: 'right',
                background: C.subtle,
                borderLeft: `1px solid ${C.border}`,
                color: C.muted,
                position: 'sticky',
                top: 0,
                zIndex: 2,
              }}>Avg</th>
              <th style={{
                ...thStyle,
                textAlign: 'right',
                background: C.subtle,
                color: C.textSub,
                position: 'sticky',
                top: 0,
                zIndex: 2,
              }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(([groupName, cats]) => (
              <GroupSection
                key={groupName}
                groupName={groupName}
                categories={cats}
                values={values}
                rowTotal={rowTotal}
                rowAverage={rowAverage}
                isFuture={isFuture}
                isCurrent={isCurrent}
                onCellChange={onCellChange}
              />
            ))}
          </tbody>
          {/* Footer: per-month grand totals — sticky to the bottom of the scroll area */}
          <tfoot>
            <tr>
              <td style={{
                ...tdStyle,
                fontWeight: 800,
                color: C.textSub,
                position: 'sticky',
                left: 0,
                bottom: 0,
                zIndex: 4,
                background: C.subtle,
                borderRight: `1px solid ${C.border}`,
                borderTop: `2px solid ${C.border}`,
                textTransform: 'uppercase',
                fontSize: 10,
                letterSpacing: '0.08em',
              }}>Month total</td>
              {MONTH_LABELS.map((_, m) => {
                const v = colTotal(m);
                const future = isFuture(m);
                const current = isCurrent(m);
                return (
                  <td key={m} style={{
                    ...tdStyle,
                    textAlign: 'right',
                    fontWeight: 700,
                    color: future ? C.mutedMore : (v > 0 ? C.textStrong : C.dim),
                    fontVariantNumeric: 'tabular-nums',
                    background: current ? C.primaryLight : (future ? '#f3f4f6' : C.subtle),
                    borderTop: `2px solid ${C.border}`,
                    position: 'sticky',
                    bottom: 0,
                    zIndex: 2,
                  }}>
                    {v > 0 ? fmtRMCompact(v) : '—'}
                  </td>
                );
              })}
              <td style={{
                ...tdStyle,
                textAlign: 'right',
                fontWeight: 700,
                color: gridAverage > 0 ? C.muted : C.dim,
                fontSize: 12,
                fontVariantNumeric: 'tabular-nums',
                background: C.subtle,
                borderLeft: `1px solid ${C.border}`,
                borderTop: `2px solid ${C.border}`,
                position: 'sticky',
                bottom: 0,
                zIndex: 2,
              }}>{gridAverage > 0 ? fmtRMCompact(gridAverage) : '—'}</td>
              <td style={{
                ...tdStyle,
                textAlign: 'right',
                fontWeight: 800,
                color: C.primary,
                fontVariantNumeric: 'tabular-nums',
                background: C.subtle,
                borderTop: `2px solid ${C.border}`,
                position: 'sticky',
                bottom: 0,
                zIndex: 2,
              }}>{fmtRMCompact(yearTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

// Renders the group header row + all category rows for one group
function GroupSection({
  groupName, categories, values, rowTotal, rowAverage, isFuture, isCurrent, onCellChange,
}: {
  groupName: string;
  categories: OperatingCostCategory[];
  values: Record<string, number>;
  rowTotal: (catId: string) => number;
  rowAverage: (catId: string) => number;
  isFuture: (m: number) => boolean;
  isCurrent: (m: number) => boolean;
  onCellChange: (categoryId: string, month: number, v: number) => void;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={15}
          style={{
            padding: 0,
            background: C.hover,
            borderTop: `1px solid ${C.border}`,
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          {/* Sticky wrapper inside the colspan cell — keeps the label glued
              to the viewport's left edge without breaking the table layout. */}
          <div style={{
            position: 'sticky',
            left: 0,
            padding: '10px 20px 8px',
            fontSize: 10,
            fontWeight: 700,
            color: C.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            display: 'inline-block',
          }}>
            {groupName}
            <span style={{
              marginLeft: 8,
              color: C.mutedMore,
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
              textTransform: 'none',
              letterSpacing: 'normal',
            }}>
              · {categories.length} {categories.length === 1 ? 'item' : 'items'}
            </span>
          </div>
        </td>
      </tr>
      {categories.map((cat, i) => {
        const bg = i % 2 === 0 ? C.card : C.subtle;
        const total = rowTotal(cat.id);
        const avg = rowAverage(cat.id);
        return (
          <tr key={cat.id} style={{ background: bg, height: 40 }}>
            <td style={{
              ...tdStyle,
              fontWeight: 500,
              color: C.textSub,
              position: 'sticky',
              left: 0,
              zIndex: 1,
              background: bg,
              borderRight: `1px solid ${C.border}`,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {cat.name}
            </td>
            {MONTH_LABELS.map((_, m) => {
              const future = isFuture(m);
              const current = isCurrent(m);
              // Future month cells get a diagonal-stripe feel via a
              // slightly darker background + muted input color.
              const cellBg = current ? C.primaryLight : future ? '#f3f4f6' : undefined;
              return (
                <td key={m} style={{ ...tdStyle, padding: 0, background: cellBg }}>
                  <GridCellInput
                    value={values[cellKey(cat.id, m)] ?? 0}
                    onChange={v => onCellChange(cat.id, m, v)}
                    dim={future}
                  />
                </td>
              );
            })}
            <td style={{
              ...tdStyle,
              textAlign: 'right',
              fontWeight: 600,
              color: avg > 0 ? C.muted : C.dim,
              fontVariantNumeric: 'tabular-nums',
              borderLeft: `1px solid ${C.border}`,
              background: bg,
              fontSize: 12,
            }}>
              {avg > 0 ? fmtRMCompact(avg) : '—'}
            </td>
            <td style={{
              ...tdStyle,
              textAlign: 'right',
              fontWeight: 700,
              color: total > 0 ? C.textStrong : C.dim,
              fontVariantNumeric: 'tabular-nums',
              background: bg,
            }}>
              {total > 0 ? fmtRMCompact(total) : '—'}
            </td>
          </tr>
        );
      })}
    </>
  );
}

function GridCellInput({ value, onChange, dim = false }: {
  value: number;
  onChange: (v: number) => void;
  dim?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(value === 0 ? '' : String(value));

  useEffect(() => {
    if (!focused) setDraft(value === 0 ? '' : String(value));
  }, [value, focused]);

  const hasValue = draft.length > 0;
  const textColor = hasValue
    ? (dim ? C.muted : C.textStrong)
    : (dim ? '#dbe0e6' : C.dim);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      onFocus={e => { setFocused(true); e.target.select(); }}
      onBlur={() => {
        setFocused(false);
        const n = parseFloat(draft.replace(/,/g, ''));
        onChange(Number.isNaN(n) ? 0 : n);
      }}
      onChange={e => setDraft(e.target.value.replace(/[^0-9.,]/g, ''))}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className="occ-grid-input"
      style={{
        width: '100%',
        height: '100%',
        padding: '8px 10px',
        border: 'none',
        background: 'transparent',
        textAlign: 'right',
        fontSize: 13,
        color: textColor,
        fontWeight: hasValue ? 700 : 400,
        fontVariantNumeric: 'tabular-nums',
        outline: 'none',
        fontFamily: 'inherit',
        boxSizing: 'border-box',
      }}
    />
  );
}

// ── Page-local styles ────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  maxWidth: 1180,
  margin: '0 auto',
  background: C.bg,
  minHeight: '100vh',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};
const titleStyle: React.CSSProperties = {
  fontSize: 24, fontWeight: 800, color: C.textStrong, margin: '0 0 4px',
  letterSpacing: '-0.025em',
};
const subtitleStyle: React.CSSProperties = {
  fontSize: 13, color: C.muted, margin: 0,
};
const loadingStyle: React.CSSProperties = {
  color: C.muted, fontSize: 14, textAlign: 'center', padding: '60px 0',
  background: C.card, borderRadius: 12, border: `1px solid ${C.border}`,
};
const sectionStyle: React.CSSProperties = {
  background: C.card, borderRadius: 12, border: `1px solid ${C.border}`,
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)', overflow: 'hidden',
};
const thStyle: React.CSSProperties = {
  padding: '10px 12px', fontSize: 10, fontWeight: 700, color: C.muted,
  letterSpacing: '0.04em', textTransform: 'uppercase',
  borderBottom: `2px solid ${C.border}`, whiteSpace: 'nowrap', textAlign: 'left',
};
const tdStyle: React.CSSProperties = {
  padding: '6px 10px', borderBottom: `1px solid ${C.border}`, fontSize: 13,
  color: C.text, whiteSpace: 'nowrap',
};
const pageBtnStyle: React.CSSProperties = {
  background: C.card, border: `1px solid ${C.border}`, borderRadius: 6,
  padding: '5px 11px', fontSize: 12, fontWeight: 600, color: C.muted,
  cursor: 'pointer', fontFamily: 'inherit', minWidth: 30,
};
