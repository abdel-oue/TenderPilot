"use client";
// TanStack Query v5. Never useEffect + raw fetch.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTender, fetchRequirements, fetchTender, fetchTenders } from "@/lib/api/tenders";
import { uploadTenderDocument } from "@/lib/api/documents";
import { tenderKeys } from "@/lib/keys/tenderKeys";

export function useTenders() {
  return useQuery({ queryKey: tenderKeys.lists(), queryFn: fetchTenders });
}

export function useTender(id: string) {
  return useQuery({ queryKey: tenderKeys.detail(id), queryFn: () => fetchTender(id) });
}

/** EX-02: the compliance matrix. */
export function useRequirements(id: string) {
  return useQuery({ queryKey: tenderKeys.requirements(id), queryFn: () => fetchRequirements(id) });
}

/**
 * EX-01, both halves in one mutation: register the dossier, then push its PDFs.
 *
 * Sequential, not Promise.all — the tender has to exist before a document can
 * reference it, and uploading three 8 MB scans in parallel is how you find out
 * the api's body limit the hard way.
 */
export function useCreateDossier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { reference: string; title?: string; files: File[]; kind: string }) => {
      const tender = await createTender({ reference: input.reference, title: input.title ?? null });
      for (const file of input.files) {
        await uploadTenderDocument(tender.id, file, input.kind);
      }
      return tender;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tenderKeys.all }),
  });
}

/** Adds a document to a dossier that already exists. */
export function useUploadTenderDocument(tenderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { file: File; kind: string }) =>
      uploadTenderDocument(tenderId, input.file, input.kind),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tenderKeys.detail(tenderId) }),
  });
}
