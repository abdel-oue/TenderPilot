/**
 * A tiny arithmetic evaluator for the agent's `calculate` tool.
 *
 * Why this exists rather than a prompt instruction: caution provisoire at 1,5%,
 * TVA at 20%, penalites at 1/1000e per day. A wrong figure in a memoire technique
 * is the most visible possible failure, and models do this arithmetic fluently
 * and wrong.
 *
 * Why this rather than `eval` or a dependency: the expression is written by a
 * model that has read an attacker-supplied PDF. `eval` on that input is remote
 * code execution with extra steps. It is a recursive-descent parser over exactly
 * six operators and nothing else - no identifiers, no calls, no property access,
 * so there is nothing to escape into.
 */

/**
 * Evaluates an arithmetic expression.
 *
 * Supports `+ - * / ( )` and a POSTFIX `%` meaning "divide by 100", so
 * `1.5% * 2400000` reads the way a caution provisoire is actually written.
 *
 * The decimal separator is `.` and only `.`. A comma is refused rather than
 * guessed: `2,400` is two-thousand-four-hundred to one reader and two-point-four
 * to another, and silently picking one of those on a money figure is the bug this
 * tool exists to prevent.
 *
 * @param {string} expression
 * @returns {{ value: number, expression: string }}
 * @throws {Error} on anything it cannot evaluate exactly
 */
export function calculate(expression) {
  if (typeof expression !== 'string' || !expression.trim()) {
    throw new Error('Expression vide.');
  }
  if (expression.includes(',')) {
    throw new Error(
      'Virgule refusee : utilise le point decimal et pas de separateur de milliers. ' +
        'Exemple : 1.5% * 2400000',
    );
  }

  // Spaces are thousand separators in French typography, so they are stripped
  // before tokenizing rather than treated as delimiters.
  const source = expression.replace(/[\s  ]/g, '');
  const parser = new Parser(source);
  const value = parser.parseExpression();
  parser.expectEnd();

  if (!Number.isFinite(value)) throw new Error('Resultat non fini (division par zero ?).');

  return { value: round(value), expression };
}

/** @param {number} n @returns {number} banker-free 2dp, enough for money */
function round(n) {
  return Math.round(n * 100) / 100;
}

class Parser {
  /** @param {string} source */
  constructor(source) {
    this.source = source;
    this.at = 0;
  }

  /** @returns {number} */
  parseExpression() {
    let left = this.parseTerm();
    for (;;) {
      const op = this.source[this.at];
      if (op !== '+' && op !== '-') return left;
      this.at += 1;
      const right = this.parseTerm();
      left = op === '+' ? left + right : left - right;
    }
  }

  /** @returns {number} */
  parseTerm() {
    let left = this.parseUnary();
    for (;;) {
      const op = this.source[this.at];
      if (op !== '*' && op !== '/') return left;
      this.at += 1;
      const right = this.parseUnary();
      if (op === '/' && right === 0) throw new Error('Division par zero.');
      left = op === '*' ? left * right : left / right;
    }
  }

  /** @returns {number} */
  parseUnary() {
    if (this.source[this.at] === '-') {
      this.at += 1;
      return -this.parseUnary();
    }
    if (this.source[this.at] === '+') {
      this.at += 1;
      return this.parseUnary();
    }
    return this.parsePostfix();
  }

  /** @returns {number} */
  parsePostfix() {
    let value = this.parsePrimary();
    while (this.source[this.at] === '%') {
      this.at += 1;
      value /= 100;
    }
    return value;
  }

  /** @returns {number} */
  parsePrimary() {
    if (this.source[this.at] === '(') {
      this.at += 1;
      const value = this.parseExpression();
      if (this.source[this.at] !== ')') throw new Error('Parenthese fermante manquante.');
      this.at += 1;
      return value;
    }

    const match = /^\d+(\.\d+)?/.exec(this.source.slice(this.at));
    if (!match) {
      throw new Error(
        'Caractere inattendu a la position ' + this.at + ' : "' + (this.source[this.at] ?? 'fin') + '".',
      );
    }
    this.at += match[0].length;
    return Number(match[0]);
  }

  /** @returns {void} */
  expectEnd() {
    if (this.at !== this.source.length) {
      throw new Error('Expression invalide a partir de : "' + this.source.slice(this.at) + '".');
    }
  }
}
