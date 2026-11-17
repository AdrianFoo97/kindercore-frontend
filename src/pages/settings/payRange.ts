// Settings → Payroll: a position's basic salary (no allowances) and its total pay range
// (basic plus every allowance and incentive). The server checks the same rules (payRange.logic).

export interface PayInput { basicSalary: number; payRangeMin: number | null; payRangeMax: number | null }

const amount = (text: string): number | null => (text.trim() === '' ? null : Number(text));

/** What's typed → the amounts, or why it can't be saved yet (what's typed is never changed). */
export function readPay(basicText: string, minText: string, maxText: string): { pay: PayInput } | { problem: string } {
  const basic = amount(basicText);
  if (basic == null || !Number.isFinite(basic)) return { problem: 'Enter the basic salary.' };
  if (basic < 0) return { problem: 'Basic salary can’t be below 0.' };
  const min = amount(minText);
  const max = amount(maxText);
  if ((min != null && !Number.isFinite(min)) || (max != null && !Number.isFinite(max))) return { problem: 'Enter amounts for the pay range.' };
  if ((min == null) !== (max == null)) return { problem: 'Give both ends of the pay range, or neither.' };
  if (min != null && min < basic) return { problem: 'The range includes allowances, so it can’t start below basic.' };
  if (min != null && max != null && max < min) return { problem: 'The top of the range can’t be below the bottom.' };
  return { pay: { basicSalary: basic, payRangeMin: min, payRangeMax: max } };
}

/** "RM 2,000 – RM 2,600", or null when no range is set. */
export function payRangeLabel(min: number | null | undefined, max: number | null | undefined): string | null {
  if (min == null || max == null) return null;
  const rm = (n: number) => `RM ${n.toLocaleString('en-MY', { maximumFractionDigits: 2 })}`;
  return `${rm(min)} – ${rm(max)}`;
}
