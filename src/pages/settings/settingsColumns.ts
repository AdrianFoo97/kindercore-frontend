// Settings home: group cards laid out in columns, in order (down each column,
// then across), split so the columns come out as even as possible. The last
// card in each column stretches, so every column ends on the same line.

/** How many columns of at least `minWidth` fit in `width`, with `gap` between them. */
export function columnCount(width: number, minWidth: number, gap: number): number {
  return Math.max(1, Math.floor((width + gap) / (minWidth + gap)));
}

/**
 * Split items, in order, into at most `columns` runs whose total weight (e.g. a
 * card's rows) is as even as possible — the tallest column is as short as it can be.
 */
export function splitIntoColumns<T>(items: T[], weight: (item: T) => number, columns: number): T[][] {
  const k = Math.max(1, Math.min(columns, items.length));
  if (items.length === 0) return [];
  const w = items.map(weight);
  const prefix = [0];
  for (const x of w) prefix.push(prefix[prefix.length - 1] + x);
  const sum = (from: number, to: number) => prefix[to] - prefix[from];
  const n = items.length;
  // best[c][i]: the smallest tallest-column for the first i items in c columns; cut[c][i]: where the last column starts.
  const best: number[][] = Array.from({ length: k + 1 }, () => Array(n + 1).fill(Infinity));
  const cut: number[][] = Array.from({ length: k + 1 }, () => Array(n + 1).fill(0));
  best[0][0] = 0;
  for (let c = 1; c <= k; c++) {
    for (let i = c; i <= n; i++) {
      for (let j = c - 1; j < i; j++) {
        const tallest = Math.max(best[c - 1][j], sum(j, i));
        if (tallest < best[c][i]) { best[c][i] = tallest; cut[c][i] = j; }
      }
    }
  }
  const out: T[][] = [];
  for (let c = k, i = n; c > 0; c--) {
    const j = cut[c][i];
    out.unshift(items.slice(j, i));
    i = j;
  }
  return out;
}
