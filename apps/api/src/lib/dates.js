/**
 * Date arithmetic for the agent's `compute_deadline` tool.
 *
 * Pure, no clock of its own: `today` is always passed in, so every function here
 * is testable without freezing time and the graph can be replayed deterministically.
 *
 * This exists because models are confidently wrong about date arithmetic. "Le
 * dossier est a remettre le 12/03/2026" plus "il reste combien de jours ouvres ?"
 * is exactly the question a language model answers fluently and incorrectly, and
 * a missed deadline is the one mistake this product cannot make.
 */

const MS_PER_DAY = 86_400_000;

const FRENCH_MONTHS = {
  janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11,
  decembre: 12, décembre: 12,
};

/**
 * The hour a Moroccan CPS writes after its deadline: `a 09h30`, `à 09h30`,
 * `09h30`, `09:30`. Optional, but when it is absent nothing else may follow -
 * without that anchor `08/07/20261` would parse as `08/07/2026`, which is the
 * kind of guessing this file refuses everywhere else. The bounded digits reject
 * `25h70` for free.
 */
const TIME_SUFFIX = String.raw`(?:\s+(?:[àa]\s*)?([01]?\d|2[0-3])\s*[h:]\s*([0-5]\d))?\s*$`;

const NUMERIC = new RegExp(String.raw`^(\d{1,2})[/-](\d{1,2})[/-](\d{4})` + TIME_SUFFIX);
const LONG = new RegExp(String.raw`^(\d{1,2})\s+([a-zéû]+)\s+(\d{4})` + TIME_SUFFIX);
const ISO = /^(\d{4})-(\d{2})-(\d{2})/;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}t([01]\d|2[0-3]):([0-5]\d)/;

/**
 * Parses the date shapes that actually appear in a Moroccan CPS: ISO, French
 * numeric, and French long form, each optionally followed by an hour. Anything
 * else is refused rather than guessed - a misparsed deadline is worse than no
 * answer.
 *
 * The hour is tolerated here and returned by `parseTime`; this still answers a
 * UTC midnight so the arithmetic stays in whole days and stays testable without
 * a timezone.
 *
 * @param {string} input
 * @returns {Date|null} UTC midnight, or null when the shape is not recognised
 */
export function parseDate(input) {
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input !== 'string') return null;

  const text = input.trim().toLowerCase();

  const iso = text.match(ISO);
  if (iso) return utc(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // 12/03/2026 and 12-03-2026 are day-first: this is a French-language corpus,
  // and reading them month-first silently shifts most dates by months.
  const numeric = text.match(NUMERIC);
  if (numeric) return utc(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));

  const long = text.match(LONG);
  if (long && FRENCH_MONTHS[long[2]]) {
    return utc(Number(long[3]), FRENCH_MONTHS[long[2]], Number(long[1]));
  }

  return null;
}

/**
 * The hour written next to a deadline, when there is one. Never invents a
 * default: a CPS that did not write an hour did not give one, and "23h59" would
 * be a precision nobody stated.
 *
 * @param {string} input the same string handed to `parseDate`
 * @returns {string|null} HH:MM, or null when no hour is written
 */
export function parseTime(input) {
  if (typeof input !== 'string' || !parseDate(input)) return null;
  const text = input.trim().toLowerCase();

  const iso = text.match(ISO_TIME);
  if (iso) return iso[1] + ':' + iso[2];

  const french = text.match(NUMERIC) || text.match(LONG);
  if (!french || !french[4]) return null;

  return french[4].padStart(2, '0') + ':' + french[5];
}

/**
 * @param {number} year
 * @param {number} month 1-12
 * @param {number} day
 * @returns {Date|null} null when the parts do not form that calendar date
 */
function utc(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC rolls 31/02 over into March rather than failing, so the round trip
  // is what actually rejects an impossible date.
  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return valid ? date : null;
}

/**
 * @param {Date} from
 * @param {Date} to
 * @returns {number} calendar days, negative when `to` is already past
 */
export function daysBetween(from, to) {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/**
 * Working days, Saturday and Sunday excluded.
 *
 * Moroccan public holidays are NOT subtracted: half of them move with the lunar
 * calendar, and a hardcoded list would be wrong the year after the hackathon.
 * The tool says so in its answer rather than pretending to a precision it has not
 * got - an agent that overstates its certainty about a submission deadline is the
 * failure mode this whole product is built against.
 *
 * @param {Date} from
 * @param {Date} to
 * @returns {number} negative when `to` is already past
 */
export function businessDaysBetween(from, to) {
  const backwards = to < from;
  const [start, end] = backwards ? [to, from] : [from, to];

  let count = 0;
  const cursor = new Date(start.getTime());
  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }

  return backwards ? -count : count;
}

/**
 * @param {Date} date
 * @returns {string} YYYY-MM-DD
 */
export function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}
