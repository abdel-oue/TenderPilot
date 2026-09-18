import type { TenderListItem } from "../types";
export type TenderFilter = "all" | "go" | "no-go" | "active" | "pending" | "failed";
export function tenderState(tender: TenderListItem): Exclude<TenderFilter, "all"> {
  if (tender.analysis?.status === "failed" || tender.status === "failed") return "failed";
  if (["queued", "running"].includes(tender.analysis?.status ?? "") || ["ingesting", "analyzing"].includes(tender.status)) return "active";
  return tender.analysis?.verdict ?? "pending";
}
export function filterTenders(tenders: TenderListItem[], search: string, filter: TenderFilter): TenderListItem[] {
  const query = search.trim().toLocaleLowerCase("fr");
  return tenders.filter((tender) => (filter === "all" || tenderState(tender) === filter) && [tender.reference, tender.title, tender.buyer].some((value) => value?.toLocaleLowerCase("fr").includes(query))).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
export function dashboardSummary(tenders: TenderListItem[], now = new Date()) {
  const counts = { go: 0, "no-go": 0, active: 0, pending: 0, failed: 0 };
  for (const tender of tenders) counts[tenderState(tender)]++;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const deadlines = tenders.filter((tender) => tender.deadline && Date.parse(tender.deadline) >= today && tenderState(tender) !== "no-go").sort((a, b) => Date.parse(a.deadline!) - Date.parse(b.deadline!));
  return { counts, deadlines, total: tenders.length };
}
export function shortDate(value: string | null): string {
  if (!value || Number.isNaN(Date.parse(value))) return "Non renseignée";
  return new Intl.DateTimeFormat("fr-MA", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}
