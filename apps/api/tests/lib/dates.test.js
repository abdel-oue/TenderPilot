import { describe, expect, it } from 'vitest';
import {
  businessDaysBetween,
  daysBetween,
  parseDate,
  parseTime,
  toIsoDate,
} from '../../src/lib/dates.js';

describe('parseDate', () => {
  it('reads the three shapes a Moroccan CPS actually uses', () => {
    expect(toIsoDate(parseDate('2026-03-12'))).toBe('2026-03-12');
    expect(toIsoDate(parseDate('12/03/2026'))).toBe('2026-03-12');
    expect(toIsoDate(parseDate('12 mars 2026'))).toBe('2026-03-12');
  });

  it('reads a numeric date day-first, because the corpus is French', () => {
    // Read month-first, 12/03 becomes 3 December and most deadlines shift by
    // months without anything looking wrong.
    expect(toIsoDate(parseDate('03/12/2026'))).toBe('2026-12-03');
  });

  it('accepts accented month names', () => {
    expect(toIsoDate(parseDate('1 février 2026'))).toBe('2026-02-01');
    expect(toIsoDate(parseDate('1 decembre 2026'))).toBe('2026-12-01');
  });

  it('refuses a date that does not exist rather than rolling it over', () => {
    // Date.UTC turns 31 February into 3 March without complaint.
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('32/01/2026')).toBeNull();
  });

  it('reads a date followed by the hour a CPS always writes', () => {
    // "Les plis doivent parvenir [...] au plus tard le 08/07/2026 a 09h30" is the
    // normal shape of a Moroccan deadline, not an edge case.
    for (const input of [
      '08/07/2026 09:30',
      '08/07/2026 à 09h30',
      '08/07/2026 a 09h30',
      '08/07/2026 09h30',
      '8 juillet 2026 à 09h30',
    ]) {
      expect(toIsoDate(parseDate(input))).toBe('2026-07-08');
    }
  });

  it('tolerates an hour without dropping the anchor', () => {
    // The point of the optional suffix is tolerance, not the removal of `$`.
    expect(parseDate('08/07/20261')).toBeNull();
    expect(parseDate('08/07/2026 xyz')).toBeNull();
    expect(parseDate('08/07/2026 25h70')).toBeNull();
  });

  it('refuses what it cannot parse instead of guessing', () => {
    for (const input of ['demain', 'le mois prochain', '', 'mars', null, undefined, 42]) {
      expect(parseDate(input)).toBeNull();
    }
  });
});

describe('parseTime', () => {
  it('extracts the hour in every shape the corpus writes it', () => {
    expect(parseTime('08/07/2026 09h30')).toBe('09:30');
    expect(parseTime('08/07/2026 09:30')).toBe('09:30');
    expect(parseTime('08/07/2026 à 10h00')).toBe('10:00');
    expect(parseTime('8 juillet 2026 a 09h30')).toBe('09:30');
    expect(parseTime('2026-07-08T09:30:00Z')).toBe('09:30');
  });

  it('answers null rather than inventing an hour nobody wrote', () => {
    // "23h59" would be a precision the CPS did not give.
    expect(parseTime('08/07/2026')).toBeNull();
    expect(parseTime('2026-07-08')).toBeNull();
    expect(parseTime('8 juillet 2026')).toBeNull();
    expect(parseTime('le mois prochain')).toBeNull();
  });
});

describe('daysBetween', () => {
  it('counts calendar days forward', () => {
    expect(daysBetween(parseDate('2026-03-02'), parseDate('2026-03-12'))).toBe(10);
  });

  it('goes negative for a deadline already past', () => {
    expect(daysBetween(parseDate('2026-03-12'), parseDate('2026-03-02'))).toBe(-10);
  });

  it('crosses a month boundary correctly', () => {
    expect(daysBetween(parseDate('2026-02-25'), parseDate('2026-03-02'))).toBe(5);
  });
});

describe('businessDaysBetween', () => {
  it('excludes weekends', () => {
    // 2026-03-02 is a Monday; 2026-03-12 is the Thursday of the week after.
    expect(businessDaysBetween(parseDate('2026-03-02'), parseDate('2026-03-12'))).toBe(8);
  });

  it('counts nothing across a bare weekend', () => {
    // Friday to Sunday: no working day is gained.
    expect(businessDaysBetween(parseDate('2026-03-06'), parseDate('2026-03-08'))).toBe(0);
  });

  it('is zero for the same day', () => {
    expect(businessDaysBetween(parseDate('2026-03-02'), parseDate('2026-03-02'))).toBe(0);
  });

  it('goes negative for a deadline already past, symmetrically', () => {
    const a = parseDate('2026-03-02');
    const b = parseDate('2026-03-12');
    expect(businessDaysBetween(b, a)).toBe(-businessDaysBetween(a, b));
  });
});
