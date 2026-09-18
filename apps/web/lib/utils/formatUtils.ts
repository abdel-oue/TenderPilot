// Locale fr-FR: the corpus is French.
const LOCALE = "fr-FR";

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(LOCALE, { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Score is a numeric column, so it arrives as a string. */
export function formatScore(score: string | number | null): string {
  if (score === null || score === "") return "—";
  return `${Math.round(Number(score))}/100`;
}

export function formatConfidence(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 100)} %`;
}

export function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return "";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** "CPS art. 7.3, p. 4" — the citation label EX-03 makes clickable. */
export function formatCitation(page: number, article: string | null): string {
  return article ? `art. ${article}, p. ${page}` : `p. ${page}`;
}
