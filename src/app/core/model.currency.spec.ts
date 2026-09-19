import { formatPeso } from './model.currency';

describe('formatPeso', () => {
  it('formats with a peso sign, thousands separators, and two decimals', () => {
    expect(formatPeso(2500000)).toBe('₱2,500,000.00');
  });

  it('keeps the sign on negative amounts (pull-out credits on project expenses)', () => {
    expect(formatPeso(-2300)).toBe('-₱2,300.00');
  });

  it('treats null and undefined as zero rather than rendering "NaN"', () => {
    expect(formatPeso(null)).toBe('₱0.00');
    expect(formatPeso(undefined)).toBe('₱0.00');
  });
});
