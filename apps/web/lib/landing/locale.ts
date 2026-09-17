export type LandingLocale = "fr" | "en";

export function resolveLandingLocale(query: unknown, saved?: string): LandingLocale {
  if (query === "fr" || query === "en") return query;
  return saved === "en" ? "en" : "fr";
}
