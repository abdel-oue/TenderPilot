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
 * Parses the date shapes that actually appear in a Moroccan CPS: ISO, French
 * numeric, and French long form. Anything else is refused rather than guessed -
 * a misparsed deadline is worse than no answer.
 *
 * @param {string} input
 * @returns {Date|null} UTC midnight, or null when the shape is not recognised
 */
export function parseDate(input) {
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input !== 'string') return null;

  const text = input.trim().toLowerCase();

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return utc(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // 12/03/2026 and 12-03-2026 are day-first: this is a French-language corpus,
  // and reading them month-first silently shifts most dates by months.
  const numeric = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (numeric) return utc(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));

  const long = text.match(/^(\d{1,2})\s+([a-zéû]+)\s+(\d{4})$/);
  if (long && FRENCH_MONTHS[long[2]]) {
    return utc(Number(long[3]), FRENCH_MONTHS[long[2]], Number(long[1]));
  }

  return null;
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
