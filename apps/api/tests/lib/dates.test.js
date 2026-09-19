import { describe, expect, it } from 'vitest';
import {
  businessDaysBetween,
  daysBetween,
  parseDate,
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

  it('refuses what it cannot parse instead of guessing', () => {
    for (const input of ['demain', 'le mois prochain', '', 'mars', null, undefined, 42]) {
      expect(parseDate(input)).toBeNull();
    }
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
