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
  it("excludes expired, invalid and no-go deadlines and keeps the current day", () => {
    const rows = [tender, { ...tender, id: "old", deadline: "2026-09-17" }, { ...tender, id: "today", deadline: "2026-09-18" }, { ...tender, id: "bad", deadline: "invalid" }, { ...tender, id: "no", analysis: { ...tender.analysis!, verdict: "no-go" as const } }];
    const result = dashboardSummary(rows, new Date(2026, 8, 18, 12));
    expect(result.total).toBe(5);
    expect(result.counts.go).toBe(4);
    expect(result.deadlines.map((row) => row.id)).toEqual(["today", "t1"]);
  });
  it("handles an empty account and absent dates", () => {
    expect(dashboardSummary([]).total).toBe(0);
    expect(dashboardSummary([]).deadlines).toEqual([]);
    expect(shortDate("invalid")).toBe("Non renseignée");
    expect(shortDate(null)).toBe("Non renseignée");
  });
});
