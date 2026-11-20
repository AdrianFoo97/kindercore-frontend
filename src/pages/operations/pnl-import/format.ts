/** "RM 1,116.56" — always two decimals, as on the statement. */
export function formatMoney(n: number): string {
  return `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Lines grouped by their P&L section, in the order the sections first appear, each with its subtotal. */
export function groupBySection<T extends { section: string; amount: number }>(lines: T[]): { section: string; total: number; lines: T[] }[] {
  const out: { section: string; total: number; lines: T[] }[] = [];
  for (const l of lines) {
    let g = out.find(x => x.section === l.section);
    if (!g) { g = { section: l.section, total: 0, lines: [] }; out.push(g); }
    g.lines.push(l);
    g.total = Math.round((g.total + l.amount) * 100) / 100;
  }
  return out;
}
