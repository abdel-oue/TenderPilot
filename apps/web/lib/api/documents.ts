// Fetch wrappers for documents, including the EX-01 upload.
import { apiUrl, request } from "./client";
import type { TenderDocument } from "@/lib/types";

/**
 * The bytes go up as multipart/form-data. The `kind` field travels beside the
 * file; the api validates it against the shared enum before anything is written.
 */
function uploadBody(file: File, kind: string): FormData {
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", file);
  return form;
}

export async function uploadTenderDocument(tenderId: string, file: File, kind: string) {
  return (await request(`/tenders/${tenderId}/documents`, {
    body: uploadBody(file, kind),
  })) as TenderDocument;
}

export async function uploadCompanyDocument(file: File, kind: string) {
  return (await request("/company/documents", { body: uploadBody(file, kind) })) as TenderDocument;
}

export async function fetchCompanyDocuments(): Promise<TenderDocument[]> {
  const payload = (await request("/company/documents")) as { documents: TenderDocument[] };
  return payload.documents;
}

/**
 * EX-03, the whole trick: a plain link to the original PDF with a #page anchor.
 * The browser's own viewer opens it at the right page - no PDF.js, no embed.
 */
export function sourcePageUrl(documentId: string, page: number): string {
  return apiUrl(`/documents/${documentId}/file#page=${page}`);
}
