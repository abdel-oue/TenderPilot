import { describe, expect, it } from 'vitest';
import { calculate } from '../../src/lib/calc.js';

describe('calculate', () => {
  it('computes a caution provisoire from a percentage', () => {
    expect(calculate('1.5% * 2400000').value).toBe(36000);
  });

  it('computes TVA the long way round to the same figure', () => {
    expect(calculate('2400000 * 20 / 100').value).toBe(480000);
  });

  it('computes a daily penalty at one thousandth', () => {
    expect(calculate('1/1000 * 2400000 * 15').value).toBe(36000);
  });

  it('respects parentheses and operator precedence', () => {
    expect(calculate('(1+2)*3').value).toBe(9);
    expect(calculate('1+2*3').value).toBe(7);
  });

  it('handles a leading minus', () => {
    expect(calculate('-5 + 10').value).toBe(5);
  });

  it('treats spaces as thousand separators, the way the document writes them', () => {
    expect(calculate('2 400 000 * 0.015').value).toBe(36000);
  });
});

describe('calculate refusals', () => {
  it('refuses a comma instead of guessing decimal or thousands separator', () => {
    // "2,400" is two thousand four hundred to one reader and two-point-four to
    // another. On a money figure, guessing is the bug this tool exists to avoid.
    expect(() => calculate('1,5 * 2')).toThrow(/Virgule refusee/);
  });

  it('refuses division by zero rather than returning Infinity', () => {
    expect(() => calculate('1/0')).toThrow(/Division par zero/);
  });

  it('refuses an incomplete expression', () => {
    expect(() => calculate('2 +')).toThrow();
  });

  it('refuses an empty expression', () => {
    expect(() => calculate('   ')).toThrow(/vide/);
  });

  it('cannot be talked into evaluating code', () => {
    // The expression is written by a model that has just read an attacker's PDF.
    // There is no identifier, call or property syntax in the grammar at all, so
    // each of these dies at the first unexpected character.
    for (const attack of [
      'require("fs")',
      'process.exit(1)',
      '__proto__',
      'constructor.constructor("return 1")()',
      '1;console.log(1)',
      'globalThis',
    ]) {
      expect(() => calculate(attack)).toThrow();
    }
  });
});
