import { describe, expect, it } from "vitest";
import { dashboardSummary, filterTenders, shortDate, tenderState } from "../../../lib/utils/dashboardUtils";
import type { TenderListItem } from "../../../lib/types";
const tender: TenderListItem = { id: "t1", reference: "AO-2026-001", title: "Assistance technique", buyer: "Rabat", deadline: "2026-09-20", estimatedValue: null, status: "analyzed", createdAt: "2026-09-01", analysis: { runId: "r1", status: "done", verdict: "go" } };
describe("dashboard data", () => {
  it("prioritizes a running or failed reanalysis over the previous verdict", () => {
    expect(tenderState({ ...tender, analysis: { ...tender.analysis!, status: "running" } })).toBe("active");
    expect(tenderState({ ...tender, status: "failed" })).toBe("failed");
  });
  it("searches reference, title and buyer while respecting the status filter", () => {
    expect(filterTenders([tender], " RABAT ", "go")).toHaveLength(1);
    expect(filterTenders([tender], "technique", "no-go")).toHaveLength(0);
    expect(filterTenders([tender], "2026-001", "all")).toHaveLength(1);
  });
  it("counts each dossier under its own state", () => {
    const rows = [tender, { ...tender, id: "old" }, { ...tender, id: "running", analysis: { ...tender.analysis!, status: "running" as const } }, { ...tender, id: "broken", status: "failed" as const }, { ...tender, id: "no", analysis: { ...tender.analysis!, verdict: "no-go" as const } }];
    const result = dashboardSummary(rows);
    expect(result.total).toBe(5);
    expect(result.counts.go).toBe(2);
    expect(result.counts["no-go"]).toBe(1);
    expect(result.counts.active).toBe(1);
    expect(result.counts.failed).toBe(1);
  });
  it("handles an empty account and absent dates", () => {
    expect(dashboardSummary([]).total).toBe(0);
    expect(shortDate("invalid")).toBe("Non renseignée");
    expect(shortDate(null)).toBe("Non renseignée");
  });
});
