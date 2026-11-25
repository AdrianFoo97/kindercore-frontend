import { describe, it, expect } from 'vitest';
import { payRangeCompact, payRangeLabel, readPay } from '../../pages/settings/payRange';

// Settings → Payroll: basic salary (no allowances) and total pay range, edited in place.

describe('Payroll — basic salary and pay range', () => {
  it('reads what is typed, keeping Save off with a reason until it makes sense', () => {
    expect(readPay('2000', '', '')).toEqual({ pay: { basicSalary: 2000, payRangeMin: null, payRangeMax: null } });
    expect(readPay('2000', '2100', '2600')).toEqual({ pay: { basicSalary: 2000, payRangeMin: 2100, payRangeMax: 2600 } });
    expect(readPay('', '', '')).toEqual({ problem: 'Enter the basic salary.' });
    expect(readPay('2000', '2100', '')).toEqual({ problem: 'Give both ends of the pay range, or neither.' });
    expect(readPay('1800', '1700', '2000')).toEqual({ pay: { basicSalary: 1800, payRangeMin: 1700, payRangeMax: 2000 } }); // may start below basic
    expect(readPay('2000', '2600', '2100')).toEqual({ problem: 'The top of the range can’t be below the bottom.' });
  });

  it('shows the range as RM from – to, or nothing when it isn’t set', () => {
    expect(payRangeLabel(2000, 2600)).toBe('RM 2,000 – RM 2,600');
    expect(payRangeLabel(null, null)).toBeNull();
  });
});

describe('Pay range — short form for the career journey', () => {
  it('writes a range with one RM, like a job ad — and a single amount when both ends match', () => {
    expect(payRangeCompact(1800, 2400)).toBe('RM 1,800 – 2,400');
    expect(payRangeCompact(3000, 3000)).toBe('RM 3,000');
    expect(payRangeCompact(null, 2400)).toBeNull();
  });
});
