import { localDateString } from './local-date';

describe('localDateString', () => {
  it('uses the local calendar date, not the UTC one', () => {
    // 07:30 local — before 08:00, which in UTC+8 is still the previous UTC day.
    expect(localDateString(new Date(2026, 8, 19, 7, 30))).toBe('2026-09-19');
  });

  it('zero-pads single-digit months and days', () => {
    expect(localDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('handles the last moment of the year', () => {
    expect(localDateString(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});
