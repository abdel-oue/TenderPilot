// Fetch wrappers for tenders. ALL frontend fetching lives in lib/api/.
import { request } from "./client";
import type { MatrixRow, TenderDetail, TenderListItem } from "@/lib/types";

export async function fetchTenders(): Promise<TenderListItem[]> {
  const payload = (await request("/tenders")) as { tenders: TenderListItem[] };
  return payload.tenders;
}

export async function fetchTender(id: string): Promise<TenderDetail> {
  return (await request(`/tenders/${id}`)) as TenderDetail;
}

/** EX-02 + EX-03: every requirement, typed, with its source page. */
export async function fetchRequirements(id: string): Promise<MatrixRow[]> {
  const payload = (await request(`/tenders/${id}/requirements`)) as { requirements: MatrixRow[] };
  return payload.requirements;
}

export async function createTender(input: { reference: string; title?: string | null }) {
  return (await request("/tenders", { body: input })) as TenderDetail;
}
